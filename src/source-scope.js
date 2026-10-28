const { fold } = require("./enrichment/resolve");
const { METAWAY_MUNICIPIOS, SIGPUB_UF } = require("./enrichment/diarios");
const { DOE_ESTADOS } = require("./doe-registry");

const SCOPES = {
  municipal: {
    label: "Municipal",
    description: "Informações e documentos do município do projeto: diário da prefeitura, alvará, decreto e notícia local.",
  },
  estadual: {
    label: "Estadual",
    description: "Informações e documentos de um estado inteiro. Vale para projetos localizados naquele estado.",
  },
  nacional: {
    label: "Nacional",
    description: "Informações e documentos de qualquer lugar do país. Qualquer projeto pode aparecer, conforme o nicho.",
  },
};

const SUDENE_SUDAM = [
  "AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE", "MG", "ES",
  "AC", "AM", "AP", "PA", "RO", "RR", "TO", "MT",
];

// Fontes de um estado. A lista de UFs diz para quais projetos a fonte vale.
// null em ufs quer dizer que a fonte reúne todos os estados, um portal por UF.
const ESTADUAL = {
  "CAPTURA-DOE": null,
  "CAPTURA-DOE-BA": ["BA"],
  "CAPTURA-DOE-MG": ["MG"],
  "CAPTURA-DOE-PR": ["PR"],
  "CAPTURA-DOE-SP": ["SP"],
  ...Object.fromEntries(DOE_ESTADOS.map((estado) => [estado.codigo, [estado.uf]])),
  "CAPTURA-FUNDOS-REGIONAIS": SUDENE_SUDAM,
  "IDX-ABEMA": null,
  "SEC-ARTESP": ["SP"],
  "SEC-CETESB": ["SP"],
  "SEC-FEPAM": ["RS"],
  "SEC-IAT": ["PR"],
  "SEC-INEA": ["RJ"],
  "SEC-OBRAS-MG": ["MG"],
  "SEC-SEMACE": ["CE"],
  "SEC-SEMAD": ["MG"],
  "SEC-SEMAS-PA": ["PA"],
  "SEC-TCE-GO": ["GO"],
  "SEC-TCE-PE": ["PE"],
  // Notícia regional: o portal cobre um estado.
  "NEWS-A8SE": ["SE"],
  "NEWS-ACIDADEON": ["SP"],
  "NEWS-AENPR": ["PR"],
  "NEWS-AGORARN": ["RN"],
  "NEWS-ALOALOBAHIA": ["BA"],
  "NEWS-ATARDE": ["BA"],
  "NEWS-BAHIAECONOMICA": ["BA"],
  "NEWS-BANDAB": ["PR"],
  "NEWS-BEMPARANA": ["PR"],
  "NEWS-BNCAMAZONAS": ["AM"],
  "NEWS-BRASILIAINFOCO": ["DF"],
  "NEWS-CAMPOGRANDENEWS": ["MS"],
  "NEWS-CEARAAGORA": ["CE"],
  "NEWS-CORREIO24HORAS": ["BA"],
  "NEWS-DIARIODECUIABA": ["MT"],
  "NEWS-DIARIODOACO": ["MG"],
  "NEWS-DIARIODOCOMERCIO": ["MG"],
  "NEWS-DIARIODOLITORAL": ["SP"],
  "NEWS-DIARIODONORDESTE": ["CE"],
  "NEWS-DOL": ["PA"],
  "NEWS-DRD": ["MG"],
  "NEWS-ECONOMIASC": ["SC"],
  "NEWS-EM": ["MG"],
  "NEWS-ESBRASIL": ["ES"],
  "NEWS-FIEMG": ["MG"],
  "NEWS-FIRJAN": ["RJ"],
  "NEWS-FOLHAPE": ["PE"],
  "NEWS-FOLHAVITORIA": ["ES"],
  "NEWS-GAUCHAZH": ["RS"],
  "NEWS-GAZETADOPOVO": ["PR"],
  "NEWS-GAZETASP": ["SP"],
  "NEWS-INVESTSP": ["SP"],
  "NEWS-JORNALDOCOMERCIO": ["RS"],
  "NEWS-JORNALGRANDEBAHIA": ["BA"],
  "NEWS-JORNALOPCAO": ["GO"],
  "NEWS-MAIS": ["CE"],
  "NEWS-MERCADOHOJE": ["MG"],
  "NEWS-MOVIMENTOECONOMICO": ["PE"],
  "NEWS-MURALDOPARANA": ["PR"],
  "NEWS-NDMAIS": ["SC"],
  "NEWS-NOTISUL": ["SC"],
  "NEWS-NOVOJORNAL": ["RN"],
  "NEWS-NOVONOTICIAS": ["RN"],
  "NEWS-NSCTOTAL": ["SC"],
  "NEWS-OLHARDIRETO": ["MT"],
  "NEWS-OSUL": ["RS"],
  "NEWS-OTEMPO": ["MG"],
  "NEWS-SAMPI": ["SP"],
  "NEWS-SANTACATARINAEMPAUTA": ["SC"],
  "NEWS-SMABC": ["SP"],
  "NEWS-TOCANTINS": ["TO"],
  "NEWS-TOPVIEW": ["PR"],
  "NEWS-TRENDSCE": ["CE"],
  "NEWS-TRIBUNAPR": ["PR"],
};

