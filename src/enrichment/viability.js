const { fold } = require("./resolve");
const { SIGPUB_UF, metawayBase } = require("./diarios");

// UFs com diário oficial conectado: todas. PA, PB, RO e RR leem o índice de PDFs (doe-pdf.js).
const DOE_UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

const ENERGY = ["energia", "geracao", "usina", "hidreletr", "termeletr", "solar", "eolic", "transmiss"];
const MINING = ["miner", "mina", "lavra"];
const HEAVY = ["industri", "fabrica", "planta", "sider", "quimic", "celulose", "ciment", "porto", "terminal", "rodov", "ferrov", "aeroport", "saneament", "logist", "data center"];
const ROAD = ["rodov", "ferrov", "pedag", "dutra", "motiva"];
const PORT = ["porto", "terminal", "aquavi"];

function nicheHas(project, words) {
  const text = fold(`${project.nicho || ""} ${project.nome || ""}`);
  return words.some((word) => text.includes(word));
}

function viableSources(project) {
  const sources = [
    {
      codigo: "SEC-BNDES",
      porque: "Financiamento contratado no CNPJ.",
    },
    {
      codigo: "SEC-CVM-IPE",
      porque: "Comunicados ao mercado, quando a companhia é aberta.",
    },
    {
      codigo: "SEC-CNO",
      porque: "Obra civil inscrita no CNPJ ou na raiz dele, no estado do projeto.",
    },
  ];
  if (nicheHas(project, ROAD)) {
    sources.push({
      codigo: "SEC-ANTT-INV",
      porque: "Investimento de concessão rodoviária ou ferroviária no CNPJ.",
    });
  }
  if (project.uf === "SP" && nicheHas(project, ROAD)) {
    sources.push({
      codigo: "SEC-ARTESP",
      porque: "Programação CapEx da concessão rodoviária paulista.",
    });
  }
  if (nicheHas(project, PORT)) {
    sources.push({
      codigo: "SEC-ANTAQ-INST",
      porque: "Instalação portuária no CNPJ.",
    });
  }
  if (project.uf === "PR") {
    sources.push({
      codigo: "SEC-IAT",
      porque: "Licença ambiental do Paraná no nome da empresa.",
    });
  }
  if (nicheHas(project, [...ENERGY, ...MINING])) {
    sources.push({
      codigo: "SEC-SIGA",
      porque: "Usina ou autoprodução ligada ao CNPJ.",
    });
  }
  if (nicheHas(project, [...MINING, ...ENERGY, ...HEAVY])) {
    sources.push({
      codigo: "SEC-IBAMA",
      porque: "Licença federal no nome oficial da empresa.",
    });
  }
  return sources;
}

function collectableSources() {
  return [
    { codigo: "SEC-BNDES" },
    { codigo: "SEC-CVM-IPE" },
    { codigo: "SEC-SIGA" },
    { codigo: "SEC-IBAMA" },
    { codigo: "SEC-ANTT-INV" },
    { codigo: "SEC-ANTAQ-INST" },
    { codigo: "SEC-IAT", uf: "PR" },
    { codigo: "SEC-CNO" },
    { codigo: "SEC-ANP-EP" },
    { codigo: "SEC-ANA-SNIRH" },
    { codigo: "CAPTURA-SIGMINE" },
    { codigo: "CAPTURA-ONS-PAR" },
    { codigo: "CAPTURA-REIDI" },
    { codigo: "SEC-ANP-CAMPO" },
    { codigo: "SEC-ANP-PLAT" },
    { codigo: "SEC-ANP-DUTO" },
    { codigo: "CAPTURA-QD" },
    { codigo: "CAPTURA-SIGPUB" },
    { codigo: "CAPTURA-DOM-METAWAY" },
    ...DOE_UFS.map((uf) => ({ codigo: `CAPTURA-DOE-${uf}`, uf })),
    { codigo: "SEC-SEMAD", uf: "MG" },
    { codigo: "CAPTURA-DOU" },
    { codigo: "SEC-ARTESP", uf: "SP" },
  ];
}

function sourcesForProject(project) {
  return collectableSources().filter((source) => {
    if (source.uf && source.uf !== project.uf) return false;
    if (source.codigo === "CAPTURA-SIGMINE" && !project.uf) return false;
    if (source.codigo === "CAPTURA-QD" && !project.municipio) return false;
    if (source.codigo === "CAPTURA-SIGPUB" && !SIGPUB_UF[project.uf]) return false;
    if (source.codigo === "CAPTURA-DOM-METAWAY" && !metawayBase(project)) return false;
    return true;
  });
}

module.exports = { DOE_UFS, collectableSources, sourcesForProject, viableSources };
