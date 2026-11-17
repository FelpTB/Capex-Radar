// Fontes secundárias e linha do tempo dos projetos da carteira (capex_radar).
//
// Para um projeto da carteira:
//   1. Consulta as fontes secundárias conectadas (src/enrichment/run.js:
//      BNDES, SIGA, Ibama, CVM, diários oficiais, ANTT, REIDI...) pelo CNPJ da
//      matriz e pela razão social, e o CNO pela raiz do CNPJ. Um modelo lê
//      cada registro e só fica o que tem correlação direta com o projeto
//      (mesmo local e contexto da obra), a regra de evidência do radar.
//   2. Cada registro que ficou vira uma evidência (capex_radar.evidencias,
//      triagem 'vinculada') ligada ao projeto, com a data do próprio registro.
//   3. Um modelo lê as notícias (com o enriquecimento) e os registros
//      oficiais e monta a linha do tempo: os marcos do projeto em ordem, com
//      as evidências que sustentam cada um, um resumo e o estágio atual.
//      O estágio do projeto só avança.
// O resultado fica em projetos.secundarias e projetos.linha_tempo (sql/026).
const crypto = require("node:crypto");
const { z } = require("zod");
const { criarCliente, pedirJson } = require("./claude");
const { ESTAGIOS } = require("./capex-ia");
const painel = require("./capex-painel-db");

const ATOR = "ia:secundarias";
const VERSAO = "secundarias-v1";
const VERSAO_LINHA = "linha-tempo-v1";
const MODELO_PADRAO = "claude-sonnet-5-5";
const ORDEM_ESTAGIO = ["anuncio", "licenciamento", "funding", "contratacao_epc", "mobilizacao", "operacao"];
const TIPOS_MARCO = ["anuncio", "licenca", "financiamento", "terreno", "contratacao", "obra", "operacao", "atraso", "cancelamento", "outro"];

// ---------------------------------------------------------------------------
// Registro da fonte → evidência
// ---------------------------------------------------------------------------

const CAMPOS_DATA = [
  "data_contratacao", "data_emissao", "data_referencia", "data_entrega", "entrada_operacao", "inicio",
  "data_inicio", "data_publicacao", "data_edicao", "data", "publicado_em", "dt_inicio", "inicio_vigencia",
];
const CAMPOS_DESCRICAO = [
  "descricao", "descricao_do_projeto", "empreendimento", "assunto", "titulo", "objeto", "nome",
  "tipologia", "especie", "tipo", "fase", "situacao_contrato", "situacao",
];

function dataDoRegistro(linha) {
  for (const campo of CAMPOS_DATA) {
    const valor = linha?.[campo];
    if (!valor) continue;
    const d = valor instanceof Date ? valor : new Date(String(valor).length === 10 ? `${valor}T00:00:00Z` : valor);
    if (!Number.isNaN(d.getTime()) && d.getUTCFullYear() > 1990) return d.toISOString().slice(0, 10);
  }
  return null;
}

function texto(valor) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

/** Título curto do registro: o nome da fonte e os campos que descrevem o ato. */
function tituloDoRegistro(fonteNome, codigo, linha) {
  const partes = [];
  if (linha.tipo_licenca || linha.numero_licenca) partes.push(texto(`${linha.tipo_licenca || "Licença"} ${linha.numero_licenca || ""}`));
  for (const campo of CAMPOS_DESCRICAO) {
    const v = texto(linha[campo]);
    if (v && !partes.some((p) => p.includes(v)) && partes.join(" ").length < 160) partes.push(v);
    if (partes.length >= 3) break;
  }
  if (linha.valor_contratado) partes.push(`R$ ${Number(linha.valor_contratado).toLocaleString("pt-BR")}`);
  if (linha.potencia_kw) partes.push(`${Number(linha.potencia_kw).toLocaleString("pt-BR")} kW`);
  if (linha.cno) partes.push(`CNO ${linha.cno}`);
  const desc = partes.filter(Boolean).join(" · ") || codigo;
  return `${fonteNome || codigo}: ${desc}`.slice(0, 300);
}

function chaveDoRegistro(codigo, linha) {
  const { correlacao: _c, contexto: _x, rank: _r, ...resto } = linha || {};
  const id = linha.numero_contrato || linha.protocolo || linha.numero_licenca || linha.cod_ceg || linha.cno || linha.url || linha.link;
  const base = id ? `${id}|${linha.data_contratacao || linha.versao || ""}` : JSON.stringify(resto);
  return `sec:${codigo}:${crypto.createHash("sha1").update(String(base)).digest("hex").slice(0, 20)}`;
}

// Janela da coleta: os diários são consultados a partir de alguns anos antes
// do anúncio (análise de nov/2026: nenhuma evidência de diário com correlação
// direta tinha mais de 2 anos antes do anúncio).
const ANOS_ANTES_BUSCA = 3;

function desdeDaBusca(anuncio) {
  const d = anuncio ? new Date(anuncio) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  d.setUTCFullYear(d.getUTCFullYear() - ANOS_ANTES_BUSCA);
  return d.toISOString().slice(0, 10);
}

const semAcento = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/**
 * CNPJs das filiais do grupo no município do projeto (e a filial do
 * projeto). A coleta busca por eles nos diários em vez da raiz do CNPJ, que
 * traz os atos de todas as unidades da empresa.
 */
async function filiaisDoMunicipio(db, projeto) {
  const lista = new Set(String(projeto.filial_cnpj || "").length === 14 ? [projeto.filial_cnpj] : []);
  if (projeto.municipio && projeto.uf && projeto.grupo_id) {
    const { rows } = await db.query(
      "select cnpj, municipio from capex_radar.vw_filiais where grupo_id = $1 and uf = $2",
      [projeto.grupo_id, projeto.uf],
    );
    for (const f of rows) if (semAcento(f.municipio) === semAcento(projeto.municipio)) lista.add(f.cnpj);
  }
  return [...lista].slice(0, 4);
}

