const cheerio = require("cheerio");
const db = require("./db");
const { NEWS_QUERIES, googleNewsRssUrl } = require("./news-queries");

const IGNORED_HOSTS = new Set([
  "news.google.com",
  "google.com",
  "google.com.br",
  "youtube.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "wikipedia.org",
  "t.co",
  "bit.ly",
]);

const PUBLIC_SUFFIXES = ["gov.br", "jus.br", "leg.br", "mp.br", "mil.br"];

function publisherDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isIgnoredDomain(dominio) {
  const host = String(dominio || "").toLowerCase().replace(/^www\./, "");
  if (!host || host.length < 4) return true;
  if (IGNORED_HOSTS.has(host)) return true;
  if ([...IGNORED_HOSTS].some((ignored) => host === ignored || host.endsWith(`.${ignored}`))) {
    return true;
  }
  return PUBLIC_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function publishersFromRss(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const byDomain = new Map();
  $("item source").each((_index, element) => {
    const node = $(element);
    const dominio = publisherDomain(node.attr("url"));
    const nome = node.text().replace(/\s+/g, " ").trim().slice(0, 160);
    if (!dominio || isIgnoredDomain(dominio)) return;
    if (!byDomain.has(dominio)) {
      byDomain.set(dominio, { dominio, nome: nome || dominio });
    }
  });
  return [...byDomain.values()];
}

function codigoForDomain(dominio) {
  const slug = String(dominio || "")
    .replace(/^www\./, "")
    .split(".")[0]
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 24)
    .toUpperCase();
  return `NEWS-${slug || "PORTAL"}`;
}

async function fetchRss(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: {
      "user-agent": "RadarCapEx-MVP/0.1 (research; contact via project owner)",
      accept: "application/rss+xml, application/xml, text/xml",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function discoverPublishers({ fetchFeed = fetchRss } = {}) {
  const errors = [];
  let appearances = 0;

  for (const query of NEWS_QUERIES) {
    try {
      const xml = await fetchFeed(googleNewsRssUrl(query.q));
      const publishers = publishersFromRss(xml);
      for (const publisher of publishers) {
        await db.insertAppearance({
          dominio: publisher.dominio,
          nome: publisher.nome,
          consulta: query.id,
        });
        appearances += 1;
      }
    } catch (error) {
      errors.push({ consulta: query.id, erro: error.message });
    }
  }

  const ready = new Set(await db.domainsReadyForProva());
  const observed = await db.recentAppearanceDomains();
  let suggested = 0;
  let promoted = 0;

  for (const row of observed) {
    const existing = await db.findSourceByDomain(row.dominio);
    if (!existing) {
      const estagio = ready.has(row.dominio) ? "prova" : "sugerida";
      await db.createObservedSource({
        dominio: row.dominio,
        nome: row.nome_portal,
        estagio,
        codigo: codigoForDomain(row.dominio),
      });
      if (estagio === "prova") promoted += 1;
      else suggested += 1;
      continue;
    }
    if (ready.has(row.dominio) && ["sugerida", "aposentada"].includes(existing.estagio)) {
      await db.setSourceStage(existing.id, "prova", { participaScanner: false });
      promoted += 1;
    }
  }

  return {
    consultas: NEWS_QUERIES.length,
    aparicoes: appearances,
    sugeridas: suggested,
    provas: promoted,
    erros: errors,
  };
}

module.exports = {
  publisherDomain,
  isIgnoredDomain,
  publishersFromRss,
  codigoForDomain,
  discoverPublishers,
};
