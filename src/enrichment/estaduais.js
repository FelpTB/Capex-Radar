const fs = require("fs");
const https = require("https");
const path = require("path");
const tls = require("tls");
const { holderTerm } = require("./sigmine");
const { fold, onlyDigits } = require("./resolve");
const { classifyAto, cnpjRootMask, snippetAround } = require("./diarios");

const USER_AGENT = "Mozilla/5.0 (compatible; RadarCapEx-MVP/0.1)";
const DOE_BA_BASE = "https://dool.egba.ba.gov.br";
const DIOE_PR_BASE = "https://www.dioe.pr.gov.br";
const DOE_SP_BUSCA = "https://do-api-web-search.doe.sp.gov.br/v2/advanced-search/publications";
const DOE_SP_BASE = "https://www.doe.sp.gov.br";
const JMG_API ="https://www.jornalminasgerais.mg.gov.br/api/v1";
const JMG_BASE = "https://www.jornalminasgerais.mg.gov.br";
const SEMAD_WFS = "https://geoserver.meioambiente.mg.gov.br/ows";
const SEMAD_CAMADA = "IDE:ide_2101_mg_empreendimentos_licenciados_pto";
const DESDE = "2015-01-01";
// Atos guardados por consulta. Os relevantes vêm antes dos demais.
const LIMITE = 8;
// Janela de texto em volta do CNPJ ou do nome que a correlação lê para decidir se o ato é do projeto.
const JANELA_CONTEXTO = 1200;

// Os servidores do DOE-BA e do Jornal Minas Gerais não mandam o certificado intermediário.
// A cadeia fica em certs/ e se soma às raízes do Node; a verificação continua ligada.
const CA = [
  ...tls.rootCertificates,
  ...fs.readdirSync(path.join(__dirname, "certs"))
    .filter((file) => file.endsWith(".pem"))
    .map((file) => fs.readFileSync(path.join(__dirname, "certs", file), "utf8")),
];