// Marcas que aparecem no nome de obras feitas por construtoras ou por outras
// empresas do grupo (CNO). O nome do grupo e o primeiro nome de cada matriz
// entram sozinhos; aqui ficam as marcas e empresas que não estão na tabela de
// matrizes. Palavras genéricas não servem de marca.
const MARCAS_EXTRAS = {
  JBS: ["seara", "friboi", "swift"],
  "Nestlé": ["nestle", "garoto"],
  Heineken: ["heineken", "bavaria"],
  Lactalis: ["lactalis", "itambe", "parmalat"],
  "MBRF (Marfrig + BRF)": ["brf", "marfrig", "sadia", "perdigao"],
  "Mercado Livre": ["mercado livre", "mercadolivre", "ebazar", "meli"],
  "Coca-Cola FEMSA": ["femsa", "spal"],
  "Solar Coca-Cola": ["solar br", "solar coca"],
  Camil: ["camil"],
  Piracanjuba: ["piracanjuba", "laticinios bela vista"],
  Ambev: ["ambev"],
  "C.Vale": ["c vale", "cvale"],
  "M. Dias Branco": ["dias branco"],
  "Três Corações": ["tres coracoes"],
  "Casas Bahia": ["casas bahia"],
};
const PALAVRAS_GENERICAS = new Set(["mercado", "solar", "refrescos", "global", "grupo", "bebidas", "livre", "casas", "celulose", "laticinios", "moda", "magazine", "tres", "nova", "central", "energia", "logistica", "brasil", "alimentos", "industria", "comercio", "ltda", "data", "centers", "center", "coop", "cooperativa", "agroindustrial", "participacoes", "sa", "s", "a", "do", "da", "de", "the"]);

const dobrarMarca = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Raízes de CNPJ de todas as empresas do grupo e as marcas para o CNO. */
async function identidadeDoGrupo(db, grupoId, grupoNome) {
  const { rows } = await db.query("select cnpj, razao_social from capex_radar.matrizes where grupo_id = $1", [grupoId]);
  const raizes = [...new Set(rows.map((r) => String(r.cnpj).slice(0, 8)))];
  const marcas = new Set((MARCAS_EXTRAS[grupoNome] || []).map(dobrarMarca));
  // O nome do grupo inteiro vale como marca (JBS, Ambev), se não for genérico.
  const inteiro = dobrarMarca(grupoNome).replace(/ data centers?$/, "");
  if (inteiro.length >= 3 && !PALAVRAS_GENERICAS.has(inteiro) && !inteiro.includes(" ")) marcas.add(inteiro);
  // Só a PRIMEIRA palavra do nome, e só se não for genérica ("MERCADO LIVRE" não vira "livre").
  const primeira = (nome) => { const w = dobrarMarca(nome).split(" ")[0]; return w && w.length >= 4 && !PALAVRAS_GENERICAS.has(w) ? w : null; };
  for (const nome of [grupoNome, ...rows.map((r) => r.razao_social)]) {
    const w = primeira(nome);
    if (w) marcas.add(w);
  }
  return { raizes, marcas: [...marcas] };
}

/** Projeto da carteira no formato que a coleta do MVP espera. */
function projetoParaColeta(p) {
  return {
    id: p.id,
    nome: p.titulo,
    nicho: p.nicho,
    uf: p.uf,
    municipio: p.municipio,
    cnpj: p.matriz_cnpj,
    empresa_nome: p.matriz_razao_social,
    status: p.estagio,
    status_em: p.data_anuncio || p.primeira_evidencia_em || null,
    data_anuncio: p.data_anuncio || p.primeira_evidencia_em || null,
    filial_cnpj: p.filial_cnpj || null,
    codigo_ibge: p.codigo_ibge || null,
    desde_busca: desdeDaBusca(p.data_anuncio || p.primeira_evidencia_em),
    cnpjs_municipio: p.cnpjs_municipio || [],
    raizes: p.raizes || [],
    marcas: p.marcas || [],
    leitura: p.objeto || null,
  };
}

// ---------------------------------------------------------------------------
// Linha do tempo
// ---------------------------------------------------------------------------

const PROMPT_LINHA = `Você monta a linha do tempo de um projeto de CapEx privado no Brasil para um radar de oportunidades de obra. Recebe o projeto e as evidências ligadas a ele: notícias (com resumo e trechos da matéria, quando houver) e registros de fontes oficiais (BNDES, licenças ambientais, Cadastro Nacional de Obras, ANEEL, diários oficiais, CVM...). Cada evidência tem um número i.

Monte os MARCOS do projeto em ordem cronológica: anúncio, licença prévia/instalação/operação, financiamento, compra de terreno, contratação de construtora ou EPC, início e andamento de obra, entrada em operação, atraso, suspensão ou cancelamento. Junte num marco só as evidências que contam o mesmo fato (várias notícias do mesmo anúncio). Use só o que as evidências dizem; não invente datas. A data do marco é a do fato quando o texto a traz; senão, a da evidência mais antiga do marco (AAAA-MM-DD, AAAA-MM ou AAAA). Registro oficial sem ligação clara com este projeto não vira marco. Matrícula do Cadastro Nacional de Obras (CNO) vira marco de obra na data de início; se a situação for encerrada (15), vira também o marco \"obra encerrada no CNO\" (tipo obra) na data da situação: é a prova de que a obra terminou, mesmo sem notícia de inauguração.

Depois escreva o resumo (3 a 5 frases: o que é o projeto, onde, quanto, em que pé está e qual o próximo passo esperado) e o estágio atual, um de ${ESTAGIOS.join(", ")}.

Responda somente com JSON: {"resumo":"...","estagio":"licenciamento","marcos":[{"data":"2026-07-03","marco":"frase curta","tipo":"${TIPOS_MARCO.join("|")}","evidencias":[0,3]}]}.`;

const linhaSchema = z.object({
  resumo: z.string().trim().min(1).max(1500).catch(""),
  estagio: z.enum(ESTAGIOS).nullable().optional().catch(null),
  marcos: z.array(z.object({
    data: z.string().trim().regex(/^\d{4}(-\d{2}){0,2}$/).nullable().optional().catch(null),
    marco: z.string().trim().min(1).max(400),
    tipo: z.enum(TIPOS_MARCO).catch("outro"),
    evidencias: z.array(z.number().int().nonnegative()).catch([]),
  })).catch([]),
});

