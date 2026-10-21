const fs = require("node:fs");
const readline = require("node:readline");
const path = require("node:path");
const { fold, onlyDigits } = require("./resolve");
const { asIsoDate, periodStart } = require("../status-date");

const DIR = path.join(process.cwd(), "data", "dadosgov", "cadastro-nacional-de-obras-cno");
const ZIP = path.join(DIR, "cno.zip");
const CSV = path.join(DIR, "cno.csv");
const AREAS = path.join(DIR, "cno_areas.csv");
const CNAES = path.join(DIR, "cno_cnaes.csv");
const VINCULOS = path.join(DIR, "cno_vinculos.csv");
const TOTAIS = path.join(DIR, "cno_totais.csv");
const ARQUIVOS = ["cno.csv", "cno_cnaes.csv", "cno_vinculos.csv", "cno_areas.csv", "cno_totais.csv"];

const QUALIFICACAO = {
  "0053": "pessoa jurídica construtora",
  "0057": "dono da obra",
  "0064": "incorporador",
  "0070": "proprietário do imóvel",
  "0109": "consórcio",
  "0110": "construção em nome coletivo",
  "0111": "sociedade líder de consórcio",
};

function splitCsv(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function columnIndex(header) {
  const folded = header.map((cell) => fold(cell));
  const at = (pattern) => folded.findIndex((cell) => pattern.test(cell));
  return {
    cno: at(/^cno$/),
    ni: at(/ni do responsavel/),
    municipio: at(/nome do municipio/),
    uf: at(/^estado$/),
    area: at(/area total/),
    situacao: at(/^situacao$/),
    inicio: at(/data de inicio$/),
    empresa: at(/nome empresarial/),
    nome: at(/^nome$/),
    qualificacao: at(/qualificacao do responsavel/),
    cnoVinculado: at(/cno vinculado/),
    dataSituacao: at(/data da situacao/),
  };
}

function papelDe(code) {
  const digits = onlyDigits(code || "");
  if (!digits) return null;
  return QUALIFICACAO[digits.padStart(4, "0")] || null;
}

function cell(cells, index) {
  if (index < 0) return null;
  const value = (cells[index] || "").trim();
  return value || null;
}

function cnoKey(value) {
  const digits = onlyDigits(value || "");
  return digits ? digits.padStart(12, "0") : "";
}

function requireColumn(header, pattern, label) {
  const folded = header.map((item) => fold(item));
  const index = folded.findIndex((item) => pattern.test(item));
  if (index < 0) throw new Error(`O CSV do CNO não tem a coluna ${label}.`);
  return index;
}

function classifyRow(cells, columns, projectsByRoot) {
  const ni = onlyDigits(cells[columns.ni] || "").padStart(14, "0");
  if (ni.length !== 14 || ni === "00000000000000") return;
  const projects = projectsByRoot.get(ni.slice(0, 8));
  if (!projects) return;
  const row = {
    cno: cells[columns.cno] || null,
    ni,
    municipio: cells[columns.municipio] || null,
    uf: (cells[columns.uf] || "").trim(),
    area: cells[columns.area] || null,
    situacao: cells[columns.situacao] || null,
    inicio: cells[columns.inicio] || null,
    empresa: cells[columns.empresa] || null,
    nome: cell(cells, columns.nome),
    qualificacao: cell(cells, columns.qualificacao),
    papel: papelDe(cells[columns.qualificacao]),
    cno_vinculado: cell(cells, columns.cnoVinculado),
    data_situacao: cell(cells, columns.dataSituacao),
  };
  for (const project of projects) {
    const hit = project.hits;
    hit.total += 1;
    const sameDocument = ni === onlyDigits(project.cnpj).padStart(14, "0");
    const sameUf = project.uf && row.uf.toUpperCase() === project.uf.toUpperCase();
    const city = fold(project.municipio || "");
    const sameCity = city.length > 2 && fold(row.municipio).includes(city);
    if (sameDocument) hit.mesmoCnpj += 1;
    if (sameUf) hit.noUf += 1;
    if (sameCity) hit.noMunicipio += 1;
    const inPeriod = Boolean(project.desde && row.inicio && row.inicio >= project.desde);
    if (inPeriod) hit.noPeriodo += 1;
    const rank = (sameCity ? 4 : 0) + (sameUf ? 2 : 0) + (inPeriod ? 1 : 0);
    if (!rank) continue;
    hit.amostra.push({ ...row, rank });
    hit.amostra.sort((left, right) => right.rank - left.rank);
    if (hit.amostra.length > 8) hit.amostra.length = 8;
  }
}

function emptyHit() {
  return { total: 0, mesmoCnpj: 0, noUf: 0, noMunicipio: 0, noPeriodo: 0, amostra: [] };
}

function cnoNeedles(term) {
  const stop = new Set(["em", "de", "da", "do", "no", "na", "para", "com", "dos", "das"]);
  const words = fold(term).split(/\s+/).filter((word) => word.length >= 2 && !stop.has(word));
  const phrase = words.slice(0, 2).join(" ");
  const first = words[0] && words[0].length >= 4 ? words[0] : null;
  return [...new Set([phrase, first].filter((item) => item && item.length >= 3))];
}

function missingFile(name) {
  return new Error(`${name} não está extraído em data/dadosgov/cadastro-nacional-de-obras-cno. Rode npm run dadosgov:sync.`);
}

function streamCsv(csvPath, columnsFor, onLine) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(csvPath)) {
      reject(missingFile(path.basename(csvPath)));
      return;
    }
    const input = fs.createReadStream(csvPath, { encoding: "latin1" });
    const lines = readline.createInterface({ input, crlfDelay: Infinity });
    let columns = null;
    let failed = null;
    input.on("error", (error) => {
      failed = failed || error;
    });
    lines.on("line", (line) => {
      if (failed) return;
      try {
        if (!columns) {
          columns = columnsFor(splitCsv(line));
          return;
        }
        onLine(splitCsv(line), columns);
      } catch (error) {
        failed = error;
      }
    });
    lines.on("close", () => {
      if (failed) reject(failed);
      else resolve();
    });
  });
}

