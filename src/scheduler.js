const db = require("./db");
const { scanPrimarySources } = require("./scanner");
const { discoverPublishers } = require("./publisher-radar");
const { applyYieldDecisions, retireStaleSources } = require("./source-lifecycle");

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SCAN_MS = WEEK_MS;
const DISCOVER_MS = WEEK_MS;
const RETIRE_MS = WEEK_MS;
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
  isDue,
  runScheduledScan,
  summarize,
  tick,
  startScheduler,
};
