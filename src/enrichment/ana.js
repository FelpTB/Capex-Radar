const USER_AGENT = "RadarCapEx-MVP/0.1 (research; contact via project owner)";

const LAYERS = [
  {
    esfera: "federal",
    url: "https://portal1.snirh.gov.br/server/rest/services/Hosted/outorgas_federais_superficial/FeatureServer/0/query",
  },
  {
    esfera: "estadual",
    url: "https://portal1.snirh.gov.br/arcgis/rest/services/DADOSABERTOS/outorgas_estaduais_superficial/FeatureServer/0/query",
  },
];

function cnpjRootMask(cnpj) {
  const digits = String(cnpj || "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  const root = digits.slice(0, 8);
  return `${root.slice(0, 2)}.${root.slice(2, 5)}.${root.slice(5, 8)}`;
}

function anaWhere(cnpj) {
  const mask = cnpjRootMask(cnpj);
  if (!mask) return null;
  return `emp_nu_cpfcnpj LIKE '${mask}%'`;
}

const OUT_FIELDS = [
  "emp_nm_empreendimento",
  "emp_nm_responsavel",
  "emp_nu_cpfcnpj",
  "ing_nm_municipio",
  "ing_sg_ufmunicipio",
  "int_nm_corpohidrico",
  "tin_ds",
  "tfn_ds",
  "tch_ds",
  "tsu_ds",
  "tsp_ds",
  "tsf_ds",
  "tdm_ds",
  "out_tp_ato",
  "out_nu_ato",
  "out_nu_processo",
  "out_dt_outorgainicial",
  "out_dt_outorgafinal",
  "outorga_valida",
  "int_qt_vazaomedia",
  "int_qt_vazaomaxima",
  "int_qt_volumeanual",
  "int_nu_cnarh",
  "org_nm",
  "int_nu_latitude",
  "int_nu_longitude",
].join(",");

function isoFromEpoch(value) {
  const stamp = Number(value);
  if (!Number.isFinite(stamp) || stamp <= 0) return null;
  return new Date(stamp).toISOString().slice(0, 10);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mapOutorga(feature, esfera) {
  const row = feature?.attributes || {};
  if (!row.emp_nm_empreendimento && !row.emp_nu_cpfcnpj) return null;
  return {
    empreendimento: row.emp_nm_empreendimento || null,
    responsavel: row.emp_nm_responsavel || null,
    cnpj: row.emp_nu_cpfcnpj || null,
    municipio: row.ing_nm_municipio || null,
    uf: row.ing_sg_ufmunicipio || null,
    corpo: row.int_nm_corpohidrico || null,
    ato: row.out_tp_ato || null,
    numero_ato: row.out_nu_ato || null,
    processo: row.out_nu_processo || null,
    inicio: isoFromEpoch(row.out_dt_outorgainicial),
    fim: isoFromEpoch(row.out_dt_outorgafinal),
    valida: row.outorga_valida === 1 || row.outorga_valida === "1",
    uso: row.tin_ds || null,
    finalidade: row.tfn_ds || null,
    corpo_tipo: row.tch_ds || null,
    manancial: row.tsu_ds || null,
    direito: row.tsp_ds || null,
    situacao: row.tsf_ds || null,
    dominio: row.tdm_ds || null,
    vazao_media_m3h: numberOrNull(row.int_qt_vazaomedia),
    vazao_maxima_m3h: numberOrNull(row.int_qt_vazaomaxima),
    volume_anual_m3: numberOrNull(row.int_qt_volumeanual),
    cnarh: row.int_nu_cnarh || null,
    orgao: row.org_nm || null,
    latitude: numberOrNull(row.int_nu_latitude),
    longitude: numberOrNull(row.int_nu_longitude),
    esfera,
  };
}

async function readLayer(layer, where, { limit = 12, order = true } = {}) {
  const url = new URL(layer.url);
  url.searchParams.set("where", where);
  url.searchParams.set("outFields", OUT_FIELDS);
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("resultRecordCount", String(limit));
  if (order) url.searchParams.set("orderByFields", "outorga_valida DESC, int_qt_volumeanual DESC");
  url.searchParams.set("f", "json");
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} na ANA (${layer.esfera})`);
  const body = await response.json();
  if (body.error) {
    const message = body.error.message || "A ANA recusou a consulta.";
    if (order && /order|campo|field/i.test(message)) {
      return readLayer(layer, where, { limit, order: false });
    }
    throw new Error(message);
  }
  return (body.features || []).map((feature) => mapOutorga(feature, layer.esfera)).filter(Boolean);
}

function signature(row) {
  return [row.cnarh, row.municipio, row.uso, row.inicio, row.volume_anual_m3, row.empreendimento].join("|");
}

async function queryLayer(layer, where) {
  let ranked = [];
  try {
    ranked = await readLayer(layer, `${where} AND int_qt_volumeanual > 0`, { limit: 6 });
  } catch (_error) {
    return readLayer(layer, where, { limit: 6 });
  }
  if (ranked.length >= 6) return ranked;
  const rest = await readLayer(layer, where, { limit: 6 });
  const seen = new Set(ranked.map(signature));
  for (const row of rest) {
    const key = signature(row);
    if (seen.has(key)) continue;
    ranked.push(row);
    seen.add(key);
    if (ranked.length >= 6) break;
  }
  return ranked;
}

async function queryAna(cnpj) {
  const where = anaWhere(cnpj);
  if (!where) return [];
  const groups = await Promise.all(LAYERS.map((layer) => queryLayer(layer, where)));
  return groups.flatMap((rows) => rows.slice(0, 6)).slice(0, 12);
}

module.exports = { anaWhere, cnpjRootMask, mapOutorga, queryAna };