function readCsv(csvPath, onLine) {
  return streamCsv(csvPath, (header) => {
    const columns = columnIndex(header);
    if (columns.ni < 0) throw new Error("O CSV do CNO não tem a coluna do responsável.");
    return columns;
  }, onLine);
}

function indexAmostra(byId) {
  const wanted = new Map();
  for (const hit of byId.values()) {
    for (const row of hit.amostra || []) {
      const key = cnoKey(row.cno);
      if (!key) continue;
      row.areas = [];
      row.cnaes = [];
      row.vinculos = [];
      const list = wanted.get(key) || [];
      list.push(row);
      wanted.set(key, list);
    }
  }
  return wanted;
}

function attachAreas(wanted, csvPath) {
  return streamCsv(csvPath, (header) => ({
    cno: requireColumn(header, /^cno$/, "CNO"),
    categoria: requireColumn(header, /^categoria$/, "Categoria"),
    destinacao: requireColumn(header, /^destinacao$/, "Destinação"),
    tipoObra: requireColumn(header, /^tipo de obra$/, "Tipo de obra"),
    tipoArea: requireColumn(header, /^tipo de area$/, "Tipo de Área"),
    tipoComplementar: requireColumn(header, /tipo de area complementar/, "Tipo de Área Complementar"),
    metragem: requireColumn(header, /^metragem$/, "Metragem"),
  }), (cells, columns) => {
    const rows = wanted.get(cnoKey(cells[columns.cno]));
    if (!rows) return;
    const area = {
      categoria: cell(cells, columns.categoria),
      destinacao: cell(cells, columns.destinacao),
      tipo_obra: cell(cells, columns.tipoObra),
      tipo_area: cell(cells, columns.tipoArea),
      tipo_complementar: cell(cells, columns.tipoComplementar),
      metragem: cell(cells, columns.metragem),
    };
    for (const row of rows) row.areas.push(area);
  });
}

function attachCnaes(wanted, csvPath) {
  return streamCsv(csvPath, (header) => ({
    cno: requireColumn(header, /^cno$/, "CNO"),
    cnae: requireColumn(header, /^cnae$/, "CNAE"),
    registro: requireColumn(header, /data de registro/, "Data de registro"),
  }), (cells, columns) => {
    const rows = wanted.get(cnoKey(cells[columns.cno]));
    if (!rows) return;
    const item = {
      cnae: cell(cells, columns.cnae),
      registro: cell(cells, columns.registro),
    };
    for (const row of rows) row.cnaes.push(item);
  });
}

