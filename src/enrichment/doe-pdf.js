const cheerio = require("cheerio");
const { fold, onlyDigits } = require("./resolve");
const { brDateToIso, rankedResult, searchTerms, today } = require("./estaduais");

// Diários estaduais sem busca no portal: PA, PB, RO e RR publicam só o PDF da edição.
// O sincronizador lista as edições de cada dia ou mês, baixa o PDF, extrai o texto de cada
// página e grava em doe_pdf_edicao / doe_pdf_pagina (sql/016). O conector da ficha lê essas tabelas.
// A pesquisa de cada portal está documentada em src/doe-registry.js e nas amostras.

const USER_AGENT = "Mozilla/5.0 (compatible; RadarCapEx-MVP/0.1)";
const LIMITE_PAGINAS = 40;
const JANELA = 1600;

async function http(url, { method = "GET", headers = {}, body = null, timeout = 120000 } = {}) {
  const response = await fetch(url, {
    method,
    headers: { "user-agent": USER_AGENT, ...headers },
    body,
    signal: AbortSignal.timeout(timeout),
    redirect: "follow",
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!response.ok) throw new Error(`${new URL(url).host} respondeu HTTP ${response.status}.`);
  return { buffer, text: buffer.toString("utf8"), url: response.url };
}

const isoToBr = (iso) => iso.split("-").reverse().join("/");
const isoToDash = (iso) => iso.split("-").reverse().join("-");
const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();

// ---------- PA: IOEPA, uma consulta por dia; o PDF fica no Google Drive ----------
const PA_BASE = "https://www.ioepa.com.br";

// O Frame devolve a edição mais próxima antes da data pedida; só vale se a data bater.
function paEditions(html, iso) {
  const $ = cheerio.load(String(html || ""));
  if ($("#datepicker").attr("value") !== isoToBr(iso)) return [];
  const editions = [];
  $('a[href*="drive.google.com/uc?id="]').each((_index, element) => {
    const href = $(element).attr("href");
    const id = new URL(href).searchParams.get("id");
    const capa = $(element).find("img").attr("src") || "";
    const tipo = (capa.match(/\d{4}\.\d{2}\.\d{2}\.([A-Z0-9_-]+)\.jpg$/i) || [])[1] || "DOE";
    editions.push({
      chave: id,
      data: iso,
      titulo: tipo.toUpperCase() === "DOE" ? "Diário Oficial" : `Diário Oficial (${tipo.toLowerCase()})`,
      url: `https://drive.google.com/uc?id=${id}&export=download`,
    });
  });
  return editions;
}

async function listPa(iso) {
  const response = await http(`${PA_BASE}/Frame/?dts=${isoToBr(iso)}`, { timeout: 60000 });
  return paEditions(response.text, iso);
}

// ---------- PB: A União, pasta Plone por ano e mês ----------
const PB_BASE = "https://auniao.pb.gov.br/servicos/doe";
const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// A pasta do ano nem sempre é o ano puro (2025 está em 2025-1).
function pbYearFolders(html) {
  const $ = cheerio.load(String(html || ""));
  const folders = {};
  $("a[href]").each((_index, element) => {
    const match = String($(element).attr("href")).match(/\/servicos\/doe\/((\d{4})(?:-\d+)?)\/?$/);
    if (match && !folders[match[2]]) folders[match[2]] = match[1];
  });
  return folders;
}

function pbEditions(html) {
  const $ = cheerio.load(String(html || ""));
  const editions = new Map();
  $('a[href$=".pdf/view"]').each((_index, element) => {
    const href = $(element).attr("href");
    const arquivo = href.replace(/\/view$/, "").split("/").pop();
    const match = arquivo.match(/(\d{2})-(\d{2})-(\d{4})/);
    if (!match) return;
    const suplemento = /suplemento/i.test(arquivo);
    editions.set(href, {
      chave: arquivo,
      data: `${match[3]}-${match[2]}-${match[1]}`,
      titulo: suplemento ? "Diário Oficial (suplemento)" : "Diário Oficial",
      url: href.replace(/\/view$/, "/@@download/file"),
    });
  });
  return [...editions.values()];
}

let pbFolders = null;

async function listPb(ano, mes) {
  if (!pbFolders) pbFolders = pbYearFolders((await http(PB_BASE, { timeout: 60000 })).text);
  const pasta = pbFolders[String(ano)];
  if (!pasta) return [];
  const editions = new Map();
  // A listagem vem em lotes de 20.
  for (let start = 0; start < 200; start += 20) {
    const url = `${PB_BASE}/${pasta}/${MESES[mes - 1]}${start ? `?b_start:int=${start}` : ""}`;
    const found = pbEditions((await http(url, { timeout: 60000 })).text);
    const before = editions.size;
    for (const edition of found) editions.set(edition.chave, edition);
    if (found.length < 20 || editions.size === before) break;
  }
  return [...editions.values()];
}

// ---------- RO: DIOF, consulta por dia em /diarios/?cf_time= ----------
const RO_BASE = "https://diof.ro.gov.br";

// A resposta é só uma lista de <tr>; sem a <table> em volta o parser descarta as linhas.
function roEditions(html, iso) {
  const $ = cheerio.load(`<table>${String(html || "")}</table>`);
  const editions = [];
  $("tr").each((_index, element) => {
    const row = $(element);
    const url = row.find('a[href$=".pdf"]').attr("href");
    if (!url) return;
    const rotulo = cleanText(row.find("td").eq(1).find("small").first().text());
    editions.push({
      chave: url.split("/data/uploads/").pop(),
      data: iso,
      titulo: /suplement/i.test(rotulo) ? `Diário Oficial (${rotulo.toLowerCase()})` : "Diário Oficial",
      url,
    });
  });
  return editions;
}

async function listRo(iso) {
  const response = await http(`${RO_BASE}/diarios/?cf_time=${isoToDash(iso)}`, { timeout: 60000 });
  return roEditions(response.text, iso);
}

// ---------- RR: lista do mês; o PDF sai de um POST com o caminho ----------
const RR_BASE = "https://www.imprensaoficial.rr.gov.br";

function rrEditions(html) {
  const $ = cheerio.load(String(html || ""));
  const editions = [];
  $('input[name="doe"]').each((_index, element) => {
    const caminho = $(element).attr("value");
    const row = $(element).closest("tr");
    const tipo = cleanText(row.find("td").first().text()).replace(/^-\s*/, "") || "Diário Oficial";
    const data = brDateToIso(cleanText(row.find("td").eq(1).text()).replace(/^-\s*/, "").replace(/\s/g, ""));
    const match = caminho.match(/(\d{4})(\d{2})(\d{2})/);
    editions.push({
      chave: caminho,
      data: data || (match ? `${match[1]}-${match[2]}-${match[3]}` : null),
      titulo: tipo,
      // O PDF só abre por POST; o link público é a lista do mês, onde a edição tem o botão de abrir.
      url: `${RR_BASE}/_visualizar-mes/?ano=${caminho.slice(0, 4)}&mes=${caminho.slice(5, 7)}`,
      download: { method: "POST", body: new URLSearchParams({ doe: caminho, ipconexao: "0.0.0.0" }).toString() },
    });
  });
  return editions.filter((edition) => edition.data);
}

async function listRr(ano, mes) {
  const url = `${RR_BASE}/_visualizar-mes/?ano=${ano}&mes=${String(mes).padStart(2, "0")}`;
  return rrEditions((await http(url, { timeout: 60000 })).text);
}

const DIARIOS_PDF = {
  PA: { porDia: listPa },
  PB: { porMes: listPb },
  RO: { porDia: listRo },
  RR: {
    porMes: listRr,
    semPagina: true,
    baixar: (edition) => http(`${RR_BASE}/_visualizar-doe/`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: edition.download.body,
    }),
  },
};

