// Filtro CapEx do capex_radar: segunda passada, depois da triagem.
//
// A triagem (capex-ia.js) é larga de propósito: o Haiku lê só a manchete e
// deixa passar tudo que fala de ativo físico do grupo. O filtro relê o que
// ficou na fila "A revisar" com um modelo mais forte (CLAUDE_FILTER_MODEL,
// padrão Claude Sonnet 5.5) e uma definição rígida de CapEx, e descarta:
//   - o que não é CapEx (aquisição, reabertura, inauguração de obra pronta,
//     plano genérico, intenção de governo, máquinas/TI, fora do Brasil...);
//   - a repetição do mesmo fato (o mesmo anúncio contado por vários veículos).
//
// As notícias vão por grupo, em ordem cronológica e em lotes. Cada lote vê os
// projetos cadastrados do grupo e as manchetes que o filtro já manteve perto
// da data, para achar a repetição entre lotes. Fica na fila só uma manchete
// por fato; um fato novo do mesmo empreendimento (licença, início de obra,
// financiamento) continua, para o agente ligar ao projeto.
//
// A decisão fica em capex_radar.evidencias.filtro (sql/023). O agente só lê
// notícias que o filtro manteve, enquanto o filtro estiver ligado.
const { z } = require("zod");
const { criarCliente, pedirJson } = require("./claude");
const painel = require("./capex-painel-db");

const ATOR_FILTRO = "ia:filtro";
const VERSAO_FILTRO = "filtro-v1";
const MODELO_FILTRO_PADRAO = "claude-sonnet-5-5";
const LOTE = 25;
const JANELA_MANTIDAS_DIAS = 120;
const LIMITE_MANTIDAS = 60;
const ROTULO = "Filtro CapEx";

// Motivos de descarte. O código fica no banco; o rótulo vai para o motivo.
const MOTIVOS = {
  repetida: "repete o mesmo fato de outra notícia",
  aquisicao: "aquisição, fusão ou compra de ativo pronto",
  sem_obra: "investimento sem obra (máquinas, TI, frota, manutenção, marketing)",
  reabertura: "reabertura ou retomada de unidade existente, sem obra nova",
  concluido: "inauguração ou obra já concluída sem projeto cadastrado",
  generico: "plano ou valor agregado sem ativo identificado",
  especulacao: "intenção, estudo ou disputa por atração, sem decisão da empresa",
  nao_investimento: "não é investimento (resultado, mercado, produto, gestão, varejo)",
  outra_empresa: "outra empresa, governo ou homônimo",
  fora_brasil: "ativo fora do Brasil",
  cancelado: "cancelado ou suspenso sem projeto cadastrado",
};

