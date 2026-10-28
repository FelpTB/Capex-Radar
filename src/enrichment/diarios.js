const cheerio = require("cheerio");
const { holderTerm } = require("./sigmine");
const { fold, onlyDigits } = require("./resolve");

const USER_AGENT = "Mozilla/5.0 (compatible; RadarCapEx-MVP/0.1)";
const SIGPUB_BASE = "https://www.diariomunicipal.com.br";
const SIGPUB_DESDE = "2015-01-01";

// Diários das associações de municípios na plataforma SIGPub, por UF.
// Cada endereço reúne prefeituras, câmaras e consórcios associados, com busca desde 2009.
const SIGPUB_UF = {
  AL: ["ama"],
  AM: ["aam"],
  BA: ["bahia", "amurc"],
  CE: ["aprece"],
  GO: ["agm", "fgm"],
  MG: ["amm-mg"],
  MS: ["ms"],
  MT: ["amm-mt"],
  PA: ["famep"],
  PB: ["famup"],
  PE: ["amupe"],
  PI: ["appm"],
  PR: ["amp"],
  RJ: ["aemerj"],
  RN: ["femurn"],
  RO: ["arom"],
  RR: ["amr"],
  RS: ["famurs"],
  SE: ["sergipe"],
  SP: ["apm"],
};

// Ato que costuma marcar etapa de obra: licença, alvará, decreto, incentivo, audiência.
const ATO_RELEVANTE = [
  "licen", "alvara", "decreto", "utilidade publica", "incentiv", "isencao", "protocolo de intencoes",
  "audiencia publica", "eia", "rima", "ambiental", "urbanist", "habite", "doacao", "concessao de uso",
  "termo de compromisso", "lei ", "terreno", "empreendimento", "ampliacao", "implantacao",
  "outorga", "sumula", "supressao", "ajustamento de conduta", "tac ",
];
const COMPRA_PUBLICA = ["licitacao", "pregao", "registro de preco", "homologacao", "adjudicacao", "dispensa"];

