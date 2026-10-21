const db = require("./db");

const USER_AGENT = "RadarCapEx-MVP/0.1 (research; contact via project owner)";

const MANUAL_REASON = {
  chave: "Exige cadastro e chave de API guardada só no servidor.",
  oauth: "Exige consentimento OAuth de uma pessoa.",
  gcp: "Exige projeto no Google Cloud com faturamento para ler a tabela.",
  captcha_paywall: "Exige uma pessoa: captcha, Cloudflare ou assinatura.",
};

const MANUAL_BY_CODE = {
  "CAPTURA-SIMEC": "Exige login institucional de gestor. Não há chave de API pública.",
  "CAPTURA-SISMOB": "Exige credencial de gestor do Fundo Nacional de Saúde.",
};

function isManualAccess(auth) {
  return Object.prototype.hasOwnProperty.call(MANUAL_REASON, auth);
}

function reachStatus(httpStatus, error) {
  if (!error && httpStatus >= 200 && httpStatus < 400) return "ok";
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 451) return "bloqueado";
  if (httpStatus === 404 || httpStatus === 410) return "indisponivel";
  return "instavel";
}

function probeOutcome(source, httpStatus, error) {
  const reached = reachStatus(httpStatus, error);
  const manual = isManualAccess(source.auth_acesso);
  if (!manual) {
    return {
      status: reached,
      error,
      manual: false,
      reason: null,
    };
  }
  const reason = MANUAL_BY_CODE[source.codigo] || MANUAL_REASON[source.auth_acesso];
  if (reached === "indisponivel" || reached === "instavel") {
    return {
      status: reached,
      error: error ? `${error}. ${reason}` : reason,
      manual: true,
      reason,
    };
  }
  return {
    status: "bloqueado",
    error: reason,
    manual: true,
    reason,
  };
}

async function fetchStatus(url, timeoutMs = 20_000) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/json,application/xml,*/*",
    },
  });
  await response.body?.cancel().catch(() => {});
  return response.status;
}

async function probeSource(source) {
  let httpStatus = null;
  let error = null;
  try {
    httpStatus = await fetchStatus(source.url_base);
    if (httpStatus >= 400) error = `HTTP ${httpStatus}`;
  } catch (cause) {
    error = cause.name === "TimeoutError" ? "Timeout" : cause.message;
  }
  const outcome = probeOutcome(source, httpStatus, error);
  await db.registerSourceAccess(source.id, {
    httpStatus,
    error: outcome.error,
    status: outcome.status,
  });
  return {
    codigo: source.codigo,
    nome: source.nome,
    url: source.url_base,
    auth: source.auth_acesso,
    httpStatus,
    ...outcome,
  };
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

async function probeAllSources() {
  const sources = (await db.listSources()).filter((source) => source.ativo && source.url_base);
  const results = await mapPool(sources, 5, probeSource);
  const manual = results.filter((item) => item.manual);
  const failed = results.filter((item) => !item.manual && item.status !== "ok");
  return {
    total: results.length,
    ok: results.filter((item) => item.status === "ok").length,
    failed,
    manual,
    results,
  };
}

module.exports = {
  MANUAL_BY_CODE,
  MANUAL_REASON,
  isManualAccess,
  probeAllSources,
  probeOutcome,
  reachStatus,
};
