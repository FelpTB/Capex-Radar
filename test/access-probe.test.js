const test = require("node:test");
const assert = require("node:assert/strict");
const { probeOutcome, reachStatus, isManualAccess } = require("../src/access-probe");

test("página pública com HTTP 200 fica acessível", () => {
  const outcome = probeOutcome({ auth_acesso: "nenhuma" }, 200, null);
  assert.equal(outcome.status, "ok");
  assert.equal(outcome.manual, false);
  assert.equal(outcome.error, null);
});

test("HTTP 404 em fonte pública fica indisponível", () => {
  const outcome = probeOutcome({ auth_acesso: "nenhuma" }, 404, "HTTP 404");
  assert.equal(reachStatus(404, "HTTP 404"), "indisponivel");
  assert.equal(outcome.status, "indisponivel");
});

test("página que abre mas exige chave continua bloqueada", () => {
  const outcome = probeOutcome({ auth_acesso: "chave" }, 200, null);
  assert.equal(isManualAccess("chave"), true);
  assert.equal(outcome.manual, true);
  assert.equal(outcome.status, "bloqueado");
  assert.match(outcome.error, /chave de API/);
});

test("timeout em fonte com paywall registra a falha e a barreira", () => {
  const outcome = probeOutcome({ auth_acesso: "captcha_paywall" }, null, "Timeout");
  assert.equal(outcome.status, "instavel");
  assert.match(outcome.error, /Timeout/);
  assert.match(outcome.error, /assinatura/);
});
