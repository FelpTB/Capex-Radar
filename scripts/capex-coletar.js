// Coleta as notícias das empresas do teste de monitoramento (capex_radar, Fase 3).
//
// Lê o Google News RSS de cada grupo, grava as notícias em capex_radar.evidencias
// e faz a triagem (regras e IA). É retomável: janelas já lidas são puladas.
//
// Uso:
//   npm run capex:coletar                          carga histórica desde a janela do seed (2023-01-01)
//   npm run capex:coletar -- --grupo Bracell       só um grupo (aceita % como coringa)
//   npm run capex:coletar -- --desde 2025-01-01 --ate 2025-07-01
//   npm run capex:coletar -- --sem-ia              grava e aplica só as regras
//   npm run capex:coletar -- --refazer             relê janelas já lidas
//   npm run capex:coletar -- --pausa 1500          ms entre consultas ao RSS
//   npm run capex:coletar -- --lote 2 --tamanho 50 só o 2º lote de 50 grupos (ordem: nicho, ranking, nome)
//   npm run capex:coletar -- --lotes               lista os lotes e sai
const { Client } = require("pg");
const { getConfig } = require("../src/config");
const { carregarGrupos, coletarGrupos, resumoTexto } = require("../src/capex-coletor");
const { iaPadrao } = require("../src/capex-ia");
const seedTermos = require("../seeds/capex_radar/termos-busca.json");

function argumentos(argv) {
  const args = { semIa: false, refazer: false, lotes: false };
  for (let i = 0; i < argv.length; i += 1) {
    const chave = argv[i];
    if (chave === "--sem-ia") args.semIa = true;
    else if (chave === "--refazer") args.refazer = true;
    else if (chave === "--lotes") args.lotes = true;
    else if (["--grupo", "--desde", "--ate", "--pausa", "--lote", "--tamanho"].includes(chave)) args[chave.slice(2)] = argv[++i];
    else throw new Error(`Argumento desconhecido: ${chave}`);
  }
  return args;
}

function amanha() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const args = argumentos(process.argv.slice(2));
  const config = getConfig();
  const ia = args.semIa ? null : iaPadrao();
  const desde = args.desde || seedTermos.janela_inicio;
  const ate = args.ate || amanha();

  const client = new Client({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const todos = await carregarGrupos(client, { nome: args.grupo });
    if (!todos.length) throw new Error("Nenhum grupo ativo com termos de busca encontrado.");
    // Lotes de até --tamanho grupos (padrão 50), na ordem de carregarGrupos.
    const tamanho = Math.min(Number(args.tamanho) || 50, 50);
    const lotes = [];
    for (let i = 0; i < todos.length; i += tamanho) lotes.push(todos.slice(i, i + tamanho));
    if (args.lotes) {
      lotes.forEach((l, i) => console.log(`Lote ${i + 1} (${l.length}): ${l.map((g) => g.nome).join(", ")}`));
      return;
    }
    const grupos = args.lote ? lotes[Number(args.lote) - 1] || [] : todos;
    if (!grupos.length) throw new Error(`Lote ${args.lote} não existe (há ${lotes.length}).`);
    console.log(`Coletando ${grupos.length} grupos de ${desde} a ${ate} ${ia ? `com IA (${ia.modelo})` : "sem IA"}.`);
    const resultado = await coletarGrupos({
      client,
      grupos,
      desde,
      ate,
      ia,
      pausaMs: args.pausa ? Number(args.pausa) : 1500,
      refazer: args.refazer,
      log: (linha) => console.log(linha),
    });
    console.table(resultado.triagem.map((t) => ({
      grupo: t.grupo, lidas: t.lidas, regras: t.regras, ia_descartadas: t.ia_descartadas,
      capex: t.capex, sugeridos: t.sugeridos, novos_projetos: t.novos_projetos, erros_ia: t.erros_ia,
    })));
    console.log(resumoTexto(resultado));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Falha na coleta: ${error.message}`);
  process.exitCode = 1;
});
