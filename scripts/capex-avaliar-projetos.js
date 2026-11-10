// Avaliação dos projetos da carteira: enriquece as notícias dos projetos que
// ainda não têm o texto da matéria e pede a um modelo que diga, empresa por
// empresa, quais projetos são válidos, inválidos ou duplicados.
//
// Uso:
//   npm run capex:avaliar-projetos -- --contar              projetos e notícias sem enriquecimento
//   npm run capex:avaliar-projetos -- --grupo Bracell --simular   mostra as decisões sem gravar
//   npm run capex:avaliar-projetos                          avalia e aplica em todos os grupos
//   npm run capex:avaliar-projetos -- --refazer             reavalia grupos já avaliados
//   npm run capex:avaliar-projetos -- --sem-enriquecimento  avalia sem enriquecer o que falta
//
// --simular também enriquece as notícias que faltam (isso grava o
// enriquecimento, que é útil de qualquer forma), mas não muda nenhum projeto.
// Modelos: CLAUDE_FILTER3_MODEL (avaliação) e CLAUDE_ENRICH_MODEL.
const { Client } = require("pg");
const { getConfig } = require("../src/config");
const { criarCliente } = require("../src/claude");
const { carregarGrupos } = require("../src/capex-coletor");
const enriquecimento = require("../src/capex-enriquecimento");
const avaliacao = require("../src/capex-avaliacao-projetos");

function argumentos(argv) {
  const args = { simular: false, contar: false, refazer: false, enriquecer: true };
  for (let i = 0; i < argv.length; i += 1) {
    const chave = argv[i];
    if (chave === "--simular") args.simular = true;
    else if (chave === "--contar") args.contar = true;
    else if (chave === "--refazer") args.refazer = true;
    else if (chave === "--sem-enriquecimento") args.enriquecer = false;
    else if (chave === "--grupo") args.grupo = argv[++i];
    else throw new Error(`Argumento desconhecido: ${chave}`);
  }
  return args;
}

const ROTULO = { valido: "VÁLIDO   ", invalido: "INVÁLIDO ", duplicado: "DUPLICADO" };

async function main() {
  const args = argumentos(process.argv.slice(2));
  const config = getConfig();
  const anthropic = criarCliente(config.claudeApiKey);
  if (!anthropic && !args.contar) throw new Error("CLAUDE_API_KEY não configurada.");
  const avaliador = avaliacao.criarAvaliador({ client: anthropic, modelo: config.claudeFilter3Model });
  const enriquecedor = args.enriquecer ? enriquecimento.criarEnriquecedor({ client: anthropic, modelo: config.claudeEnrichModel }) : null;
  const client = new Client({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const grupos = await carregarGrupos(client, { nome: args.grupo });
    if (!grupos.length) throw new Error("Nenhum grupo encontrado.");
    const total = { projetos: 0, validos: 0, invalidos: 0, duplicados: 0, alterados: 0, enriquecidas: 0, erros: 0 };
    for (const grupo of grupos) {
      if (args.contar) {
        const projetos = await avaliacao.projetosDoGrupo(client, grupo.id);
        if (!projetos.length) continue;
        const faltam = avaliacao.semEnriquecimento(projetos).length;
        total.projetos += projetos.length;
        total.enriquecidas += faltam;
        console.log(`${grupo.nome}: ${projetos.length} projeto(s), ${faltam} notícia(s) sem enriquecimento`);
        continue;
      }
      const r = await avaliacao.avaliarGrupo({ db: client, grupo, avaliador, enriquecedor, simular: args.simular, refazer: args.refazer });
      if (!r.projetos) continue;
      for (const campo of Object.keys(total)) total[campo] += r[campo] || 0;
      console.log(`\n${grupo.nome}: ${r.projetos} projeto(s) · ${r.validos} válido(s), ${r.invalidos} inválido(s), ${r.duplicados} duplicado(s)${r.enriquecidas ? ` · ${r.enriquecidas} notícia(s) enriquecida(s)` : ""}${r.erros ? ` · ${r.erros} erro(s) (${r.ultimo_erro})` : ""}`);
      for (const d of r.decisoes) {
        const extra = d.decisao === "duplicado" ? ` ⟶ fica “${d.duplicado_de}”` : d.motivo ? ` [${d.motivo}]` : "";
        const mudou = Object.keys(d.aplicado).length ? `  (muda: ${Object.entries(d.aplicado).map(([k, v]) => `${k}=${v}`).join(", ")})` : "";
        console.log(`  ${ROTULO[d.decisao]} ${d.titulo.slice(0, 90)}${extra}${mudou}`);
        console.log(`            ${d.justificativa}`);
      }
    }
    if (args.contar) {
      console.log(`Total: ${total.projetos} projeto(s), ${total.enriquecidas} notícia(s) a enriquecer (custo estimado US$ ${(total.enriquecidas * 0.04).toFixed(0)} a ${(total.enriquecidas * 0.08).toFixed(0)}).`);
    } else {
      console.log(`\nTotal${args.simular ? " (simulação, nenhum projeto mudou)" : ""}: ${total.projetos} projeto(s), ${total.validos} válido(s), ${total.invalidos} inválido(s), ${total.duplicados} duplicado(s), ${total.alterados} com campos corrigidos, ${total.enriquecidas} notícia(s) enriquecida(s), ${total.erros} erro(s).`);
    }
  } finally {
    await client.end();
    await require("../src/db").pool.end();
  }
}

main().catch((error) => {
  console.error(`Falha na avaliação: ${error.message}`);
  process.exitCode = 1;
});
