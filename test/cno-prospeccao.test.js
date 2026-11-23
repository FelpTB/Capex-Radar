const test = require("node:test");
const assert = require("node:assert/strict");
const p = require("../src/cno-prospeccao");

test("indústria privada: CNAE 10 a 32 e natureza jurídica não pública", () => {
  assert.equal(p.ehIndustrial("2121101"), true);
  assert.equal(p.ehIndustrial("1012101"), true);
  assert.equal(p.ehIndustrial("3321000"), false); // instalação de máquinas
  assert.equal(p.ehIndustrial("4120400"), false); // construção
  assert.equal(p.ehPrivada("2062"), true);
  assert.equal(p.ehPrivada("2038"), false); // economia mista
  assert.equal(p.ehPrivada("1015"), false);
  const cad = (cnae, nat, situacao = "ATIVA") => ({ cnpj: "12345678000199", cnae, natureza_codigo: nat, situacao });
  assert.equal(p.empresaIndustrial([cad("4120400", "2062"), cad("2121101", "2062")]).cnae, "2121101");
  assert.equal(p.empresaIndustrial([cad("2121101", "2062", "BAIXADA")]), null);
});

test("nicho pelo CNAE e CNPJ da matriz com dígitos verificadores", () => {
  assert.equal(p.nichoDoCnae("1113502"), "alimentos_bebidas");
  assert.equal(p.nichoDoCnae("1721400"), "papel_celulose");
  assert.equal(p.nichoDoCnae("2121101"), "industria");
  assert.equal(p.cnpjDaMatriz("33000167"), "33000167000101"); // Petrobras
  assert.equal(p.cnpjDaMatriz("00000000"), "00000000000191");
});

test("CNPJs da obra: construtora fica de fora, vínculos entram", () => {
  const obra = { ni: "11111111000111", empresa: "RMP CONSTRUCOES E ENGENHARIA LTDA", vinculos: [{ ni: "22222222000122" }] };
  assert.deepEqual(p.cnpjsDaObra(obra), ["22222222000122"]);
  assert.deepEqual(p.cnpjsDaObra({ ni: "33333333000133", empresa: "SOUZA CRUZ LTDA", vinculos: [] }), ["33333333000133"]);
});

test("projeto proposto da obra", () => {
  const empresa = { cnpj: "12345678000199", razao_social: "ACUMULADORES MOURA S A", nome_fantasia: null, cnae: "2722801" };
  const proj = p.projetoDaObra({ cno: "900111", municipio: "CASA NOVA", uf: "BA", area_obra: 18000, inicio: "2023-11-27", situacao: "02" }, empresa);
  assert.equal(proj.grupo, "Acumuladores Moura");
  assert.equal(proj.titulo, "galpão industrial de 18 mil m² em Casa Nova");
  assert.equal(proj.estagio, "mobilizacao");
  assert.equal(proj.nicho, "industria");
});
