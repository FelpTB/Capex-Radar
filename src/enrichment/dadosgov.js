const { spawn } = require("node:child_process");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { getConfig } = require("../config");

const BASE_URL = "https://dados.gov.br";
const USER_AGENT = "RadarCapEx-MVP/0.1 (research; contact via project owner)";
const DATA_DIR = path.join(process.cwd(), "data", "dadosgov");
const HEAD_TIMEOUT_MS = 30_000;
const FOLDER_TIMEOUT_MS = 90_000;

// Cada alvo é um recurso de um conjunto do catálogo. "baixar: false" só vigia
// a URL e a data do arquivo, sem trazer o conteúdo (caso do CNPJ nacional).
const TARGETS = [
  {
    codigo: "SEC-CNO",
    conjunto: "cadastro-nacional-de-obras-cno",
    recurso: { tipo: "DADOS", formato: "ZIP" },
    arquivo: "cno.zip",
    baixar: true,
    extrairCsv: ["cno.csv", "cno_cnaes.csv", "cno_vinculos.csv", "cno_areas.csv", "cno_totais.csv"],
  },
  {
    codigo: "SEC-CNO",
    conjunto: "cadastro-nacional-de-obras-cno",
    recurso: { tipo: "DICIONARIO_DE_DADOS" },
    arquivo: "cno-metadados.pdf",
    baixar: true,
    conferir: false,
  },
  {
    codigo: "SEC-CNPJ",
    conjunto: "cadastro-nacional-da-pessoa-juridica---cnpj",
    recurso: { tipo: "DADOS", titulo: /inscri/i },
    arquivo: "cnpj",
    baixar: false,
    pasta: true,
  },
];

function requireToken() {
  const token = getConfig().dadosGovToken;
  if (!token) {
    throw new Error("TOKEN_DADOS_GOV ausente no .env. Gere a chave no dados.gov.br, perfil Consumidor.");
  }
  return token;
}

async function catalogGet(resource, token) {
  const response = await fetch(`${BASE_URL}${resource}`, {
    headers: {
      "chave-api-dados-abertos": token,
      accept: "application/json",
      "user-agent": USER_AGENT,
    },
  });
  if (response.status === 401) {
    throw new Error("dados.gov.br recusou a chave (401). Confira TOKEN_DADOS_GOV.");
  }
  if (!response.ok) {
    throw new Error(`dados.gov.br respondeu HTTP ${response.status} em ${resource}`);
  }
  return response.json();
}

async function findDataset(slug, token) {
  const name = slug.replace(/-+/g, " ").trim();
  const query = new URLSearchParams({ pagina: "1", nomeConjuntoDados: name });
  const list = await catalogGet(`/dados/api/publico/conjuntos-dados?${query}`, token);
  const items = Array.isArray(list) ? list : list.content || [];
  const exact = items.find((item) => item.nome === slug);
  const found = exact || items[0];
  if (!found) {
    throw new Error(`Conjunto ${slug} não encontrado no catálogo.`);
  }
  return catalogGet(`/dados/api/publico/conjuntos-dados/${encodeURIComponent(found.id)}`, token);
}

function pickResource(dataset, matcher) {
  const resources = dataset.recursos || [];
  return resources.find((resource) => {
    if (matcher.tipo && resource.tipo !== matcher.tipo) return false;
    if (matcher.formato && String(resource.formato || "").toUpperCase() !== matcher.formato) return false;
    if (matcher.titulo && !matcher.titulo.test(resource.titulo || "")) return false;
    return true;
  }) || null;
}

// Links da Receita apontam para um compartilhamento Nextcloud. O arquivo em si
// sai em /download, que redireciona para o WebDAV público.
function downloadUrlFor(link) {
  const clean = String(link || "").trim().replace(/\/+$/, "");
  if (/\/index\.php\/s\/[^/]+$/.test(clean)) {
    return `${clean}/download`;
  }
  return clean;
}

function filenameFromDisposition(header) {
  if (!header) return null;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) return decodeURIComponent(utf8[1].trim());
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1].trim() : null;
}

async function inspectRemote(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "user-agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} em ${url}`);
    }
    const length = response.headers.get("content-length");
    return {
      finalUrl: response.url,
      lastModified: response.headers.get("last-modified"),
      contentLength: length ? Number(length) : null,
      contentType: response.headers.get("content-type"),
      filename: filenameFromDisposition(response.headers.get("content-disposition")),
    };
  } finally {
    clearTimeout(timer);
  }
}

