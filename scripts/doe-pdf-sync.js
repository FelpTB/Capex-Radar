// Indexa os PDFs dos diários estaduais sem busca no portal (PA, PB, RO, RR).
// Uso: npm run doe:pdf-sync -- [--dias 30] [--uf PA,RO]
const { DIARIOS_PDF, syncDoePdf } = require("../src/enrichment/doe-pdf");
const db = require("../src/db");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function main() {
  const dias = Number(arg("dias", "7"));
  const ufs = String(arg("uf", Object.keys(DIARIOS_PDF).join(","))).toUpperCase().split(",");
  for (const uf of ufs) {
    const summary = await syncDoePdf(uf, { dias, log: (line) => console.log(line) });
    console.log(`${uf}: ${summary.listadas} edições listadas, ${summary.lidas} lidas, ${summary.paginas} páginas, ${summary.erros} erros.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
