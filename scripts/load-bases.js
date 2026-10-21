const { loadBases } = require("../src/enrichment/load");

const only = process.argv.slice(2);

loadBases(only)
  .then(({ results, manual }) => {
    for (const result of results) {
      if (result.erro) {
        console.error(`${result.codigo}: falhou. ${result.erro}`);
      } else {
        console.log(`${result.codigo}: ${result.linhas} linhas, ${result.bytes} bytes.`);
      }
    }
    console.log("\nAinda depende de ação manual:");
    if (!only.length) {
      for (const item of manual) {
        console.log(`\n${item.codigo}`);
        console.log(item.porque);
        console.log(item.como);
      }
    }
  })
  .catch((error) => {
    console.error(`Falha na carga: ${error.message}`);
    process.exitCode = 1;
  });
