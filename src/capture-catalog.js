const { DOE_ESTADOS } = require("./doe-registry");

const DOE_PDF_UFS = DOE_ESTADOS.filter((estado) => estado.motor === "indice_pdf").map((estado) => estado.uf);

const CAPTURE_LABELS = {
  papel_captura: {
    descoberta: "Descoberta",
    enriquecimento: "Enriquecimento",
    lookup: "Consulta pontual",
    indice: "Índice de fontes",
  },
  formato_dado: {
    html: "HTML / listagem",
    json_api: "API JSON",
    csv_zip: "CSV ou ZIP",
    gis: "GIS / FeatureServer",
    formulario: "Formulário de consulta",
    pdf: "PDF",
    misto: "Formatos mistos",
  },
  auth_acesso: {
    nenhuma: "Público",
    chave: "Chave de API",
    oauth: "OAuth",
    gcp: "Projeto GCP",
    captcha_paywall: "Captcha ou paywall",
  },
};

function news(overrides = {}) {
  return {
    papel_captura: "descoberta",
    formato_dado: "html",
    auth_acesso: "nenhuma",
    unidade_registro: "notícia",
    participa_scanner: false,
    ...overrides,
  };
}

function source(overrides) {
  return {
    papel_captura: "enriquecimento",
    formato_dado: "csv_zip",
    auth_acesso: "nenhuma",
    unidade_registro: "registro",
    participa_scanner: false,
    ...overrides,
  };
}

