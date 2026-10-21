const test = require("node:test");
const assert = require("node:assert/strict");
const { parseFieldDetail, fieldDetailHtml } = require("../src/field-detail-html");
const { esc } = require("../src/html");

test("parseFieldDetail separa prosa e lista com contagem", () => {
  const sample =
    "Nome completo do ato. O CSV não grava a sigla. Nesta edição há 60 textos: Licença Prévia (800); Anuência (638); Indeferimento de Licença Prévia (3).";
  const { blocks } = parseFieldDetail(sample);
  assert.equal(blocks[0].type, "prose");
  assert.equal(blocks[1].type, "list");
  assert.equal(blocks[1].items.length, 3);
  assert.equal(blocks[1].items[0].label, "Licença Prévia");
  assert.equal(blocks[1].items[0].count, "800");
});

test("parseFieldDetail nao confunde horario com lista", () => {
  const sample =
    "Geração do extrato, igual em todas as linhas. Nesta edição, 21/10/2026 01:02. Não é a data do ato.";
  const { blocks } = parseFieldDetail(sample);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "prose");
});

test("fieldDetailHtml gera lista e details para enum longo", () => {
  const items = Array.from({ length: 20 }, (_, index) => `Item ${index} (${index + 1})`).join("; ");
  const html = fieldDetailHtml(`Intro. Nesta edição há 20 textos: ${items}.`, esc);
  assert.match(html, /field-enum/);
  assert.match(html, /field-enum-more/);
  assert.match(html, /Mais 8 valores/);
  assert.doesNotMatch(html, /\uFFFD/);
});
