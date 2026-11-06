const test = require("node:test");
const assert = require("node:assert/strict");

process.env.SUPABASE_STRING ||= "postgres://teste:teste@localhost:5432/teste";
const agente = require("../src/capex-agente");
const { cardDecisao, paginaAgente, linhaAgente } = require("../src/capex-painel");

const PROJETOS = [{ id: "p1", titulo: "Aurora Coop — Novo frigorífico", uf: "SC", municipio: "São Miguel do Oeste", estagio: "anuncio" }];

function saida(extra = {}) {
  return {
    analise: { investimento: true, gera_obra: true, situacao: "anunciado", no_brasil: true, mesmo_projeto_id: null, ...(extra.analise || {}) },
    decisao: "criar_projeto",
    motivo: "obra_nova",
    confianca: 90,
    justificativa: "Anuncia a construção de um frigorífico em Tapejara.",
    projeto: { titulo: "frigorífico em Tapejara", objeto: "frigorífico", uf: "RS", municipio: "Tapejara", valor_brl: 82000000, estagio: "anuncio", data_fato: null },
    ...extra,
    ...(extra.analise ? { analise: { investimento: true, gera_obra: true, situacao: "anunciado", no_brasil: true, mesmo_projeto_id: null, ...extra.analise } } : {}),
  };
}

test("o prompt cobre duplicidade, obra, compra, inauguração e situação", () => {
  for (const trecho of ["MESMO PROJETO", "GERA OBRA", "aquisição", "inaugurado", "anunciado", "em_construcao", "revisar"]) {
    assert.match(agente.PROMPT, new RegExp(trecho));
  }
  for (const codigo of Object.keys(agente.MOTIVOS)) assert.match(agente.PROMPT, new RegExp(codigo));
});

test("lê a resposta do agente e normaliza a UF", () => {
  const lida = agente.lerSaida(JSON.stringify(saida({ projeto: { ...saida().projeto, uf: "rs" } })));
  assert.equal(lida.projeto.uf, "RS");
  assert.equal(lida.confianca, 90);
  assert.throws(() => agente.lerSaida(JSON.stringify({ decisao: "aprovar" })));
  assert.throws(() => agente.lerSaida(null));
});

test("travas: cria só com investimento, obra, situação aberta e confiança", () => {
  assert.deepEqual(agente.aplicarTravas(saida(), { projetos: PROJETOS }), { acao: "projeto_criado" });
  assert.match(agente.aplicarTravas(saida({ confianca: 60 }), { limiar: 75 }).motivo, /confiança 60 abaixo de 75/);
  assert.equal(agente.aplicarTravas(saida({ analise: { gera_obra: false } })).acao, "revisao_humana");
  assert.match(agente.aplicarTravas(saida({ analise: { situacao: "concluido" } })).motivo, /situação concluido/);
  assert.match(agente.aplicarTravas(saida({ analise: { mesmo_projeto_id: "p1" } }), { projetos: PROJETOS }).motivo, /projeto igual/);
  assert.match(agente.aplicarTravas(saida(), { temMatriz: false }).motivo, /sem CNPJ/);
  assert.match(agente.aplicarTravas(saida({ motivo: "sem_obra" })).motivo, /não combina/);
});

test("travas: vincula só a projeto da lista; descarta e revisa", () => {
  const vincular = saida({ decisao: "vincular", motivo: "mesmo_projeto", projeto: null, analise: { mesmo_projeto_id: "p1" } });
  assert.deepEqual(agente.aplicarTravas(vincular, { projetos: PROJETOS }), { acao: "vinculada", projeto_id: "p1" });
  assert.match(agente.aplicarTravas({ ...vincular, analise: { ...vincular.analise, mesmo_projeto_id: "x" } }, { projetos: PROJETOS }).motivo, /fora da lista/);
  const descartar = saida({ decisao: "descartar", motivo: "compra_aquisicao", projeto: null, analise: { gera_obra: false } });
  assert.deepEqual(agente.aplicarTravas(descartar), { acao: "descartada" });
  assert.equal(agente.aplicarTravas(saida({ decisao: "revisar", motivo: "incerto" })).acao, "revisao_humana");
});

