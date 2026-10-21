const test = require("node:test");
const assert = require("node:assert/strict");
const { publishersFromRss, isIgnoredDomain, codigoForDomain } = require("../src/publisher-radar");
const { promotionDecision, shouldRetire } = require("../src/source-lifecycle");
const { isDue, summarize } = require("../src/scheduler");

const SAMPLE_RSS = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>Empresa anuncia fábrica de R$ 1 bilhão</title>
    <link>https://news.google.com/rss/articles/ABC</link>
    <description>Texto que não pode ser persistido</description>
    <source url="https://www.infomoney.com.br">InfoMoney</source>
  </item>
  <item>
    <title>Obra do ministério</title>
    <source url="https://www.gov.br/mme">Ministério</source>
  </item>
  <item>
    <title>Outra capa</title>
    <source url="https://clickpetroleoegas.com.br/materia">Click Petróleo e Gás</source>
  </item>
</channel></rss>`;

test("extrai só o portal do RSS e descarta a matéria", () => {
  const publishers = publishersFromRss(SAMPLE_RSS);
  assert.deepEqual(publishers, [
    { dominio: "infomoney.com.br", nome: "InfoMoney" },
    { dominio: "clickpetroleoegas.com.br", nome: "Click Petróleo e Gás" },
  ]);
  assert.equal(JSON.stringify(publishers).includes("fábrica"), false);
  assert.equal(JSON.stringify(publishers).includes("news.google.com"), false);
});

test("ignora agregador e domínio público", () => {
  assert.equal(isIgnoredDomain("news.google.com"), true);
  assert.equal(isIgnoredDomain("www.gov.br"), true);
  assert.equal(isIgnoredDomain("agencia.mg.gov.br"), true);
  assert.equal(isIgnoredDomain("infomoney.com.br"), false);
});

test("gera código estável a partir do domínio", () => {
  assert.equal(codigoForDomain("www.infomoney.com.br"), "NEWS-INFOMONEY");
});

test("promove a prova só com rendimento privado no Brasil", () => {
  assert.equal(promotionDecision({ analyzed: 3, privateBrazil: 2 }), "aguardar");
  assert.equal(promotionDecision({ analyzed: 5, privateBrazil: 1 }), "fixa");
  assert.equal(promotionDecision({ analyzed: 8, privateBrazil: 0 }), "aposentar");
  assert.equal(promotionDecision({ analyzed: 6, privateBrazil: 1 }), "aguardar");
});

test("aposenta fonte parada ou bloqueada e preserva a fixa recente", () => {
  assert.equal(shouldRetire({
    estagio: "fixa",
    status_acesso: "ok",
    days_in_stage: 10,
    days_since_private: 10,
  }), false);
  assert.equal(shouldRetire({
    estagio: "fixa",
    status_acesso: "ok",
    days_in_stage: 30,
    days_since_private: null,
  }), true);
  assert.equal(shouldRetire({
    estagio: "fixa",
    status_acesso: "bloqueado",
    days_in_stage: 1,
    days_since_private: 0,
  }), true);
  assert.equal(shouldRetire({
    estagio: "prova",
    status_acesso: "ok",
    days_in_stage: 22,
    analyzed: 4,
    private_brazil: 0,
  }), true);
});

test("considera o relógio do ciclo e resume a rodada sem matéria", () => {
  const now = Date.parse("2026-09-28T12:00:00Z");
  assert.equal(isDue(null, 1000, now), true);
  assert.equal(isDue("2026-09-28T11:30:00Z", 2 * 60 * 60 * 1000, now), false);
  assert.equal(isDue("2026-09-28T09:00:00Z", 2 * 60 * 60 * 1000, now), true);
  const text = summarize({
    descoberta: { aparicoes: 4, sugeridas: 2, provas: 1, erros: [] },
  });
  assert.match(text, /4 portais/);
  assert.equal(text.includes("http"), false);
});
