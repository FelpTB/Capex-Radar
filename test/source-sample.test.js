const test = require("node:test");
const assert = require("node:assert/strict");
const { readRawSample, sampleSectionHtml } = require("../src/source-sample");

test("lê o arquivo bruto e o LEIA da amostra da fonte", () => {
  const raw = readRawSample("CAPTURA-SIGPUB");
  assert.equal(raw.arquivo, "amostras/CAPTURA-SIGPUB/busca-amm-mg-cnpj-gerdau.html");
  assert.match(raw.conteudo, /materia-card/);
  assert.match(raw.leia, /Fonte: CAPTURA-SIGPUB/);
});

test("fonte sem registro público mostra só o LEIA da tentativa", () => {
  const raw = readRawSample("SEC-INEA");
  assert.equal(raw.arquivo, null);
  assert.match(raw.leia, /Sem arquivo bruto/);
  const html = sampleSectionHtml({ raw, evidence: null, manual: true });
  assert.match(html, /Não há arquivo bruto/);
  assert.match(html, /não tem conector/);
});

test("fonte estadual manual mostra o arquivo bruto da consulta", () => {
  const raw = readRawSample("SEC-FEPAM");
  assert.equal(raw.arquivo, "amostras/SEC-FEPAM/doclicenciatorio-cmpc.html");
  assert.match(raw.conteudo, /CMPC CELULOSE RIOGRANDENSE/);
});

test("não lê fora da pasta de amostras", () => {
  assert.equal(readRawSample("../src"), null);
  assert.equal(readRawSample("SEM-AMOSTRA"), null);
});

test("mostra os registros guardados com link para o projeto", () => {
  const html = sampleSectionHtml({
    raw: null,
    evidence: {
      linhas: [{ titulo: "DECRETO <b>1</b>", url: "https://exemplo.gov.br/a" }],
      titulo_ou_resumo: "Foram achados 1 matéria",
      coletado_em: "2026-10-26T12:00:00Z",
      projeto_id: "abc",
      projeto_nome: "Gerdau",
    },
  });
  assert.match(html, /Registro 1/);
  assert.match(html, /DECRETO &lt;b&gt;1&lt;\/b&gt;/);
  assert.match(html, /href="\/projetos\/abc"/);
  assert.equal(sampleSectionHtml({ raw: null, evidence: null }), "");
});