function sigpubUfs() {
  return Object.keys(SIGPUB_UF).sort();
}

function metawayMunicipios() {
  const nomes = { "lencois paulista": "Lençóis Paulista" };
  return Object.keys(METAWAY_MUNICIPIOS).map((key) => {
    const [uf, nome] = key.split(":");
    return { uf, nome: nomes[nome] || nome };
  });
}

// Fontes do município do projeto. municipios lista as cidades cobertas;
// sem municipios, a cobertura é por município dentro das UFs (ou do país, sem ufs).
const MUNICIPAL = {
  "CAPTURA-QD": { ufs: null, cobertura: "Cerca de 510 municípios com busca por texto, em todas as regiões." },
  "CAPTURA-SIGPUB": { ufs: sigpubUfs(), cobertura: "Municípios associados aos diários estaduais de municípios." },
  "CAPTURA-DOM-METAWAY": { municipios: metawayMunicipios() },
  "NEWS-ACIARA": { municipios: [{ uf: "SP", nome: "Araçatuba" }] },
  "NEWS-AREDE": { municipios: [{ uf: "PR", nome: "Ponta Grossa" }] },
  "NEWS-CHUVILLE": { municipios: [{ uf: "SC", nome: "Joinville" }] },
  "NEWS-DIARIODORIO": { municipios: [{ uf: "RJ", nome: "Rio de Janeiro" }] },
  "NEWS-INFORMEBLUMENAU": { municipios: [{ uf: "SC", nome: "Blumenau" }] },
  "NEWS-ITAMARAJUNOTICIAS": { municipios: [{ uf: "BA", nome: "Itamaraju" }] },
  "NEWS-JORNALCRUZEIRO": { municipios: [{ uf: "SP", nome: "Sorocaba" }] },
  "NEWS-JORNALDEUBERABA": { municipios: [{ uf: "MG", nome: "Uberaba" }] },
  "NEWS-MOSSOROHOJE": { municipios: [{ uf: "RN", nome: "Mossoró" }] },
  "NEWS-PREFEITURA": { municipios: [{ uf: "RJ", nome: "Rio de Janeiro" }] },
  "NEWS-SAOBERNARDODOCAMPO": { municipios: [{ uf: "SP", nome: "São Bernardo do Campo" }] },
  "NEWS-VIUITAUNA": { municipios: [{ uf: "MG", nome: "Itaúna" }] },
  "NEWS-WEBTVPARACATU": { municipios: [{ uf: "MG", nome: "Paracatu" }] },
};

