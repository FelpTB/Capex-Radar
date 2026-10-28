const cheerio = require("cheerio");
const { fold, onlyDigits } = require("./resolve");
const { DESDE, brDateToIso, rankedResult, searchTerms, stripHtml, today } = require("./estaduais");
const { DOE_PDF_CONECTORES } = require("./doe-pdf");

// Diários oficiais estaduais com busca própria (fora do motor IONEWS de estaduais.js).
// Cada parser recebe a resposta bruta e devolve atos no formato de rankedResult:
// { chave, data, pagina, titulo, orgao, caderno, texto ou trecho, url }.
// A pesquisa de cada portal está documentada em src/doe-registry.js e nas amostras.

const USER_AGENT = "Mozilla/5.0 (compatible; RadarCapEx-MVP/0.1)";

async function http(url, { method = "GET", headers = {}, body = null, timeout = 60000, encoding = "utf8", aceita = [] } = {}) {
  const response = await fetch(url, {
    method,
    headers: { "user-agent": USER_AGENT, ...headers },
    body,
    signal: AbortSignal.timeout(timeout),
    redirect: "follow",
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!response.ok && !aceita.includes(response.status)) {
    throw new Error(`${new URL(url).host} respondeu HTTP ${response.status}.`);
  }
  return { status: response.status, headers: response.headers, buffer, text: buffer.toString(encoding) };
}

async function httpJson(url, options) {
  return JSON.parse((await http(url, options)).text);
}

function form(fields) {
  return new URLSearchParams(fields).toString();
}

// Portais legados em ISO-8859-1 querem o termo codificado em latin1.
function latin1Param(value) {
  return [...String(value)].map((char) => {
    if (/[A-Za-z0-9\-_.~]/.test(char)) return char;
    const code = char.charCodeAt(0);
    return code < 256 ? `%${code.toString(16).toUpperCase().padStart(2, "0")}` : encodeURIComponent(char);
  }).join("");
}

function termTexts(terms) {
  return [terms.cnpjRoot, terms.term].filter(Boolean);
}

function isoToBr(iso) {
  return String(iso).split("-").reverse().join("/");
}

function isoDate(value) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : brDateToIso(text.replace(/-/g, "/"));
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

// O texto do diário traz o CNPJ com pontos, espaços ou sem separador.
function pageCites(text, terms) {
  const root = onlyDigits(terms.cnpjRoot);
  if (root && onlyDigits(text).includes(root)) return true;
  const folded = fold(text);
  return terms.words.length > 0 && terms.words.every((word) => folded.includes(word));
}

async function collect(terms, project, search) {
  const hits = [];
  for (const texto of termTexts(terms)) hits.push(...await search(texto));
  return rankedResult(hits, terms, project);
}

// ---------- AM: API multidiarios, um item por matéria ----------
const AM_BASE = "https://diario.imprensaoficial.am.gov.br";

function amHits(payload) {
  return (payload?.data?.resultados || []).map((item) => ({
    chave: item.id,
    data: item.publicado_em || null,
    pagina: item.edicao_pagina ?? null,
    titulo: item.materia_titulo || null,
    orgao: String(item.materia_categoria || "").replace(/^;/, "").replace(/;/g, " > ") || null,
    texto: stripHtml(item.highlight),
    url: `${AM_BASE}/portal/edicoes/download/${item.edicao_id}/${item.edicao_pagina}`,
  }));
}

async function queryAm(project, cnpj, razaoSocial) {
  const desde = DESDE.split("-").reverse().join("-");
  const ate = today().split("-").reverse().join("-");
  return collect(searchTerms(cnpj, razaoSocial), project, async (texto) => {
    const hits = [];
    for (const page of [1, 2, 3]) {
      const url = new URL(`${AM_BASE}/apibusca/multidiarios/busca`);
      url.search = form({ page, q: texto, exata: 1, data_init: desde, data_end: ate });
      const found = amHits(await httpJson(url.toString()));
      hits.push(...found);
      if (found.length < 10) break;
    }
    return hits;
  });
}

// ---------- DF: DODF, um item por matéria ----------
const DF_BASE = "https://dodf.df.gov.br";

function dfHits(payload) {
  return (payload?.listaMaterias || []).map((item) => ({
    chave: item.co_materia,
    data: String(item.dt_previsao_publicacao || "").slice(0, 10) || null,
    titulo: item.ds_titulo || null,
    orgao: item.ds_nome || null,
    caderno: item.ds_secao || null,
    texto: stripHtml(item.tx_resumo),
    url: `${DF_BASE}/dodf/materia/visualizar?co_data=${item.co_materia}&p=${encodeURIComponent(item.slug || "")}`,
  }));
}

async function queryDf(project, cnpj, razaoSocial) {
  return collect(searchTerms(cnpj, razaoSocial), project, async (texto) => {
    const hits = [];
    for (const pagina of [1, 2, 3]) {
      const payload = await httpJson(`${DF_BASE}/dodf/materia/listar`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form({ termo: texto, dtInicial: DESDE, dtFinal: today(), tpBusca: "exata", pagina }),
      });
      const found = dfHits(payload);
      hits.push(...found);
      if (found.length < 10) break;
    }
    return hits;
  });
}