const CAPTURE_PROFILES = {
  "NEWS-INFRA": news({ participa_scanner: true }),
  "NEWS-BENEWS": news({ participa_scanner: true }),
  "NEWS-MEGAWHAT": news({ participa_scanner: true }),
  "NEWS-INFOMONEY": news({ participa_scanner: true }),
  "NEWS-MONEYT": news({ participa_scanner: true }),
  "NEWS-INVESTNEWS": news({ participa_scanner: true }),
  "NEWS-ANEEL": news(),
  "NEWS-MPOR": news(),
  "NEWS-PPI": news(),
  "NEWS-TRANSPORTES": news(),
  "NEWS-MME": news(),
  "NEWS-CIDADES": news(),
  "NEWS-EPE": news(),
  "NEWS-BNDES": news(),
  "NEWS-ANTT": news(),
  "NEWS-ANTAQ": news(),
  "NEWS-ANP": news(),
  "NEWS-ANM": news(),
  "NEWS-AGENCIA-GOV": news(),
  "NEWS-PORTOSNAV": news(),
  "NEWS-INFRAROI": news(),
  "NEWS-TRANSPORTE": news(),
  "NEWS-CANALENERGIA": news({ auth_acesso: "captcha_paywall" }),
  "NEWS-EPBR": news(),
  "NEWS-PETRO": news(),
  "NEWS-OE": news(),
  "NEWS-GRANDES": news(),
  "NEWS-BRASILMIN": news(),
  "NEWS-NMB": news(),
  "NEWS-SANEAMENTO": news(),
  "NEWS-INVESTSP": news(),
  "NEWS-AENPR": news(),
  "NEWS-ECONOMIA-PAYWALL": news({ auth_acesso: "captcha_paywall" }),
  "NEWS-BLOOMBERG": news(),
  "NEWS-FORBES": news(),
  "NEWS-CNN": news(),
  "NEWS-CPG": news(),

  "SEC-IBAMA": source({ unidade_registro: "licença ambiental" }),
  "SEC-IBAMA-LAF": source({
    formato_dado: "formulario",
    unidade_registro: "processo de licenciamento",
  }),
  "SEC-CETESB": source({
    formato_dado: "formulario",
    unidade_registro: "andamento de licença",
  }),
  "SEC-INEA": source({
    formato_dado: "formulario",
    unidade_registro: "processo ambiental",
  }),
  "SEC-SEMAD": source({
    formato_dado: "gis",
    unidade_registro: "licença georreferenciada",
  }),
  "SEC-IAT": source({
    formato_dado: "gis",
    unidade_registro: "licença georreferenciada",
  }),
  "SEC-SIGA": source({ unidade_registro: "usina / empreendimento de geração" }),
  "SEC-SIGEL": source({
    formato_dado: "gis",
    unidade_registro: "camada de empreendimento",
  }),
  "SEC-ANTT-INV": source({ unidade_registro: "investimento da concessão" }),
  "SEC-ANTAQ-INST": source({ unidade_registro: "instalação portuária" }),
  "SEC-ANP-EP": source({ unidade_registro: "bloco em exploração" }),
  "SEC-ANP-CAMPO": source({ unidade_registro: "campo produtor" }),
  "SEC-ANP-PLAT": source({ unidade_registro: "plataforma" }),
  "SEC-ANP-DUTO": source({ unidade_registro: "duto" }),
  "SEC-ANA-SNIRH": source({
    formato_dado: "gis",
    unidade_registro: "outorga de uso da água",
  }),
  "SEC-BNDES": source({ unidade_registro: "operação de financiamento" }),
  "SEC-OBRASGOV": source({
    formato_dado: "json_api",
    unidade_registro: "obra com recurso federal",
  }),
  "SEC-PNCP": source({
    formato_dado: "json_api",
    unidade_registro: "compra ou contrato público",
  }),
  "SEC-CNO": source({ unidade_registro: "obra civil" }),
  "SEC-CNPJ": source({
    papel_captura: "lookup",
    unidade_registro: "estabelecimento",
  }),
  "SEC-BD": source({
    papel_captura: "lookup",
    formato_dado: "misto",
    auth_acesso: "gcp",
    unidade_registro: "linha tratada de outra fonte",
  }),
  "SEC-DADOSGOV": source({
    papel_captura: "indice",
    formato_dado: "json_api",
    auth_acesso: "chave",
    unidade_registro: "conjunto de dados",
  }),
  "SEC-CVM": source({
    formato_dado: "formulario",
    unidade_registro: "fato relevante",
  }),
  "SEC-CVM-IPE": source({ unidade_registro: "documento IPE" }),
  "SEC-RI": source({
    formato_dado: "pdf",
    unidade_registro: "comunicado de companhia",
  }),
  "SEC-TCE-PE": source({
    formato_dado: "json_api",
    unidade_registro: "obra fiscalizada em Pernambuco",
  }),
  "SEC-ARTESP": source({ unidade_registro: "programação de obra rodoviária" }),
  "SEC-OBRAS-MG": source({ unidade_registro: "obra do executivo mineiro" }),
  "SEC-FEPAM": source({
    formato_dado: "formulario",
    unidade_registro: "processo ambiental no RS",
  }),
  "SEC-SEMACE": source({
    formato_dado: "formulario",
    unidade_registro: "processo ambiental no Ceará",
  }),
  "SEC-SEMAS-PA": source({
    formato_dado: "formulario",
    unidade_registro: "processo ambiental no Pará",
  }),
  "SEC-TCE-GO": source({
    formato_dado: "formulario",
    unidade_registro: "obra pública em Goiás",
  }),
  "SEC-TCU-OBRAS": source({
    formato_dado: "html",
    unidade_registro: "obra federal paralisada",
  }),
  "IDX-ABEMA": source({
    papel_captura: "indice",
    formato_dado: "html",
    unidade_registro: "órgão estadual de meio ambiente",
  }),
  "IDX-ABAR": source({
    papel_captura: "indice",
    formato_dado: "html",
    unidade_registro: "agência reguladora",
  }),
  "IDX-ABDE": source({
    papel_captura: "indice",
    formato_dado: "html",
    unidade_registro: "instituição de fomento",
  }),
};

const CAPTURE_DECISIONS = {
  mapear: { label: "Mapear", kind: "success" },
  sobreposicao: { label: "Já coberto", kind: "warning" },
  adiar: { label: "Adiar", kind: "neutral" },
  nao_confirmada: { label: "Não confirmada", kind: "danger" },
};

const POSSIBLE_GROUPS = [
  "Saneamento",
  "Obras rodoviárias",
  "Diários oficiais",
  "Sinais de CapEx privado",
  "Repasses federais",
  "Mineração, transmissão e fundos",
  "Subnacional",
];

