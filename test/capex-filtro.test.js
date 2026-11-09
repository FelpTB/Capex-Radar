const test = require("node:test");
const assert = require("node:assert/strict");
const {
  fecharDecisoes, montarEntrada, motivoTexto, criarFiltro, condicaoAgente, PROMPT, MOTIVOS, MODELO_FILTRO_PADRAO,
} = require("../src/capex-filtro");

const lote = [
  { id: "a", titulo: "JBS vai investir R$ 800 milhões para triplicar capacidade em Diamantino", data_original: "2023-06-18" },
  { id: "b", titulo: "Frigorífico JBS de Diamantino será o maior do Brasil", data_original: "2023-06-21" },
  { id: "c", titulo: "JBS anuncia compra de unidade de suínos no RS por R$ 80 milhões", data_original: "2023-11-20" },
  { id: "d", titulo: "JBS reabre unidade da Friboi em Juara (MT)", data_original: "2023-07-17" },
];

function resposta(itens) {
  return JSON.stringify({ itens });
}

test("o prompt traz a definição de CapEx e todos os motivos", () => {
  assert.match(PROMPT, /DEFINIÇÃO DE CAPEX/);
  assert.match(PROMPT, /RÍGIDO/);
  for (const codigo of Object.keys(MOTIVOS)) assert.ok(PROMPT.includes(codigo), codigo);
  assert.equal(MODELO_FILTRO_PADRAO, "claude-sonnet-5-5");
});

test("mantém, descarta com motivo e aponta a repetição para o item mantido do lote", () => {
  const d = fecharDecisoes(resposta([
    { i: 0, decisao: "manter", motivo: null, repete: null, justificativa: "obra de ampliação" },
    { i: 1, decisao: "descartar", motivo: "repetida", repete: "i:0", justificativa: "mesmo anúncio" },
    { i: 2, decisao: "descartar", motivo: "aquisicao", repete: null, justificativa: "compra de unidade" },
    { i: 3, decisao: "descartar", motivo: "reabertura", repete: null, justificativa: "reabre" },
  ]), lote);
  assert.equal(d.get(0).decisao, "manter");
  assert.deepEqual([d.get(1).motivo, d.get(1).repete_id], ["repetida", "a"]);
  assert.equal(d.get(2).motivo, "aquisicao");
  assert.equal(d.get(3).motivo, "reabertura");
  assert.match(motivoTexto(d.get(1)), /repete.*Diamantino/);
});

test("repetida aponta para manchete já mantida de lote anterior", () => {
  const mantidas = [{ id: "x9", titulo: "JBS investe R$ 800 mi em Diamantino", data_original: "2023-06-19" }];
  const d = fecharDecisoes(resposta([
    { i: 0, decisao: "descartar", motivo: "repetida", repete: "id:x9", justificativa: "mesmo anúncio" },
  ]), lote, mantidas);
  assert.deepEqual([d.get(0).decisao, d.get(0).repete_id], ["descartar", "x9"]);
});

test("repetida de repetida segue a cadeia; referência inválida vira manter", () => {
  const d = fecharDecisoes(resposta([
    { i: 0, decisao: "manter", justificativa: "ok" },
    { i: 1, decisao: "descartar", motivo: "repetida", repete: "i:0", justificativa: "r" },
    { i: 2, decisao: "descartar", motivo: "repetida", repete: "i:1", justificativa: "r" },
    { i: 3, decisao: "descartar", motivo: "repetida", repete: "i:3", justificativa: "aponta para si" },
  ]), lote);
  assert.equal(d.get(2).repete_id, "a");
  assert.equal(d.get(3).decisao, "manter");
  assert.ok(d.get(3).ajuste);
});

test("descartar sem motivo vira manter e item sem resposta fica sem decisão", () => {
  const d = fecharDecisoes(resposta([
    { i: 0, decisao: "descartar", motivo: "inventado", justificativa: "?" },
    { i: 7, decisao: "manter", justificativa: "fora do lote" },
  ]), lote);
  assert.equal(d.get(0).decisao, "manter");
  assert.equal(d.has(1), false);
  assert.equal(d.has(7), false);
});

test("a entrada leva projetos, mantidas e a leitura da triagem", () => {
  const e = montarEntrada({ nome: "JBS", nicho: "alimentos_bebidas" },
    [{ ...lote[0], extracao: { uf: "MT", municipio: "Diamantino", valor_brl: 8e8, estagio: "anuncio" } }],
    { projetos: [{ titulo: "JBS — ampliação em Diamantino", uf: "MT" }], mantidas: [{ id: 1, titulo: "t", data_original: "2023-06-01" }] });
  assert.equal(e.itens[0].leitura_triagem.municipio, "Diamantino");
  assert.equal(e.mantidas[0].id, "1");
  assert.equal(e.projetos[0].uf, "MT");
});

test("pede ao modelo do filtro com esforço médio", async () => {
  const chamadas = [];
  const client = { messages: { async create(p) { chamadas.push(p); return { stop_reason: "end_turn", content: [{ type: "text", text: '{"itens":[]}' }] }; } } };
  const filtro = criarFiltro({ client });
  await filtro.avaliar({ itens: [] });
  assert.equal(chamadas[0].model, "claude-sonnet-5-5");
  assert.deepEqual(chamadas[0].output_config, { effort: "medium" });
});

test("o agente só lê o que o filtro manteve, a não ser que o filtro esteja desligado", () => {
  const antes = process.env.CAPEX_FILTRO;
  delete process.env.CAPEX_FILTRO;
  assert.match(condicaoAgente(), /manter/);
  process.env.CAPEX_FILTRO = "0";
  assert.equal(condicaoAgente(), "true");
  if (antes === undefined) delete process.env.CAPEX_FILTRO; else process.env.CAPEX_FILTRO = antes;
});

test("dois itens mantidos com o mesmo fato: fica o primeiro", () => {
  const d = fecharDecisoes(resposta([
    { i: 0, fato: "CD Goiânia - inauguração", decisao: "manter", justificativa: "a" },
    { i: 1, fato: "cd goiania  inauguracao", decisao: "manter", justificativa: "b" },
    { i: 2, fato: "CD Rio - inauguração", decisao: "manter", justificativa: "c" },
  ]), lote);
  assert.equal(d.get(0).decisao, "manter");
  assert.deepEqual([d.get(1).motivo, d.get(1).repete_id], ["repetida", "a"]);
  assert.equal(d.get(2).decisao, "manter");
});

test("mesmo fato, mesmo veredito: o mantido segue o descarte de mérito", () => {
  const d = fecharDecisoes(resposta([
    { i: 0, fato: "CD Guarulhos - inauguração", decisao: "descartar", motivo: "concluido", justificativa: "a" },
    { i: 1, fato: "CD Guarulhos - inauguração", decisao: "manter", justificativa: "b" },
  ]), lote);
  assert.deepEqual([d.get(1).decisao, d.get(1).motivo], ["descartar", "concluido"]);
});
