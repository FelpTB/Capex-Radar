const { csvRows, onlyDigits, parseDecimal } = require("./rows");

const REIDI_PACKAGE = "https://dados.transportes.gov.br/api/3/action/package_show?id=incentivo-fiscal-reidi";

function cell(row, index) {
  if (index < 0) return null;
  const text = String(row[index] ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function column(header, pattern) {
  return header.findIndex((name) => pattern.test(String(name).replace(/\s+/g, " ").trim()));
}

function pickReidiResource(resources) {
  const files = (resources || []).filter((item) => {
    const name = `${item.name || ""} ${item.format || ""} ${item.url || ""}`;
    return /csv/i.test(name) && !/dicion/i.test(name);
  });
  files.sort((left, right) => String(right.last_modified || "").localeCompare(String(left.last_modified || "")));
  return files[0] || null;
}

function reidiRecords(text) {
  const rows = csvRows(text, ";");
  const headerIndex = rows.findIndex((row) => row.some((name) => /^cnpj$/i.test(String(name).replace(/\s+/g, " ").trim())));
  if (headerIndex < 0) return [];
  const header = rows[headerIndex];
  const empresa = column(header, /concession|empresa/i);
  const cnpj = column(header, /^cnpj$/i);
  const uf = column(header, /localiza/i);
  const modal = column(header, /^modal$/i);
  const investimento = column(header, /investimento/i);
  const ano = column(header, /aprova/i);
  const portaria = column(header, /portaria/i);
  const contrato = column(header, /contrato/i);
  const concessao = column(header, /^concess/i);
  const ade = column(header, /^ade$/i);
  const numero = column(header, /^n[oº°]/i);
  const impacto = column(header, /impacto/i);
  const records = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const nome = cell(row, empresa);
    const digits = onlyDigits(cell(row, cnpj));
    if (!nome && !digits) continue;
    const ufRaw = cell(row, uf);
    records.push({
      chave: null,
      cnpj: digits,
      cnpjs: digits ? [digits] : [],
      titulo: nome,
      uf: ufRaw && /^[A-Za-z]{2}$/.test(ufRaw) ? ufRaw.toUpperCase() : null,
      municipio: null,
      valor: parseDecimal(cell(row, investimento)),
      payload: {
        numero: cell(row, numero),
        empresa: nome,
        modal: cell(row, modal),
        concessao: cell(row, concessao),
        contrato: cell(row, contrato),
        ano: cell(row, ano),
        portaria: cell(row, portaria),
        ade: cell(row, ade),
        impacto: cell(row, impacto),
        uf: ufRaw,
      },
    });
  }
  return records;
}

module.exports = { REIDI_PACKAGE, pickReidiResource, reidiRecords };