const PROMPT = `Você é o filtro final de um radar de projetos de CapEx privado no Brasil. Antes de você, uma triagem rápida leu só as manchetes e deixou passar tudo que parecia investimento. O seu trabalho é ser RÍGIDO: manter apenas o que é de fato CapEx com obra e tirar as repetições. Uma notícia mantida vai para um analista; cada falso positivo custa tempo. Na dúvida entre manter e descartar, descarte, a menos que a manchete descreva claramente um ativo físico novo ou ampliado da empresa.

DEFINIÇÃO DE CAPEX PARA ESTE RADAR
CapEx é o dinheiro que a PRÓPRIA empresa do grupo (ou uma controlada) gasta para CONSTRUIR, AMPLIAR ou IMPLANTAR um ativo físico produtivo NO BRASIL, de forma que exista uma OBRA (construção civil, montagem industrial ou implantação de infraestrutura) ainda por fazer ou em andamento. O radar existe para achar oportunidades de fornecimento para essa obra.

É CapEx (manter):
- fábrica, planta, unidade industrial, frigorífico, abatedouro ou fábrica de ração nova;
- ampliação física de unidade existente: nova linha, novo galpão, aumento de capacidade com obra;
- centro de distribuição, hub logístico ou galpão novo da empresa, inclusive construído sob medida (built-to-suit) para ela;
- campus, prédio ou nova fase de data center; subestação ou linha de energia própria para o ativo;
- máquina de papel ou linha de celulose nova, caldeira de recuperação, fábrica de celulose; viveiro ou base florestal só quando ligada a uma fábrica nova;
- centro de pesquisa ou de distribuição com obra.
A notícia de um FATO do projeto também é CapEx: anúncio com decisão da empresa, licença ambiental, financiamento para a obra, terraplenagem, início ou andamento de obra, contratação de construtora.

NÃO é CapEx (descartar):
- aquisição, fusão, compra de participação, compra de planta, frigorífico ou empresa já em operação, arrendamento de unidade pronta (motivo aquisicao);
- compra de máquinas, equipamentos, frota, caminhões, TI, software, automação, manutenção ou modernização sem obra; marketing; P&D sem prédio novo (motivo sem_obra);
- reabertura, retomada, religamento ou recuperação de unidade que já existia (após enchente, incêndio, paralisação), quando não há ampliação com obra (motivo reabertura);
- inauguração, abertura, entrada em operação ou obra concluída de um empreendimento que NÃO aparece em projetos nem em mantidas (motivo concluido). O radar quer obra por fazer; a inauguração de algo que nunca vimos ser construído chega tarde. Isso vale para todos os nichos;
- abrir, inaugurar ou "instalar-se" em centro de distribuição, hub, galpão ou centro logístico sem sinal de construção: em geral é ocupar galpão alugado e pronto (motivo concluido se já abriu; sem_obra se é só ocupação, hub de última milha, ponto de coleta ou loja). Mantenha CD ou galpão só quando a manchete fala de construir, obra, terreno, terraplenagem, built-to-suit ou um investimento em reais ligado a esse CD;
- plano de investimento agregado ("investirá R$ 15 bi no Brasil até 2026", "R$ 1 bilhão em 2024") sem uma unidade, cidade ou obra identificada (motivo generico);
- intenção sem decisão da empresa: governo quer atrair, governador busca, empresa "estuda", "avalia", "negocia incentivo", "pode instalar" (motivo especulacao);
- resultado, ações, dívida, dividendos, produto, lançamento, promoção, loja, varejo, contratação de executivo, processo judicial, prêmio, ESG sem obra (motivo nao_investimento);
- ativo de outra empresa, de fornecedor, de cliente ou de governo; homônimo (motivo outra_empresa);
- ativo fora do Brasil (motivo fora_brasil);
- cancelamento ou suspensão quando não há projeto cadastrado (motivo cancelado).

REPETIÇÃO
Várias manchetes contam o MESMO FATO: o mesmo anúncio, a mesma licença, o mesmo início de obra, publicados por veículos diferentes em poucos dias ou semanas. Mantenha só UMA manchete por fato e descarte as outras com motivo repetida, apontando em repete a manchete mantida.
- Dentro do lote: mantenha a mais completa (com valor, município ou estágio) e marque as outras como repetida com repete = "i:<número do item mantido>".
- Contra as manchetes já mantidas (lista mantidas, itens com id): se o item conta o mesmo fato de uma delas, é repetida com repete = "id:<id>".
- Fato NOVO do mesmo empreendimento (anúncio em junho, licença em setembro, início de obra no ano seguinte) NÃO é repetição: mantenha, porque é a linha do tempo do projeto.
- Conclusão, inauguração ou reabertura de um empreendimento que JÁ aparece em mantidas ou em projetos (ex.: a unidade ampliada que reabre) é fato do projeto: mantenha uma manchete desse fato e marque as demais do mesmo fato como repetida. Sem o empreendimento em mantidas ou projetos, valem os motivos concluido e reabertura.
- A lista mantidas inclui as manchetes já ligadas a projetos. Se o item conta o mesmo fato de uma delas, é repetida. Fato novo de um empreendimento da lista projetos: mantenha (o agente liga ao projeto).

ANTES DE RESPONDER, agrupe os itens do lote por fato e dê a cada item um rótulo fato curto e padronizado: empreendimento + local + tipo do fato (ex.: "CD Goiânia - inauguração", "frigorífico Diamantino - anúncio ampliação", "fábrica ração Seberi - anúncio"). Itens com o mesmo fato recebem exatamente o mesmo rótulo. Cada rótulo tem no máximo UM item manter; os outros são repetida apontando para ele.

Para cada item do lote responda: i, fato (o rótulo), decisao ("manter" ou "descartar"), motivo (null se manter; senão um código da lista), repete (só para motivo repetida; senão null) e justificativa (uma frase curta citando o que decide).
Códigos de motivo: ${Object.keys(MOTIVOS).join(", ")}.

Responda somente com JSON: {"itens":[{"i":0,"fato":"...","decisao":"manter","motivo":null,"repete":null,"justificativa":"..."}]}, com um elemento por item recebido.`;

