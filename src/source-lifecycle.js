const db = require("./db");

const PROMOTION_MIN_ANALYZED = 4;
const PROMOTION_MIN_RATE = 0.2;
const PROVA_MAX_DAYS = 21;
const FIXA_IDLE_DAYS = 28;

const BRAZIL_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

function promotionDecision({ analyzed = 0, privateBrazil = 0 } = {}) {
  if (analyzed < PROMOTION_MIN_ANALYZED) return "aguardar";
  if (privateBrazil >= 1 && privateBrazil / analyzed >= PROMOTION_MIN_RATE) return "fixa";
  if (analyzed >= 8 && privateBrazil === 0) return "aposentar";
  return "aguardar";
}

function shouldRetire(source) {
  const stage = source.estagio;
  if (source.status_acesso === "bloqueado" && ["sugerida", "prova", "fixa"].includes(stage)) {
    return true;
  }
  const daysInStage = Number(source.days_in_stage ?? 0);
  if (stage === "fixa") {
    const sincePrivate = source.days_since_private === null || source.days_since_private === undefined
      ? null
      : Number(source.days_since_private);
    return daysInStage >= FIXA_IDLE_DAYS && (sincePrivate === null || sincePrivate >= FIXA_IDLE_DAYS);
  }
  if (stage === "prova") {
    return daysInStage >= PROVA_MAX_DAYS
      && Number(source.analyzed || 0) >= PROMOTION_MIN_ANALYZED
      && Number(source.private_brazil || 0) === 0;
  }
  return false;
}

async function applyYieldDecisions() {
  const sources = await db.listSourcesByStage("prova");
  const actions = [];
  for (const source of sources) {
    const stats = await db.provaStats(source.id, source.estagio_desde);
    const decision = promotionDecision(stats);
    if (decision === "fixa") {
      await db.setSourceStage(source.id, "fixa", { participaScanner: true });
      actions.push({ codigo: source.codigo, decisao: "fixa" });
    } else if (decision === "aposentar") {
      await db.setSourceStage(source.id, "aposentada", { participaScanner: false });
      actions.push({ codigo: source.codigo, decisao: "aposentada" });
    }
  }
  return actions;
}

async function retireStaleSources() {
  const sources = await db.sourcesForRetirement();
  const retired = [];
  for (const source of sources) {
    if (!shouldRetire(source)) continue;
    await db.setSourceStage(source.id, "aposentada", { participaScanner: false });
    retired.push(source.codigo);
  }
  return retired;
}

module.exports = {
  BRAZIL_UFS,
  PROMOTION_MIN_ANALYZED,
  PROMOTION_MIN_RATE,
  PROVA_MAX_DAYS,
  FIXA_IDLE_DAYS,
  promotionDecision,
  shouldRetire,
  applyYieldDecisions,
  retireStaleSources,
};
