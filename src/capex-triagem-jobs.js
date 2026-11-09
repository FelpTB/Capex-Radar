// Triagem da IA em segundo plano, com progresso para a barra da tela.
//
// Dois modos: "triagem" (a leitura da IA e o filtro CapEx) e "agente" (a
// triagem, o filtro e depois o agente decide a fila de cada empresa: cria
// projeto, vincula ou descarta). O filtro roda nos dois modos quando ligado.
//
// Uma triagem por vez no processo: a tela inicia, recebe o id e consulta o
// andamento. O estado fica em memória; um reinício do app perde só a barra,
// porque o que já foi triado está gravado e o resto continua pendente.
const crypto = require("node:crypto");
const { pool } = require("./db");
const { carregarGrupos, triarGrupo } = require("./capex-coletor");
const agenteMod = require("./capex-agente");
const filtroMod = require("./capex-filtro");

const jobs = new Map();
let ativo = null;

function publico(job) {
  if (!job) return null;
  const { grupos: _grupos, filaPrevista: _fila, filtroPrevisto: _filtro, ...resto } = job;
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

async function executar(job, ia, agente, filtro) {
  const client = await pool.connect();
  try {
    let antes = 0;
    for (const grupo of job.grupos) {
      job.grupo_atual = grupo.nome;
      const r = await triarGrupo({
        client,
        grupo,
        ia,
        limite: job.limitePorGrupo,
        onProgresso: (feitas) => { job.feitas = Math.min(job.total, antes + feitas); },
      });
      antes += r.lidas;
      job.feitas = Math.min(job.total, antes);
      for (const campo of ["lidas", "regras", "ia_descartadas", "capex", "sugeridos", "novos_projetos", "erros_ia"]) {
        job.resumo[campo] += r[campo] || 0;
      }
      if (filtro) {
        // A triagem pode ter posto notícias novas na fila do filtro.
        const filaF = (await filtroMod.contarFila(client, [grupo.id])).get(grupo.id) || 0;
        const naContaF = job.filtroPrevisto.get(grupo.id) || 0;
        job.total += Math.max(0, Math.min(filaF, job.limitePorGrupo) - naContaF);
        job.grupo_atual = `${grupo.nome} (filtro)`;
        const f = await filtroMod.filtrarGrupo({
          db: client,
          grupo,
          filtro,
          limite: job.limitePorGrupo,
          onProgresso: (feitas) => { job.feitas = Math.min(job.total, antes + feitas); },
        });
        antes += f.lidas;
        job.feitas = Math.min(job.total, antes);
        for (const campo of ["mantidas", "descartadas", "repetidas", "erros"]) {
          job.filtro[campo] += f[campo] || 0;
        }
      }
      if (!agente) continue;
      // A triagem pode ter posto notícias novas na fila: o total cresce com elas.
      const fila = (await agenteMod.contarFila(client, [grupo.id])).get(grupo.id) || 0;
      const naConta = job.filaPrevista.get(grupo.id) || 0;
      job.total += Math.max(0, Math.min(fila, job.limitePorGrupo) - naConta);
      job.grupo_atual = `${grupo.nome} (agente)`;
      const a = await agenteMod.decidirGrupo({
        db: client,
        grupo,
        agente,
        limite: job.limitePorGrupo,
        onProgresso: (feitas) => { job.feitas = Math.min(job.total, antes + feitas); },
      });
      antes += a.lidas;
      job.feitas = Math.min(job.total, antes);
      for (const campo of ["projetos_criados", "vinculadas", "descartadas", "revisao_humana", "erros"]) {
        job.agente[campo] += a[campo] || 0;
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
 * Inicia a triagem de um grupo (ou de todos com notícia sem triagem).
 * Se já houver uma rodando, devolve essa.
 */
async function iniciarTriagem({ grupoId = null, ia, agente = null, filtro = null, limitePorGrupo = 400 }) {
  if (ativo && jobs.get(ativo)?.status === "rodando") return publico(jobs.get(ativo));
  const client = await pool.connect();
  let grupos;
  let pendentes;
  let fila = new Map();
  let filaFiltro = new Map();
  try {
    grupos = (await carregarGrupos(client)).filter((g) => !grupoId || g.id === grupoId);
    pendentes = await contarPendentes(client, grupos.map((g) => g.id));
    if (filtro) filaFiltro = await filtroMod.contarFila(client, grupos.map((g) => g.id));
    if (agente) fila = await agenteMod.contarFila(client, grupos.map((g) => g.id));
  } finally {
    client.release();
  }
  grupos = grupos.filter((g) => pendentes.get(g.id) || filaFiltro.get(g.id) || fila.get(g.id));
  const job = {
    id: crypto.randomUUID(),
    grupo_id: grupoId,
    escopo: grupoId ? grupos[0]?.nome || "empresa" : "todas as empresas",
    modo: agente ? "agente" : "triagem",
    status: grupos.length ? "rodando" : "concluida",
    feitas: 0,
    total: grupos.reduce((total, g) => total + Math.min(pendentes.get(g.id) || 0, limitePorGrupo)
      + Math.min(filaFiltro.get(g.id) || 0, limitePorGrupo)
      + Math.min(fila.get(g.id) || 0, limitePorGrupo), 0),
    grupo_atual: null,
    resumo: { lidas: 0, regras: 0, ia_descartadas: 0, capex: 0, sugeridos: 0, novos_projetos: 0, erros_ia: 0 },
    filtro: { ativo: Boolean(filtro), modelo: filtro?.modelo || null, mantidas: 0, descartadas: 0, repetidas: 0, erros: 0 },
    agente: { projetos_criados: 0, vinculadas: 0, descartadas: 0, revisao_humana: 0, erros: 0 },
    filaPrevista: fila,
    filtroPrevisto: filaFiltro,
    erro: null,
    iniciou_em: new Date().toISOString(),
    terminou_em: null,
    limitePorGrupo,
    grupos,
  };
  jobs.set(job.id, job);
  // Guarda só as últimas rodadas.
  for (const id of [...jobs.keys()].slice(0, -10)) jobs.delete(id);
  if (grupos.length) {
    ativo = job.id;
    executar(job, ia, agente, filtro);
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
