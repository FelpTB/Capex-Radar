const { fold, chaveMunicipio, citaMunicipio: textoCitaMunicipio } = require("./resolve");
const classes = require("../capex-classes");

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
  return fold(municipio).includes(local) || chaveMunicipio(municipio).includes(chaveMunicipio(project?.municipio)) || line?.no_municipio ? "mesmo_municipio" : "outro_municipio";
}

// ---------------------------------------------------------------------------
// Pré-triagem, sem modelo (análise de 9.228 registros do reprocessamento de
// nov/2026: 124 com correlação direta, 117 deles citando o município da obra).
//   - registro que não cita o município do projeto (nem a filial do
//     município, nem o código IBGE) aproveitava 0,1%;
//   - registro de mais de 2 anos antes do anúncio, 0,2% (a matrícula de obra
//     no CNO fica de fora desta regra: a obra pode começar antes da notícia;
//     licença prévia/de instalação e outorga têm limite de 5 anos);
//   - ato de rotina sem ato de obra/licença (multa, débito de ICMS, pregão,
//     ata, comunicado), 0,2%.
// Só o que passa vai para o julgamento; o resto fica registrado com o motivo.
// Nos dados de nov/2026 a regra corta ~92% do volume e mantém ~95% das diretas.
// ---------------------------------------------------------------------------

const ATO_OBRA = /licen[cç]a|\b(lp|li|lo|las)\b|outorga|autoriza[cç][aã]o|obra nova|acr[eé]scimo|amplia[cç][aã]o|terraplenagem|supress[aã]o|\beia\b|\brima\b|audi[eê]ncia p[uú]blica|subesta[cç]|rede b[aá]sica|financiamento|implanta[cç][aã]o|constru[cç][aã]o|incentivo|benef[ií]cio fiscal|prodepe|prodec|fundopem|desenvolve|protocolo de inten/;
const ROTINA = /patrocin|maratona|evento cultural|auto de infra[cç]|multa|icms|d[eé]bito|leil[aã]o|preg[aã]o|alvar[aá] sanit[aá]rio|ve[ií]culo|detran|ata d[ae] reuni|assembleia|balan[cç]o|dividendo|intima[cç]|notifica[cç]|penalidade|advert[eê]ncia|dispensa de/;
const ANOS_ANTES = 2;
const ANOS_ANTES_LICENCA = 5;
const LICENCA = /licen[cç]a (pr[eé]via|de instala)|\b(lp|li)\b|outorga|\beia\b|\brima\b/;

function anosDesde(data, referencia) {
  if (!data || !referencia) return null;
  const d = new Date(data);
  const r = new Date(referencia);
  if (Number.isNaN(d.getTime()) || Number.isNaN(r.getTime())) return null;
  return (d - r) / (365.25 * 86_400_000);
}

const DATA_CAMPOS = ["data_contratacao", "data_emissao", "emissao", "data_referencia", "inicio", "data_inicio", "data_publicacao", "data", "publicado_em", "entrada_operacao", "inicio_vigencia"];

function dataDaLinha(line) {
  for (const campo of DATA_CAMPOS) if (line?.[campo]) return String(line[campo]).slice(0, 10);
  return null;
}

/**
 * Devolve null quando o registro deve ser julgado, ou o motivo para não ser.
 * project: { municipio, codigo_ibge, filial_cnpj, data_anuncio | status_em }.
 */
