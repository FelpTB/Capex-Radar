// Segmentos do Radar: nichos, classes CNAE e termos de contexto
// (seeds/capex_radar/segmentos.json). Usado na escolha das empresas
// (scripts/capex-segmentos.js), na busca de notícias (capex-coletor.js) e
// nos rótulos do painel.
const path = require("node:path");

const ARQUIVO = path.join(__dirname, "..", "seeds", "capex_radar", "segmentos.json");
let cache = null;

function carregar() {
  if (!cache) cache = require(ARQUIVO);
  return cache;
}

// Os quatro nichos iniciais vêm da curadoria (empresas-teste.json).
const INICIAIS = {
  papel_celulose: "Papel e Celulose",
  alimentos_bebidas: "Alimentos e Bebidas",
  ecommerce: "E-commerce",
  datacenter: "Datacenters",
};

/** Todos os nichos com o rótulo: os iniciais e os de segmentos.json. */
function rotulos() {
  const nichos = carregar().nichos;
  return { ...INICIAIS, ...Object.fromEntries(Object.entries(nichos).map(([k, v]) => [k, v.rotulo])) };
}

/** Termos de contexto da busca de notícias de um nicho (null se não houver). */
function contextoDoNicho(nicho) {
  return carregar().nichos[nicho]?.contexto || null;
}

/**
 * Faixas [inicio, fim) do CNAE para consultar o índice btree: o prefixo "21"
 * vira ["21", "22"); "4711" vira ["4711", "4712").
 */
function faixas(prefixos) {
  return prefixos.map((p) => {
    const fim = String(Number(p) + 1).padStart(p.length, "0");
    return [p, fim];
  });
}

/** Nicho pelo CNAE (o prefixo mais longo que casa); 10/11 e 17 ficam nos iniciais. */
function nichoDoCnae(cnae, config = carregar()) {
  const c = String(cnae || "").replace(/\D/g, "").padStart(7, "0");
  if (/^1[01]/.test(c)) return "alimentos_bebidas";
  if (/^17/.test(c)) return "papel_celulose";
  let melhor = { nicho: "industria", tam: 0 };
  for (const [nicho, def] of Object.entries(config.nichos)) {
    for (const p of def.cnaes) if (c.startsWith(p) && p.length > melhor.tam) melhor = { nicho, tam: p.length };
  }
  return melhor.nicho;
}

// Empresas privadas grandes (porte "demais", capital social de R$ 50 milhões
// ou mais) com a matriz ativa e o CNAE dela. Uma consulta só: filtrar primeiro
// as empresas grandes é muito mais rápido que varrer as classes CNAE do varejo
// (dezenas de milhares de lojas pequenas). $1: capital mínimo.
const SQL_GRANDES = `
  with grandes as materialized (
    select cnpj_basico, razao_social, natureza_juridica, replace(capital_social_str, ',', '.')::numeric as capital
      from cnpj_db.empresas
     where porte_empresa = '05' and natureza_juridica not like '1%' and natureza_juridica not in ('2011', '2038')
       and capital_social_str ~ '^[0-9]{8,}' and razao_social !~* '(holding|participac)')
  select g.cnpj_basico, e.cnpj_basico || e.cnpj_ordem || e.cnpj_dv as cnpj, e.nome_fantasia, g.razao_social,
         g.natureza_juridica, e.cnae_fiscal, c.descricao as cnae_descricao, e.uf, m.descricao as municipio, g.capital
    from grandes g
    join cnpj_db.estabelecimento e on e.cnpj_basico = g.cnpj_basico and e.matriz_filial = '1' and e.situacao_cadastral = '02'
    left join cnpj_db.cnae c on c.codigo = e.cnae_fiscal
    left join cnpj_db.municipio m on m.codigo = e.municipio
   where g.capital >= $1
   order by g.capital desc`;

