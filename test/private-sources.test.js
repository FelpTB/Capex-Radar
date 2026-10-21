const test = require("node:test");
const assert = require("node:assert/strict");
const { anaWhere, cnpjRootMask, mapOutorga } = require("../src/enrichment/ana");
const { pickLatestBlocos } = require("../src/enrichment/extra");
const { mapOnsRow, onsTokens, ufSigla } = require("../src/enrichment/ons");
const { holderTerm, matchTitular } = require("../src/enrichment/sigmine");
const { sourcesForProject } = require("../src/enrichment/viability");
const { pickReidiResource, reidiRecords } = require("../src/enrichment/reidi");
const { mapArtespFeature, pickArtespResources, artespTokens } = require("../src/enrichment/artesp");
const { buildCampos, mapDuto, mapPlataforma, projectTokens, rememberOperator, zonaMonthUrls } = require("../src/enrichment/anp-listas");
const { DOU_LIMIT, diarioHits, fallbackResumo, matchMunicipio, parseDouAct, parseDouHits, recentDouHits } = require("../src/enrichment/atos");
const { annotateAmostra } = require("../src/enrichment/annotate");

test("escolhe o CSV mais novo de blocos da ANP", () => {
  const hrefs = [
    "https://www.gov.br/anp/x/bsc/2025/blocos-sob-contrato-dez.csv",
    "https://www.gov.br/anp/x/bsc/2026/blocos-sob-contrato-set.csv",
    "https://www.gov.br/anp/x/bsc/2026/blocos-sob-contrato-ago.csv",
  ];
  assert.match(pickLatestBlocos(hrefs), /2026\/blocos-sob-contrato-set\.csv$/);
});

test("mascara a raiz do CNPJ do jeito que a ANA grava", () => {
  assert.equal(cnpjRootMask("34019992000110"), "34.019.992");
  assert.match(anaWhere("34019992000110"), /34\.019\.992%/);
});

test("acha o titular do SIGMINE pelo nome da empresa", () => {
  assert.equal(holderTerm("MINERACAO TABOCA S A"), "mineracao taboca");
  const hits = matchTitular([
    { PROCESSO: "1", NOME: "MINERACAO TABOCA S A", FASE: "CONCESSAO DE LAVRA", UF: "AM", SUBS: "ESTANHO" },
    { PROCESSO: "1", NOME: "MINERACAO TABOCA S A", FASE: "CONCESSAO DE LAVRA", UF: "AM" },
    { PROCESSO: "2", NOME: "OUTRA EMPRESA", UF: "AM" },
  ], "Mineração Taboca");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].processo, "1");
  assert.equal(hits[0].substancia, "ESTANHO");
});

test("le a obra planejada de transmissão e a UF", () => {
  assert.equal(ufSigla("Mato Grosso do Sul"), "MS");
  const row = mapOnsRow({
    "Código Empreendimento": "18641",
    "Nome do Empreendimento": "SE 230/138 kV Imbirussu",
    "UF Origem": "Mato Grosso do Sul",
    "Tipo do Empreendimento": "SE",
    "Total Investimento ( 2025 ) R$ / 1000": "15358.98",
    _planilha: "Empreendimentos_PET",
  });
  assert.equal(row.uf, "MS");
  assert.equal(row.valor, 15358980);
  assert.equal(row.chave, "Empreendimentos_PET:18641");
  const tokens = onsTokens({ nome: "Subestação Imbirussu", empresa_nome: "Empresa" });
  assert.ok(tokens.includes("imbirussu"));
});

test("SIGMINE entra na coleta só quando a ficha tem UF", () => {
  const amazonas = sourcesForProject({ uf: "AM" }).map((item) => item.codigo);
  assert.ok(amazonas.includes("CAPTURA-SIGMINE"));
  assert.ok(amazonas.includes("SEC-ANP-EP"));
  assert.ok(amazonas.includes("SEC-ANA-SNIRH"));
  assert.ok(!amazonas.includes("SEC-PDT"));
  assert.ok(amazonas.includes("CAPTURA-REIDI"));
  assert.ok(amazonas.includes("CAPTURA-DOU"));
  assert.ok(!amazonas.includes("CAPTURA-QD"));
  assert.ok(!amazonas.includes("SEC-ARTESP"));
  assert.ok(sourcesForProject({ uf: "SP", nicho: "rodovia" }).map((item) => item.codigo).includes("SEC-ARTESP"));
  assert.ok(sourcesForProject({ uf: "SC", municipio: "Itajaí" }).map((item) => item.codigo).includes("CAPTURA-QD"));
  assert.ok(!sourcesForProject({}).map((item) => item.codigo).includes("CAPTURA-SIGMINE"));
});