// ---------- Texto da página ----------

function compactText(text) {
  return fold(text).replace(/[^a-z0-9]/g, "");
}

// Raízes de CNPJ citadas: o número inteiro (com ou sem máscara) ou a raiz mascarada sozinha.
function cnpjRoots(text) {
  const roots = new Set();
  const full = /(\d{2})[.\s]?(\d{3})[.\s]?(\d{3})\s?\/\s?\d{4}\s?-?\s?\d{2}/g;
  const masked = /\b(\d{2})\.(\d{3})\.(\d{3})\b/g;
  for (const regex of [full, masked]) {
    for (const match of String(text || "").matchAll(regex)) roots.add(`${match[1]}${match[2]}${match[3]}`);
  }
  return [...roots];
}

function cleanPage(text) {
  return String(text || "").replace(/\u0000/g, "").replace(/[ \t]+/g, " ").trim();
}

// Acha no texto original a posição do termo procurado no texto compacto.
function locate(text, needles) {
  const map = [];
  let compact = "";
  const folded = fold(text);
  for (let index = 0; index < folded.length; index += 1) {
    if (/[a-z0-9]/.test(folded[index])) {
      compact += folded[index];
      map.push(index);
    }
  }
  for (const needle of needles) {
    const at = needle ? compact.indexOf(needle) : -1;
    if (at >= 0) return map[at];
  }
  return -1;
}

