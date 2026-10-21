const test = require("node:test");
const assert = require("node:assert/strict");
const {
  relevance,
  articleCandidates,
  privateProjectReason,
  queueReason,
  candidatePayload,
  selectForAnalysis,
} = require("../src/scanner");

test("prioriza notícia com valor e termo de projeto", () => {
  const score = relevance(
    "Empresa anuncia construção de fábrica",
    "Investimento de R$ 1,2 bilhão em Minas Gerais",
  );
  assert.ok(score >= 9);
});

test("descarta links institucionais e mantém notícia de CapEx", () => {
  const html = `
    <a href="/contato">Entre em contato com nossa equipe comercial</a>
    <article>
      <a href="/2026/09/nova-usina">Nova usina terá investimento de R$ 800 milhões</a>
      <p>Projeto será implantado no Ceará.</p>
    </article>`;
  const candidates = articleCandidates(html, "https://exemplo.com/");
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].url, "https://exemplo.com/2026/09/nova-usina");
});

test("mantém só projeto privado, brasileiro e de porte na fila", () => {
  const base = { esfera: "privada", pais: "BR", uf: "SC", envolve_orgao_publico: false };
  assert.equal(privateProjectReason({ ...base, valor_capex: 330_000_000, moeda: "BRL" }), null);
  assert.equal(privateProjectReason({ ...base, valor_capex: null }), null);
  assert.equal(privateProjectReason({ ...base, esfera: "publica" }), "projeto público");
  assert.equal(privateProjectReason({ ...base, envolve_orgao_publico: true }), "projeto público");
  assert.equal(privateProjectReason({ ...base, pais: "US", uf: null }), "projeto internacional");
  assert.equal(privateProjectReason({ ...base, pais: null, uf: null }), "projeto internacional");
  assert.equal(privateProjectReason({ ...base, valor_capex: 20_000_000, moeda: "BRL" }), "projeto pequeno");
  assert.equal(privateProjectReason({ ...base, valor_capex: 30_000_000, moeda: "USD" }), null);
  assert.equal(privateProjectReason({ esfera: "fora" }), "não é projeto");
});

test("mantém a notícia na fila quando ao menos um projeto é privado", () => {
  const weg = {
    nome: "Fábrica da Weg",
    esfera: "privada",
    pais: "BR",
    uf: "SC",
    envolve_orgao_publico: false,
    valor_capex: 330_000_000,
    moeda: "BRL",
  };
  const aena = {
    nome: "Pátio de Congonhas",
    esfera: "publica",
    pais: "BR",
    uf: "SP",
    envolve_orgao_publico: true,
  };
  assert.equal(queueReason([aena, weg]), null);
  assert.equal(queueReason([aena]), "projeto público");
  assert.equal(candidatePayload([aena, weg]).nome, "Fábrica da Weg");
  assert.equal(candidatePayload([aena, weg]).projetos.length, 2);
});

test("derruba manchete macro e estrangeira antes da leitura", () => {
  assert.ok(relevance("Bitcoin cai para US$ 82 mil antes de dados da economia dos EUA") < 3);
  assert.ok(relevance("Dívida pública federal vai a R$ 9,29 trilhões em agosto, diz Tesouro") < 3);
  assert.ok(relevance("Honda quer investir US$ 2,5 bilhões em nova fábrica nos Estados Unidos") < 6);
  assert.ok(relevance("WEG dobra capacidade de nova fábrica de baterias em SC com investimento de R$ 330 milhões") >= 9);
});

test("limita a leitura por fonte e pelo total da rodada", () => {
  const ranked = [
    { id_fonte: "a", relevancia: 9 },
    { id_fonte: "a", relevancia: 8 },
    { id_fonte: "b", relevancia: 7 },
  ];
  const selected = selectForAnalysis(ranked, { perSource: 1, limit: 2 });
  assert.deepEqual(selected.map((item) => item.id_fonte), ["a", "b"]);
});
