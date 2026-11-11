const db = require("./db");
const { scanPrimarySources } = require("./scanner");
const { discoverPublishers } = require("./publisher-radar");
const { applyYieldDecisions, retireStaleSources } = require("./source-lifecycle");
const { DIARIOS_PDF, syncDoePdf } = require("./enrichment/doe-pdf");
const capexColetor = require("./capex-coletor");
const { iaPadrao } = require("./capex-ia");
const capexAgente = require("./capex-agente");
const capexFiltro = require("./capex-filtro");
const capexEnriquecimento = require("./capex-enriquecimento");
const capexFiltroFinal = require("./capex-filtro-final");
const capexSecundarias = require("./capex-fontes-secundarias");

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SCAN_MS = WEEK_MS;
const DISCOVER_MS = WEEK_MS;
const RETIRE_MS = WEEK_MS;
const DOE_PDF_MS = 24 * 60 * 60 * 1000;
const DOE_PDF_DIAS = 7;
const TICK_MS = 60 * 1000;
const FIXA_RUN_LIMIT = 80;
const PROVA_RUN_LIMIT = 40;
// Linhas do tempo montadas por ciclo (um por minuto): projeto novo, sem
// marcos ou com evidência nova. CAPEX_LINHA_TEMPO=0 desliga.
const LINHA_TEMPO_POR_CICLO = 3;

function isDue(lastAt, intervalMs, now = Date.now()) {
  if (!lastAt) return true;
  return now - new Date(lastAt).getTime() >= intervalMs;
}

async function runScheduledScan() {
  const fixa = await scanPrimarySources({ limit: FIXA_RUN_LIMIT });
  const sources = await db.listSourcesByStage("prova");
  const prova = sources.length
    ? await scanPrimarySources({
      codigos: sources.map((source) => source.codigo),
      perSource: 2,
      limit: PROVA_RUN_LIMIT,
    })
    : { analyzed: 0, kept: 0, filteredOut: 0, sources: 0 };
  const promocoes = await applyYieldDecisions();
  return { fixa, prova, promocoes };
}

// Diários sem busca no portal (PA, PB, RO, RR): o índice de PDFs é relido todo dia.
// A última carga de cada UF em base_carga marca quando a sincronização rodou.
async function doePdfDue(now = Date.now()) {
  const codigos = Object.keys(DIARIOS_PDF).map((uf) => `CAPTURA-DOE-${uf}`);
  const loads = await db.latestBaseLoads(codigos);
  if (loads.length < codigos.length) return true;
  return loads.some((load) => isDue(load.carregado_em, DOE_PDF_MS, now));
}

async function runDoePdfSync() {
  const resultados = [];
  for (const uf of Object.keys(DIARIOS_PDF)) {
    try {
      resultados.push(await syncDoePdf(uf, { dias: DOE_PDF_DIAS }));
    } catch (error) {
      resultados.push({ uf, lidas: 0, paginas: 0, erros: 1, falha: error.message });
      // Sem esta linha a UF ficaria sempre vencida e seria tentada a cada minuto.
      await db.pool.query(
        "insert into base_carga (codigo, recurso, status, erro) values ($1, 'doe_pdf_pagina', 'erro', $2)",
        [`CAPTURA-DOE-${uf}`, String(error.message).slice(0, 500)],
      ).catch(() => {});
    }
  }
  return resultados;
}

// Teste de monitoramento (capex_radar): notícias dos últimos 14 dias das 38
// empresas, uma vez por semana. A carga histórica roda à parte (npm run capex:coletar).
// A semana vence por grupo: se o app reiniciar no meio da rodada, o próximo
// ciclo coleta só os grupos que faltaram.
async function runLinhasDoTempo() {
  if (/^(0|false|no|off)$/i.test(process.env.CAPEX_LINHA_TEMPO?.trim() || "")) return null;
  const cronista = capexSecundarias.cronistaPadrao();
  if (!cronista) return null;
  const r = await capexSecundarias.atualizarLinhasDoTempo(db.pool, cronista, { limite: LINHA_TEMPO_POR_CICLO });
  return r.pendentes ? r : null;
}

