// Avaliação dos projetos da carteira (capex_radar).
//
// Os projetos nasceram de notícias aprovadas ou do agente, muitas vezes só com
// a manchete. Aqui um modelo relê cada empresa de uma vez: todos os projetos
// não descartados, cada um com as notícias ligadas a ele já enriquecidas
// (resumo, perfil e trechos do texto da matéria). Para cada projeto decide:
//   - valido: segue na carteira, com correções de objeto, local, valor,
//     estágio e data tiradas das notícias;
//   - invalido: não é um projeto de CapEx do grupo (motivos do Filtro 3);
//   - duplicado: o mesmo empreendimento de outro projeto válido do grupo.
//
// Aplicação:
//   - valido: preenche os campos vazios com as correções e atualiza o
//     estágio quando as notícias mostram outro; status e título não mudam;
//   - invalido: status 'descartado';
//   - duplicado: as notícias aceitas são ligadas também ao projeto que fica
//     e o duplicado vai para 'descartado'.
// O status anterior fica em projetos.avaliacao.status_anterior; a tela pode
// desfazer. Antes de avaliar, as notícias dos projetos sem enriquecimento
// passam pelo Enriquecimento (capex-enriquecimento.js).
const { z } = require("zod");
const { criarCliente, pedirJson } = require("./claude");
const { ESTAGIOS } = require("./capex-ia");
const enriquecimento = require("./capex-enriquecimento");
const filtroFinal = require("./capex-filtro-final");
const painel = require("./capex-painel-db");

const ATOR = "ia:avaliacao";
const VERSAO = "avaliacao-v1";
const MODELO_PADRAO = "claude-sonnet-5-5";
const NOTICIAS_POR_PROJETO = 8;

const MOTIVOS = Object.fromEntries(Object.entries(filtroFinal.MOTIVOS).filter(([codigo]) => codigo !== "repetida"));

const PROMPT = `Você revisa a carteira de um radar de projetos de CapEx privado no Brasil. Recebe TODOS os projetos de um grupo empresarial que estão na carteira, cada um com as notícias ligadas a ele. As notícias foram enriquecidas: trazem o resumo, o perfil do projeto e trechos copiados do texto da matéria. Muitos projetos nasceram só da manchete e podem estar errados.

O QUE O RADAR QUER
Um investimento da PRÓPRIA empresa do grupo (ou controlada) para CONSTRUIR, AMPLIAR ou IMPLANTAR um ativo físico produtivo NO BRASIL, com OBRA por fazer ou em andamento quando foi anunciado: fábrica, ampliação com obra, nova linha, centro de distribuição construído para a empresa, data center, caldeira, máquina de papel, linha de celulose, terminal, subestação própria. Um projeto que já entrou em operação continua válido se a carteira acompanhou a obra (há notícias de anúncio, licença ou obra antes da inauguração).

PARA CADA PROJETO decida:
- "valido": é um projeto assim. Corrija o que as notícias mostram melhor (objeto, uf, municipio, valor_brl, estagio, data_anuncio, titulo).
- "invalido": não é um projeto de CapEx do grupo. Use um motivo: ${Object.entries(MOTIVOS).map(([c, d]) => `${c} (${d})`).join("; ")}.
- "duplicado": é o MESMO empreendimento de outro projeto da lista (mesmo ativo e mesmo local, ainda que com títulos, valores ou estágios diferentes). Aponte em duplicado_de o número p do projeto que fica, que deve ser "valido". Fica o projeto com mais notícias e dados mais completos. Fases diferentes de um mesmo complexo (ex.: a fábrica e o acesso rodoviário dela) são projetos distintos só quando a obra é distinta e relevante por si; na dúvida, é duplicado.
Decida pelo que as notícias dizem, não pela manchete do projeto. Na dúvida entre valido e invalido, mantenha valido e explique a dúvida na justificativa.

CORREÇÕES (só para valido; null no que não muda)
- titulo: "<Grupo> — <ativo> em <município>" quando o título atual estiver vago ou errado.
- objeto, uf (sigla), municipio, valor_brl (número inteiro em reais; o valor do projeto, não um plano agregado), data_anuncio (AAAA-MM-DD do primeiro anúncio).
- estagio: o estágio mais avançado que as notícias mostram, um de ${ESTAGIOS.join(", ")}.

Responda para cada projeto: p, decisao, motivo (null se valido ou duplicado), duplicado_de (só para duplicado), justificativa (uma ou duas frases citando as notícias) e correcoes.
Responda somente com JSON: {"projetos":[{"p":0,"decisao":"valido","motivo":null,"duplicado_de":null,"justificativa":"...","correcoes":{"titulo":null,"objeto":null,"uf":null,"municipio":null,"valor_brl":null,"estagio":null,"data_anuncio":null}}]}, um elemento por projeto recebido.`;

