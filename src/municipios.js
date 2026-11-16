// Validação do município de um projeto.
//
// 1. API de cidades da ABC Advise (Busca Fornecedor): nome exato na UF,
//    sem diferença de acento e caixa. Devolve o nome oficial e o código IBGE.
// 2. Sem resultado, a lista de municípios da UF no IBGE: grafia muito
//    parecida ("Rancho Alegre do Oeste" → "Rancho Alegre D'Oeste") é
//    corrigida sozinha; o resto vira pendência com até 3 sugestões, para
//    revisão humana (ex.: "Monte Alegre/PR" é uma fazenda em Telêmaco Borba).
//
// Rede fora do ar não bloqueia a gravação: o resultado vem com
// verificado=false e o município fica como estava.

const API_CIDADES = process.env.API_CIDADES_URL?.trim() || "https://api-busca-cidades-buscafornecedor.up.railway.app";
const IBGE_UF = (uf) => `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(uf)}/municipios`;
const USER_AGENT = "Mozilla/5.0 (compatible; RadarCapEx/0.1)";

const chave = (s) => String(s || "")
  .normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
  .replace(/[’'`´]/g, " ").replace(/\bd\s+oeste\b/g, "do oeste")
  .replace(/\b(de|da|do|das|dos|d)\b/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function distancia(a, b) {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j += 1) d[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m][n];
}

const semelhanca = (a, b) => {
  const x = chave(a);
  const y = chave(b);
  if (!x || !y) return 0;
  return 1 - distancia(x, y) / Math.max(x.length, y.length);
};

async function json(url) {
  const r = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  const corpo = await r.json().catch(() => null);
  return { ok: r.ok, corpo };
}

// Nomes de todos os municípios (tabela da Receita, sem UF) para achar grafias
// parecidas; cada candidato é confirmado na UF pela API de cidades.
let nomesNacionais = null;
async function todosOsNomes() {
  if (!nomesNacionais) {
    const { pool } = require("./db");
    nomesNacionais = pool.query("select distinct descricao from cnpj_db.municipio").then((r) => r.rows.map((x) => x.descricao)).catch(() => []);
  }
  return nomesNacionais;
}

async function naApi(nome, uf) {
  const url = new URL(`${API_CIDADES}/api/cities/nearby`);
  url.search = new URLSearchParams({ city_name: String(nome).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase(), uf, radius_km: "1" }).toString();
  const { ok, corpo } = await json(url.toString());
  return ok && corpo?.center_city?.name ? { nome: corpo.center_city.name, ibge: String(corpo.center_city.municipio_id || "") || null } : null;
}

const cacheValidacao = new Map();

/**
 * Valida o município na UF. Devolve:
 * { verificado, valido, nome, ibge, corrigido, sugestoes, motivo }.
 * valido=true: existe (nome = grafia oficial). corrigido=true: a grafia foi
 * trocada pela oficial por ser quase igual. valido=false: pendência.
 */
async function validarMunicipio(nome, uf) {
  const original = String(nome || "").trim();
  const sigla = String(uf || "").trim().toUpperCase();
  if (!original || !/^[A-Z]{2}$/.test(sigla)) return { verificado: false, valido: null, nome: original || null, motivo: "sem município ou UF" };
  const k = `${sigla}|${chave(original)}`;
  if (cacheValidacao.has(k)) return cacheValidacao.get(k);
  const resultado = await (async () => {
    let exato;
    try {
      exato = await naApi(original, sigla);
    } catch {
      return { verificado: false, valido: null, nome: original, motivo: "validação indisponível" };
    }
    if (exato) return { verificado: true, valido: true, nome: exato.nome, ibge: exato.ibge, corrigido: exato.nome !== original };
    const ranking = (await todosOsNomes())
      .map((n) => ({ n, s: semelhanca(original, n) }))
      .sort((x, y) => y.s - x.s)
      .slice(0, 6)
      .filter((x) => x.s >= 0.5);
    const naUf = [];
    for (const r of ranking) {
      const ok = await naApi(r.n, sigla).catch(() => null);
      if (ok && !naUf.some((x) => x.nome === ok.nome)) naUf.push({ ...ok, s: r.s });
    }
    if (naUf[0] && naUf[0].s >= 0.9 && (!naUf[1] || naUf[0].s - naUf[1].s >= 0.05)) {
      return { verificado: true, valido: true, nome: naUf[0].nome, ibge: naUf[0].ibge, corrigido: true, motivo: `grafia corrigida (${original} → ${naUf[0].nome})` };
    }
    return {
      verificado: true,
      valido: false,
      nome: original,
      ibge: null,
      sugestoes: naUf.slice(0, 3).map((x) => x.nome),
      motivo: `"${original}" não é município de ${sigla}`,
    };
  })();
  cacheValidacao.set(k, resultado);
  return resultado;
}

/** Municípios num raio (km) do município do projeto, pela API de cidades. */
async function municipiosProximos(nome, uf, raioKm = 30) {
  try {
    const url = new URL(`${API_CIDADES}/api/cities/nearby`);
    url.search = new URLSearchParams({ city_name: String(nome).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase(), uf, radius_km: String(raioKm) }).toString();
    const { ok, corpo } = await json(url.toString());
    return ok ? (corpo?.nearby_cities || []).map((c) => ({ nome: c.name, uf: c.uf, ibge: String(c.municipio_id), km: c.distance_km })) : [];
  } catch {
    return [];
  }
}

module.exports = { API_CIDADES, chave, semelhanca, validarMunicipio, municipiosProximos };