async function runCapexWeekly() {
  const client = await db.pool.connect();
  try {
    const grupos = await capexColetor.gruposVencidos(client, await capexColetor.carregarGrupos(client));
    if (!grupos.length) return null;
    const resultado = await capexColetor.coletarGrupos({
      client,
      grupos,
      ...capexColetor.janelaSemanal(),
      ia: iaPadrao(),
    });
    // Fases do funil depois do Filtro 1 (capex-fases.js), nas empresas
    // coletadas: Filtro 2, Enriquecimento e Filtro 3. Fase desligada no .env
    // (CAPEX_FILTRO, CAPEX_ENRIQUECIMENTO, CAPEX_FILTRO_FINAL = 0) não roda.
    const coletados = new Set(resultado.coleta.map((c) => c.grupo));
    const daRodada = grupos.filter((g) => coletados.has(g.nome));
    const fases = [
      ["filtro", capexFiltro.filtroPadrao(), (grupo, filtro) => capexFiltro.filtrarGrupo({ db: client, grupo, filtro })],
      ["enriquecimento", capexEnriquecimento.enriquecedorPadrao(), (grupo, enriquecedor) => capexEnriquecimento.enriquecerGrupo({ db: client, grupo, enriquecedor })],
      ["filtro_final", capexFiltroFinal.filtroFinalPadrao(), (grupo, filtro) => capexFiltroFinal.filtrarGrupo({ db: client, grupo, filtro })],
    ];
    for (const [chave, modelo, rodar] of fases) {
      if (!modelo) continue;
      resultado[chave] = [];
      for (const grupo of daRodada) resultado[chave].push(await rodar(grupo, modelo));
    }
    // Triagem automática: o agente decide a fila das empresas coletadas.
    // CAPEX_AGENTE_AUTO=0 desliga e deixa tudo para a revisão na tela.
    const agente = /^(0|false|no|off)$/i.test(process.env.CAPEX_AGENTE_AUTO?.trim() || "") ? null : capexAgente.agentePadrao();
    if (agente) {
      resultado.agente = [];
      for (const grupo of daRodada) {
        resultado.agente.push(await capexAgente.decidirGrupo({ db: client, grupo, agente }));
      }
    }
    return resultado;
  } finally {
    client.release();
  }
}

function summarize(summary) {
  const parts = [];
  if (summary.descoberta) {
    const item = summary.descoberta;
    parts.push(
      `descoberta: ${item.aparicoes} portais, ${item.sugeridas} sugeridas, ${item.provas} em prova`,
    );
    if (item.erros?.length) parts.push(`${item.erros.length} buscas com erro`);
  }
  if (summary.scan) {
    if (summary.scan.pulado) parts.push(summary.scan.pulado);
    else {
      const analyzed = (summary.scan.fixa?.analyzed || 0) + (summary.scan.prova?.analyzed || 0);
      const kept = (summary.scan.fixa?.kept || 0) + (summary.scan.prova?.kept || 0);
      parts.push(`varredura: ${analyzed} lidas, ${kept} projetos privados`);
    }
  }
  if (summary.aposentadoria) {
    parts.push(`${summary.aposentadoria.length} fontes aposentadas`);
  }
  if (summary.doePdf) {
    const lidas = summary.doePdf.reduce((total, item) => total + item.lidas, 0);
    const paginas = summary.doePdf.reduce((total, item) => total + item.paginas, 0);
    parts.push(`diários em PDF: ${lidas} edições, ${paginas} páginas`);
  }
  if (summary.capex) parts.push(`monitoramento: ${capexColetor.resumoTexto(summary.capex)}`);
  if (summary.linhaTempo) parts.push(`linha do tempo: ${summary.linhaTempo.montadas} projeto(s) montado(s)${summary.linhaTempo.erros ? `, ${summary.linhaTempo.erros} com erro` : ""}`);
  return parts.join(" · ") || "ciclo em dia";
}

async function tick() {
  return db.withCycleLock(async () => {
    const state = await db.cycleState();
    const summary = {};
    if (isDue(state.ultima_descoberta_em, DISCOVER_MS)) {
      summary.descoberta = await discoverPublishers();
      await db.touchCycle("ultima_descoberta_em");
    }
    if (isDue(state.ultimo_scan_em, SCAN_MS)) {
      summary.scan = await runScheduledScan();
      await db.touchCycle("ultimo_scan_em");
    }
    if (isDue(state.ultima_aposentadoria_em, RETIRE_MS)) {
      summary.aposentadoria = await retireStaleSources();
      await db.touchCycle("ultima_aposentadoria_em");
    }
    if (await doePdfDue()) {
      summary.doePdf = await runDoePdfSync();
    }
    // Falha no monitoramento (ex.: migração 020 ausente) não derruba o resto do ciclo.
    try {
      const capex = await runCapexWeekly();
      if (capex) summary.capex = capex;
    } catch (error) {
      console.error(`Monitoramento capex_radar: ${error.message}`);
    }
    try {
      const linhaTempo = await runLinhasDoTempo();
      if (linhaTempo) summary.linhaTempo = linhaTempo;
    } catch (error) {
      console.error(`Linha do tempo: ${error.message}`);
    }
    if (Object.keys(summary).length) {
      const text = summarize(summary);
      await db.setCycleSummary(text);
      console.log(`Ciclo de fontes: ${text}`);
    }
    return summary;
  });
}

function startScheduler() {
  const boot = async () => {
    await db.withCycleLock(async () => {
      const state = await db.cycleState();
      if (!state.ultimo_scan_em) await db.touchCycle("ultimo_scan_em");
      if (!state.ultima_aposentadoria_em) await db.touchCycle("ultima_aposentadoria_em");
    });
    await tick();
  };

  setTimeout(() => {
    boot().catch((error) => console.error(`Ciclo inicial: ${error.message}`));
  }, 15_000);
  setInterval(() => {
    tick().catch((error) => console.error(`Ciclo: ${error.message}`));
  }, TICK_MS);
}

module.exports = {
  WEEK_MS,
  SCAN_MS,
  DISCOVER_MS,
  RETIRE_MS,
  DOE_PDF_MS,
  doePdfDue,
  isDue,
  runScheduledScan,
  runLinhasDoTempo,
  summarize,
  tick,
  startScheduler,
};
