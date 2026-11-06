// Agente de triagem automática do capex_radar.
//
// Lê as notícias que a triagem marcou como CapEx (fila "A revisar") e decide,
// uma por vez e em ordem cronológica, entre:
//   - criar_projeto: investimento com obra, anunciado ou em construção;
//   - vincular: é um projeto já cadastrado (evita repetir projeto);
//   - descartar: não gera obra, é compra/aquisição, já está pronto, etc.;
//   - revisar: na dúvida, deixa para a revisão humana.
//
// O modelo decide, mas as travas em código (aplicarTravas) só deixam agir
// quando a análise é coerente e a confiança passa do limiar. Toda decisão fica
// em capex_radar.agente_decisao com a entrada e a saída, para ser avaliada na
// aba Agente e exportada como conjunto de treino.
const { z } = require("zod");
const { criarCliente, pedirJson } = require("./claude");
const painel = require("./capex-painel-db");
const { ESTAGIOS } = require("./capex-ia");

const ATOR_AGENTE = "ia:agente";
const VERSAO_PROMPT = "agente-v1";
const LIMIAR_PADRAO = 75;

// Motivos que o agente pode dar, por decisão. O código fica no banco; o
// rótulo aparece na tela e no motivo do descarte.
const MOTIVOS = {
  obra_nova: { decisao: "criar_projeto", rotulo: "obra nova (fábrica, planta, CD, data center)" },
  expansao: { decisao: "criar_projeto", rotulo: "expansão ou nova linha com obra" },
  mesmo_projeto: { decisao: "vincular", rotulo: "mesmo projeto já cadastrado" },
  sem_obra: { decisao: "descartar", rotulo: "investimento sem obra (máquinas, TI, frota, marketing)" },
  compra_aquisicao: { decisao: "descartar", rotulo: "compra ou aquisição de empresa ou ativo pronto" },
  inauguracao_concluido: { decisao: "descartar", rotulo: "inauguração ou obra já concluída e operando" },
  nao_investimento: { decisao: "descartar", rotulo: "não é investimento (resultado, mercado, produto, gestão)" },
  outra_empresa: { decisao: "descartar", rotulo: "outra empresa ou homônimo" },
  fora_brasil: { decisao: "descartar", rotulo: "fora do Brasil" },
  cancelado: { decisao: "descartar", rotulo: "projeto cancelado ou suspenso sem cadastro" },
  incerto: { decisao: "revisar", rotulo: "informação insuficiente" },
};

const DECISOES = ["criar_projeto", "vincular", "descartar", "revisar"];
const SITUACOES_OBRA = ["anunciado", "em_construcao", "concluido", "incerto"];

