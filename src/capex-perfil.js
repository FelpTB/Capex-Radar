// Perfil padronizado do projeto (capex_radar.projetos.perfil, sql/030).
//
// O perfil é montado em três etapas do fluxo (src/capex-fases.js):
//   - inicial:     a partir das notícias ligadas ao projeto (leitura da
//                  manchete no Filtro 1 e decisão do Perfil inicial);
//   - enriquecido: o texto das matérias lido no Enriquecimento completa e
//                  corrige o inicial (só fontes primárias);
//   - completo:    as fontes secundárias (licenças, financiamento, CNO,
//                  diários oficiais) e a linha do tempo fecham o perfil.
// Cada campo guarda de onde veio (origem), para a tela mostrar o que foi lido
// na manchete, na matéria ou num registro oficial.
//
// As funções de montagem são puras; gravarPerfil grava e preenche os campos
// vazios do projeto (nunca sobrescreve o que um humano editou).

const CAMPOS = [
  "objeto", "tipo_ativo", "uf", "municipio", "local_detalhe", "valor_brl", "valor_texto",
  "capacidade", "empregos", "estagio", "obra", "data_anuncio", "inicio_obra", "previsao_operacao",
  "construtora", "financiamento",
];

const ETAPAS = ["inicial", "enriquecido", "completo"];

