const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { mapAnp, mapAntaq, mapAntt, mapIat, mapLoose, mapObrasgov, parseAnttCsv, parseCsv } = require("./rows");
const { ARCHIVE, onsRecords } = require("./ons");
const { REIDI_PACKAGE, pickReidiResource, reidiRecords } = require("./reidi");
const {
  ARTESP_PACKAGE,
  artespRecordsFromGeojson,
  artespRecordsFromRows,
  fetchRodovias,
  pickArtespResources,
  readXlsxRows,
} = require("./artesp");
const {
  DUTOS_URL,
  INSTALACOES_URL,
  PLATAFORMAS_URL,
  buildCampos,
  mapDuto,
  mapPlataforma,
  rememberOperator,
  zonaMonthUrls,
} = require("./anp-listas");

const CACHE = path.join(process.cwd(), "data", "cache");
const USER_AGENT = "RadarCapEx-MVP/0.1 (research; contact via project owner)";

const CSV_SOURCES = [
  {
    codigo: "SEC-ANTT-CAD",
    recurso: "https://dados.antt.gov.br/dataset/6a42582f-5481-458d-bf21-247d91a60af5/resource/48ca5a9b-65c2-46af-9123-cad23e6f8a8d/download/cadastros-de-investimentos-dos-contratos-de-concessao.csv",
    file: "antt-cadastros.csv",
    parse: parseAnttCsv,
    map: mapAntt,
  },
  {
    codigo: "SEC-ANTT-AUT",
    recurso: "https://dados.antt.gov.br/dataset/967e6b74-bbcd-4212-a93f-4119611143f8/resource/cec76fd2-8fa0-45f5-bb87-566de09fa715/download/autorizacao-investimento.csv",
    file: "antt-autorizacao.csv",
    parse: parseAnttCsv,
    map: mapAntt,
  },
  {
    codigo: "SEC-ANTT-ENC",
    recurso: "https://dados.antt.gov.br/dataset/09020405-776b-4bbc-946e-410a37ab2a70/resource/37527602-5b8b-4b2d-aef7-f7ed59a2f473/download/encerramento-investimentos.csv",
    file: "antt-encerramento.csv",
    parse: parseAnttCsv,
    map: mapAntt,
  },
  {
    codigo: "SEC-ANTT-PIP",
    recurso: "https://dados.antt.gov.br/dataset/7c6bc8ab-69fb-4955-9cf3-7481cfa089f9/resource/64a0f446-f67c-412d-8b87-17587a8e9f78/download/investimentos_autorizados_gpfer_pip.csv",
    file: "antt-pip.csv",
    parse: parseAnttCsv,
    map: mapAntt,
  },
  {
    codigo: "SEC-ANTT-CONC",
    recurso: "https://dados.antt.gov.br/dataset/a133da64-1e03-4832-909d-e1eb835eec2e/resource/a08292ac-41a6-4220-bfe2-35c7b3abfbf0/download/investimentos.csv",
    file: "antt-concessionarias.csv",
    parse: parseAnttCsv,
    map: mapAntt,
  },
  {
    codigo: "SEC-ANTAQ-INST",
    // web3.antaq.gov.br, citado no catálogo de 2026, não resolve. Este CSV é o de outubro de 2022.
    recurso: "https://dados.transportes.gov.br/dataset/5cb74314-b2d8-4bcb-8330-f7acda1ad060/resource/4cb7551c-176c-46b0-bba5-8e326d6fda6e/download/out_2022.csv",
    file: "antaq-instalacoes.csv",
    map: mapAntaq,
  },
];

const IAT_QUERY = "https://geopr.iat.pr.gov.br/server/rest/services/00_PUBLICACOES/licencas_ambientais_sia_sga/FeatureServer/0/query";
const OBRASGOV = "https://api-publica.obrasgov.gestao.gov.br/obras/projeto-investimento";
const ANP_EXPLORACAO = "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/fase-exploracao";
const ANP_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function detectDelimiter(text) {
  const line = text.split(/\r?\n/, 1)[0] || "";
  const semicolons = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  return semicolons >= commas ? ";" : ",";
}

function decodeBuffer(bytes) {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (utf8.includes("\uFFFD")) return new TextDecoder("windows-1252").decode(bytes);
  return utf8;
}

