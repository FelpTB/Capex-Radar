// Enriquecimento (fase 4) do capex_radar: as notícias que passaram pelo
// Filtro 2 ganham o texto da matéria e um perfil do projeto.
//
// A coleta guarda só a manchete e o link do Google News, que não abre a
// matéria (é uma página de redirecionamento em JavaScript). Por isso o
// modelo recebe as ferramentas de busca e de leitura de páginas da API do
// Claude: acha a matéria original pelo título, pelo veículo e pela data, lê o
// texto e devolve o perfil (objeto, local, valor, estágio, datas, obra,
// construtora, financiamento) com até três trechos que sustentam a leitura.
//
// O perfil fica em capex_radar.evidencias.enriquecimento (sql/024) e alimenta
// o Filtro 3 e a aprovação (o projeto nasce com os dados do texto, não só os
// da manchete). Matéria não encontrada também é gravada (encontrou=false),
// para o Filtro 3 decidir com o que houver e a notícia não voltar à fila.
const { z } = require("zod");
const { criarCliente, pedirJsonComFerramentas } = require("./claude");
const { ESTAGIOS } = require("./capex-ia");
const { sugerirFilial } = require("./capex-coletor");
const painel = require("./capex-painel-db");
const fases = require("./capex-fases");

const ATOR = "ia:enriquecimento";
const VERSAO = "enriquecimento-v1";
const MODELO_PADRAO = "claude-sonnet-5-5";
const PARALELO = 3;
// Custo: o resultado da busca e a página lida entram como tokens de entrada,
// e cada volta (pause_turn) reenvia a conversa inteira. Em 10/11/2026 a fila
// da carga histórica (346 notícias, até 3 buscas e 4 voltas cada) gastou
// ~13 mi de tokens no Sonnet. Uma busca, uma leitura curta e três voltas
// bastam para achar a matéria pelo título.
const MAX_BUSCAS = 1;
const MAX_LEITURAS = 1;
const MAX_TOKENS_PAGINA = 5000;
const MAX_VOLTAS = 3;

const NICHOS = {
  papel_celulose: "papel e celulose",
  alimentos_bebidas: "alimentos e bebidas",
  ecommerce: "e-commerce",
  datacenter: "datacenters",
};

const OBRA = ["por_fazer", "em_andamento", "concluida", "sem_obra", "incerto"];

const PROMPT = `Você enriquece notícias de um radar de projetos de CapEx privado no Brasil. Cada notícia já passou por dois filtros e provavelmente fala de um investimento com obra (fábrica, ampliação, centro de distribuição, data center, linha de produção) de uma empresa do grupo informado. Você recebe a manchete, o veículo, a data e o link do Google News, que em geral NÃO abre a matéria.

O QUE FAZER
1. Ache a matéria original: busque pela manchete (entre aspas, se ajudar) e pelo veículo. Se não achar a do veículo, uma matéria de outro veículo sobre o MESMO fato serve. Leia a página com a ferramenta de leitura.
2. Leia o texto e preencha o perfil do projeto só com o que está escrito nele. Não invente, não complete com conhecimento próprio, não junte fatos de outras épocas. O que o texto não diz fica null.
3. Faça no máximo ${MAX_BUSCAS} busca e ${MAX_LEITURAS} leitura de página: busque a manchete uma vez e leia o melhor resultado. Se a busca já trouxer o texto do fato, não leia página. Se não achar a matéria, devolva encontrou=false e preencha o perfil só com o que a manchete diz.

CAMPOS
- encontrou: true se leu o texto de uma matéria sobre o fato.
- url_original: endereço da matéria lida (null se não achou). veiculo_original: nome do veículo dessa matéria.
- resumo: 2 a 4 frases em português com o fato e os números principais.
- empresa: quem faz o investimento, como escrito no texto. mesmo_grupo: true se é o grupo informado ou uma controlada dele; false se é outra empresa (fornecedor, cliente, governo, homônimo).
- objeto: o ativo (ex.: "fábrica de celulose", "ampliação do frigorífico", "centro de distribuição"). tipo_ativo: uma palavra (fabrica, ampliacao, centro_distribuicao, data_center, linha_producao, florestal, energia, outro).
- uf: sigla do estado; municipio: cidade; local_detalhe: distrito, rodovia ou bairro, se houver.
- valor_brl: valor do investimento em reais, número inteiro (R$ 1,2 bilhão = 1200000000). Valor em dólar ou euro fica em valor_texto, com valor_brl null. valor_texto: o valor como escrito.
- capacidade: capacidade produtiva ou área, como escrito. empregos: número de empregos (obra ou operação), inteiro.
- estagio: um de ${ESTAGIOS.join(", ")}.
- obra: por_fazer (anúncio, licença, financiamento, sem obra iniciada), em_andamento, concluida (inaugurado, em operação), sem_obra (aquisição, máquinas, ocupação de galpão pronto) ou incerto.
- data_fato: data do fato (AAAA-MM-DD, AAAA-MM ou AAAA). inicio_obra e previsao_operacao: como escrito (ex.: "2025", "segundo semestre de 2026").
- construtora: construtora, EPC ou fornecedores citados. financiamento: origem do dinheiro (BNDES, debêntures, recursos próprios...).
- trechos: até 3 frases copiadas do texto que sustentam objeto, local, valor e estágio (até 300 caracteres cada).
- observacao: uma frase sobre qualquer coisa que ponha o projeto em dúvida (outra empresa, fora do Brasil, plano genérico, já concluído, só intenção). null se nada.

Responda com JSON: {"encontrou":true,"url_original":"...","veiculo_original":"...","resumo":"...","empresa":"...","mesmo_grupo":true,"objeto":"...","tipo_ativo":"...","uf":"MS","municipio":"...","local_detalhe":null,"valor_brl":null,"valor_texto":null,"capacidade":null,"empregos":null,"estagio":"anuncio","obra":"por_fazer","data_fato":"2025-03-10","inicio_obra":null,"previsao_operacao":null,"construtora":null,"financiamento":null,"trechos":["..."],"observacao":null}`;

