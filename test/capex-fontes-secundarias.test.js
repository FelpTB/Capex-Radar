const test = require("node:test");
const assert = require("node:assert/strict");
const sec = require("../src/capex-fontes-secundarias");

test("registro da fonte vira evidência com data, título e chave estável", () => {
  const bndes = { numero_contrato: "123", data_contratacao: "2024-05-10", descricao: "Implantação de fábrica", valor_contratado: 500000000, uf: "MS" };
  assert.equal(sec.dataDoRegistro(bndes), "2024-05-10");
  assert.match(sec.tituloDoRegistro("BNDES operações", "SEC-BNDES", bndes), /^BNDES operações: Implantação de fábrica · R\$ 500\.000\.000/);
  assert.equal(sec.chaveDoRegistro("SEC-BNDES", bndes), sec.chaveDoRegistro("SEC-BNDES", { ...bndes, correlacao: "outra frase" }));
  assert.notEqual(sec.chaveDoRegistro("SEC-BNDES", bndes), sec.chaveDoRegistro("SEC-BNDES", { ...bndes, numero_contrato: "124" }));
  const licenca = { tipo_licenca: "LI", numero_licenca: "77/2025", data_emissao: "2025-02-01", empreendimento: "Fábrica de celulose" };
  assert.match(sec.tituloDoRegistro("Ibama", "SEC-IBAMA", licenca), /LI 77\/2025 · Fábrica de celulose/);
  assert.equal(sec.dataDoRegistro({ data: "sem data" }), null);
});

test("projeto da carteira vira a ficha que a coleta do MVP espera", () => {
  const ficha = sec.projetoParaColeta({ id: "p", titulo: "Bracell — fábrica", nicho: "papel_celulose", uf: "MS", municipio: "Bataguassu", matriz_cnpj: "53943098000187", matriz_razao_social: "BRACELL SP", estagio: "licenciamento", data_anuncio: "2026-07-03", objeto: "fábrica" });
  assert.deepEqual([ficha.nome, ficha.cnpj, ficha.empresa_nome, ficha.status_em], ["Bracell — fábrica", "53943098000187", "BRACELL SP", "2026-07-03"]);
});

test("linha do tempo liga os marcos às evidências e ordena por data", () => {
  const evidencias = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const raw = JSON.stringify({
    resumo: "r", estagio: "mobilizacao",
    marcos: [
      { data: "2025-06", marco: "início de obra", tipo: "obra", evidencias: [2, 9] },
      { data: "2024-03-01", marco: "anúncio", tipo: "anuncio", evidencias: [0, 1, 0] },
      { data: null, marco: "sem data", tipo: "qualquer", evidencias: [] },
    ],
  });
  const l = sec.lerLinhaDoTempo(raw, evidencias);
  assert.deepEqual(l.marcos.map((m) => m.marco), ["anúncio", "início de obra", "sem data"]);
  assert.deepEqual(l.marcos[0].evidencias, ["a", "b"]);
  assert.deepEqual(l.marcos[1].evidencias, ["c"]);
  assert.equal(l.marcos[2].tipo, "outro");
  assert.equal(sec.avancaEstagio("contratacao_epc", "licenciamento"), false);
  assert.equal(sec.avancaEstagio("licenciamento", "mobilizacao"), true);
  assert.equal(sec.avancaEstagio("operacao", "cancelado"), true);
});

test("entrada da linha do tempo separa notícia de registro oficial", () => {
  const e = sec.entradaLinha({ titulo: "t", grupo: "g", uf: "MS", municipio: "x", valor_estimado_brl: "10", estagio: "anuncio" }, [
    { id: "a", fonte_codigo: "gnews_rss", veiculo: "Valor", titulo: "n", data_original: "2024-01-02", enriquecimento: { resumo: "r", trechos: ["1", "2", "3"] } },
    { id: "b", fonte_codigo: "SEC-CNO", fonte_nome: "CNO", titulo: "o", data_original: "2024-02-02", texto: "registro" },
  ]);
  assert.deepEqual(e.evidencias.map((x) => x.tipo), ["noticia", "registro_oficial"]);
  assert.equal(e.evidencias[0].trechos.length, 2);
  assert.equal(e.evidencias[1].registro, "registro");
  assert.equal(e.projeto.valor_brl, 10);
});