// Estabelecimentos ativos das raízes ($1: text[]) para capex_radar.filiais.
const SQL_FILIAIS = `
  insert into capex_radar.filiais
    (cnpj, matriz_cnpj, nome_fantasia, situacao_cadastral, data_inicio_atividades, cnae,
     cnaes_secundarios, logradouro, numero, bairro, cep, uf, municipio)
  select e.cnpj_basico || e.cnpj_ordem || e.cnpj_dv, m.cnpj, nullif(e.nome_fantasia, ''), e.situacao_cadastral,
         case when e.data_inicio_atividades ~ '^[0-9]{8}$' then to_date(e.data_inicio_atividades, 'YYYYMMDD') end,
         e.cnae_fiscal,
         case when coalesce(e.cnae_fiscal_secundaria, '') <> '' then string_to_array(e.cnae_fiscal_secundaria, ',') end,
         nullif(trim(concat_ws(' ', e.tipo_logradouro, e.logradouro)), ''), e.numero, e.bairro,
         case when e.cep ~ '^[0-9]{8}$' then e.cep end, e.uf, mun.descricao
    from capex_radar.matrizes m
    join cnpj_db.estabelecimento e on e.cnpj_basico = m.cnpj_basico and e.situacao_cadastral = '02'
    left join cnpj_db.municipio mun on mun.codigo = e.municipio
   where m.cnpj_basico = any($1::text[]) and e.cnpj_basico || e.cnpj_ordem || e.cnpj_dv ~ '^[0-9]{14}$'
  on conflict (cnpj) do nothing`;

const titulo = (s) => String(s || "").toLowerCase().replace(/(^|[\s(/&.-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())
  .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase());
const SUFIXO = /\s+(S\s?\.?\s?\/?\s?A\.?|LTDA\.?|EIRELI|ME|EPP)\s*$/i;
// Nome fantasia que não serve de nome (vazio, genérico, sigla curta demais).
const FANTASIA_RUIM = /^(matriz|sede|filial|null|n\/?a|\W*)$/i;

const palavras = (s) => new Set(String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4));

/**
 * Nome do grupo: o nome fantasia (o primeiro, se houver vários) quando tem
 * 4 letras ou mais e divide uma palavra com a razão social; senão, a razão
 * social sem o tipo societário. Evita nomes de unidade ("Est Unif" para a
 * Sony, "Aldo" para a Descarbonize) que viram termos de busca ruins.
 */
function nomeDoGrupo(r) {
  const fantasia = String(r.nome_fantasia || "").split("/")[0].replace(SUFIXO, "").trim();
  const razao = palavras(r.razao_social);
  const serve = fantasia.length >= 4 && !FANTASIA_RUIM.test(fantasia) && !/^(unidade|est|filial|loja)/i.test(fantasia)
    && [...palavras(fantasia)].some((w) => razao.has(w));
  if (serve) return titulo(fantasia.replace(/\s+-\s+.*$/, "").trim()).slice(0, 80);
  const semSufixo = String(r.razao_social || "").replace(SUFIXO, "").trim();
  const curto = semSufixo.replace(/\s+-\s+.*$/, "").trim();
  return titulo(curto.length >= 4 ? curto : semSufixo).slice(0, 80);
}

// Primeira palavra que identifica o grupo econômico ("Atvos", "Fleury",
// "Gerdau"): duas empresas com a mesma ficam só na primeira (maior capital).
const GENERICAS = new Set(["companhia", "cia", "usina", "usinas", "supermercado", "supermercados", "lojas", "hospital", "industria",
  "mineracao", "cimento", "bioenergetica", "instituto", "casa", "centro", "clinica", "sao", "santa", "terminal", "porto",
  "calcados", "comercio", "distribuidora", "fabrica", "grupo", "rede", "laboratorio", "metalurgica", "siderurgica"]);
function chaveDoGrupo(nome) {
  const w = String(nome || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const primeira = w.find((x) => x.length >= 3 && !GENERICAS.has(x));
  return primeira || w.join(" ");
}

/** Termos de busca: a marca (nome do grupo) e a razão social como variação. */
function termosDaEmpresa(r, grupo) {
  const razao = titulo(String(r.razao_social || "").replace(SUFIXO, "").trim());
  return { marca: [grupo], variacao: razao && razao.toLowerCase() !== grupo.toLowerCase() ? [razao] : [] };
}

async function gravarTermos(client, grupoId, entrada) {
  const { linhasDoSeed } = require("./capex-busca");
  let n = 0;
  for (const linha of linhasDoSeed(entrada)) {
    const r = await client.query(
      `insert into capex_radar.grupo_termos (grupo_id, termo, tipo) values ($1, $2, $3)
       on conflict (grupo_id, termo) do nothing`,
      [grupoId, linha.termo, linha.tipo],
    );
    n += r.rowCount;
  }
  return n;
}

module.exports = { chaveDoGrupo, carregar, rotulos, contextoDoNicho, faixas, nichoDoCnae, nomeDoGrupo, termosDaEmpresa, gravarTermos, SQL_GRANDES, SQL_FILIAIS, INICIAIS };
