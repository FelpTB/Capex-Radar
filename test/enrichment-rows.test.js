const test = require("node:test");
const assert = require("node:assert/strict");
const {
  cnpjsInText,
  mapAnp,
  mapAntaq,
  mapAntt,
  mapBndes,
  mapCvm,
  mapLoose,
  mapObrasgov,
  mapSiga,
  sigaCnpjIndex,
  mapSislic,
  onlyDigits,
  parseAnttCsv,
  parseCsv,
  parseDate,
  parseDecimal,
} = require("../src/enrichment/rows");

test("lê CSV com aspas e delimitador", () => {
  const rows = parseCsv('a;b\n"1;2";3\n4;"5""6"\n');
  assert.deepEqual(rows, [
    { a: "1;2", b: "3" },
    { a: "4", b: '5"6' },
  ]);
});

test("normaliza CNPJ, decimal e operação do BNDES", () => {
  assert.equal(onlyDigits("56.024.581/0001-56"), "56024581000156");
  assert.equal(parseDecimal("1.400,00"), 1400);
  assert.equal(parseDecimal("9090000.0"), 9090000);
  const row = mapBndes({
    cnpj: "56.024.581/0001-56",
    cliente: "ACME",
    descricao_do_projeto: "PLANTA",
    uf: "SC",
    municipio: "ITAJAÍ",
    municipio_codigo: "4208203",
    numero_do_contrato: "1",
    data_da_contratacao: "2024-01-02T00:00:00",
    valor_contratado_reais: "330000000.0",
    valor_desembolsado_reais: "",
    produto: "BNDES FINEM",
    forma_de_apoio: "DIRETA",
    natureza_do_cliente: "EMPRESA PRIVADA",
    porte_do_cliente: "GRANDE",
    situacao_do_contrato: "ATIVO",
  });
  assert.equal(row.cnpj, "56024581000156");
  assert.equal(row.valor_contratado, 330000000);
  assert.equal(row.data_contratacao, "2024-01-02");
  assert.equal(row.valor_desembolsado, null);
});

test("extrai CNPJ da participação do SIGA e ignora usina sem CEG", () => {
  const found = cnpjsInText("100% para ACME - 18.565.382/0001-66 (APE)");
  assert.deepEqual(found, ["18565382000166"]);
  const row = mapSiga({
    CodCEG: "UFV.RS.RS.000001-1.1",
    NomEmpreendimento: "Usina",
    SigUFPrincipal: "RS",
    SigTipoGeracao: "UFV",
    DscFaseUsina: "Construção",
    MdaPotenciaOutorgadaKw: "1400,00",
    MdaPotenciaFiscalizadaKw: "1200",
    MdaGarantiaFisicaKw: ",00",
    NumCoordNEmpreendimento: "-20,12",
    NumCoordEEmpreendimento: "-43,87",
    DscMuninicpios: "Pelotas - RS",
    DscPropriRegimePariticipacao: "100% para ACME - 18.565.382/0001-66 (APE)",
    DatEntradaOperacao: "1900-01-03",
    DatInicioVigencia: "2000-07-07",
    IdeNucleoCEG: "000001",
    DscTipoOutorga: "Registro",
    NomFonteCombustivel: "Radiacao solar",
    DatGeracaoConjuntoDados: "2026-10-21",
  });
  assert.equal(row.potencia_kw, 1400);
  assert.equal(row.potencia_fiscalizada_kw, 1200);
  assert.equal(row.garantia_fisica_kw, null);
  assert.equal(row.latitude, -20.12);
  assert.equal(row.longitude, -43.87);
  assert.equal(row.entrada_operacao, null);
  assert.equal(row.inicio_vigencia, "2000-07-07");
  assert.equal(row.nucleo_ceg, "000001");
  assert.equal(row.tipo_outorga, "Registro");
  assert.equal(row.nome_fonte, "Radiacao solar");
  assert.equal(row.gerado_em, "2026-10-21");
  assert.equal(row.cnpj_edicao, null);
  assert.deepEqual(row.cnpjs, ["18565382000166"]);
  assert.equal(mapSiga({ CodCEG: "" }), null);

  const prior = sigaCnpjIndex([{
    CodCEG: "UFV.RS.RS.000001-1.1",
    DatGeracaoConjuntoDados: "2026-09-30",
    DscPropriRegimePariticipacao: "100% para ACME - 18.565.382/0001-66 (APE)",
  }]);
  const borrowed = mapSiga({
    CodCEG: "UFV.RS.RS.000001-1.1",
    DscPropriRegimePariticipacao: "100% para ACME (APE)",
  }, prior);
  assert.deepEqual(borrowed.cnpjs, ["18565382000166"]);
  assert.equal(borrowed.cnpj_edicao, "2026-09-30");
  const renamed = mapSiga({
    CodCEG: "UFV.RS.RS.000001-1.1",
    DscPropriRegimePariticipacao: "100% para OUTRA EMPRESA (APE)",
  }, prior);
  assert.deepEqual(renamed.cnpjs, []);
  assert.equal(renamed.cnpj_edicao, null);
});

