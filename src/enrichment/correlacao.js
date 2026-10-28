const { fold } = require("./resolve");

// Registros lidos pelo modelo por fonte. Os do município da ficha vêm antes; o resto não é avaliado.
const MAX_AVALIADOS = 60;
const LOTE = 20;
const CONTEXTO = 1500;

const UF_RE = /^[A-Z]{2}$/;

function lineUf(line) {
  const uf = String(line?.uf || "").trim().toUpperCase();
  return UF_RE.test(uf) ? uf : null;
}

function lineMunicipio(line) {
  return line?.municipio || line?.municipios || line?.mun_solic || line?.entidade || null;
}

// Primeiro corte, sem modelo: registro com UF de outro estado é de outro projeto.
function localGate(line, project) {
  const uf = lineUf(line);
  if (uf && project?.uf && uf !== project.uf) return "outro_estado";
  const municipio = lineMunicipio(line);
  const local = fold(project?.municipio || "");
  if (!municipio || local.length < 3) return line?.no_municipio ? "mesmo_municipio" : "sem_local";
  return fold(municipio).includes(local) || line?.no_municipio ? "mesmo_municipio" : "outro_municipio";
}

// Texto que o modelo lê: o contexto largo do diário, quando houver, e os campos do registro.
function contextText(line) {
  const { contexto, url, link, rank, ...campos } = line || {};
  const fields = JSON.stringify(campos);
  return (contexto ? `${contexto}\n${fields}` : fields).slice(0, CONTEXTO);
}

function linesOf(found) {
  if (Array.isArray(found)) return found;
  return found?.candidatos || found?.linhas || [];
}

async function judgeAll(project, codigo, candidates, judge) {
  const verdicts = new Map();
  for (let start = 0; start < candidates.length; start += LOTE) {
    const lote = candidates.slice(start, start + LOTE);
    const registros = lote.map((item, index) => ({ i: index, local: item.gate, texto: contextText(item.line) }));
    const avaliacoes = await judge(project, codigo, registros);
    for (const avaliacao of avaliacoes) {
      const item = lote[avaliacao.i];
      if (item) verdicts.set(item, avaliacao);
    }
  }
  return verdicts;
}

// Separa as linhas com correlação direta com o projeto. Sem modelo, só o município da ficha passa.
async function correlateLines(project, codigo, lines, { judge = null } = {}) {
  const resumo = { avaliadas: 0, diretas: 0, outro_estado: 0, outro_projeto: 0, incerta: 0, nao_avaliadas: 0, metodo: judge ? "contexto" : "municipio" };
  const items = lines.map((line) => ({ line, gate: localGate(line, project) }));
  const candidates = [];
  for (const item of items) {
    if (item.gate === "outro_estado") resumo.outro_estado += 1;
    else candidates.push(item);
  }
  candidates.sort((a, b) => Number(b.gate === "mesmo_municipio") - Number(a.gate === "mesmo_municipio"));
  const avaliados = candidates.slice(0, MAX_AVALIADOS);
  resumo.nao_avaliadas = candidates.length - avaliados.length;
  resumo.avaliadas = avaliados.length;

  let verdicts = new Map();
  if (judge && avaliados.length) {
    try {
      verdicts = await judgeAll(project, codigo, avaliados, judge);
    } catch {
      resumo.metodo = "municipio";
    }
  }
  const kept = [];
  for (const item of avaliados) {
    const verdict = verdicts.get(item) || (resumo.metodo === "municipio"
      ? { correlacao: item.gate === "mesmo_municipio" ? "direta" : "incerta", motivo: "Sem leitura do contexto; vale o município da ficha." }
      : { correlacao: "incerta", motivo: "O modelo não avaliou o registro." });
    resumo[verdict.correlacao] = (resumo[verdict.correlacao] || 0) + 1;
    if (verdict.correlacao !== "direta") continue;
    const { contexto, ...line } = item.line;
    kept.push({ ...line, correlacao: verdict.motivo });
  }
  resumo.diretas = kept.length;
  delete resumo.direta;
  return { kept, resumo };
}

function inPeriod(value, since) {
  if (!since || !value) return false;
  const iso = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  return iso >= since;
}

// Remonta o retorno da fonte só com as linhas correlacionadas, no formato que cada anotação espera.
function rebuildFound(codigo, found, kept, { since = null, limite = 8 } = {}) {
  if (Array.isArray(found)) {
    const out = [...kept];
    if (codigo === "SEC-CVM-IPE") {
      out.total = kept.length;
      out.noPeriodo = kept.filter((row) => inPeriod(row.data_referencia, since)).length;
      out.lidos = kept.filter((row) => row.texto).length;
    }
    return out;
  }
  if (codigo === "SEC-BNDES") {
    return {
      n: kept.length,
      abertos: kept.filter((row) => !/^liquidad/i.test(row.situacao_contrato || "")).length,
      no_periodo: kept.filter((row) => inPeriod(row.data_contratacao, since)).length,
      linhas: kept.slice(0, 12),
    };
  }
  const { candidatos, ...rest } = found || {};
  return {
    ...rest,
    total: kept.length,
    ...(rest.no_municipio !== undefined ? { no_municipio: kept.filter((line) => line.no_municipio).length } : {}),
    linhas: kept.slice(0, limite),
  };
}

module.exports = { MAX_AVALIADOS, contextText, correlateLines, linesOf, localGate, rebuildFound };
