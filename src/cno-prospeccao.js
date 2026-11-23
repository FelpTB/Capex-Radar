// Prospecção pelo CNO (Pontos de Melhora 23/11/2026, item 2): obras de
// galpão industrial com mais de 5.000 m² dos últimos 3 anos cujo dono é uma
// indústria privada (CNAE principal nas divisões 10 a 32). Cada obra vira um
// projeto em pré-cadastro ("em revisão", origem cno_prospeccao) para depois
// buscar as notícias que o embasam.
//
// Lê a base local do CNO (data/dadosgov/cadastro-nacional-de-obras-cno) e
// confirma CNAE e natureza jurídica pela BrasilAPI, com cache em
// data/cache/cnpj (cada CNPJ é consultado uma vez).
const fs = require("node:fs");
const path = require("node:path");
const cno = require("./enrichment/cno");
const { onlyDigits, fold } = require("./enrichment/resolve");

const AREA_MINIMA = 5000;
const ANOS = 3;
const DESTINACOES = /galpao industrial/;
const CATEGORIAS = /obra nova|acrescimo/;
const CACHE = path.join(process.cwd(), "data", "cache", "cnpj");

// Natureza jurídica de órgão ou empresa pública/de economia mista: fora.
// 1xxx administração pública; 2011 empresa pública; 2038 sociedade de economia mista.
function ehPrivada(naturezaCodigo) {
  const c = String(naturezaCodigo || "").replace(/\D/g, "");
  if (!c) return false;
  if (c.startsWith("1")) return false;
  return !["2011", "2038"].includes(c);
}

/**
 * Divisão do CNAE (2 primeiros dígitos) é da indústria de transformação?
 * 10 a 32; a 33 (manutenção e instalação de máquinas) é serviço: a instaladora
 * de uma usina solar não é a dona da obra.
 */
function ehIndustrial(cnae) {
  const d = Number(String(cnae || "").replace(/\D/g, "").padStart(7, "0").slice(0, 2));
  return d >= 10 && d <= 32;
}

// Responsável que só constrói, incorpora ou aluga: o dono industrial, se
// houver, está nos vínculos. Evita consultar CNPJ que não é indústria.
const NAO_INDUSTRIAL = /imobiliar|empreendimento|incorpora|construt|construc|engenharia|participac|condominio|loteament|logistic|armazen|\bspe\b|\bbts\b|holding|administra|patrimon|investiment/;

/** Nicho do Radar pela divisão do CNAE. */
function nichoDoCnae(cnae) {
  const d = String(cnae || "").replace(/\D/g, "").padStart(7, "0").slice(0, 2);
  if (d === "10" || d === "11") return "alimentos_bebidas";
  if (d === "17") return "papel_celulose";
  return "industria";
}

