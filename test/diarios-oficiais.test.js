const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  classifyAto,
  cnpjMask,
  cnpjRootMask,
  parseSigpubCards,
  rankSigpub,
  snippetAround,
} = require("../src/enrichment/diarios");
const { DOOL, citesCompany, doolHits, rankAtos, semadFilter } = require("../src/enrichment/estaduais");
const { sourcesForProject } = require("../src/enrichment/viability");

const amostra = (...parts) => fs.readFileSync(path.join(__dirname, "..", "amostras", ...parts), "utf8");

test("formata CNPJ e raiz como os diários publicam", () => {
  assert.equal(cnpjMask("17227422000105"), "17.227.422/0001-05");
  assert.equal(cnpjRootMask("17227422000105"), "17.227.422");
  assert.equal(cnpjMask("123"), null);
});

test("lê as matérias da busca SIGPub e ordena o município da ficha", () => {
  const cards = parseSigpubCards(amostra("CAPTURA-SIGPUB", "busca-amm-mg-cnpj-gerdau.html"), "amm-mg");
  assert.equal(cards.length, 3);
  assert.equal(cards[0].entidade, "Prefeitura de Ouro Branco");
  assert.equal(cards[0].data, "2026-09-14");
  assert.match(cards[0].url, /^https:\/\/www\.diariomunicipal\.com\.br\/amm-mg\/materia\//);
  const ranked = rankSigpub(cards, { municipio: "Ouro Branco", words: ["gerdau", "acominas"], cnpjRoot: "17.227.422" });
  assert.equal(ranked.length, 3);
  assert.equal(ranked.every((card) => card.no_municipio), true);
  assert.equal(ranked[0].tipo_ato, "ato_relevante");
});

test("descarta matéria que só tem parte do nome da empresa", () => {
  const card = { codigo: "1", titulo: "ATA", trecho: "Conselho Municipal de Política Cultural - CMPC de Rio Branco do Sul" };
  const ranked = rankSigpub([card], { municipio: "", words: ["cmpc", "iguacu"], cnpjRoot: "11.308.600" });
  assert.equal(ranked.length, 0);
});

test("descarta marca de produto citada sem CNPJ em compra de prefeitura", () => {
  const compra = { codigo: "1", titulo: "EXTRATO", entidade: "Prefeitura de X", trecho: "REFRIGERANTE DE COLA 2LTS AMBEV R$9,34" };
  const decreto = { codigo: "2", titulo: "DECRETO Nº 10", entidade: "Prefeitura de X", trecho: "declara de utilidade pública imóvel da AMBEV" };
  const ranked = rankSigpub([compra, decreto], { municipio: "", words: ["ambev"], cnpjRoot: "07.526.557" });
  assert.deepEqual(ranked.map((card) => card.codigo), ["2"]);
});

test("separa compra pública de ato relevante", () => {
  assert.equal(classifyAto({ titulo: "ATO DE HOMOLOGAÇÃO PE 075/2026", orgao: "", trecho: "GERDAU vergalhão" }), "compra_publica");
  assert.equal(classifyAto({ titulo: "", orgao: "", trecho: "Conceder LICENÇA DE ALTERAÇÃO à BYD" }), "ato_relevante");
});

test("lê páginas do DOE-BA e do DIOE-PR com o mesmo parser", () => {
  const ba = JSON.parse(amostra("CAPTURA-DOE-BA", "busca-cnpj-byd.json"));
  const hits = doolHits(ba, "\"50.351.104\"", DOOL["CAPTURA-DOE-BA"].link);
  assert.equal(hits.length, 3);
  assert.match(hits[0].url, /^https:\/\/dool\.egba\.ba\.gov\.br\/ver-flip\//);
  assert.equal(hits.every((hit) => /^\d{4}-\d{2}-\d{2}$/.test(hit.data)), true);
  const pr = JSON.parse(amostra("CAPTURA-DOE-PR", "busca-cnpj-cmpc-iguacu.json"));
  const prHits = doolHits(pr, "\"11.308.600\"", DOOL["CAPTURA-DOE-PR"].link);
  assert.match(prHits[0].url, /^https:\/\/www\.dioe\.pr\.gov\.br\/portal\/edicoes\/download\//);
});

test("acha o CNPJ depois do preâmbulo longo da portaria", () => {
  const preambulo = "O INSTITUTO DO MEIO AMBIENTE E RECURSOS HÍDRICOS - INEMA, com fulcro nas atribuições ".repeat(6);
  const payload = { hits: { hits: [{
    _id: "1_1",
    _source: { data: "2026-05-29", pagina: "41", diario_id: "1" },
    highlight: { conteudo: [`${preambulo} RESOLVE: Conceder LICENÇA DE ALTERAÇÃO à BYD AUTO DO BRASIL LTDA, CNPJ <strong>50</strong>.<strong>351</strong>.<strong>104</strong>/0001-19`] },
  }] } };
  const terms = { cnpjRoot: "50.351.104", words: ["byd", "auto"] };
  const [hit] = doolHits(payload, "q", DOOL["CAPTURA-DOE-BA"].link, terms);
  assert.equal(citesCompany(hit.texto, terms), true);
  assert.match(hit.trecho, /BYD AUTO DO BRASIL/);
});

test("aceita o CNPJ com ponto, espaço ou sem separador", () => {
  const terms = { cnpjRoot: "17.227.422", words: ["gerdau", "acominas"] };
  assert.equal(citesCompany("Gerdau Acominas S A (CNPJ:17 227 422/0001-05)", terms), true);
  assert.equal(citesCompany("CNPJ 17227422000105", { ...terms, words: [] }), true);
  assert.equal(citesCompany("vergalhão Gerdau", terms), false);
});

test("põe primeiro o ato que cita o município da ficha", () => {
  const ranked = rankAtos([
    { chave: "a", data: "2026-01-01", trecho: "Licença de operação em Juatuba" },
    { chave: "b", data: "2019-01-01", trecho: "Outorga em Sete Lagoas" },
    { chave: "b", data: "2019-01-01", trecho: "Outorga em Sete Lagoas" },
  ], "Sete Lagoas");
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].no_municipio, true);
});

test("monta o filtro da SEMAD pelo nome e sem aspas simples", () => {
  assert.equal(semadFilter("GERDAU ACOMINAS S/A"), "nome_pf_pj ILIKE '%gerdau%acominas%'");
  assert.equal(semadFilter("D'AVILA MINERACAO LTDA"), "nome_pf_pj ILIKE '%avila%mineracao%'");
});

test("recorta o trecho a partir do termo", () => {
  const text = `${"x ".repeat(200)}Bracell Sp Celulose Ltda 53.943.098/0001-87 Rodovia Juliano Lorenzetti`;
  assert.match(snippetAround(text, ["bracell"]), /Bracell Sp Celulose/);
  assert.equal(snippetAround("sem o termo", ["bracell"]), null);
});

test("liga o diário estadual e o municipal só onde há conector", () => {
  const codes = (project) => sourcesForProject(project).map((source) => source.codigo);
  const mg = codes({ uf: "MG", municipio: "Ouro Preto" });
  assert.equal(mg.includes("CAPTURA-DOE-MG"), true);
  assert.equal(mg.includes("SEC-SEMAD"), true);
  assert.equal(mg.includes("CAPTURA-DOE-SP"), false);
  assert.equal(mg.includes("CAPTURA-DOM-METAWAY"), false);
  const sp = codes({ uf: "SP", municipio: "Lençóis Paulista" });
  assert.equal(sp.includes("CAPTURA-DOM-METAWAY"), true);
  assert.equal(sp.includes("CAPTURA-SIGPUB"), true);
  assert.equal(codes({ uf: "SC", municipio: "Itajaí" }).includes("CAPTURA-SIGPUB"), false);
});
