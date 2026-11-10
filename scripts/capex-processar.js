// Fases 4 e 5 do funil (Enriquecimento e Filtro 3) sobre o que passou pelo
// Filtro 2. Grava as decisões; a fila é retomável (o que esta versão já fez
// não volta).
//
// Uso:
//   npm run capex:processar                       todos os grupos
//   npm run capex:processar -- --grupo JBS        só um grupo (aceita % como coringa)
//   npm run capex:processar -- --limite 20        no máximo N notícias por grupo e fase
//   npm run capex:processar -- --so enriquecimento   só uma fase (enriquecimento | filtro3)
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
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const chave = argv[i];
    if (["--grupo", "--limite", "--so"].includes(chave)) args[chave.slice(2)] = argv[++i];
    else throw new Error(`Argumento desconhecido: ${chave}`);
  }
  if (args.so && !["enriquecimento", "filtro3"].includes(args.so)) throw new Error("--so aceita enriquecimento ou filtro3");
  return args;
}

async function main() {
  const args = argumentos(process.argv.slice(2));
  const config = getConfig();
  const anthropic = criarCliente(config.claudeApiKey);
  if (!anthropic) throw new Error("CLAUDE_API_KEY não configurada.");
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
  }
}

main().catch((error) => {
  console.error(`Falha no processamento: ${error.message}`);
  process.exitCode = 1;
});
