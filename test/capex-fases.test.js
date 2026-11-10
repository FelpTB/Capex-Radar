const test = require("node:test");
const assert = require("node:assert/strict");
const { manchetesIguais, separarRepetidas } = require("../src/capex-coletor");
const { pedirJsonComFerramentas } = require("../src/claude");
const enriquecimento = require("../src/capex-enriquecimento");
const filtroFinal = require("../src/capex-filtro-final");
const { leituraDaNoticia, FILTRO_SITUACAO } = require("../src/capex-painel-db");

// ---------------------------------------------------------------------------
// Filtro 1: manchetes quase iguais
// ---------------------------------------------------------------------------

test("Filtro 1 reconhece a mesma manchete com acento, caixa ou um detalhe trocado", () => {
  assert.ok(manchetesIguais(
    "Bracell vai investir R$ 4,5 bilhões em nova fábrica em Lençóis Paulista",
    "BRACELL vai investir R$ 4,5 bilhões em nova fabrica em Lencois Paulista (SP)",
  ));
  assert.ok(!manchetesIguais(
    "Bracell vai investir R$ 4,5 bilhões em nova fábrica em Lençóis Paulista",
    "Bracell obtém licença ambiental para fábrica em Lençóis Paulista",
  ));
  // Manchete curta só conta quando é idêntica.
  assert.ok(manchetesIguais("JBS investe", "JBS investe"));
  assert.ok(!manchetesIguais("JBS investe", "JBS investe mais"));
});

test("Filtro 1 separa as repetidas da rodada e as de notícias já guardadas", () => {
  const vivas = [{ id: "v1", titulo: "Klabin anuncia nova máquina de papel em Ortigueira no Paraná", data_original: "2024-03-01" }];
  const noticias = [
    { id: "n1", titulo: "Klabin anuncia nova máquina de papel em Ortigueira, no Paraná", data_original: "2024-03-02" },
    { id: "n2", titulo: "Klabin recebe licença para ampliar fábrica de Telêmaco Borba", data_original: "2024-03-05" },
    { id: "n3", titulo: "Klabin recebe licença para ampliar a fábrica de Telêmaco Borba", data_original: "2024-03-06" },
    // Mesmas palavras, mas meses depois: é outro fato.
    { id: "n4", titulo: "Klabin anuncia nova máquina de papel em Ortigueira no Paraná", data_original: "2024-09-01" },
  ];
  const { unicas, repetidas } = separarRepetidas(noticias, vivas);
  assert.deepEqual(unicas.map((n) => n.id), ["n2", "n4"]);
  assert.deepEqual(repetidas.map((r) => [r.noticia.id, r.igual.id]), [["n1", "v1"], ["n3", "n2"]]);
});

// ---------------------------------------------------------------------------
// Enriquecimento
// ---------------------------------------------------------------------------

test("pedido com ferramentas segue as voltas de pause_turn e conta buscas e leituras", async () => {
  const chamadas = [];
  const respostas = [
    { stop_reason: "pause_turn", content: [{ type: "server_tool_use", name: "web_search" }, { type: "server_tool_use", name: "web_search" }] },
    { stop_reason: "end_turn", content: [{ type: "server_tool_use", name: "web_fetch" }, { type: "text", text: "Achei a matéria." }, { type: "text", text: '{"encontrou":true}' }] },
  ];
  const client = { messages: { async create(p) { chamadas.push(structuredClone(p)); return respostas.shift(); } } };
  const r = await pedirJsonComFerramentas(client, { model: "claude-sonnet-5-5", system: "s", user: "u", tools: enriquecimento.ferramentas() });
  assert.deepEqual(r, { json: '{"encontrou":true}', buscas: 2, leituras: 1 });
  assert.equal(chamadas.length, 2);
  assert.equal(chamadas[1].messages[1].role, "assistant");
  assert.equal(chamadas[0].thinking, undefined);
  assert.deepEqual(chamadas[0].tools.map((t) => t.type), ["web_search_20260209", "web_fetch_20260209"]);
});