test("entrada do agente traz a notícia, a leitura prévia e os projetos", () => {
  const entrada = agente.montarEntrada(
    { nome: "Aurora Coop", nicho: "alimentos_bebidas" },
    { titulo: "Aurora vai construir frigorífico", veiculo: "Valor", data_original: "2023-07-28T10:00:00Z", url: "https://x", extracao: { capex: true, uf: "RS", cita_empresa: true } },
    [{ ...PROJETOS[0], valor_estimado_brl: "1100000000", data_anuncio: "2026-02-16", noticias: ["Aurora anuncia frigorífico"] }],
  );
  assert.equal(entrada.noticia.data, "2023-07-28");
  assert.equal(entrada.noticia.leitura_previa.uf, "RS");
  assert.equal(entrada.projetos[0].valor_brl, 1100000000);
  assert.deepEqual(entrada.projetos[0].noticias, ["Aurora anuncia frigorífico"]);
});

const DECISAO = {
  id: "d1", evidencia_id: "e1", grupo: "Aurora Coop", modelo: "claude-haiku-5-5", versao_prompt: "agente-v1",
  criado_em: "2026-11-06T12:00:00Z", titulo: "Aurora vai construir frigorífico", url: "https://x", veiculo: "Valor",
  data_original: "2023-07-28T10:00:00Z", decisao: "criar_projeto", motivo: "obra_nova", confianca: 90,
  acao: "projeto_criado", projeto_id: "p9", projeto_titulo: "Aurora Coop — frigorífico em Tapejara", projeto_status: "em_revisao",
  saida: saida(), entrada: { projetos: [] }, avaliacao: null, desfeita: false,
};

test("card da decisão mostra análise, projeto e avaliação", () => {
  const html = cardDecisao(DECISAO);
  assert.match(html, /Projeto criado/);
  assert.match(html, /Criar projeto · obra nova/);
  assert.match(html, /gera obra: sim/);
  assert.match(html, /em revisão/);
  assert.match(html, /action="\/monitoramento\/agente\/d1\/avaliar"/);
  assert.match(html, /name="desfazer" value="1" checked/);
  const avaliada = cardDecisao({ ...DECISAO, avaliacao: "incorreta", decisao_correta: "descartar", motivo_correto: "compra_aquisicao", avaliado_por: "usuario:painel" });
  assert.match(avaliada, /o certo era Descartar \(compra ou aquisição/);
  assert.doesNotMatch(avaliada, /Salvar avaliação/);
});

test("página do agente e linha no card da notícia", () => {
  const html = paginaAgente({
    resumo: { total: 4, projeto_criado: 1, vinculada: 1, descartada: 1, revisao_humana: 1, erro: 0, avaliadas: 2, corretas: 1, incorretas: 1 },
    decisoes: [DECISAO], filtros: { avaliacao: "pendentes", acao: "", grupo: "" }, grupos: [], fila: 12,
    totalProjetos: 7, limiar: 75, modelo: "claude-haiku-5-5", temChave: true,
  });
  assert.match(html, /data-modo="agente">Rodar o agente \(12 na fila\)/);
  assert.match(html, /data-stat="ag_acerto">50%/);
  assert.match(html, /treino\.jsonl/);
  assert.match(linhaAgente({ agente_acao: "revisao_humana", agente_decisao: "descartar", agente_motivo: "sem_obra", agente_confianca: 60, agente_trava: "confiança 60 abaixo de 75" }),
    /Agente: <strong>Descartar<\/strong> \(60%\) · investimento sem obra/);
  assert.equal(linhaAgente({ agente_acao: "projeto_criado", agente_decisao: "criar_projeto" }), "");
});

test("exemplo de treino leva entrada, saída e a decisão certa", () => {
  const ex = agente.exemploDeTreino({ ...DECISAO, avaliacao: "incorreta", decisao_correta: "descartar", entrada: { a: 1 } });
  assert.deepEqual(Object.keys(ex), ["id", "versao_prompt", "modelo", "entrada", "saida_agente", "acao", "avaliacao", "decisao_correta", "motivo_correto", "observacao", "criado_em", "avaliado_em"]);
  assert.equal(ex.decisao_correta, "descartar");
});
