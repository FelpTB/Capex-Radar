const { holderTerm } = require("./sigmine");
const { fold } = require("./resolve");

const USER_AGENT = "RadarCapEx-MVP/0.1 (research; contact via project owner)";
const DOU_SEARCH = "https://www.in.gov.br/consulta/-/buscar/dou";
const DIARIO_API = "https://queridodiario.ok.org.br/api/gazettes";

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function matchMunicipio(list, nome) {
  const wanted = fold(nome);
  if (!wanted) return null;
  return (list || []).find((item) => fold(item.nome) === wanted) || null;
}

function parseDouHits(html, term) {
  const marker = 'BuscaDouPortlet_params" type="application/json">';
  const start = String(html || "").indexOf(marker);
  if (start < 0) return [];
  const jsonStart = html.indexOf("{", start);
  const jsonEnd = html.indexOf("</script>", jsonStart);
  if (jsonStart < 0 || jsonEnd < 0) return [];
  const payload = JSON.parse(html.slice(jsonStart, jsonEnd));
  const words = fold(term).split(/\s+/).filter((word) => word.length >= 4);
  const hits = [];
  for (const item of payload.jsonArray || []) {
    const texto = stripHtml(`${item.title || ""} ${item.content || ""}`);
    const folded = fold(texto);
    if (words.length && words.some((word) => !folded.includes(word))) continue;
    const urlTitle = String(item.urlTitle || "");
    if (!urlTitle) continue;
    hits.push({
      titulo: stripHtml(item.title),
      data: item.pubDate || null,
      secao: item.pubName || null,
      pagina: item.numberPage || null,
      trecho: texto.slice(0, 240),
      url: urlTitle.startsWith("http") ? urlTitle : `https://www.in.gov.br/web/dou/-/${urlTitle}`,
    });
  }
  return hits;
}

function diarioHits(payload) {
  const linhas = (payload?.gazettes || []).map((item) => ({
    data: item.date || null,
    municipio: item.territory_name || null,
    trecho: stripHtml((item.excerpts || []).join(" ")).slice(0, 240),
    url: item.url || null,
  })).filter((item) => item.trecho || item.url);
  return { total: Number(payload?.total_gazettes) || linhas.length, linhas };
}

async function territoryId(municipio, uf) {
  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(uf)}/municipios`,
    {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) throw new Error(`IBGE respondeu HTTP ${response.status}.`);
  const found = matchMunicipio(await response.json(), municipio);
  return found ? String(found.id) : null;
}

// Limite de atos lidos por consulta. Cinco mais recentes. Pode ser revisado.
const DOU_LIMIT = 5;

function douDateKey(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || "").trim());
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function recentDouHits(hits, limit = DOU_LIMIT) {
  return [...(hits || [])]
    .map((hit, index) => ({ hit, index, key: douDateKey(hit.data) }))
    .sort((a, b) => (b.key > a.key ? 1 : b.key < a.key ? -1 : a.index - b.index))
    .slice(0, limit)
    .map((item) => item.hit);
}

function parseDouAct(html) {
  const source = String(html || "");
  const pick = (className) => {
    const match = new RegExp(`<[^>]+class="${className}"[^>]*>([\\s\\S]*?)</(?:span|p)>`).exec(source);
    return match ? stripHtml(match[1]) : null;
  };
  const start = source.indexOf('class="texto-dou"');
  const end = start >= 0 ? source.indexOf('class="informacao-conteudo-dou"', start) : -1;
  const body = start >= 0 ? source.slice(start, end > start ? end : undefined) : "";
  const paragraphs = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);
  const texto = paragraphs.join("\n");
  if (!texto) return null;
  return {
    orgao: pick("orgao-dou-data"),
    edicao: pick("edicao-dou-data"),
    identifica: paragraphs[0] || null,
    texto,
  };
}

function fallbackResumo(texto, term = "") {
  const flat = String(texto || "").replace(/\s+/g, " ").trim();
  if (!flat) return null;
  const folded = fold(flat);
  const needle = fold(term).split(/\s+/).filter(Boolean)[0] || "";
  const at = needle ? folded.indexOf(needle) : -1;
  let start = at > 120 ? at - 120 : 0;
  if (start > 0) {
    const space = flat.lastIndexOf(" ", start);
    start = space > 0 ? space + 1 : start;
  }
  let piece = flat.slice(start, start + 300);
  if (piece.length === 300) {
    const cut = piece.lastIndexOf(" ");
    piece = (cut > 200 ? piece.slice(0, cut) : piece) + "…";
  }
  return (start > 0 ? "… " : "") + piece;
}

async function fetchDouAct(url) {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(30000),
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`Ato respondeu HTTP ${response.status}.`);
  return parseDouAct(await response.text());
}

async function describeDouHit(hit, summarize, term) {
  let act = null;
  try {
    act = await fetchDouAct(hit.url);
  } catch (_error) {
    act = null;
  }
  const texto = act?.texto || hit.trecho;
  let resumo = null;
  if (typeof summarize === "function") {
    try {
      resumo = await summarize({ empresa: term, titulo: hit.titulo, orgao: act?.orgao || null, data: hit.data, texto });
    } catch (_error) {
      resumo = null;
    }
  }
  return {
    ...hit,
    orgao: act?.orgao || null,
    resumo: resumo || fallbackResumo(texto, term),
    texto_lido: Boolean(act),
  };
}

async function queryDou(razao, options = {}) {
  const term = holderTerm(razao);
  if (!term || term.length < 4) return { total: 0, linhas: [] };
  const url = `${DOU_SEARCH}?q=${encodeURIComponent(`"${term}"`)}&delta=8&sortType=0`;
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(40000),
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`Diário Oficial respondeu HTTP ${response.status}.`);
  const hits = parseDouHits(await response.text(), term);
  const recent = recentDouHits(hits, options.limit || DOU_LIMIT);
  let summarize = options.summarize;
  if (summarize === undefined) {
    try {
      summarize = require("../ai").summarizeOfficialAct;
    } catch (_error) {
      summarize = null;
    }
  }
  const linhas = [];
  for (const hit of recent) linhas.push(await describeDouHit(hit, summarize, razao));
  return { total: hits.length, linhas };
}

async function queryDiario(project) {
  if (!project?.municipio || !project?.uf) return { total: 0, linhas: [] };
  const term = holderTerm(project.empresa_nome) || holderTerm(project.nome);
  if (!term || term.length < 4) return { total: 0, linhas: [] };
  const territory = await territoryId(project.municipio, project.uf);
  if (!territory) return { total: 0, linhas: [] };
  const ask = async (query) => {
    const url = new URL(DIARIO_API);
    url.searchParams.set("territory_ids", territory);
    url.searchParams.set("querystring", query);
    url.searchParams.set("size", "5");
    url.searchParams.set("excerpt_size", "180");
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`Querido Diário respondeu HTTP ${response.status}.`);
    return response.json();
  };
  let payload = await ask(`"${term}"`);
  if (!payload.total_gazettes) payload = await ask(term);
  const found = diarioHits(payload);
  return { total: found.total, linhas: found.linhas.slice(0, 5) };
}

module.exports = {
  DOU_LIMIT,
  diarioHits,
  fallbackResumo,
  matchMunicipio,
  parseDouAct,
  parseDouHits,
  queryDiario,
  queryDou,
  recentDouHits,
};