test("lê obra CapEx da ARTESP e ignora conservação", () => {
  const picked = pickArtespResources([
    { name: "conserva.example.geojson", format: "GeoJSON", url: "https://exemplo/conserva.geojson" },
    { name: "Template_LXX_obras_2026_R0.xlsx", format: "XLSX", url: "https://exemplo/obras.xlsx" },
    { name: "obras.example.geojson", format: "GeoJSON", url: "https://exemplo/obras.example.geojson" },
  ]);
  assert.equal(picked.kind, "xlsx");
  assert.equal(picked.exemplo, true);
  const row = mapArtespFeature({
    id: "obra-1",
    lote: "L22",
    rodovia: "SP0000310",
    programa: "CAPEX",
    detalhamento_servico: "Construção de passarela",
    km_inicial: 45.2,
    km_final: 45.2,
    data_inicial: "2026-04-01",
    data_final: "2026-10-31",
  }, { rodovias: { SP0000310: "SP 310" } });
  assert.equal(row.payload.concessionaria, "ECOVIAS IMIGRANTES");
  assert.equal(row.payload.rodovia_nome, "SP 310");
  assert.equal(mapArtespFeature({ lote: "L22", programa: "ROTINA", detalhamento_servico: "x" }), null);
  assert.ok(artespTokens({ nome: "Duplicação na Anchieta", empresa_nome: "Ecovias" }).includes("anchieta"));
});

test("lê o projeto habilitado no REIDI e ignora o preâmbulo", () => {
  const resource = pickReidiResource([
    { name: "dicionario", format: "CSV", url: "https://exemplo/dic.csv", last_modified: "2026-08-01" },
    { name: "REIDI 2025", format: "CSV", url: "https://exemplo/2025.csv", last_modified: "2025-07-01" },
    { name: "REIDI 2026", format: "CSV", url: "https://exemplo/2026.csv", last_modified: "2026-07-07" },
  ]);
  assert.equal(resource.url, "https://exemplo/2026.csv");
  const rows = reidiRecords(`Processos ;;;;;;;;;;;
;;;;;;;;;;;
N°;MODAL;"CONCESSIONÁRIA/EMPRESA
";CNPJ;"LOCALIZAÇÃO
(UF)";CONCESSÃO;CONTRATO;"INVESTIMENTO
R$";ANO DE APROVAÇÃO;PORTARIA;ADE
1;RODOVIA;TRANBRASILIANA;09.074.183/0001-64;SP;Federal;Contrato de concessão;2.123.516.394,00;2008;Portaria 223;ADE 111
`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cnpj, "09074183000164");
  assert.equal(rows[0].uf, "SP");
  assert.equal(rows[0].valor, 2123516394);
  assert.equal(rows[0].payload.modal, "RODOVIA");
});

test("separa campo em produção, plataforma e duto", () => {
  const plataforma = mapPlataforma({
    "[NOME DA INSTALAÇÃO]": "FPSO ALEXANDRE DE GUSMÃO",
    "[CAMPOS]": "AnC_MERO / MERO",
    "[OPERADOR]": "PETRÓLEO BRASILEIRO S.A. - PETROBRAS",
    "[BACIA]": "Santos",
    "[SIGLA DA INSTALAÇÃO]": "FPADG",
    "[ANO DE INÍCIO DE OPERAÇÃO]": "2025",
    "[LÂMINA D'ÁGUA (m)]": "2140",
    "[CAPACIDADE DE PRODUÇÃO DE PETRÓLEO (bbl/d)]": "180000",
  });
  assert.equal(plataforma.chave, "FPADG");
  assert.match(plataforma.titulo, /PETRÓLEO BRASILEIRO/);
  assert.equal(plataforma.payload["LÂMINA D'ÁGUA (m)"], "2140");
  assert.equal(plataforma.payload["CAPACIDADE DE PRODUÇÃO DE PETRÓLEO (bbl/d)"], "180000");
  const duto = mapDuto({
    Nome: "6-LCN-X350",
    "Código DPP": "33968",
    "Campo Integrante": "RIO URUCU",
    Tipo: "OLEODUTO",
    Operador: "PETRÓLEO BRASILEIRO S.A. - PETROBRAS",
    Situação: "EM OPERAÇÃO",
  });
  assert.equal(duto.payload.situacao, "EM OPERAÇÃO");
  const operators = new Map();
  rememberOperator(operators, "AnC_MERO / MERO", "PETRÓLEO BRASILEIRO S.A. - PETROBRAS");
  rememberOperator(operators, "MERO", "PETRÓLEO BRASILEIRO S.A.");
  const campos = buildCampos([
    { Campo: "MERO", Bacia: "Santos", Ambiente: "MAR", Data: "01/05/2026", Zona: "A", "Óleo (m³/d)": "10,50", "Petróleo (m³/d)": "10,50" },
    { Campo: "MERO", Bacia: "Santos", Ambiente: "MAR", Data: "01/05/2026", Zona: "B", "Óleo (m³/d)": "2,25", "Petróleo (m³/d)": "2,25" },
  ], operators);
  assert.equal(campos.length, 1);
  assert.equal(campos[0].payload.operador, "PETRÓLEO BRASILEIRO S.A. - PETROBRAS");
  assert.equal(campos[0].payload.pocos, 2);
  assert.equal(campos[0].payload.zonas, 2);
  assert.equal(campos[0].payload["Óleo (m³/d)"], 12.75);
  assert.deepEqual(projectTokens("Campo de Búzios da Petrobras"), ["buzios", "petrobras"]);
  assert.match(zonaMonthUrls(new Date("2026-10-05T00:00:00Z"))[0], /producao_zona_09-2026\.csv$/);
});