function pageHit(row, terms) {
  const texto = row.texto.replace(/\s+/g, " ");
  const at = locate(texto, [onlyDigits(terms.cnpjRoot), nameNeedle(terms)]);
  const start = Math.max(0, at - 120);
  return {
    chave: `${row.id_edicao}:${row.pagina}`,
    data: row.data instanceof Date ? row.data.toISOString().slice(0, 10) : String(row.data).slice(0, 10),
    pagina: row.pagina,
    titulo: row.titulo,
    trecho: texto.slice(start, start + 400),
    texto: texto.slice(Math.max(0, at - JANELA / 2), Math.max(0, at - JANELA / 2) + JANELA),
    url: DIARIOS_PDF[row.uf]?.semPagina ? row.url : `${row.url}#page=${row.pagina}`,
  };
}

// ---------- Sincronização ----------

function daysBetween(fromIso, toIso) {
  const days = [];
  for (let day = new Date(`${toIso}T12:00:00Z`); day >= new Date(`${fromIso}T12:00:00Z`); day.setUTCDate(day.getUTCDate() - 1)) {
    days.push(day.toISOString().slice(0, 10));
  }
  return days;
}

function monthsBetween(fromIso, toIso) {
  const months = [];
  let [ano, mes] = toIso.split("-").map(Number);
  const [anoFim, mesFim] = fromIso.split("-").map(Number);
  while (ano > anoFim || (ano === anoFim && mes >= mesFim)) {
    months.push([ano, mes]);
    mes -= 1;
    if (!mes) {
      mes = 12;
      ano -= 1;
    }
  }
  return months;
}

async function listEditions(uf, fromIso, toIso) {
  const diario = DIARIOS_PDF[uf];
  const editions = [];
  if (diario.porDia) {
    // O portal do PA leva ~7 s por dia; quatro dias por vez.
    const days = daysBetween(fromIso, toIso);
    for (let index = 0; index < days.length; index += 4) {
      const batch = await Promise.all(days.slice(index, index + 4).map((iso) => diario.porDia(iso)));
      editions.push(...batch.flat());
    }
  } else {
    for (const [ano, mes] of monthsBetween(fromIso, toIso)) editions.push(...await diario.porMes(ano, mes));
  }
  return editions.filter((edition) => edition.data >= fromIso && edition.data <= toIso);
}

async function saveEdition(client, uf, edition, pages, bytes) {
  const status = pages.length ? "ok" : "sem_texto";
  const { rows } = await client.query(
    `insert into doe_pdf_edicao (uf, chave, data, titulo, url, paginas, bytes, status, erro, lida_em)
     values ($1, $2, $3, $4, $5, $6, $7, $8, null, now())
     on conflict (uf, chave) do update
       set data = excluded.data, titulo = excluded.titulo, url = excluded.url, paginas = excluded.paginas,
           bytes = excluded.bytes, status = excluded.status, erro = null, lida_em = now()
     returning id`,
    [uf, edition.chave, edition.data, edition.titulo, edition.url, pages.length, bytes, status],
  );
  const id = rows[0].id;
  await client.query("delete from doe_pdf_pagina where id_edicao = $1", [id]);
  if (pages.length) {
    await client.query(
      `insert into doe_pdf_pagina (id_edicao, uf, data, pagina, texto, compacto, raizes)
       select $1, $2, $3, item.pagina, item.texto, item.compacto, array(select jsonb_array_elements_text(item.raizes))
       from jsonb_to_recordset($4::jsonb) as item(pagina int, texto text, compacto text, raizes jsonb)`,
      [id, uf, edition.data, JSON.stringify(pages)],
    );
  }
}

async function saveFailure(client, uf, edition, error) {
  await client.query(
    `insert into doe_pdf_edicao (uf, chave, data, titulo, url, status, erro, lida_em)
     values ($1, $2, $3, $4, $5, 'erro', $6, now())
     on conflict (uf, chave) do update set status = 'erro', erro = excluded.erro, lida_em = now()`,
    [uf, edition.chave, edition.data, edition.titulo, edition.url, String(error.message || error).slice(0, 500)],
  );
}

async function readEdition(uf, edition) {
  const { pdfPages } = require("../documents/to-markdown");
  const diario = DIARIOS_PDF[uf];
  const response = diario.baixar ? await diario.baixar(edition) : await http(edition.url);
  if (!response.buffer.subarray(0, 5).toString("latin1").startsWith("%PDF")) {
    throw new Error("a resposta não é PDF");
  }
  const pages = (await pdfPages(response.buffer, { maxPages: 2000 }))
    .map((page) => ({ pagina: page.pagina, texto: cleanPage(page.texto) }))
    .filter((page) => page.texto.length > 0)
    .map((page) => ({ ...page, compacto: compactText(page.texto), raizes: cnpjRoots(page.texto) }));
  return { pages, bytes: response.buffer.length };
}

