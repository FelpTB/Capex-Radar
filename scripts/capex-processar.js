// Fases 4 e 5 do funil (Enriquecimento e Filtro 3) sobre o que passou pelo
// Filtro 2. Grava as decisões; a fila é retomável (o que esta versão já fez
// não volta).
//
// Uso:
//   npm run capex:processar                       todos os grupos
//   npm run capex:processar -- --grupo JBS        só um grupo (aceita % como coringa)
//   npm run capex:processar -- --limite 20        no máximo N notícias por grupo e fase
//   npm run capex:processar -- --so enriquecimento   só uma fase (enriquecimento | filtro3)
//   npm run capex:processar -- --contar           só conta a fila de cada fase, sem chamar a IA
//
// Precisa de CLAUDE_API_KEY. Modelos: CLAUDE_ENRICH_MODEL e CLAUDE_FILTER3_MODEL
// (padrão claude-sonnet-5-5). O Enriquecimento usa a busca e a leitura de
// páginas da API, cobradas por busca: teste com --limite antes da carga toda.
const { Client } = require("pg");
const { getConfig } = require("../src/config");
const { criarCliente } = require("../src/claude");
const { carregarGrupos } = require("../src/capex-coletor");
const enriquecimento = require("../src/capex-enriquecimento");
const filtroFinal = require("../src/capex-filtro-final");

function argumentos(argv) {
  const args = { contar: false };
  for (let i = 0; i < argv.length; i += 1) {
    const chave = argv[i];
    if (chave === "--contar") args.contar = true;
    else if (["--grupo", "--limite", "--so"].includes(chave)) args[chave.slice(2)] = argv[++i];
    else throw new Error(`Argumento desconhecido: ${chave}`);
  }
  if (args.so && !["enriquecimento", "filtro3"].includes(args.so)) throw new Error("--so aceita enriquecimento ou filtro3");
  return args;
}

async function main() {
  const args = argumentos(process.argv.slice(2));
  const config = getConfig();
  const anthropic = criarCliente(config.claudeApiKey);
  if (!anthropic && !args.contar) throw new Error("CLAUDE_API_KEY não configurada.");
  const enriquecedor = args.so === "filtro3" ? null : enriquecimento.criarEnriquecedor({ client: anthropic, modelo: config.claudeEnrichModel });
  const filtro = args.so === "enriquecimento" ? null : filtroFinal.criarFiltroFinal({ client: anthropic, modelo: config.claudeFilter3Model });
  const limite = args.limite ? Number(args.limite) : 400;
  const client = new Client({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const grupos = await carregarGrupos(client, { nome: args.grupo });
    if (!grupos.length) throw new Error("Nenhum grupo encontrado.");
    if (args.contar) {
      const ids = grupos.map((g) => g.id);
      const [fe, ff] = [await enriquecimento.contarFila(client, ids), await filtroFinal.contarFila(client, ids)];
      const total = (m) => [...m.values()].reduce((t, n) => t + n, 0);
      for (const g of grupos) if (fe.get(g.id) || ff.get(g.id)) console.log(`${g.nome}: ${fe.get(g.id) || 0} para enriquecer, ${ff.get(g.id) || 0} para o Filtro 3`);
      console.log(`Total: ${total(fe)} para enriquecer (custo estimado US$ ${(total(fe) * 0.04).toFixed(0)} a ${(total(fe) * 0.08).toFixed(0)}), ${total(ff)} já prontas para o Filtro 3.`);
      return;
    }
    for (const grupo of grupos) {
      if (enriquecedor) {
        const r = await enriquecimento.enriquecerGrupo({ db: client, grupo, enriquecedor, limite });
        if (r.lidas) console.log(`${grupo.nome} · Enriquecimento: ${r.lidas} lidas, ${r.enriquecidas} com matéria, ${r.sem_materia} sem, ${r.buscas} buscas${r.erros ? `, ${r.erros} erros (${r.ultimo_erro})` : ""}`);
      }
      if (filtro) {
        const r = await filtroFinal.filtrarGrupo({ db: client, grupo, filtro, limite });
        if (r.lidas) console.log(`${grupo.nome} · Filtro 3: ${r.lidas} lidas, ${r.mantidas} para aprovação, ${r.descartadas} descartadas${r.erros ? `, ${r.erros} erros (${r.ultimo_erro})` : ""}`);
      }
    }
  } finally {
    await client.end();
    await require("../src/db").pool.end(); // as gravações usam o pool do app
  }
}

main().catch((error) => {
  console.error(`Falha no processamento: ${error.message}`);
  process.exitCode = 1;
});