// ---------- MS: um item por página de edição ----------
const MS_API = "https://www.diariooficial.ms.gov.br/api/diarios/busca-diarios";

function msHits(payload) {
  return (payload?.paginasDiario || []).map((item) => ({
    chave: `${item.nomeArquivo}:${item.pagina}`,
    data: String(item.dataPublicacao || "").slice(0, 10) || null,
    pagina: item.pagina ?? null,
    titulo: item.descricao || null,
    texto: stripHtml((item.hiHighlight?.texto || []).join(" … ")),
    url: `${item.caminhoArquivo}#page=${item.pagina}`,
  }));
}

async function queryMs(project, cnpj, razaoSocial) {
  return collect(searchTerms(cnpj, razaoSocial), project, async (texto) => {
    const url = new URL(MS_API);
    url.search = form({ tipo: 1, texto, dataInicial: DESDE, dataFinal: today(), pagina: 1, registrosPorPagina: 100 });
    // Busca sem resultado volta HTTP 400 com "Nenhum resultado encontrado."
    const response = await http(url.toString(), { aceita: [400] });
    return response.status === 400 ? [] : msHits(JSON.parse(response.text));
  });
}

// ---------- PE e RN: plataforma SDOE, um item por matéria ----------
const PE_BASE = "https://diariooficial.cepe.com.br";
const RN_BASE = "https://deirn.sdoe.com.br";

function sdoeHits(payload, base) {
  return (payload?.list || []).map((item) => ({
    chave: item.codigo,
    data: item.dataPublicacao || null,
    orgao: item.nomeCategoria || null,
    titulo: cleanText(stripHtml(item.resumo)).slice(0, 140) || null,
    // O resumo diz que ato é; os fragmentos mostram onde a empresa aparece.
    texto: `${stripHtml(item.resumo)} … ${stripHtml(item.texto)}`,
    url: `${base}/diariooficialweb/#/visualizar-publicacao?publicacao=${Buffer.from(String(item.codigo)).toString("base64")}`,
  }));
}

const peHits = (payload) => sdoeHits(payload, PE_BASE);
const rnHits = (payload) => sdoeHits(payload, RN_BASE);

function querySdoe(base, codigoDiario) {
  return async (project, cnpj, razaoSocial) => {
    const periodo = `${isoToBr(DESDE)}-${isoToBr(today())}`;
    return collect(searchTerms(cnpj, razaoSocial), project, async (texto) => {
      const payload = await httpJson(`${base}/diariooficial/public/search`, {
        method: "POST",
        // Sem o Referer do portal a API responde 403 referer_mismatch.
        headers: { "content-type": "application/json", referer: `${base}/diariooficialweb/` },
        body: JSON.stringify({
          first: 0,
          maxResults: 200,
          palavras: texto,
          dataInicial: isoToBr(DESDE),
          dataFinal: isoToBr(today()),
          intervaloAno: periodo,
          codigoDiario,
        }),
      });
      return sdoeHits(payload, base);
    });
  };
}

