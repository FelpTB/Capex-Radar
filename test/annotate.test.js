const test = require("node:test");
const assert = require("node:assert/strict");
const { annotateBndes, annotateCno } = require("../src/enrichment/annotate");

test("anota o CNO pelo período e guarda as linhas sem o rank", () => {
  const note = annotateCno({
    total: 10,
    noPeriodo: 3,
    desde: "2025-03-01",
    amostra: [{ cno: "1", municipio: "ITAJAI", rank: 5 }],
  });
  assert.equal(
    note.texto,
    "Foram achadas 3 obras para a empresa no Cadastro Nacional de Obras nesse período.",
  );
  assert.deepEqual(note.linhas, [{ cno: "1", municipio: "ITAJAI" }]);
});

test("separa operação do BNDES dentro e fora da janela", () => {
  const noPeriodo = annotateBndes({ n: 4, no_periodo: 1, linhas: [{ numero_contrato: "9" }] });
  const antiga = annotateBndes({ n: 4, no_periodo: 0, linhas: [] });
  assert.match(noPeriodo.texto, /1 operação do BNDES/);
  assert.match(antiga.texto, /nenhuma na janela/);
  assert.equal(annotateBndes({ n: 0 }), null);
});