test("guarda só fato relevante e comunicado da CVM", () => {
  const kept = mapCvm({
    Categoria: "Fato Relevante",
    Protocolo_Entrega: "ABC",
    Versao: "2",
    CNPJ_Companhia: "33.000.167/0001-01",
    Nome_Companhia: "PETROBRAS",
    Especie: "Declaração de Aquisição",
    Assunto: "Investimento",
    Tipo_Apresentacao: "RE - Reapresentação Espontânea",
    Data_Entrega: "2026-03-01",
    Link_Download: "https://exemplo/doc.pdf",
  }, 2026);
  assert.equal(kept.cnpj, "33000167000101");
  assert.equal(kept.versao, 2);
  assert.equal(kept.ano, 2026);
  assert.equal(kept.especie, "Declaração de Aquisição");
  assert.equal(kept.tipo_apresentacao, "RE - Reapresentação Espontânea");
  assert.equal(mapCvm({
    Categoria: "Fato Relevante",
    Protocolo_Entrega: "SEM",
    Especie: "",
    Tipo_Apresentacao: "",
  }, 2026).especie, null);
  assert.equal(mapCvm({
    Categoria: "Ata",
    Protocolo_Entrega: "XYZ",
  }, 2026), null);
});

test("lê o SISLIC com cabeçalho em maiúsculas e data brasileira", () => {
  assert.equal(parseDate("23/09/2026"), "2026-09-23");
  const row = mapSislic({
    DES_TIPOLICENCA: "Anuência",
    NUM_LICENCA: "28873044/2026",
    DAT_EMISSAO: "23/09/2026",
    DAT_VENCIMENTO: "",
    NOM_EMPREENDIMENTO: "Porto Organizado",
    NOM_PESSOA: "COMPANHIA DOCAS",
    NUM_PROCESSO_IBAMA: "02001.003974/2005-83",
    DES_TIPOLOGIA: "Transporte Hidroviário Marítimo",
    PAC: "No",
    ultima_atualizacao_relatorio: "28/09/2026 01:08",
  });
  assert.equal(row.tipo_licenca, "Anuência");
  assert.equal(row.data_emissao, "2026-09-23");
  assert.equal(row.data_vencimento, null);
  assert.equal(row.pessoa, "COMPANHIA DOCAS");
  assert.equal(row.tipologia, "Transporte Hidroviário Marítimo");
  assert.equal(row.pac, "No");
  assert.equal(row.atualizado_em, "2026-09-28T01:08:00");
});

test("junta CNPJs e valor previsto do Obrasgov", () => {
  const row = mapObrasgov({
    id_projeto_investimento: "10",
    desc_nome: "UBS",
    uf_principal: "SP",
    cnpj_organizacao_resp: "00530493000171",
    investimentos_previstos: [{ vl_investimento_previsto: 80250 }],
    executores: [{ cnpj_executor: "11.952.144/0001-64" }],
    tomadores: [],
    repassadores: [],
  });
  assert.equal(row.chave, "10");
  assert.equal(row.valor, 80250);
  assert.deepEqual(row.cnpjs, ["00530493000171", "11952144000164"]);
});