/** Dígitos verificadores do CNPJ (para montar o da matriz: raiz + 0001). */
function cnpjDaMatriz(raiz) {
  const base = `${String(raiz).padStart(8, "0")}0001`;
  const dv = (nums) => {
    const pesos = nums.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = nums.split("").reduce((t, n, i) => t + Number(n) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? "0" : String(11 - r);
  };
  const d1 = dv(base);
  return `${base}${d1}${dv(base + d1)}`;
}

const numero = (v) => Number(String(v || "").replace(",", ".")) || 0;

/**
 * Passo 1 (base local): obras de galpão industrial (obra nova ou acréscimo)
 * com área >= areaMinima e início desde `desde`. Devolve as linhas do CNO com
 * áreas e vínculos.
 */
async function obrasCandidatas({ dir = cno.DIR, desde, areaMinima = AREA_MINIMA } = {}) {
  const porCno = new Map();
  await cno.streamCsv(path.join(dir, "cno_areas.csv"), (header) => ({
    cno: cno.requireColumn(header, /^cno$/, "CNO"),
    categoria: cno.requireColumn(header, /^categoria$/, "Categoria"),
    destinacao: cno.requireColumn(header, /^destinacao$/, "Destinação"),
    metragem: cno.requireColumn(header, /^metragem$/, "Metragem"),
  }), (cells, c) => {
    if (!CATEGORIAS.test(fold(cells[c.categoria] || "")) || !DESTINACOES.test(fold(cells[c.destinacao] || ""))) return;
    const k = cno.cnoKey(cells[c.cno]);
    porCno.set(k, (porCno.get(k) || 0) + numero(cells[c.metragem]));
  });
  const wanted = new Map();
  await cno.readCsv(path.join(dir, "cno.csv"), (cells, columns) => {
    const k = cno.cnoKey(cells[columns.cno]);
    const area = porCno.get(k);
    if (!area || area < areaMinima) return;
    const inicio = cells[columns.inicio] || "";
    if (!inicio || inicio < desde) return;
    const ni = onlyDigits(cells[columns.ni] || "");
    const row = { ...cno.linhaDoCno(cells, columns, ni.length === 14 ? ni : null), area_obra: Math.round(area), areas: [], cnaes: [], vinculos: [] };
    wanted.set(k, [row]);
  });
  await cno.attachAreas(wanted, path.join(dir, "cno_areas.csv"));
  await cno.attachVinculos(wanted, path.join(dir, "cno_vinculos.csv"));
  return [...wanted.values()].map(([row]) => row);
}

/** CNPJs a consultar de uma obra: o responsável (se não for construtora/imobiliária) e os vínculos. */
function cnpjsDaObra(obra) {
  const lista = [];
  if (obra.ni && !NAO_INDUSTRIAL.test(fold(`${obra.empresa || ""} ${obra.nome || ""}`))) lista.push(obra.ni);
  for (const v of obra.vinculos || []) if (v.ni && !lista.includes(v.ni)) lista.push(v.ni);
  return lista;
}

/** Consulta um CNPJ na BrasilAPI, com cache em disco. null se não achou. */
async function consultarCnpj(cnpj, { cache = CACHE, fetcher = fetch } = {}) {
  fs.mkdirSync(cache, { recursive: true });
  const arquivo = path.join(cache, `${cnpj}.json`);
  if (fs.existsSync(arquivo)) return JSON.parse(fs.readFileSync(arquivo, "utf8"));
  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    const r = await fetcher(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { accept: "application/json", "user-agent": "RadarCapEx/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (r.status === 404) { fs.writeFileSync(arquivo, "null"); return null; }
    if (r.status === 429 || r.status >= 500) { await new Promise((ok) => setTimeout(ok, 2000 * (tentativa + 1))); continue; }
    if (!r.ok) throw new Error(`BrasilAPI respondeu HTTP ${r.status} para ${cnpj}`);
    const d = await r.json();
    const resumo = {
      cnpj, razao_social: d.razao_social || null, nome_fantasia: d.nome_fantasia || null,
      cnae: d.cnae_fiscal ? String(d.cnae_fiscal) : null, cnae_descricao: d.cnae_fiscal_descricao || null,
      natureza_codigo: d.codigo_natureza_juridica ? String(d.codigo_natureza_juridica) : null,
      natureza: d.natureza_juridica || null, situacao: d.descricao_situacao_cadastral || null,
      uf: d.uf || null, municipio: d.municipio || null,
    };
    fs.writeFileSync(arquivo, JSON.stringify(resumo));
    return resumo;
  }
  throw new Error(`BrasilAPI indisponível para ${cnpj}`);
}

/** A empresa industrial privada da obra (o primeiro CNPJ que passa), ou null. */
function empresaIndustrial(cadastros) {
  return cadastros.find((c) => c && ehIndustrial(c.cnae) && ehPrivada(c.natureza_codigo) && !/baixada|inapta|nula/i.test(c.situacao || "")) || null;
}

const titulo = (s) => String(s || "").toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase());
const mil = (m2) => (m2 >= 1e6 ? `${(m2 / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} milhão de m²` : `${Math.round(m2 / 1000).toLocaleString("pt-BR")} mil m²`);

/** Nome curto do grupo a partir do cadastro (nome fantasia, ou razão social sem o tipo societário). */
function nomeDoGrupo(c) {
  const base = c.nome_fantasia && c.nome_fantasia.length >= 3 ? c.nome_fantasia : c.razao_social;
  return titulo(String(base || "").replace(/\s+-\s+.*$/, "").replace(/\s+(S\s?\.?\s?\/?\s?A\.?|LTDA\.?|EIRELI|ME|EPP)\s*$/i, "").trim()).slice(0, 80);
}

/** Projeto proposto para uma obra (pré-cadastro). */
function projetoDaObra(obra, empresa) {
  const municipio = titulo(obra.municipio);
  const encerrada = String(obra.situacao || "").padStart(2, "0") === "15";
  return {
    grupo: nomeDoGrupo(empresa),
    nicho: nichoDoCnae(empresa.cnae),
    cnpj_raiz: empresa.cnpj.slice(0, 8),
    titulo: `galpão industrial de ${mil(obra.area_obra)} em ${municipio}`,
    objeto: `Obra ${encerrada ? "encerrada" : "ativa"} no CNO (${obra.cno}): galpão industrial de ${Math.round(obra.area_obra).toLocaleString("pt-BR")} m², iniciada em ${String(obra.inicio).split("-").reverse().join("/")}${obra.nome ? `, "${obra.nome}"` : ""}. Pré-cadastro a validar com notícias.`,
    uf: obra.uf || null,
    municipio,
    estagio: encerrada ? "operacao" : "mobilizacao",
    data_anuncio: obra.inicio,
  };
}

module.exports = {
  AREA_MINIMA, ANOS, ehPrivada, ehIndustrial, nichoDoCnae, cnpjDaMatriz, obrasCandidatas, cnpjsDaObra,
  consultarCnpj, empresaIndustrial, nomeDoGrupo, projetoDaObra,
};
