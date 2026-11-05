// IA do coletor capex_radar (Fase 3): triagem das notícias e vínculo com projetos.
//
// A IA só sugere. A triagem diz se o título fala de ativo físico do grupo e
// extrai o que der; o vínculo escolhe um projeto numa lista fechada ou null.
// O cliente OpenAI entra como parâmetro; iaPadrao() monta o do .env.
const { z } = require("zod");

const ESTAGIOS = ["anuncio", "licenciamento", "funding", "contratacao_epc", "mobilizacao", "operacao", "desaceleracao", "cancelado"];

const NICHOS = {
  papel_celulose: "papel e celulose",
  alimentos_bebidas: "alimentos e bebidas",
  ecommerce: "e-commerce",
  datacenter: "datacenters",
};

const triagemSchema = z.object({
  itens: z.array(z.object({
    i: z.number().int().nonnegative(),
    capex: z.boolean(),
    motivo: z.string().min(1),
    objeto: z.string().nullable().optional(),
    uf: z.string().length(2).nullable().optional(),
    municipio: z.string().nullable().optional(),
    valor_brl: z.number().nonnegative().nullable().optional(),
    estagio: z.enum(ESTAGIOS).nullable().optional(),
    data_fato: z.string().regex(/^\d{4}(-\d{2}){0,2}$/).nullable().optional(),
  })),
});

const vinculoSchema = z.object({
  projeto_id: z.string().nullable(),
  confianca: z.number().int().min(0).max(100),
  motivo: z.string().min(1),
});

const PROMPT_TRIAGEM =
  "Você tria manchetes para um radar de investimento (CapEx) privado no Brasil. " +
  "Para cada item, diga se a manchete fala de um ativo físico do grupo informado: fábrica, planta, linha, " +
  "centro de distribuição, galpão, campus de data center, terminal, expansão florestal ligada a fábrica. " +
  "Vale anúncio, licença, financiamento, obra, inauguração, ampliação, suspensão ou cancelamento. " +
  "Não vale: resultado financeiro, ação na bolsa, dividendos, marketing, produto, promoção, varejo, " +
  "contratação de executivo, processo judicial sem obra, ou ativo de outra empresa. " +
  "Quando cita_empresa for false, o título não traz o nome do grupo, mas a busca achou o grupo no texto da matéria: " +
  "marque capex=true só se o ativo descrito combinar com o grupo (setor, porte, local conhecido); manchete genérica do setor é false. " +
  "Use só o que está escrito; deixe null o que a manchete não diz. valor_brl só quando o valor estiver em reais " +
  "(R$ 1,2 bilhão = 1200000000). uf é a sigla do estado. estagio é um de: " + ESTAGIOS.join(", ") + ". " +
  "data_fato só quando a manchete citar a data do fato (AAAA, AAAA-MM ou AAAA-MM-DD). " +
  'Retorne somente JSON: {"itens":[{"i","capex","motivo","objeto","uf","municipio","valor_brl","estagio","data_fato"}]}, ' +
  "um elemento por item recebido, com motivo curto.";

const PROMPT_VINCULO =
  "Você decide se uma notícia de investimento fala de um projeto já cadastrado do mesmo grupo. " +
  "Escolha o id de um projeto da lista só quando for o mesmo ativo (mesmo objeto e local, ou referência clara). " +
  "Na dúvida, ou se for outro ativo, retorne projeto_id null. " +
  'Retorne somente JSON: {"projeto_id": "<id da lista> ou null", "confianca": 0-100, "motivo": "curto"}.';

function lerJson(raw) {
  if (!raw) throw new Error("O modelo não retornou conteúdo");
  return JSON.parse(raw);
}

/** Valida a resposta da triagem e devolve Map id da evidência → decisão. */
function lerTriagem(raw, lote) {
  const { itens } = triagemSchema.parse(lerJson(raw));
  const decisoes = new Map();
  for (const item of itens) {
    const noticia = lote[item.i];
    if (!noticia || decisoes.has(noticia.id)) continue;
    const { i: _i, ...decisao } = item;
    decisoes.set(noticia.id, {
      ...decisao,
      uf: decisao.uf ? decisao.uf.toUpperCase() : null,
      objeto: decisao.objeto ?? null,
      municipio: decisao.municipio ?? null,
      valor_brl: decisao.valor_brl ?? null,
      estagio: decisao.estagio ?? null,
      data_fato: decisao.data_fato ?? null,
    });
  }
  return decisoes;
}

/** Valida o vínculo. Um id fora da lista vira null. */
function lerVinculo(raw, projetos) {
  const vinculo = vinculoSchema.parse(lerJson(raw));
  const ids = new Set(projetos.map((p) => String(p.id)));
  if (vinculo.projeto_id && !ids.has(String(vinculo.projeto_id))) {
    return { projeto_id: null, confianca: 0, motivo: "O modelo escolheu um projeto fora da lista." };
  }
  return vinculo;
}

function criarIa({ client, modelo }) {
  async function perguntar(system, user) {
    const completion = await client.chat.completions.create({
      model: modelo,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) },
      ],
    });
    return completion.choices[0]?.message?.content;
  }

  return {
    modelo,
    async triar(grupo, lote) {
      const raw = await perguntar(PROMPT_TRIAGEM, {
        grupo: grupo.nome,
        nicho: NICHOS[grupo.nicho] || grupo.nicho,
        itens: lote.map((noticia, i) => ({
          i,
          titulo: noticia.titulo,
          veiculo: noticia.veiculo,
          cita_empresa: noticia.cita_empresa !== false,
          data: noticia.data_original ? new Date(noticia.data_original).toISOString().slice(0, 10) : null,
        })),
      });
      return lerTriagem(raw, lote);
    },
    async vincular(grupo, noticia, projetos) {
      const raw = await perguntar(PROMPT_VINCULO, {
        grupo: grupo.nome,
        noticia: { titulo: noticia.titulo, ...noticia.extracao, filial_sugerida: undefined },
        projetos: projetos.map((p) => ({
          id: p.id, titulo: p.titulo, objeto: p.objeto, uf: p.uf, municipio: p.municipio, estagio: p.estagio,
        })),
      });
      return lerVinculo(raw, projetos);
    },
  };
}

// Usa OPENAI_API_KEY e OPENAI_MODEL do ambiente. Sem chave, devolve null e
// o coletor roda só as regras.
function iaPadrao() {
  const { getConfig } = require("./config");
  const config = getConfig();
  if (!config.openAiApiKey) return null;
  const OpenAI = require("openai");
  return criarIa({ client: new OpenAI({ apiKey: config.openAiApiKey }), modelo: config.openAiModel });
}

module.exports = { ESTAGIOS, lerTriagem, lerVinculo, criarIa, iaPadrao };
