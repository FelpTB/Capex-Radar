const { Client } = require("pg");
const { getConfig } = require("../src/config");
const { syncDadosGov } = require("../src/enrichment/dadosgov");

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((arg) => !arg.startsWith("--"));

async function recordInDatabase(results) {
  const config = getConfig();
  const client = new Client({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    for (const result of results) {
      if (result.acao === "atual" || result.acao === "vigiado") continue;
      await client.query(
        `insert into base_carga (codigo, recurso, status, bytes, erro)
         values ($1, $2, $3, $4, $5)`,
        [
          result.codigo,
          `${result.conjunto}/${result.arquivo}`,
          result.acao === "erro" ? "erro" : "baixado",
          result.bytes ?? null,
          result.erro ?? null,
        ],
      );
    }
  } finally {
    await client.end();
  }
}

syncDadosGov({ only, force })
  .then(async (results) => {
    for (const result of results) {
      if (result.acao === "erro") {
        console.error(`${result.codigo} ${result.arquivo}: falhou. ${result.erro}`);
      } else {
        const data = result.lastModified ? ` origem ${result.lastModified}` : "";
        const tamanho = result.bytes != null ? ` ${result.bytes} bytes` : "";
        const pasta = result.ultimaPasta ? ` última pasta ${result.ultimaPasta}` : "";
        console.log(`${result.codigo} ${result.arquivo}: ${result.acao}.${data}${tamanho}${pasta}`);
      }
    }
    await recordInDatabase(results);
  })
  .catch((error) => {
    console.error(`Falha na sincronização: ${error.message}`);
    process.exitCode = 1;
  });
