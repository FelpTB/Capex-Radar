const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { cnoNeedles, columnIndex, splitCsv, classifyRow, matchCno } = require("../src/enrichment/cno");

test("reduz o nome da notícia ao que cabe no cadastro da obra", () => {
  assert.deepEqual(cnoNeedles("DP World em Santos"), ["dp world"]);
  assert.deepEqual(cnoNeedles("WIKA"), ["wika"]);
});

test("lê a coluna do responsável e conta obra da mesma raiz no estado", () => {
  const header = splitCsv(
    '"CNO","NI do responsável","Nome do município","Estado","Área total","Situação","Data de início","Nome empresarial"',
  );
  const columns = columnIndex(header);
  const hit = { total: 0, mesmoCnpj: 0, noUf: 0, noMunicipio: 0, amostra: [] };
  const projects = new Map([
    ["07175725", [{ id: "p", cnpj: "07175725000160", uf: "SC", municipio: "Itajaí", hits: hit }]],
  ]);
  classifyRow(
    ["123", "07175725000900", "ITAJAI", "SC", "1000", "02", "2024-01-01", "WEG"],
    columns,
    projects,
  );
  classifyRow(
    ["456", "07175725000160", "JARAGUA DO SUL", "SC", "10", "02", "2010-01-01", "WEG"],
    columns,
    projects,
  );
  assert.equal(hit.total, 2);
  assert.equal(hit.mesmoCnpj, 1);
  assert.equal(hit.noUf, 2);
  assert.equal(hit.noMunicipio, 1);
});

test("completa a amostra com área, CNAE, vínculo e a contagem da edição", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cno-"));
  const csv = path.join(dir, "cno.csv");
  fs.writeFileSync(csv, [
    '"CNO","NI do responsável","Nome do município","Estado","Área total","Situação","Data de início","Nome empresarial","Qualificação do responsavel","Nome","CNO vinculado","Data da situação"',
    '"000000000123","07175725000900","ITAJAI","SC","1000","02","2024-01-01","WEG","0057","Galpao","000000000999","2024-02-01"',
    '"000000000456","07175725000160","JARAGUA DO SUL","SC","10","02","2010-01-01","WEG","0053","Reforma","","2010-03-01"',
  ].join("\n"), "latin1");
  fs.writeFileSync(path.join(dir, "cno_areas.csv"), [
    "CNO,Categoria,Destinacao,Tipo de obra,Tipo de Area,Tipo de Area Complementar,Metragem",
    "000000000123,Obra Nova,Galpao industrial,Alvenaria,Principal,,900",
    "000000000123,Existente,Comercial salas e lojas,Alvenaria,Complementar,Estacionamento,100",
    "000000000456,Reforma,Residencial unifamiliar,Madeira,Principal,,10",
  ].join("\n"), "latin1");
  fs.writeFileSync(path.join(dir, "cno_cnaes.csv"), [
    "CNO,CNAE,Data de registro",
    "000000000123,4120400,2024-01-02",
    "000000000123,4292801,2024-01-03",
  ].join("\n"), "latin1");
  fs.writeFileSync(path.join(dir, "cno_vinculos.csv"), [
    "CNO,Data de início,Data de fim,Data de registro,Qualificação do contribuinte,NI do responsável",
    "000000000123,2024-01-01,,2024-01-05,0053,07175725000160",
    "000000000123,2023-01-01,2023-12-31,2023-01-02,0111,",
  ].join("\n"), "latin1");
  fs.writeFileSync(path.join(dir, "cno_totais.csv"), [
    "Total de obras,Total de cnaes,Total de áreas,Total de vínculos",
    "00000000002,00000000002,00000000003,00000000002",
  ].join("\n"), "latin1");

  const hits = await matchCno([{
    id: "p",
    cnpj: "07175725000160",
    uf: "SC",
    municipio: "Itajaí",
    status_em: "2024-06-01",
  }], csv);
  const obra = hits.get("p").amostra[0];
  const outra = hits.get("p").amostra[1];
  assert.equal(obra.cno, "000000000123");
  assert.equal(obra.qualificacao, "0057");
  assert.equal(obra.papel, "dono da obra");
  assert.equal(obra.nome, "Galpao");
  assert.equal(obra.cno_vinculado, "000000000999");
  assert.equal(obra.data_situacao, "2024-02-01");
  assert.equal(obra.areas.length, 2);
  assert.equal(obra.areas[0].destinacao, "Galpao industrial");
  assert.equal(obra.areas[0].categoria, "Obra Nova");
  assert.equal(obra.areas[1].tipo_complementar, "Estacionamento");
  assert.deepEqual(obra.cnaes.map((item) => item.cnae), ["4120400", "4292801"]);
  assert.equal(obra.vinculos[0].papel, "pessoa jurídica construtora");
  assert.equal(obra.vinculos[0].ni, "07175725000160");
  assert.equal(obra.vinculos[0].fim, null);
  assert.equal(obra.vinculos[1].papel, "sociedade líder de consórcio");
  assert.equal(obra.vinculos[1].ni, null);
  assert.equal(outra.areas[0].categoria, "Reforma");
  assert.deepEqual(outra.cnaes, []);
  assert.equal(hits.get("p").totais.obras, "00000000002");
  assert.equal(hits.get("p").totais.areas, "00000000003");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a ficha exige os cinco CSV extraídos", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cno-"));
  fs.writeFileSync(path.join(dir, "cno.csv"), '"CNO","NI do responsável"\n', "latin1");
  await assert.rejects(
    () => matchCno([{ id: "p", cnpj: "07175725000160" }], path.join(dir, "cno.csv")),
    /cno_cnaes\.csv não está extraído/,
  );
  fs.rmSync(dir, { recursive: true, force: true });
});
