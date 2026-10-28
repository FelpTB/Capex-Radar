const cheerio = require("cheerio");

const MAX_CHARS = 80_000;
const MAX_PAGES = 20;

let pdfjsPromise = null;

function loadPdfjs() {
  if (!pdfjsPromise) pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjsPromise;
}

function textToMarkdown(text) {
  const clean = String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  if (!clean) return "";
  return clean.length > MAX_CHARS ? clean.slice(0, MAX_CHARS) : clean;
}

function htmlToMarkdown(html) {
  const $ = cheerio.load(String(html || ""));
  $("script, style, noscript").remove();
  const blocks = [];
  $("h1, h2, h3, h4, p, li").each((_, element) => {
    const tag = (element.tagName || element.name || "").toLowerCase();
    const text = $(element).text().replace(/\s+/g, " ").trim();
    if (!text) return;
    if (tag === "h1") blocks.push(`# ${text}`);
    else if (tag === "h2") blocks.push(`## ${text}`);
    else if (tag === "h3" || tag === "h4") blocks.push(`### ${text}`);
    else if (tag === "li") blocks.push(`- ${text}`);
    else blocks.push(text);
  });
  if (!blocks.length) return textToMarkdown($("body").text().replace(/\s+/g, " "));
  return textToMarkdown(blocks.join("\n\n"));
}

function decodeText(buffer, contentType) {
  const type = String(contentType || "").toLowerCase();
  if (type.includes("iso-8859-1") || type.includes("latin1") || type.includes("windows-1252")) {
    return buffer.toString("latin1");
  }
  return buffer.toString("utf8");
}

function kindOf(buffer, contentType, fileName) {
  const head = buffer.subarray(0, 8).toString("latin1");
  const type = String(contentType || "").toLowerCase();
  const name = String(fileName || "").toLowerCase();
  if (head.startsWith("%PDF") || type.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (head.startsWith("PK")) return "zip";
  const sample = buffer.subarray(0, 240).toString("utf8").trim().toLowerCase();
  if (sample.startsWith("<!doctype") || sample.startsWith("<html") || type.includes("html")) return "html";
  if (type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) return "text";
  return "unknown";
}

async function pageText(doc, number) {
  const page = await doc.getPage(number);
  const content = await page.getTextContent();
  let line = "";
  const lines = [];
  for (const item of content.items) {
    line += item.str || "";
    if (item.hasEOL) {
      if (line.trim()) lines.push(line.trim());
      line = "";
    } else if (item.str) {
      line += " ";
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines.join("\n");
}

async function openPdf(buffer) {
  const pdfjs = await loadPdfjs();
  return pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
    // Fontes TrueType quebradas dos diários geram avisos "TT: undefined function" sem afetar o texto.
    verbosity: 0,
  }).promise;
}

async function pdfToMarkdown(buffer) {
  const doc = await openPdf(buffer);
  const pages = [];
  const total = Math.min(doc.numPages, MAX_PAGES);
  for (let number = 1; number <= total; number += 1) {
    const text = await pageText(doc, number);
    if (text) pages.push(text);
  }
  await doc.destroy();
  return textToMarkdown(pages.join("\n\n"));
}

// Diário oficial tem centenas de páginas: lê só as páginas pedidas, ou procura o termo em todas.
// match recebe o texto da página e diz se ela fica.
async function pdfPages(buffer, { pages = null, match = null, maxPages = 600 } = {}) {
  const doc = await openPdf(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []));
  const wanted = pages
    ? pages.filter((number) => number >= 1 && number <= doc.numPages)
    : Array.from({ length: Math.min(doc.numPages, maxPages) }, (_, index) => index + 1);
  const found = [];
  for (const number of wanted) {
    const texto = await pageText(doc, number);
    if (!match || match(texto)) found.push({ pagina: number, texto });
  }
  await doc.destroy();
  return found;
}

async function documentToMarkdown(buffer, meta = {}) {
  const body = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (!body.length) throw new Error("arquivo vazio");
  const kind = kindOf(body, meta.contentType, meta.fileName);
  if (kind === "pdf") return pdfToMarkdown(body);
  if (kind === "html") return htmlToMarkdown(decodeText(body, meta.contentType));
  if (kind === "text") return textToMarkdown(decodeText(body, meta.contentType));
  if (kind === "zip") throw new Error("arquivo compactado");
  throw new Error("formato n\u00e3o convertido");
}

module.exports = {
  documentToMarkdown,
  pdfPages,
  htmlToMarkdown,
  textToMarkdown,
};
