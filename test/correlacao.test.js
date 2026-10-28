const test = require("node:test");
const assert = require("node:assert/strict");
const { correlateLines, localGate, rebuildFound } = require("../src/enrichment/correlacao");

const gerdau = {
  nome: "Gerdau — Projeto Itabiritos na mina de Miguel Burnier",
  nicho: "mineração e siderurgia — planta de beneficiamento de minério",
  uf: "MG",
  municipio: "Ouro Preto",
  empresa_nome: "GERDAU ACOMINAS S/A",
};

test("licença de outro estado sai antes do modelo", () => {
  assert.equal(localGate({ uf: "PR", municipio: "Araucária" }, gerdau), "outro_estado");
  assert.equal(localGate({ uf: "MG", municipio: "Ouro Preto" }, gerdau), "mesmo_municipio");
  assert.equal(localGate({ municipio: "Ouro Branco" }, gerdau), "outro_municipio");
  assert.equal(localGate({ mun_solic: "OURO PRETO" }, gerdau), "mesmo_municipio");
  assert.equal(localGate({ trecho: "GERDAU ACOMINAS S/A, CNPJ 17.227.422" }, gerdau), "sem_local");
  assert.equal(localGate({ trecho: "...", no_municipio: true }, gerdau), "mesmo_municipio");
});

test("só a linha que o contexto liga ao projeto vira evidência", async () => {
  const lines = [
    { uf: "PR", municipio: "Araucária", titulo: "Licença de operação" },
    { municipio: "Ouro Preto", atividade: "A-05-02-0 — Unidade de Tratamento de Minerais", contexto: "Mina de Miguel Burnier" },
    { municipio: "Ouro Branco", atividade: "Siderurgia" },
    { trecho: "Pregão para compra de vergalhão Gerdau" },
  ];
  const seen = [];
  const judge = async (_project, _codigo, registros) => {
    seen.push(...registros);
    return registros.map((registro) => ({
      i: registro.i,
      correlacao: registro.texto.includes("Miguel Burnier") ? "direta" : registro.texto.includes("vergalh") ? "outro_projeto" : "incerta",
      motivo: "teste",
    }));
  };
  const { kept, resumo } = await correlateLines(gerdau, "SEC-SEMAD", lines, { judge });
  assert.equal(seen.length, 3, "a linha do Paraná não chega ao modelo");
  assert.equal(seen[0].local, "mesmo_municipio", "o município da ficha é avaliado primeiro");
  assert.equal(kept.length, 1);
  assert.equal(kept[0].municipio, "Ouro Preto");
  assert.equal(kept[0].contexto, undefined, "o contexto largo não vai para a evidência");
  assert.equal(kept[0].correlacao, "teste");
  assert.deepEqual(
    { diretas: resumo.diretas, outro_estado: resumo.outro_estado, outro_projeto: resumo.outro_projeto, incerta: resumo.incerta },
    { diretas: 1, outro_estado: 1, outro_projeto: 1, incerta: 1 },
  );
});

test("sem modelo, só o município da ficha passa", async () => {
  const lines = [{ municipio: "Ouro Preto" }, { municipio: "Divinópolis" }, { trecho: "sem local" }];
  const { kept, resumo } = await correlateLines(gerdau, "SEC-SEMAD", lines, { judge: null });
  assert.equal(resumo.metodo, "municipio");
  assert.deepEqual(kept.map((line) => line.municipio), ["Ouro Preto"]);
});

test("falha do modelo cai para o município da ficha", async () => {
  const judge = async () => { throw new Error("fora do ar"); };
  const { kept, resumo } = await correlateLines(gerdau, "SEC-SEMAD", [{ municipio: "Ouro Preto" }, { municipio: "Itabirito" }], { judge });
  assert.equal(resumo.metodo, "municipio");
  assert.equal(kept.length, 1);
});

test("a contagem da evidência passa a ser só das linhas correlacionadas", () => {
  const found = { total: 45, no_municipio: 3, linhas: [{}, {}], candidatos: [{}, {}, {}] };
  const kept = [{ no_municipio: true }, { no_municipio: false }];
  assert.deepEqual(rebuildFound("CAPTURA-DOE-MG", found, kept), { total: 2, no_municipio: 1, linhas: kept });
  const bndes = rebuildFound("SEC-BNDES", { n: 31, linhas: [] }, [
    { situacao_contrato: "LIQUIDADO", data_contratacao: "2020-01-01" },
    { situacao_contrato: "ATIVO", data_contratacao: "2025-06-01" },
  ], { since: "2025-01-01" });
  assert.deepEqual([bndes.n, bndes.abertos, bndes.no_periodo], [2, 1, 1]);
  const cvm = rebuildFound("SEC-CVM-IPE", [], [{ data_referencia: "2026-02-01", texto: "x" }], { since: "2026-01-01" });
  assert.deepEqual([cvm.length, cvm.total, cvm.noPeriodo, cvm.lidos], [1, 1, 1, 1]);
});
