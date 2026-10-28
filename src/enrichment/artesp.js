const { spawnPython } = require("../python-exec");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { fold } = require("./resolve");

const ARTESP_PACKAGE =
  "https://dadosabertos.artesp.sp.gov.br/api/3/action/package_show?id=programacao-de-obras";
const RODOVIAS_RESOURCE = "256427be-db00-49cc-9c85-feb3348ac9c0";
const DATASTORE = "https://dadosabertos.artesp.sp.gov.br/api/3/action/datastore_search";
const PROGRAMAS = new Set(["CAPEX", "REVIT", "NS"]);

const LOTES = {
  L01: "AUTOBAN",
  L06: "INTERVIAS",
  L07: "ROTA DAS BANDEIRAS",
  L11: "RENOVIAS",
  L13: "COLINAS",
  L16: "CART",
  L19: "VIARONDON",
  L20: "SPVIAS",
  L21: "RODOVIAS DO TIETE",
  L22: "ECOVIAS IMIGRANTES",
  L23: "ECOVIAS LESTE PAULISTA",
  L24: "RODOANEL",
  L25: "SPMAR",
  L27: "TAMOIOS",
  L28: "ENTREVIAS",
  L29: "VIAPAULISTA",
  L30: "EIXO SP",
  L31: "ECOVIAS NOROESTE PAULISTA",
  L32: "NOVO LITORAL",
  L33: "ROTA SOROCABANA",
  L34: "ECOVIAS RAPOSO CASTELLO",
};

const STOP = new Set([
  "obra",
  "obras",
  "rodovia",
  "rodovias",
  "concessao",
  "concessionaria",
  "sao",
  "paulo",
  "sp",
  "projeto",
  "programa",
  "capex",
]);

function text(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const out = String(value).replace(/\s+/g, " ").trim();
  return out || null;
}

function localText(value) {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean).join("; ") || null;
  return text(value);
}

function isExampleName(name) {
  return /example|exemplo|template|schema|validar|mesclar|manual|circular|memorando/i.test(name || "");
}

function resourceBlob(resource) {
  return `${resource.name || ""} ${resource.description || ""} ${resource.format || ""} ${resource.url || ""}`;
}

function pickArtespResources(resources) {
  const list = resources || [];
  const geoReal = list.filter((resource) => {
    const blob = resourceBlob(resource);
    return /geojson|\.geojson/i.test(blob) && /obra/i.test(blob) && !/conserva/i.test(blob) && !isExampleName(blob);
  });
  if (geoReal.length) {
    return { kind: "geojson", resources: geoReal, exemplo: false };
  }
  const xlsx = list.filter((resource) => {
    const blob = resourceBlob(resource);
    return /xlsx/i.test(blob) && /template.*obra|obras_202/i.test(blob) && !/conserva/i.test(blob);
  });
  if (xlsx.length) {
    return { kind: "xlsx", resources: xlsx, exemplo: true };
  }
  const geoExample = list.filter((resource) => {
    const blob = resourceBlob(resource);
    return /geojson|\.geojson/i.test(blob) && /obra/i.test(blob) && !/conserva/i.test(blob);
  });
  if (geoExample.length) {
    return { kind: "geojson", resources: geoExample.slice(0, 1), exemplo: true };
  }
  return null;
}

