const test = require("node:test");
const assert = require("node:assert/strict");
const {
  groupByCnpj,
  chooseCompany,
  cadastroMatches,
  sameRoot,
  ownersFromParticipacao,
} = require("../src/enrichment/resolve");
const { viableSources } = require("../src/enrichment/viability");

test("escolhe fontes pelo nicho depois que o CNPJ existe", () => {
  const mining = viableSources({ nicho: "mineração", nome: "Mineração Taboca" }).map((item) => item.codigo);
  const retail = viableSources({ nicho: "varejo de moda", nome: "Riachuelo" }).map((item) => item.codigo);
  assert.ok(mining.includes("SEC-SIGA"));
  assert.ok(mining.includes("SEC-IBAMA"));
  assert.deepEqual(retail, ["SEC-BNDES", "SEC-CVM-IPE", "SEC-CNO"]);
  const road = viableSources({ nicho: "rodovia", nome: "Dutra", uf: "SP" }).map((item) => item.codigo);
  assert.ok(road.includes("SEC-ANTT-INV"));
  assert.ok(!road.includes("SEC-OBRASGOV"));
  assert.ok(!road.includes("SEC-OBRAS-MG"));
  const port = viableSources({ nicho: "terminal portuário", nome: "Santos", uf: "SP" }).map((item) => item.codigo);
  assert.ok(port.includes("SEC-ANTAQ-INST"));
});

test("lê dono e CNPJ da participação do SIGA", () => {
  const owners = ownersFromParticipacao(
    "60% para MINERACAO TABOCA S A - 34.019.992/0001-10 (APE), 40% para TABOCA ENERGIA S/A - 48.831.763/0001-00 (PIE)",
  );
  assert.deepEqual(owners, [
    { nome: "MINERACAO TABOCA S A", cnpj: "34019992000110" },
    { nome: "TABOCA ENERGIA S/A", cnpj: "48831763000100" },
  ]);
});

test("escolhe o único CNPJ encontrado pelo nome", () => {
  const groups = groupByCnpj([
    { base: "SEC-BNDES", cnpj: "33.200.056/0001-49", nome: "LOJAS RIACHUELO SA", linhas: 12 },
    { base: "SEC-BNDES", cnpj: "33200056000149", nome: "LOJAS RIACHUELO SA", linhas: 4 },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].linhas, 16);
  assert.equal(chooseCompany(groups).cnpj, "33200056000149");
});

test("não escolhe quando o nome aponta para dois CNPJs", () => {
  const groups = groupByCnpj([
    { base: "SEC-BNDES", cnpj: "33200056000149", nome: "LOJAS RIACHUELO SA" },
    { base: "SEC-CVM-IPE", cnpj: "08402943000152", nome: "GUARARAPES CONFECCOES S/A" },
  ]);
  assert.equal(chooseCompany(groups).cnpj, null);
});

test("confirma o cadastro pelo nome e separa matriz de filial da mesma raiz", () => {
  assert.equal(cadastroMatches({
    razao_social: "LOJAS RIACHUELO SA",
    nome_fantasia: "LOJAS RIACHUELO",
  }, "riachuelo"), true);
  assert.equal(sameRoot("33200056000149", "33200056062500"), true);
  assert.equal(sameRoot("33200056000149", "08402943000152"), false);
});
