const cheerio = require("cheerio");
const db = require("./db");
const { extractProjects } = require("./ai");
const { getConfig } = require("./config");
const { publicationDateFromHtml } = require("./status-date");

const config = getConfig();

const PROJECT_TERMS = [
  "investimento", "obra", "constru", "amplia", "expans", "implant",
  "usina", "terminal", "ferrovia", "rodovia", "porto", "aeroporto",
  "fábrica", "fabrica", "planta", "mina", "minera", "concess",
  "leilão", "leilao", "transmissão", "transmissao", "saneamento",
  "gasoduto", "oleoduto", "data center", "hidrogênio", "hidrogenio",
  "licença", "licenca", "bilhões", "bilhoes", "milhões", "milhoes",
];
const NOISE_TERMS = [
  "bitcoin", "btc", "ethereum", "cripto", "ibovespa", "dólar", "dolar",
  "selic", "copom", "inflação", "inflacao", "ipca", "pib ", "juros",
  "dívida", "divida", "recompra", "dividendo", "balanço", "balanco",
  "lucro", "prejuízo", "prejuizo", "receita líquida", "tarifa", "tarifas",
  "eleição", "eleicao", "eleições", "eleicoes", "trump", "tesouro",
  "fundo imobiliário", "fii", "ações", "acoes", "b3", "nasdaq", "wall street",
  "exportação", "exportacao", "importação", "importacao", "mansão", "mansao",
  "ranking", "bilionário", "bilionario", "fortuna",
];
const FOREIGN_TERMS = [
  "eua", "estados unidos", "china", "chinês", "chines", "europa", "alemanha",
  "frança", "franca", "japão", "japao", "índia", "india", "méxico", "mexico",
  "argentina", "chile", "colômbia", "colombia", "paraguai", "uruguai",
  "arábia", "arabia", "oriente médio", "oriente medio", "áfrica", "africa",
  "canadá", "canada", "reino unido", "londres", "nova york", "suíça", "suica",
  "portugal", "espanha", "itália", "italia", "coreia", "taiwan", "filipin",
];
const UF_PATTERN = /\b(ac|al|ap|am|ba|ce|df|es|go|ma|mt|ms|mg|pa|pb|pr|pe|pi|rj|rn|rs|ro|rr|sc|sp|se|to)\b/;
const BRAZIL_TERMS = [
  "brasil", "brasileir",
  "são paulo", "sao paulo", "minas", "paraná", "parana", "bahia", "ceará",
  "ceara", "pernambuco", "santa catarina", "rio grande", "goiás", "goias",
  "espírito santo", "espirito santo", "mato grosso", "amazonas", "belém",
  "maranhão", "maranhao", "piauí", "piaui", "sergipe", "alagoas", "paraíba",
  "paraiba", "rio de janeiro", "rondônia", "rondonia", "tocantins", "acre",
  "amapá", "amapa", "roraima", "distrito federal", "nordeste", "sudeste",
  "pecém", "pecem", "suape", "itajaí", "itajai", "santos", "manaus",
];
const DENY_PATH = [
  "/tag/", "/author/", "/categoria/", "/category/", "/contato",
  "/login", "/assine", "/newsletter", "/podcast", "/politica-de-",
];

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function fold(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const FOLDED = {
  project: [...new Set(PROJECT_TERMS.map(fold))],
  noise: [...new Set(NOISE_TERMS.map(fold))],
  foreign: [...new Set(FOREIGN_TERMS.map(fold))],
  brazil: [...new Set(BRAZIL_TERMS.map(fold))],
};

function relevance(title, summary = "") {
  const text = ` ${fold(`${title} ${summary}`)} `;
  let score = FOLDED.project.reduce(
    (total, term) => total + (text.includes(term) ? 2 : 0),
    0,
  );
  if (/(r\$|us\$)\s*[\d,.]+/i.test(text)) score += 5;
  if (/\d/.test(text)) score += 1;
  const noise = FOLDED.noise.filter((term) => text.includes(term)).length;
  score -= noise * 4;
  const foreign = FOLDED.foreign.some((term) => text.includes(term));
  const brazil = FOLDED.brazil.some((term) => text.includes(term))
    || UF_PATTERN.test(text);
  if (foreign && !brazil) score -= 8;
  if (brazil) score += 2;
  return Math.max(0, Math.min(score, 100));
}

function articleCandidates(html, baseUrl) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const candidates = [];

  $("a[href]").each((_index, element) => {
    const anchor = $(element);
    const title = clean(anchor.text());
    if (title.length < 24 || title.length > 240) return;

    let url;
    try {
      url = new URL(anchor.attr("href"), baseUrl);
    } catch {
      return;
    }
    const base = new URL(baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return;
    if (url.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) return;
    if (url.pathname === "/" || DENY_PATH.some((part) => url.pathname.includes(part))) return;
    url.hash = "";
    const normalizedUrl = url.toString();
    if (seen.has(normalizedUrl)) return;

    const container = anchor.closest("article, li, .post, .card, .item, div");
    const summary = clean(container.find("p").first().text()).slice(0, 600);
    const score = relevance(title, summary);
    if (score < 3) return;

    seen.add(normalizedUrl);
    candidates.push({ url: normalizedUrl, title, summary, relevance: score });
  });

  return candidates
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 8);
}