const POSSIBLE_SOURCES = [
  {
    codigo: "CAPTURA-SINISA",
    familia: "Saneamento",
    nome: "SINISA",
    url: "https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa",
    modo: "Planilhas e relatórios públicos; sistema com login",
    disponibilidade: "Resultados anuais em planilha por módulo (água, esgoto, resíduos, drenagem e gestão). O endereço sinisa.cidades.gov.br é a área do prestador, não um dump de obras.",
    papel: "Contexto do operador",
    decisao: "mapear",
    porque: "Substitui o SNIS a partir de 2024, mas entrega indicador e investimento agregado. Não lista ETE ou ETA como projeto.",
  },
  {
    codigo: "CAPTURA-SNIS",
    familia: "Saneamento",
    nome: "SNIS — série histórica",
    url: "https://app4.cidades.gov.br/serieHistorica/",
    modo: "Consulta web com exportação",
    disponibilidade: "Série por prestador e município, inclusive investimentos realizados, com exportação. O conjunto no portal de dados das Cidades estava parado em 2023.",
    papel: "Histórico",
    decisao: "mapear",
    porque: "Serve para olhar o passado do operador. snis.gov.br não é a URL canônica atual.",
  },
  {
    codigo: "CAPTURA-ANA-METAS",
    familia: "Saneamento",
    nome: "Painel de metas de universalização da ANA",
    url: "",
    modo: "Não confirmado",
    disponibilidade: "O endereço metas-saneamento.ana.gov.br não foi confirmado como publicação oficial nesta checagem.",
    papel: "Em estudo",
    decisao: "nao_confirmada",
    porque: "Não entra no mapa até existir uma URL oficial. A outorga hídrica continua na fonte ANA SNIRH já catalogada.",
  },
  {
    codigo: "CAPTURA-DNIT",
    familia: "Obras rodoviárias",
    nome: "DNIT — Portal Cidadão",
    url: "https://servicos.dnit.gov.br/portalcidadao",
    modo: "Portal com mapa, contrato e medição",
    disponibilidade: "Obras de construção rodoviária sob contrato direto do DNIT: empresa, BR, trecho, valores, situação e avanço físico. A COAC é a área interna; a face pública verificada é este portal.",
    papel: "Enriquecimento",
    decisao: "mapear",
    porque: "Cobre obra federal executada pelo DNIT, distinta da concessão ANTT e do repasse que já está no Obrasgov.",
  },
  {
    codigo: "CAPTURA-DOU",
    familia: "Diários oficiais",
    nome: "Diário Oficial da União",
    url: "https://www.in.gov.br/",
    modo: "Busca HTML na Imprensa Nacional",
    disponibilidade: "Publica leilão, licença, portaria de REIDI e portaria de projeto prioritário. Não há API de projeto.",
    papel: "Descoberta oficial",
    decisao: "mapear",
    porque: "É a publicação que torna vários sinais fiscais oficiais. A captura útil é busca por ato, não varredura integral do diário.",
  },
  {
    codigo: "CAPTURA-QD",
    familia: "Diários oficiais",
    nome: "Querido Diário",
    url: "https://api.queridodiario.ok.org.br/docs",
    modo: "API pública de diários municipais",
    disponibilidade: "Busca por código IBGE e texto, com trecho e edição. Não cobre DOU nem diários estaduais, e não reúne todos os municípios.",
    papel: "Descoberta municipal",
    decisao: "mapear",
    porque: "É o único conector pronto para decreto e licença municipal. Uso futuro: consulta pontual quando o projeto já tem município.",
  },
  {
    codigo: "CAPTURA-SIGPUB",
    familia: "Diários oficiais",
    nome: "Diários oficiais dos municípios (SIGPub / associações municipais)",
    url: "https://www.diariomunicipal.com.br/",
    modo: "Busca HTML por associação estadual de municípios",
    disponibilidade: "22 diários de associações em 20 UFs (AMM-MG, AMP-PR, APM-SP, AMUPE, FAMURS, APRECE e outras), com prefeituras, câmaras e consórcios. Busca por texto desde 2009, sem login.",
    papel: "Descoberta municipal",
    decisao: "mapear",
    porque: "Cobre centenas de municípios que o Querido Diário não indexa. A busca pelo CNPJ formatado acha decreto, lei e licença municipal com a empresa citada.",
  },
  {
    codigo: "CAPTURA-DOM-METAWAY",
    familia: "Diários oficiais",
    nome: "Diários oficiais municipais na plataforma Metaway (Mentor)",
    url: "https://lencois.mentor.metaway.com.br/diario/",
    modo: "API JSON de edições e PDF por prefeitura",
    disponibilidade: "Lençóis Paulista/SP desde 04/2019. A busca devolve as edições com o termo; o texto sai do PDF. Outras prefeituras da plataforma entram no mapa do conector.",
    papel: "Descoberta municipal",
    decisao: "mapear",
    porque: "Cobre município fora do Querido Diário e da SIGPub. Achou o decreto de 2020 que cita a construção da fábrica da Bracell.",
  },
  {
    codigo: "CAPTURA-DOE-BA",
    familia: "Diários oficiais",
    nome: "Diário Oficial do Estado da Bahia (DOOL / EGBA)",
    url: "https://dool.egba.ba.gov.br/",
    modo: "API JSON da busca (Elasticsearch)",
    disponibilidade: "Texto integral por página desde 2007, busca por frase e CNPJ, sem login. Traz portarias do INEMA, resoluções do DESENVOLVE e do PROAUTO, contratos da SDE e despachos.",
    papel: "Descoberta estadual",
    decisao: "mapear",
    porque: "Concentra licença, incentivo fiscal e terreno do estado numa busca só. Pela raiz de CNPJ achou a LO, a LA e o PROAUTO da BYD em Camaçari.",
  },
  {
    codigo: "CAPTURA-DOE-PR",
    familia: "Diários oficiais",
    nome: "Diário Oficial do Estado do Paraná (DIOE)",
    url: "https://www.dioe.pr.gov.br/",
    modo: "API JSON da busca (mesmo motor do DOE-BA)",
    disponibilidade: "Texto integral por página, busca por frase e CNPJ, sem login. Traz súmulas de licença e TAC do IAT e outorgas do Instituto Água e Terra.",
    papel: "Descoberta estadual",
    decisao: "mapear",
    porque: "Complementa o FeatureServer do IAT com o texto e a data da publicação. Pela raiz de CNPJ achou outorgas e o TAC da CMPC em Piraí do Sul.",
  },
  {
    codigo: "CAPTURA-DOE-SP",
    familia: "Diários oficiais",
    nome: "Diário Oficial do Estado de São Paulo (novo portal)",
    url: "https://www.doe.sp.gov.br/",
    modo: "API JSON de busca avançada",
    disponibilidade: "Atos desde maio de 2023, com título, trecho, órgão e link. Traz as listas mensais de licenças concedidas e solicitadas da CETESB e as outorgas do DAEE.",
    papel: "Descoberta estadual",
    decisao: "mapear",
    porque: "Substitui a consulta direta à CETESB para LP, LI e LO. Pela raiz de CNPJ achou licenças e outorgas da Bracell.",
  },
  {
    codigo: "CAPTURA-DOE-MG",
    familia: "Diários oficiais",
    nome: "Jornal Minas Gerais (Diário Oficial de MG)",
    url: "https://www.jornalminasgerais.mg.gov.br/",
    modo: "API JSON v1 com token anônimo",
    disponibilidade: "Texto pesquisável desde 2011 nos cadernos do Executivo, dos Municípios e de Terceiros. Traz licenças da SEMAD e do COPAM, protocolos da Invest Minas, outorgas e regimes tributários.",
    papel: "Descoberta estadual",
    decisao: "mapear",
    porque: "Uma integração cobre licença, protocolo de intenção e incentivo em MG. Achou a LP+LI+LO de Miguel Burnier e o cancelamento do protocolo da Gerdau.",
  },
  ...DOE_ESTADOS.map((estado) => ({
    codigo: estado.codigo,
    familia: "Diários oficiais",
    nome: estado.nome,
    url: estado.portal,
    modo: estado.modo,
    disponibilidade: `${estado.acervo} Traz ${estado.atos}.`,
    papel: "Descoberta estadual",
    decisao: "mapear",
    porque: estado.motor === "indice_pdf"
      ? `Sem busca no portal (testado em 27 e 28/10/2026). O Radar indexa os PDFs das edições e consulta o índice. ${estado.limitacoes[0]}`
      : `Busca pública testada ao vivo em 27/10/2026, sem login. ${estado.limitacoes[0]}`,
  })),
  {
    codigo: "CAPTURA-DOE",
    familia: "Diários oficiais",
    nome: "Diários oficiais estaduais",
    url: "https://www.imprensaoficial.com.br/",
    modo: "Um portal por estado",
    disponibilidade: `Cada estado tem busca e regras próprias. As 27 UFs têm conector com código próprio (CAPTURA-DOE-{UF}); ${DOE_PDF_UFS.join(", ")} usam o índice de PDFs do Radar.`,
    papel: "Descoberta estadual",
    decisao: "sobreposicao",
    porque: `Não existe conector único. A família continua como índice. Sem busca de texto no portal, com índice próprio dos PDFs: ${DOE_PDF_UFS.join(", ")}.`,
  },
  {
    codigo: "CAPTURA-REIDI",
    familia: "Sinais de CapEx privado",
    nome: "Projetos aprovados no REIDI",
    url: "https://www.gov.br/transportes/pt-br/assuntos/incentivos/reidi",
    modo: "Lista oficial e CSV semestral",
    disponibilidade: "O Ministério dos Transportes publica a lista e uma planilha de projetos aprovados ou habilitados. Há CSV no dados.transportes.gov.br. A habilitação também sai no DOU. A página de energia do MME indicada não foi confirmada.",
    papel: "Sinal antecipado",
    decisao: "mapear",
    porque: "O enquadramento fiscal antecede a obra e traz titular e projeto. Começar pelo CSV de transportes; portos e energia seguem por DOU até aparecer planilha equivalente.",
  },
  {
    codigo: "CAPTURA-DEBENTURES",
    familia: "Sinais de CapEx privado",
    nome: "Enquadramento de debêntures incentivadas",
    url: "https://www.gov.br/pt-br/servicos/solicitar-enquadramento-de-projetos-de-investimento-prioritarios-para-emissao-de-debentures-incentivados-e-de-infraestrutura-no-mt",
    modo: "Formulário de pedido; aprovação em portaria",
    disponibilidade: "A página do Ministério dos Transportes recebe o pedido. A aprovação de projeto subnacional sai em portaria no DOU. Não há base aberta de projetos aprovados nesse endereço.",
    papel: "Já visto via DOU",
    decisao: "sobreposicao",
    porque: "O canal de protocolo não é a fonte dos projetos. O ato útil continua sendo a portaria no Diário Oficial.",
  },
  {
    codigo: "CAPTURA-ANBIMA",
    familia: "Sinais de CapEx privado",
    nome: "ANBIMA Data — debêntures de infraestrutura",
    url: "https://data.anbima.com.br/bussola",
    modo: "Painel público mensal",
    disponibilidade: "Ofertas, emissor, segmento e volume. Não descreve a obra nem substitui a portaria de enquadramento.",
    papel: "Sinal de financiamento",
    decisao: "mapear",
    porque: "Confirma que uma SPE captou recurso. Fica atrás de REIDI e DOU, porque a emissão é posterior ao projeto.",
  },
  {
    codigo: "CAPTURA-TRANSFEREGOV",
    familia: "Repasses federais",
    nome: "Transferegov — módulo de obras",
    url: "https://www.gov.br/transferegov/pt-br/manuais/transferegov/obras/modulo-de-obras",
    modo: "Manual do sistema cuja API já está catalogada",
    disponibilidade: "O acompanhamento das obras com recurso federal transferido é a API pública do Obrasgov.",
    papel: "Já catalogado",
    decisao: "sobreposicao",
    porque: "A página é documentação operacional, não uma fonte adicional à Obrasgov.",
  },
  {
    codigo: "CAPTURA-SIMEC",
    familia: "Repasses federais",
    nome: "SIMEC — obras de educação",
    url: "https://simec.mec.gov.br/",
    modo: "Sistema de gestores",
    disponibilidade: "Acompanha obras de universidades, institutos e hospitais universitários. Dump público não foi confirmado.",
    papel: "Nicho educação",
    decisao: "adiar",
    porque: "Exige acesso institucional. Só vale um conector se aparecer painel ou arquivo aberto com obra, valor e situação.",
  },
  {
    codigo: "CAPTURA-SISMOB",
    familia: "Repasses federais",
    nome: "SISMOB e painéis do Fundo Nacional de Saúde",
    url: "https://portalfns.saude.gov.br/sistemas/sismob/",
    modo: "Sistema com login e painel gerencial",
    disponibilidade: "O SISMOB cadastra obra de saúde financiada fundo a fundo e pede credencial de gestor. Há painel público no InvestSUS, mas a unidade é obra de saúde, em geral abaixo do corte de grande CapEx.",
    papel: "Nicho saúde",
    decisao: "adiar",
    porque: "fns.saude.gov.br não é a fonte de obras. O sistema certo existe, porém o acesso aberto e o porte típico não justificam coleta agora.",
  },
  {
    codigo: "CAPTURA-SIGMINE",
    familia: "Mineração, transmissão e fundos",
    nome: "SIGMINE / dados abertos da ANM",
    url: "https://dadosabertos.anm.gov.br/SIGMINE/",
    modo: "ZIP geoespacial",
    disponibilidade: "Arquivos atualizados de processos, lavra e áreas, incluindo BRASIL.zip e metadados. Não traz valor de CapEx.",
    papel: "Cadastro do ativo",
    decisao: "mapear",
    porque: "É o mapa dos títulos minerários, diferente da notícia da ANM já catalogada. Uso futuro: localizar o processo quando a notícia já citou a empresa ou o município.",
  },
  {
    codigo: "CAPTURA-ONS-PAR",
    familia: "Mineração, transmissão e fundos",
    nome: "ONS — Plano de Ampliações e Reforços",
    url: "https://www.ons.org.br/paginas/energia-no-futuro/transmissao/expansao",
    modo: "Relatório PDF",
    disponibilidade: "A página oficial descreve o PAR/PET e oferece documentos para download. A amostra visível não é uma tabela aberta de obras com valor; o ciclo termina em outorga da ANEEL.",
    papel: "Pipeline de transmissão",
    decisao: "mapear",
    porque: "Antecipa reforço e ampliação que o leilão e o SIGA enxergam depois. O conector, quando existir, lê o documento consolidado, não a página institucional inteira.",
  },
  {
    codigo: "CAPTURA-FUNDOS-REGIONAIS",
    familia: "Mineração, transmissão e fundos",
    nome: "Fundos da SUDENE e da SUDAM",
    url: "https://www.gov.br/sudene/pt-br",
    modo: "Portal institucional e resoluções",
    disponibilidade: "FDNE, FDA e incentivos regionais aparecem em resolução e página de órgão. Não foi encontrada uma base única de plantas aprovadas.",
    papel: "Sinal regional",
    decisao: "adiar",
    porque: "As resoluções relevantes também podem sair no DOU. Os portais institucionais não são, hoje, uma lista de projetos.",
  },
  {
    codigo: "FONTE-008",
    familia: "Subnacional",
    nome: "Portais de obras e transparência de estados e prefeituras",
    url: "",
    modo: "Portal, API local ou dataset",
    disponibilidade: "Cada ente publica de um jeito. MiDES e execução estadual aparecem como recorte na Base dos Dados.",
    papel: "Em estudo",
    decisao: "adiar",
    porque: "Continua sem conector único. Querido Diário e PNCP cobrem partes desse espaço com menos dispersão.",
  },
];

