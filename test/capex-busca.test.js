const test = require("node:test");
const assert = require("node:assert/strict");
const { consultaGoogleNews, separarTermos, linhasDoSeed, buscaDoGrupo } = require("../src/capex-busca");
const seed = require("../seeds/capex_radar/termos-busca.json");
const empresas = require("../seeds/capex_radar/empresas-teste.json");

test("junta termos com OR, exige contexto e aplica a janela", () => {
  const q = consultaGoogleNews({
    termos: ["Mercado Livre", "Ebazar"],
    contexto: ["centro de distribuição", "galpão"],
    desde: "2023-01-01",
    ate: "2023-07-01",
  });
  assert.equal(q, '("Mercado Livre" OR "Ebazar") ("centro de distribuição" OR galpão) after:2023-01-01 before:2023-07-01');
});

test("termo único fica sem parênteses e exclusão entra com menos", () => {
  const q = consultaGoogleNews({ termos: ["Suzano"], contexto: ["fábrica"], exclusoes: ["Prefeitura de Suzano"] });
  assert.equal(q, '"Suzano" fábrica -"Prefeitura de Suzano"');
});

test("aspas internas e espaços repetidos são limpos, e termos repetidos somem", () => {
  const q = consultaGoogleNews({ termos: ['  "Klabin"  ', "Klabin"] });
  assert.equal(q, '"Klabin"');
});

test("sem termo da empresa a consulta falha", () => {
  assert.throws(() => consultaGoogleNews({ termos: [" "] }), /pelo menos um termo/);
});

test("data inválida falha em vez de gerar consulta errada", () => {
  assert.throws(() => consultaGoogleNews({ termos: ["Ambev"], desde: "01/01/2023" }), /Data inválida/);
});

test("separa termos ativos por tipo, com a marca primeiro", () => {
  const { termos, exclusoes } = separarTermos([
    { termo: "Ebazar", tipo: "razao_social" },
    { termo: "Mercado Livre", tipo: "marca" },
    { termo: "Mercado Envios", tipo: "variacao", ativo: false },
    { termo: "Amazônia", tipo: "exclusao" },
  ]);
  assert.deepEqual(termos, ["Mercado Livre", "Ebazar"]);
  assert.deepEqual(exclusoes, ["Amazônia"]);
});

test("buscaDoGrupo devolve a URL do RSS com a consulta codificada", () => {
  const { consulta, url } = buscaDoGrupo({
    linhas: [{ termo: "Equinix", tipo: "marca" }],
    contexto: ["data center"],
    desde: "2023-01-01",
  });
  assert.equal(consulta, '"Equinix" "data center" after:2023-01-01');
  assert.match(url, /^https:\/\/news\.google\.com\/rss\/search\?q=/);
  assert.equal(new URL(url).searchParams.get("q"), consulta);
});

test("o seed cobre as 38 empresas, todas com marca e consulta válida", () => {
  const nomes = empresas.empresas.map((e) => e.grupo);
  assert.equal(nomes.length, 38);
  for (const nome of nomes) {
    const entrada = seed.grupos[nome];
    assert.ok(entrada, `sem termos: ${nome}`);
    assert.ok(entrada.marca?.length, `sem marca: ${nome}`);
    const nicho = empresas.empresas.find((e) => e.grupo === nome).nicho;
    const { consulta } = buscaDoGrupo({
      linhas: linhasDoSeed(entrada),
      contexto: seed.contexto_por_nicho[nicho],
      desde: seed.janela_inicio,
    });
    assert.match(consulta, /after:2023-01-01$/);
    assert.ok(consulta.length < 500, `consulta longa demais: ${nome}`);
  }
});