const PROMPT = `Você é o analista de triagem de um radar de projetos de investimento (CapEx) privados no Brasil.
O radar acompanha OBRAS: fábricas, plantas, linhas de produção, centros de distribuição, galpões logísticos e campi de data center que ainda vão ser construídos ou estão em construção. Ele serve para encontrar oportunidades de fornecimento para a obra, então só interessa o que ainda vai gerar obra.

Você recebe UMA notícia de um grupo empresarial, a leitura prévia da IA de triagem (pode ter erros) e a lista dos projetos já cadastrados desse grupo.

Siga os passos na ordem:

1. INVESTIMENTO. A notícia fala de um investimento da PRÓPRIA empresa do grupo em ativo físico no Brasil? Não é investimento: resultado financeiro, ações, dívida sem destino de obra, produto, marketing, executivos, processos judiciais, investimento de outra empresa ou de governo. Se o grupo não aparece ou parece homônimo, é outra_empresa.

2. MESMO PROJETO. Compare com cada projeto cadastrado: mesmo tipo de ativo e mesmo local (município ou UF), ou referência clara ao mesmo empreendimento (nome da unidade, valor e prazo compatíveis). Notícias diferentes sobre o mesmo empreendimento (anúncio, licença, financiamento, início de obra, inauguração) são o MESMO projeto: decisão vincular, com mesmo_projeto_id. Ativo diferente ou local diferente é outro projeto. Na dúvida entre vincular e criar, decida revisar.

3. GERA OBRA. Gera obra: construção de fábrica, planta, unidade, CD ou data center; ampliação de área construída ou de capacidade com obra; nova linha de produção com montagem industrial; modernização com obra civil. NÃO gera obra: compra de máquinas, equipamentos, frota ou tecnologia sem obra; aquisição de empresa, marca, fazenda ou ativo já pronto (fusão, compra de participação, arrendamento); P&D, marketing, contratação.

4. SITUAÇÃO. anunciado: planejado, anunciado, em licenciamento ou financiamento, obra ainda não começou. em_construcao: obras iniciadas ou em andamento. concluido: inaugurado, concluído, já operando. incerto: a notícia não permite dizer.

5. DECISÃO.
- criar_projeto: investimento + gera obra + anunciado ou em_construcao + no Brasil + nenhum projeto cadastrado igual. Motivo obra_nova ou expansao.
- vincular: é um projeto cadastrado (qualquer situação, inclusive inauguração). Motivo mesmo_projeto.
- descartar: não é investimento, não gera obra, é compra/aquisição, já está concluído e não há projeto cadastrado, é outra empresa, é fora do Brasil, ou foi cancelado sem projeto cadastrado. Use o motivo que melhor explica.
- revisar: faltam dados para decidir com segurança. Motivo incerto.

Motivos válidos: ${Object.entries(MOTIVOS).map(([codigo, m]) => `${codigo} (${m.decisao})`).join(", ")}.

Confiança (0 a 100): quanto a notícia sozinha sustenta a decisão. Acima de 85 só quando o texto é explícito. Manchete vaga ou só a leitura prévia sustentando: abaixo de 70.

Para criar_projeto, preencha projeto com o que a notícia diz: titulo curto do ativo (sem o nome do grupo, ex.: "fábrica de celulose em Inocência"), objeto, uf (sigla), municipio, valor_brl (número em reais, R$ 1,2 bilhão = 1200000000), estagio (um de: ${ESTAGIOS.join(", ")}) e data_fato (AAAA-MM-DD, AAAA-MM ou AAAA). Deixe null o que não está escrito. Nas outras decisões, projeto é null.

Responda somente com JSON neste formato:
{"analise":{"investimento":true,"gera_obra":true,"situacao":"anunciado","no_brasil":true,"mesmo_projeto_id":null},"decisao":"criar_projeto","motivo":"obra_nova","confianca":80,"justificativa":"uma ou duas frases citando o trecho da notícia que decide","projeto":{"titulo":"...","objeto":"...","uf":"MS","municipio":"...","valor_brl":null,"estagio":"anuncio","data_fato":null}}`;

const textoOpcional = z.string().trim().min(1).nullable().optional().catch(null);

const saidaSchema = z.object({
  analise: z.object({
    investimento: z.boolean(),
    gera_obra: z.boolean(),
    situacao: z.enum(SITUACOES_OBRA),
    no_brasil: z.boolean().optional().default(true),
    mesmo_projeto_id: z.string().nullable().optional().default(null),
  }),
  decisao: z.enum(DECISOES),
  motivo: z.enum(Object.keys(MOTIVOS)),
  confianca: z.number().min(0).max(100).transform((n) => Math.round(n)),
  justificativa: z.string().trim().min(1).max(600),
  projeto: z.object({
    titulo: z.string().trim().min(3).max(160),
    objeto: textoOpcional,
    uf: z.string().trim().length(2).transform((uf) => uf.toUpperCase()).nullable().optional().catch(null),
    municipio: textoOpcional,
    valor_brl: z.number().nonnegative().nullable().optional().catch(null),
    estagio: z.enum(ESTAGIOS).nullable().optional().catch(null),
    data_fato: z.string().regex(/^\d{4}(-\d{2}){0,2}$/).nullable().optional().catch(null),
  }).nullable().optional().default(null),
});

