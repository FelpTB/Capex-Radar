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

test("citaMunicipio aceita grafias com d', do e sem acento, e exige palavra inteira", () => {
  const { chaveMunicipio, citaMunicipio } = require("../src/enrichment/resolve");
  assert.equal(chaveMunicipio("São Jorge d'Oeste"), chaveMunicipio("SAO JORGE DO OESTE"));
  assert.equal(citaMunicipio("Rodovia PR 281, sn no município de São Jorge do Oeste/PR", "São Jorge d'Oeste"), true);
  assert.equal(citaMunicipio("Município Rancho Alegre D’Oeste.", "Rancho Alegre do Oeste"), true);
  assert.equal(citaMunicipio("Itapiranga/SC", "Ipira"), false);
  assert.equal(citaMunicipio("qualquer texto", "Ijuí"), false);
});

const { lancamentoProposto } = require("../src/capex-perfil");

test("lançamento é a primeira evidência forte, não o fato da notícia", () => {
  const primeira = { id: "e1", titulo: "Empresa anuncia fábrica", fonte_codigo: "gnews_rss", data_original: "2023-05-04T10:00:00Z" };
  const r = lancamentoProposto({ data_anuncio: "2025-08-06", data_anuncio_origem: null }, primeira);
  assert.equal(r.data, "2023-05-04");
  assert.equal(r.origem, "noticia");
  assert.equal(r.ref.evidencia_id, "e1");
  const cno = lancamentoProposto({ data_anuncio: "2026-03-05" }, { id: "c1", fonte_codigo: "SEC-CNO", data_original: "2026-03-03" });
  assert.equal(cno.origem, "cno");
  assert.equal(cno.data, "2026-03-03");
});

test("data manual fica e aponta evidência anterior", () => {
  const primeira = { id: "e1", titulo: "antiga", fonte_codigo: "gnews_rss", data_original: "2020-07-22" };
  const r = lancamentoProposto({ data_anuncio: "2025-01-13", data_anuncio_origem: "manual" }, primeira);
  assert.equal(r.data, "2025-01-13");
  assert.equal(r.origem, "manual");
  assert.equal(r.ref.mais_antiga.data, "2020-07-22");
  assert.equal(lancamentoProposto({ data_anuncio: "2019-01-01", data_anuncio_origem: "manual" }, primeira).ref, null);
});

test("sem evidência forte, a data atual fica", () => {
  const r = lancamentoProposto({ data_anuncio: "2024-01-10", data_anuncio_origem: null }, null);
  assert.equal(r.data, "2024-01-10");
});