const DASHBOARD_PROFILES = {
  "CAPTURA-SINISA": row("secundaria", "dataset_download", "enriquecimento", "csv_zip", "indicador de saneamento", "baixa"),
  "CAPTURA-SNIS": row("secundaria", "base_consultavel", "lookup", "formulario", "série histórica do prestador", "baixa"),
  "CAPTURA-DNIT": row("secundaria", "portal_web", "enriquecimento", "html", "obra rodoviária federal", "media"),
  "CAPTURA-DOU": row("primaria", "portal_web", "descoberta", "html", "ato oficial", "alta"),
  "CAPTURA-QD": row("primaria", "api_publica", "descoberta", "json_api", "diário municipal", "media"),
  "CAPTURA-SIGPUB": row("primaria", "portal_web", "descoberta", "html", "matéria de diário municipal", "media"),
  "CAPTURA-DOM-METAWAY": row("primaria", "api_publica", "descoberta", "json_api", "edição de diário municipal", "media"),
  "CAPTURA-DOE-BA": row("primaria", "api_publica", "descoberta", "json_api", "página de diário estadual", "alta"),
  "CAPTURA-DOE-PR": row("primaria", "api_publica", "descoberta", "json_api", "página de diário estadual", "alta"),
  "CAPTURA-DOE-SP": row("primaria", "api_publica", "descoberta", "json_api", "ato de diário estadual", "alta"),
  "CAPTURA-DOE-MG": row("primaria", "api_publica", "descoberta", "json_api", "trecho de diário estadual", "alta", "chave"),
  ...Object.fromEntries(DOE_ESTADOS.map((estado) => {
    if (estado.motor === "indice_pdf") {
      return [estado.codigo, row("primaria", "dataset_download", "descoberta", "pdf", "página de diário estadual (PDF indexado)", "alta")];
    }
    const html = /HTML/.test(estado.modo);
    return [estado.codigo, row(
      "primaria",
      html ? "portal_web" : "api_publica",
      "descoberta",
      html ? "html" : "json_api",
      `${estado.unidade} de diário estadual`,
      "alta",
    )];
  })),
  "CAPTURA-DOE": row("primaria", "portal_web", "descoberta", "html", "diário estadual", "baixa", "nenhuma", "instavel"),
  "CAPTURA-REIDI": row("primaria", "dataset_download", "descoberta", "csv_zip", "projeto enquadrado", "media"),
  "CAPTURA-DEBENTURES": row("secundaria", "base_consultavel", "enriquecimento", "formulario", "pedido de enquadramento", "baixa"),
  "CAPTURA-ANBIMA": row("secundaria", "base_consultavel", "lookup", "html", "oferta de debênture", "media"),
  "CAPTURA-TRANSFEREGOV": row("secundaria", "portal_web", "indice", "html", "manual do módulo de obras", "baixa"),
  "CAPTURA-SIMEC": row("secundaria", "base_consultavel", "enriquecimento", "formulario", "obra de educação", "baixa", "chave", "bloqueado"),
  "CAPTURA-SISMOB": row("secundaria", "base_consultavel", "enriquecimento", "formulario", "obra de saúde", "baixa", "chave", "bloqueado"),
  "CAPTURA-SIGMINE": row("secundaria", "dataset_download", "enriquecimento", "csv_zip", "processo minerário", "alta"),
  "CAPTURA-ONS-PAR": row("secundaria", "dataset_download", "enriquecimento", "pdf", "obra de transmissão planejada", "baixa"),
  "CAPTURA-FUNDOS-REGIONAIS": row("secundaria", "portal_web", "enriquecimento", "pdf", "resolução de fundo regional", "baixa", "nenhuma", "instavel"),
};