// Lê as edições de `dias` atrás até hoje. Edição já lida com sucesso não é baixada de novo.
async function syncDoePdf(uf, { dias = 7, ate = today(), log = () => {} } = {}) {
  const db = require("../db");
  if (!DIARIOS_PDF[uf]) throw new Error(`UF sem índice de PDF: ${uf}`);
  const from = new Date(`${ate}T12:00:00Z`);
  from.setUTCDate(from.getUTCDate() - dias);
  const fromIso = from.toISOString().slice(0, 10);
  const editions = await listEditions(uf, fromIso, ate);
  const { rows } = await db.pool.query(
    "select chave from doe_pdf_edicao where uf = $1 and status <> 'erro' and data between $2 and $3",
    [uf, fromIso, ate],
  );
  const done = new Set(rows.map((row) => row.chave));
  const pending = editions.filter((edition) => !done.has(edition.chave));
  const summary = { uf, listadas: editions.length, lidas: 0, paginas: 0, erros: 0, bytes: 0 };
  for (const edition of pending) {
    const client = await db.pool.connect();
    try {
      const { pages, bytes } = await readEdition(uf, edition);
      await client.query("begin");
      await saveEdition(client, uf, edition, pages, bytes);
      await client.query("commit");
      summary.lidas += 1;
      summary.paginas += pages.length;
      summary.bytes += bytes;
      log(`${uf} ${edition.data} ${edition.titulo}: ${pages.length} páginas`);
    } catch (error) {
      await client.query("rollback").catch(() => {});
      await saveFailure(client, uf, edition, error).catch(() => {});
      summary.erros += 1;
      log(`${uf} ${edition.data} ${edition.titulo}: erro ${error.message}`);
    } finally {
      client.release();
    }
  }
  await db.pool.query(
    `insert into base_carga (codigo, recurso, status, linhas, bytes, erro)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      `CAPTURA-DOE-${uf}`,
      `doe_pdf_pagina (${fromIso} a ${ate})`,
      summary.erros && !summary.lidas ? "erro" : "ok",
      summary.paginas,
      summary.bytes,
      summary.erros ? `${summary.erros} edição(ões) com erro` : null,
    ],
  );
  return summary;
}

// ---------- Consulta da ficha ----------

// O nome é procurado colado (versalete parte as palavras no PDF). Nome de uma palavra só
// precisa aparecer como palavra inteira: "vale" não pode casar com "valor" ou "Valéria".
function nameNeedle(terms) {
  const joined = compactText(terms.term || "");
  return joined.length >= 4 ? joined : "";
}

function citesName(texto, terms) {
  const needle = nameNeedle(terms);
  if (!needle) return false;
  if (terms.words.length > 1) return compactText(texto).includes(needle);
  return new RegExp(`(^|[^a-z0-9])${needle}([^a-z0-9]|$)`).test(fold(texto));
}

function queryDoePdf(uf) {
  return async (project, cnpj, razaoSocial) => {
    const db = require("../db");
    const terms = searchTerms(cnpj, razaoSocial);
    const root = onlyDigits(terms.cnpjRoot);
    const needle = nameNeedle(terms);
    if (!root && !needle) return { total: 0, linhas: [] };
    const { rows } = await db.pool.query(
      `select p.uf, p.id_edicao, p.pagina, p.data, p.texto, e.titulo, e.url, p.raizes @> array[$2] as pela_raiz
       from doe_pdf_pagina p
       join doe_pdf_edicao e on e.id = p.id_edicao
       where p.uf = $1
         and (($2 <> '' and p.raizes @> array[$2]) or ($3 <> '' and strpos(p.compacto, $3) > 0))
       order by p.data desc, p.pagina
       limit 400`,
      [uf, root || "", needle],
    );
    const pages = rows.filter((row) => row.pela_raiz || citesName(row.texto, terms)).slice(0, LIMITE_PAGINAS);
    return rankedResult(pages.map((row) => pageHit(row, terms)), terms, project);
  };
}

const DOE_PDF_CONECTORES = Object.fromEntries(Object.keys(DIARIOS_PDF).map((uf) => [`CAPTURA-DOE-${uf}`, queryDoePdf(uf)]));

module.exports = {
  DIARIOS_PDF,
  DOE_PDF_CONECTORES,
  citesName,
  cnpjRoots,
  compactText,
  listEditions,
  locate,
  paEditions,
  pageHit,
  pbEditions,
  pbYearFolders,
  roEditions,
  rrEditions,
  syncDoePdf,
};