function request(url, { method = "GET", headers = {}, body = null, timeout = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method,
      ca: CA,
      headers: { "user-agent": USER_AGENT, accept: "application/json", ...headers },
      timeout,
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if (response.statusCode >= 400) {
          reject(new Error(`${new URL(url).host} respondeu HTTP ${response.statusCode}.`));
          return;
        }
        resolve(text);
      });
    });
    req.on("timeout", () => req.destroy(new Error(`${new URL(url).host} não respondeu a tempo.`)));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function requestJson(url, options) {
  return JSON.parse(await request(url, options));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function searchTerms(cnpj, razaoSocial) {
  const term = holderTerm(razaoSocial);
  return {
    cnpjRoot: cnpjRootMask(cnpj),
    term: term && term.length >= 4 ? term : null,
    words: (term || "").split(" ").filter((word) => word.length >= 3),
  };
}

// O texto dos diários traz o CNPJ com pontos, espaços ou sem separador.
function citesCompany(text, { cnpjRoot, words }) {
  const rootDigits = onlyDigits(cnpjRoot);
  if (rootDigits && onlyDigits(text).includes(rootDigits)) return true;
  const folded = fold(text);
  if (!words.length) return false;
  if (words.every((word) => folded.includes(word))) return true;
  // PDF com versalete parte as palavras ("P etrobras"); sem espaços e pontuação o nome volta inteiro.
  const compact = folded.replace(/[^a-z0-9]/g, "");
  return words.every((word) => compact.includes(word));
}

const ORDEM_ATO = { ato_relevante: 0, outro: 1, compra_publica: 2 };

// O ato que cita o município da ficha vem primeiro; depois licença e decreto, por data.
function rankAtos(atos, municipio) {
  const local = fold(municipio || "");
  const seen = new Set();
  return atos
    .filter((ato) => {
      if (seen.has(ato.chave)) return false;
      seen.add(ato.chave);
      return true;
    })
    .map(({ chave, ...ato }) => ({
      ...ato,
      tipo_ato: classifyAto({ titulo: "", orgao: "", trecho: ato.trecho }),
      no_municipio: Boolean(local) && fold(ato.trecho).includes(local),
    }))
    .sort((a, b) => (
      Number(b.no_municipio) - Number(a.no_municipio)
      || ORDEM_ATO[a.tipo_ato] - ORDEM_ATO[b.tipo_ato]
      || String(b.data || "").localeCompare(String(a.data || ""))
    ));
}

// Vários estados usam o mesmo motor de busca (IONEWS): Elasticsearch atrás de /busca/busca/buscar/query.
// Cada resultado é uma página do diário; o destaque traz a frase com o termo.
// Onde o PDF da página pede login (BA, SE), o link abre o visualizador ver-flip.
const ionewsFlip = (base) => ({
  busca: `${base}/busca/busca/buscar/query`,
  link: (source, query) => `${base}/ver-flip/${source.diario_id}/#/e:${source.diario_id}/p:${source.pagina}?find=${encodeURIComponent(query)}`,
});
const ionewsPdf = (base) => ({
  busca: `${base}/busca/busca/buscar/query`,
  link: (source) => `${base}/portal/edicoes/download/${source.diario_id}/${source.pagina}`,
});

const DOOL = {
  "CAPTURA-DOE-BA": ionewsFlip(DOE_BA_BASE),
  "CAPTURA-DOE-PR": ionewsPdf(DIOE_PR_BASE),
  "CAPTURA-DOE-SE": ionewsFlip("https://iose.se.gov.br"),
  "CAPTURA-DOE-GO": ionewsPdf("https://diariooficial.abc.go.gov.br"),
  "CAPTURA-DOE-MT": ionewsPdf("https://www.iomat.mt.gov.br"),
  "CAPTURA-DOE-ES": ionewsPdf("https://ioes.dio.es.gov.br"),
  "CAPTURA-DOE-AP": ionewsPdf("https://diofe.portal.ap.gov.br"),
};

// O destaque das portarias do INEMA começa por um preâmbulo longo; o CNPJ vem depois.
// O filtro lê o destaque inteiro e o trecho guardado começa no CNPJ ou no nome.
function doolHits(payload, query, link, terms = {}) {
  const needles = [fold(terms.cnpjRoot || ""), ...(terms.words || [])].filter(Boolean);
  return (payload?.hits?.hits || []).map((hit) => {
    const source = hit._source || {};
    const texto = stripHtml((hit.highlight?.conteudo || []).join(" … ")) || stripHtml(source.conteudo);
    const trecho = (needles.length && snippetAround(texto, needles, 400)) || texto.slice(0, 400);
    return {
      chave: hit._id,
      data: source.data || null,
      pagina: source.pagina || null,
      texto,
      trecho,
      url: link(source, query),
    };
  });
}

async function queryDool(codigo, project, cnpj, razaoSocial) {
  const spec = DOOL[codigo];
  const terms = searchTerms(cnpj, razaoSocial);
  const queries = [terms.cnpjRoot, terms.term].filter(Boolean).map((item) => `"${item}"`);
  if (!queries.length) return { total: 0, linhas: [] };
  const hits = [];
  for (const query of queries) {
    for (const pagina of [0, 1]) {
      const url = `${spec.busca}/${pagina}/di:${DESDE}/df:${today()}/?1=1&q=${encodeURIComponent(query)}`;
      const found = doolHits(await requestJson(url), query, spec.link, terms);
      hits.push(...found);
      if (found.length < 10) break;
    }
  }
  return rankedResult(hits, terms, project);
}

// Termos em Terms[i] são combinados com OU; o filtro de citesCompany faz o E.
async function queryDoeSp(project, cnpj, razaoSocial) {
  const terms = searchTerms(cnpj, razaoSocial);
  const textos = [terms.cnpjRoot, terms.term].filter(Boolean);
  if (!textos.length) return { total: 0, linhas: [] };
  const hits = [];
  for (const texto of textos) {
    const url = new URL(DOE_SP_BUSCA);
    url.searchParams.set("Terms[0]", texto);
    url.searchParams.set("FromDate", DESDE);
    url.searchParams.set("ToDate", today());
    url.searchParams.set("PageNumber", "1");
    url.searchParams.set("PageSize", "100");
    url.searchParams.set("SortField", "Date");
    const payload = await requestJson(url.toString());
    for (const item of payload?.items || []) {
      // As listas mensais da CETESB são longas; o trecho fica em volta do CNPJ ou do nome.
      const excerpt = stripHtml(item.excerpt);
      const around = snippetAround(excerpt, [fold(terms.cnpjRoot || ""), ...terms.words].filter(Boolean));
      hits.push({
        chave: item.id,
        texto: `${item.title || ""} — ${excerpt}`,
        data: String(item.date || "").slice(0, 10) || null,
        titulo: item.title || null,
        orgao: item.hierarchy || null,
        trecho: `${item.title || ""} — ${around || excerpt}`.slice(0, 400),
        url: `${DOE_SP_BASE}/${item.slug}`,
      });
    }
  }
  return rankedResult(hits, terms, project);
}

// candidatos leva todos os atos, com o contexto largo, para a correlação com o projeto.
// linhas é o recorte sem filtro de contexto, mantido para quem chama a busca direto.
// Conector que só traz o texto (sem trecho pronto) ganha o trecho recortado aqui.
function rankedResult(hits, terms, project) {
  const needles = [fold(terms.cnpjRoot || ""), ...terms.words].filter(Boolean);
  const cited = hits.filter((hit) => citesCompany(hit.texto || hit.trecho, terms));
  const ranked = rankAtos(cited.map(({ texto, ...hit }) => {
    const trecho = hit.trecho || (texto && (snippetAround(texto, needles, 400) || texto.slice(0, 400))) || "";
    return {
      ...hit,
      trecho,
      contexto: (texto && snippetAround(texto, needles, JANELA_CONTEXTO)) || trecho,
    };
  }), project?.municipio);
  return {
    total: ranked.length,
    no_municipio: ranked.filter((ato) => ato.no_municipio).length,
    linhas: ranked.slice(0, LIMITE).map(({ contexto, ...ato }) => ato),
    candidatos: ranked,
  };
}

async function jmgToken() {
  const payload = await requestJson(`${JMG_API}/Autenticacao/Autenticar`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  if (typeof payload?.dados !== "string") throw new Error("Jornal Minas Gerais não devolveu token.");
  return payload.dados;
}

function jmgLink(item, texto) {
  const dados = {
    dataPublicacaoSelecionada: item.dataPublicacao,
    idCadernoEdicaoSelecionado: item.idJornal,
    paginaSelecionada: item.pagina,
    textoPesquisa: texto,
  };
  return `${JMG_BASE}/edicao-do-dia?dados=${encodeURIComponent(JSON.stringify(dados))}`;
}

async function queryJornalMg(project, cnpj, razaoSocial) {
  const terms = searchTerms(cnpj, razaoSocial);
  const textos = [terms.cnpjRoot, terms.term].filter(Boolean);
  if (!textos.length) return { total: 0, linhas: [] };
  const token = await jmgToken();
  const hits = [];
  for (const texto of textos) {
    const params = new URLSearchParams({
      DataPublicacaoInicial: DESDE,
      DataPublicacaoFinal: today(),
      TextoPesquisa: texto,
      DiarioExecutivo: "true",
      DiarioMunicipios: "true",
      DiarioTerceiros: "true",
      EdicaoExtra: "true",
      PaginaAtual: "1",
      TamanhoPagina: "40",
    });
    const payload = await requestJson(`${JMG_API}/Pesquisa/PesquisarJornaisPaginados?${params}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    for (const item of payload?.dados || []) {
      const trecho = String(item.textoResultado || "").replace(/\s+/g, " ").trim();
      hits.push({
        chave: `${item.idJornal}:${item.pagina}:${trecho.slice(0, 60)}`,
        data: String(item.dataPublicacao || "").slice(0, 10) || null,
        caderno: item.tipoCaderno || null,
        pagina: item.pagina || null,
        trecho,
        url: jmgLink(item, texto),
      });
    }
  }
  return rankedResult(hits, terms, project);
}

function brDateToIso(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || "").trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function semadFilter(razaoSocial) {
  const words = holderTerm(razaoSocial).split(" ").filter((word) => word.length >= 3).slice(0, 2);
  if (!words.length) return null;
  // Aspas simples saem do termo para não quebrar o CQL.
  return `nome_pf_pj ILIKE '%${words.join("%").replace(/'/g, "")}%'`;
}

// O campo cpf_cnpj vem com os últimos dígitos zerados em parte das linhas; a busca é pelo nome.
async function querySemad(project, razaoSocial) {
  const filter = semadFilter(razaoSocial);
  if (!filter) return { total: 0, linhas: [] };
  const url = new URL(SEMAD_WFS);
  url.searchParams.set("service", "WFS");
  url.searchParams.set("version", "2.0.0");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("outputFormat", "application/json");
  url.searchParams.set("typeNames", SEMAD_CAMADA);
  url.searchParams.set("CQL_FILTER", filter);
  url.searchParams.set("count", "500");
  const payload = await requestJson(url.toString());
  const local = fold(project?.municipio || "");
  const linhas = (payload.features || [])
    .map(({ properties: item }) => ({
      processo: item.n_processo || null,
      municipio: item.mun_solic || null,
      titular: item.nome_pf_pj || null,
      solicitacao: item.tipo_solic || null,
      atividade: [item.cod_atvpri, item.des_atvpri].filter(Boolean).join(" — ") || null,
      classe: item.classe ?? null,
      modalidade: item.modl_licen || null,
      fase: item.fase_licen || null,
      status: item.status_pro || null,
      emissao: brDateToIso(item.data_emiss),
      validade: brDateToIso(item.data_val),
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      url: item.link || null,
      no_municipio: Boolean(local) && fold(item.mun_solic || "") === local,
    }))
    .sort((a, b) => (
      Number(b.no_municipio) - Number(a.no_municipio)
      || String(b.emissao || "").localeCompare(String(a.emissao || ""))
    ));
  return {
    total: linhas.length,
    no_municipio: linhas.filter((item) => item.no_municipio).length,
    linhas: linhas.slice(0, LIMITE),
    candidatos: linhas,
  };
}

module.exports = {
  CA,
  DESDE,
  DOOL,
  JANELA_CONTEXTO,
  brDateToIso,
  citesCompany,
  doolHits,
  rankedResult,
  request,
  requestJson,
  searchTerms,
  stripHtml,
  today,
  jmgLink,
  queryDool,
  queryDoeSp,
  queryJornalMg,
  querySemad,
  rankAtos,
  semadFilter,
};