function dia(valor) {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const vazio = (v) => v === null || v === undefined || v === "";

function perfilVazio() {
  const perfil = { origem: {} };
  for (const campo of CAMPOS) perfil[campo] = null;
  perfil.licencas = [];
  perfil.resumo = null;
  perfil.fontes = { noticias: 0, materias: 0, registros_oficiais: 0 };
  return perfil;
}

// Mais recente primeiro: o fato novo vale sobre o antigo (valor revisto,
// estágio que avançou).
function porData(evidencias) {
  return [...evidencias].sort((a, b) => String(dia(b.data_original) || "").localeCompare(String(dia(a.data_original) || "")));
}

/**
 * Perfil inicial: dados do projeto e a leitura das manchetes ligadas a ele.
 * Campo vazio no projeto pega o valor da manchete mais recente que o traz.
 */
function perfilInicial(projeto, evidencias = []) {
  const perfil = perfilVazio();
  const doProjeto = {
    objeto: projeto.objeto, uf: projeto.uf, municipio: projeto.municipio,
    valor_brl: projeto.valor_estimado_brl == null ? null : Number(projeto.valor_estimado_brl),
    estagio: projeto.estagio, data_anuncio: dia(projeto.data_anuncio),
  };
  for (const [campo, valor] of Object.entries(doProjeto)) {
    if (!vazio(valor)) { perfil[campo] = valor; perfil.origem[campo] = "projeto"; }
  }
  const noticias = porData(evidencias.filter((e) => e.extracao));
  for (const e of noticias) {
    const ex = e.extracao;
    const candidatos = { objeto: ex.objeto, uf: ex.uf, municipio: ex.municipio, valor_brl: ex.valor_brl, estagio: ex.estagio };
    for (const [campo, valor] of Object.entries(candidatos)) {
      if (vazio(perfil[campo]) && !vazio(valor)) { perfil[campo] = valor; perfil.origem[campo] = "manchete"; }
    }
  }
  if (vazio(perfil.data_anuncio)) {
    const primeira = [...noticias].reverse().find((e) => dia(e.data_original));
    if (primeira) { perfil.data_anuncio = dia(primeira.data_original); perfil.origem.data_anuncio = "manchete"; }
  }
  perfil.fontes.noticias = evidencias.filter((e) => e.fonte_codigo === "gnews_rss" || e.extracao).length;
  return perfil;
}

/**
 * Perfil enriquecido: o texto das matérias completa o inicial. O que a
 * matéria diz vale sobre a manchete; o que veio do projeto (humano) fica.
 */
function perfilEnriquecido(inicial, evidencias = []) {
  const perfil = { ...inicial, origem: { ...inicial.origem }, fontes: { ...inicial.fontes }, licencas: [...(inicial.licencas || [])] };
  const lidas = porData(evidencias.filter((e) => e.enriquecimento?.perfil && e.enriquecimento.encontrou !== false));
  const preenchidos = new Set();
  for (const e of lidas) {
    const p = e.enriquecimento.perfil;
    for (const campo of CAMPOS) {
      const valor = campo === "data_anuncio" ? null : p[campo];
      if (vazio(valor) || preenchidos.has(campo) || perfil.origem[campo] === "projeto") continue;
      perfil[campo] = valor;
      perfil.origem[campo] = "materia";
      preenchidos.add(campo);
    }
    if (!perfil.resumo && e.enriquecimento.resumo) perfil.resumo = e.enriquecimento.resumo;
  }
  perfil.fontes.materias = lidas.length;
  return perfil;
}

// Registro oficial de licença: campos que as bases de licenciamento usam.
function licencaDoRegistro(r) {
  const b = r.registro || {};
  const tipo = b.tipo_licenca || b.especie || b.tipo || null;
  const numero = b.numero_licenca || b.numero || b.protocolo || null;
  const ehLicenca = /licen|outorga|autoriza|alvar/i.test(`${tipo || ""} ${r.fonte_codigo} ${b.assunto || ""} ${b.titulo || ""}`);
  if (!ehLicenca) return null;
  return {
    tipo: tipo ? String(tipo).slice(0, 120) : "licença",
    numero: numero ? String(numero).slice(0, 80) : null,
    orgao: b.orgao || b.orgao_emissor || r.fonte_codigo,
    data: dia(r.data_registro) || null,
    fonte: r.fonte_codigo,
    evidencia_id: r.evidencia_id || null,
  };
}

/**
 * Perfil completo: entra o que as fontes secundárias confirmaram (registros
 * com correlação direta) e a linha do tempo (resumo e estágio atual).
 */
function perfilCompleto(enriquecido, { registros = [], linhaTempo = null } = {}) {
  const perfil = { ...enriquecido, origem: { ...enriquecido.origem }, fontes: { ...enriquecido.fontes } };
  const diretos = registros.filter((r) => r.correlacao === "direta");
  const licencas = [...(enriquecido.licencas || [])];
  for (const r of diretos) {
    const l = licencaDoRegistro(r);
    if (l && !licencas.some((x) => x.fonte === l.fonte && x.numero === l.numero && x.data === l.data)) licencas.push(l);
    const b = r.registro || {};
    if (vazio(perfil.financiamento) && /BNDES/i.test(r.fonte_codigo)) {
      perfil.financiamento = `BNDES${b.valor_contratado ? ` R$ ${Number(b.valor_contratado).toLocaleString("pt-BR")}` : ""}`;
      perfil.origem.financiamento = "fonte_secundaria";
    }
    if (vazio(perfil.inicio_obra) && r.fonte_codigo === "SEC-CNO" && (b.data_inicio || b.inicio)) {
      perfil.inicio_obra = dia(b.data_inicio || b.inicio);
      perfil.origem.inicio_obra = "fonte_secundaria";
    }
  }
  perfil.licencas = licencas.sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")));
  if (linhaTempo) {
    if (linhaTempo.resumo) perfil.resumo = linhaTempo.resumo;
    if (linhaTempo.estagio && perfil.origem.estagio !== "projeto") {
      perfil.estagio = linhaTempo.estagio;
      perfil.origem.estagio = "linha_tempo";
    }
  }
  perfil.fontes.registros_oficiais = diretos.length;
  return perfil;
}

/**
 * Grava o perfil e a etapa. Campos vazios do projeto (local, valor, objeto)
 * são preenchidos com o perfil; o que já existe no projeto não muda.
 */
async function gravarPerfil(db, projetoId, perfil, etapa) {
  if (!ETAPAS.includes(etapa)) throw new Error(`Etapa de perfil desconhecida: ${etapa}`);
  await db.query(
    `update capex_radar.projetos
        set perfil = $2::jsonb, perfil_etapa = $3, perfil_em = now(),
            objeto = coalesce(objeto, $4),
            uf = coalesce(uf, $5),
            municipio = coalesce(municipio, $6),
            valor_estimado_brl = coalesce(valor_estimado_brl, $7)
      where id = $1`,
    [
      projetoId, JSON.stringify(perfil), etapa,
      perfil.objeto || null,
      /^[A-Z]{2}$/.test(String(perfil.uf || "")) ? perfil.uf : null,
      perfil.municipio || null,
      perfil.valor_brl == null ? null : perfil.valor_brl,
    ],
  );
}

// Notícia que fala de licença ou liberação de órgão público: precisa de
// evidência do diário oficial (item 4 do Enriquecimento 2).
const LICENCA_RE = /\blicen[cç]a|\balvar[aá]|\boutorga|\bautoriza[cç][aã]o\b|\baprova[cç][aã]o (ambiental|da prefeitura|do estado)|\blicenciamento\b/i;
const DIARIO_RE = /^(CAPTURA-(DOE|DOU|QD|SIGPUB|DOM)|SEC-(DOU|DOE))/;

function falaDeLicenca(evidencia) {
  return LICENCA_RE.test(`${evidencia.titulo || ""} ${evidencia.enriquecimento?.resumo || ""}`);
}

/** Licença citada em notícia sem nenhum registro de diário oficial aceito. */
function licencaSemDiario(evidencias, registros) {
  const citam = evidencias.filter((e) => e.fonte_codigo === "gnews_rss" && falaDeLicenca(e));
  if (!citam.length) return null;
  const temDiario = registros.some((r) => r.correlacao === "direta" && DIARIO_RE.test(r.fonte_codigo));
  return temDiario ? null : citam.map((e) => String(e.id));
}

/**
 * Monta o perfil do projeto até a etapa mais alta que os dados permitem:
 * completo se já passou pelo Enriquecimento 2 (fontes secundárias), senão
 * enriquecido se há matéria lida, senão inicial. Grava e devolve a etapa.
 */
async function montarPerfil(db, projetoId) {
  const { rows: [projeto] } = await db.query(
    `select id, titulo, objeto, uf, municipio, valor_estimado_brl, estagio, data_anuncio, data_fim,
            secundarias, linha_tempo
       from capex_radar.projetos where id = $1`,
    [projetoId],
  );
  if (!projeto) return null;
  const { rows: evidencias } = await db.query(
    `select e.id, e.titulo, e.fonte_codigo, e.data_original, e.extracao, e.enriquecimento
       from capex_radar.evidencia_projeto ep
       join capex_radar.evidencias e on e.id = ep.evidencia_id
      where ep.projeto_id = $1 and ep.situacao = 'aceito'`,
    [projetoId],
  );
  const { rows: registros } = await db.query(
    `select fonte_codigo, registro, data_registro, correlacao, evidencia_id
       from capex_radar.registros_analisados where projeto_id = $1`,
    [projetoId],
  );
  let perfil = perfilInicial(projeto, evidencias);
  let etapa = "inicial";
  if (evidencias.some((e) => e.enriquecimento?.perfil)) {
    perfil = perfilEnriquecido(perfil, evidencias);
    etapa = "enriquecido";
  }
  if (projeto.secundarias) {
    perfil = perfilCompleto(perfil, { registros, linhaTempo: projeto.linha_tempo });
    etapa = "completo";
  }
  perfil.licencas_sem_diario = licencaSemDiario(evidencias, registros);
  await gravarPerfil(db, projetoId, perfil, etapa);
  return { etapa, perfil };
}

module.exports = {
  CAMPOS,
  falaDeLicenca,
  licencaSemDiario,
  montarPerfil,
  ETAPAS,
  perfilVazio,
  perfilInicial,
  perfilEnriquecido,
  perfilCompleto,
  licencaDoRegistro,
  gravarPerfil,
};