async function fetchText(url, timeoutMs = 15_000) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "user-agent": "RadarCapEx-MVP/0.1 (research; contact via project owner)",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { html: await response.text(), status: response.status };
}

async function articleContext(url, fallback) {
  try {
    const { html } = await fetchText(url, 12_000);
    const publishedAt = publicationDateFromHtml(html);
    const $ = cheerio.load(html);
    $("script,style,nav,footer,header,aside").remove();
    const title = clean($("h1").first().text()) || fallback.title;
    const paragraphs = $("article p, main p, .content p, .entry-content p")
      .map((_i, element) => clean($(element).text()))
      .get()
      .filter((text) => text.length > 40)
      .slice(0, 12);
    return {
      text: `${title}\n${paragraphs.join("\n")}`.slice(0, 14_000),
      publishedAt,
    };
  } catch {
    return {
      text: `${fallback.title}\n${fallback.summary}`.trim(),
      publishedAt: null,
    };
  }
}

async function articleText(url, fallback) {
  const { text } = await articleContext(url, fallback);
  return text;
}

async function scanSource(source) {
  try {
    const { html, status } = await fetchText(source.url_base);
    const discovered = articleCandidates(html, source.url_base);
    await db.registerSourceAccess(source.id, { httpStatus: status });
    return { source, discovered, error: null };
  } catch (error) {
    await db.registerSourceAccess(source.id, {
      httpStatus: null,
      error: error.message,
    });
    return { source, discovered: [], error: error.message };
  }
}

function selectForAnalysis(ranked, { perSource = null, limit = 12 } = {}) {
  const selected = perSource
    ? ranked.filter((candidate, index) => {
      const taken = ranked
        .slice(0, index)
        .filter((item) => item.id_fonte === candidate.id_fonte)
        .length;
      return taken < perSource;
    })
    : ranked;
  return selected.slice(0, limit);
}

const MIN_CAPEX_BRL = 100_000_000;
const USD_TO_BRL = 5;

function capexInBrl(extracted) {
  const value = Number(extracted?.valor_capex);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (extracted.moeda === "USD") return value * USD_TO_BRL;
  return value;
}

function privateProjectReason(extracted) {
  if (!extracted || extracted.esfera === "fora") return "não é projeto";
  if (extracted.esfera === "publica" || extracted.envolve_orgao_publico) {
    return "projeto público";
  }
  const country = extracted.pais || (extracted.uf ? "BR" : null);
  if (country !== "BR") return "projeto internacional";
  const capex = capexInBrl(extracted);
  if (capex !== null && capex < MIN_CAPEX_BRL) return "projeto pequeno";
  return null;
}

function queueReason(projects) {
  if (!projects.length) return "não é projeto";
  const reasons = projects.map(privateProjectReason);
  if (reasons.some((reason) => !reason)) return null;
  return reasons[0];
}

function candidatePayload(projects) {
  const lead = projects.find((item) => !privateProjectReason(item)) || projects[0];
  return { ...lead, projetos: projects };
}

async function scanPrimarySources({ codigos = null, perSource = null, limit = 12 } = {}) {
  const sources = codigos
    ? await db.listSourcesByCodes(codigos)
    : await db.listPrimarySources();
  const results = await Promise.all(sources.map(scanSource));
  const queued = [];

  for (const result of results) {
    for (const item of result.discovered) {
      const candidate = await db.upsertCandidate({
        id_fonte: result.source.id,
        url: item.url,
        titulo: item.title,
        resumo: item.summary,
        relevancia: item.relevance,
      });
      if (["novo", "erro"].includes(candidate.status)) queued.push(candidate);
    }
  }

  const ranked = [...queued].sort((a, b) => b.relevancia - a.relevancia);
  const toAnalyze = selectForAnalysis(ranked, { perSource, limit });
  let kept = 0;
  let filteredOut = 0;

  for (const candidate of toAnalyze) {
    try {
      const { text, publishedAt } = await articleContext(candidate.url, {
        title: candidate.titulo,
        summary: candidate.resumo,
      });
      const { projetos } = await extractProjects(text, { publishedAt });
      await db.markCandidateAnalyzed(
        candidate.id,
        candidatePayload(projetos),
        config.openAiModel,
      );
      const reason = queueReason(projetos);
      if (reason) {
        await db.rejectCandidate(candidate.id, reason);
        filteredOut += 1;
      } else {
        kept += 1;
      }
    } catch (error) {
      await db.markCandidateError(candidate.id, error.message);
    }
  }

  return {
    sources: results.length,
    sourcesWithError: results.filter((item) => item.error).length,
    discovered: results.reduce((sum, item) => sum + item.discovered.length, 0),
    analyzed: toAnalyze.length,
    kept,
    filteredOut,
    errors: results
      .filter((item) => item.error)
      .map((item) => ({ nome: item.source.nome, erro: item.error })),
  };
}

module.exports = {
  MIN_CAPEX_BRL,
  relevance,
  articleCandidates,
  selectForAnalysis,
  privateProjectReason,
  queueReason,
  candidatePayload,
  articleText,
  articleContext,
  scanPrimarySources,
};
