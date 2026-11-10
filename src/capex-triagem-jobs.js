// Funil de notícias em segundo plano, com progresso para a barra da tela.
//
// Para cada empresa, as fases rodam em ordem (capex-fases.js): Filtro 1
// (regras, manchetes quase iguais e triagem rápida), Filtro 2, Enriquecimento
// e Filtro 3. O que sobra fica para a aprovação humana. No modo "agente", o
// agente ainda decide a fila pronta de cada empresa (cria projeto em revisão,
// vincula ou descarta). Fase desligada no .env não roda.
//
// Uma rodada por vez no processo: a tela inicia, recebe o id e consulta o
// andamento. O estado fica em memória; um reinício do app perde só a barra,
// porque o que já foi decidido está gravado e o resto continua na fila.
const crypto = require("node:crypto");
const { pool } = require("./db");
const { carregarGrupos, triarGrupo } = require("./capex-coletor");
const agenteMod = require("./capex-agente");
const filtroMod = require("./capex-filtro");
const enriquecimentoMod = require("./capex-enriquecimento");
const filtroFinalMod = require("./capex-filtro-final");

const jobs = new Map();
let ativo = null;

// Fases depois do Filtro 1: nome no job, módulo, função e campos do resumo.
function fasesDoJob({ filtro, enriquecedor, filtroFinal, agente }) {
  return [
    filtro && {
      chave: "filtro", rotulo: "Filtro 2", contarFila: filtroMod.contarFila,
      rodar: (p) => filtroMod.filtrarGrupo({ ...p, filtro }),
      campos: ["mantidas", "descartadas", "repetidas", "erros"],
    },
    enriquecedor && {
      chave: "enriquecimento", rotulo: "Enriquecimento", contarFila: enriquecimentoMod.contarFila,
      rodar: (p) => enriquecimentoMod.enriquecerGrupo({ ...p, enriquecedor }),
      campos: ["enriquecidas", "sem_materia", "erros", "buscas"],
    },
    filtroFinal && {
      chave: "filtro_final", rotulo: "Filtro 3", contarFila: filtroFinalMod.contarFila,
      rodar: (p) => filtroFinalMod.filtrarGrupo({ ...p, filtro: filtroFinal }),
      campos: ["mantidas", "descartadas", "repetidas", "erros"],
    },
    agente && {
      chave: "agente", rotulo: "agente", contarFila: agenteMod.contarFila,
      rodar: (p) => agenteMod.decidirGrupo({ ...p, agente }),
      campos: ["projetos_criados", "vinculadas", "descartadas", "revisao_humana", "erros"],
    },
  ].filter(Boolean);
}

function publico(job) {
  if (!job) return null;
  const { grupos: _grupos, previstas: _previstas, fases: _fases, ...resto } = job;
  return { ...resto, percentual: job.total ? Math.round((job.feitas / job.total) * 100) : 100 };
}

async function contarPendentes(client, grupoIds) {
  const { rows } = await client.query(
    `select grupo_id, count(*)::int as n from capex_radar.evidencias
      where grupo_id = any($1::uuid[]) and triagem = 'pendente' and extracao is null
      group by grupo_id`,
    [grupoIds],
  );
  return new Map(rows.map((row) => [row.grupo_id, row.n]));
}

async function executar(job, ia) {
  const client = await pool.connect();
  try {
    let antes = 0;
    for (const grupo of job.grupos) {
      job.grupo_atual = `${grupo.nome} (Filtro 1)`;
      const r = await triarGrupo({
        client,
        grupo,
        ia,
        limite: job.limitePorGrupo,
        onProgresso: (feitas) => { job.feitas = Math.min(job.total, antes + feitas); },
      });
      antes += r.lidas;
      job.feitas = Math.min(job.total, antes);
      for (const campo of Object.keys(job.resumo)) job.resumo[campo] += r[campo] || 0;

      for (const fase of job.fases) {
        // A fase anterior pode ter posto notícias novas nesta fila: o total cresce com elas.
        const fila = (await fase.contarFila(client, [grupo.id])).get(grupo.id) || 0;
        const naConta = job.previstas[fase.chave].get(grupo.id) || 0;
        job.total += Math.max(0, Math.min(fila, job.limitePorGrupo) - naConta);
        job.grupo_atual = `${grupo.nome} (${fase.rotulo})`;
        const f = await fase.rodar({
          db: client,
          grupo,
          limite: job.limitePorGrupo,
          onProgresso: (feitas) => { job.feitas = Math.min(job.total, antes + feitas); },
        });
        antes += f.lidas;
        job.feitas = Math.min(job.total, antes);
        for (const campo of fase.campos) job[fase.chave][campo] += f[campo] || 0;
        if (f.ultimo_erro) job[fase.chave].ultimo_erro = f.ultimo_erro;
      }
    }
    job.status = "concluida";
  } catch (error) {
    job.status = "erro";
    job.erro = String(error.message).slice(0, 300);
  } finally {
    client.release();
    job.grupo_atual = null;
    job.terminou_em = new Date().toISOString();
    if (ativo === job.id) ativo = null;
  }
}