function dia(valor) {
  return valor ? new Date(valor).toISOString().slice(0, 10) : null;
}

/** O que o agente vê: a notícia, a leitura prévia e os projetos do grupo. */
function montarEntrada(grupo, noticia, projetos) {
  const ex = noticia.extracao || {};
  return {
    grupo: { nome: grupo.nome, nicho: grupo.nicho },
    noticia: {
      titulo: noticia.titulo,
      veiculo: noticia.veiculo || null,
      data: dia(noticia.data_original),
      url: noticia.url || null,
      cita_empresa_no_titulo: ex.cita_empresa !== false,
      leitura_previa: {
        capex: ex.capex ?? null,
        objeto: ex.objeto ?? null,
        uf: ex.uf ?? null,
        municipio: ex.municipio ?? null,
        valor_brl: ex.valor_brl ?? null,
        estagio: ex.estagio ?? null,
        data_fato: ex.data_fato ?? null,
        motivo: ex.motivo ?? null,
      },
    },
    projetos: projetos.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      objeto: p.objeto || null,
      uf: p.uf || null,
      municipio: p.municipio || null,
      estagio: p.estagio,
      valor_brl: p.valor_estimado_brl == null ? null : Number(p.valor_estimado_brl),
      anuncio: dia(p.data_anuncio),
      noticias: p.noticias || [],
    })),
  };
}

/** Valida a resposta do modelo. Erro de formato vira exceção (acao = erro). */
function lerSaida(raw) {
  if (!raw) throw new Error("O modelo não retornou JSON");
  return saidaSchema.parse(JSON.parse(raw));
}

/**
 * Travas: decide o que fazer com a resposta. Devolve { acao, motivo } onde
 * acao é projeto_criado | vinculada | descartada | revisao_humana.
 */
function aplicarTravas(saida, { projetos = [], limiar = LIMIAR_PADRAO, temMatriz = true } = {}) {
  const revisar = (motivo) => ({ acao: "revisao_humana", motivo });
  const { analise, decisao, motivo, confianca } = saida;
  if (decisao === "revisar") return revisar("o agente pediu revisão");
  if (MOTIVOS[motivo].decisao !== decisao) return revisar(`motivo ${motivo} não combina com ${decisao}`);
  if (confianca < limiar) return revisar(`confiança ${confianca} abaixo de ${limiar}`);

  if (decisao === "vincular") {
    const id = analise.mesmo_projeto_id;
    if (!id || !projetos.some((p) => String(p.id) === String(id))) return revisar("projeto para vincular fora da lista");
    return { acao: "vinculada", projeto_id: id };
  }
  if (decisao === "criar_projeto") {
    if (analise.mesmo_projeto_id) return revisar("apontou projeto igual e pediu para criar");
    if (!analise.investimento || !analise.gera_obra) return revisar("criar sem investimento com obra");
    if (!["anunciado", "em_construcao"].includes(analise.situacao)) return revisar(`criar com situação ${analise.situacao}`);
    if (!analise.no_brasil) return revisar("criar fora do Brasil");
    if (!saida.projeto) return revisar("criar sem os dados do projeto");
    if (!temMatriz) return revisar("empresa sem CNPJ da matriz");
    return { acao: "projeto_criado" };
  }
  return { acao: "descartada" };
}

function criarAgente({ client, modelo }) {
  return {
    modelo,
    async decidir(entrada) {
      const raw = await pedirJson(client, { model: modelo, system: PROMPT, user: JSON.stringify(entrada), maxTokens: 1500 });
      return lerSaida(raw);
    },
  };
}

// Usa CLAUDE_DECISION_MODEL (ou CLAUDE_MODEL). Sem chave, devolve null.
function agentePadrao() {
  const { getConfig } = require("./config");
  const config = getConfig();
  const client = criarCliente(config.claudeApiKey);
  return client ? criarAgente({ client, modelo: config.claudeDecisionModel }) : null;
}

