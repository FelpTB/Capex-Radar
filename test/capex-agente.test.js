const test = require("node:test");
const assert = require("node:assert/strict");

process.env.SUPABASE_STRING ||= "postgres://teste:teste@localhost:5432/teste";
const agente = require("../src/capex-agente");
const { cardDecisao, paginaAgente, linhaAgente } = require("../src/capex-painel");

const PROJETOS = [{ id: "p1", titulo: "Aurora Coop — Novo frigorífico", uf: "SC", municipio: "São Miguel do Oeste", estagio: "anuncio" }];

function saida({ analise = {}, ...resto } = {}) {
  return {
    analise: { investimento: true, gera_obra: true, situacao: "anunciado", no_brasil: true, mesmo_projeto_id: null, ...analise },
    decisao: "criar_projeto",
    motivo: "obra_nova",
    confianca: 90,
    justificativa: "Anuncia a construção de um frigorífico em Tapejara.",
    projeto: { titulo: "frigorífico em Tapejara", objeto: "frigorífico", uf: "RS", municipio: "Tapejara", valor_brl: 82000000, estagio: "anuncio", data_fato: null },
    ...resto,
  };
}

test("o prompt v2 obriga a decidir e traz as regras de presunção", () => {
  assert.equal(agente.VERSAO_PROMPT, "agente-v2");
  for (const trecho of ["SEMPRE decide", "MESMO PROJETO", "Presuma que gera obra", "manchetes próximas", "falta de município", "inaugura", "em_construcao"]) {
    assert.match(agente.PROMPT, new RegExp(trecho));
  }
  for (const codigo of Object.keys(agente.MOTIVOS)) assert.match(agente.PROMPT, new RegExp(codigo));
  assert.doesNotMatch(agente.PROMPT, /revisar:/);
});

test("lê a resposta do agente e normaliza a UF", () => {
  const lida = agente.lerSaida(JSON.stringify(saida({ projeto: { ...saida().projeto, uf: "rs" } })));
  assert.equal(lida.projeto.uf, "RS");
  assert.throws(() => agente.lerSaida(JSON.stringify({ decisao: "aprovar" })));
  assert.throws(() => agente.lerSaida(null));
});

test("aponta o que impede executar a resposta", () => {
  assert.equal(agente.problemaDaSaida(saida(), { projetos: PROJETOS }), null);
  assert.match(agente.problemaDaSaida(saida({ decisao: "revisar", motivo: "incerto" })), /não existe/);
  assert.match(agente.problemaDaSaida(saida({ motivo: "sem_obra" })), /não combina/);
  assert.match(agente.problemaDaSaida(saida({ analise: { gera_obra: false } })), /não gera obra/);
  assert.match(agente.problemaDaSaida(saida({ analise: { situacao: "concluido" } })), /concluído/);
  assert.match(agente.problemaDaSaida(saida({ decisao: "vincular", motivo: "mesmo_projeto", analise: { mesmo_projeto_id: "x" } }), { projetos: PROJETOS }), /id de um projeto/);
  // Confiança baixa não é problema na v2: a decisão é executada.
  assert.equal(agente.problemaDaSaida(saida({ confianca: 40 })), null);
});

test("fecha a decisão pela análise quando o modelo não resolve", () => {
  const revisar = agente.resolverDecisao(saida({ decisao: "revisar", motivo: "incerto", projeto: null }), { noticia: { titulo: "Lactalis investe R$ 400 mi no RS", extracao: { objeto: "unidades no RS", uf: "RS" } } });
  assert.equal(revisar.saida.decisao, "criar_projeto");
  assert.equal(revisar.saida.motivo, "obra_nova");
  assert.equal(revisar.saida.projeto.titulo, "unidades no RS");
  assert.match(revisar.ajuste, /regra da análise/);

  const semObra = agente.resolverDecisao(saida({ decisao: "revisar", motivo: "incerto", analise: { gera_obra: false } }));
  assert.equal(semObra.saida.decisao, "descartar");
  assert.equal(semObra.saida.motivo, "sem_obra");
  assert.equal(semObra.saida.projeto, null);

  const concluido = agente.resolverDecisao(saida({ analise: { situacao: "concluido" } }));
  assert.equal(concluido.saida.motivo, "inauguracao_concluido");

  const igual = agente.resolverDecisao(saida({ analise: { mesmo_projeto_id: "p1" } }), { projetos: PROJETOS });
  assert.equal(igual.saida.decisao, "vincular");
  assert.equal(igual.saida.analise.mesmo_projeto_id, "p1");

  assert.equal(agente.resolverDecisao(saida()).ajuste, null);
});