function row(tipo, categoria, papel_captura, formato_dado, unidade_registro, frequencia, auth_acesso = "nenhuma", status = "ok") {
  return {
    tipo,
    categoria,
    papel_captura,
    formato_dado,
    auth_acesso,
    unidade_registro,
    frequencia,
    status,
    participa_scanner: false,
  };
}

function captureProfile(codigo) {
  return CAPTURE_PROFILES[codigo] || DASHBOARD_PROFILES[codigo] || null;
}

const PUBLIC_NEWS = new Set([
  "NEWS-AENPR",
  "NEWS-AGENCIA-GOV",
  "NEWS-ANEEL",
  "NEWS-ANM",
  "NEWS-ANP",
  "NEWS-ANTAQ",
  "NEWS-ANTT",
  "NEWS-BNDES",
  "NEWS-CIDADES",
  "NEWS-EPE",
  "NEWS-INVESTSP",
  "NEWS-MME",
  "NEWS-MPOR",
  "NEWS-PPI",
  "NEWS-TRANSPORTES",
]);

function esferaNoticia(codigo) {
  const profile = captureProfile(codigo);
  if (!profile || profile.unidade_registro !== "notícia") return null;
  return PUBLIC_NEWS.has(codigo) ? "publica" : "privada";
}

function sourcesForSeed() {
  return POSSIBLE_SOURCES
    .filter((source) => DASHBOARD_PROFILES[source.codigo])
    .map((source) => {
      const profile = DASHBOARD_PROFILES[source.codigo];
      const decision = CAPTURE_DECISIONS[source.decisao]?.label || "Em estudo";
      return {
        codigo: source.codigo,
        nome: source.nome,
        tipo: profile.tipo,
        categoria: profile.categoria,
        url: source.url,
        conteudo: source.disponibilidade,
        frequencia: profile.frequencia,
        status: profile.status,
        peculiaridade: `${decision}. ${source.porque}`,
      };
    });
}

function label(group, key) {
  return CAPTURE_LABELS[group]?.[key] || key || "—";
}

module.exports = {
  CAPTURE_DECISIONS,
  CAPTURE_LABELS,
  CAPTURE_PROFILES,
  DASHBOARD_PROFILES,
  POSSIBLE_GROUPS,
  POSSIBLE_SOURCES,
  captureProfile,
  esferaNoticia,
  label,
  sourcesForSeed,
};