test("lê ato do DOU e trecho do diário municipal", () => {
  const html = `<script id="_br_com_seatecnologia_in_buscadou_BuscaDouPortlet_params" type="application/json">{"jsonArray":[{"pubName":"DO1","urlTitle":"portaria-736","numberPage":"54","title":"PORTARIA DE REIDI","pubDate":"05/10/2026","content":"Habilita WEG EQUIPAMENTOS ELETRICOS ao regime."},{"pubName":"DO1","urlTitle":"outro","title":"ATO SEM A EMPRESA","pubDate":"01/01/2020","content":"Texto genérico."}]}</script>`;
  const atos = parseDouHits(html, "weg equipamentos eletricos");
  assert.equal(atos.length, 1);
  assert.equal(atos[0].url, "https://www.in.gov.br/web/dou/-/portaria-736");
  const diario = diarioHits({
    total_gazettes: 2,
    gazettes: [{ date: "2025-03-06", territory_name: "São Paulo", url: "https://exemplo/a.pdf", excerpts: ["licença da usina"] }],
  });
  assert.equal(diario.total, 2);
  assert.equal(diario.linhas[0].trecho, "licença da usina");
  assert.equal(matchMunicipio([{ id: 4208203, nome: "Itajaí" }], "Itajai").id, 4208203);
  const nota = annotateAmostra("ato no Diário Oficial da União", "atos no Diário Oficial da União", { total: 3, linhas: atos });
  assert.match(nota.texto, /3 atos/);
  assert.match(nota.texto, /comprovação mostra 1/);
});


test("fica com os cinco atos mais recentes do DOU e resume a p\u00e1gina do ato", () => {
  const datas = ["10/08/2026", "19/10/2026", "07/08/2026", "09/09/2026", "20/08/2026", "19/08/2026", "07/10/2026", "10/08/2026"];
  const hits = datas.map((data, i) => ({ titulo: `Ato ${i}`, data, url: `https://exemplo/${i}` }));
  const recentes = recentDouHits(hits);
  assert.equal(DOU_LIMIT, 5);
  assert.deepEqual(recentes.map((h) => h.data), ["19/10/2026", "07/10/2026", "09/09/2026", "20/08/2026", "19/08/2026"]);
  assert.equal(recentDouHits([{ data: "x" }, { data: "01/01/2026" }])[0].data, "01/01/2026");

  const pagina = '<div class="detalhes-dou"><p class="text-center"><span class="orgao-dou">\u00d3rg\u00e3o: </span><span class="orgao-dou-data">Minist\u00e9rio da Educa\u00e7\u00e3o/UFOP</span></p></div>'
    + '<div class="texto-dou"><p class="identifica">EXTRATO DE TERMO ADITIVO</p><p class="dou-paragraph">Aditivo ao Conv\u00eanio entre a UFOP, a GERDAU A\u00c7OMINAS e a FUNDA\u00c7\u00c3O GORCEIX. Processo 23109.013996/2025-77.</p></div>'
    + '<div class="informacao-conteudo-dou"><p>Este conte\u00fado n\u00e3o substitui o publicado.</p></div>';
  const ato = parseDouAct(pagina);
  assert.equal(ato.orgao, "Minist\u00e9rio da Educa\u00e7\u00e3o/UFOP");
  assert.equal(ato.identifica, "EXTRATO DE TERMO ADITIVO");
  assert.match(ato.texto, /Processo 23109\.013996\/2025-77\./);
  assert.doesNotMatch(ato.texto, /substitui/);
  const resumo = fallbackResumo(ato.texto, "gerdau acominas");
  assert.match(resumo, /GERDAU A\u00c7OMINAS/);
  assert.ok(resumo.length <= 302);
  assert.equal(parseDouAct("<html></html>"), null);
});

test("converte vigencia e vazao da outorga da ANA", () => {
  const row = mapOutorga({ attributes: {
    emp_nm_empreendimento: "Fazenda",
    out_dt_outorgainicial: 1487203200000,
    out_dt_outorgafinal: 1802736000000,
    outorga_valida: 1,
    int_qt_vazaomedia: 270,
    int_qt_vazaomaxima: 270,
    int_qt_volumeanual: 470610,
    tfn_ds: "Irrigacao",
    int_nm_corpohidrico: "Rio Sao Francisco",
    int_nu_latitude: -19.27999444,
    int_nu_longitude: -45.27463056,
  } }, "federal");
  assert.equal(row.inicio, "2017-02-16");
  assert.equal(row.fim, "2027-02-16");
  assert.equal(row.valida, true);
  assert.equal(row.vazao_media_m3h, 270);
  assert.equal(row.volume_anual_m3, 470610);
  assert.equal(row.finalidade, "Irrigacao");
  assert.equal(row.corpo, "Rio Sao Francisco");
  assert.equal(row.latitude, -19.27999444);
  assert.equal(row.esfera, "federal");
  assert.equal(mapOutorga({}, "federal"), null);
});
