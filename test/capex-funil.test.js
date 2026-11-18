const test = require("node:test");
const assert = require("node:assert/strict");

// O script importa db.js, que exige a URI do banco; o pool não conecta sem consulta.
process.env.SUPABASE_STRING ||= "postgres://teste:teste@localhost:5432/teste";
const funil = require("../scripts/capex-funil");

const P1 = "11111111-1111-1111-1111-111111111111";
const base = { evidencia_id: "e1", justificativa: "motivo concreto" };

test("validarDecisao aceita as três decisões bem formadas", () => {
  const ctx = { projetosDoGrupo: new Set([P1]), refs: new Set(["a"]) };
  assert.deepEqual(funil.validarDecisao({ ...base, decisao: "vincular", motivo: "mesmo_projeto", projeto_id: P1 }, ctx), []);
  assert.deepEqual(funil.validarDecisao({ ...base, decisao: "vincular", motivo: "mesmo_projeto", projeto_id: "ref:a" }, ctx), []);
  assert.deepEqual(funil.validarDecisao({ ...base, decisao: "descartar", motivo: "sem_obra" }, ctx), []);
  assert.deepEqual(funil.validarDecisao({ ...base, decisao: "criar_projeto", motivo: "obra_nova", projeto: { titulo: "fábrica", uf: "MG", estagio: "anuncio" } }, ctx), []);
});

test("validarDecisao recusa projeto de outro grupo, motivo inválido e repetida sem par", () => {
  const ctx = { projetosDoGrupo: new Set([P1]) };
  assert.match(funil.validarDecisao({ ...base, decisao: "vincular", motivo: "mesmo_projeto", projeto_id: "outro" }, ctx).join(), /fora do grupo/);
  assert.match(funil.validarDecisao({ ...base, decisao: "descartar", motivo: "nao_existe" }, ctx).join(), /motivo de descarte inválido/);
  assert.match(funil.validarDecisao({ ...base, decisao: "descartar", motivo: "repetida" }, ctx).join(), /repete_id/);
  assert.match(funil.validarDecisao({ ...base, decisao: "criar_projeto", motivo: "obra_nova", projeto: { titulo: "x", uf: "Minas" } }, ctx).join(), /UF inválida/);
  assert.match(funil.validarDecisao({ evidencia_id: "e1", decisao: "descartar", motivo: "sem_obra" }, ctx).join(), /justificativa/);
});

test("extracaoDe e veredito gravam no formato das fases automáticas", () => {
  const d = { ...base, decisao: "descartar", motivo: "sem_obra", leitura: { uf: "SP", valor_brl: "1000", estagio: "anuncio", data_fato: "2026-01" } };
  const ex = funil.extracaoDe(d);
  assert.equal(ex.etapa, "claude-code");
  assert.equal(ex.valor_brl, 1000);
  assert.equal(ex.data_fato, "2026-01");
  const v = funil.veredito(d, "filtro-v1");
  assert.equal(v.decisao, "descartar");
  assert.equal(v.modelo, "claude-code");
  assert.equal(funil.veredito({ ...d, decisao: "vincular" }, "filtro3-v1").decisao, "manter");
});