test("enriquecimento valida o perfil e descarta campo malformado em vez de falhar", () => {
  const leitura = enriquecimento.lerEnriquecimento(JSON.stringify({
    encontrou: true,
    url_original: "https://www.valor.com.br/materia",
    veiculo_original: "Valor",
    resumo: "A Bracell vai construir fábrica.",
    empresa: "Bracell", mesmo_grupo: true,
    objeto: "fábrica de tissue", uf: "sp", municipio: "Lençóis Paulista",
    valor_brl: 1500000000, estagio: "obra", obra: "por_fazer", empregos: "muitos",
    trechos: ["trecho 1", "trecho 2", "trecho 3", "trecho 4"],
  }));
  assert.equal(leitura.encontrou, true);
  assert.equal(leitura.perfil.uf, "SP");
  assert.equal(leitura.perfil.estagio, null); // fora da lista
  assert.equal(leitura.perfil.empregos, null);
  assert.equal(leitura.trechos.length, 3);
  // Sem endereço da matéria, não conta como encontrada.
  assert.equal(enriquecimento.lerEnriquecimento('{"encontrou":true,"url_original":"não sei"}').encontrou, false);
  assert.throws(() => enriquecimento.lerEnriquecimento(null));
});

test("entrada do enriquecimento leva manchete, veículo, data e o link do Google News", () => {
  const e = enriquecimento.montarEntrada({ nome: "Bracell", nicho: "papel_celulose" }, {
    titulo: "Bracell investe", veiculo: "Valor", url: "https://news.google.com/rss/articles/X", data_original: "2025-02-21T08:00:00Z",
    extracao: { objeto: "fábrica", uf: "SP" },
  });
  assert.equal(e.nicho, "papel e celulose");
  assert.deepEqual([e.noticia.data, e.noticia.link_google_news, e.noticia.leitura_da_manchete.uf], ["2025-02-21", "https://news.google.com/rss/articles/X", "SP"]);
  assert.match(enriquecimento.PROMPT, /NÃO abre a matéria/);
});

test("a aprovação usa a leitura do texto sobre a da manchete, campo a campo", () => {
  const ex = leituraDaNoticia({
    extracao: { capex: true, objeto: "fábrica", uf: "SP", municipio: null, valor_brl: null, estagio: "anuncio" },
    enriquecimento: { perfil: { objeto: "fábrica de tissue", uf: null, municipio: "Lençóis Paulista", valor_brl: 1500000000, filial_sugerida: { cnpj: "1" } } },
  });
  assert.deepEqual(
    [ex.objeto, ex.uf, ex.municipio, ex.valor_brl, ex.estagio, ex.filial_sugerida.cnpj],
    ["fábrica de tissue", "SP", "Lençóis Paulista", 1500000000, "anuncio", "1"],
  );
  assert.equal(leituraDaNoticia({ extracao: { objeto: "x" }, enriquecimento: null }).objeto, "x");
});

// ---------------------------------------------------------------------------
// Filtro 3 e fila de aprovação
// ---------------------------------------------------------------------------

test("Filtro 3 lê o perfil enriquecido e aceita o motivo fora_contexto", () => {
  const lote = [
    { id: "a", titulo: "Bracell investe", data_original: "2025-02-21", filtro: { justificativa: "obra" }, enriquecimento: { encontrou: true, resumo: "r", perfil: { objeto: "fábrica", uf: null, filial_sugerida: {} }, trechos: ["t"] } },
    { id: "b", titulo: "Bracell patrocina evento", data_original: "2025-02-22", enriquecimento: null },
  ];
  const entrada = filtroFinal.montarEntrada({ nome: "Bracell", nicho: "papel_celulose" }, lote);
  assert.deepEqual(entrada.itens[0].perfil, { objeto: "fábrica" });
  assert.equal(entrada.itens[0].motivo_filtro2, "obra");
  assert.equal(entrada.itens[1].encontrou, false);
  const d = filtroFinal.fecharDecisoes(JSON.stringify({ itens: [
    { i: 0, decisao: "manter", justificativa: "obra nova" },
    { i: 1, decisao: "descartar", motivo: "fora_contexto", justificativa: "texto não confirma" },
  ] }), lote);
  assert.equal(d.get(0).decisao, "manter");
  assert.deepEqual([d.get(1).decisao, d.get(1).motivo], ["descartar", "fora_contexto"]);
  for (const codigo of Object.keys(filtroFinal.MOTIVOS)) assert.ok(filtroFinal.PROMPT.includes(codigo), codigo);
});

test("A revisar só traz o que passou pelas fases; o resto fica em processamento", () => {
  assert.match(FILTRO_SITUACAO.revisar, /filtro_final->>'decisao' = 'manter'/);
  assert.match(FILTRO_SITUACAO.processando, /not coalesce\(/);
  assert.ok(FILTRO_SITUACAO.funil.includes("novo_projeto"));
});
