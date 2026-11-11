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
    leitura: p.objeto || null,
  };
}

// ---------------------------------------------------------------------------
// Linha do tempo
// ---------------------------------------------------------------------------

const PROMPT_LINHA = `Você monta a linha do tempo de um projeto de CapEx privado no Brasil para um radar de oportunidades de obra. Recebe o projeto e as evidências ligadas a ele: notícias (com resumo e trechos da matéria, quando houver) e registros de fontes oficiais (BNDES, licenças ambientais, Cadastro Nacional de Obras, ANEEL, diários oficiais, CVM...). Cada evidência tem um número i.

Monte os MARCOS do projeto em ordem cronológica: anúncio, licença prévia/instalação/operação, financiamento, compra de terreno, contratação de construtora ou EPC, início e andamento de obra, entrada em operação, atraso, suspensão ou cancelamento. Junte num marco só as evidências que contam o mesmo fato (várias notícias do mesmo anúncio). Use só o que as evidências dizem; não invente datas. A data do marco é a do fato quando o texto a traz; senão, a da evidência mais antiga do marco (AAAA-MM-DD, AAAA-MM ou AAAA). Registro oficial sem ligação clara com este projeto não vira marco.

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

/**
 * Consulta as fontes secundárias de uma lista de projetos e grava o que tem
 * correlação direta. O CNO é lido uma vez para todos (arquivo local).
 * deps permite trocar a coleta nos testes.
 */
const CORRELACOES = ["direta", "incerta", "outro_projeto", "outro_estado", "nao_avaliada"];

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
    const correlacao = CORRELACOES.includes(a.correlacao) ? a.correlacao : "incerta";
    const r = await db.query(
      `insert into capex_radar.registros_analisados
         (projeto_id, fonte_codigo, chave, registro, data_registro, correlacao, motivo, evidencia_id, analisado_por)
       values ($1, $2, $3, $4::jsonb, $5, $6, $7,
               (select id from capex_radar.evidencias where chave_dedupe = $3), $8)
       on conflict (projeto_id, chave) do update set
         registro = excluded.registro, data_registro = excluded.data_registro,
         correlacao = excluded.correlacao, motivo = excluded.motivo,
         evidencia_id = excluded.evidencia_id, analisado_por = excluded.analisado_por, em = now()`,
      [projetoId, a.codigo, chave, JSON.stringify({ ...bruto, ...(a.linha?.contexto ? { contexto: String(a.linha.contexto).slice(0, 3000) } : {}) }),
        dataDoRegistro(a.linha), correlacao, a.motivo ? String(a.motivo).slice(0, 500) : null, analisadoPor],
    );
    n += r.rowCount;
  }
  return n;
}

/**
 * Aplica um julgamento feito fora do Radar (Claude Code) aos registros
 * analisados de um projeto: vereditos = [{ chave, correlacao, motivo }].
 * O que ficar 'direta' vira evidência ligada ao projeto.
 */
async function aplicarJulgamento(db, projeto, vereditos, { ator = "usuario:claude-code" } = {}) {
  const fontes = await nomesDasFontes(db);
  const resultado = { atualizados: 0, evidencias: 0 };
  for (const v of vereditos) {
    if (!CORRELACOES.includes(v.correlacao)) throw new Error(`Correlação inválida: ${v.correlacao}`);
    const { rows: [reg] } = await db.query(
      "select id, fonte_codigo, registro from capex_radar.registros_analisados where projeto_id = $1 and chave = $2",
      [projeto.id, v.chave],
    );
    if (!reg) continue;
    if (v.correlacao === "direta") {
      resultado.evidencias += await gravarRegistros(projeto, reg.fonte_codigo, [{ ...reg.registro, correlacao: v.motivo || "correlação direta" }], fontes.get(reg.fonte_codigo), "claude-code");
    }
    await db.query(
      `update capex_radar.registros_analisados
          set correlacao = $3, motivo = $4, analisado_por = $5, em = now(),
              evidencia_id = coalesce(evidencia_id, (select id from capex_radar.evidencias where chave_dedupe = $2))
        where projeto_id = $1 and chave = $2`,
      [projeto.id, v.chave, v.correlacao, v.motivo ? String(v.motivo).slice(0, 500) : null, ator],
    );
    resultado.atualizados += 1;
  }
  return resultado;
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
  const { judgeEvidenceContext } = deps?.judgeEvidenceContext ? deps : require("./ai");
  const { getConfig } = require("./config");
  const modeloCorrelacao = getConfig().claudeDecisionModel;
  const fontes = await nomesDasFontes(db);
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
    const onAnalise = (codigo, linha, correlacao, motivo) => analises.push({ codigo, linha, correlacao, motivo });
    try {
      const consulta = await coleta.consultViableSources(mvp, { dryRun: true, skipCno: true, semJulgamento, onAnalise });
      relatorio.push(...consulta.relatorio);
    } catch (error) {
      log(`${projeto.titulo}: erro na coleta (${error.message})`);
    }
    const hit = cno.get(projeto.id);
    if (hit?.amostra?.length) {
      const { kept, resumo } = await correlateLines(mvp, "SEC-CNO", hit.amostra, {
        judge: judgeEvidenceContext, semJulgamento,
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
const FOLGA_ANTES_DIAS = 30;
const FOLGA_DEPOIS_DIAS = 180;

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
  const conclusoes = [dia(projeto.data_fim), ...marcos.filter((m) => m.tipo === "operacao").map((m) => dataDoMarco(m.data, "fim"))].filter(Boolean).sort();
  return { anuncio: anuncios[0] || null, conclusao: conclusoes[0] || null };
}

/**
 * Evidências fora da cronologia: antes do anúncio ou depois da conclusão
 * (com folga). Nunca tira todas: se todas caírem fora, a janela está errada.
 */
function foraDaCronologia(projeto, evidencias) {
  const { anuncio, conclusao } = janelaDoProjeto(projeto);
  if (!anuncio && !conclusao) return [];
  const antes = anuncio ? somarDias(anuncio, -FOLGA_ANTES_DIAS) : null;
  const depois = conclusao ? somarDias(conclusao, FOLGA_DEPOIS_DIAS) : null;
  const fora = [];
  for (const e of evidencias) {
    const d = dia(e.data_original);
    if (!d) continue;
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

module.exports = {
  VERSAO,
  VERSAO_LINHA,
  PROMPT_LINHA,
  dataDoRegistro,
  tituloDoRegistro,
  chaveDoRegistro,
  projetoParaColeta,
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
  aplicarJulgamento,
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