test("ação da decisão final; sem CNPJ da matriz é a única exceção", () => {
  assert.deepEqual(agente.acaoDaDecisao(saida()), { acao: "projeto_criado" });
  assert.equal(agente.acaoDaDecisao(saida(), { temMatriz: false }).acao, "revisao_humana");
  assert.deepEqual(agente.acaoDaDecisao(saida({ decisao: "vincular", motivo: "mesmo_projeto", analise: { mesmo_projeto_id: "p1" } })), { acao: "vinculada", projeto_id: "p1" });
  assert.deepEqual(agente.acaoDaDecisao(saida({ decisao: "descartar", motivo: "compra_aquisicao" })), { acao: "descartada" });
});

test("pede correção ao agente e usa a segunda resposta quando ela fecha", async () => {
  const respostas = [saida({ decisao: "revisar", motivo: "incerto" }), saida({ confianca: 70 })];
  const chamadas = [];
  const falso = { modelo: "teste", async decidir(entrada, correcao) { chamadas.push(correcao); return respostas.shift(); } };
  const final = await agente.decisaoFinal(falso, {}, { projetos: [], noticia: {} });
  assert.equal(chamadas.length, 2);
  assert.match(chamadas[1].problema, /não existe/);
  assert.equal(final.saida.decisao, "criar_projeto");
  assert.match(final.ajuste, /corrigida pelo agente/);
  assert.equal(final.saida.correcao.saida_anterior.decisao, "revisar");
});

test("se a correção também falha, a regra da análise decide", async () => {
  const ruim = saida({ decisao: "revisar", motivo: "incerto", analise: { investimento: false } });
  const falso = { modelo: "teste", async decidir() { return ruim; } };
  const final = await agente.decisaoFinal(falso, {}, { projetos: [], noticia: {} });
  assert.equal(final.saida.decisao, "descartar");
  assert.equal(final.saida.motivo, "nao_investimento");
  assert.ok(final.saida.correcao.segunda_resposta);
});

test("manchetes próximas: janela de dias, mais perto primeiro, em ordem de data", () => {
  const n = (id, data, situacao) => ({ id, titulo: `t${id}`, data_original: data, situacao });
  const todas = [n(1, "2025-09-04"), n(2, "2025-09-05", "projeto: Ijuí"), n(3, "2025-01-01"), n(4, "2025-08-01"), n(5, null)];
  const proximas = agente.noticiasProximas({ id: 1, data_original: "2025-09-04" }, todas, { dias: 60 });
  assert.deepEqual(proximas.map((p) => p.titulo), ["t4", "t2"]);
  assert.equal(proximas[1].situacao, "projeto: Ijuí");
  assert.equal(proximas[0].situacao, "na fila");
  assert.deepEqual(agente.noticiasProximas({ id: 9, data_original: null }, todas), []);
});

