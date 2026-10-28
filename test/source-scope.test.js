const test = require("node:test");
const assert = require("node:assert/strict");
const { SCOPES, scopeApplies, scopeCoverage, sourceScope } = require("../src/source-scope");
const { catalogPageBody, hasSourcePage, hubBody } = require("../src/source-hub-html");
const { collectableSources } = require("../src/enrichment/viability");
const { filterAndSortSources } = require("../src/source-filters");
const { BRAZIL_UFS } = require("../src/source-lifecycle");

test("toda fonte conectada tem uma das três abrangências", () => {
  for (const { codigo } of collectableSources()) {
    assert.ok(SCOPES[sourceScope(codigo).abrangencia], codigo);
  }
  assert.equal(sourceScope("SEC-BNDES").abrangencia, "nacional");
  assert.equal(sourceScope("CAPTURA-DOE-MG").abrangencia, "estadual");
  assert.equal(sourceScope("CAPTURA-SIGPUB").abrangencia, "municipal");
  assert.equal(sourceScope("NEWS-NOVOPORTAL").abrangencia, "nacional");
});

test("UFs das fontes estaduais e municipais existem", () => {
  for (const codigo of ["CAPTURA-DOE-BA", "SEC-SEMAD", "CAPTURA-SIGPUB", "CAPTURA-DOM-METAWAY", "NEWS-OTEMPO", "CAPTURA-FUNDOS-REGIONAIS"]) {
    for (const uf of sourceScope(codigo).ufs || []) assert.ok(BRAZIL_UFS.includes(uf), `${codigo} ${uf}`);
  }
});

test("a fonte estadual só vale para o próprio estado", () => {
  assert.equal(scopeApplies("SEC-SEMAD", { uf: "MG", municipio: "Ouro Preto" }), true);
  assert.equal(scopeApplies("SEC-SEMAD", { uf: "SP", municipio: "Lençóis Paulista" }), false);
  assert.equal(scopeApplies("CAPTURA-DOE", { uf: "RS" }), true);
  assert.equal(scopeApplies("SEC-SEMAD", {}), false);
});

test("a fonte municipal exige o município coberto", () => {
  assert.equal(scopeApplies("CAPTURA-DOM-METAWAY", { uf: "SP", municipio: "Lencois Paulista" }), true);
  assert.equal(scopeApplies("CAPTURA-DOM-METAWAY", { uf: "SP", municipio: "Bauru" }), false);
  assert.equal(scopeApplies("CAPTURA-SIGPUB", { uf: "MG", municipio: "Ouro Branco" }), true);
  assert.equal(scopeApplies("CAPTURA-SIGPUB", { uf: "SC", municipio: "Itajaí" }), false);
  assert.equal(scopeApplies("SEC-CNO", { uf: "SC", municipio: "Itajaí" }), true);
});

test("descreve a cobertura de cada abrangência", () => {
  assert.equal(scopeCoverage(sourceScope("CAPTURA-DOM-METAWAY")), "Lençóis Paulista/SP");
  assert.equal(scopeCoverage(sourceScope("SEC-IAT")), "PR");
  assert.match(scopeCoverage(sourceScope("SEC-ANTAQ-INST")), /portos/);
});

test("notícia não ganha página; as demais fontes ganham", () => {
  assert.equal(hasSourcePage("NEWS-INFRA"), false);
  assert.equal(hasSourcePage("SEC-CETESB"), true);
  assert.equal(hasSourcePage("CAPTURA-DOE-BA"), true);
});

const sources = [
  { codigo: "SEC-BNDES", nome: "BNDES", tipo: "secundaria", conteudo: "Financiamentos" },
  { codigo: "SEC-SEMAD", nome: "SEMAD", tipo: "secundaria", conteudo: "Licenças MG" },
  { codigo: "SEC-CETESB", nome: "CETESB", tipo: "secundaria", conteudo: "Licenças SP" },
  { codigo: "CAPTURA-SIGPUB", nome: "SIGPub", tipo: "primaria", conteudo: "Diários municipais" },
  { codigo: "NEWS-INFRA", nome: "Agência iNFRA", tipo: "primaria", conteudo: "Notícias" },
];

test("o hub separa as três abrangências e filtra pelo local do projeto", () => {
  const all = hubBody(sources);
  for (const key of Object.keys(SCOPES)) assert.match(all, new RegExp(`id="${key}"`));
  assert.match(all, /href="\/fontes\/SEC-CETESB"/);
  assert.doesNotMatch(all, /NEWS-INFRA/);
  const mg = hubBody(sources, { uf: "MG", municipio: "Ouro Preto" });
  assert.match(mg, /SEC-SEMAD/);
  assert.doesNotMatch(mg, /SEC-CETESB/);
  assert.match(mg, /SEC-BNDES/);
});

test("a página de catálogo diz que a fonte não tem conector", () => {
  const html = catalogPageBody({
    codigo: "SEC-CETESB",
    nome: "CETESB Licenciamento (SP)",
    tipo: "secundaria",
    categoria: "base_consultavel",
    url_base: "https://cetesb.sp.gov.br/",
    conteudo: "Licenças de SP",
    status_acesso: "ok",
    formato_dado: "formulario",
    auth_acesso: "nenhuma",
    papel_captura: "enriquecimento",
  });
  assert.match(html, /sem conector/);
  assert.match(html, /Estadual/);
  assert.match(html, /Cobertura\.<\/strong> SP/);
});

test("filtra o dashboard pela abrangência", () => {
  const rows = filterAndSortSources([
    { nome: "A", abrangencia: "estadual" },
    { nome: "B", abrangencia: "nacional" },
  ], { abrangencia: "estadual" });
  assert.deepEqual(rows.map((row) => row.nome), ["A"]);
});
