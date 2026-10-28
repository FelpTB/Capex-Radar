const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const doe = require("../src/enrichment/doe-estados");
const pdf = require("../src/enrichment/doe-pdf");
const { DOOL, doolHits } = require("../src/enrichment/estaduais");
const { DOE_ESTADOS, DOE_SEM_CONECTOR } = require("../src/doe-registry");
const { DOE_UFS, sourcesForProject } = require("../src/enrichment/viability");

function amostra(codigo, arquivo, encoding = "utf8") {
  return fs.readFileSync(path.join(__dirname, "..", "amostras", codigo, arquivo), encoding);
}

const json = (codigo, arquivo) => JSON.parse(amostra(codigo, arquivo));

function assertHits(hits, uf) {
  assert.equal(hits.length > 0, true, uf);
  for (const hit of hits) {
    assert.ok(hit.chave, `${uf} chave`);
    assert.match(String(hit.data), /^\d{4}-\d{2}-\d{2}$/, `${uf} data`);
    assert.match(hit.url, /^https?:\/\//, `${uf} url`);
    assert.equal((hit.texto || hit.trecho || "").length > 20, true, `${uf} texto`);
    assert.equal(/<[^>]+>/.test(hit.texto || ""), false, `${uf} sem HTML`);
  }
}

test("lê a amostra bruta de cada diário com API própria", () => {
  assertHits(doe.amHits(json("CAPTURA-DOE-AM", "busca-cnpj-petrobras.json")), "AM");
  assertHits(doe.dfHits(json("CAPTURA-DOE-DF", "busca-cnpj-petrobras.json")), "DF");
  assertHits(doe.msHits(json("CAPTURA-DOE-MS", "busca-cnpj-suzano.json")), "MS");
  assertHits(doe.peHits(json("CAPTURA-DOE-PE", "busca-cnpj-petrobras.json")), "PE");
  assertHits(doe.alHits(json("CAPTURA-DOE-AL", "busca-cnpj-braskem.json")), "AL");
  assertHits(doe.scHits(json("CAPTURA-DOE-SC", "busca-cnpj-weg.json")), "SC");
  assertHits(doe.rsHits(json("CAPTURA-DOE-RS", "busca-cnpj-braskem.json"), "doe"), "RS");
  assertHits(doe.rjHits(amostra("CAPTURA-DOE-RJ", "busca-cnpj-petrobras.html")), "RJ");
  assertHits(doe.maHits(json("CAPTURA-DOE-MA", "busca-cnpj-vale.json")), "MA");
  assertHits(doe.acHits(amostra("CAPTURA-DOE-AC", "busca-cnpj-energisa-acre.html", "latin1")), "AC");
});

test("monta o link de cada portal com os campos da resposta", () => {
  const [am] = doe.amHits(json("CAPTURA-DOE-AM", "busca-cnpj-petrobras.json"));
  assert.equal(am.url, "https://diario.imprensaoficial.am.gov.br/portal/edicoes/download/17678/49");
  assert.equal(am.titulo, "PORTARIA 171/2024 - GDP/ARSEPAM");
  const [pe] = doe.peHits(json("CAPTURA-DOE-PE", "busca-cnpj-petrobras.json"));
  assert.equal(pe.url.endsWith(`publicacao=${Buffer.from(String(pe.chave)).toString("base64")}`), true);
  const [sc] = doe.scHits(json("CAPTURA-DOE-SC", "busca-cnpj-weg.json"));
  assert.equal(sc.url.endsWith("/1232829.html"), true, "SC sem o sufixo _final");
  const [rj] = doe.rjHits(amostra("CAPTURA-DOE-RJ", "busca-cnpj-petrobras.html"));
  assert.deepEqual([rj.chave, rj.data, rj.pagina], ["2769719", "2026-10-16", 1]);
  assert.match(rj.url, /view_publicacao\.php\?d=.*&s=/, "RJ guarda a assinatura da busca");
  const [ma] = doe.maHits(json("CAPTURA-DOE-MA", "busca-cnpj-vale.json"));
  assert.equal(ma.url, "https://diariooficial.ma.gov.br/download.php?arq=TE20261014#page=29");
  const [al] = doe.alHits(json("CAPTURA-DOE-AL", "busca-cnpj-braskem.json"));
  assert.equal(al.texto.includes("42.150.391/0020-33"), true, "AL desfaz a barra escapada do <\\/em>");
});

test("TO e CE só listam onde o termo está; o texto vem do PDF", () => {
  const editions = doe.toEditions(amostra("CAPTURA-DOE-TO", "busca-cnpj-petrobras.html"));
  assert.deepEqual(editions[0], { numero: "4451", data: "2015-09-03", paginas: 214, url: "https://doe.to.gov.br/diario/2880/download" });
  const rows = doe.ceRows(amostra("CAPTURA-DOE-CE", "busca-cnpj-petrobras.html", "latin1"));
  assert.equal(rows[0].pdf, "https://imagens.seplag.ce.gov.br/PDF/20150102/do20150102p02.pdf", "CE troca para HTTPS e /PDF/");
  assert.equal(rows[0].pagina, 23);
  assert.equal(doe.pageCites("CNPJ 33 000 167/0001-01", { cnpjRoot: "33.000.167", words: [] }), true);
});

test("PI fica com as notas de todas as palavras e descarta quem publicou", () => {
  const results = doe.piResults(json("CAPTURA-DOE-PI", "busca-nome-petrobras.json"), ["petrobras"]);
  assert.deepEqual([results[0].edicao, results[0].data, results[0].secao], ["236", "2023-12-12", "AVISOS"]);
  assert.equal(doe.piResults(json("CAPTURA-DOE-PI", "busca-nome-petrobras.json"), ["petrobras", "xyz"]).length, 0);
  const nota = doe.piNote(json("CAPTURA-DOE-PI", "nota-145dd154.json"));
  assert.equal(nota.texto.startsWith("AGÊNCIA DE ATRAÇÃO"), true, "decodifica as entidades HTML");
  assert.deepEqual(Object.keys(nota).sort(), ["data", "orgao", "texto", "titulo"]);
});

test("os estados do motor IONEWS leem a amostra com o mesmo parser do DOE-BA", () => {
  for (const [uf, arquivo] of [["AP", "busca-cnpj-petrobras.json"], ["ES", "busca-cnpj-vale.json"], ["GO", "busca-cnpj-petrobras.json"], ["MT", "busca-cnpj-petrobras.json"], ["SE", "busca-cnpj-petrobras.json"]]) {
    const codigo = `CAPTURA-DOE-${uf}`;
    const hits = doolHits(json(codigo, arquivo), "\"termo\"", DOOL[codigo].link);
    assert.equal(hits.length > 0, true, uf);
    assert.match(hits[0].url, uf === "SE" ? /\/ver-flip\// : /\/portal\/edicoes\/download\/\d+\/\d+$/, uf);
  }
});

test("RN usa a mesma API SDOE do PE, com outra base", () => {
  const hits = doe.rnHits(json("CAPTURA-DOE-RN", "busca-cnpj-petrobras.json"));
  assertHits(hits, "RN");
  assert.equal(hits[0].url.startsWith("https://deirn.sdoe.com.br/diariooficialweb/#/visualizar-publicacao?publicacao="), true);
  assert.equal(hits.some((hit) => hit.texto.includes("IDEMA")), true, "RN traz a licença do IDEMA");
});

test("PA, PB, RO e RR listam as edições de cada portal", () => {
  const pa = pdf.paEditions(amostra("CAPTURA-DOE-PA", "1-edicoes-23-10-2026.html"), "2026-10-23");
  assert.deepEqual(pa.map((item) => item.titulo), ["Diário Oficial", "Diário Oficial (extra)"]);
  assert.equal(pa[0].url, `https://drive.google.com/uc?id=${pa[0].chave}&export=download`);
  assert.equal(pdf.paEditions(amostra("CAPTURA-DOE-PA", "1-edicoes-23-10-2026.html"), "2026-10-24").length, 0, "PA descarta a edição de outro dia");
  const pb = pdf.pbEditions(amostra("CAPTURA-DOE-PB", "1-listagem-outubro-2026.html"));
  assert.equal(pb.length, 20);
  assert.equal(pb.find((item) => /suplemento/.test(item.chave)).titulo, "Diário Oficial (suplemento)");
  assert.equal(pb[0].url.endsWith(".pdf/@@download/file"), true);
  assert.deepEqual(pdf.pbYearFolders('<a href="https://auniao.pb.gov.br/servicos/doe/2025-1">2025</a>'), { 2025: "2025-1" });
  const ro = pdf.roEditions(amostra("CAPTURA-DOE-RO", "1-edicoes-27-10-2026.html"), "2026-10-27");
  assert.deepEqual(ro.map((item) => item.titulo), ["Diário Oficial", "Diário Oficial (suplemento #1)", "Diário Oficial (suplemento #2)"]);
  assert.equal(ro[0].chave, "2026/10/DOE-27-10-26.pdf");
  const rr = pdf.rrEditions(amostra("CAPTURA-DOE-RR", "1-edicoes-outubro-2026.html"));
  assert.deepEqual([rr[0].chave, rr[0].data], ["2026/10/doe-20261023.pdf", "2026-10-23"]);
  assert.match(rr[0].download.body, /ipconexao=/, "RR exige ipconexao no POST");
});

test("o índice de PDFs acha CNPJ e nome partido pelo versalete", () => {
  assert.deepEqual(pdf.cnpjRoots("CNPJ nº 33.000.167/0001-01 e 61 186 680 / 0001-74, raiz 04.895.728"), ["33000167", "61186680", "04895728"]);
  assert.equal(pdf.compactText("P etróleo B rasileiro"), "petroleobrasileiro");
  const terms = { cnpjRoot: "", term: "petroleo brasileiro", words: ["petroleo", "brasileiro"] };
  assert.equal(pdf.citesName("… a P etróleo B rasileiro S.A. torna público…", terms), true);
  const vale = { cnpjRoot: "", term: "vale", words: ["vale"] };
  assert.equal(pdf.citesName("a VALE S.A. recebeu a licença", vale), true);
  assert.equal(pdf.citesName("servidora Valéria, valor de R$ 10", vale), false);
  const pagina = json("CAPTURA-DOE-PB", "2-pagina-indexada.json");
  const hit = pdf.pageHit({ uf: "PB", id_edicao: 5, pagina: pagina.pagina, data: pagina.edicao.data, texto: pagina.texto, titulo: pagina.edicao.titulo, url: pagina.edicao.url }, { cnpjRoot: "09.111.618", term: null, words: [] });
  assert.equal(hit.trecho.includes("09.111.618"), true, "o trecho começa perto do CNPJ");
  assert.equal(hit.url.endsWith("#page=28"), true);
  for (const uf of ["PA", "PB", "RO", "RR"]) {
    const amostraPagina = json(`CAPTURA-DOE-${uf}`, "2-pagina-indexada.json");
    assert.deepEqual(pdf.cnpjRoots(amostraPagina.texto).sort(), [...amostraPagina.raizes].sort(), `${uf} raízes`);
  }
});

test("as 27 UFs têm diário conectado", () => {
  assert.equal(DOE_UFS.length, 27);
  assert.equal(DOE_SEM_CONECTOR.length, 0);
  for (const estado of DOE_ESTADOS) {
    assert.ok(DOOL[estado.codigo] || doe.DOE_CONECTORES[estado.codigo], `${estado.uf} tem conector`);
    assert.equal(fs.existsSync(path.join(__dirname, "..", "amostras", estado.codigo, "LEIA.txt")), true, `${estado.uf} amostra`);
  }
  for (const uf of DOE_UFS) {
    const codigo = `CAPTURA-DOE-${uf}`;
    assert.ok(DOOL[codigo] || doe.DOE_CONECTORES[codigo] || ["SP", "MG"].includes(uf), `${uf} no fluxo`);
  }
  assert.deepEqual(Object.keys(pdf.DIARIOS_PDF).sort(), ["PA", "PB", "RO", "RR"]);
  const codes = sourcesForProject({ uf: "PE", municipio: "Ipojuca" }).map((source) => source.codigo);
  assert.equal(codes.includes("CAPTURA-DOE-PE"), true);
  assert.equal(codes.some((codigo) => codigo.startsWith("CAPTURA-DOE-") && codigo !== "CAPTURA-DOE-PE"), false);
});