test("entrada do agente traz a notícia, os projetos e as manchetes próximas", () => {
  const entrada = agente.montarEntrada(
    { nome: "Aurora Coop", nicho: "alimentos_bebidas" },
    { titulo: "Aurora vai construir frigorífico", veiculo: "Valor", data_original: "2023-07-28T10:00:00Z", url: "https://x", extracao: { capex: true, uf: "RS", cita_empresa: true } },
    [{ ...PROJETOS[0], valor_estimado_brl: "1100000000", data_anuncio: "2026-02-16", noticias: ["Aurora anuncia frigorífico"] }],
    [{ titulo: "outra", data: "2023-07-29", situacao: "na fila" }],
  );
  assert.equal(entrada.noticia.data, "2023-07-28");
  assert.equal(entrada.projetos[0].valor_brl, 1100000000);
  assert.equal(entrada.noticias_proximas.length, 1);
});

const DECISAO = {
  id: "d1", evidencia_id: "e1", grupo: "Aurora Coop", modelo: "claude-haiku-5-5", versao_prompt: "agente-v2",
  criado_em: "2026-11-06T12:00:00Z", titulo: "Aurora vai construir frigorífico", url: "https://x", veiculo: "Valor",
  data_original: "2023-07-28T10:00:00Z", decisao: "criar_projeto", motivo: "obra_nova", confianca: 90,
  acao: "projeto_criado", acao_motivo: "corrigida pelo agente: a decisão \"revisar\" não existe", projeto_id: "p9",
  projeto_titulo: "Aurora Coop — frigorífico em Tapejara", projeto_status: "em_revisao",
  saida: saida(), entrada: { projetos: [] }, avaliacao: null, desfeita: false,
};

test("card da decisão mostra análise, ajuste, projeto e avaliação", () => {
  const html = cardDecisao(DECISAO);
  assert.match(html, /Projeto criado/);
  assert.match(html, /Criar projeto · obra nova/);
  assert.match(html, /gera obra: sim/);
  assert.match(html, /Ajuste: corrigida pelo agente/);
  assert.match(html, /action="\/monitoramento\/agente\/d1\/avaliar"/);
  assert.match(html, /name="desfazer" value="1" checked/);
  const avaliada = cardDecisao({ ...DECISAO, avaliacao: "incorreta", decisao_correta: "descartar", motivo_correto: "compra_aquisicao", avaliado_por: "usuario:painel" });
  assert.match(avaliada, /o certo era Descartar \(compra ou aquisição/);
  assert.doesNotMatch(avaliada, /Salvar avaliação/);
});

test("página do agente tem filtro de versão; linha no card da notícia", () => {
  const html = paginaAgente({
    resumo: { total: 4, projeto_criado: 1, vinculada: 1, descartada: 1, revisao_humana: 1, erro: 0, avaliadas: 2, corretas: 1, incorretas: 1 },
    decisoes: [DECISAO], filtros: { avaliacao: "pendentes", acao: "", grupo: "", versao: "agente-v2" }, grupos: [], fila: 12,
    totalProjetos: 7, modelo: "claude-haiku-5-5", temChave: true, versoes: ["agente-v2", "agente-v1"],
  });
  assert.match(html, /data-modo="agente">Rodar o agente \(12 na fila\)/);
  assert.match(html, /data-stat="ag_acerto">50%/);
  assert.match(html, /<option value="agente-v2" selected>/);
  assert.match(html, /treino\.jsonl/);
  assert.match(linhaAgente({ agente_acao: "revisao_humana", agente_decisao: "criar_projeto", agente_motivo: "obra_nova", agente_confianca: 80, agente_trava: "empresa sem CNPJ da matriz" }),
    /Agente: <strong>Criar projeto<\/strong> \(80%\)/);
});

test("exemplo de treino leva entrada, decisão final e a decisão certa", () => {
  const ex = agente.exemploDeTreino({ ...DECISAO, avaliacao: "incorreta", decisao_correta: "descartar", entrada: { a: 1 } });
  assert.deepEqual(Object.keys(ex), ["id", "versao_prompt", "modelo", "entrada", "saida_agente", "acao", "avaliacao", "decisao_correta", "motivo_correto", "observacao", "criado_em", "avaliado_em"]);
  assert.equal(ex.decisao_correta, "descartar");
});
