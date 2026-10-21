const { spawn } = require("node:child_process");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { parseDbf } = require("./dbf");
const { fold } = require("./resolve");

const CACHE = path.join(process.cwd(), "data", "cache", "sigmine");
const USER_AGENT = "RadarCapEx-MVP/0.1 (research; contact via project owner)";

function zipUrl(uf) {
  return `https://dadosabertos.anm.gov.br/SIGMINE/PROCESSOS_MINERARIOS/${uf}.zip`;
}

function holderTerm(razao) {
  const folded = fold(razao).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const words = folded.split(" ").filter((word) => !["sa", "s", "a", "ltda", "me", "epp", "eireli"].includes(word));
  return words.slice(0, 3).join(" ");
}

function matchTitular(rows, razao) {
  const term = holderTerm(razao);
  if (!term || term.length < 4) return [];
  const seen = new Set();
  const hits = [];
  for (const row of rows) {
    const nome = fold(row.NOME || "");
    if (!nome.includes(term)) continue;
    const processo = row.PROCESSO || row.DSProcesso;
    if (!processo || seen.has(processo)) continue;
    seen.add(processo);
    hits.push({
      processo,
      fase: row.FASE || null,
      titular: row.NOME || null,
      substancia: row.SUBS || null,
      uso: row.USO || null,
      uf: row.UF || null,
      area_ha: row.AREA_HA || null,
      ultimo_evento: row.ULT_EVENTO || null,
    });
  }
  return hits;
}

function extractDbf(zipPath, uf, destination) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destination);
    const tar = spawn("tar", ["-xOf", zipPath, `${uf}.dbf`], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    tar.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    tar.stdout.pipe(output);
    let code = null;
    let finished = false;
    const done = () => {
      if (code === null || !finished) return;
      if (code !== 0) reject(new Error(stderr.trim() || `tar encerrou com código ${code}`));
      else resolve();
    };
    tar.on("error", reject);
    output.on("error", reject);
    tar.on("close", (exit) => {
      code = exit;
      done();
    });
    output.on("finish", () => {
      finished = true;
      done();
    });
  });
}

async function dbfBuffer(uf) {
  const code = String(uf || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  await fsp.mkdir(CACHE, { recursive: true });
  const dbfPath = path.join(CACHE, `${code}.dbf`);
  if (fs.existsSync(dbfPath)) {
    const cached = fs.readFileSync(dbfPath);
    if (cached.length > 64 && cached[0] === 0x03) return cached;
  }
  const zipPath = path.join(CACHE, `${code}.zip`);
  const response = await fetch(zipUrl(code), {
    headers: { "user-agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(180000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} no ZIP do SIGMINE ${code}`);
  await fsp.writeFile(zipPath, Buffer.from(await response.arrayBuffer()));
  await extractDbf(zipPath, code, dbfPath);
  return fs.readFileSync(dbfPath);
}

async function querySigmine(project) {
  if (!project?.uf) return [];
  const buffer = await dbfBuffer(project.uf);
  if (!buffer) return [];
  return matchTitular(parseDbf(buffer), project.empresa_nome);
}

module.exports = {
  holderTerm,
  matchTitular,
  querySigmine,
  zipUrl,
};
