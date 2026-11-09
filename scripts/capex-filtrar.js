// Filtro CapEx sobre a fila "A revisar" (segunda passada depois da triagem).
//
// Uso:
//   npm run capex:filtrar                         filtra a fila de todos os grupos
//   npm run capex:filtrar -- --grupo JBS          só um grupo (aceita % como coringa)
//   npm run capex:filtrar -- --simular            mostra as decisões sem gravar
//   npm run capex:filtrar -- --limite 50          no máximo N notícias por grupo
//   npm run capex:filtrar -- --modelo claude-sonnet-5-5
//
// Precisa de CLAUDE_API_KEY. O modelo vem de CLAUDE_FILTER_MODEL (padrão
// claude-sonnet-5-5). A fila é retomável: o que esta versão já decidiu não volta.
const { Client } = require("pg");
const { getConfig } = require("../src/config");
const { criarCliente } = require("../src/claude");
const { carregarGrupos } = require("../src/capex-coletor");
const { criarFiltro, filtrarGrupo, VERSAO_FILTRO } = require("../src/capex-filtro");

function argumentos(argv) {
  const args = { simular: false };
  for (let i = 0; i < argv.length; i += 1) {
    const chave = argv[i];
    if (chave === "--simular") args.simular = true;
    else if (["--grupo", "--limite", "--modelo"].includes(chave)) args[chave.slice(2)] = argv[++i];
    else throw new Error(`Argumento desconhecido: ${chave}`);
  }
  return args;
}

async function main() {
  const args = argumentos(process.argv.slice(2));
  const config = getConfig();
  const anthropic = criarCliente(config.claudeApiKey);
  if (!anthropic) throw new Error("CLAUDE_API_KEY não configurada.");
  const filtro = criarFiltro({ client: anthropic, modelo: args.modelo || config.claudeFilterModel });
  const client = new Client({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const grupos = await carregarGrupos(client, { nome: args.grupo });
    if (!grupos.length) throw new Error("Nenhum grupo encontrado.");
    console.log(`Filtro ${VERSAO_FILTRO} com ${filtro.modelo} em ${grupos.length} grupo(s)${args.simular ? " (simulação, nada é gravado)" : ""}.`);
    const resumos = [];
    for (const grupo of grupos) {
      const r = await filtrarGrupo({
        db: client,
        grupo,
        filtro,
        simular: args.simular,
        limite: args.limite ? Number(args.limite) : 400,
      });
      if (!r.lidas) continue;
      resumos.push(r);
      console.log(`${grupo.nome}: ${r.lidas} lidas, ${r.mantidas} mantidas, ${r.descartadas} descartadas (${r.repetidas} repetidas)${r.erros ? `, ${r.erros} erros (${r.ultimo_erro})` : ""}`);
      if (args.simular) {
        for (const d of r.decisoes) {
          const marca = d.decisao === "manter" ? "MANTER " : `FORA:${d.motivo}`;
          console.log(`  ${d.data || "----------"} ${marca.padEnd(22)} ${d.titulo.slice(0, 100)}${d.repete_titulo ? `  ⟶ repete “${d.repete_titulo.slice(0, 60)}”` : ""}`);
        }
      }
    }
    const soma = (campo) => resumos.reduce((t, r) => t + (r[campo] || 0), 0);
    const motivos = {};
    for (const r of resumos) for (const [m, n] of Object.entries(r.motivos)) motivos[m] = (motivos[m] || 0) + n;
    console.log(`Total: ${soma("lidas")} lidas, ${soma("mantidas")} mantidas, ${soma("descartadas")} descartadas, ${soma("erros")} erros.`);
    if (Object.keys(motivos).length) console.table(motivos);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Falha no filtro: ${error.message}`);
  process.exitCode = 1;
});
