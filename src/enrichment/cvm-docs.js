const { onlyDigits } = require("./rows");
const { documentToMarkdown } = require("../documents/to-markdown");

const DOCUMENT_LIMIT = 5;
const EXCERPT_CHARS = 2000;
const MAX_BYTES = 12 * 1024 * 1024;
const PERMANENT_ERRORS = new Set([
  "arquivo compactado",
  "formato n\u00e3o convertido",
  "arquivo grande demais",
  "arquivo vazio",
  "documento sem texto",
  "sem link",
  "link sem https",
]);

function utcDay(value) {
  if (!value) return null;
  const date = value instanceof Date
    ? value
    : new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function documentDay(row) {
  return utcDay(row?.data_entrega || row?.data_referencia);
}

function eligibleCvmDocuments(rows, now = new Date()) {
  const today = utcDay(now);
  const cutoff = new Date(today);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  const latest = new Map();
  for (const row of rows || []) {
    const protocolo = String(row.protocolo || "").trim();
    if (!protocolo) continue;
    const versao = Number(row.versao) || 1;
    const current = latest.get(protocolo);
    if (!current || versao > (Number(current.versao) || 1)) latest.set(protocolo, row);
  }
  return [...latest.values()]
    .filter((row) => {
      const day = documentDay(row);
      return day && day > cutoff;
    })
    .sort((left, right) => {
      const byDate = documentDay(right) - documentDay(left);
      if (byDate) return byDate;
      return String(right.protocolo).localeCompare(String(left.protocolo));
    })
    .slice(0, DOCUMENT_LIMIT);
}

function cvmExcerpt(markdown, limit = EXCERPT_CHARS) {
  const text = String(markdown || "").trim();
  if (!text) return "";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trim()}\u2026`;
}

function isoDay(value) {
  const day = utcDay(value);
  return day ? day.toISOString().slice(0, 10) : null;
}

async function fetchCvmDocument(url) {
  if (!/^https:\/\//i.test(String(url || ""))) throw new Error("link sem https");
  const response = await fetch(url, {
    headers: {
      accept: "application/pdf,text/html,application/octet-stream,*/*",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error("arquivo vazio");
  if (buffer.length > MAX_BYTES) throw new Error("arquivo grande demais");
  const disposition = response.headers.get("content-disposition") || "";
  const match = /filename\*?=(?:UTF-8''|"?)([^";]+)/i.exec(disposition);
  return {
    buffer,
    contentType: response.headers.get("content-type") || "",
    fileName: match ? decodeURIComponent(match[1].replace(/"/g, "").trim()) : "",
  };
}

async function saveDocument(pool, row, result) {
  await pool.query(
    `insert into enr_cvm_documento
       (protocolo, versao, cnpj, link, data_entrega, markdown, status, erro, convertido_em)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now())
     on conflict (protocolo, versao) do update set
       cnpj = excluded.cnpj,
       link = excluded.link,
       data_entrega = excluded.data_entrega,
       markdown = excluded.markdown,
       status = excluded.status,
       erro = excluded.erro,
       convertido_em = now()`,
    [
      String(row.protocolo).trim(),
      Number(row.versao) || 1,
      onlyDigits(row.cnpj) || null,
      row.link || null,
      isoDay(row.data_entrega || row.data_referencia),
      result.markdown || null,
      result.status,
      result.erro || null,
    ],
  );
}

async function convertCompanyDocuments(cnpj, options = {}) {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return [];
  const pool = options.pool || require("../db").pool;
  const now = options.now || new Date();
  const fetchDocument = options.fetchDocument || fetchCvmDocument;
  const { rows } = await pool.query(
    `select protocolo, versao, cnpj, assunto, categoria, tipo, especie, tipo_apresentacao,
            data_entrega, data_referencia, link
     from enr_cvm_ipe
     where cnpj = $1
       and coalesce(data_entrega, data_referencia) > ($2::date - interval '1 year')`,
    [digits, isoDay(now)],
  );
  const chosen = eligibleCvmDocuments(rows, now);
  if (!chosen.length) return [];
  const stored = await pool.query(
    `select protocolo, versao, link, markdown, status
     from enr_cvm_documento
     where protocolo = any($1::text[])`,
    [chosen.map((row) => String(row.protocolo).trim())],
  );
  const cached = new Map(stored.rows.map((row) => [`${row.protocolo}:${row.versao}`, row]));
  const converted = [];
  for (const row of chosen) {
    const key = `${String(row.protocolo).trim()}:${Number(row.versao) || 1}`;
    const previous = cached.get(key);
    const sameLink = previous && previous.link === (row.link || null);
    if (sameLink && previous.status === "ok" && previous.markdown) {
      converted.push({ ...row, markdown: previous.markdown, status: "ok" });
      continue;
    }
    if (sameLink && previous.status === "erro" && PERMANENT_ERRORS.has(previous.erro)) {
      converted.push({ ...row, status: "erro", erro: previous.erro });
      continue;
    }
    if (!row.link) {
      await saveDocument(pool, row, { status: "erro", erro: "sem link", markdown: null });
      converted.push({ ...row, status: "erro", erro: "sem link" });
      continue;
    }
    try {
      const file = await fetchDocument(row.link);
      const markdown = await documentToMarkdown(file.buffer, file);
      if (!markdown) throw new Error("documento sem texto");
      await saveDocument(pool, row, { status: "ok", markdown, erro: null });
      converted.push({ ...row, markdown, status: "ok" });
    } catch (error) {
      const message = error.message || "falha na conversao";
      await saveDocument(pool, row, { status: "erro", erro: message, markdown: null });
      converted.push({ ...row, status: "erro", erro: message });
    }
  }
  return converted;
}

module.exports = {
  DOCUMENT_LIMIT,
  convertCompanyDocuments,
  cvmExcerpt,
  eligibleCvmDocuments,
};