const itemSchema = z.object({
  i: z.number().int().nonnegative(),
  fato: z.string().trim().max(200).nullable().optional().catch(null),
  decisao: z.enum(["manter", "descartar"]),
  motivo: z.enum(Object.keys(MOTIVOS)).nullable().optional().catch(null),
  repete: z.string().trim().nullable().optional().catch(null),
  justificativa: z.string().trim().min(1).max(600).catch("sem justificativa"),
});
const saidaSchema = z.object({ itens: z.array(itemSchema) });

function dia(valor) {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Monta a mensagem de um lote. */
function montarEntrada(grupo, lote, { projetos = [], mantidas = [] } = {}) {
  return {
    grupo: grupo.nome,
    nicho: grupo.nicho,
    projetos: projetos.map((p) => ({
      titulo: p.titulo, uf: p.uf || null, municipio: p.municipio || null, estagio: p.estagio || null,
    })),
    mantidas: mantidas.map((m) => ({ id: String(m.id), data: dia(m.data_original), titulo: m.titulo })),
    itens: lote.map((n, i) => ({
      i,
      data: dia(n.data_original),
      titulo: n.titulo,
      veiculo: n.veiculo || null,
      leitura_triagem: n.extracao
        ? {
          objeto: n.extracao.objeto ?? null,
          uf: n.extracao.uf ?? null,
          municipio: n.extracao.municipio ?? null,
          valor_brl: n.extracao.valor_brl ?? null,
          estagio: n.extracao.estagio ?? null,
        }
        : null,
    })),
  };
}

/**
 * Valida a resposta e fecha a decisão de cada item do lote.
 * Regras que não dependem do modelo:
 *   - item sem resposta fica sem decisão (volta na próxima rodada);
 *   - descartar sem motivo válido vira manter (o filtro só tira com motivo);
 *   - repetida precisa apontar para um item mantido do lote ou para uma
 *     manchete da lista mantidas; senão, vira manter;
 *   - repetida de repetida segue a cadeia até a manchete mantida.
 * Devolve Map índice → { decisao, motivo, repete_id, repete_titulo, justificativa }.
 */
function fecharDecisoes(raw, lote, mantidas = []) {
  if (!raw) throw new Error("O modelo não retornou conteúdo");
  const { itens } = saidaSchema.parse(JSON.parse(raw));
  const respostas = new Map();
  for (const item of itens) {
    if (item.i < lote.length && !respostas.has(item.i)) respostas.set(item.i, item);
  }
  const porId = new Map(mantidas.map((m) => [String(m.id), m]));

  function alvoNoLote(item, visitados = new Set()) {
    const ref = String(item.repete || "").match(/^i\s*:\s*(\d+)$/i);
    if (!ref) return null;
    const j = Number(ref[1]);
    if (j === item.i || visitados.has(j) || !respostas.has(j)) return null;
    const outro = respostas.get(j);
    if (outro.decisao === "manter") return j;
    if (outro.motivo === "repetida") {
      visitados.add(item.i);
      // a cadeia pode terminar no lote ou numa manchete já mantida
      const viaId = String(outro.repete || "").match(/^id\s*:\s*(.+)$/i);
      if (viaId && porId.has(viaId[1].trim())) return { id: viaId[1].trim() };
      return alvoNoLote(outro, visitados);
    }
    return null;
  }

  const decisoes = new Map();
  for (const [i, item] of respostas) {
    const base = { justificativa: item.justificativa };
    if (item.decisao === "manter" || !item.motivo) {
      decisoes.set(i, { ...base, decisao: "manter", motivo: null, repete_id: null, repete_titulo: null });
      continue;
    }
    if (item.motivo !== "repetida") {
      decisoes.set(i, { ...base, decisao: "descartar", motivo: item.motivo, repete_id: null, repete_titulo: null });
      continue;
    }
    const viaId = String(item.repete || "").match(/^id\s*:\s*(.+)$/i);
    let alvo = null;
    if (viaId && porId.has(viaId[1].trim())) {
      const m = porId.get(viaId[1].trim());
      alvo = { id: String(m.id), titulo: m.titulo };
    } else {
      const j = alvoNoLote(item);
      if (typeof j === "number") alvo = { id: String(lote[j].id), titulo: lote[j].titulo };
      else if (j?.id) alvo = { id: j.id, titulo: porId.get(j.id).titulo };
    }
    decisoes.set(i, alvo
      ? { ...base, decisao: "descartar", motivo: "repetida", repete_id: alvo.id, repete_titulo: alvo.titulo }
      : { ...base, decisao: "manter", motivo: null, repete_id: null, repete_titulo: null,
        ajuste: "repetida sem manchete mantida válida; mantida" });
  }
  // Mesmo fato, mesmo veredito. Se o modelo descartou um item do fato por um
  // motivo de mérito (concluido, sem_obra...), os itens mantidos com o mesmo
  // rótulo seguem esse descarte. Depois, um fato, uma manchete: se ficaram
  // dois itens mantidos com o mesmo rótulo, fica o primeiro e os outros viram
  // repetida dele.
  const normal = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const ordem = [...decisoes.keys()].sort((a, b) => a - b);
  const descartePorFato = new Map();
  for (const i of ordem) {
    const d = decisoes.get(i);
    d.fato = respostas.get(i)?.fato || null;
    const fato = normal(d.fato);
    if (fato && d.decisao === "descartar" && d.motivo !== "repetida" && !descartePorFato.has(fato)) {
      descartePorFato.set(fato, d.motivo);
    }
  }
  for (const i of ordem) {
    const d = decisoes.get(i);
    const motivo = descartePorFato.get(normal(d.fato));
    if (d.decisao === "manter" && motivo) {
      decisoes.set(i, { ...d, decisao: "descartar", motivo, ajuste: `mesmo fato de item descartado como ${motivo}` });
    }
  }
  const primeiroPorFato = new Map();
  for (const i of ordem) {
    const d = decisoes.get(i);
    const fato = normal(d.fato);
    if (d.decisao !== "manter" || !fato) continue;
    if (!primeiroPorFato.has(fato)) { primeiroPorFato.set(fato, i); continue; }
    const j = primeiroPorFato.get(fato);
    decisoes.set(i, {
      ...d, decisao: "descartar", motivo: "repetida", repete_id: String(lote[j].id), repete_titulo: lote[j].titulo,
      ajuste: "mesmo fato de outro item mantido no lote",
    });
  }
  return decisoes;
}

/** Texto do motivo gravado em triagem_motivo. */
function motivoTexto(decisao) {
  const rotulo = MOTIVOS[decisao.motivo] || decisao.motivo;
  if (decisao.motivo === "repetida" && decisao.repete_titulo) {
    return `${rotulo}: “${decisao.repete_titulo.slice(0, 140)}”`;
  }
  return rotulo;
}

function criarFiltro({ client, modelo = MODELO_FILTRO_PADRAO, esforco = "medium" }) {
  return {
    modelo,
    async avaliar(entrada) {
      return pedirJson(client, {
        model: modelo,
        system: PROMPT,
        user: JSON.stringify(entrada),
        maxTokens: 16000,
        effort: esforco,
        thinking: null, // padrão do modelo: o Sonnet pensa antes de decidir o lote
      });
    },
  };
}

// CAPEX_FILTRO=0 desliga o filtro (a fila volta a ir direto para o agente).
function filtroLigado() {
  return !/^(0|false|no|off)$/i.test(process.env.CAPEX_FILTRO?.trim() || "");
}

/** Filtro do .env: CLAUDE_API_KEY e CLAUDE_FILTER_MODEL. Sem chave ou desligado, null. */
function filtroPadrao() {
  if (!filtroLigado()) return null;
  const { getConfig } = require("./config");
  const config = getConfig();
  const client = criarCliente(config.claudeApiKey);
  return client ? criarFiltro({ client, modelo: config.claudeFilterModel }) : null;
}

/** Condição SQL (alias e) para o agente: só o que o filtro manteve, se ele estiver ligado. */
function condicaoAgente() {
  return filtroLigado() ? "(e.filtro->>'decisao' = 'manter')" : "true";
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------

const SEM_FILTRO = `(e.filtro is null or e.filtro->>'versao' is distinct from '${VERSAO_FILTRO}')`;

/** Notícias da fila "A revisar" do grupo que esta versão do filtro não leu. */
async function filaDoFiltro(db, grupoId, limite = 400) {
  const { rows } = await db.query(
    `select e.id, e.titulo, e.veiculo, e.data_original, e.extracao
       from capex_radar.evidencias e
      where e.grupo_id = $1 and ${painel.FILTRO_SITUACAO.revisar} and ${SEM_FILTRO}
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
      where e.grupo_id = any($1::uuid[]) and ${painel.FILTRO_SITUACAO.revisar} and ${SEM_FILTRO}
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

/** Manchetes que seguem vivas (mantidas pelo filtro, vinculadas ou com projeto) perto das datas do lote. */
async function mantidasPerto(db, grupoId, desde, ate, excluir) {
  const { rows } = await db.query(
    `select e.id, e.titulo, e.data_original
       from capex_radar.evidencias e
      where e.grupo_id = $1 and e.data_original is not null
        and e.data_original between ($2::date - $4::int) and ($3::date + $4::int)
        and not (e.id = any($5::uuid[]))
        and (e.filtro->>'decisao' = 'manter' or e.triagem = 'vinculada'
             or exists (select 1 from capex_radar.evidencia_projeto ep where ep.evidencia_id = e.id and ep.situacao = 'aceito'))
      order by e.data_original desc
      limit $6`,
    [grupoId, desde, ate, JANELA_MANTIDAS_DIAS, excluir, LIMITE_MANTIDAS],
  );
  return rows;
}

async function gravar(noticia, decisao, filtro) {
  const registro = {
    versao: VERSAO_FILTRO,
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
    await painel.descartarNoticia(noticia.id, motivoTexto(decisao), { ator: ATOR_FILTRO, rotulo: ROTULO });
  }
  await painel.emTransacao((client) => client.query(
    "update capex_radar.evidencias set filtro = $2::jsonb where id = $1",
    [noticia.id, JSON.stringify(registro)],
  ), ATOR_FILTRO);
}

/**
 * Filtra a fila de um grupo. simular=true só devolve as decisões, sem gravar.
 * onProgresso(feitas, total) é chamado a cada lote.
 */
async function filtrarGrupo({ db, grupo, filtro, limite = 400, simular = false, onProgresso = () => {} }) {
  const resumo = { grupo: grupo.nome, lidas: 0, mantidas: 0, descartadas: 0, repetidas: 0, erros: 0, motivos: {}, decisoes: [] };
  const fila = await filaDoFiltro(db, grupo.id, limite);
  if (!fila.length) return resumo;
  const projetos = await projetosDoGrupo(db, grupo.id);
  // No modo simulação nada é gravado: as mantidas do próprio rodada entram aqui.
  const mantidasDaRodada = [];
  for (let k = 0; k < fila.length; k += LOTE) {
    const lote = fila.slice(k, k + LOTE);
    const datas = lote.map((n) => dia(n.data_original)).filter(Boolean).sort();
    const desde = datas[0] || dia(new Date());
    const ate = datas[datas.length - 1] || desde;
    let mantidas = await mantidasPerto(db, grupo.id, desde, ate, lote.map((n) => n.id));
    if (simular) {
      const ids = new Set(mantidas.map((m) => String(m.id)));
      mantidas = [...mantidas, ...mantidasDaRodada.filter((m) => !ids.has(String(m.id)))].slice(-LIMITE_MANTIDAS);
    }
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
      if (!simular) {
        try {
          await gravar(noticia, decisao, filtro);
        } catch (error) {
          resumo.erros += 1;
          resumo.ultimo_erro = String(error.message).slice(0, 300);
          continue;
        }
      }
      if (decisao.decisao === "manter") {
        resumo.mantidas += 1;
        mantidasDaRodada.push({ id: noticia.id, titulo: noticia.titulo, data_original: noticia.data_original });
      } else {
        resumo.descartadas += 1;
        if (decisao.motivo === "repetida") resumo.repetidas += 1;
        resumo.motivos[decisao.motivo] = (resumo.motivos[decisao.motivo] || 0) + 1;
      }
      if (simular) resumo.decisoes.push({ data: dia(noticia.data_original), titulo: noticia.titulo, ...decisao });
    }
    onProgresso(resumo.lidas, fila.length);
  }
  return resumo;
}

module.exports = {
  ATOR_FILTRO,
  VERSAO_FILTRO,
  MODELO_FILTRO_PADRAO,
  MOTIVOS,
  PROMPT,
  LOTE,
  montarEntrada,
  fecharDecisoes,
  motivoTexto,
  criarFiltro,
  filtroLigado,
  filtroPadrao,
  condicaoAgente,
  filaDoFiltro,
  contarFila,
  filtrarGrupo,
};
