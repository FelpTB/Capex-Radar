// Consultas de busca por empresa do teste de monitoramento (capex_radar).
//
// A consulta do Google News RSS tem três partes:
//   (termos da empresa com OR) (contexto do nicho com OR) -exclusões after:/before:
// O contexto é obrigatório: marca sozinha traz resultado financeiro, de
// varejo ou de homônimos; com uma palavra de obra ou de investimento, a
// notícia tende a falar de um ativo físico.
const { googleNewsRssUrl } = require("./news-queries");

const TIPOS_INCLUSAO = ["marca", "razao_social", "variacao"];

function limpar(termo) {
  return String(termo || "").replace(/["“”]/g, "").replace(/\s+/g, " ").trim();
}

// Termos da empresa e exclusões vão sempre entre aspas: "C.Vale", "3corações"
// e "Amazon Brasil" precisam casar como frase.
function frase(termo) {
  const t = limpar(termo);
  return t ? `"${t}"` : "";
}

// Contexto de uma palavra fica sem aspas para o Google aceitar variações
// (investimento/investimentos); expressões compostas vão entre aspas.
function palavraContexto(termo) {
  const t = limpar(termo);
  if (!t) return "";
  return /\s/.test(t) ? `"${t}"` : t;
}

function grupoOr(itens) {
  const unicos = [...new Set(itens.filter(Boolean))];
  if (!unicos.length) return "";
  return unicos.length === 1 ? unicos[0] : `(${unicos.join(" OR ")})`;
}

function dataIso(valor) {
  if (!valor) return null;
  const texto = valor instanceof Date ? valor.toISOString() : String(valor);
  const m = texto.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) throw new Error(`Data inválida para a busca: ${valor}`);
  return m[1];
}

/**
 * Monta a consulta do Google News para uma empresa.
 * @param {object} p
 * @param {string[]} p.termos      marca, razão social e variações
 * @param {string[]} [p.contexto]  palavras do nicho (pelo menos uma precisa aparecer)
 * @param {string[]} [p.exclusoes] frases que descartam o resultado
 * @param {string|Date} [p.desde]  início da janela (after:)
 * @param {string|Date} [p.ate]    fim da janela (before:)
 */
function consultaGoogleNews({ termos, contexto = [], exclusoes = [], desde, ate } = {}) {
  const empresa = grupoOr((termos || []).map(frase));
  if (!empresa) throw new Error("A consulta precisa de pelo menos um termo da empresa.");
  const partes = [empresa];
  const ctx = grupoOr(contexto.map(palavraContexto));
  if (ctx) partes.push(ctx);
  for (const exclusao of exclusoes) {
    const f = frase(exclusao);
    if (f) partes.push(`-${f}`);
  }
  const inicio = dataIso(desde);
  const fim = dataIso(ate);
  if (inicio) partes.push(`after:${inicio}`);
  if (fim) partes.push(`before:${fim}`);
  return partes.join(" ");
}

/**
 * Separa as linhas de capex_radar.grupo_termos (ativas) em termos e exclusões.
 * @param {{termo: string, tipo: string, ativo?: boolean}[]} linhas
 */
function separarTermos(linhas) {
  const ativas = (linhas || []).filter((l) => l.ativo !== false);
  const ordem = (tipo) => TIPOS_INCLUSAO.indexOf(tipo);
  return {
    termos: ativas
      .filter((l) => TIPOS_INCLUSAO.includes(l.tipo))
      .sort((a, b) => ordem(a.tipo) - ordem(b.tipo))
      .map((l) => l.termo),
    exclusoes: ativas.filter((l) => l.tipo === "exclusao").map((l) => l.termo),
  };
}

/**
 * Converte a entrada de um grupo no seed termos-busca.json em linhas de
 * capex_radar.grupo_termos.
 */
function linhasDoSeed(entrada) {
  const linhas = [];
  for (const tipo of [...TIPOS_INCLUSAO, "exclusao"]) {
    for (const termo of entrada?.[tipo] || []) {
      const t = limpar(termo);
      if (t) linhas.push({ termo: t, tipo });
    }
  }
  return linhas;
}

/** Consulta e URL do RSS para um grupo, a partir das linhas do banco. */
function buscaDoGrupo({ linhas, contexto, desde, ate }) {
  const { termos, exclusoes } = separarTermos(linhas);
  const consulta = consultaGoogleNews({ termos, contexto, exclusoes, desde, ate });
  return { consulta, url: googleNewsRssUrl(consulta) };
}

module.exports = { consultaGoogleNews, separarTermos, linhasDoSeed, buscaDoGrupo };
