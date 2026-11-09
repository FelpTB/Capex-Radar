// Chamada única ao Claude para as decisões em JSON do radar.
//
// Todas as chamadas pedem um objeto JSON e cada módulo valida a resposta com
// zod. O modelo padrão é o Claude Haiku 5.5, o mais barato, com esforço baixo
// e sem pensamento estendido: são triagens e extrações curtas. O filtro CapEx
// pede um modelo maior e esforço médio.
const Anthropic = require("@anthropic-ai/sdk");

const MODELO_PADRAO = "claude-haiku-5-5";
const INSTRUCAO_JSON = "Responda somente com o objeto JSON pedido, sem texto antes ou depois e sem bloco de código.";

function criarCliente(apiKey) {
  return apiKey ? new Anthropic({ apiKey }) : null;
}

// Pega o objeto JSON do texto: aceita cerca ```json e texto em volta.
function extrairJson(texto) {
  const limpo = String(texto || "").replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  if (limpo.startsWith("{")) return limpo;
  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  return inicio >= 0 && fim > inicio ? limpo.slice(inicio, fim + 1) : null;
}

/**
 * Pede um objeto JSON ao Claude e devolve o texto do JSON (ou null sem resposta).
 * @param {Anthropic} client
 * @param {{model?: string, system: string, user: string, maxTokens?: number}} p
 */
// thinking: o padrão desliga o pensamento (Haiku). null não manda o campo e
// deixa o padrão do modelo (o Sonnet 5.5 não aceita "disabled").
async function pedirJson(client, { model = MODELO_PADRAO, system, user, maxTokens = 8000, effort = "low", thinking = { type: "disabled" } }) {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    ...(thinking ? { thinking } : {}),
    output_config: { effort },
    system: `${system} ${INSTRUCAO_JSON}`,
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") {
    throw new Error(`O Claude recusou a solicitação (${response.stop_details?.category || "sem categoria"})`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("A resposta do Claude passou do limite de tokens");
  }
  const texto = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  return extrairJson(texto);
}

module.exports = { MODELO_PADRAO, criarCliente, extrairJson, pedirJson };