/**
 * Inicia o funil de um grupo (ou de todos com notícia em alguma fila).
 * Se já houver uma rodada, devolve essa.
 */
async function iniciarTriagem({
  grupoId = null, ia, agente = null, filtro = null, enriquecedor = null, filtroFinal = null, limitePorGrupo = 400,
}) {
  if (ativo && jobs.get(ativo)?.status === "rodando") return publico(jobs.get(ativo));
  const fases = fasesDoJob({ filtro, enriquecedor, filtroFinal, agente });
  const client = await pool.connect();
  let grupos;
  let pendentes;
  const previstas = {};
  try {
    grupos = (await carregarGrupos(client)).filter((g) => !grupoId || g.id === grupoId);
    const ids = grupos.map((g) => g.id);
    pendentes = await contarPendentes(client, ids);
    for (const fase of fases) previstas[fase.chave] = await fase.contarFila(client, ids);
  } finally {
    client.release();
  }
  const naFila = (g) => Math.min(pendentes.get(g.id) || 0, limitePorGrupo)
    + fases.reduce((total, fase) => total + Math.min(previstas[fase.chave].get(g.id) || 0, limitePorGrupo), 0);
  grupos = grupos.filter((g) => naFila(g) > 0);
  const zerado = (campos) => Object.fromEntries(campos.map((c) => [c, 0]));
  const job = {
    id: crypto.randomUUID(),
    grupo_id: grupoId,
    escopo: grupoId ? grupos[0]?.nome || "empresa" : "todas as empresas",
    modo: agente ? "agente" : "triagem",
    status: grupos.length ? "rodando" : "concluida",
    feitas: 0,
    total: grupos.reduce((total, g) => total + naFila(g), 0),
    grupo_atual: null,
    resumo: { lidas: 0, regras: 0, repetidas: 0, ia_descartadas: 0, capex: 0, sugeridos: 0, novos_projetos: 0, erros_ia: 0 },
    filtro: { ativo: Boolean(filtro), modelo: filtro?.modelo || null, mantidas: 0, descartadas: 0, repetidas: 0, erros: 0 },
    enriquecimento: { ativo: Boolean(enriquecedor), modelo: enriquecedor?.modelo || null, enriquecidas: 0, sem_materia: 0, erros: 0, buscas: 0 },
    filtro_final: { ativo: Boolean(filtroFinal), modelo: filtroFinal?.modelo || null, mantidas: 0, descartadas: 0, repetidas: 0, erros: 0 },
    agente: { projetos_criados: 0, vinculadas: 0, descartadas: 0, revisao_humana: 0, erros: 0 },
    erro: null,
    iniciou_em: new Date().toISOString(),
    terminou_em: null,
    limitePorGrupo,
    grupos,
    fases,
    previstas,
  };
  for (const fase of fases) Object.assign(job[fase.chave], zerado(fase.campos.filter((c) => !(c in job[fase.chave]))));
  jobs.set(job.id, job);
  // Guarda só as últimas rodadas.
  for (const id of [...jobs.keys()].slice(0, -10)) jobs.delete(id);
  if (grupos.length) {
    ativo = job.id;
    executar(job, ia);
  }
  return publico(job);
}

function obterTriagem(id) {
  return publico(jobs.get(id));
}

function triagemAtiva() {
  return ativo ? publico(jobs.get(ativo)) : null;
}

module.exports = { iniciarTriagem, obterTriagem, triagemAtiva };