async function download(url, destination) {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  const buffer = Buffer.from(await response.arrayBuffer());
  await fsp.writeFile(destination, buffer);
  return buffer;
}

async function recordLoad(client, entry) {
  await client.query(
    `insert into base_carga (codigo, recurso, status, linhas, bytes, erro)
     values ($1, $2, $3, $4, $5, $6)`,
    [entry.codigo, entry.recurso, entry.status, entry.linhas ?? null, entry.bytes ?? null, entry.erro ?? null],
  );
}

function withChave(row) {
  if (!row) return null;
  if (row.chave) return row;
  return {
    ...row,
    chave: crypto.createHash("sha1").update(JSON.stringify(row.payload)).digest("hex"),
  };
}

async function writeRegistro(client, codigo, rows, replace) {
  const unique = [...new Map(rows.map(withChave).filter(Boolean).map((row) => [row.chave, row])).values()];
  if (replace) {
    await client.query("delete from enr_registro where codigo = $1", [codigo]);
  }
  const chunkSize = 200;
  for (let start = 0; start < unique.length; start += chunkSize) {
    const slice = unique.slice(start, start + chunkSize);
    const values = [];
    const groups = slice.map((row, rowIndex) => {
      const offset = rowIndex * 9;
      values.push(
        codigo,
        row.chave,
        row.cnpj,
        row.cnpjs || [],
        row.titulo,
        row.uf,
        row.municipio,
        row.valor,
        JSON.stringify(row.payload),
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}::jsonb)`;
    });
    await client.query(
      `insert into enr_registro
         (codigo, chave, cnpj, cnpjs, titulo, uf, municipio, valor, payload)
       values ${groups.join(", ")}
       on conflict (codigo, chave) do update set
         cnpj = excluded.cnpj,
         cnpjs = excluded.cnpjs,
         titulo = excluded.titulo,
         uf = excluded.uf,
         municipio = excluded.municipio,
         valor = excluded.valor,
         payload = excluded.payload,
         carregado_em = now()`,
      values,
    );
  }
  return unique.length;
}

async function loadCsvSource(client, source, options = {}) {
  const destination = path.join(CACHE, source.file);
  const bytes = await download(source.recurso, destination);
  const text = decodeBuffer(fs.readFileSync(destination));
  const parsed = source.parse ? source.parse(text) : parseCsv(text, detectDelimiter(text));
  const rows = parsed.map(options.map || source.map || mapLoose).filter(Boolean);
  const linhas = await writeRegistro(client, source.codigo, rows, options.replace !== false);
  if (options.record !== false) {
    await recordLoad(client, {
      codigo: source.codigo,
      recurso: source.recurso,
      status: "ok",
      linhas,
      bytes: bytes.length,
    });
  }
  return { codigo: source.codigo, linhas, bytes: bytes.length };
}

function pickLatestBlocos(hrefs) {
  const ranked = [];
  for (const href of hrefs) {
    const match = String(href).match(/\/bsc\/(\d{4})\/blocos-sob-contrato[^"'\s]*\.csv/i);
    if (!match) continue;
    const file = decodeURIComponent(match[0].split("/").pop()).toLowerCase();
    const month = ANP_MONTHS.findIndex((name) => file.includes(name));
    if (month < 0) continue;
    ranked.push({ href, year: Number(match[1]), month });
  }
  ranked.sort((left, right) => right.year - left.year || right.month - left.month);
  return ranked[0]?.href || null;
}

async function loadAnp(client) {
  const response = await fetch(ANP_EXPLORACAO, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(40000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} na página da ANP`);
  const html = await response.text();
  const hrefs = [...html.matchAll(/href="([^"]+)"/gi)].map((match) => match[1]);
  const url = pickLatestBlocos(hrefs);
  if (!url) {
    throw new Error("A página da fase de exploração da ANP não apontou o CSV de blocos sob contrato.");
  }
  await client.query("delete from enr_registro where codigo = $1", ["SEC-ANP-EP"]);
  const loaded = await loadCsvSource(client, {
    codigo: "SEC-ANP-EP",
    recurso: url,
    file: "anp-blocos.csv",
  }, { replace: false, record: false, map: mapAnp });
  await recordLoad(client, {
    codigo: "SEC-ANP-EP",
    recurso: url,
    status: "ok",
    linhas: loaded.linhas,
    bytes: loaded.bytes,
  });
  return loaded;
}

async function loadIat(client) {
  const rows = [];
  let offset = 0;
  let bytes = 0;
  for (;;) {
    const url = `${IAT_QUERY}?where=1%3D1&outFields=*&returnGeometry=false&resultOffset=${offset}&resultRecordCount=2000&f=json`;
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} no IAT, offset ${offset}`);
    const body = await response.json();
    const features = body.features || [];
    bytes += JSON.stringify(body).length;
    for (const feature of features) rows.push(mapIat(feature.attributes));
    offset += features.length;
    if (!features.length || (!body.exceededTransferLimit && features.length < 2000)) break;
    if (offset > 400000) break;
  }
  const linhas = await writeRegistro(client, "SEC-IAT", rows.filter(Boolean), true);
  await recordLoad(client, {
    codigo: "SEC-IAT",
    recurso: IAT_QUERY,
    status: "ok",
    linhas,
    bytes,
  });
  return { codigo: "SEC-IAT", linhas, bytes };
}

async function fetchObrasgovPage(page) {
  const url = `${OBRASGOV}?pagina=${page}`;
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(60000),
      });
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status} na página ${page}`);
      if (response.status < 500 && response.status !== 429) throw lastError;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  throw lastError;
}