const texto = (max) => z.string().trim().max(max).nullable().optional().catch(null);

const saidaSchema = z.object({
  encontrou: z.boolean().catch(false),
  url_original: z.string().trim().regex(/^https?:\/\//).nullable().optional().catch(null),
  veiculo_original: texto(120),
  resumo: z.string().trim().max(1200).nullable().optional().catch(null),
  empresa: texto(200),
  mesmo_grupo: z.boolean().nullable().optional().catch(null),
  objeto: texto(200),
  tipo_ativo: texto(40),
  uf: z.string().trim().length(2).transform((v) => v.toUpperCase()).nullable().optional().catch(null),
  municipio: texto(120),
  local_detalhe: texto(200),
  valor_brl: z.number().nonnegative().nullable().optional().catch(null),
  valor_texto: texto(120),
  capacidade: texto(200),
  empregos: z.number().int().nonnegative().nullable().optional().catch(null),
  estagio: z.enum(ESTAGIOS).nullable().optional().catch(null),
  obra: z.enum(OBRA).nullable().optional().catch(null),
  data_fato: z.string().trim().regex(/^\d{4}(-\d{2}){0,2}$/).nullable().optional().catch(null),
  inicio_obra: texto(120),
  previsao_operacao: texto(120),
  construtora: texto(300),
  financiamento: texto(300),
  trechos: z.array(z.string().trim().min(1).max(400)).max(5).catch([]).optional(),
  observacao: texto(400),
});

const CAMPOS_PERFIL = [
  "empresa", "mesmo_grupo", "objeto", "tipo_ativo", "uf", "municipio", "local_detalhe", "valor_brl", "valor_texto",
  "capacidade", "empregos", "estagio", "obra", "data_fato", "inicio_obra", "previsao_operacao", "construtora", "financiamento",
];

function dia(valor) {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Mensagem de uma notícia para o modelo. */
function montarEntrada(grupo, noticia) {
  const ex = noticia.extracao || {};
  return {
    grupo: grupo.nome,
    nicho: NICHOS[grupo.nicho] || grupo.nicho,
    noticia: {
      titulo: noticia.titulo,
      veiculo: noticia.veiculo || null,
      data: dia(noticia.data_original),
      link_google_news: noticia.url || null,
      leitura_da_manchete: {
        objeto: ex.objeto ?? null, uf: ex.uf ?? null, municipio: ex.municipio ?? null,
        valor_brl: ex.valor_brl ?? null, estagio: ex.estagio ?? null,
      },
    },
  };
}

/** Valida a resposta e separa o perfil do projeto. */
function lerEnriquecimento(raw) {
  if (!raw) throw new Error("O modelo não retornou conteúdo");
  const saida = saidaSchema.parse(JSON.parse(raw));
  const perfil = {};
  for (const campo of CAMPOS_PERFIL) perfil[campo] = saida[campo] ?? null;
  return {
    encontrou: Boolean(saida.encontrou && saida.url_original),
    url_original: saida.url_original ?? null,
    veiculo_original: saida.veiculo_original ?? null,
    resumo: saida.resumo ?? null,
    perfil,
    trechos: (saida.trechos || []).slice(0, 3),
    observacao: saida.observacao ?? null,
  };
}

function ferramentas() {
  return [
    { type: "web_search_20260209", name: "web_search", max_uses: MAX_BUSCAS, user_location: { type: "approximate", country: "BR" } },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: MAX_LEITURAS, max_content_tokens: MAX_TOKENS_PAGINA },
  ];
}

function criarEnriquecedor({ client, modelo = MODELO_PADRAO, esforco = "low" }) {
  return {
    modelo,
    async enriquecer(entrada) {
      return pedirJsonComFerramentas(client, {
        model: modelo,
        system: PROMPT,
        user: JSON.stringify(entrada),
        tools: ferramentas(),
        maxTokens: 16000,
        maxVoltas: MAX_VOLTAS,
        effort: esforco,
        etapa: "enriquecimento",
      });
    },
  };
}

/** Enriquecedor do .env: CLAUDE_API_KEY e CLAUDE_ENRICH_MODEL. Desligado ou sem chave, null. */
function enriquecedorPadrao() {
  if (!fases.enriquecimentoLigado()) return null;
  const { getConfig } = require("./config");
  const config = getConfig();
  const client = criarCliente(config.claudeApiKey);
  return client ? criarEnriquecedor({ client, modelo: config.claudeEnrichModel }) : null;
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------

const SEM_ENRIQUECIMENTO = `(e.enriquecimento is null or e.enriquecimento->>'versao' is distinct from '${VERSAO}')`;

function condicaoFila() {
  return `${painel.FILTRO_SITUACAO.funil} and ${fases.condicaoAposFiltro2()} and ${SEM_ENRIQUECIMENTO}`;
}

async function filaDoEnriquecimento(db, grupoId, limite = 400) {
  const { rows } = await db.query(
    `select e.id, e.titulo, e.veiculo, e.url, e.data_original, e.extracao
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

async function gravar(db, grupo, noticia, leitura, enriquecedor, uso) {
  const perfil = { ...leitura.perfil };
  // Com o local do texto, a filial sugerida é refeita.
  if (perfil.uf) perfil.filial_sugerida = await sugerirFilial(db, grupo.id, perfil).catch(() => null);
  const registro = {
    versao: VERSAO,
    modelo: enriquecedor.modelo,
    encontrou: leitura.encontrou,
    url_original: leitura.url_original,
    veiculo_original: leitura.veiculo_original,
    resumo: leitura.resumo,
    perfil,
    trechos: leitura.trechos,
    observacao: leitura.observacao,
    buscas: uso.buscas,
    leituras: uso.leituras,
    em: new Date().toISOString(),
  };
  const corpo = [leitura.resumo, ...(leitura.trechos || [])].filter(Boolean).join("\n\n") || null;
  await painel.emTransacao((client) => client.query(
    `update capex_radar.evidencias
        set enriquecimento = $2::jsonb,
            texto = coalesce($3, texto),
            uf = coalesce($4, uf),
            municipio = coalesce($5, municipio)
      where id = $1`,
    [noticia.id, JSON.stringify(registro), corpo, perfil.uf, perfil.municipio],
  ), ATOR);
  return registro;
}

/**
 * Enriquece uma lista de notícias de um grupo, PARALELO por vez.
 * Notícia com erro fica sem enriquecimento e volta na próxima rodada.
 */
async function enriquecerLista({ db, grupo, enriquecedor, noticias, onProgresso = () => {} }) {
  const resumo = { grupo: grupo.nome, lidas: 0, enriquecidas: 0, sem_materia: 0, erros: 0, buscas: 0 };
  let proxima = 0;
  async function trabalhador() {
    while (proxima < noticias.length) {
      const noticia = noticias[proxima];
      proxima += 1;
      try {
        const { json, buscas, leituras } = await enriquecedor.enriquecer(montarEntrada(grupo, noticia));
        const leitura = lerEnriquecimento(json);
        await gravar(db, grupo, noticia, leitura, enriquecedor, { buscas, leituras });
        resumo.buscas += buscas;
        if (leitura.encontrou) resumo.enriquecidas += 1;
        else resumo.sem_materia += 1;
      } catch (error) {
        resumo.erros += 1;
        resumo.ultimo_erro = String(error.message).slice(0, 300);
      }
      resumo.lidas += 1;
      onProgresso(resumo.lidas, noticias.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALELO, noticias.length) }, trabalhador));
  return resumo;
}

/** Enriquece a fila do funil de um grupo (o que passou pelo Filtro 2). */
async function enriquecerGrupo({ db, grupo, enriquecedor, limite = 400, onProgresso = () => {} }) {
  const noticias = await filaDoEnriquecimento(db, grupo.id, limite);
  return enriquecerLista({ db, grupo, enriquecedor, noticias, onProgresso });
}

module.exports = {
  ATOR,
  VERSAO,
  MODELO_PADRAO,
  MAX_BUSCAS,
  MAX_LEITURAS,
  MAX_VOLTAS,
  PROMPT,
  montarEntrada,
  lerEnriquecimento,
  ferramentas,
  criarEnriquecedor,
  enriquecedorPadrao,
  filaDoEnriquecimento,
  contarFila,
  enriquecerLista,
  enriquecerGrupo,
};
