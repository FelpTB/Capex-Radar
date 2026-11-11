// Filtro 3 (fase 5) do capex_radar: relê as notícias enriquecidas.
//
// O Filtro 2 decidiu pela manchete. Aqui o modelo vê o perfil que o
// Enriquecimento montou com o texto da matéria (resumo, empresa, obra, local,
// valor, trechos) e tira o que não faz sentido para o radar: o texto mostra
// outra empresa, obra já concluída, só máquinas, plano genérico, ativo fora do
// Brasil, ou o mesmo fato de outra notícia já mantida. O que sobra vai para a
// aprovação humana.
//
// As regras de fechamento (descarte só com motivo, repetida aponta para uma
// manchete mantida, um fato por manchete) são as do Filtro 2
// (capex-filtro.fecharDecisoes). A decisão fica em
// capex_radar.evidencias.filtro_final (sql/024).
const { criarCliente, pedirJson } = require("./claude");
const filtro2 = require("./capex-filtro");
const painel = require("./capex-painel-db");
const fases = require("./capex-fases");

const ATOR = "ia:filtro3";
const VERSAO = "filtro3-v1";
const MODELO_PADRAO = "claude-sonnet-5-5";
const LOTE = 10;
const ROTULO = "Filtro 3";

const MOTIVOS = {
  ...filtro2.MOTIVOS,
  fora_contexto: "o texto da matéria não sustenta um projeto de CapEx do grupo",
};

const PROMPT = `Você é o último filtro de um radar de projetos de CapEx privado no Brasil, antes da aprovação por um analista. As notícias já passaram por dois filtros de manchete e foram ENRIQUECIDAS: cada item traz o perfil do projeto montado a partir do texto da matéria (resumo, empresa, objeto, local, valor, estágio, situação da obra, trechos copiados do texto). Decida com base nesse perfil, não só na manchete. Seja rígido: cada notícia mantida vira trabalho de um analista.

O QUE O RADAR QUER
Um investimento da PRÓPRIA empresa do grupo (ou controlada) para CONSTRUIR, AMPLIAR ou IMPLANTAR um ativo físico produtivo NO BRASIL, com OBRA por fazer ou em andamento: fábrica, ampliação com obra, nova linha, centro de distribuição construído para a empresa, data center, caldeira, máquina de papel, linha de celulose, subestação própria. Também valem fatos de um projeto assim: anúncio com decisão, licença, financiamento da obra, início ou andamento de obra, contratação de construtora.

DESCARTE QUANDO O PERFIL MOSTRA
- mesmo_grupo false ou empresa diferente do grupo (motivo outra_empresa);
- obra concluida (inauguração, entrada em operação) de um empreendimento que não está em projetos nem em mantidas (motivo concluido);
- obra sem_obra: aquisição (aquisicao), máquinas, TI, frota, modernização ou ocupação de galpão pronto (sem_obra);
- reabertura de unidade existente sem ampliação (reabertura);
- plano de investimento agregado sem unidade ou cidade (generico);
- intenção, estudo, negociação de incentivo, governo querendo atrair (especulacao);
- não é investimento (nao_investimento); fora do Brasil (fora_brasil); cancelado sem projeto cadastrado (cancelado);
- o texto lido não confirma o que a manchete sugeria, ou não há nada que sustente um projeto do grupo (fora_contexto).
Quando encontrou=false (a matéria não foi achada), decida pela manchete e pela leitura que houver; mantenha só se a manchete descreve claramente um ativo físico novo ou ampliado do grupo.

REPETIÇÃO
O mesmo fato contado por vários veículos fica com UMA notícia: a de perfil mais completo. As outras são repetida, com repete = "i:<item mantido>" (dentro do lote) ou "id:<id>" (lista mantidas). Fato novo de um empreendimento conhecido (licença, financiamento, início de obra) não é repetição. Antes de responder, dê a cada item um rótulo fato curto e padronizado (empreendimento + local + tipo do fato); itens com o mesmo fato recebem o mesmo rótulo e no máximo um é mantido.

Para cada item responda: i, fato, decisao ("manter" ou "descartar"), motivo (null se manter; senão um código), repete (só para repetida) e justificativa (uma frase citando o que no perfil decide).
Códigos de motivo: ${Object.keys(MOTIVOS).join(", ")}.

Responda somente com JSON: {"itens":[{"i":0,"fato":"...","decisao":"manter","motivo":null,"repete":null,"justificativa":"..."}]}, um elemento por item recebido.`;