const queryPe = querySdoe(PE_BASE, "1");
const queryRn = querySdoe(RN_BASE, "121");

// ---------- AL: API sobre Elasticsearch, um item por página ----------
const AL_BASE = "https://diario.imprensaoficial.al.gov.br";

function alHits(payload) {
  return (payload?.result?.items || []).map((item) => {
    const data = String(item.publication_date || "").slice(0, 10) || null;
    const texto = stripHtml((item.highlight || []).join(" … ").replace(/\\\//g, "/"));
    return {
      // A mesma página volta com edition_id diferentes; data, página e trecho tiram a repetição.
      chave: `${data}:${item.page_number}:${texto.slice(0, 60)}`,
      data,
      pagina: item.page_number ?? null,
      titulo: `${item.edition_type_name || "Diário Oficial"} nº ${item.edition_number}`,
      texto,
      url: `${AL_BASE}/apinova/api/editions/viewPdf/${item.edition_id}#page=${item.page_number}`,
    };
  });
}

async function queryAl(project, cnpj, razaoSocial) {
  return collect(searchTerms(cnpj, razaoSocial), project, async (texto) => {
    const hits = [];
    for (const page of [1, 2, 3, 4]) {
      const payload = await httpJson(`${AL_BASE}/apinova/api/editions/searchES?page=${page}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keywords: texto, range: [DESDE, today()], edition_number: "", searchType: "frase_exata", order: "novo" }),
      });
      const found = alHits(payload);
      hits.push(...found);
      if (found.length < 15) break;
    }
    return hits;
  });
}

// ---------- SC: um item por matéria, com texto integral ----------
const SC_BASE = "https://portal.doe.sea.sc.gov.br";

function scHits(payload) {
  if (payload?.error) return [];
  return (payload?.materias || []).map((item) => ({
    chave: item.id,
    data: String(item.publicacao || "").slice(0, 10) || null,
    titulo: item.assunto || null,
    orgao: item.categoria || null,
    texto: stripHtml(item.resumo),
    // A versão _final do HTML redireciona; a sem sufixo abre direto.
    url: String(item.preview || "").replace(/_final\.html$/, ".html") || item.extrato || SC_BASE,
  }));
}

async function querySc(project, cnpj, razaoSocial) {
  return collect(searchTerms(cnpj, razaoSocial), project, async (texto) => {
    const response = await http(`${SC_BASE}/apis/busca-materia`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ busca: texto, dtIni: DESDE, dtFim: today(), tipoBusca: 2, pagination: { from: 0, size: 200 }, resumo: false }),
      aceita: [400, 404],
    });
    return scHits(JSON.parse(response.text || "{}"));
  });
}

// ---------- RS: DOE e Diário da Indústria e Comércio ----------
const RS_API = "https://doe-backend.pro.rs.gov.br/public/materias/";
const RS_SITE = "https://www.diariooficial.rs.gov.br";

function rsHits(payload, tipoDiario) {
  const caderno = tipoDiario === "doe" ? "DOE" : "DIC";
  return (payload?.collection || []).map((item) => ({
    chave: item.id ? `${caderno}:${item.id}` : `${caderno}:${item.data}:${item.nroPagina}`,
    data: isoDate(item.data),
    pagina: item.nroPagina ?? null,
    caderno,
    titulo: item.tipoMateria || item.textoLink || null,
    texto: stripHtml(item.texto),
    url: item.id
      ? `${RS_SITE}/materia?id=${item.id}`
      : `${RS_SITE}/diario?td=${item.tipoDiario || caderno}&dt=${item.dataUrl}&pg=${item.nroPagina}`,
  }));
}

async function queryRs(project, cnpj, razaoSocial) {
  return collect(searchTerms(cnpj, razaoSocial), project, async (texto) => {
    const hits = [];
    // As licenças da FEPAM saem no DIC, não no DOE.
    for (const tipoDiario of ["doe", "dic"]) {
      for (const page of [1, 2, 3]) {
        const url = new URL(RS_API);
        // Palavras soltas fazem frase; aspas viram OU nesta API.
        url.search = form({ page, tipoDiario, queryString: texto, dataIni: DESDE, dataFim: today() });
        const found = rsHits(await httpJson(url.toString()), tipoDiario);
        hits.push(...found);
        if (found.length < 10) break;
      }
    }
    return hits;
  });
}

// ---------- RJ: IOERJ, HTML com até 100 matérias ----------
const RJ_BASE = "https://www.ioerj.com.br";

function rjHits(html) {
  const $ = cheerio.load(String(html || ""));
  const hits = [];
  $('a[href*="view_publicacao.php"]').each((_index, element) => {
    const anchor = $(element);
    const row = anchor.closest("tr");
    const head = cleanText(row.find("span.style2").text());
    const match = /(\d{2}\/\d{2}\/\d{4})\s+p[áa]gina\s+(\d+)\s*-\s*Mat[ée]ria Id:\s*(\d+)/i.exec(head);
    const meta = row.next();
    const info = cleanText(meta.text());
    const texto = cleanText(meta.next().find("td.style4").text());
    hits.push({
      chave: match?.[3] || anchor.attr("href"),
      data: match ? brDateToIso(match[1]) : null,
      pagina: match ? Number(match[2]) : null,
      caderno: /Jornal:\s*(.*?)\s*(?:Tipo:|$)/.exec(info)?.[1] || null,
      titulo: /Tipo:\s*(.*)$/.exec(info)?.[1] || null,
      texto,
      // O link carrega a assinatura s que só a busca devolve.
      url: new URL(anchor.attr("href"), RJ_BASE).toString(),
    });
  });
  return hits;
}

async function queryRj(project, cnpj, razaoSocial) {
  return collect(searchTerms(cnpj, razaoSocial), project, async (texto) => {
    const response = await http(`${RJ_BASE}/portal/modules/conteudoonline/busca_do.php?acao=busca`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form({
        textobusca: `"${texto}"`,
        "busca[jornal]": "",
        "datapublicacao[dia]": "",
        "datapublicacao[mes]": "",
        "datapublicacao[ano]": "",
        tipobusca: "texto",
        buscaordem: "datapublicacao desc",
        buscar: "Buscar",
      }),
    });
    return rjHits(response.text).filter((hit) => !hit.data || hit.data >= DESDE);
  });
}

// ---------- MA: cards em HTML dentro do JSON ----------
const MA_BASE = "https://diariooficial.ma.gov.br";

function maHits(payload) {
  const $ = cheerio.load(String(payload?.busca?.es_html || ""));
  const hits = [];
  $("div.card").each((_index, element) => {
    const card = $(element);
    const html = $.html(card);
    const data = brDateToIso(/(\d{2}\/\d{2}\/\d{4})/.exec(card.find("#dataPub").text())?.[1]);
    const pagina = Number(/P[áa]gina:\s*<\/strong>\s*(\d+)|P[áa]gina:\s*(\d+)/i.exec(cheerio.load(html).text())?.slice(1).find(Boolean)) || null;
    const codigo = /setModal\(\s*'[^']*'\s*,\s*'[^']*'\s*,\s*'([^']+)'/.exec(html)?.[1] || null;
    const texto = cleanText(card.find("p.card-text").first().text());
    if (!texto) return;
    hits.push({
      chave: `${codigo}:${pagina}:${texto.slice(0, 60)}`,
      data,
      pagina,
      caderno: cleanText(card.find("strong").first().text()) || null,
      texto,
      url: codigo ? `${MA_BASE}/download.php?arq=${codigo}${pagina ? `#page=${pagina}` : ""}` : MA_BASE,
    });
  });
  return hits;
}

async function queryMa(project, cnpj, razaoSocial) {
  return collect(searchTerms(cnpj, razaoSocial), project, async (texto) => {
    const url = new URL(`${MA_BASE}/ajax.busca.php`);
    // Várias palavras já viram frase; a primeira resposta traz cerca de 100 páginas, as mais recentes.
    url.search = form({ termo: texto, datai: DESDE, dataf: today(), caderno: "" });
    return maHits(await httpJson(url.toString()));
  });
}

// ---------- AC: HTML em latin1, um ano por consulta ----------
const AC_BASE = "https://diario.ac.gov.br/";
const AC_ANOS = 4;

function acHits(html) {
  const $ = cheerio.load(String(html || ""));
  const hits = [];
  $('tr[id^="trId1_"]').each((_index, element) => {
    const row = $(element);
    const id = row.attr("id").replace("trId1_", "");
    const link = row.find("a").first();
    hits.push({
      chave: id,
      data: brDateToIso(cleanText(row.find("td").first().text())),
      titulo: cleanText(link.text()) || null,
      trecho: cleanText($(`#trId2_${id}`).text()).slice(0, 400),
      texto: cleanText($(`#trId2_${id}`).text()),
      url: link.attr("href") || AC_BASE,
    });
  });
  return hits;
}

async function queryAc(project, cnpj, razaoSocial) {
  const ano = Number(today().slice(0, 4));
  return collect(searchTerms(cnpj, razaoSocial), project, async (texto) => {
    const hits = [];
    for (let year = ano; year > ano - AC_ANOS; year -= 1) {
      const response = await http(AC_BASE, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `palavra=${latin1Param(texto)}&ano_palavra=${year}&paginaIni=0&palavraTipo=0`,
        encoding: "latin1",
      });
      hits.push(...acHits(response.text));
    }
    return hits;
  });
}

// ---------- TO: lista de edições; o texto sai do PDF ----------
const TO_BASE = "https://diariooficial.to.gov.br";
const TO_EDICOES = 3;

function toEditions(html) {
  const $ = cheerio.load(String(html || ""));
  const editions = [];
  $("section.search-results tbody tr").each((_index, element) => {
    const cells = $(element).find("td");
    const url = $(element).find("a").attr("href");
    if (!url) return;
    editions.push({
      numero: cleanText(cells.eq(0).text()).replace(/^N[ºo°]\s*/i, ""),
      data: brDateToIso(cleanText(cells.eq(1).text())),
      paginas: Number(cleanText(cells.eq(2).text()).replace(/\D/g, "")) || null,
      url,
    });
  });
  return editions;
}

async function queryTo(project, cnpj, razaoSocial) {
  const { pdfPages } = require("../documents/to-markdown");
  const terms = searchTerms(cnpj, razaoSocial);
  const editions = new Map();
  for (const texto of termTexts(terms)) {
    const url = new URL(`${TO_BASE}/busca`);
    url.search = form({ por: "texto", texto, "data-inicial": DESDE, "data-final": today() });
    const response = await http(url.toString(), { timeout: 90000 });
    for (const edition of toEditions(response.text)) editions.set(edition.url, edition);
  }
  const recent = [...editions.values()].sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, TO_EDICOES);
  const hits = [];
  for (const edition of recent) {
    let pages = [];
    try {
      const pdf = await http(edition.url, { timeout: 90000 });
      pages = await pdfPages(pdf.buffer, { match: (text) => pageCites(text, terms) });
    } catch {
      pages = [];
    }
    for (const page of pages.slice(0, 3)) {
      hits.push({
        chave: `${edition.url}:${page.pagina}`,
        data: edition.data,
        pagina: page.pagina,
        titulo: `Edição nº ${edition.numero}`,
        texto: page.texto,
        url: `${edition.url}#page=${page.pagina}`,
      });
    }
  }
  return rankedResult(hits, terms, project);
}

