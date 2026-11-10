const test = require("node:test");
const assert = require("node:assert/strict");
const { fecharDecisoes, camposAplicados, montarEntrada, semEnriquecimento, MOTIVOS, PROMPT } = require("../src/capex-avaliacao-projetos");

const projetos = [
  { id: "p0", titulo: "Bracell — fábrica de celulose", uf: "MS", municipio: "Bataguassu", estagio: "anuncio", valor_estimado_brl: null, objeto: null, data_anuncio: null },
  { id: "p1", titulo: "Bracell — nova fábrica de celulose", uf: "MS", municipio: null, estagio: "licenciamento", valor_estimado_brl: "16000000000", objeto: "fábrica", data_anuncio: "2026-07-24" },
  { id: "p2", titulo: "Bracell — acessos", uf: "MS", municipio: "Bataguassu", estagio: "anuncio", valor_estimado_brl: null, objeto: null, data_anuncio: null },
  { id: "p3", titulo: "Bracell — plano 2030", uf: null, municipio: null, estagio: "anuncio", valor_estimado_brl: null, objeto: null, data_anuncio: null },
];

const resposta = (itens) => JSON.stringify({ projetos: itens });

test("duplicado aponta para o projeto válido, seguindo a cadeia", () => {
  const d = fecharDecisoes(resposta([
    { p: 0, decisao: "duplicado", duplicado_de: 2, justificativa: "a" },
    { p: 1, decisao: "valido", justificativa: "b", correcoes: { municipio: "Bataguassu", estagio: "licenciamento" } },
    { p: 2, decisao: "duplicado", duplicado_de: "p1", justificativa: "c" },
    { p: 3, decisao: "invalido", motivo: "generico", justificativa: "d" },
  ]), projetos);
  assert.deepEqual([d.get(0).decisao, d.get(0).duplicado_de], ["duplicado", 1]);
  assert.deepEqual([d.get(2).decisao, d.get(2).duplicado_de], ["duplicado", 1]);
  assert.deepEqual([d.get(3).decisao, d.get(3).motivo], ["invalido", "generico"]);
  assert.equal(d.get(1).decisao, "valido");
});

test("sem motivo ou sem projeto válido de referência, o projeto fica", () => {
  const d = fecharDecisoes(resposta([
    { p: 0, decisao: "invalido", motivo: null, justificativa: "a" },
    { p: 1, decisao: "duplicado", duplicado_de: 3, justificativa: "b" },
    { p: 2, decisao: "duplicado", duplicado_de: 2, justificativa: "c" },
    { p: 3, decisao: "invalido", motivo: "repetida", justificativa: "d" },
  ]), projetos);
  assert.equal(d.get(0).decisao, "valido");
  assert.match(d.get(0).ajuste, /sem motivo/);
  assert.equal(d.get(1).decisao, "valido"); // p3 não ficou válido
  assert.equal(d.get(2).decisao, "valido"); // aponta para si mesmo
  assert.equal(d.get(3).decisao, "valido"); // repetida não é motivo da carteira
});

test("correções só preenchem campos vazios; o estágio é atualizado", () => {
  const campos = camposAplicados(projetos[1], {
    decisao: "valido",
    correcoes: { titulo: "Bracell — fábrica em Bataguassu", objeto: "outra", municipio: "Bataguassu", valor_brl: 20e9, estagio: "mobilizacao", data_anuncio: "2026-07-03" },
  });
  assert.deepEqual(campos, { municipio: "Bataguassu", estagio: "mobilizacao" });
  // Município de outra UF não entra.
  assert.deepEqual(camposAplicados(projetos[1], { decisao: "valido", correcoes: { uf: "SP", municipio: "Lençóis Paulista" } }), {});
  assert.deepEqual(camposAplicados(projetos[3], { decisao: "invalido", correcoes: { uf: "MS" } }), {});
  // Estágio não recua.
  assert.deepEqual(camposAplicados(projetos[1], { decisao: "valido", correcoes: { estagio: "anuncio" } }), {});
  assert.deepEqual(camposAplicados(projetos[1], { decisao: "valido", correcoes: { estagio: "cancelado" } }), { estagio: "cancelado" });
});

test("entrada leva as notícias enriquecidas de cada projeto e o prompt traz os motivos", () => {
  const comNoticias = projetos.map((p, i) => ({
    ...p,
    noticias: i === 0 ? [
      { id: "e1", titulo: "Bracell anuncia fábrica", data_original: "2026-07-03", enriquecimento: { encontrou: true, resumo: "r", perfil: { uf: "MS", valor_brl: null, filial_sugerida: {} }, trechos: ["a", "b", "c"] } },
      { id: "e2", titulo: "Bracell adia obra", data_original: "2026-08-01", enriquecimento: null },
    ] : [],
  }));
  const e = montarEntrada({ nome: "Bracell", nicho: "papel_celulose" }, comNoticias);
  assert.deepEqual(e.projetos[0].noticias[0].perfil, { uf: "MS" });
  assert.equal(e.projetos[0].noticias[0].trechos.length, 2);
  assert.equal(e.projetos[1].valor_brl, 16e9);
  assert.deepEqual(semEnriquecimento(comNoticias).map((n) => n.id), ["e2"]);
  assert.ok(!("repetida" in MOTIVOS));
  for (const codigo of Object.keys(MOTIVOS)) assert.ok(PROMPT.includes(codigo), codigo);
});
