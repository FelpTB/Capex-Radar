const { clean, filledPayload, parseDecimal } = require("./rows");
const { fold } = require("./resolve");

const PLATAFORMAS_URL = "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/arquivos-fase-de-desenvolvimento-e-producao/lpo/dados-abertos-plataformas-operacao.csv";
const DUTOS_URL = "https://www.gov.br/anp/pt-br/assuntos/exploracao-e-producao-de-oleo-e-gas/desenvolvimento-e-producao/arquivos-lista-de-codigos/codigo-dutos.csv";
const INSTALACOES_URL = "https://www.gov.br/anp/pt-br/assuntos/exploracao-e-producao-de-oleo-e-gas/desenvolvimento-e-producao/arquivos-lista-de-codigos/codigo-instalacoes.csv";
const ZONA_PREFIX = "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/arquivos-fase-de-desenvolvimento-e-producao/producao-por-zona/producao_zona_";

const STOPWORDS = new Set([
  "campo", "campos", "projeto", "fabrica", "unidade", "energia", "bateria", "baterias",
  "mineracao", "producao", "plataforma", "plataformas", "oleoduto", "gasoduto",
  "petroleo", "brasileiro", "equipamentos", "eletricos", "natural", "industrial",
]);

function plainRecord(record) {
  const out = {};
  for (const [key, value] of Object.entries(record || {})) {
    const name = String(key).replace(/^\uFEFF/, "").replace(/^\[|\]$/g, "").trim();
    out[name] = value;
  }
  return out;
}

function take(record, ...names) {
  const folded = new Map(Object.entries(plainRecord(record)).map(([key, value]) => [fold(key), value]));
  for (const name of names) {
    const text = clean(folded.get(fold(name)));
    if (text) return text;
  }
  return null;
}

function zonaMonthUrls(from = new Date(), count = 8) {
  const urls = [];
  for (let back = 1; back <= count; back += 1) {
    const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - back, 1));
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    urls.push(`${ZONA_PREFIX}${month}-${date.getUTCFullYear()}.csv`);
  }
  return urls;
}

function mapPlataforma(record) {
  const nome = take(record, "NOME DA INSTALAÇÃO");
  const operador = take(record, "OPERADOR");
  if (!nome && !operador) return null;
  return {
    chave: take(record, "SIGLA DA INSTALAÇÃO"),
    cnpj: null,
    cnpjs: [],
    titulo: [operador, nome].filter(Boolean).join(" "),
    uf: null,
    municipio: null,
    valor: null,
    payload: {
      ...filledPayload(plainRecord(record)),
      sigla: take(record, "SIGLA DA INSTALAÇÃO"),
      nome,
      campos: take(record, "CAMPOS"),
      bacia: take(record, "BACIA"),
      operador,
      classificacao: take(record, "CLASSIFICAÇÃO"),
      inicio: take(record, "ANO DE INÍCIO DE OPERAÇÃO"),
    },
  };
}

function mapDuto(record) {
  const nome = take(record, "Nome");
  const operador = take(record, "Operador");
  if (!nome && !operador) return null;
  const campo = take(record, "Campo Integrante");
  return {
    chave: take(record, "Código DPP"),
    cnpj: null,
    cnpjs: [],
    titulo: [operador, nome, campo].filter(Boolean).join(" "),
    uf: null,
    municipio: null,
    valor: null,
    payload: {
      ...filledPayload(record),
      nome,
      codigo: take(record, "Código DPP"),
      operador,
      campo,
      tipo: take(record, "Tipo"),
      classificacao: take(record, "Classificação do Sistema"),
      situacao: take(record, "Situação"),
    },
  };
}

function rememberOperator(map, campo, operador) {
  const name = String(operador || "").replace(/\s+/g, " ").trim();
  for (const part of String(campo || "").split("/")) {
    const piece = part.trim().replace(/^anc_/i, "");
    const key = fold(piece);
    if (!name || key.length < 3) continue;
    const set = map.get(key) || new Set();
    set.add(name);
    map.set(key, set);
  }
  return map;
}

function compactNames(names) {
  const sorted = [...names].sort((left, right) => right.length - left.length);
  const kept = [];
  for (const name of sorted) {
    const folded = fold(name);
    const repeats = kept.some((item) => {
      const other = fold(item);
      return other.includes(folded) || folded.includes(other);
    });
    if (!repeats) kept.push(name);
  }
  return kept.sort((left, right) => left.localeCompare(right, "pt-BR"));
}

const ZONA_VOLUMES = [
  "Óleo (m³/d)",
  "Condensado (m³/d)",
  "Petróleo (m³/d)",
  "Gás associado (Mil m³/d)",
  "Gás não associado (Mil m³/d)",
  "Gás total (Mil m³/d)",
  "Água (m³/d)",
  "Água injetada para descarte (m³/d)",
  "Água injetada para rec. secundária (m³/d)",
  "Vapor injetado (t/d)",
  "Gás injetado (Mil m³/d)",
  "CO2 injetado (Mil m³/d)",
  "N2 injetado (Mil m³/d)",
  "Outros fluidos injetados (m³/d)",
];

function buildCampos(records, operators = new Map()) {
  const fields = new Map();
  for (const record of records) {
    const campo = take(record, "Campo");
    const key = fold(campo);
    if (!campo || key.length < 3) continue;
    let row = fields.get(key);
    if (!row) {
      const ops = compactNames(operators.get(key) || []);
      row = {
        chave: key,
        cnpj: null,
        cnpjs: [],
        titulo: [...ops, campo].join(" "),
        uf: null,
        municipio: null,
        valor: null,
        payload: {
          Campo: campo,
          campo,
          Bacia: take(record, "Bacia"),
          bacia: take(record, "Bacia"),
          Ambiente: take(record, "Ambiente"),
          ambiente: take(record, "Ambiente"),
          Data: take(record, "Data"),
          periodo: take(record, "Data"),
          operador: ops.join(" / ") || null,
          pocos: 0,
          zonas: 0,
        },
        _zonas: new Set(),
        _sum: Object.fromEntries(ZONA_VOLUMES.map((col) => [col, 0])),
      };
      fields.set(key, row);
    }
    row.payload.pocos += 1;
    const zona = take(record, "Zona");
    if (zona) row._zonas.add(zona);
    const plain = plainRecord(record);
    for (const col of ZONA_VOLUMES) {
      const number = parseDecimal(plain[col]);
      if (Number.isFinite(number)) row._sum[col] += number;
    }
  }
  return [...fields.values()].map((row) => {
    row.payload.zonas = row._zonas.size;
    for (const [col, total] of Object.entries(row._sum)) {
      row.payload[col] = Number(total.toFixed(4));
    }
    delete row._zonas;
    delete row._sum;
    return row;
  });
}

function projectTokens(nome) {
  return [...new Set(
    fold(nome).split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !STOPWORDS.has(word)),
  )];
}

module.exports = {
  DUTOS_URL,
  INSTALACOES_URL,
  PLATAFORMAS_URL,
  ZONA_VOLUMES,
  buildCampos,
  mapDuto,
  mapPlataforma,
  projectTokens,
  rememberOperator,
  zonaMonthUrls,
};
