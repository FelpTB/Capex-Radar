const test = require("node:test");
const assert = require("node:assert/strict");
const { esc, money, statusKind } = require("../src/html");
const { SOURCE_CATEGORIES, sourceCategory } = require("../src/source-categories");

test("escapa HTML vindo das fontes", () => {
  assert.equal(esc('<script>"x"</script>'), "&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
});

test("formata CapEx em reais", () => {
  const value = money(100_000_000, "BRL");
  assert.match(value, /100\.000\.000/);
});

test("destaca estados operacionais", () => {
  assert.equal(statusKind("operacao"), "success");
  assert.equal(statusKind("bloqueado"), "danger");
});

test("filtra e ordena fontes por acesso, papel, recorrência e nome", () => {
  const { filterAndSortSources } = require("../src/source-filters");
  const sources = [
    { nome: "Zeta", tipo: "secundaria", status_acesso: "ok", frequencia_projetos: "alta", categoria: "dataset_download" },
    { nome: "Alfa", tipo: "primaria", status_acesso: "instavel", frequencia_projetos: "baixa", categoria: "portal_web" },
    { nome: "Beta", tipo: "primaria", status_acesso: "ok", frequencia_projetos: "media", categoria: "portal_web" },
  ];
  const byName = filterAndSortSources(sources, { ordenar: "nome" }).map((s) => s.nome);
  assert.deepEqual(byName, ["Alfa", "Beta", "Zeta"]);
  const onlyPrimary = filterAndSortSources(sources, { papel: "primaria", ordenar: "acesso" });
  assert.deepEqual(onlyPrimary.map((s) => s.nome), ["Alfa", "Beta"]);
  const byFrequency = filterAndSortSources(sources, { ordenar: "recorrencia" }).map((s) => s.nome);
  assert.deepEqual(byFrequency, ["Zeta", "Beta", "Alfa"]);
  const onlyPortal = filterAndSortSources(sources, { extracao: "portal_web", ordenar: "nome" });
  assert.deepEqual(onlyPortal.map((s) => s.nome), ["Alfa", "Beta"]);
  const onlyPrivateNews = filterAndSortSources([
    ...sources,
    { nome: "Info", tipo: "primaria", status_acesso: "ok", frequencia_projetos: "alta", categoria: "portal_web", esfera_noticia: "privada" },
    { nome: "Aneel", tipo: "primaria", status_acesso: "ok", frequencia_projetos: "media", categoria: "portal_web", esfera_noticia: "publica" },
  ], { noticia: "privada" });
  assert.deepEqual(onlyPrivateNews.map((s) => s.nome), ["Info"]);
});

test("descreve todas as categorias de extração", () => {
  assert.deepEqual(Object.keys(SOURCE_CATEGORIES), [
    "api_publica",
    "api_privada",
    "dataset_download",
    "base_consultavel",
    "portal_web",
  ]);
  assert.equal(sourceCategory("api_publica").label, "API Pública");
  assert.match(sourceCategory("dataset_download").description, /CSV|ZIP/);
});