const correcoesSchema = z.object({
  titulo: z.string().trim().min(3).max(200).nullable().optional().catch(null),
  objeto: z.string().trim().min(2).max(200).nullable().optional().catch(null),
  uf: z.string().trim().length(2).transform((v) => v.toUpperCase()).nullable().optional().catch(null),
  municipio: z.string().trim().min(2).max(120).nullable().optional().catch(null),
  valor_brl: z.number().positive().nullable().optional().catch(null),
  estagio: z.enum(ESTAGIOS).nullable().optional().catch(null),
  data_anuncio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().catch(null),
}).catch({});

const saidaSchema = z.object({
  projetos: z.array(z.object({
    p: z.number().int().nonnegative(),
    decisao: z.enum(["valido", "invalido", "duplicado"]),
    motivo: z.enum(Object.keys(MOTIVOS)).nullable().optional().catch(null),
    duplicado_de: z.union([z.number().int(), z.string()]).nullable().optional().catch(null),
    justificativa: z.string().trim().min(1).max(800).catch("sem justificativa"),
    correcoes: correcoesSchema.nullable().optional(),
  })),
});

function dia(valor) {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Mensagem de um grupo: os projetos, cada um com até NOTICIAS_POR_PROJETO notícias. */
function montarEntrada(grupo, projetos) {
  return {
    grupo: grupo.nome,
    nicho: grupo.nicho,
    projetos: projetos.map((p, i) => ({
      p: i,
      titulo: p.titulo,
      objeto: p.objeto || null,
      uf: p.uf || null,
      municipio: p.municipio || null,
      valor_brl: p.valor_estimado_brl == null ? null : Number(p.valor_estimado_brl),
      estagio: p.estagio,
      data_anuncio: dia(p.data_anuncio),
      noticias: (p.noticias || []).slice(0, NOTICIAS_POR_PROJETO).map((n) => {
        const en = n.enriquecimento || {};
        return {
          data: dia(n.data_original),
          titulo: n.titulo,
          veiculo: n.veiculo || null,
          materia_lida: Boolean(en.encontrou),
          resumo: en.resumo || null,
          perfil: en.perfil
            ? Object.fromEntries(Object.entries(en.perfil).filter(([c, v]) => c !== "filial_sugerida" && v !== null))
            : null,
          trechos: (en.trechos || []).slice(0, 2),
          observacao: en.observacao || null,
        };
      }),
      total_noticias: (p.noticias || []).length,
    })),
  };
}

/**
 * Valida a resposta e fecha as decisões. Regras que não dependem do modelo:
 *   - projeto sem resposta fica sem decisão (volta na próxima rodada);
 *   - invalido sem motivo válido vira valido;
 *   - duplicado precisa apontar para outro projeto da lista que ficou valido
 *     (a cadeia de duplicados é seguida); senão vira valido.
 * Devolve Map índice → { decisao, motivo, duplicado_de (índice), justificativa, correcoes, ajuste? }.
 */
function fecharDecisoes(raw, projetos) {
  if (!raw) throw new Error("O modelo não retornou conteúdo");
  const { projetos: itens } = saidaSchema.parse(JSON.parse(raw));
  const respostas = new Map();
  for (const item of itens) if (item.p < projetos.length && !respostas.has(item.p)) respostas.set(item.p, item);
  const indice = (v) => {
    const m = String(v ?? "").match(/(\d+)/);
    return m ? Number(m[1]) : null;
  };
  function alvo(i, visitados = new Set()) {
    const item = respostas.get(i);
    const j = indice(item.duplicado_de);
    if (j === null || j === i || visitados.has(j) || !respostas.has(j)) return null;
    const outro = respostas.get(j);
    if (outro.decisao === "valido") return j;
    if (outro.decisao === "duplicado") { visitados.add(i); return alvo(j, visitados); }
    return null;
  }
  const decisoes = new Map();
  for (const [i, item] of respostas) {
    const base = { justificativa: item.justificativa, correcoes: {}, motivo: null, duplicado_de: null };
    if (item.decisao === "invalido" && item.motivo) {
      decisoes.set(i, { ...base, decisao: "invalido", motivo: item.motivo });
    } else if (item.decisao === "duplicado") {
      const j = alvo(i);
      decisoes.set(i, j === null
        ? { ...base, decisao: "valido", correcoes: item.correcoes || {}, ajuste: "duplicado sem projeto válido de referência; mantido" }
        : { ...base, decisao: "duplicado", duplicado_de: j });
    } else {
      decisoes.set(i, {
        ...base,
        decisao: "valido",
        correcoes: item.correcoes || {},
        ...(item.decisao === "invalido" ? { ajuste: "invalido sem motivo; mantido" } : {}),
      });
    }
  }
  return decisoes;
}

const ORDEM_ESTAGIO = ["anuncio", "licenciamento", "funding", "contratacao_epc", "mobilizacao", "operacao"];
const ordemEstagio = (estagio) => ORDEM_ESTAGIO.indexOf(estagio);

/** Campos do projeto que a decisão muda (só para valido). */
function camposAplicados(projeto, decisao) {
  if (decisao.decisao !== "valido") return {};
  const c = decisao.correcoes || {};
  const campos = {};
  if (c.objeto && !projeto.objeto) campos.objeto = c.objeto;
  if (c.uf && !projeto.uf) campos.uf = c.uf;
  if (c.municipio && !projeto.municipio && (!projeto.uf || !c.uf || c.uf === projeto.uf)) campos.municipio = c.municipio;
  if (c.valor_brl && projeto.valor_estimado_brl == null) campos.valor_estimado_brl = c.valor_brl;
  if (c.data_anuncio && !projeto.data_anuncio) campos.data_anuncio = c.data_anuncio;
  // O estágio só avança (ou vai para desaceleração ou cancelamento): a
  // avaliação não desfaz um estágio que a revisão já registrou.
  if (c.estagio && c.estagio !== projeto.estagio
      && (["desaceleracao", "cancelado"].includes(c.estagio) || ordemEstagio(c.estagio) > ordemEstagio(projeto.estagio))) {
    campos.estagio = c.estagio;
  }
  return campos;
}

function criarAvaliador({ client, modelo = MODELO_PADRAO, esforco = "medium" }) {
  return {
    modelo,
    async avaliar(entrada) {
      return pedirJson(client, {
        etapa: "avaliacao",
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

function avaliadorPadrao() {
  const { getConfig } = require("./config");
  const config = getConfig();
  const client = criarCliente(config.claudeApiKey);
  return client ? criarAvaliador({ client, modelo: config.claudeFilter3Model }) : null;
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------

async function projetosDoGrupo(db, grupoId) {
  const { rows: projetos } = await db.query(
    `select p.id, p.titulo, p.objeto, p.uf, p.municipio, p.valor_estimado_brl, p.estagio, p.status,
            p.data_anuncio, p.avaliacao
       from capex_radar.projetos p
      where p.grupo_id = $1 and p.status <> 'descartado'
      order by p.criado_em`,
    [grupoId],
  );
  if (!projetos.length) return [];
  const { rows: noticias } = await db.query(
    `select ep.projeto_id, e.id, e.titulo, e.veiculo, e.url, e.data_original, e.extracao, e.enriquecimento
       from capex_radar.evidencia_projeto ep
       join capex_radar.evidencias e on e.id = ep.evidencia_id
      where ep.projeto_id = any($1::uuid[]) and ep.situacao = 'aceito'
      order by e.data_original nulls last`,
    [projetos.map((p) => p.id)],
  );
  for (const p of projetos) p.noticias = noticias.filter((n) => n.projeto_id === p.id);
  return projetos;
}

/** Notícias aceitas dos projetos do grupo que ainda não foram enriquecidas. */
function semEnriquecimento(projetos) {
  const vistas = new Set();
  const lista = [];
  for (const p of projetos) {
    for (const n of p.noticias) {
      if (n.enriquecimento || vistas.has(n.id)) continue;
      vistas.add(n.id);
      lista.push(n);
    }
  }
  return lista;
}

async function gravar(projeto, decisao, alvo, avaliador) {
  const campos = camposAplicados(projeto, decisao);
  const registro = {
    versao: VERSAO,
    modelo: avaliador.modelo,
    decisao: decisao.decisao,
    motivo: decisao.motivo,
    duplicado_de: alvo ? { id: alvo.id, titulo: alvo.titulo } : null,
    justificativa: decisao.justificativa,
    correcoes: decisao.correcoes,
    aplicado: campos,
    ...(decisao.ajuste ? { ajuste: decisao.ajuste } : {}),
    status_anterior: projeto.status,
    em: new Date().toISOString(),
  };
  await painel.emTransacao(async (client) => {
    if (decisao.decisao === "duplicado") {
      await client.query(
        `insert into capex_radar.evidencia_projeto
           (evidencia_id, projeto_id, origem, situacao, motivo, modelo, revisado_por, revisado_em)
         select ep.evidencia_id, $2, 'ia', 'aceito', $3, $4, $5, now()
           from capex_radar.evidencia_projeto ep
          where ep.projeto_id = $1 and ep.situacao = 'aceito'
         on conflict (evidencia_id, projeto_id) do nothing`,
        [projeto.id, alvo.id, `Avaliação da carteira: veio do projeto duplicado "${projeto.titulo}"`.slice(0, 300), avaliador.modelo, ATOR],
      );
    }
    const sets = ["avaliacao = $2::jsonb"];
    const valores = [projeto.id, JSON.stringify(registro)];
    if (decisao.decisao !== "valido") sets.push("status = 'descartado'");
    for (const [campo, valor] of Object.entries(campos)) {
      valores.push(valor);
      sets.push(`${campo} = $${valores.length}`);
    }
    if (campos.valor_estimado_brl) sets.push("fonte_valor = coalesce(fonte_valor, 'noticia')");
    await client.query(`update capex_radar.projetos set ${sets.join(", ")}, atualizado_em = now() where id = $1`, valores);
  }, ATOR);
  return registro;
}

/**
 * Avalia os projetos de um grupo. Enriquece antes as notícias que faltam
 * (enriquecedor null pula essa parte). simular=true só devolve as decisões.
 * Grupo em que todos os projetos já têm a avaliação desta versão é pulado,
 * a não ser com refazer=true.
 */
async function avaliarGrupo({ db, grupo, avaliador, enriquecedor = null, simular = false, refazer = false }) {
  const resumo = { grupo: grupo.nome, projetos: 0, validos: 0, invalidos: 0, duplicados: 0, alterados: 0, enriquecidas: 0, erros: 0, decisoes: [] };
  let projetos = await projetosDoGrupo(db, grupo.id);
  if (!projetos.length) return resumo;
  if (!refazer && projetos.every((p) => p.avaliacao?.versao === VERSAO)) return resumo;
  const faltam = semEnriquecimento(projetos);
  if (enriquecedor && faltam.length) {
    const r = await enriquecimento.enriquecerLista({ db, grupo, enriquecedor, noticias: faltam });
    resumo.enriquecidas = r.enriquecidas + r.sem_materia;
    resumo.erros_enriquecimento = r.erros;
    projetos = await projetosDoGrupo(db, grupo.id);
  }
  resumo.projetos = projetos.length;
  let decisoes;
  try {
    decisoes = fecharDecisoes(await avaliador.avaliar(montarEntrada(grupo, projetos)), projetos);
  } catch (error) {
    resumo.erros = projetos.length;
    resumo.ultimo_erro = String(error.message).slice(0, 300);
    return resumo;
  }
  for (const [i, projeto] of projetos.entries()) {
    const decisao = decisoes.get(i);
    if (!decisao) { resumo.erros += 1; continue; }
    const alvo = decisao.duplicado_de === null ? null : projetos[decisao.duplicado_de];
    const campos = camposAplicados(projeto, decisao);
    resumo.decisoes.push({ titulo: projeto.titulo, status: projeto.status, ...decisao, duplicado_de: alvo?.titulo || null, aplicado: campos });
    if (!simular) {
      try {
        await gravar(projeto, decisao, alvo, avaliador);
      } catch (error) {
        resumo.erros += 1;
        resumo.ultimo_erro = String(error.message).slice(0, 300);
        continue;
      }
    }
    if (decisao.decisao === "valido") resumo.validos += 1;
    if (decisao.decisao === "invalido") resumo.invalidos += 1;
    if (decisao.decisao === "duplicado") resumo.duplicados += 1;
    if (Object.keys(campos).length) resumo.alterados += 1;
  }
  return resumo;
}

/** Desfaz o descarte de uma avaliação: o projeto volta ao status anterior. */
async function restaurarProjeto(id) {
  return painel.emTransacao(async (client) => {
    const { rows: [p] } = await client.query(
      `update capex_radar.projetos
          set status = coalesce(avaliacao->>'status_anterior', 'em_revisao'),
              avaliacao = avaliacao || jsonb_build_object('desfeita_em', now()),
              atualizado_em = now()
        where id = $1 and status = 'descartado' and avaliacao is not null
        returning id, titulo`,
      [id],
    );
    return p || null;
  });
}

module.exports = {
  ATOR,
  VERSAO,
  MOTIVOS,
  PROMPT,
  montarEntrada,
  fecharDecisoes,
  camposAplicados,
  criarAvaliador,
  avaliadorPadrao,
  projetosDoGrupo,
  semEnriquecimento,
  avaliarGrupo,
  restaurarProjeto,
};