function attachVinculos(wanted, csvPath) {
  return streamCsv(csvPath, (header) => ({
    cno: requireColumn(header, /^cno$/, "CNO"),
    inicio: requireColumn(header, /data de inicio$/, "Data de início"),
    fim: requireColumn(header, /data de fim/, "Data de fim"),
    registro: requireColumn(header, /data de registro/, "Data de registro"),
    qualificacao: requireColumn(header, /qualificacao do contribuinte/, "Qualificação do contribuinte"),
    ni: requireColumn(header, /ni do responsavel/, "NI do responsável"),
  }), (cells, columns) => {
    const rows = wanted.get(cnoKey(cells[columns.cno]));
    if (!rows) return;
    const ni = onlyDigits(cells[columns.ni] || "");
    const item = {
      inicio: cell(cells, columns.inicio),
      fim: cell(cells, columns.fim),
      registro: cell(cells, columns.registro),
      qualificacao: cell(cells, columns.qualificacao),
      papel: papelDe(cells[columns.qualificacao]),
      ni: ni.length === 14 ? ni : null,
    };
    for (const row of rows) row.vinculos.push(item);
  });
}

function readTotais(csvPath) {
  let totais = null;
  return streamCsv(csvPath, (header) => ({
    obras: requireColumn(header, /total de obras/, "Total de obras"),
    cnaes: requireColumn(header, /total de cnaes/, "Total de cnaes"),
    areas: requireColumn(header, /total de areas/, "Total de áreas"),
    vinculos: requireColumn(header, /total de vinculos/, "Total de vínculos"),
  }), (cells, columns) => {
    if (totais) return;
    totais = {
      obras: cell(cells, columns.obras),
      cnaes: cell(cells, columns.cnaes),
      areas: cell(cells, columns.areas),
      vinculos: cell(cells, columns.vinculos),
    };
  }).then(() => totais);
}

function enrichHits(byId, dir) {
  const totaisPath = path.join(dir, "cno_totais.csv");
  return readTotais(totaisPath).then((totais) => {
    for (const hit of byId.values()) hit.totais = totais;
    const wanted = indexAmostra(byId);
    if (!wanted.size) return byId;
    return attachAreas(wanted, path.join(dir, "cno_areas.csv"))
      .then(() => attachCnaes(wanted, path.join(dir, "cno_cnaes.csv")))
      .then(() => attachVinculos(wanted, path.join(dir, "cno_vinculos.csv")))
      .then(() => byId);
  });
}

function namesInCno(term, csvPath = CSV) {
  const needles = (Array.isArray(term) ? term : [term])
    .map((item) => fold(item))
    .filter((item) => item.length >= 3);
  if (!needles.length) return Promise.resolve([]);
  const found = new Map();
  return readCsv(csvPath, (cells, columns) => {
    if (columns.empresa < 0) return;
    const empresa = cells[columns.empresa] || cells[columns.nome] || "";
    const foldedName = fold(`${cells[columns.nome] || ""} ${cells[columns.empresa] || ""}`);
    if (!needles.some((needle) => foldedName.includes(needle))) return;
    const ni = onlyDigits(cells[columns.ni] || "");
    if (ni.length !== 14) return;
    const current = found.get(ni) || { cnpj: ni, nome: empresa, base: "SEC-CNO", linhas: 0 };
    current.linhas += 1;
    found.set(ni, current);
  }).then(() => [...found.values()]);
}

function matchCno(projects, csvPath = CSV) {
  const ready = projects
    .map((project) => ({ ...project, cnpj: onlyDigits(project.cnpj) }))
    .filter((project) => project.cnpj.length === 14);
  const byId = new Map(ready.map((project) => {
    const hit = emptyHit();
    hit.desde = periodStart(project.status_em);
    hit.statusEm = asIsoDate(project.status_em);
    return [project.id, hit];
  }));
  if (!ready.length) return Promise.resolve(byId);
  const dir = path.dirname(csvPath);
  for (const name of ARQUIVOS) {
    if (!fs.existsSync(path.join(dir, name))) return Promise.reject(missingFile(name));
  }

  const byRoot = new Map();
  for (const project of ready) {
    const root = project.cnpj.padStart(14, "0").slice(0, 8);
    const list = byRoot.get(root) || [];
    const hit = byId.get(project.id);
    list.push({ ...project, hits: hit, desde: hit.desde });
    byRoot.set(root, list);
  }

  return readCsv(csvPath, (cells, columns) => {
    classifyRow(cells, columns, byRoot);
  }).then(() => enrichHits(byId, dir));
}

module.exports = {
  AREAS,
  CNAES,
  CSV,
  DIR,
  TOTAIS,
  VINCULOS,
  ZIP,
  splitCsv,
  columnIndex,
  classifyRow,
  matchCno,
  namesInCno,
  cnoNeedles,
};