// Compartilhamento de pasta (caso do CNPJ, uma subpasta por mês). O HEAD
// tentaria zipar tudo; o PROPFIND lista as entradas com data e sem conteúdo.
function davFolderUrlFor(link) {
  const match = String(link || "").match(/\/index\.php\/s\/([^/]+)/);
  return match
    ? `https://arquivos.receitafederal.gov.br/public.php/dav/files/${match[1]}/`
    : null;
}

function parseDavListing(xml) {
  const entries = [];
  for (const block of xml.split(/<d:response>/i).slice(1)) {
    const href = block.match(/<d:href>([^<]+)<\/d:href>/i);
    const modified = block.match(/<d:getlastmodified>([^<]*)<\/d:getlastmodified>/i);
    if (!href) continue;
    const name = decodeURIComponent(href[1]).split("/").filter(Boolean).pop();
    entries.push({ nome: name, lastModified: modified ? modified[1] : null });
  }
  return entries;
}

async function inspectFolder(link) {
  const url = davFolderUrlFor(link);
  if (!url) {
    throw new Error(`Link ${link} não é um compartilhamento de pasta conhecido.`);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FOLDER_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "PROPFIND",
      headers: { depth: "1", "user-agent": USER_AGENT },
      signal: controller.signal,
    });
    if (response.status !== 207) {
      throw new Error(`HTTP ${response.status} em ${url}`);
    }
    const entries = parseDavListing(await response.text());
    const [root, ...children] = entries;
    const months = children
      .map((entry) => entry.nome)
      .filter((name) => /^\d{4}-\d{2}$/.test(name))
      .sort();
    return {
      finalUrl: url,
      lastModified: root?.lastModified || null,
      contentLength: null,
      contentType: "pasta",
      filename: null,
      pastas: months.length,
      ultimaPasta: months.at(-1) || null,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Desatualizado quando não há arquivo local, quando a origem mudou de URL,
// data ou tamanho, ou quando a origem não informa data (não dá para confiar).
function isStale(current, remote) {
  if (!current || !current.arquivo) return true;
  if (current.link !== remote.link) return true;
  if (!remote.lastModified) return true;
  if (current.lastModified !== remote.lastModified) return true;
  if (
    remote.contentLength != null
    && current.contentLength != null
    && remote.contentLength !== current.contentLength
  ) {
    return true;
  }
  return false;
}

function manifestPath(dir) {
  return path.join(dir, "manifest.json");
}

async function readManifest(dir) {
  try {
    return JSON.parse(await fsp.readFile(manifestPath(dir), "utf8"));
  } catch {
    return { conjunto: null, recursos: {} };
  }
}

async function writeManifest(dir, manifest) {
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(manifestPath(dir), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function downloadToFile(url, destination) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": USER_AGENT },
  });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} em ${url}`);
  }
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  const partial = `${destination}.part`;
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(partial));
  const { size } = await fsp.stat(partial);
  await fsp.rm(destination, { force: true });
  await fsp.rename(partial, destination);
  return size;
}

function csvMembers(entries) {
  return entries
    .map((entry) => entry.replace(/\\/g, "/").replace(/^\.\//, ""))
    .filter((entry) => entry.toLowerCase().endsWith(".csv") && !entry.endsWith("/"));
}

function listZipEntries(zipPath) {
  return new Promise((resolve, reject) => {
    const child = spawn("tar", ["-tf", zipPath], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr.trim() || `tar encerrou com código ${code} ao listar o ZIP`));
      else resolve(stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
    });
  });
}

function extractZipMembers(zipPath, dir, members) {
  return new Promise((resolve, reject) => {
    const child = spawn("tar", ["-xf", zipPath, "-C", dir, ...members], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr.trim() || `tar encerrou com código ${code} ao extrair o ZIP`));
      else resolve();
    });
  });
}

async function extractCsvs(zipPath, dir, expected = []) {
  await fsp.mkdir(dir, { recursive: true });
  const members = csvMembers(await listZipEntries(zipPath));
  const missing = expected.filter((name) => !members.some((member) => path.basename(member).toLowerCase() === name.toLowerCase()));
  if (!members.length) throw new Error(`O ZIP ${path.basename(zipPath)} não contém CSV.`);
  if (missing.length) throw new Error(`Faltam CSV no ZIP ${path.basename(zipPath)}: ${missing.join(", ")}`);
  await extractZipMembers(zipPath, dir, members);
  return members.map((member) => path.basename(member));
}

function csvsPresent(dir, names) {
  return names.every((name) => {
    try {
      return fs.statSync(path.join(dir, name)).size > 0;
    } catch {
      return false;
    }
  });
}

function localFileOk(dir, entry) {
  if (!entry || !entry.arquivo) return false;
  try {
    const { size } = fs.statSync(path.join(dir, entry.arquivo));
    return entry.contentLength == null || size === entry.contentLength;
  } catch {
    return false;
  }
}

async function syncTarget(target, token, options = {}) {
  const dir = path.join(DATA_DIR, target.conjunto);
  const localPath = path.join(dir, target.arquivo);
  if (target.conferir === false && fs.existsSync(localPath)) {
    return {
      codigo: target.codigo,
      conjunto: target.conjunto,
      arquivo: target.arquivo,
      acao: "mantido",
      lastModified: null,
      ultimaPasta: null,
      bytes: fs.statSync(localPath).size,
      caminho: localPath,
    };
  }
  const dataset = await findDataset(target.conjunto, token);
  const resource = pickResource(dataset, target.recurso);
  if (!resource) {
    throw new Error(`Recurso ${JSON.stringify(target.recurso)} não existe em ${target.conjunto}.`);
  }
  const link = target.pasta ? resource.link : downloadUrlFor(resource.link);
  const remote = {
    link,
    ...(target.pasta ? await inspectFolder(resource.link) : await inspectRemote(link)),
  };
  const manifest = await readManifest(dir);
  manifest.conjunto = {
    id: dataset.id,
    nome: dataset.nome,
    titulo: dataset.titulo,
    organizacao: dataset.organizacao,
    periodicidade: dataset.periodicidade,
    atualizacaoMetadados: dataset.dataUltimaAtualizacaoMetadados || null,
    conferidoEm: new Date().toISOString(),
  };
  const current = manifest.recursos[target.arquivo] || null;
  const stale = options.force || isStale(current, remote) || !localFileOk(dir, current);

  const entry = {
    codigo: target.codigo,
    recursoId: resource.id,
    titulo: resource.titulo,
    formato: resource.formato,
    link,
    finalUrl: remote.finalUrl,
    lastModified: remote.lastModified,
    contentLength: remote.contentLength,
    nomeOrigem: remote.filename,
    pastas: remote.pastas ?? null,
    ultimaPasta: remote.ultimaPasta ?? null,
    arquivo: current?.arquivo || null,
    baixadoEm: current?.baixadoEm || null,
    bytes: current?.bytes ?? null,
    conferidoEm: new Date().toISOString(),
  };

  let acao = "atual";
  if (!target.baixar) {
    acao = "vigiado";
  } else if (stale) {
    const bytes = await downloadToFile(link, path.join(dir, target.arquivo));
    entry.arquivo = target.arquivo;
    entry.baixadoEm = new Date().toISOString();
    entry.bytes = bytes;
    acao = current?.arquivo ? "atualizado" : "baixado";
  }

  if (target.extrairCsv && entry.arquivo) {
    const zipPath = path.join(dir, entry.arquivo);
    const refresh = acao === "baixado" || acao === "atualizado" || !csvsPresent(dir, target.extrairCsv);
    if (refresh) {
      if (acao === "baixado" || acao === "atualizado") {
        await Promise.all(target.extrairCsv.map((name) => fsp.rm(path.join(dir, name), { force: true })));
      }
      entry.extraidos = await extractCsvs(zipPath, dir, target.extrairCsv);
      if (acao === "atual") acao = "extraido";
    } else {
      entry.extraidos = current?.extraidos || target.extrairCsv;
    }
  }

  manifest.recursos[target.arquivo] = entry;
  await writeManifest(dir, manifest);
  return {
    codigo: target.codigo,
    conjunto: target.conjunto,
    arquivo: target.arquivo,
    acao,
    lastModified: remote.lastModified,
    ultimaPasta: remote.ultimaPasta || null,
    bytes: entry.bytes,
    caminho: entry.arquivo ? path.join(dir, entry.arquivo) : null,
  };
}

async function syncDadosGov(options = {}) {
  const token = requireToken();
  const only = options.only || [];
  const results = [];
  for (const target of TARGETS) {
    if (only.length && !only.includes(target.codigo)) continue;
    try {
      results.push(await syncTarget(target, token, options));
    } catch (error) {
      results.push({
        codigo: target.codigo,
        conjunto: target.conjunto,
        arquivo: target.arquivo,
        acao: "erro",
        erro: error.message,
      });
    }
  }
  return results;
}

module.exports = {
  DATA_DIR,
  TARGETS,
  csvMembers,
  csvsPresent,
  davFolderUrlFor,
  downloadUrlFor,
  extractCsvs,
  filenameFromDisposition,
  isStale,
  parseDavListing,
  pickResource,
  syncDadosGov,
};
