const test = require("node:test");
const assert = require("node:assert/strict");
const seg = require("../src/capex-segmentos");

test("faixas de CNAE para o índice", () => {
  assert.deepEqual(seg.faixas(["21", "4711", "07"]), [["21", "22"], ["4711", "4712"], ["07", "08"]]);
});

test("nicho pelo CNAE: prefixo mais longo, iniciais preservados", () => {
  assert.equal(seg.nichoDoCnae("2121101"), "farmaceutico");
  assert.equal(seg.nichoDoCnae("4711302"), "varejo");
  assert.equal(seg.nichoDoCnae("1931400"), "bioenergia");
  assert.equal(seg.nichoDoCnae("1099699"), "alimentos_bebidas");
  assert.equal(seg.nichoDoCnae("1721400"), "papel_celulose");
  assert.equal(seg.nichoDoCnae("3299099"), "industria");
});

test("nome do grupo e termos de busca", () => {
  const r = { nome_fantasia: "NEO QUIMICA / GENOM", razao_social: "BRAINFARMA INDUSTRIA QUIMICA E FARMACEUTICA S.A." };
  assert.equal(seg.nomeDoGrupo(r), "Neo Quimica");
  assert.deepEqual(seg.termosDaEmpresa(r, "Neo Quimica"), { marca: ["Neo Quimica"], variacao: ["Brainfarma Industria Quimica e Farmaceutica"] });
  assert.equal(seg.nomeDoGrupo({ nome_fantasia: "", razao_social: "LIBBS FARMACEUTICA LTDA" }), "Libbs Farmaceutica");
});

test("rótulos incluem iniciais e segmentos", () => {
  const r = seg.rotulos();
  assert.equal(r.datacenter, "Datacenters");
  assert.equal(r.saude, "Hospitais e saúde");
  assert.ok(seg.contextoDoNicho("portuario").includes("terminal"));
});
