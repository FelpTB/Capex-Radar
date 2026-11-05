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