function mapArtespFeature(props, meta = {}) {
  const lote = text(props.lote)?.toUpperCase();
  const programa = text(props.programa)?.toUpperCase();
  const detalhe = text(props.detalhamento_servico);
  const rodovia = text(props.rodovia);
  if (!lote || !programa || !PROGRAMAS.has(programa) || !detalhe) return null;
  const concessionaria = LOTES[lote] || lote;
  const rodoviaNome = meta.rodovias?.[rodovia] || null;
  const id = text(props.id) || `${lote}:${rodovia}:${programa}:${detalhe}:${text(props.km_inicial)}`;
  return {
    chave: id,
    cnpj: null,
    cnpjs: [],
    titulo: `${concessionaria} — ${detalhe}`,
    uf: "SP",
    municipio: null,
    valor: null,
    payload: {
      id,
      lote,
      concessionaria,
      rodovia,
      rodovia_nome: rodoviaNome,
      programa,
      item: props.item == null ? null : String(props.item),
      subitem: props.subitem == null ? null : String(props.subitem),
      detalhamento_servico: detalhe,
      unidade: text(props.unidade),
      quantidade: props.quantidade == null ? null : Number(props.quantidade),
      km_inicial: props.km_inicial == null ? null : Number(props.km_inicial),
      km_final: props.km_final == null ? null : Number(props.km_final),
      local: localText(props.local),
      data_inicial: text(props.data_inicial),
      data_final: text(props.data_final),
      observacoes_gerais: text(props.observacoes_gerais),
      arquivo: meta.arquivo || null,
      exemplo: Boolean(meta.exemplo),
    },
  };
}

function artespRecordsFromGeojson(body, meta = {}) {
  const features = Array.isArray(body?.features) ? body.features : [];
  return features
    .map((feature) => mapArtespFeature(feature.properties || {}, meta))
    .filter(Boolean);
}

function artespRecordsFromRows(rows, meta = {}) {
  return (rows || []).map((row) => mapArtespFeature(row, meta)).filter(Boolean);
}

async function fetchRodovias(fetchImpl = fetch) {
  const url = `${DATASTORE}?resource_id=${RODOVIAS_RESOURCE}&limit=5000`;
  const response = await fetchImpl(url, {
    headers: { "user-agent": "RadarCapEx-MVP/0.1", accept: "application/json" },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} no datastore de rodovias da ARTESP`);
  const body = await response.json();
  const map = {};
  for (const row of body.result?.records || []) {
    if (row.codigo && row.rodovia) map[String(row.codigo)] = String(row.rodovia);
  }
  return map;
}

function readXlsxRows(filePath) {
  const outPath = `${filePath}.rows.json`;
  const script = `
import json, openpyxl, warnings
warnings.filterwarnings("ignore")
wb = openpyxl.load_workbook(${JSON.stringify(filePath)}, read_only=True, data_only=True)
ws = wb["Dados"] if "Dados" in wb.sheetnames else wb.active
rows = list(ws.iter_rows(values_only=True))
header = [str(cell or "").strip() for cell in rows[0]]
out = []
for row in rows[1:]:
    if not any(cell is not None and str(cell).strip() for cell in row):
        continue
    item = {}
    for index, name in enumerate(header):
        if not name:
            continue
        value = row[index] if index < len(row) else None
        if hasattr(value, "isoformat"):
            value = value.isoformat()
        item[name] = value
    out.append(item)
with open(${JSON.stringify(outPath)}, "w", encoding="utf-8") as handle:
    json.dump(out, handle, ensure_ascii=False)
`;
  return new Promise((resolve, reject) => {
    const child = spawnPython(["-c", script], {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Python saiu com código ${code}`));
        return;
      }
      try {
        const text = await fsp.readFile(outPath, "utf8");
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function artespTokens(project) {
  const textValue = fold(`${project?.nome || ""} ${project?.empresa_nome || ""}`);
  const words = textValue
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !STOP.has(word));
  return [...new Set(words)].slice(0, 6);
}

function concessionariaAliases(name) {
  const folded = fold(name || "");
  return Object.entries(LOTES)
    .filter(([, label]) => fold(label).includes(folded) || folded.includes(fold(label).split(" ")[0]))
    .map(([lote]) => lote);
}

module.exports = {
  ARTESP_PACKAGE,
  LOTES,
  PROGRAMAS,
  artespRecordsFromGeojson,
  artespRecordsFromRows,
  artespTokens,
  concessionariaAliases,
  fetchRodovias,
  mapArtespFeature,
  pickArtespResources,
  readXlsxRows,
  resourceBlob,
};
