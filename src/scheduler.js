const db = require("./db");
const { scanPrimarySources } = require("./scanner");
const { discoverPublishers } = require("./publisher-radar");
const { applyYieldDecisions, retireStaleSources } = require("./source-lifecycle");
const { DIARIOS_PDF, syncDoePdf } = require("./enrichment/doe-pdf");

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SCAN_MS = WEEK_MS;
const DISCOVER_MS = WEEK_MS;
const RETIRE_MS = WEEK_MS;
const DOE_PDF_MS = 24 * 60 * 60 * 1000;
const DOE_PDF_DIAS = 7;
const TICK_MS = 60 * 1000;
const FIXA_RUN_LIMIT = 80;
const PROVA_RUN_LIMIT = 40;

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
  summarize,
  tick,
  startScheduler,
};
