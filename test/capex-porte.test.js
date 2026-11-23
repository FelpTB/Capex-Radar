const test = require("node:test");
const assert = require("node:assert/strict");
const porte = require("../src/capex-porte");

test("lê área construída e do terreno pela palavra mais perto do número", () => {
  assert.deepEqual(
    porte.areaDosTextos(["Novo centro de distribuição em área de 300 mil m²", "galpão com 150 mil metros quadrados"]),
    { construida_m2: 150000, terreno_m2: 300000 },
  );
  assert.deepEqual(porte.areaDosTextos(["área construída de 45 mil m² num terreno de 1,2 milhão de m²"]), { construida_m2: 45000, terreno_m2: 1200000 });
  assert.equal(porte.areaDosTextos(["terreno de 12 hectares"]).terreno_m2, 120000);
  assert.deepEqual(porte.areaDosTextos(["fábrica de R$ 1 bilhão"]), { construida_m2: null, terreno_m2: null });
});

test("obra do CNO muito maior que a notícia não passa de improvável (caso Mercado Livre Jacareí)", () => {
  const perfil = { area_terreno_m2: 300000 };
  const condominio = { nome: "VIOBRAS - CENTRO LOGÍSTICO DE JACAREÍ", area: "2393443.52", areas: [], origem_cno: "sob_encomenda" };
  const r = porte.aplicarTeto({ probabilidade: 67, motivo: "mesma área" }, condominio, perfil);
  assert.equal(r.probabilidade, 45);
  assert.match(r.motivo, /^Porte: obra de 2,39 milhões de m², 8 vezes/);
  const bts = { area: "134760.29", areas: [{ categoria: "Obra Nova", metragem: "134760.29" }] };
  assert.equal(porte.aplicarTeto({ probabilidade: 85, motivo: "BTS" }, bts, perfil).probabilidade, 85);
});

test("com a marca no nome o teto é de incerta; sem área na notícia não há teto", () => {
  const obra = { nome: "OBRA MERCADO LIVRE", area: "2000000", areas: [] };
  assert.equal(porte.aplicarTeto({ probabilidade: 80 }, obra, { area_terreno_m2: 300000 }, { citaMarca: true }).probabilidade, 59);
  assert.equal(porte.aplicarTeto({ probabilidade: 80 }, obra, {}).probabilidade, 80);
  assert.equal(porte.citaEmpresa({ origem_cno: "raiz" }, []), true);
});