function limiarPadrao() {
  const n = Number(process.env.CAPEX_AGENTE_CONFIANCA);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : LIMIAR_PADRAO;
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------

/** Notícias da fila "A revisar" que o agente ainda não decidiu. */
async function filaDoAgente(db, grupoId, limite = 400) {
  const { rows } = await db.query(
    `select e.id, e.titulo, e.veiculo, e.url, e.data_original, e.extracao
       from capex_radar.evidencias e
      where e.grupo_id = $1 and ${painel.FILTRO_SITUACAO.revisar}
        and not exists (select 1 from capex_radar.agente_decisao d
                         where d.evidencia_id = e.id and d.acao <> 'erro')
      order by e.data_original nulls last
      limit $2`,
    [grupoId, limite],
  );
  return rows;
}

async function contarFila(db, grupoIds) {
  const { rows } = await db.query(
    `select e.grupo_id, count(*)::int as n
       from capex_radar.evidencias e
      where e.grupo_id = any($1::uuid[]) and ${painel.FILTRO_SITUACAO.revisar}
        and not exists (select 1 from capex_radar.agente_decisao d
                         where d.evidencia_id = e.id and d.acao <> 'erro')
      group by e.grupo_id`,
    [grupoIds],
  );
  return new Map(rows.map((row) => [row.grupo_id, row.n]));
}

/** Projetos do grupo com até 3 manchetes de cada, para comparar. */
async function projetosParaComparar(db, grupoId) {
  const { rows } = await db.query(
    `select p.id, p.titulo, p.objeto, p.uf, p.municipio, p.estagio, p.valor_estimado_brl, p.data_anuncio,
            coalesce((select array_agg(t.titulo order by t.data_original nulls last)
                        from (select titulo, data_original from capex_radar.vw_projeto_timeline
                               where projeto_id = p.id order by data_original nulls last limit 3) t), '{}') as noticias
       from capex_radar.projetos p
      where p.grupo_id = $1 and p.status <> 'descartado'
      order by p.atualizado_em desc
      limit 80`,
    [grupoId],
  );
  return rows;
}

async function matrizPrincipal(db, grupoId) {
  const { rows } = await db.query(
    `select cnpj from capex_radar.matrizes where grupo_id = $1
      order by (papel = 'principal') desc, razao_social limit 1`,
    [grupoId],
  );
  return rows[0]?.cnpj || null;
}

async function registrar(db, dados) {
  const { rows: [linha] } = await db.query(
    `insert into capex_radar.agente_decisao
       (evidencia_id, grupo_id, modelo, versao_prompt, entrada, saida, decisao, motivo, confianca, acao, acao_motivo, projeto_id)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12)
     returning id`,
    [dados.evidencia_id, dados.grupo_id, dados.modelo, VERSAO_PROMPT, JSON.stringify(dados.entrada),
      dados.saida ? JSON.stringify(dados.saida) : null, dados.saida?.decisao || null, dados.saida?.motivo || null,
      dados.saida?.confianca ?? null, dados.acao, dados.acao_motivo || null, dados.projeto_id || null],
  );
  return linha.id;
}

/** Executa a ação aprovada pelas travas. Devolve o projeto criado ou ligado. */
async function executarAcao({ db, grupo, noticia, saida, travas, matriz, agente }) {
  const vinculo = { confianca: saida.confianca, motivo: saida.justificativa.slice(0, 300), modelo: agente.modelo };
  if (travas.acao === "vinculada") {
    await painel.vincularNoticia(noticia.id, travas.projeto_id, { ator: ATOR_AGENTE, origem: "ia", vinculo });
    return { projeto_id: travas.projeto_id };
  }
  if (travas.acao === "descartada") {
    await painel.descartarNoticia(noticia.id, MOTIVOS[saida.motivo].rotulo, { ator: ATOR_AGENTE, rotulo: "Agente" });
    return {};
  }
  // projeto_criado
  const p = saida.projeto;
  const ex = noticia.extracao || {};
  const uf = p.uf || ex.uf || null;
  const municipio = p.municipio || (uf && uf === ex.uf ? ex.municipio : null) || null;
  const filial = ex.filial_sugerida && (!uf || ex.filial_sugerida.uf === uf) ? ex.filial_sugerida.cnpj : null;
  const dataFato = /^\d{4}-\d{2}-\d{2}$/.test(p.data_fato || "") ? p.data_fato : null;
  const projeto = await painel.criarProjetoDaNoticia(noticia.id, {
    titulo: `${grupo.nome} — ${p.titulo}`.slice(0, 200),
    matriz_cnpj: matriz,
    filial_cnpj: filial,
    uf,
    municipio,
    objeto: p.objeto || ex.objeto || null,
    valor_estimado_brl: p.valor_brl ?? ex.valor_brl ?? null,
    estagio: p.estagio || (saida.analise.situacao === "em_construcao" ? "mobilizacao" : "anuncio"),
    data_anuncio: dataFato || dia(noticia.data_original),
  }, { ator: ATOR_AGENTE, origem: "ia", status: "em_revisao", vinculo });
  return { projeto_id: projeto.id, projeto };
}

/**
 * Decide a fila de um grupo. As notícias vão em ordem cronológica e cada
 * projeto criado entra na lista de comparação da próxima, para a segunda
 * notícia do mesmo empreendimento ser vinculada em vez de virar outro projeto.
 */
async function decidirGrupo({ db, grupo, agente, limite = 400, limiar = limiarPadrao(), onProgresso = () => {} }) {
  const resumo = { grupo: grupo.nome, lidas: 0, projetos_criados: 0, vinculadas: 0, descartadas: 0, revisao_humana: 0, erros: 0 };
  const fila = await filaDoAgente(db, grupo.id, limite);
  if (!fila.length) return resumo;
  const projetos = await projetosParaComparar(db, grupo.id);
  const matriz = await matrizPrincipal(db, grupo.id);
  for (const noticia of fila) {
    const entrada = montarEntrada(grupo, noticia, projetos);
    const base = { evidencia_id: noticia.id, grupo_id: grupo.id, modelo: agente.modelo, entrada };
    resumo.lidas += 1;
    let saida;
    try {
      saida = await agente.decidir(entrada);
    } catch (error) {
      resumo.erros += 1;
      await registrar(db, { ...base, acao: "erro", acao_motivo: String(error.message).slice(0, 300) });
      onProgresso(resumo.lidas, fila.length);
      continue;
    }
    const travas = aplicarTravas(saida, { projetos, limiar, temMatriz: Boolean(matriz) });
    let acao = travas.acao;
    let acaoMotivo = travas.motivo || null;
    let projetoId = travas.projeto_id || null;
    if (acao !== "revisao_humana") {
      try {
        const r = await executarAcao({ db, grupo, noticia, saida, travas, matriz, agente });
        projetoId = r.projeto_id || null;
        if (r.projeto) {
          projetos.unshift({ ...r.projeto, objeto: saida.projeto.objeto, uf: saida.projeto.uf, municipio: saida.projeto.municipio,
            estagio: saida.projeto.estagio || "anuncio", noticias: [noticia.titulo] });
        }
      } catch (error) {
        acao = "erro";
        acaoMotivo = String(error.message).slice(0, 300);
      }
    }
    await registrar(db, { ...base, saida, acao, acao_motivo: acaoMotivo, projeto_id: projetoId });
    const chave = { projeto_criado: "projetos_criados", vinculada: "vinculadas", descartada: "descartadas", revisao_humana: "revisao_humana", erro: "erros" }[acao];
    resumo[chave] += 1;
    onProgresso(resumo.lidas, fila.length);
  }
  return resumo;
}

// ---------------------------------------------------------------------------
// Avaliação (aba Agente) e conjunto de treino
// ---------------------------------------------------------------------------

const AVALIACOES = {
  pendentes: "Não avaliadas",
  corretas: "Corretas",
  incorretas: "Incorretas",
  todas: "Todas",
};

const FILTRO_AVALIACAO = {
  pendentes: "d.avaliacao is null",
  corretas: "d.avaliacao = 'correta'",
  incorretas: "d.avaliacao = 'incorreta'",
  todas: "true",
};

const ACOES = {
  projeto_criado: "Projeto criado",
  vinculada: "Vinculada",
  descartada: "Descartada",
  revisao_humana: "Revisão humana",
  erro: "Erro",
};

async function listarDecisoes(db, { avaliacao = "pendentes", acao = "", grupoId = null, id = null, limite = 100 } = {}) {
  const filtros = [id ? "d.id = $1" : FILTRO_AVALIACAO[avaliacao] || FILTRO_AVALIACAO.pendentes];
  const params = id ? [id] : [];
  if (!id && ACOES[acao]) { params.push(acao); filtros.push(`d.acao = $${params.length}`); }
  if (!id && grupoId) { params.push(grupoId); filtros.push(`d.grupo_id = $${params.length}`); }
  params.push(limite);
  const { rows } = await db.query(
    `select d.*, g.nome as grupo, e.titulo, e.url, e.veiculo, e.data_original, e.triagem,
            p.titulo as projeto_titulo, p.status as projeto_status
       from capex_radar.agente_decisao d
       left join capex_radar.grupos g on g.id = d.grupo_id
       left join capex_radar.evidencias e on e.id = d.evidencia_id
       left join capex_radar.projetos p on p.id = d.projeto_id
      where ${filtros.join(" and ")}
      order by d.criado_em desc
      limit $${params.length}`,
    params,
  );
  return rows;
}

async function resumoDecisoes(db) {
  const { rows: [r] } = await db.query(
    `select count(*)::int as total,
            count(*) filter (where acao = 'projeto_criado')::int as projeto_criado,
            count(*) filter (where acao = 'vinculada')::int as vinculada,
            count(*) filter (where acao = 'descartada')::int as descartada,
            count(*) filter (where acao = 'revisao_humana')::int as revisao_humana,
            count(*) filter (where acao = 'erro')::int as erro,
            count(*) filter (where avaliacao is not null)::int as avaliadas,
            count(*) filter (where avaliacao = 'correta')::int as corretas,
            count(*) filter (where avaliacao = 'incorreta')::int as incorretas
       from capex_radar.agente_decisao`,
  );
  return r;
}

/**
 * Desfaz a ação do agente e devolve a notícia para a revisão.
 * Projeto criado só sai se ainda tiver só esta notícia.
 */
async function desfazerDecisao(id) {
  return painel.emTransacao(async (client) => {
    const { rows: [d] } = await client.query(
      "select * from capex_radar.agente_decisao where id = $1 for update",
      [id],
    );
    if (!d) throw new Error("Decisão não encontrada");
    if (d.desfeita || !["projeto_criado", "vinculada", "descartada"].includes(d.acao)) return d;
    if (d.acao === "projeto_criado" && d.projeto_id) {
      const { rows: [n] } = await client.query(
        "select count(*)::int as n from capex_radar.evidencia_projeto where projeto_id = $1 and situacao = 'aceito'",
        [d.projeto_id],
      );
      if (n && n.n > 1) throw new Error("O projeto já tem outras notícias; ajuste ou exclua pela página do projeto.");
      await client.query("delete from capex_radar.projetos where id = $1", [d.projeto_id]);
    }
    if (d.acao === "vinculada" && d.projeto_id) {
      await client.query(
        "delete from capex_radar.evidencia_projeto where evidencia_id = $1 and projeto_id = $2",
        [d.evidencia_id, d.projeto_id],
      );
    }
    if (d.evidencia_id) {
      await client.query(
        `update capex_radar.evidencias
            set triagem = case when (extracao->>'capex')::boolean then 'novo_projeto' else 'pendente' end,
                triagem_motivo = null
          where id = $1
            and not exists (select 1 from capex_radar.evidencia_projeto
                             where evidencia_id = $1 and situacao = 'aceito')`,
        [d.evidencia_id],
      );
    }
    await client.query("update capex_radar.agente_decisao set desfeita = true where id = $1", [id]);
    return d;
  });
}

const avaliacaoSchema = z.object({
  avaliacao: z.enum(["correta", "incorreta"]),
  decisao_correta: z.enum(["criar_projeto", "vincular", "descartar"]).nullable().optional(),
  motivo_correto: z.string().trim().max(120).nullable().optional(),
  observacao: z.string().trim().max(600).nullable().optional(),
  desfazer: z.boolean().optional().default(false),
});

/**
 * Grava a avaliação. Correta confirma a decisão (e ativa o projeto criado);
 * incorreta guarda a decisão certa e, se pedido, desfaz a ação.
 */
async function avaliarDecisao(id, entrada) {
  const dados = avaliacaoSchema.parse(entrada);
  if (dados.avaliacao === "incorreta" && dados.desfazer) await desfazerDecisao(id);
  return painel.emTransacao(async (client) => {
    const { rows: [d] } = await client.query("select * from capex_radar.agente_decisao where id = $1 for update", [id]);
    if (!d) throw new Error("Decisão não encontrada");
    const certa = dados.avaliacao === "correta"
      ? (d.decisao === "revisar" ? null : d.decisao)
      : dados.decisao_correta || null;
    await client.query(
      `update capex_radar.agente_decisao
          set avaliacao = $2, decisao_correta = $3, motivo_correto = $4, observacao = $5,
              avaliado_por = $6, avaliado_em = now()
        where id = $1`,
      [id, dados.avaliacao, certa, dados.avaliacao === "correta" ? d.motivo : dados.motivo_correto || null,
        dados.observacao || null, painel.ATOR],
    );
    if (dados.avaliacao === "correta" && d.acao === "projeto_criado" && d.projeto_id) {
      await client.query(
        "update capex_radar.projetos set status = 'ativo' where id = $1 and status = 'em_revisao'",
        [d.projeto_id],
      );
    }
    return { ...d, avaliacao: dados.avaliacao };
  });
}

/** Uma linha por decisão avaliada: o par entrada → decisão certa, para treino. */
function exemploDeTreino(d) {
  return {
    id: d.id,
    versao_prompt: d.versao_prompt,
    modelo: d.modelo,
    entrada: d.entrada,
    saida_agente: d.saida,
    acao: d.acao,
    avaliacao: d.avaliacao,
    decisao_correta: d.decisao_correta,
    motivo_correto: d.motivo_correto,
    observacao: d.observacao,
    criado_em: d.criado_em,
    avaliado_em: d.avaliado_em,
  };
}

async function exportarTreino(db, { incluirPendentes = false } = {}) {
  const { rows } = await db.query(
    `select * from capex_radar.agente_decisao
      where saida is not null and ($1 or avaliacao is not null)
      order by criado_em`,
    [incluirPendentes],
  );
  return rows.map(exemploDeTreino);
}

module.exports = {
  ATOR_AGENTE,
  VERSAO_PROMPT,
  LIMIAR_PADRAO,
  MOTIVOS,
  ACOES,
  AVALIACOES,
  PROMPT,
  montarEntrada,
  lerSaida,
  aplicarTravas,
  criarAgente,
  agentePadrao,
  limiarPadrao,
  filaDoAgente,
  projetosParaComparar,
  contarFila,
  decidirGrupo,
  listarDecisoes,
  resumoDecisoes,
  desfazerDecisao,
  avaliarDecisao,
  exemploDeTreino,
  exportarTreino,
};
