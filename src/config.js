const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variável obrigatória ausente: ${name}`);
  }
  return value;
}

function getConfig() {
  const databaseUrl = requireEnv("SUPABASE_STRING");
  if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    throw new Error("SUPABASE_STRING deve ser uma URI Postgres");
  }

  const nodeEnv = process.env.NODE_ENV || "development";
  const schedulerDisabled =
    /^(1|true|yes|on)$/i.test(process.env.DISABLE_SCHEDULER?.trim() || "");

  return {
    databaseUrl,
    openAiApiKey: process.env.OPENAI_API_KEY?.trim() || null,
    openAiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
    openAiDecisionModel:
      process.env.OPENAI_DECISION_MODEL?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      "gpt-4.1-mini",
    dadosGovToken: process.env.TOKEN_DADOS_GOV?.trim() || null,
    port: Number(process.env.PORT || 3000),
    nodeEnv,
    isProduction: nodeEnv === "production",
    onRailway: Boolean(process.env.RAILWAY_ENVIRONMENT?.trim()),
    schedulerEnabled: !schedulerDisabled,
  };
}

module.exports = { getConfig };
