const test = require("node:test");
const assert = require("node:assert/strict");
const {
  extractCompanyCandidates,
  normalizeName,
} = require("../src/company-candidates");

test("detecta empresa apresentada por marcador explícito", () => {
  const candidates = extractCompanyCandidates(
    "A empresa Vale anunciou a ampliação da mina no Pará.",
  );
  assert.ok(candidates.includes("Vale"));
});

test("detecta a empresa mesmo depois de um adjetivo", () => {
  const candidates = extractCompanyCandidates(
    "A multinacional brasileira Weg anunciou a ampliação da fábrica.",
  );
  assert.ok(candidates.includes("Weg"));
});

test("detecta empresa como sujeito da decisão de investimento", () => {
  const candidates = extractCompanyCandidates(
    "Petrobras estima perfurar três poços adicionais em 2027.",
  );
  assert.ok(candidates.includes("Petrobras"));
});

test("preserva razão social e siglas como opções separadas", () => {
  const candidates = extractCompanyCandidates(
    "O consórcio Infra Brasil S.A. assinou contrato com o BNDES.",
  );
  assert.ok(candidates.some((name) => name.includes("Infra Brasil")));
  assert.ok(candidates.includes("BNDES"));
});

test("normaliza variações somente para validar escolha fechada", () => {
  assert.equal(normalizeName("Vibra Energia S.A."), "vibra energia s a");
});
