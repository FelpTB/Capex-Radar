// Refaz a cronologia dos projetos ativos com linha do tempo: devolve as
// evidências tiradas pela regra e aplica de novo (src/capex-fontes-secundarias.js).
// Uso: node scripts/capex-cronologia.js [--seco]
const { pool } = require("../src/db");
const painel = require("../src/capex-painel-db");
const sec = require("../src/capex-fontes-secundarias");
const perfis = require("../src/capex-perfil");

const ATOR = "usuario:claude-code";

async function main() {
  const seco = process.argv.includes("--seco");
  const { rows: projetos } = await pool.query(
    `select v.*, p.linha_tempo, p.data_fim from capex_radar.vw_carteira v join capex_radar.projetos p on p.id = v.id
      where v.status = 'ativo' and p.linha_tempo->>'modelo' = 'claude-code'`,
  );
  let devolvidas = 0;
  let tiradas = 0;
  for (const p of projetos) {
    const { rows: todas } = await pool.query(
      `select e.id, e.data_original, e.fonte_codigo, ep.situacao, ep.descarte
         from capex_radar.evidencia_projeto ep join capex_radar.evidencias e on e.id = ep.evidencia_id
        where ep.projeto_id = $1 and (ep.situacao = 'aceito' or ep.descarte = 'cronologia')`,
      [p.id],
    );
    const fora = sec.foraDaCronologia(p, todas);
    const foraIds = new Set(fora.map((f) => f.id));
    const voltar = todas.filter((e) => e.descarte === "cronologia" && !foraIds.has(String(e.id)));
    const novas = fora.filter((f) => todas.find((e) => String(e.id) === f.id)?.situacao === "aceito");
    if (!voltar.length && !novas.length) continue;
    console.log(`${p.titulo}: devolve ${voltar.length}, tira ${novas.length}`);
    if (seco) continue;
    if (voltar.length) {
      await painel.emTransacao((c) => c.query(
        `update capex_radar.evidencia_projeto set situacao = 'aceito', descarte = null, motivo = null, revisado_por = $3, revisado_em = now()
          where projeto_id = $1 and evidencia_id = any($2::uuid[])`,
        [p.id, voltar.map((e) => e.id), ATOR],
      ), ATOR);
    }
    devolvidas += voltar.length;
    tiradas += await sec.aplicarCronologia(p.id, novas, ATOR);
    // A linha do tempo guarda quantas evidências leu; com o número certo, o
    // ciclo (runLinhasDoTempo) não a refaz por achar que entrou evidência nova.
    await painel.emTransacao((c) => c.query(
      `update capex_radar.projetos set linha_tempo = jsonb_set(linha_tempo, '{evidencias}',
              to_jsonb((select count(*) from capex_radar.evidencia_projeto where projeto_id = $1 and situacao = 'aceito')))
        where id = $1`,
      [p.id],
    ), ATOR);
    await painel.emTransacao((c) => perfis.montarPerfil(c, p.id), ATOR);
  }
  console.log(`Devolvidas: ${devolvidas}. Tiradas: ${tiradas}.`);
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => pool.end());
