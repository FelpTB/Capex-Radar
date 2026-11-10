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
    claudeApiKey: process.env.CLAUDE_API_KEY?.trim() || null,
    claudeModel: process.env.CLAUDE_MODEL?.trim() || "claude-haiku-5-5",
    claudeDecisionModel:
      process.env.CLAUDE_DECISION_MODEL?.trim() ||
      process.env.CLAUDE_MODEL?.trim() ||
      "claude-haiku-5-5",
    claudeFilterModel: process.env.CLAUDE_FILTER_MODEL?.trim() || "claude-sonnet-5-5",
    claudeEnrichModel: process.env.CLAUDE_ENRICH_MODEL?.trim() || "claude-sonnet-5-5",
    claudeFilter3Model: process.env.CLAUDE_FILTER3_MODEL?.trim() || "claude-sonnet-5-5",
    dadosGovToken: process.env.TOKEN_DADOS_GOV?.trim() || null,
    // Acesso MCP: endereço público (vira o emissor OAuth) e login Google da ABC Advise.
    radarUrl: (process.env.RADAR_URL?.trim() || "https://capex-radar-buscafornecedor.up.railway.app").replace(/\/+$/, ""),
    googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || null,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || null,
    mcpDominio: (process.env.MCP_DOMINIO?.trim() || "abcadvise.com.br").toLowerCase(),
    port: Number(process.env.PORT || 3000),
    nodeEnv,
    isProduction: nodeEnv === "production",
    onRailway: Boolean(process.env.RAILWAY_ENVIRONMENT?.trim()),
    schedulerEnabled: !schedulerDisabled,
  };
}

module.exports = { getConfig };