// Nicho em que uma fonte nacional costuma ter o projeto. Sem nicho, vale para qualquer projeto.
const NICHO_NACIONAL = {
  "CAPTURA-ONS-PAR": "transmissão de energia",
  "CAPTURA-REIDI": "infraestrutura de transporte, energia e saneamento",
  "CAPTURA-SIGMINE": "mineração",
  "CAPTURA-SIMEC": "obras de educação",
  "CAPTURA-SINISA": "saneamento",
  "CAPTURA-SISMOB": "obras de saúde",
  "CAPTURA-SNIS": "saneamento",
  "CAPTURA-DNIT": "rodovias federais",
  "CAPTURA-ANBIMA": "infraestrutura financiada por debênture",
  "CAPTURA-DEBENTURES": "infraestrutura financiada por debênture",
  "SEC-ANA-SNIRH": "uso de água: indústria, mineração, irrigação e energia",
  "SEC-ANP-CAMPO": "petróleo e gás",
  "SEC-ANP-DUTO": "petróleo e gás",
  "SEC-ANP-EP": "petróleo e gás",
  "SEC-ANP-PLAT": "petróleo e gás",
  "SEC-ANTAQ-INST": "portos e terminais",
  "SEC-ANTT-INV": "rodovias e ferrovias concedidas",
  "SEC-CVM-IPE": "companhias abertas",
  "SEC-CVM": "companhias abertas",
  "SEC-RI": "companhias abertas",
  "SEC-SIGA": "geração de energia e autoprodução",
  "SEC-SIGEL": "geração e transmissão de energia",
  "SEC-OBRASGOV": "obras com recurso federal",
  "SEC-PNCP": "contratações públicas",
  "SEC-TCU-OBRAS": "obras públicas federais",
  "CAPTURA-TRANSFEREGOV": "obras com recurso federal",
  "IDX-ABAR": "serviços regulados",
};

function sourceScope(codigo) {
  const code = String(codigo || "").toUpperCase();
  if (MUNICIPAL[code]) {
    const item = MUNICIPAL[code];
    return {
      abrangencia: "municipal",
      ufs: item.municipios ? [...new Set(item.municipios.map((m) => m.uf))] : item.ufs,
      municipios: item.municipios || null,
      cobertura: item.cobertura || null,
      nicho: null,
    };
  }
  if (Object.prototype.hasOwnProperty.call(ESTADUAL, code)) {
    return { abrangencia: "estadual", ufs: ESTADUAL[code], municipios: null, cobertura: null, nicho: null };
  }
  return { abrangencia: "nacional", ufs: null, municipios: null, cobertura: null, nicho: NICHO_NACIONAL[code] || null };
}

// Diz se a fonte pode trazer informação de um projeto naquela UF e município.
function scopeApplies(codigo, project = {}) {
  const scope = sourceScope(codigo);
  if (scope.abrangencia === "nacional") return true;
  const uf = String(project.uf || "").toUpperCase();
  if (!uf) return false;
  if (scope.ufs && !scope.ufs.includes(uf)) return false;
  if (scope.municipios) {
    const local = fold(project.municipio || "");
    return Boolean(local) && scope.municipios.some((item) => item.uf === uf && fold(item.nome) === local);
  }
  return true;
}

function scopeCoverage(scope) {
  if (scope.municipios) return scope.municipios.map((item) => `${item.nome}/${item.uf}`).join(", ");
  if (scope.cobertura && scope.ufs) return `${scope.cobertura} UFs: ${scope.ufs.join(", ")}.`;
  if (scope.cobertura) return scope.cobertura;
  if (scope.ufs) return scope.ufs.join(", ");
  if (scope.abrangencia === "estadual") return "Um portal por estado.";
  return scope.nicho ? `Todo o país. Nicho: ${scope.nicho}.` : "Todo o país, qualquer nicho.";
}

module.exports = { SCOPES, scopeApplies, scopeCoverage, sourceScope };
