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

// Uso de tokens: cada resposta vira uma linha em capex_radar.ia_uso (sql/029),
// com a etapa que pediu. Falha ao gravar não atrapalha a chamada. Nos testes
// (cliente falso, sem usage) nada é gravado.
let gravarUso = async (linha) => {
  const { pool } = require("./db");
  await pool.query(
    `insert into capex_radar.ia_uso (etapa, modelo, entrada, saida, cache_leitura, cache_escrita, buscas, voltas)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [linha.etapa, linha.modelo, linha.entrada, linha.saida, linha.cache_leitura, linha.cache_escrita, linha.buscas, linha.voltas],
  );
};

function definirGravadorDeUso(fn) {
  gravarUso = fn;
}

function somarUso(total, usage) {
  if (!usage) return total;
  total.entrada += usage.input_tokens || 0;
  total.saida += usage.output_tokens || 0;
  total.cache_leitura += usage.cache_read_input_tokens || 0;
  total.cache_escrita += usage.cache_creation_input_tokens || 0;
  total.buscas += usage.server_tool_use?.web_search_requests || 0;
  total.temUso = true;
  return total;
}

function novoUso(etapa, modelo) {
  return { etapa: etapa || null, modelo, entrada: 0, saida: 0, cache_leitura: 0, cache_escrita: 0, buscas: 0, voltas: 0, temUso: false };
}

function registrarUso(uso) {
  if (!uso.temUso) return;
  Promise.resolve().then(() => gravarUso(uso)).catch(() => {});
}

/**
 * Pede um objeto JSON ao Claude e devolve o texto do JSON (ou null sem resposta).
 * @param {Anthropic} client
 * @param {{model?: string, system: string, user: string, maxTokens?: number}} p
 */
// thinking: o padrão desliga o pensamento (Haiku). null não manda o campo e
// deixa o padrão do modelo (o Sonnet 5.5 não aceita "disabled").
async function pedirJson(client, { model = MODELO_PADRAO, system, user, maxTokens = 8000, effort = "low", thinking = { type: "disabled" }, etapa = null }) {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    ...(thinking ? { thinking } : {}),
    output_config: { effort },
    system: `${system} ${INSTRUCAO_JSON}`,
    messages: [{ role: "user", content: user }],
  });
  const uso = somarUso(novoUso(etapa, model), response.usage);
  uso.voltas = 1;
  registrarUso(uso);
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

/**
 * Pede um objeto JSON com ferramentas do servidor (busca e leitura de páginas).
 * A resposta pode vir em várias voltas: com stop_reason "pause_turn" o
 * servidor parou no meio do trabalho, e a conversa segue com o que ele já fez.
 * Devolve { json, buscas, leituras } — json é o texto do JSON ou null.
 */
async function pedirJsonComFerramentas(client, {
  model, system, user, tools, maxTokens = 16000, effort = "low", maxVoltas = 4, etapa = null,
}) {
  const messages = [{ role: "user", content: user }];
  let response;
  const uso = { buscas: 0, leituras: 0 };
  const tokens = novoUso(etapa, model);
  try {
    for (let volta = 0; volta < maxVoltas; volta += 1) {
      response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        output_config: { effort },
        system: `${system} ${INSTRUCAO_JSON}`,
        tools,
        messages,
      });
      somarUso(tokens, response.usage);
      tokens.voltas += 1;
      for (const bloco of response.content || []) {
        if (bloco.type !== "server_tool_use") continue;
        if (bloco.name === "web_search") uso.buscas += 1;
        if (bloco.name === "web_fetch") uso.leituras += 1;
      }
      if (response.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: response.content });
    }
  } finally {
    registrarUso(tokens);
  }
  if (response.stop_reason === "refusal") {
    throw new Error(`O Claude recusou a solicitação (${response.stop_details?.category || "sem categoria"})`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("A resposta do Claude passou do limite de tokens");
  }
  if (response.stop_reason === "pause_turn") {
    throw new Error("O Claude não terminou a pesquisa no número de voltas permitido");
  }
  // O JSON vem no último texto, depois das buscas.
  const textos = (response.content || []).filter((b) => b.type === "text").map((b) => b.text);
  const json = extrairJson(textos.join("")) || extrairJson(textos[textos.length - 1]);
  return { json, ...uso };
}

module.exports = { MODELO_PADRAO, criarCliente, extrairJson, pedirJson, pedirJsonComFerramentas, definirGravadorDeUso, somarUso };