test("guarda as 22 colunas do bloco da ANP", () => {
  const row = mapAnp({
    BLOCO: "SANTOS-X",
    CONTRATO: "486100079892004",
    OPERADOR: "Petrobras",
    CONTRATADOS: "*Petrobras - 70%, Shell Brasil - 30%",
    AMBIENTE: "MAR",
    "BACIAS AGRUPADAS": "Margem Leste",
    BACIA: "Santos",
    "ÁREA (MIL km²)": "0,641394",
    RODADA: "BID11",
    "REGIME CONTRATUAL": "Concessão",
    "PERÍODO": "1º PE",
    "PRESENÇA PAD": "NÃO HÁ/HOUVE PAD",
    "DATA ASSINATURA CONTRATO": "15/07/2024",
    "1º PE VENCIMENTO": "15/07/2029",
    "FASE EXPLORATÓRIA VENCIMENTO": "15/07/2029",
    "UTs COMPROMISSADAS": "200",
    "QTD POÇOS PERFURADOS": "2",
    "POÇOS PERFURADOS": "1-BRSA-1015-MAS, 1-BRSA-729-MAS",
  });
  assert.equal(row.payload.bloco, "SANTOS-X");
  assert.equal(row.payload["ÁREA (MIL km²)"], "0,641394");
  assert.equal(row.payload["QTD POÇOS PERFURADOS"], "2");
  assert.equal(row.payload["UTs COMPROMISSADAS"], "200");
  assert.equal(row.cnpj, null);
});

test("lê o cadastro da ANTT sem tratar o processo do SEI como CNPJ", () => {
  const rows = parseAnttCsv(
    "concessionaria;id_sigicor;Nro_Processo_SEI;Descricao;Rodovia;Valor_Contratual;Latitude_Inicial\nVIA SUL;15586;50500.232688/2022-46;SAU BSO-01;BR-277/PR;;25\u00b026'39.52\"S\n",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Latitude_Inicial, "25\u00b026'39.52\"S");
  const mapped = mapAntt(rows[0]);
  assert.equal(mapped.cnpj, null);
  assert.deepEqual(mapped.cnpjs, []);
  assert.equal(mapped.uf, "PR");
  assert.equal(mapped.titulo, "SAU BSO-01");
  assert.equal(mapped.payload.id_sigicor, "15586");
  assert.equal(mapped.payload.Nro_Processo_SEI, "50500.232688/2022-46");
  assert.equal(mapAntt({
    concessionaria: "RIOSP",
    ano: "2024",
    Valor: "176811000",
  }).valor, 176811000);
});

test("guarda CNPJ solto numa linha de CSV sem esquema fixo", () => {
  const row = mapLoose({
    Concessionaria: "ACME",
    UF: "SP",
    Investimento: "1.400,00",
    Observacao: "contrato 18.565.382/0001-66",
  });
  assert.equal(row.cnpj, "18565382000166");
  assert.equal(row.uf, "SP");
  assert.equal(row.valor, 1400);
  assert.equal(row.titulo, "ACME");
});

test("pula a linha de título da ANTAQ e lê a empresa autorizada", () => {
  const text = [
    "Instalações Privadas Autorizadas;;;;;;;;",
    "Nº;Empresa Autorizada;Município;UF;Região;Tipo Instalação;Perfil de Carga ;Tipo de Carga;Instrumento de Outorga",
    "30;CMPC CELULOSE RIOGRANDENSE LTDA.;GUAÍBA;RS;Sul;TUP;Carga Geral e Granel Sólido;Celulose, Mandeira e Sal;CA 25/2014 - SEP/PR",
  ].join("\n");
  const [row] = parseCsv(text).map(mapAntaq);
  assert.equal(row.titulo, "CMPC CELULOSE RIOGRANDENSE LTDA.");
  assert.equal(row.uf, "RS");
  assert.equal(row.municipio, "GUAÍBA");
  assert.equal(row.payload.tipo, "TUP");
  assert.equal(row.payload.perfil, "Carga Geral e Granel Sólido");
  assert.equal(row.payload.outorga, "CA 25/2014 - SEP/PR");
  assert.equal(row.payload.numero, "30");
});
