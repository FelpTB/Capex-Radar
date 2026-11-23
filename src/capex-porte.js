// Porte da obra: a área que a notícia dá ao projeto (construída e terreno) e
// o teto de probabilidade de uma obra do CNO muito maior que ela.
//
// Caso que motivou (Mercado Livre em Jacareí, 11/2026): a notícia fala em CD
// numa área de 300 mil m² (cerca de 150 mil construídos) e uma matrícula de
// 2,39 milhões de m² (terreno do condomínio logístico) entrou como provável.
// A obra não precisa ter a área exata, mas tem de ser do mesmo porte.

// Obra até este múltiplo da maior área da notícia é do porte do projeto.
const LIMITE_MAIOR = 3;
const TETO_FORA_DO_PORTE = 45; // improvável
const TETO_COM_MARCA = 59; // incerta: o nome cita a empresa, mas o porte não bate
// Área da notícia abaixo disto costuma ser de uma parte (câmara, sala,
// linha): não serve de régua para a obra inteira.
const AREA_MINIMA_REFERENCIA = 10000;

const NUMERO = String.raw`(\d{1,3}(?:[.\s]\d{3})+|\d+(?:,\d+)?)`;
const ESCALA = String.raw`(?:\s*(mil|milh(?:ão|ões|ao|oes)))?`;
const UNIDADE = String.raw`\s*(?:m²|m2|metros?\s+quadrados?)`;
const AREA_RE = new RegExp(`${NUMERO}${ESCALA}(?:\\s+de)?${UNIDADE}`, "gi");
const AREA_HA_RE = new RegExp(`${NUMERO}${ESCALA}\\s*(?:hectares?|ha)\\b`, "gi");

const CONSTRUIDA = /constru[íi]d|constru[çc][ãa]o|edifica|galp[ãa]o|armaz[ée]m|pr[ée]dio|instala[çc][õo]es|nave|planta|f[áa]brica|unidade|centro|data\s*center|[áa]rea\s+(?:constru|coberta|[úu]til)/gi;
const TERRENO = /terreno|[áa]rea\s+(?:total|de)\b|im[óo]vel|gleba|condom[íi]nio|em\s+uma\s+[áa]rea|ocupar[áa]/gi;

// Posição da última palavra do tipo no trecho (-1 sem nenhuma).
function ultima(re, trecho) {
  let pos = -1;
  for (const m of trecho.matchAll(re)) pos = m.index;
  return pos;
}

