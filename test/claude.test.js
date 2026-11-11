const test = require("node:test");
const assert = require("node:assert/strict");
const { extrairJson, pedirJson, criarCliente, MODELO_PADRAO } = require("../src/claude");

function clienteFalso(resposta) {
  const chamadas = [];
  return {
    chamadas,
    messages: {
      async create(params) {
        chamadas.push(params);
        return { stop_reason: "end_turn", content: [{ type: "text", text: "" }], ...resposta };
      },
    },
  };
}

test("tira o JSON de cerca de código e de texto em volta", () => {
  assert.equal(extrairJson('{"a":1}'), '{"a":1}');
  assert.equal(extrairJson('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(extrairJson('Aqui está: {"a":{"b":2}} pronto'), '{"a":{"b":2}}');
  assert.equal(extrairJson("sem json"), null);
});

test("pede JSON ao Haiku com esforço baixo e sem pensamento", async () => {
  const client = clienteFalso({ content: [{ type: "text", text: '{"ok":true}' }] });
  const raw = await pedirJson(client, { system: "Decida.", user: "texto" });
  assert.equal(raw, '{"ok":true}');
  const [params] = client.chamadas;
  assert.equal(params.model, MODELO_PADRAO);
  assert.equal(MODELO_PADRAO, "claude-haiku-5-5");
  assert.deepEqual(params.thinking, { type: "disabled" });
  assert.deepEqual(params.output_config, { effort: "low" });
  assert.match(params.system, /^Decida\. .*JSON/);
  assert.deepEqual(params.messages, [{ role: "user", content: "texto" }]);
  assert.equal(params.temperature, undefined);
});

test("recusa e limite de tokens viram erro", async () => {
  await assert.rejects(
    pedirJson(clienteFalso({ stop_reason: "refusal", stop_details: { category: "cyber" } }), { system: "x", user: "y" }),
    /recusou.*cyber/,
  );
  await assert.rejects(
    pedirJson(clienteFalso({ stop_reason: "max_tokens" }), { system: "x", user: "y" }),
    /limite de tokens/,
  );
});

test("sem chave não há cliente", () => {
  assert.equal(criarCliente(null), null);
  assert.equal(typeof criarCliente("sk-ant-teste").messages.create, "function");
});

test("cada chamada grava os tokens com a etapa, somando as voltas", async () => {
  const claude = require("../src/claude");
  const linhas = [];
  claude.definirGravadorDeUso(async (l) => { linhas.push(l); });
  const resposta = (stop, usage) => ({ stop_reason: stop, usage, content: [{ type: "text", text: '{"ok":true}' }] });
  const client = { messages: { create: async () => resposta("end_turn", { input_tokens: 100, output_tokens: 20 }) } };
  await claude.pedirJson(client, { etapa: "filtro2", model: "claude-sonnet-5-5", system: "s", user: "u", thinking: null });
  const voltas = [resposta("pause_turn", { input_tokens: 1000, output_tokens: 10, server_tool_use: { web_search_requests: 1 } }), resposta("end_turn", { input_tokens: 1500, output_tokens: 50, cache_read_input_tokens: 200 })];
  const client2 = { messages: { create: async () => voltas.shift() } };
  await claude.pedirJsonComFerramentas(client2, { etapa: "enriquecimento", model: "claude-sonnet-5-5", system: "s", user: "u", tools: [] });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(linhas.map((l) => [l.etapa, l.entrada, l.saida, l.cache_leitura, l.buscas, l.voltas]), [
    ["filtro2", 100, 20, 0, 0, 1],
    ["enriquecimento", 2500, 60, 200, 1, 2],
  ]);
  claude.definirGravadorDeUso(async () => {});
});

test("enriquecimento pede uma busca, uma leitura curta e poucas voltas", () => {
  const enr = require("../src/capex-enriquecimento");
  const [busca, leitura] = enr.ferramentas();
  assert.equal(busca.max_uses, 1);
  assert.equal(leitura.max_uses, 1);
  assert.ok(leitura.max_content_tokens <= 5000);
  assert.ok(enr.MAX_VOLTAS <= 3);
  assert.equal(enr.VERSAO, "enriquecimento-v1");
});
