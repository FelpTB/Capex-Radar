const test = require("node:test");
const assert = require("node:assert/strict");
const { projectContext, dedupeProjects } = require("../src/ai");

test("isola o trecho do ativo para a decisão da empresa", () => {
  const text = `A Aena conclui o pátio remoto em Congonhas. ${"x".repeat(900)} A Weg anunciou a fábrica em Itajaí.`;
  const context = projectContext(text, "A Weg anunciou a fábrica em Itajaí.");
  assert.match(context, /Weg/);
  assert.equal(context.includes("Aena"), false);
});

test("não repete o mesmo ativo extraído duas vezes", () => {
  const projects = dedupeProjects([
    { nome: "Pátio remoto de Congonhas" },
    { nome: "pátio remoto de Congonhas" },
    { nome: "Fábrica de baterias da Weg" },
  ]);
  assert.deepEqual(projects.map((item) => item.nome), [
    "Pátio remoto de Congonhas",
    "Fábrica de baterias da Weg",
  ]);
});