const dia = filtro2.dia;

/** Monta a mensagem de um lote com o perfil enriquecido de cada item. */
function montarEntrada(grupo, lote, { projetos = [], mantidas = [] } = {}) {
  return {
    grupo: grupo.nome,
    nicho: grupo.nicho,
    projetos: projetos.map((p) => ({ titulo: p.titulo, uf: p.uf || null, municipio: p.municipio || null, estagio: p.estagio || null })),
    mantidas: mantidas.map((m) => ({ id: String(m.id), data: dia(m.data_original), titulo: m.titulo })),
    itens: lote.map((n, i) => {
      const en = n.enriquecimento || {};
      return {
        i,
        data: dia(n.data_original),
        titulo: n.titulo,
        veiculo: n.veiculo || null,
        encontrou: Boolean(en.encontrou),
        resumo: en.resumo || null,
        perfil: en.perfil
          ? Object.fromEntries(Object.entries(en.perfil).filter(([campo, valor]) => campo !== "filial_sugerida" && valor !== null))
          : null,
        trechos: en.trechos || [],
        observacao: en.observacao || null,
        motivo_filtro2: n.filtro?.justificativa || null,
      };
    }),
  };
}

function fecharDecisoes(raw, lote, mantidas = []) {
  return filtro2.fecharDecisoes(raw, lote, mantidas, { motivos: MOTIVOS });
}

function criarFiltroFinal({ client, modelo = MODELO_PADRAO, esforco = "medium" }) {
  return {
    modelo,
    async avaliar(entrada) {
      return pedirJson(client, {
        etapa: "filtro3",
        model: modelo,
        system: PROMPT,
        user: JSON.stringify(entrada),
        maxTokens: 16000,
        effort: esforco,
        thinking: null, // padrão do modelo (o Sonnet 5.5 não aceita "disabled")
      });
    },
  };
}

