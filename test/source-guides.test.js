const test = require("node:test");
const assert = require("node:assert/strict");
const { collectableSources } = require("../src/enrichment/viability");
const { sourceGuide, sourceGuides } = require("../src/source-guides");

test("cada fonte conectada explica o dado e o acesso", () => {
  const codes = collectableSources().map((source) => source.codigo);
  assert.deepEqual(Object.keys(sourceGuides()).sort(), [...codes].sort());
  for (const codigo of codes) {
    const guide = sourceGuide(codigo);
    assert.equal(guide.resumo.length > 40, true, codigo);
    assert.equal(typeof guide.modo, "string", `${codigo} modo`);
    assert.equal(guide.modo.length > 15, true, `${codigo} modo`);
    assert.equal(guide.fluxo.length >= 5, true, `${codigo} fluxo`);
    assert.equal(
      guide.fluxo.every((step) => step.length > 15),
      true,
      `${codigo} fluxo`,
    );
    for (const key of ["informa", "acesso", "associacao", "alcance"]) {
      assert.equal(guide[key].length >= 2, true, `${codigo} ${key}`);
      assert.equal(
        guide[key].every((item) => item.length > 60),
        true,
        `${codigo} ${key}`,
      );
    }
    assert.equal(guide.campos.length >= 3, true, codigo);
    assert.equal((guide.extraido?.meio || "").length > 40, true, `${codigo} meio`);
    const grupos = guide.extraido?.grupos || [];
    const campos = grupos.flatMap((grupo) => grupo.campos || []);
    assert.equal(campos.length >= 3, true, `${codigo} formato`);
    for (const [chave, tipo, detalhe] of campos) {
      assert.match(chave, /^[\p{L}\p{N}_ .()[\]/'³²¹°$?,-]+$/u, `${codigo} ${chave}`);
      assert.equal(tipo.length > 3, true, `${codigo} ${chave}`);
      assert.equal(detalhe.length > 12, true, `${codigo} ${chave}`);
    }
    // Exceção só para portal que não responde em HTTPS e diz isso na nota do link.
    const soHttp = (link) => /só responde em HTTP/.test(link.nota);
    assert.equal(guide.url.startsWith("https://") || guide.origem.links.some(soHttp), true, codigo);
    assert.equal(Boolean(guide.copia), true, codigo);
    assert.equal(guide.origem.orgao.length > 2, true, `${codigo} orgao`);
    assert.equal(guide.origem.acesso.length > 40, true, `${codigo} acesso da origem`);
    assert.equal(guide.origem.links.length >= 1, true, `${codigo} links`);
    for (const link of guide.origem.links) {
      assert.equal(link.url.startsWith("https://") || soHttp(link), true, `${codigo} ${link.papel}`);
      assert.equal(typeof link.fixa, "boolean", `${codigo} ${link.papel}`);
      assert.equal(link.nota.length > 20, true, `${codigo} ${link.papel}`);
    }
  }
});