function dia(valor) {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function entradaLinha(projeto, evidencias) {
  return {
    projeto: {
      titulo: projeto.titulo, grupo: projeto.grupo, objeto: projeto.objeto || null,
      uf: projeto.uf, municipio: projeto.municipio,
      valor_brl: projeto.valor_estimado_brl == null ? null : Number(projeto.valor_estimado_brl),
      estagio: projeto.estagio,
    },
    evidencias: evidencias.map((e, i) => {
      const en = e.enriquecimento || {};
      const oficial = e.fonte_codigo !== "gnews_rss";
      return {
        i,
        tipo: oficial ? "registro_oficial" : "noticia",
        fonte: oficial ? e.fonte_nome || e.fonte_codigo : e.veiculo || null,
        data: dia(e.data_original),
        titulo: e.titulo,
        resumo: en.resumo || null,
        trechos: (en.trechos || []).slice(0, 2),
        registro: oficial ? String(e.texto || "").slice(0, 800) || null : undefined,
      };
    }),
  };
}

/** Valida a resposta e liga os marcos às evidências pelo id. */
function lerLinhaDoTempo(raw, evidencias) {
  if (!raw) throw new Error("O modelo não retornou conteúdo");
  const saida = linhaSchema.parse(JSON.parse(raw));
  const marcos = saida.marcos
    .map((m) => ({
      data: m.data ?? null,
      marco: m.marco,
      tipo: m.tipo,
      evidencias: [...new Set(m.evidencias)].filter((i) => i < evidencias.length).map((i) => String(evidencias[i].id)),
    }))
    .sort((a, b) => String(a.data || "9999").localeCompare(String(b.data || "9999")));
  return { resumo: saida.resumo, estagio: saida.estagio ?? null, marcos };
}

function avancaEstagio(atual, novo) {
  if (!novo || novo === atual) return false;
  if (["desaceleracao", "cancelado"].includes(novo)) return true;
  return ORDEM_ESTAGIO.indexOf(novo) > ORDEM_ESTAGIO.indexOf(atual);
}

function criarCronista({ client, modelo = MODELO_PADRAO, esforco = "medium" }) {
  return {
    modelo,
    async montar(entrada) {
      return pedirJson(client, {
        etapa: "linha_tempo", model: modelo, system: PROMPT_LINHA, user: JSON.stringify(entrada), maxTokens: 16000, effort: esforco, thinking: null,
      });
    },
  };
}

function cronistaPadrao() {
  const { getConfig } = require("./config");
  const config = getConfig();
  const client = criarCliente(config.claudeApiKey);
  return client ? criarCronista({ client, modelo: config.claudeFilter3Model }) : null;
}

// ---------------------------------------------------------------------------
// Banco
// ---------------------------------------------------------------------------

/** Os maiores projetos da carteira (ativos e em revisão), por valor estimado. */
async function maioresProjetos(db, limite = 20) {
  const { rows } = await db.query(
    `select v.*, p.objeto, p.secundarias, p.linha_tempo
       from capex_radar.vw_carteira v
       join capex_radar.projetos p on p.id = v.id
      where v.status <> 'descartado'
      order by v.valor_estimado_brl desc nulls last, v.criado_em
      limit $1`,
    [limite],
  );
  return rows;
}

async function evidenciasDoProjeto(db, projetoId) {
  const { rows } = await db.query(
    `select e.id, e.titulo, e.veiculo, e.data_original, e.fonte_codigo, f.nome as fonte_nome, e.texto, e.enriquecimento
       from capex_radar.evidencia_projeto ep
       join capex_radar.evidencias e on e.id = ep.evidencia_id
       left join capex_radar.fontes f on f.codigo = e.fonte_codigo
      where ep.projeto_id = $1 and ep.situacao = 'aceito'
      order by e.data_original nulls last
      limit 60`,
    [projetoId],
  );
  return rows;
}

async function nomesDasFontes(db) {
  const { rows } = await db.query("select codigo, nome, url_base from capex_radar.fontes");
  return new Map(rows.map((r) => [r.codigo, r]));
}

/** Grava os registros com correlação direta como evidências do projeto. */
async function gravarRegistros(projeto, codigo, linhas, fonte, modeloCorrelacao) {
  let gravadas = 0;
  await painel.emTransacao(async (client) => {
    for (const linha of linhas) {
      const { rows: [ev] } = await client.query(
        `insert into capex_radar.evidencias
           (fonte_codigo, chave_dedupe, titulo, url, veiculo, data_original, data_precisao,
            grupo_id, consulta, uf, municipio, texto, conteudo_bruto, triagem, triagem_motivo)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, 'vinculada', $14)
         on conflict (chave_dedupe) do update set conteudo_bruto = excluded.conteudo_bruto
         returning id`,
        [
          codigo,
          chaveDoRegistro(codigo, linha),
          tituloDoRegistro(fonte?.nome, codigo, linha),
          /^https?:\/\//.test(linha.url || linha.link || "") ? linha.url || linha.link : (/^https?:\/\//.test(fonte?.url_base || "") ? fonte.url_base : null),
          fonte?.nome || codigo,
          dataDoRegistro(linha),
          dataDoRegistro(linha) ? "dia" : "desconhecida",
          projeto.grupo_id,
          `fontes secundárias: ${projeto.titulo}`.slice(0, 300),
          /^[A-Z]{2}$/.test(String(linha.uf || "")) ? linha.uf : null,
          linha.municipio ? String(linha.municipio).slice(0, 120) : null,
          texto(linha.trecho || linha.texto || linha.contexto || JSON.stringify(linha)).slice(0, 4000),
          JSON.stringify(linha),
          `Fonte secundária: ${String(linha.correlacao || "correlação direta").slice(0, 200)}`,
        ],
      );
      const r = await client.query(
        `insert into capex_radar.evidencia_projeto
           (evidencia_id, projeto_id, origem, situacao, motivo, modelo, revisado_por, revisado_em)
         values ($1, $2, 'ia', 'aceito', $3, $4, $5, now())
         on conflict (evidencia_id, projeto_id) do nothing`,
        [ev.id, projeto.id, String(linha.correlacao || "").slice(0, 300) || null, modeloCorrelacao, ATOR],
      );
      gravadas += r.rowCount;
    }
  }, ATOR);
  return gravadas;
}

const CORRELACOES = ["direta", "incerta", "outro_projeto", "outro_estado", "nao_avaliada"];
const classes = require("./capex-classes");

// Fontes que não trouxeram nenhuma evidência com correlação direta em 117
// projetos (nov/2026) e não falam de obra privada: títulos minerários da ANM
// e o plano de expansão da transmissão (ONS/EPE).
const FONTES_SEM_RETORNO = ["CAPTURA-SIGMINE", "CAPTURA-ONS-PAR"];

/** Código IBGE do município do projeto (pré-triagem da IAT, que só traz o código). Grava no projeto. */
async function garantirIbge(db, projeto) {
  if (projeto.codigo_ibge) return projeto.codigo_ibge;
  const { rows: [salvo] } = await db.query("select codigo_ibge from capex_radar.projetos where id = $1", [projeto.id]);
  if (salvo?.codigo_ibge) return salvo.codigo_ibge;
  if (!projeto.municipio || !projeto.uf) return null;
  try {
    const { territoryId } = require("./enrichment/atos");
    const codigo = await territoryId(projeto.municipio, projeto.uf);
    if (codigo) {
      await painel.emTransacao((client) => client.query(
        "update capex_radar.projetos set codigo_ibge = $2 where id = $1 and codigo_ibge is null", [projeto.id, codigo],
      ), ATOR);
    }
    return codigo;
  } catch {
    return null;
  }
}

/**
 * Grava os registros analisados de um projeto (item 2 do Enriquecimento 2):
 * todos, aceitos ou não, com o dado bruto. A chave é a mesma da evidência,
 * então o registro aceito aponta para a evidência criada.
 */
async function gravarAnalisados(db, projetoId, analises, analisadoPor) {
  let n = 0;
  for (const a of analises) {
    const { contexto: _c, rank: _r, correlacao: _x, ...bruto } = a.linha || {};
    const chave = chaveDoRegistro(a.codigo, a.linha);
    // Probabilidade do especialista (ou da correlação antiga); nao_avaliada fica sem classe.
    const probabilidade = a.correlacao === "nao_avaliada" ? null
      : a.probabilidade ?? classes.probabilidadeDaCorrelacao(a.correlacao);
    const classe = classes.classeDe(probabilidade);
    const correlacao = a.correlacao === "nao_avaliada" || a.correlacao === "outro_estado" ? a.correlacao
      : classe ? classes.correlacaoDaClasse(classe) : (CORRELACOES.includes(a.correlacao) ? a.correlacao : "incerta");
    // Classe dada por um humano não é sobrescrita por uma coleta nova.
    const r = await db.query(
      `insert into capex_radar.registros_analisados
         (projeto_id, fonte_codigo, chave, registro, data_registro, correlacao, motivo, evidencia_id, analisado_por, probabilidade, classe)
       values ($1, $2, $3, $4::jsonb, $5, $6, $7,
               (select id from capex_radar.evidencias where chave_dedupe = $3), $8, $9, $10)
       on conflict (projeto_id, chave) do update set
         registro = excluded.registro, data_registro = excluded.data_registro,
         -- Humano decide por último; coleta sem julgamento não apaga a classe já dada.
         correlacao = case when registros_analisados.revisado_por is null and not (excluded.correlacao = 'nao_avaliada' and registros_analisados.classe is not null) then excluded.correlacao else registros_analisados.correlacao end,
         motivo = case when registros_analisados.revisado_por is null and not (excluded.correlacao = 'nao_avaliada' and registros_analisados.classe is not null) then excluded.motivo else registros_analisados.motivo end,
         probabilidade = case when registros_analisados.revisado_por is null and not (excluded.correlacao = 'nao_avaliada' and registros_analisados.classe is not null) then excluded.probabilidade else registros_analisados.probabilidade end,
         classe = case when registros_analisados.revisado_por is null and not (excluded.correlacao = 'nao_avaliada' and registros_analisados.classe is not null) then excluded.classe else registros_analisados.classe end,
         evidencia_id = coalesce(excluded.evidencia_id, registros_analisados.evidencia_id),
         analisado_por = excluded.analisado_por, em = now()`,
      [projetoId, a.codigo, chave, JSON.stringify({ ...bruto, ...(a.linha?.contexto ? { contexto: String(a.linha.contexto).slice(0, 3000) } : {}) }),
        dataDoRegistro(a.linha), correlacao, a.motivo ? String(a.motivo).slice(0, 500) : null, analisadoPor, probabilidade, classe],
    );
    n += r.rowCount;
  }
  return n;
}

/**
 * Dá a classe a um registro analisado do projeto e liga ou desliga a
 * evidência: provável ou certeira vira evidência na linha do tempo; abaixo
 * disso, a evidência (se havia) sai do projeto. v = { probabilidade | classe
 * | correlacao, motivo }. Com humano=true, a coleta seguinte não muda a classe.
 */
async function classificarRegistro(db, projeto, reg, v, { ator, humano = false, fontes = null } = {}) {
  const probabilidade = v.probabilidade != null ? Math.round(Number(v.probabilidade))
    : v.classe ? classes.PROBABILIDADE_DA_CLASSE[v.classe]
      : classes.probabilidadeDaCorrelacao(v.correlacao);
  const classe = classes.classeDe(probabilidade);
  if (!classe) throw new Error(`Classe inválida: ${JSON.stringify(v)}`);
  let evidencias = 0;
  if (classes.ligaLinhaDoTempo(classe)) {
    const mapa = fontes || await nomesDasFontes(db);
    evidencias = await gravarRegistros(projeto, reg.fonte_codigo, [{ ...reg.registro, correlacao: v.motivo || classes.CLASSES[classe].rotulo }], mapa.get(reg.fonte_codigo), humano ? "humano" : "claude-code");
    // Evidência que tinha saído do projeto volta.
    await painel.emTransacao((client) => client.query(
      `update capex_radar.evidencia_projeto set situacao = 'aceito', descarte = null, motivo = $3, revisado_por = $4, revisado_em = now()
        where projeto_id = $1 and evidencia_id = (select id from capex_radar.evidencias where chave_dedupe = $2) and situacao = 'rejeitado'`,
      [projeto.id, reg.chave, String(v.motivo || "").slice(0, 300) || null, ator],
    ), ator);
  } else {
    await painel.emTransacao((client) => client.query(
      `update capex_radar.evidencia_projeto set situacao = 'rejeitado', descarte = 'outro_projeto', motivo = $3, revisado_por = $4, revisado_em = now()
        where projeto_id = $1 and evidencia_id = (select id from capex_radar.evidencias where chave_dedupe = $2) and situacao = 'aceito'`,
      [projeto.id, reg.chave, `Classe ${classes.CLASSES[classe].rotulo}: ${v.motivo || ""}`.slice(0, 300), ator],
    ), ator);
  }
  await painel.emTransacao((client) => client.query(
    `update capex_radar.registros_analisados
        set probabilidade = $3, classe = $4, correlacao = $5, motivo = coalesce($6, motivo), analisado_por = $7, em = now(),
            revisado_por = case when $8 then $7 else revisado_por end,
            revisado_em = case when $8 then now() else revisado_em end,
            evidencia_id = coalesce(evidencia_id, (select id from capex_radar.evidencias where chave_dedupe = $2))
      where projeto_id = $1 and chave = $2`,
    [projeto.id, reg.chave, probabilidade, classe, classes.correlacaoDaClasse(classe), v.motivo ? String(v.motivo).slice(0, 500) : null, ator, humano],
  ), ator);
  return { classe, probabilidade, evidencias };
}

/**
 * Aplica um julgamento feito fora do Radar (Claude Code) aos registros
 * analisados de um projeto: vereditos = [{ chave, probabilidade | classe |
 * correlacao, motivo }].
 */
async function aplicarJulgamento(db, projeto, vereditos, { ator = "usuario:claude-code" } = {}) {
  const fontes = await nomesDasFontes(db);
  const resultado = { atualizados: 0, evidencias: 0 };
  for (const v of vereditos) {
    if (v.correlacao && !CORRELACOES.includes(v.correlacao)) throw new Error(`Correlação inválida: ${v.correlacao}`);
    if (v.classe && !classes.CLASSES[v.classe]) throw new Error(`Classe inválida: ${v.classe}`);
    const { rows: [reg] } = await db.query(
      "select id, chave, fonte_codigo, registro from capex_radar.registros_analisados where projeto_id = $1 and chave = $2",
      [projeto.id, v.chave],
    );
    if (!reg) continue;
    const r = await classificarRegistro(db, projeto, reg, v, { ator, fontes });
    resultado.evidencias += r.evidencias;
    resultado.atualizados += 1;
  }
  return resultado;
}

/** Revisão humana da classe de um registro analisado (ficha do projeto, MCP). */
async function revisarRegistro(db, registroId, { classe, probabilidade, motivo, ator }) {
  const { rows: [reg] } = await db.query(
    "select id, chave, fonte_codigo, registro, projeto_id from capex_radar.registros_analisados where id = $1",
    [registroId],
  );
  if (!reg) return null;
  const { rows: [projeto] } = await db.query(
    "select v.*, p.objeto from capex_radar.vw_carteira v join capex_radar.projetos p on p.id = v.id where v.id = $1",
    [reg.projeto_id],
  );
  const r = await classificarRegistro(db, projeto, reg, { classe, probabilidade, motivo }, { ator, humano: true });
  const perfis = require("./capex-perfil");
  await painel.emTransacao((client) => perfis.montarPerfil(client, projeto.id), ator);
  return { projeto_id: projeto.id, titulo: projeto.titulo, ...r };
}

/**
 * Consulta as fontes secundárias de uma lista de projetos, grava todos os
 * registros analisados e cria evidência para os de correlação direta.
 * Com semJulgamento, nada é aceito: os registros ficam 'nao_avaliada' para o
 * julgamento externo (aplicarJulgamento). deps troca a coleta nos testes.
 */
async function consultarFontes(db, projetos, { log = () => {}, deps = null, semJulgamento = false } = {}) {
  const coleta = deps || require("./enrichment/run");
  const { correlateLines } = deps?.correlateLines ? deps : require("./enrichment/correlacao");
  const judgeEvidenceContext = deps?.judgeEvidenceContext || require("./capex-especialistas").juizEspecialistaPadrao();
  const { getConfig } = require("./config");
  const modeloCorrelacao = getConfig().claudeDecisionModel;
  const fontes = await nomesDasFontes(db);
  for (const p of projetos) {
    p.codigo_ibge = await garantirIbge(db, p);
    p.cnpjs_municipio = await filiaisDoMunicipio(db, p);
    Object.assign(p, await identidadeDoGrupo(db, p.grupo_id, p.grupo));
  }
  const paraColeta = projetos.map(projetoParaColeta);
  let cno = new Map();
  try {
    cno = await coleta.matchCno(paraColeta);
  } catch (error) {
    log(`CNO indisponível: ${error.message}`);
  }
  const resultados = [];
  for (const [k, projeto] of projetos.entries()) {
    const mvp = paraColeta[k];
    const relatorio = [];
    const analises = [];
    const onAnalise = (codigo, linha, correlacao, motivo, probabilidade) => analises.push({ codigo, linha, correlacao, motivo, probabilidade });
    try {
      const consulta = await coleta.consultViableSources(mvp, { dryRun: true, skipCno: true, semJulgamento, onAnalise, excluir: FONTES_SEM_RETORNO });
      relatorio.push(...consulta.relatorio);
    } catch (error) {
      log(`${projeto.titulo}: erro na coleta (${error.message})`);
    }
    const hit = cno.get(projeto.id);
    if (hit?.amostra?.length) {
      const { kept, resumo } = await correlateLines(mvp, "SEC-CNO", hit.amostra, {
        judge: judgeEvidenceContext, semJulgamento, municipioBasta: false,
        onAnalise: (linha, correlacao, motivo) => onAnalise("SEC-CNO", linha, correlacao, motivo),
      });
      relatorio.push({ codigo: "SEC-CNO", correlacao: resumo, linhas: kept });
    }
    let gravadas = 0;
    for (const r of relatorio) {
      if (!r.linhas?.length) continue;
      gravadas += await gravarRegistros(projeto, r.codigo, r.linhas, fontes.get(r.codigo), modeloCorrelacao);
    }
    const analisados = await gravarAnalisados(db, projeto.id, analises, semJulgamento ? "pendente" : ATOR);
    const registro = {
      versao: VERSAO,
      em: new Date().toISOString(),
      fontes: relatorio.map((r) => ({ codigo: r.codigo, avaliadas: r.correlacao?.avaliadas || 0, diretas: r.linhas?.length || 0 })),
      gravadas,
      analisados,
      julgamento: semJulgamento ? "pendente" : "modelo",
    };
    await painel.emTransacao((client) => client.query(
      "update capex_radar.projetos set secundarias = $2::jsonb where id = $1",
      [projeto.id, JSON.stringify(registro)],
    ), ATOR);
    log(`${projeto.titulo}: ${relatorio.length} fonte(s) consultada(s), ${gravadas} registro(s) novo(s) com correlação direta`);
    resultados.push({ projeto: projeto.titulo, ...registro });
  }
  return resultados;
}

// ---------------------------------------------------------------------------
// Cronologia (Enriquecimento 2)
// ---------------------------------------------------------------------------

// Folga para datas imprecisas: a notícia pode sair dias antes do anúncio
// oficial, e notícias sobre a inauguração aparecem nos meses seguintes.
// Registro oficial tem folga maior: licença, matrícula da obra (CNO) e
// financiamento costumam vir antes da notícia, e a licença de operação depois
// da inauguração. Se o registro é mesmo do projeto, quem decide é o
// julgamento do conteúdo.
const FOLGA_ANTES_DIAS = 30;
const FOLGA_DEPOIS_DIAS = 180;
const FOLGA_REGISTRO_ANTES_DIAS = 730;
const FOLGA_REGISTRO_DEPOIS_DIAS = 365;

// "2025" vira o primeiro ou o último dia do ano, conforme o limite.
function dataDoMarco(data, limite) {
  if (!data) return null;
  const s = String(data);
  if (/^\d{4}$/.test(s)) return limite === "inicio" ? `${s}-01-01` : `${s}-12-31`;
  if (/^\d{4}-\d{2}$/.test(s)) {
    if (limite === "inicio") return `${s}-01`;
    const [a, m] = s.split("-").map(Number);
    return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  }
  return dia(s);
}

function somarDias(data, dias) {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Janela do projeto: do anúncio à conclusão. O anúncio é o menor entre
 * data_anuncio e o marco de anúncio; a conclusão é data_fim ou o marco de
 * operação. Sem anúncio conhecido, não há janela.
 */
function janelaDoProjeto(projeto) {
  const marcos = projeto.linha_tempo?.marcos || [];
  const anuncios = [dia(projeto.data_anuncio), ...marcos.filter((m) => m.tipo === "anuncio").map((m) => dataDoMarco(m.data, "inicio"))].filter(Boolean).sort();
  // A conclusão é o ÚLTIMO marco de operação: projeto em fases (linha nova,
  // ampliação) entra em operação mais de uma vez.
  // Se houver marco posterior à última operação (licença de ampliação, obra
  // nova), o projeto não está concluído.
  const conclusoes = [dia(projeto.data_fim), ...marcos.filter((m) => m.tipo === "operacao").map((m) => dataDoMarco(m.data, "fim"))].filter(Boolean).sort();
  const ultimoMarco = marcos.map((m) => dataDoMarco(m.data, "inicio")).filter(Boolean).sort().pop() || null;
  let conclusao = conclusoes[conclusoes.length - 1] || null;
  if (conclusao && ultimoMarco && ultimoMarco > conclusao) conclusao = null;
  return { anuncio: anuncios[0] || null, conclusao };
}

/**
 * Evidências fora da cronologia: antes do anúncio ou depois da conclusão
 * (com folga). Nunca tira todas: se todas caírem fora, a janela está errada.
 */
function foraDaCronologia(projeto, evidencias) {
  const { anuncio, conclusao } = janelaDoProjeto(projeto);
  if (!anuncio && !conclusao) return [];
  const fora = [];
  for (const e of evidencias) {
    const d = dia(e.data_original);
    if (!d) continue;
    const registro = e.fonte_codigo && e.fonte_codigo !== "gnews_rss";
    const antes = anuncio ? somarDias(anuncio, -(registro ? FOLGA_REGISTRO_ANTES_DIAS : FOLGA_ANTES_DIAS)) : null;
    const depois = conclusao && (!anuncio || conclusao >= anuncio)
      ? somarDias(conclusao, registro ? FOLGA_REGISTRO_DEPOIS_DIAS : FOLGA_DEPOIS_DIAS) : null;
    if (antes && d < antes) fora.push({ id: String(e.id), data: d, motivo: `Cronologia: evidência de ${d}, antes do anúncio (${anuncio})` });
    else if (depois && d > depois) fora.push({ id: String(e.id), data: d, motivo: `Cronologia: evidência de ${d}, depois da conclusão (${conclusao})` });
  }
  return fora.length >= evidencias.length ? [] : fora;
}

/** Tira do projeto as evidências fora da cronologia (vínculo rejeitado, reversível). */
async function aplicarCronologia(projetoId, fora, ator = ATOR) {
  if (!fora.length) return 0;
  return painel.emTransacao(async (client) => {
    let n = 0;
    for (const f of fora) {
      const r = await client.query(
        `update capex_radar.evidencia_projeto
            set situacao = 'rejeitado', descarte = 'cronologia', motivo = $3, revisado_por = $4, revisado_em = now()
          where projeto_id = $1 and evidencia_id = $2 and situacao = 'aceito'`,
        [projetoId, f.id, f.motivo.slice(0, 300), ator],
      );
      n += r.rowCount;
    }
    return n;
  }, ator);
}

// Todo projeto com evidência aceita tem linha do tempo com pelo menos um marco.
// Se o modelo não devolver marco nenhum, cada evidência com data vira um marco.
function marcosMinimos(evidencias) {
  const comData = evidencias.filter((e) => dia(e.data_original));
  const base = comData.length ? comData : evidencias.slice(0, 1);
  return base.slice(0, 12).map((e, i) => ({
    data: dia(e.data_original),
    marco: String(e.titulo || "Evidência do projeto").slice(0, 400),
    tipo: i === 0 ? "anuncio" : "outro",
    evidencias: [String(e.id)],
  }));
}

/**
 * Projetos (de qualquer status) com evidência aceita e linha do tempo
 * faltando, sem marcos ou montada com outro número de evidências.
 */
async function projetosSemLinhaDoTempo(db, limite = 200) {
  const { rows } = await db.query(
    `with n as (
       select projeto_id, count(*)::int as n
         from capex_radar.evidencia_projeto where situacao = 'aceito' group by projeto_id
     )
     select v.*, p.objeto, p.secundarias, p.linha_tempo, n.n as n_aceitas
       from capex_radar.vw_carteira v
       join capex_radar.projetos p on p.id = v.id
       join n on n.projeto_id = p.id
      where p.linha_tempo is null
         or jsonb_array_length(coalesce(p.linha_tempo->'marcos', '[]'::jsonb)) = 0
         or coalesce((p.linha_tempo->>'evidencias')::int, -1) <> least(n.n, 60)
         or (coalesce((p.linha_tempo->>'provisoria')::boolean, false)
             and (p.linha_tempo->>'em')::timestamptz < now() - interval '1 day')
      order by (p.status = 'descartado'), p.linha_tempo is not null, v.valor_estimado_brl desc nulls last
      limit $1`,
    [limite],
  );
  return rows;
}

/** Monta a linha do tempo dos projetos pendentes. Erro num projeto não para os outros. */
async function atualizarLinhasDoTempo(db, cronista, { limite = 200, log = () => {} } = {}) {
  const projetos = await projetosSemLinhaDoTempo(db, limite);
  const resultado = { pendentes: projetos.length, montadas: 0, erros: 0 };
  for (const p of projetos) {
    try {
      const r = await montarLinhaDoTempo(db, p, cronista);
      if (r) resultado.montadas += 1;
      log(`${p.titulo}: ${r ? `${r.marcos.length} marco(s) de ${r.evidencias} evidência(s)${r.estagio_mudou ? `, estágio ${r.estagio_mudou}` : ""}` : "sem evidências"}`);
    } catch (error) {
      // Sem o modelo (crédito, rede...), grava a linha provisória com as
      // evidências; ela é refeita pelo modelo um dia depois.
      resultado.erros += 1;
      const provisoria = await montarLinhaProvisoria(db, p).catch(() => null);
      if (provisoria) resultado.provisorias = (resultado.provisorias || 0) + 1;
      log(`${p.titulo}: erro no modelo (${String(error.message).slice(0, 160)})${provisoria ? `; linha provisória com ${provisoria.marcos.length} marco(s)` : ""}`);
    }
  }
  return resultado;
}

/** Linha do tempo sem modelo: um marco por evidência com data. Não mexe no estágio. */
async function montarLinhaProvisoria(db, projeto) {
  const evidencias = await evidenciasDoProjeto(db, projeto.id);
  if (!evidencias.length) return null;
  const registro = {
    versao: VERSAO_LINHA, modelo: null, provisoria: true,
    resumo: "", estagio: null, marcos: marcosMinimos(evidencias),
    evidencias: evidencias.length, em: new Date().toISOString(),
  };
  await painel.emTransacao((client) => client.query(
    "update capex_radar.projetos set linha_tempo = $2::jsonb, atualizado_em = now() where id = $1",
    [projeto.id, JSON.stringify(registro)],
  ), ATOR);
  return registro;
}

// ---------------------------------------------------------------------------
// Enriquecimento 2: fontes secundárias, linha do tempo, cronologia e perfil
// completo de um projeto. Repetido de tempos em tempos (scheduler.js).
// ---------------------------------------------------------------------------

const DIAS_ENRIQUECIMENTO2 = 30;

/** Projetos vivos sem Enriquecimento 2 ou com o último há mais de 30 dias; pais antes dos filhos. */
async function projetosParaEnriquecimento2(db, limite = 1) {
  const { rows } = await db.query(
    `select v.*, p.objeto, p.secundarias, p.linha_tempo, p.data_fim, p.projeto_pai_id
       from capex_radar.vw_carteira v
       join capex_radar.projetos p on p.id = v.id
      where v.status <> 'descartado'
        and (p.secundarias is null or (p.secundarias->>'em')::timestamptz < now() - make_interval(days => $2))
      order by p.secundarias is not null, p.projeto_pai_id is not null, v.valor_estimado_brl desc nulls last
      limit $1`,
    [limite, DIAS_ENRIQUECIMENTO2],
  );
  return rows;
}

async function recarregarProjeto(db, id) {
  const { rows: [p] } = await db.query(
    `select v.*, p.objeto, p.secundarias, p.linha_tempo, p.data_fim
       from capex_radar.vw_carteira v join capex_radar.projetos p on p.id = v.id where v.id = $1`,
    [id],
  );
  return p;
}

/**
 * Enriquecimento 2 de um projeto: consulta as fontes secundárias (grava todos
 * os registros analisados), monta a linha do tempo, tira as evidências fora
 * da cronologia (e refaz a linha, se tirou alguma) e grava o perfil completo.
 */
async function enriquecimento2(db, projeto, { cronista = null, semJulgamento = false, log = () => {}, deps = null } = {}) {
  const perfis = require("./capex-perfil");
  const [fontes] = await consultarFontes(db, [projeto], { log, deps, semJulgamento });
  let atual = await recarregarProjeto(db, projeto.id);
  let linha = null;
  if (cronista) {
    linha = await montarLinhaDoTempo(db, atual, cronista).catch(async () => montarLinhaProvisoria(db, atual));
    atual = await recarregarProjeto(db, projeto.id);
  }
  const fora = foraDaCronologia(atual, await evidenciasDoProjeto(db, projeto.id));
  const retiradas = await aplicarCronologia(projeto.id, fora);
  if (retiradas && cronista) {
    linha = await montarLinhaDoTempo(db, atual, cronista).catch(async () => montarLinhaProvisoria(db, atual));
  }
  const perfil = await painel.emTransacao((client) => perfis.montarPerfil(client, projeto.id), ATOR);
  return { fontes, linha_tempo: linha ? linha.marcos.length : null, fora_da_cronologia: retiradas, perfil: perfil?.etapa };
}

/** Monta e grava a linha do tempo de um projeto; o estágio só avança. */
async function montarLinhaDoTempo(db, projeto, cronista) {
  const evidencias = await evidenciasDoProjeto(db, projeto.id);
  if (!evidencias.length) return null;
  const linha = lerLinhaDoTempo(await cronista.montar(entradaLinha(projeto, evidencias)), evidencias);
  if (!linha.marcos.length) linha.marcos = marcosMinimos(evidencias);
  const registro = { versao: VERSAO_LINHA, modelo: cronista.modelo, ...linha, evidencias: evidencias.length, em: new Date().toISOString() };
  const muda = avancaEstagio(projeto.estagio, linha.estagio);
  await painel.emTransacao((client) => client.query(
    `update capex_radar.projetos
        set linha_tempo = $2::jsonb,
            estagio = case when $3 then $4 else estagio end,
            atualizado_em = now()
      where id = $1`,
    [projeto.id, JSON.stringify(registro), muda, linha.estagio],
  ), ATOR);
  return { ...registro, estagio_mudou: muda ? `${projeto.estagio} → ${linha.estagio}` : null };
}

// ---------------------------------------------------------------------------
// Aprovação no painel: a evidência aceita entra na linha do tempo na hora.
// ---------------------------------------------------------------------------

// Tempo máximo esperando o modelo; depois disso a evidência entra como marco
// provisório (o modelo que ainda estiver rodando grava a linha completa depois).
const LIMITE_LINHA_MS = 150000;

function comLimite(promessa, ms) {
  let timer;
  const limite = new Promise((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error(`o modelo passou de ${Math.round(ms / 1000)} s`)), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

/**
 * Acrescenta à linha do tempo um marco para cada evidência aceita que ainda
 * não está em marco nenhum, na ordem das datas. Não mexe nos marcos que já
 * existem.
 */
function acrescentarMarcos(linha, evidencias) {
  const marcos = [...(linha?.marcos || [])];
  const presentes = new Set(marcos.flatMap((m) => (m.evidencias || []).map(String)));
  const novas = evidencias.filter((e) => !presentes.has(String(e.id)));
  for (const e of novas) {
    marcos.push({
      data: dia(e.data_original),
      marco: String(e.titulo || "Evidência do projeto").slice(0, 400),
      tipo: marcos.length ? "outro" : "anuncio",
      evidencias: [String(e.id)],
    });
  }
  const chave = (m) => dataDoMarco(m.data, "inicio") || "9999-12-31";
  marcos.sort((a, b) => chave(a).localeCompare(chave(b)));
  return { marcos, novas: novas.length };
}

/**
 * Depois que uma pessoa aprova uma evidência no painel: refaz a linha do
 * tempo do projeto com o modelo (o estágio só avança). Sem modelo, com erro
 * ou passando do limite de tempo, a evidência entra como marco provisório na
 * linha que já existe, e a linha fica marcada para o modelo refazer depois.
 * No fim, regrava o perfil do projeto.
 */
async function incluirNaLinhaDoTempo(db, projetoId, { cronista, limiteMs = LIMITE_LINHA_MS, ator = ATOR } = {}) {
  const projeto = await recarregarProjeto(db, projetoId);
  if (!projeto) return null;
  const modelo = cronista === undefined ? cronistaPadrao() : cronista;
  let resultado = null;
  let erro = null;
  if (modelo) {
    try {
      const linha = await comLimite(montarLinhaDoTempo(db, projeto, modelo), limiteMs);
      if (linha) resultado = { modo: "modelo", marcos: linha.marcos.length, estagio_mudou: linha.estagio_mudou };
    } catch (error) {
      erro = String(error.message || error).slice(0, 200);
    }
  }
  if (!resultado) {
    const evidencias = await evidenciasDoProjeto(db, projetoId);
    if (!evidencias.length) return null;
    const { marcos, novas } = acrescentarMarcos(projeto.linha_tempo, evidencias);
    const base = projeto.linha_tempo || { versao: VERSAO_LINHA, modelo: null, resumo: "", estagio: null };
    const registro = { ...base, marcos, provisoria: true, evidencias: evidencias.length, em: new Date().toISOString() };
    await painel.emTransacao((client) => client.query(
      "update capex_radar.projetos set linha_tempo = $2::jsonb, atualizado_em = now() where id = $1",
      [projetoId, JSON.stringify(registro)],
    ), ator);
    resultado = { modo: "provisoria", marcos: marcos.length, novas, erro };
  }
  const perfis = require("./capex-perfil");
  await painel.emTransacao((client) => perfis.montarPerfil(client, projetoId), ator).catch(() => null);
  return resultado;
}

module.exports = {
  VERSAO,
  VERSAO_LINHA,
  incluirNaLinhaDoTempo,
  acrescentarMarcos,
  PROMPT_LINHA,
  dataDoRegistro,
  tituloDoRegistro,
  chaveDoRegistro,
  projetoParaColeta,
  desdeDaBusca,
  filiaisDoMunicipio,
  identidadeDoGrupo,
  entradaLinha,
  lerLinhaDoTempo,
  avancaEstagio,
  criarCronista,
  cronistaPadrao,
  maioresProjetos,
  evidenciasDoProjeto,
  consultarFontes,
  montarLinhaDoTempo,
  gravarAnalisados,
  garantirIbge,
  FONTES_SEM_RETORNO,
  aplicarJulgamento,
  classificarRegistro,
  revisarRegistro,
  projetosParaEnriquecimento2,
  enriquecimento2,
  janelaDoProjeto,
  foraDaCronologia,
  aplicarCronologia,
  marcosMinimos,
  montarLinhaProvisoria,
  projetosSemLinhaDoTempo,
  atualizarLinhasDoTempo,
};
