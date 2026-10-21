const test = require("node:test");
const assert = require("node:assert/strict");
const {
  chooseStatusDate,
  periodStart,
  publicationDateFromHtml,
} = require("../src/status-date");

test("prefere a data do trecho e ignora prazo futuro", () => {
  const text = "A fábrica entrou em obras em março de 2026. A entrega está prevista para dezembro de 2028.";
  const chosen = chooseStatusDate({
    text,
    trecho: "A fábrica entrou em obras em março de 2026.",
    publishedAt: "2026-10-02",
    today: "2026-10-02",
  });
  assert.deepEqual(chosen, { status_em: "2026-03-01", origem: "texto" });
});

test("usa a publicação quando o texto não tem data passada", () => {
  const chosen = chooseStatusDate({
    text: "A empresa anunciou a fábrica e prevê a entrega em 2028.",
    trecho: "A empresa anunciou a fábrica",
    publishedAt: "2026-09-14T11:00:00Z",
    today: "2026-10-02",
  });
  assert.deepEqual(chosen, { status_em: "2026-09-14", origem: "publicacao" });
});

test("a janela de cruzamento começa 18 meses antes do status", () => {
  assert.equal(periodStart("2026-03-15"), "2024-09-15");
  assert.equal(periodStart(null), null);
});

test("lê a data de publicação do HTML", () => {
  const html = `
    <meta property="article:published_time" content="2026-04-03T08:00:00-03:00">
    <time datetime="2020-01-01">antiga</time>`;
  assert.equal(publicationDateFromHtml(html), "2026-04-03");
});