async function loadObrasgov(client) {
  const first = await fetchObrasgovPage(1);
  const totalPages = Number(first.total_pages) || 1;
  await client.query("delete from enr_registro where codigo = $1", ["SEC-OBRASGOV"]);
  let linhas = await writeRegistro(
    client,
    "SEC-OBRASGOV",
    (first.data || []).map(mapObrasgov).filter(Boolean),
    false,
  );
  let bytes = JSON.stringify(first).length;
  const concurrency = 4;
  for (let start = 2; start <= totalPages; start += concurrency) {
    const pages = [];
    for (let page = start; page < start + concurrency && page <= totalPages; page += 1) {
      pages.push(page);
    }
    const bodies = await Promise.all(pages.map((page) => fetchObrasgovPage(page)));
    const rows = [];
    for (const body of bodies) {
      bytes += JSON.stringify(body).length;
      rows.push(...(body.data || []).map(mapObrasgov).filter(Boolean));
    }
    linhas += await writeRegistro(client, "SEC-OBRASGOV", rows, false);
    if (start === 2 || start % 200 < concurrency) {
      console.log(`SEC-OBRASGOV: página ${Math.min(start + concurrency - 1, totalPages)} de ${totalPages}`);
    }
  }
  await recordLoad(client, {
    codigo: "SEC-OBRASGOV",
    recurso: OBRASGOV,
    status: "ok",
    linhas,
    bytes,
  });
  return { codigo: "SEC-OBRASGOV", linhas, bytes };
}

async function loadOns(client) {
  const rows = await onsRecords();
  const linhas = await writeRegistro(client, "CAPTURA-ONS-PAR", rows, true);
  await recordLoad(client, {
    codigo: "CAPTURA-ONS-PAR",
    recurso: ARCHIVE,
    status: "ok",
    linhas,
    bytes: null,
  });
  return { codigo: "CAPTURA-ONS-PAR", linhas };
}

const ANP_FONTES = [
  {
    codigo: "SEC-ANP-CAMPO",
    nome: "ANP Campos em produção",
    url: "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/arquivos-fase-de-desenvolvimento-e-producao/producao-por-zona",
    conteudo: "Campos com produção no mês publicado, bacia, ambiente e operador quando a plataforma ou o duto informam.",
    unidade: "campo produtor",
  },
  {
    codigo: "SEC-ANP-PLAT",
    nome: "ANP Plataformas em operação",
    url: "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/arquivos-fase-de-desenvolvimento-e-producao/lpo",
    conteudo: "Plataformas e instalações marítimas em operação, com operador, campos e ano de início.",
    unidade: "plataforma",
  },
  {
    codigo: "SEC-ANP-DUTO",
    nome: "ANP Dutos",
    url: "https://www.gov.br/anp/pt-br/assuntos/exploracao-e-producao-de-oleo-e-gas/desenvolvimento-e-producao/lista-de-codigos",
    conteudo: "Dutos de exploração e produção, com operador, campo, tipo e situação.",
    unidade: "duto",
  },
];

