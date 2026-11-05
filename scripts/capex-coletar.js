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
const { Client } = require("pg");
const { getConfig } = require("../src/config");
const { carregarGrupos, coletarGrupos, resumoTexto } = require("../src/capex-coletor");
const { iaPadrao } = require("../src/capex-ia");
const seedTermos = require("../seeds/capex_radar/termos-busca.json");

function argumentos(argv) {
  const args = { semIa: false, refazer: false };
  for (let i = 0; i < argv.length; i += 1) {
    const chave = argv[i];
    if (chave === "--sem-ia") args.semIa = true;
    else if (chave === "--refazer") args.refazer = true;
    else if (["--grupo", "--desde", "--ate", "--pausa"].includes(chave)) args[chave.slice(2)] = argv[++i];
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
    const grupos = await carregarGrupos(client, { nome: args.grupo });
    if (!grupos.length) throw new Error("Nenhum grupo ativo com termos de busca encontrado.");
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
