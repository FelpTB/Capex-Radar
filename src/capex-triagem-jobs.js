// Triagem da IA em segundo plano, com progresso para a barra da tela.
//
// Uma triagem por vez no processo: a tela inicia, recebe o id e consulta o
// andamento. O estado fica em memória; um reinício do app perde só a barra,
// porque o que já foi triado está gravado e o resto continua pendente.
const crypto = require("node:crypto");
const { pool } = require("./db");
const { carregarGrupos, triarGrupo } = require("./capex-coletor");

const jobs = new Map();
let ativo = null;

function publico(job) {
  if (!job) return null;
  const { grupos: _grupos, ...resto } = job;
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
async function iniciarTriagem({ grupoId = null, ia, limitePorGrupo = 400 }) {
  if (ativo && jobs.get(ativo)?.status === "rodando") return publico(jobs.get(ativo));
  const client = await pool.connect();
  let grupos;
  let pendentes;
  try {
    grupos = (await carregarGrupos(client)).filter((g) => !grupoId || g.id === grupoId);
    pendentes = await contarPendentes(client, grupos.map((g) => g.id));
  } finally {
    client.release();
  }
  grupos = grupos.filter((g) => pendentes.get(g.id));
  const job = {
    id: crypto.randomUUID(),
    grupo_id: grupoId,
    escopo: grupoId ? grupos[0]?.nome || "empresa" : "todas as empresas",
    status: grupos.length ? "rodando" : "concluida",
    feitas: 0,
    total: grupos.reduce((total, g) => total + Math.min(pendentes.get(g.id), limitePorGrupo), 0),
    grupo_atual: null,
    resumo: { lidas: 0, regras: 0, ia_descartadas: 0, capex: 0, sugeridos: 0, novos_projetos: 0, erros_ia: 0 },
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