async function ensureAnpFontes(client) {
  for (const fonte of ANP_FONTES) {
    await client.query(
      `insert into fonte (
         codigo, nome, tipo, categoria, url_base, conteudo,
         frequencia_projetos, status_acesso, peculiaridade, ativo,
         participa_scanner, papel_captura, formato_dado, auth_acesso, unidade_registro
       ) values ($1, $2, 'secundaria', 'dataset_download', $3, $4, 'baixa', 'ok', $5, true, false, 'enriquecimento', 'csv_zip', 'nenhuma', $6)
       on conflict (codigo) do update set
         nome = excluded.nome,
         url_base = excluded.url_base,
         conteudo = excluded.conteudo,
         peculiaridade = excluded.peculiaridade,
         unidade_registro = excluded.unidade_registro,
         updated_at = now()`,
      [
        fonte.codigo,
        fonte.nome,
        fonte.url,
        fonte.conteudo,
        "CSV público da ANP. Energia e portos do REIDI não entram aqui.",
        fonte.unidade,
      ],
    );
  }
}

async function readCsv(url, file) {
  const destination = path.join(CACHE, file);
  const bytes = await download(url, destination);
  const text = decodeBuffer(bytes);
  if (/<!doctype html/i.test(text.slice(0, 200))) {
    throw new Error(`A ANP devolveu HTML em vez de CSV em ${url}`);
  }
  return { url, text, bytes: bytes.length };
}