// ---------- CE: lista de páginas (HTTP, sessão); o texto sai do PDF ----------
const CE_BUSCA = "http://pesquisa.doe.seplag.ce.gov.br/doepesquisa";
const CE_PAGINAS = 6;

function ceRows(html) {
  const $ = cheerio.load(String(html || ""));
  const rows = [];
  $('a[href*="imagens.seplag.ce.gov.br"]').each((_index, element) => {
    const anchor = $(element);
    const cells = anchor.closest("tr").find("td");
    const href = anchor.attr("href");
    rows.push({
      data: brDateToIso(cleanText(anchor.text()).replace(/-/g, "/")),
      diario: cleanText(cells.eq(1).text()) || null,
      caderno: cleanText(cells.eq(2).text()) || null,
      pagina: Number(cleanText(cells.eq(3).text())) || Number(/#page=(\d+)/.exec(href)?.[1]) || null,
      // O servidor de imagens só responde em HTTPS na pasta /PDF/.
      pdf: href.replace(/^http:/, "https:").replace("/pdf/", "/PDF/").replace(/#.*$/, ""),
    });
  });
  return rows;
}

function cePages(html) {
  const match = /P[áa]gina\s+\d+\s+de\s+(\d+)/i.exec(String(html || ""));
  return match ? Number(match[1]) : 1;
}

async function ceSearch(texto) {
  const query = [
    "page=pesquisaTextual", "action=PesquisarTextual", "cmd=11", "flag=1",
    `dataini=${latin1Param(isoToBr(DESDE))}`, `datafim=${latin1Param(isoToBr(today()))}`,
    "RadioGroup1=radio3", `pesqEx=${latin1Param(texto)}`, "numDiario=", "numCaderno=", "numPagina=",
  ].join("&");
  const first = await http(`${CE_BUSCA}/sead.to?${query}`, { encoding: "latin1", timeout: 90000 });
  const rows = ceRows(first.text);
  const total = cePages(first.text);
  // O resultado vem do mais antigo para o mais novo e a paginação fica na sessão.
  const cookie = (first.headers.get("set-cookie") || "").split(";")[0];
  if (total > 1 && cookie) {
    const nav = (cmd) => http(`${CE_BUSCA}/sead.do?page=pesquisaTextual&cmd=${cmd}&action=NavegarBasico&flag=1`, {
      headers: { cookie }, encoding: "latin1", timeout: 90000,
    });
    rows.push(...ceRows((await nav("ultimo")).text));
    if (total > 2) rows.push(...ceRows((await nav("anterior")).text));
  }
  return rows;
}

async function queryCe(project, cnpj, razaoSocial) {
  const { pdfPages } = require("../documents/to-markdown");
  const terms = searchTerms(cnpj, razaoSocial);
  const rows = new Map();
  for (const texto of termTexts(terms)) {
    for (const row of await ceSearch(texto)) rows.set(`${row.pdf}:${row.pagina}`, row);
  }
  const recent = [...rows.values()].sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, CE_PAGINAS);
  const pdfs = new Map();
  const hits = [];
  for (const row of recent) {
    let texto = "";
    try {
      if (!pdfs.has(row.pdf)) pdfs.set(row.pdf, (await http(row.pdf, { timeout: 90000 })).buffer);
      texto = (await pdfPages(pdfs.get(row.pdf), { pages: [row.pagina] }))[0]?.texto || "";
    } catch {
      texto = "";
    }
    hits.push({
      chave: `${row.pdf}:${row.pagina}`,
      data: row.data,
      pagina: row.pagina,
      titulo: `Diário ${row.diario || "—"}, caderno ${row.caderno || "—"}`,
      texto,
      url: `${row.pdf}#page=${row.pagina}`,
    });
  }
  return rankedResult(hits, terms, project);
}

// ---------- PI: só nome; o texto do ato vem de uma segunda chamada ----------
const PI_BASE = "https://www.diario.pi.gov.br/doe";
const PI_NOTAS = 10;

function piResults(payload, words) {
  return (payload?.resposta || [])
    // A busca junta as palavras com OU; ficam as notas com todas as palavras do nome.
    .filter((item) => words.every((word) => fold(item.acertos || "").includes(word)))
    .map((item) => {
      const match = /^(\d+)\s+de\s+(\d{2}\/\d{2}\/\d{4})(?:,\s*em\s*(.*))?$/.exec(cleanText(item.dadosDiario));
      return {
        nota: item.nota,
        edicao: match?.[1] || null,
        data: match ? brDateToIso(match[2]) : null,
        secao: stripHtml(match?.[3] || "").replace(/^"|"$/g, "") || null,
        url: `${PI_BASE}/files/diarios/anexo/${encodeURI(item.anexodiario || "")}`,
      };
    });
}

// A nota traz nome e CPF de quem publicou; só título, órgão, dia e texto saem daqui.
// O texto vem em HTML com entidades (&Ecirc;, &nbsp;); o cheerio decodifica.
function piNote(payload) {
  const nota = payload?.nota || {};
  return {
    data: nota.dia || null,
    titulo: nota.titulo_nota?.texto || null,
    orgao: nota.orgao?.nome || nota.unidade?.nome || null,
    texto: cleanText(cheerio.load(String(nota.texto || "")).text()),
  };
}

async function queryPi(project, cnpj, razaoSocial) {
  const terms = searchTerms(cnpj, razaoSocial);
  if (!terms.term) return { total: 0, linhas: [] };
  const headers = { "x-requested-with": "XMLHttpRequest", "content-type": "application/x-www-form-urlencoded" };
  const payload = await httpJson(`${PI_BASE}/Api/buscaavancada.json`, {
    method: "POST", headers, body: form({ filter_texto: terms.term }), timeout: 90000,
  });
  const results = piResults(payload, terms.words)
    .sort((a, b) => String(b.data).localeCompare(String(a.data)))
    .slice(0, PI_NOTAS);
  const hits = [];
  for (const result of results) {
    let nota = { texto: "" };
    try {
      nota = piNote(await httpJson(`${PI_BASE}/Api/visualizarnota.json`, {
        method: "POST", headers, body: form({ uuid: result.nota }), timeout: 60000,
      }));
    } catch {
      nota = { texto: "" };
    }
    hits.push({
      chave: result.nota,
      data: nota.data || result.data,
      titulo: nota.titulo || result.secao,
      orgao: nota.orgao || null,
      texto: nota.texto,
      url: result.url,
    });
  }
  return rankedResult(hits, terms, project);
}

const DOE_CONECTORES = {
  "CAPTURA-DOE-AC": queryAc,
  "CAPTURA-DOE-AL": queryAl,
  "CAPTURA-DOE-AM": queryAm,
  "CAPTURA-DOE-CE": queryCe,
  "CAPTURA-DOE-DF": queryDf,
  "CAPTURA-DOE-MA": queryMa,
  "CAPTURA-DOE-MS": queryMs,
  "CAPTURA-DOE-PE": queryPe,
  "CAPTURA-DOE-PI": queryPi,
  "CAPTURA-DOE-RJ": queryRj,
  "CAPTURA-DOE-RN": queryRn,
  "CAPTURA-DOE-RS": queryRs,
  "CAPTURA-DOE-SC": querySc,
  "CAPTURA-DOE-TO": queryTo,
  // PA, PB, RO e RR: índice próprio dos PDFs (doe-pdf.js).
  ...DOE_PDF_CONECTORES,
};

module.exports = {
  DOE_CONECTORES,
  acHits,
  alHits,
  amHits,
  ceRows,
  dfHits,
  latin1Param,
  maHits,
  msHits,
  pageCites,
  peHits,
  piNote,
  piResults,
  rjHits,
  rnHits,
  rsHits,
  scHits,
  toEditions,
};
