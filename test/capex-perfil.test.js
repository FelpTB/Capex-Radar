const test = require("node:test");
const assert = require("node:assert/strict");

// capex-perfil importa db.js, que exige a URI do banco; o pool não conecta sem consulta.
process.env.SUPABASE_STRING ||= "postgres://teste:teste@localhost:5432/teste";
const { reabrirPreTriagem } = require("../src/capex-perfil");

// Banco falso: devolve o município do projeto e os registros da pré-triagem,
// e guarda os ids reabertos.
function bancoFalso(municipio, registros) {
  const reabertos = [];
  return {
    reabertos,
    async query(sql, params) {
      if (/from capex_radar\.projetos/.test(sql)) return { rows: [{ municipio }] };
      if (/^\s*select id, registro/.test(sql)) return { rows: registros };
      if (/update capex_radar\.registros_analisados/.test(sql)) { reabertos.push(...params[0]); return { rowCount: params[0].length }; }
      throw new Error(`consulta inesperada: ${sql}`);
    },
  };
}

test("reabrirPreTriagem volta para o julgamento só o que cita o município corrigido", async () => {
  const db = bancoFalso("Rancho Alegre d'Oeste", [
    { id: 1, registro: { municipio: "RANCHO ALEGRE D'OESTE", nome: "Incubatório" } },
    { id: 2, registro: { municipio: "PALOTINA" } },
    { id: 3, registro: { contexto: "Outorga ... Município Rancho Alegre D'Oeste. Portaria" } },
  ]);
  assert.equal(await reabrirPreTriagem(db, "p1"), 2);
  assert.deepEqual(db.reabertos, [1, 3]);
});

test("reabrirPreTriagem não faz nada com município curto ou vazio", async () => {
  const db = bancoFalso("", [{ id: 1, registro: { municipio: "X" } }]);
  assert.equal(await reabrirPreTriagem(db, "p1"), 0);
  assert.deepEqual(db.reabertos, []);
});