/** Filtro 3 do .env: CLAUDE_API_KEY e CLAUDE_FILTER3_MODEL. Desligado ou sem chave, null. */
function filtroFinalPadrao() {
  if (!fases.filtro3Ligado()) return null;
  const { getConfig } = require("./config");
  const config = getConfig();
  const client = criarCliente(config.claudeApiKey);
  return client ? criarFiltroFinal({ client, modelo: config.claudeFilter3Model }) : null;
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------

const SEM_DECISAO = `(e.filtro_final is null or e.filtro_final->>'versao' is distinct from '${VERSAO}')`;

function condicaoFila() {
  return `${fases.universoPosFiltro(painel.FILTRO_SITUACAO.funil)} and ${fases.condicaoAposEnriquecimento()} and ${SEM_DECISAO}`;
}

async function filaDoFiltro(db, grupoId, limite = 400) {
  const { rows } = await db.query(
    `select e.id, e.titulo, e.veiculo, e.data_original, e.extracao, e.enriquecimento, e.filtro
       from capex_radar.evidencias e
      where e.grupo_id = $1 and ${condicaoFila()}
      order by e.data_original nulls last, e.criado_em
      limit $2`,
    [grupoId, limite],
  );
  return rows;
}

async function contarFila(db, grupoIds) {
  const { rows } = await db.query(
    `select e.grupo_id, count(*)::int as n
       from capex_radar.evidencias e
      where e.grupo_id = any($1::uuid[]) and ${condicaoFila()}
      group by e.grupo_id`,
    [grupoIds],
  );
  return new Map(rows.map((row) => [row.grupo_id, row.n]));
}

async function projetosDoGrupo(db, grupoId) {
  const { rows } = await db.query(
    `select titulo, uf, municipio, estagio from capex_radar.projetos
      where grupo_id = $1 and status <> 'descartado'
      order by atualizado_em desc limit 80`,
    [grupoId],
  );
  return rows;
}

/** Notícias que seguem vivas depois do Filtro 3 (mantidas, vinculadas ou com projeto) perto das datas do lote. */
async function mantidasPerto(db, grupoId, desde, ate, excluir) {
  const { rows } = await db.query(
    `select e.id, e.titulo, e.data_original
       from capex_radar.evidencias e
      where e.grupo_id = $1 and e.data_original is not null
        and e.data_original between ($2::date - $4::int) and ($3::date + $4::int)
        and not (e.id = any($5::uuid[]))
        and (e.filtro_final->>'decisao' = 'manter' or e.triagem = 'vinculada'
             or exists (select 1 from capex_radar.evidencia_projeto ep where ep.evidencia_id = e.id and ep.situacao = 'aceito'))
      order by e.data_original desc
      limit $6`,
    [grupoId, desde, ate, filtro2.JANELA_MANTIDAS_DIAS, excluir, filtro2.LIMITE_MANTIDAS],
  );
  return rows;
}

async function gravar(noticia, decisao, filtro) {
  const registro = {
    versao: VERSAO,
    modelo: filtro.modelo,
    decisao: decisao.decisao,
    motivo: decisao.motivo,
    fato: decisao.fato || null,
    repete_id: decisao.repete_id,
    justificativa: decisao.justificativa,
    ...(decisao.ajuste ? { ajuste: decisao.ajuste } : {}),
    em: new Date().toISOString(),
  };
  if (decisao.decisao === "descartar") {
    await painel.descartarNoticia(noticia.id, filtro2.motivoTexto(decisao, MOTIVOS), { ator: ATOR, rotulo: ROTULO });
    // Fluxo v2: a notícia já foi alocada no Perfil inicial. Sai do projeto, e o
    // projeto em revisão que ficar sem notícia é descartado.
    await painel.retirarDoProjeto(noticia.id, filtro2.motivoTexto(decisao, MOTIVOS), { ator: ATOR });
  }
  await painel.emTransacao((client) => client.query(
    "update capex_radar.evidencias set filtro_final = $2::jsonb where id = $1",
    [noticia.id, JSON.stringify(registro)],
  ), ATOR);
}

/** Filtra a fila de um grupo em lotes. onProgresso(feitas, total) a cada lote. */
async function filtrarGrupo({ db, grupo, filtro, limite = 400, onProgresso = () => {} }) {
  const resumo = { grupo: grupo.nome, lidas: 0, mantidas: 0, descartadas: 0, repetidas: 0, erros: 0, motivos: {} };
  const fila = await filaDoFiltro(db, grupo.id, limite);
  if (!fila.length) return resumo;
  const projetos = await projetosDoGrupo(db, grupo.id);
  for (let k = 0; k < fila.length; k += LOTE) {
    const lote = fila.slice(k, k + LOTE);
    const datas = lote.map((n) => dia(n.data_original)).filter(Boolean).sort();
    const desde = datas[0] || dia(new Date());
    const ate = datas[datas.length - 1] || desde;
    const mantidas = await mantidasPerto(db, grupo.id, desde, ate, lote.map((n) => n.id));
    let decisoes;
    try {
      decisoes = fecharDecisoes(await filtro.avaliar(montarEntrada(grupo, lote, { projetos, mantidas })), lote, mantidas);
    } catch (error) {
      resumo.erros += lote.length;
      resumo.ultimo_erro = String(error.message).slice(0, 300);
      resumo.lidas += lote.length;
      onProgresso(resumo.lidas, fila.length);
      continue;
    }
    for (const [i, noticia] of lote.entries()) {
      resumo.lidas += 1;
      const decisao = decisoes.get(i);
      if (!decisao) { resumo.erros += 1; continue; }
      try {
        await gravar(noticia, decisao, filtro);
      } catch (error) {
        resumo.erros += 1;
        resumo.ultimo_erro = String(error.message).slice(0, 300);
        continue;
      }
      if (decisao.decisao === "manter") {
        resumo.mantidas += 1;
      } else {
        resumo.descartadas += 1;
        if (decisao.motivo === "repetida") resumo.repetidas += 1;
        resumo.motivos[decisao.motivo] = (resumo.motivos[decisao.motivo] || 0) + 1;
      }
    }
    onProgresso(resumo.lidas, fila.length);
  }
  return resumo;
}

module.exports = {
  ATOR,
  VERSAO,
  MODELO_PADRAO,
  MOTIVOS,
  PROMPT,
  LOTE,
  montarEntrada,
  fecharDecisoes,
  criarFiltroFinal,
  filtroFinalPadrao,
  filaDoFiltro,
  contarFila,
  filtrarGrupo,
};
