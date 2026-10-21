const cheerio = require("cheerio");

const MONTHS = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

const MONTH_PATTERN = Object.keys(MONTHS).join("|").replace("marco", "mar[cç]o");
const LEAD_MONTHS = 18;

function foldMonth(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function asIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function isoDay(year, month, day) {
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return date.toISOString().slice(0, 10);
}

function datesInText(text) {
  const source = String(text || "");
  const found = [];
  const push = (iso, index) => {
    if (!iso) return;
    if (found.some((item) => item.iso === iso && Math.abs(item.index - index) < 12)) return;
    found.push({ iso, index });
  };

  for (const match of source.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)) {
    push(isoDay(Number(match[3]), Number(match[2]), Number(match[1])), match.index);
  }

  const full = new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MONTH_PATTERN})\\s+de\\s+(\\d{4})\\b`, "gi");
  for (const match of source.matchAll(full)) {
    push(isoDay(Number(match[3]), MONTHS[foldMonth(match[2])], Number(match[1])), match.index);
  }

  const monthYear = new RegExp(`\\b(${MONTH_PATTERN})\\s+de\\s+(\\d{4})\\b`, "gi");
  for (const match of source.matchAll(monthYear)) {
    const insideFullDate = found.some((item) => Math.abs(item.index - match.index) < 8);
    if (insideFullDate) continue;
    push(isoDay(Number(match[2]), MONTHS[foldMonth(match[1])], 1), match.index);
  }

  return found;
}

function scopeAround(text, trecho) {
  const flat = String(text || "").replace(/\s+/g, " ").trim();
  const needle = String(trecho || "").replace(/\s+/g, " ").trim();
  if (!needle) return flat;
  const at = flat.indexOf(needle);
  if (at < 0) return flat;
  return flat.slice(Math.max(0, at - 280), at + needle.length + 280);
}

function chooseStatusDate({ text, trecho, publishedAt, today }) {
  const todayIso = asIsoDate(today) || new Date().toISOString().slice(0, 10);
  const usable = datesInText(scopeAround(text, trecho))
    .map((item) => item.iso)
    .filter((iso) => iso <= todayIso)
    .sort();
  if (usable.length) {
    return { status_em: usable.at(-1), origem: "texto" };
  }
  const published = asIsoDate(publishedAt);
  if (published && published <= todayIso) {
    return { status_em: published, origem: "publicacao" };
  }
  return { status_em: null, origem: null };
}

function periodStart(statusEm, leadMonths = LEAD_MONTHS) {
  const iso = asIsoDate(statusEm);
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 - leadMonths, day));
  return date.toISOString().slice(0, 10);
}

function formatDay(value) {
  const iso = asIsoDate(value);
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function publicationDateFromHtml(html) {
  const $ = cheerio.load(String(html || ""));
  const candidates = [
    $('meta[property="article:published_time"]').attr("content"),
    $('meta[property="og:published_time"]').attr("content"),
    $('meta[name="publishdate"]').attr("content"),
    $('meta[name="pubdate"]').attr("content"),
    $('meta[name="date"]').attr("content"),
    $('meta[itemprop="datePublished"]').attr("content"),
    $("time[datetime]").first().attr("datetime"),
  ];
  $('script[type="application/ld+json"]').each((_index, element) => {
    try {
      const data = JSON.parse($(element).text());
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        candidates.push(node.datePublished || node.dateCreated || null);
      }
    } catch {
      // Bloco de JSON-LD inválido não é data de publicação.
    }
  });
  for (const candidate of candidates) {
    const iso = asIsoDate(candidate);
    if (iso) return iso;
  }
  return null;
}

function periodSentence(count, since, statusEm) {
  if (!since) return "";
  const window = `${formatDay(since)} (18 meses antes do status em ${formatDay(statusEm)})`;
  if (!count) return `Nenhuma data a partir de ${window}.`;
  return `${count} com data a partir de ${window}.`;
}

module.exports = {
  LEAD_MONTHS,
  asIsoDate,
  chooseStatusDate,
  datesInText,
  formatDay,
  periodSentence,
  periodStart,
  publicationDateFromHtml,
};