async function readLatestZona() {
  let lastError = null;
  for (const url of zonaMonthUrls()) {
    try {
      const file = await readCsv(url, "anp-zona.csv");
      if (/^zona,/i.test(file.text.slice(0, 80)) || file.text.includes("Nome poço")) return file;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("A ANP não publicou o CSV de produção por zona nos últimos meses.");
}

async function loadReidi(client) {
  const response = await fetch(REIDI_PACKAGE, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(40000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} no catálogo do REIDI`);
  const body = await response.json();
  const resource = pickReidiResource(body.result?.resources);
  if (!resource?.url) throw new Error("O catálogo do REIDI não apontou um CSV.");
  const file = await readCsv(resource.url, "reidi.csv");
  const rows = reidiRecords(file.text);
  const linhas = await writeRegistro(client, "CAPTURA-REIDI", rows, true);
  await recordLoad(client, {
    codigo: "CAPTURA-REIDI",
    recurso: resource.url,
    status: "ok",
    linhas,
    bytes: file.bytes,
  });
  return { codigo: "CAPTURA-REIDI", linhas, bytes: file.bytes };
}

async function loadArtesp(client) {
  const response = await fetch(ARTESP_PACKAGE, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(40000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} no catálogo da ARTESP`);
  const body = await response.json();
  const picked = pickArtespResources(body.result?.resources);
  if (!picked) throw new Error("O catálogo da ARTESP não apontou GeoJSON nem planilha de obras CapEx.");
  const rodovias = await fetchRodovias(fetch);
  const rows = [];
  let bytes = 0;
  let recurso = ARTESP_PACKAGE;
  for (const resource of picked.resources) {
    if (!resource.url) continue;
    recurso = resource.url;
    if (picked.kind === "geojson") {
      const destination = path.join(CACHE, "artesp", path.basename(new URL(resource.url).pathname) || "obras.geojson");
      const buffer = await download(resource.url, destination);
      bytes += buffer.length;
      const geo = JSON.parse(decodeBuffer(buffer));
      rows.push(
        ...artespRecordsFromGeojson(geo, {
          rodovias,
          arquivo: resource.name || resource.url,
          exemplo: picked.exemplo,
        }),
      );
      continue;
    }
    const destination = path.join(CACHE, "artesp", path.basename(new URL(resource.url).pathname) || "obras.xlsx");
    const buffer = await download(resource.url, destination);
    bytes += buffer.length;
    const sheetRows = await readXlsxRows(destination);
    rows.push(
      ...artespRecordsFromRows(sheetRows, {
        rodovias,
        arquivo: resource.name || resource.url,
        exemplo: picked.exemplo,
      }),
    );
  }
  if (!rows.length) throw new Error("A ARTESP não devolveu linhas CapEx/REVIT/NS.");
  const linhas = await writeRegistro(client, "SEC-ARTESP", rows, true);
  await recordLoad(client, {
    codigo: "SEC-ARTESP",
    recurso,
    status: "ok",
    linhas,
    bytes,
  });
  return { codigo: "SEC-ARTESP", linhas, bytes };
}

async function loadAnpListas(client) {
  await ensureAnpFontes(client);
  const plataformas = await readCsv(PLATAFORMAS_URL, "anp-plataformas.csv");
  const dutos = await readCsv(DUTOS_URL, "anp-dutos.csv");
  const instalacoes = await readCsv(INSTALACOES_URL, "anp-instalacoes.csv");
  const zona = await readLatestZona();
  const platRecords = parseCsv(plataformas.text, ",");
  const platRows = platRecords.map(mapPlataforma).filter(Boolean);
  const dutoRows = parseCsv(dutos.text, ",").map(mapDuto).filter(Boolean);
  const operators = new Map();
  for (const record of platRecords) {
    rememberOperator(operators, record["[CAMPOS]"] || record.CAMPOS, record["[OPERADOR]"] || record.OPERADOR);
  }
  for (const row of dutoRows) rememberOperator(operators, row.payload.campo, row.payload.operador);
  for (const record of parseCsv(instalacoes.text, ",")) {
    rememberOperator(operators, record["Campo Integrante"], record["Operador Contrato"]);
  }
  const campoRows = buildCampos(parseCsv(zona.text, ","), operators);
  const cargas = [
    ["SEC-ANP-PLAT", platRows, plataformas],
    ["SEC-ANP-DUTO", dutoRows, dutos],
    ["SEC-ANP-CAMPO", campoRows, zona],
  ];
  let linhas = 0;
  let bytes = 0;
  for (const [codigo, rows, file] of cargas) {
    const gravadas = await writeRegistro(client, codigo, rows, true);
    linhas += gravadas;
    bytes += file.bytes;
    await recordLoad(client, {
      codigo,
      recurso: file.url,
      status: "ok",
      linhas: gravadas,
      bytes: file.bytes,
    });
    console.log(`${codigo}: ${gravadas} linhas`);
  }
  return { codigo: "SEC-ANP-CAMPO, SEC-ANP-PLAT e SEC-ANP-DUTO", linhas, bytes };
}

const ANTT_CODES = CSV_SOURCES.filter((source) => source.codigo.startsWith("SEC-ANTT")).map((source) => source.codigo);

async function loadAntt(client) {
  const results = [];
  for (const source of CSV_SOURCES.filter((item) => item.codigo.startsWith("SEC-ANTT"))) {
    results.push(await loadCsvSource(client, source));
  }
  return {
    codigo: "SEC-ANTT-INV",
    linhas: results.reduce((sum, item) => sum + (item.linhas || 0), 0),
    bytes: results.reduce((sum, item) => sum + (item.bytes || 0), 0),
  };
}

const JOBS = [
  ...CSV_SOURCES.filter((source) => !source.codigo.startsWith("SEC-ANTT")).map((source) => ({
    codigo: source.codigo,
    run: (client) => loadCsvSource(client, source, { map: source.map }),
  })),
  { codigo: "SEC-ANTT-INV", also: ANTT_CODES, run: loadAntt },
  { codigo: "SEC-ANP-EP", run: loadAnp },
  { codigo: "CAPTURA-REIDI", run: loadReidi },
  { codigo: "SEC-ARTESP", run: loadArtesp },
  { codigo: "SEC-ANP-CAMPO", also: ["SEC-ANP-PLAT", "SEC-ANP-DUTO"], run: loadAnpListas },
  { codigo: "CAPTURA-ONS-PAR", run: loadOns },
  { codigo: "SEC-IAT", run: loadIat },
];

async function loadExtra(client, selected) {
  const results = [];
  for (const job of JOBS) {
    const wanted = selected(job.codigo) || (job.also || []).some((codigo) => selected(codigo));
    if (!wanted) continue;
    try {
      results.push(await job.run(client));
    } catch (error) {
      await recordLoad(client, {
        codigo: job.codigo,
        recurso: job.codigo,
        status: "erro",
        erro: error.message,
      });
      results.push({ codigo: job.codigo, erro: error.message });
    }
  }
  return results;
}

module.exports = {
  ANP_MONTHS,
  ANTT_CODES,
  CSV_SOURCES,
  JOBS,
  loadAntt,
  loadExtra,
  pickLatestBlocos,
};