function preTriagem(line, project, codigo = "") {
  const { contexto, url, link, rank, ...campos } = line || {};
  const texto = fold(`${contexto || ""} ${JSON.stringify(campos)}`);
  const digitos = JSON.stringify(campos).replace(/\D/g, "") + String(contexto || "").replace(/\D/g, "");
  const municipio = fold(project?.municipio || "");
  const citaMunicipio = municipio.length >= 4 && (texto.includes(municipio) || textoCitaMunicipio(texto, project?.municipio));
  const citaFilial = String(project?.filial_cnpj || "").length === 14 && digitos.includes(String(project.filial_cnpj));
  const mesmoIbge = project?.codigo_ibge && line?.ibge && String(line.ibge) === String(project.codigo_ibge);
  // Projeto sem município (só UF, várias localidades): não dá para exigir o local.
  if (municipio.length >= 4 && !citaMunicipio && !citaFilial && !mesmoIbge && !line?.no_municipio) {
    return "Pré-triagem: o registro não cita o município do projeto";
  }
  const anos = anosDesde(dataDaLinha(line), project?.data_anuncio || project?.status_em);
  // Licença prévia/de instalação e outorga costumam sair anos antes da notícia.
  const limite = LICENCA.test(texto) ? ANOS_ANTES_LICENCA : ANOS_ANTES;
  if (codigo !== "SEC-CNO" && anos != null && anos < -limite) {
    return `Pré-triagem: registro de mais de ${limite} anos antes do anúncio`;
  }
  if (ROTINA.test(texto) && !ATO_OBRA.test(texto)) return "Pré-triagem: ato de rotina, sem obra nem licença";
  return null;
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
// onAnalise(linha, correlacao, motivo) recebe cada registro analisado, aceito
// ou não (Enriquecimento 2 grava todos em registros_analisados). Com
// semJulgamento, nenhum registro é aceito: todos saem como nao_avaliada, para
// o julgamento ser feito fora (Claude Code) e aplicado depois.
async function correlateLines(project, codigo, lines, { judge = null, onAnalise = null, semJulgamento = false, preTriar = true, municipioBasta = true } = {}) {
  const resumo = { avaliadas: 0, diretas: 0, outro_estado: 0, pre_triagem: 0, outro_projeto: 0, incerta: 0, nao_avaliadas: 0, metodo: semJulgamento ? "externo" : judge ? "contexto" : "municipio" };
  // onAnalise(linha, correlacao, motivo, probabilidade): a probabilidade (0-100) define a classe (capex-classes.js).
  const analisar = (line, correlacao, motivo, probabilidade = null) => { if (onAnalise) onAnalise(line, correlacao, motivo, probabilidade); };
  const items = lines.map((line) => ({ line, gate: localGate(line, project) }));
  const candidates = [];
  for (const item of items) {
    if (item.gate === "outro_estado") { resumo.outro_estado += 1; analisar(item.line, "outro_estado", "UF do registro diferente da UF do projeto.", 0); continue; }
    const motivo = preTriar ? preTriagem(item.line, project, codigo) : null;
    if (motivo) { resumo.pre_triagem += 1; analisar(item.line, "outro_projeto", motivo, 5); continue; }
    candidates.push(item);
  }
  candidates.sort((a, b) => Number(b.gate === "mesmo_municipio") - Number(a.gate === "mesmo_municipio"));
  if (semJulgamento) {
    for (const item of candidates) analisar(item.line, "nao_avaliada", `Local: ${item.gate}`);
    resumo.nao_avaliadas = candidates.length;
    return { kept: [], resumo };
  }
  const avaliados = candidates.slice(0, MAX_AVALIADOS);
  resumo.nao_avaliadas = candidates.length - avaliados.length;
  for (const item of candidates.slice(MAX_AVALIADOS)) analisar(item.line, "nao_avaliada", "Fora do limite de registros lidos por fonte.");
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
    // Sem julgamento (modelo fora do ar): no MVP o município da ficha basta
    // (municipioBasta); no capex_radar ele só põe o registro como
    // possibilidade (incerta), nunca na linha do tempo.
    const verdict = verdicts.get(item) || (resumo.metodo === "municipio"
      ? { probabilidade: item.gate === "mesmo_municipio" ? (municipioBasta ? 80 : 55) : (municipioBasta ? 55 : 35), motivo: "Sem leitura do contexto; vale o município da ficha." }
      : { probabilidade: 50, motivo: "O modelo não avaliou o registro." });
    const probabilidade = verdict.probabilidade ?? classes.probabilidadeDaCorrelacao(verdict.correlacao);
    const classe = classes.classeDe(probabilidade);
    const correlacao = classes.correlacaoDaClasse(classe);
    resumo[classe] = (resumo[classe] || 0) + 1;
    analisar(item.line, correlacao, verdict.motivo || null, probabilidade);
    if (!classes.ligaLinhaDoTempo(classe)) continue;
    const { contexto, ...line } = item.line;
    kept.push({ ...line, correlacao: verdict.motivo, probabilidade });
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

module.exports = { MAX_AVALIADOS, contextText, correlateLines, linesOf, localGate, preTriagem, rebuildFound };