function cnpjMask(cnpj) {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return null;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function cnpjRootMask(cnpj) {
  const digits = onlyDigits(cnpj);
  if (digits.length < 8) return null;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}`;
}

function brDateToIso(value) {
  const match = /(\d{2})\/(\d{2})\/(\d{4})/.exec(String(value || ""));
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function parseSigpubCards(html, slug) {
  const $ = cheerio.load(String(html || ""));
  const cards = [];
  $("li.materia-card").each((_index, element) => {
    const card = $(element);
    const link = card.find(".materia-card__titulo a").first();
    const href = link.attr("href") || "";
    const dados = {};
    card.find(".materia-card__dados > div").each((_i, item) => {
      dados[fold($(item).find("dt").text().trim())] = $(item).find("dd").text().replace(/\s+/g, " ").trim();
    });
    const codigo = dados["codigo identificador"] || href.split("/").pop() || null;
    if (!codigo) return;
    cards.push({
      codigo,
      associacao: slug,
      titulo: link.text().replace(/\s+/g, " ").trim(),
      entidade: card.find(".materia-card__entidade").text().trim() || null,
      orgao: card.find(".materia-card__orgao").text().trim() || null,
      trecho: card.find(".materia-card__trecho").text().replace(/\s+/g, " ").trim().slice(0, 300),
      data: brDateToIso(dados.circulacao),
      edicao: dados.edicao || null,
      url: href.startsWith("http") ? href : `${SIGPUB_BASE}${href}`,
    });
  });
  return cards;
}

function classifyAto(card) {
  const text = fold(`${card.titulo} ${card.orgao || ""} ${card.trecho}`);
  if (COMPRA_PUBLICA.some((word) => text.includes(word))) return "compra_publica";
  if (ATO_RELEVANTE.some((word) => text.includes(word))) return "ato_relevante";
  return "outro";
}

function citesCnpj(card, cnpjRoot) {
  const raw = `${card.titulo} ${card.trecho}`;
  return Boolean(cnpjRoot) && (raw.includes(cnpjRoot) || onlyDigits(raw).includes(cnpjRoot.replace(/\D/g, "")));
}

// A busca do SIGPub junta os termos com OU. O filtro exige o CNPJ ou todas as palavras do nome.
function mentionsCompany(card, { words, cnpjRoot }) {
  if (citesCnpj(card, cnpjRoot)) return true;
  const text = fold(`${card.titulo} ${card.trecho}`);
  return words.length > 0 && words.every((word) => text.includes(word));
}

const ORDEM_ATO = { ato_relevante: 0, outro: 1, compra_publica: 2 };

function rankSigpub(cards, { municipio, words, cnpjRoot }) {
  const local = fold(municipio || "");
  const seen = new Set();
  return cards
    .filter((card) => {
      if (seen.has(card.codigo)) return false;
      seen.add(card.codigo);
      return mentionsCompany(card, { words, cnpjRoot });
    })
    .map((card) => ({
      ...card,
      tipo_ato: classifyAto(card),
      no_municipio: Boolean(local) && fold(card.entidade || "").includes(local),
    }))
    // Marca de produto em compra de prefeitura (refrigerante Ambev, vergalhão Gerdau) cita só o nome.
    // Sem o CNPJ, a matéria só fica se for licença, decreto ou ato parecido.
    .filter((card) => citesCnpj(card, cnpjRoot) || card.tipo_ato === "ato_relevante")
    .sort((a, b) => (
      Number(b.no_municipio) - Number(a.no_municipio)
      || ORDEM_ATO[a.tipo_ato] - ORDEM_ATO[b.tipo_ato]
      || String(b.data || "").localeCompare(String(a.data || ""))
    ));
}

async function searchSigpub(slug, texto, { desde = SIGPUB_DESDE, ate = null } = {}) {
  const url = new URL(`${SIGPUB_BASE}/${slug}/pesquisar`);
  url.searchParams.set("busca_avancada[texto]", texto);
  url.searchParams.set("busca_avancada[dataInicio]", desde);
  url.searchParams.set("busca_avancada[dataFim]", ate || new Date().toISOString().slice(0, 10));
  url.searchParams.set("busca_avancada[pagina]", "1");
  url.searchParams.set("busca_avancada[Enviar]", "");
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(90000),
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`Diário ${slug} respondeu HTTP ${response.status}.`);
  return parseSigpubCards(await response.text(), slug);
}

async function querySigpub(project, cnpj, razaoSocial) {
  const slugs = SIGPUB_UF[project?.uf] || [];
  if (!slugs.length) return { total: 0, linhas: [] };
  const term = holderTerm(razaoSocial || project.empresa_nome);
  const cnpjRoot = cnpjRootMask(cnpj);
  const words = (term || "").split(" ").filter((word) => word.length >= 3);
  const textos = [cnpjMask(cnpj), cnpjRoot, term].filter((item) => item && item.length >= 4);
  if (!textos.length) return { total: 0, linhas: [] };
  const cards = [];
  for (const slug of slugs) {
    for (const texto of textos) cards.push(...await searchSigpub(slug, texto));
  }
  const ranked = rankSigpub(cards, { municipio: project.municipio, words, cnpjRoot })
    .map(({ associacao, codigo, ...card }) => card);
  return {
    total: ranked.length,
    no_municipio: ranked.filter((card) => card.no_municipio).length,
    linhas: ranked.slice(0, 5),
    candidatos: ranked,
  };
}

// Prefeituras com diário na plataforma Metaway (Mentor), pela UF e pelo nome do município sem acento.
const METAWAY_MUNICIPIOS = {
  "SP:lencois paulista": "https://lencois.mentor.metaway.com.br",
};
// Edições abertas por consulta. A busca não traz trecho; o texto sai do PDF.
const METAWAY_EDICOES = 6;
// Janela do PDF em volta da marca que a correlação lê para decidir se o ato é do projeto.
const METAWAY_CONTEXTO = 1200;

function metawayBase(project) {
  return METAWAY_MUNICIPIOS[`${project?.uf}:${fold(project?.municipio || "")}`] || null;
}

function snippetAround(text, words, size = 320) {
  const flat = String(text || "").replace(/\s+/g, " ");
  const folded = fold(flat);
  const at = words.map((word) => folded.indexOf(word)).filter((index) => index >= 0).sort((a, b) => a - b)[0];
  if (at === undefined) return null;
  // Começa pouco antes do termo: em lista corrida, o que vem antes é outro registro.
  const start = Math.max(0, at - Math.floor(size / 5));
  return `${start > 0 ? "… " : ""}${flat.slice(start, start + size).trim()}…`;
}

async function metawayText(base, codigo) {
  const { documentToMarkdown } = require("../documents/to-markdown");
  const detalhe = await fetch(`${base}/recurso/diario/editar/${codigo}`, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(30000),
  });
  if (!detalhe.ok) throw new Error(`Diário municipal respondeu HTTP ${detalhe.status}.`);
  const { srcPDF } = await detalhe.json();
  if (!srcPDF) return { url: null, texto: "" };
  const url = `${base}/${srcPDF}`;
  const pdf = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(60000) });
  if (!pdf.ok) return { url, texto: "" };
  return { url, texto: await documentToMarkdown(Buffer.from(await pdf.arrayBuffer()), { fileName: srcPDF }) };
}

async function queryMetaway(project, cnpj, razaoSocial) {
  const base = metawayBase(project);
  if (!base) return { total: 0, linhas: [] };
  const term = holderTerm(razaoSocial || project.empresa_nome);
  const words = (term || "").split(" ").filter((word) => word.length >= 3);
  // A busca da plataforma trata várias palavras como frase; a primeira palavra do nome é a marca.
  const texto = words[0];
  if (!texto || texto.length < 4) return { total: 0, linhas: [] };
  const url = new URL(`${base}/recurso/diario/lista`);
  url.searchParams.set("texto", texto);
  url.searchParams.set("dataInicial", SIGPUB_DESDE);
  url.searchParams.set("dataFinal", new Date().toISOString().slice(0, 10));
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Diário municipal respondeu HTTP ${response.status}.`);
  const edicoes = (await response.json())
    .sort((a, b) => String(b.dataPublicacao).localeCompare(String(a.dataPublicacao)));
  const linhas = [];
  for (const edicao of edicoes.slice(0, METAWAY_EDICOES)) {
    let lido = { url: null, texto: "" };
    try {
      lido = await metawayText(base, edicao.codigo);
    } catch {
      lido = { url: null, texto: "" };
    }
    const trecho = snippetAround(lido.texto, [fold(texto)]);
    const card = { titulo: `Edição ${edicao.edicao}`, orgao: "", trecho: trecho || "" };
    linhas.push({
      data: edicao.dataPublicacao || null,
      edicao: edicao.edicao ?? null,
      trecho,
      tipo_ato: trecho ? classifyAto(card) : null,
      url: lido.url || `${base}/diario/`,
      texto_lido: Boolean(lido.texto),
      // O diário é da prefeitura da ficha; o contexto decide se o ato é desta obra.
      no_municipio: true,
      contexto: snippetAround(lido.texto, [fold(texto)], METAWAY_CONTEXTO) || trecho,
    });
  }
  return { total: edicoes.length, linhas: linhas.map(({ contexto, ...linha }) => linha), candidatos: linhas };
}

module.exports = {
  METAWAY_MUNICIPIOS,
  SIGPUB_UF,
  metawayBase,
  queryMetaway,
  snippetAround,
  classifyAto,
  cnpjMask,
  cnpjRootMask,
  mentionsCompany,
  parseSigpubCards,
  querySigpub,
  rankSigpub,
};
