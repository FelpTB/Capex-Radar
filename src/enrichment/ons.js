const { spawn } = require("node:child_process");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { fold } = require("./resolve");

const CACHE = path.join(process.cwd(), "data", "cache", "ons");
const ARCHIVE = "https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/PublicacoesArquivos/publicacao-943/02.Documentos%20de%20Apoio%20do%20PET-PELP%202o%20Sem%202025.7z";
const USER_AGENT = "RadarCapEx-MVP/0.1 (research; contact via project owner)";

const UF_BY_NAME = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

const STOP = new Set(["linha", "energia", "transmissao", "projeto", "subestacao", "nova", "novo", "obras", "obra"]);

function ufSigla(name) {
  return UF_BY_NAME[fold(name)] || null;
}

function onsTokens(project) {
  const text = fold(`${project?.nome || ""} ${project?.empresa_nome || ""}`);
  const words = text.split(/[^a-z0-9]+/).filter((word) => word.length >= 5 && !STOP.has(word));
  return [...new Set(words)].slice(0, 4);
}

function mapOnsRow(item) {
  const nome = String(item["Nome do Empreendimento"] || "").trim();
  const codigo = String(item["Código Empreendimento"] || "").trim();
  if (!nome || !codigo) return null;
  const milhares = Number(String(item["Total Investimento ( 2025 ) R$ / 1000"] || "").replace(",", "."));
  return {
    chave: `${item._planilha || "pet"}:${codigo}`,
    cnpj: null,
    cnpjs: [],
    titulo: nome,
    uf: ufSigla(item["UF Origem"]),
    municipio: null,
    valor: Number.isFinite(milhares) ? milhares * 1000 : null,
    payload: {
      codigo,
      tipo: item["Tipo do Empreendimento"] || null,
      estudo: item.Estudo || null,
      uf_origem: item["UF Origem"] || null,
      uf_destino: item["UF Destino"] || null,
      uf_secc: item["UF Secc"] || null,
      itens: item["Itens de obra"] || null,
      leilao: item["Estimativa Leilão"] || null,
      necessidade: item["Data de Necessidade"] || null,
      tendencia: item["Data de Tendência"] || null,
      contratacao: item["Contratação"] || null,
      planilha: item._planilha || null,
    },
  };
}

const PYTHON = `
import json, pathlib, openpyxl
root = pathlib.Path(${JSON.stringify(CACHE)})
book = next(root.rglob("*.xlsx"))
wb = openpyxl.load_workbook(book, read_only=True, data_only=True)
out = []
for sheet in ("Empreendimentos_PET", "Empreendimentos_PELP"):
    if sheet not in wb.sheetnames:
        continue
    rows = wb[sheet].iter_rows(values_only=True)
    header = [str(cell).strip() if cell is not None else "" for cell in next(rows)]
    for row in rows:
        item = {}
        for index, key in enumerate(header):
            if not key or index >= len(row) or row[index] is None:
                continue
            item[key] = str(row[index])
        item["_planilha"] = sheet
        if item.get("Nome do Empreendimento"):
            out.append(item)
print(json.dumps(out, ensure_ascii=False))
`;

function readWorkbook() {
  return new Promise((resolve, reject) => {
    const child = spawn("py", ["-3", "-"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Python encerrou com código ${code}`));
        return;
      }
      resolve(JSON.parse(stdout));
    });
    child.stdin.end(PYTHON);
  });
}

async function ensureWorkbook() {
  await fsp.mkdir(CACHE, { recursive: true });
  const existing = fs.readdirSync(CACHE, { recursive: true }).some((name) => String(name).endsWith(".xlsx"));
  if (existing) return;
  const response = await fetch(ARCHIVE, {
    headers: { "user-agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} no arquivo do PET/PELP`);
  const archive = path.join(CACHE, "pet-apoio.7z");
  await fsp.writeFile(archive, Buffer.from(await response.arrayBuffer()));
  await new Promise((resolve, reject) => {
    const child = spawn("py", ["-3", "-"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr.trim() || "py7zr não extraiu o plano."));
      else resolve();
    });
    child.stdin.end(`
import py7zr, pathlib
pathlib.Path(${JSON.stringify(CACHE)}).mkdir(parents=True, exist_ok=True)
py7zr.SevenZipFile(${JSON.stringify(archive)}).extractall(${JSON.stringify(CACHE)})
`);
  });
}

async function onsRecords() {
  await ensureWorkbook();
  const rows = await readWorkbook();
  return rows.map(mapOnsRow).filter(Boolean);
}

module.exports = {
  ARCHIVE,
  mapOnsRow,
  onsRecords,
  onsTokens,
  ufSigla,
};