function numero(texto, escala) {
  const limpo = String(texto).replace(/[.\s](?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(limpo);
  if (!Number.isFinite(n)) return null;
  if (!escala) return n;
  return /^mil$/i.test(escala) ? n * 1e3 : n * 1e6;
}

/**
 * Áreas citadas num texto: [{ m2, tipo: 'construida' | 'terreno' | null }].
 * O tipo sai das palavras logo antes do número (até 60 caracteres).
 */
function areasDoTexto(texto) {
  const s = String(texto || "");
  const achadas = [];
  const ler = (re, fator) => {
    for (const m of s.matchAll(re)) {
      const n = numero(m[1], m[2]);
      if (!n) continue;
      const m2 = Math.round(n * fator);
      if (m2 < 100) continue;
      const antes = s.slice(Math.max(0, m.index - 60), m.index);
      // Vale a palavra mais perto do número ("centro em área de 300 mil m²" é terreno).
      const c = ultima(CONSTRUIDA, antes);
      const t = ultima(TERRENO, antes);
      const tipo = fator > 1 ? "terreno" : c < 0 && t < 0 ? null : t > c ? "terreno" : "construida";
      achadas.push({ m2, tipo });
    }
  };
  ler(AREA_RE, 1);
  ler(AREA_HA_RE, 10000);
  return achadas;
}

/**
 * Área do projeto a partir de textos (objeto, capacidade, manchetes, resumo,
 * trechos): { construida_m2, terreno_m2 }. Sem tipo, a área conta como
 * terreno (a maior que a notícia admite) se for a maior citada.
 */
function areaDosTextos(textos = []) {
  const todas = textos.flatMap((t) => areasDoTexto(t));
  if (!todas.length) return { construida_m2: null, terreno_m2: null };
  const max = (tipo) => {
    const v = todas.filter((a) => a.tipo === tipo).map((a) => a.m2);
    return v.length ? Math.max(...v) : null;
  };
  let construida = max("construida");
  let terreno = max("terreno");
  const semTipo = todas.filter((a) => !a.tipo).map((a) => a.m2);
  if (semTipo.length) {
    const maior = Math.max(...semTipo);
    if (!terreno || maior > terreno) terreno = maior;
    if (!construida && Math.min(...semTipo) < maior) construida = Math.min(...semTipo);
  }
  if (construida && terreno && construida > terreno) [construida, terreno] = [terreno, construida];
  return { construida_m2: construida, terreno_m2: terreno };
}

/** Maior área do projeto (terreno ou construída) ou null. */
function areaDeReferencia(perfil) {
  const v = [perfil?.area_terreno_m2, perfil?.area_construida_m2].map(Number).filter((n) => Number.isFinite(n) && n > 0);
  return v.length ? Math.max(...v) : null;
}

/** Área de uma obra do CNO: a soma das áreas de obra nova e acréscimo, ou a área total. */
function areaDaObra(registro) {
  const areas = Array.isArray(registro?.areas) ? registro.areas : [];
  const novas = areas.filter((a) => /obra nova|acr[ée]scimo/i.test(String(a.categoria || "")));
  const soma = novas.reduce((t, a) => t + (Number(String(a.metragem || "").replace(",", ".")) || 0), 0);
  if (soma > 0) return soma;
  const total = Number(String(registro?.area || "").replace(",", "."));
  return Number.isFinite(total) && total > 0 ? total : null;
}

const mil = (n) => (n >= 1e6 ? `${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} milhões de m²` : `${Math.round(n / 1000).toLocaleString("pt-BR")} mil m²`);

/**
 * Teto da probabilidade de uma obra do CNO pelo porte: { teto, motivo } ou
 * null quando o porte não limita (sem área na notícia ou na obra, ou obra do
 * porte do projeto). citaMarca: o nome da obra cita a empresa ou a marca.
 */
function tetoPorPorte(registro, perfil, { citaMarca = false } = {}) {
  const ref = areaDeReferencia(perfil);
  const obra = areaDaObra(registro);
  if (!ref || ref < AREA_MINIMA_REFERENCIA || !obra || obra <= ref * LIMITE_MAIOR) return null;
  const vezes = Math.round(obra / ref);
  return {
    teto: citaMarca ? TETO_COM_MARCA : TETO_FORA_DO_PORTE,
    motivo: `Porte: obra de ${mil(obra)}, ${vezes} vezes a área da notícia (${mil(ref)}); provável terreno ou complexo maior, não a obra do projeto.`,
  };
}

/**
 * A obra é da empresa: matrícula no CNPJ do grupo ou nome que cita a marca.
 * Nesse caso o teto por porte é o de incerta, não o de improvável.
 */
function citaEmpresa(registro, marcas = []) {
  if (["raiz", "raiz_grupo", "marca"].includes(registro?.origem_cno)) return true;
  const { citaMarca } = require("./enrichment/cno");
  return citaMarca(`${registro?.nome || ""} ${registro?.empresa || ""}`, marcas);
}

/** Aplica o teto a um veredito { probabilidade, motivo } de registro do CNO. */
function aplicarTeto(veredito, registro, perfil, opcoes) {
  const t = tetoPorPorte(registro, perfil, opcoes);
  if (!t || veredito.probabilidade == null || veredito.probabilidade <= t.teto) return veredito;
  return { ...veredito, probabilidade: t.teto, motivo: `${t.motivo} ${veredito.motivo || ""}`.trim().slice(0, 500), teto_porte: true };
}

module.exports = { citaEmpresa, areasDoTexto, areaDosTextos, areaDeReferencia, areaDaObra, tetoPorPorte, aplicarTeto, LIMITE_MAIOR };
