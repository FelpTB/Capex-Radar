// Funil de notícias feito pelo Claude Code, sem a API do Claude.
//
// Faz o trabalho das fases de IA do funil (Filtro 1 na manchete, Filtro 2,
// Enriquecimento, Filtro 3 e agente) a partir de arquivos: o script exporta
// as notícias pendentes, o Claude Code decide (lendo a matéria quando vale a
// pena) e o script grava as decisões nos mesmos campos e com os mesmos
// rótulos das fases automáticas. O painel mostra o resultado como se as fases
// tivessem rodado; as decisões aparecem na aba Agente para avaliação.
//
// Uso:
//   npm run capex:coletar -- --sem-ia                      coleta e regras (sem IA)
//   npm run capex:funil -- contar
//   npm run capex:funil -- exportar --saida <pasta> [--grupo <nome>] [--limite 60]
//   (o Claude Code segue docs/claude-code/funil-noticias.md e escreve <pasta>/decisoes.json)
//   npm run capex:funil -- aplicar --arquivo <pasta>/decisoes.json [--seco]
//
// Depois de aplicar, os projetos tocados ganham marcos provisórios na linha do
// tempo; a linha definitiva é refeita pelo reprocessamento
// (capex:reprocessar -- dossie / aplicar, docs/claude-code/linha-do-tempo.md).
const fs = require("node:fs");
const path = require("node:path");
const { pool } = require("../src/db");
const painel = require("../src/capex-painel-db");
const fases = require("../src/capex-fases");
const agente = require("../src/capex-agente");
const filtro2 = require("../src/capex-filtro");
const filtro3 = require("../src/capex-filtro-final");
const enriquecimento = require("../src/capex-enriquecimento");
const coletor = require("../src/capex-coletor");
const { ESTAGIOS } = require("../src/capex-ia");

const ATOR = "usuario:claude-code";
const MODELO = "claude-code";
const VERSAO_DECISAO = "claude-code-v1";
const DECISOES = ["criar_projeto", "vincular", "descartar"];
const RELACOES = ["expansao", "subprojeto", "localidade"];
const LIMITE_PADRAO = 60;
const JANELA_PROXIMAS_DIAS = 120;

// Motivos aceitos: os do agente (por decisão) e os de descarte dos Filtros 2 e 3.
const MOTIVOS_DESCARTE = { ...filtro2.MOTIVOS, ...filtro3.MOTIVOS };
for (const [codigo, m] of Object.entries(agente.MOTIVOS)) {
  if (m.decisao === "descartar" && !MOTIVOS_DESCARTE[codigo]) MOTIVOS_DESCARTE[codigo] = m.rotulo;
}
const MOTIVOS_CRIAR = Object.entries(agente.MOTIVOS).filter(([, m]) => m.decisao === "criar_projeto").map(([c]) => c);
const rotuloDescarte = (codigo) => {
  const m = MOTIVOS_DESCARTE[codigo];
  return typeof m === "string" ? m : m?.rotulo || codigo;
};

// Notícias que o funil do Claude Code decide: nunca triadas (depois das regras
// da coleta) ou ainda no funil, sem projeto aceito.
const NA_FILA = `e.fonte_codigo = 'gnews_rss'
  and ((e.triagem = 'pendente' and e.extracao is null) or ${fases.NO_FUNIL})
  and not exists (select 1 from capex_radar.evidencia_projeto a where a.evidencia_id = e.id and a.situacao = 'aceito')`;

function argumentos(argv) {
  const [comando, ...resto] = argv;
  const args = { comando };
  for (let i = 0; i < resto.length; i += 1) {
    const chave = resto[i].replace(/^--/, "");
    const valor = resto[i + 1] && !resto[i + 1].startsWith("--") ? resto[++i] : true;
    args[chave] = valor;
  }
  return args;
}

const dia = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
const nomeArquivo = (s) => String(s).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------------------------------------------------------------------------
// contar / exportar
// ---------------------------------------------------------------------------

async function contar() {
  const { rows } = await pool.query(
    `select g.nome, count(*)::int as noticias, min(e.data_original)::date as desde, max(e.data_original)::date as ate
       from capex_radar.evidencias e join capex_radar.grupos g on g.id = e.grupo_id
      where ${NA_FILA}
      group by 1 order by 2 desc`,
  );
  console.table(rows);
  console.log(`Total: ${rows.reduce((n, r) => n + r.noticias, 0)} notícia(s) na fila do funil.`);
}

function criterios() {
  const motivos = (obj) => Object.entries(obj).map(([c, m]) => `- \`${c}\`: ${typeof m === "string" ? m : m.rotulo}`).join("\n");
  return [
    "# Critérios das fases automáticas (os mesmos prompts da API)",
    "Use estes textos como a definição de CapEx, de repetição e de cada decisão. Eles são exatamente o que as fases automáticas recebem; o formato de saída que vale é o de `funil-noticias.md`, não o destes prompts.",
    "## Agente (criar projeto, vincular ou descartar)", agente.PROMPT,
    "## Filtro 2 (definição rígida de CapEx e fato repetido)", filtro2.PROMPT,
    "## Enriquecimento (leitura da matéria)", enriquecimento.PROMPT,
    "## Filtro 3 (veredito com a matéria lida)", filtro3.PROMPT,
    "## Motivos válidos",
    "### criar_projeto", MOTIVOS_CRIAR.map((c) => `- \`${c}\`: ${agente.MOTIVOS[c].rotulo}`).join("\n"),
    "### vincular", "- `mesmo_projeto`: mesmo projeto já cadastrado",
    "### descartar", motivos(MOTIVOS_DESCARTE),
    `## Estágios\n${ESTAGIOS.map((e) => `\`${e}\``).join(", ")}`,
  ].join("\n\n");
}

async function exportar(args) {
  if (!args.saida) throw new Error("Informe --saida <pasta>");
  fs.mkdirSync(args.saida, { recursive: true });
  const limite = Number(args.limite) || LIMITE_PADRAO;
  const grupos = await coletor.carregarGrupos(pool, args.grupo ? { nome: args.grupo } : {});
  const indice = [];
  for (const grupo of grupos) {
    const { rows: noticias } = await pool.query(
      `select e.id, e.titulo, e.veiculo, e.url, e.data_original, e.extracao, e.triagem,
              (select json_agg(json_build_object('projeto_id', s.projeto_id, 'confianca', s.confianca, 'motivo', s.motivo))
                 from capex_radar.evidencia_projeto s where s.evidencia_id = e.id and s.situacao = 'sugerido') as sugestoes
         from capex_radar.evidencias e
        where e.grupo_id = $1 and ${NA_FILA}
        order by e.data_original nulls last
        limit $2`,
      [grupo.id, limite],
    );
    if (!noticias.length) continue;
    const projetos = await agente.projetosParaComparar(pool, grupo.id);
    const manchetes = await agente.manchetesDoGrupo(pool, grupo.id);
    const ids = new Set(noticias.map((n) => String(n.id)));
    const datas = noticias.map((n) => dia(n.data_original)).filter(Boolean).sort();
    const desde = datas[0] ? new Date(Date.parse(datas[0]) - JANELA_PROXIMAS_DIAS * 86_400_000) : null;
    const ate = datas.length ? new Date(Date.parse(datas[datas.length - 1]) + JANELA_PROXIMAS_DIAS * 86_400_000) : null;
    const proximas = manchetes
      .filter((m) => !ids.has(String(m.id)) && m.situacao !== "na fila" && (!desde || (m.data_original >= desde && m.data_original <= ate)))
      .sort((a, b) => String(dia(a.data_original)).localeCompare(String(dia(b.data_original))))
      .map((m) => ({ id: m.id, data: dia(m.data_original), titulo: m.titulo, situacao: m.situacao }));
    const { rows: [matriz] } = await pool.query(
      "select cnpj, razao_social from capex_radar.matrizes where grupo_id = $1 order by (papel = 'principal') desc, razao_social limit 1",
      [grupo.id],
    );
    const doc = {
      empresa: grupo.nome,
      grupo_id: grupo.id,
      nicho: grupo.nicho,
      matriz: matriz || null,
      termos: (grupo.linhas || []).filter((l) => l.tipo !== "exclusao").map((l) => l.termo),
      projetos: projetos.map((p) => ({
        id: p.id, titulo: p.titulo, objeto: p.objeto, uf: p.uf, municipio: p.municipio, estagio: p.estagio,
        valor_brl: p.valor_estimado_brl == null ? null : Number(p.valor_estimado_brl), data_anuncio: dia(p.data_anuncio), noticias: p.noticias,
      })),
      noticias: noticias.map((n) => ({
        id: n.id, data: dia(n.data_original), titulo: n.titulo, veiculo: n.veiculo, url: n.url,
        leitura_previa: n.extracao && n.extracao.etapa !== "regras" ? n.extracao : null,
        sugestoes: n.sugestoes || [],
      })),
      manchetes_proximas: proximas.slice(-150),
    };
    const arquivo = `${nomeArquivo(grupo.nome)}.json`;
    fs.writeFileSync(path.join(args.saida, arquivo), JSON.stringify(doc, null, 1));
    indice.push({ arquivo, empresa: grupo.nome, noticias: noticias.length, projetos: projetos.length });
  }
  fs.writeFileSync(path.join(args.saida, "_criterios.md"), criterios());
  fs.writeFileSync(path.join(args.saida, "_indice.json"), JSON.stringify(indice, null, 1));
  const instrucoes = path.join(__dirname, "..", "docs", "claude-code", "funil-noticias.md");
  if (fs.existsSync(instrucoes)) fs.copyFileSync(instrucoes, path.join(args.saida, "funil-noticias.md"));
  console.table(indice);
  console.log(`${indice.reduce((n, x) => n + x.noticias, 0)} notícia(s) em ${indice.length} empresa(s). Instruções: ${path.join(args.saida, "funil-noticias.md")}`);
}

// ---------------------------------------------------------------------------
// aplicar
// ---------------------------------------------------------------------------

const texto = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const numero = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const dataValida = (v) => (/^\d{4}(-\d{2}){0,2}$/.test(String(v || "")) ? String(v) : null);

/** Erros de uma decisão (lista vazia = válida). refs: projetos novos citados por "ref:x". */
function validarDecisao(d, { projetosDoGrupo = new Set(), refs = new Set() } = {}) {
  const erros = [];
  if (!d || typeof d !== "object") return ["decisão vazia"];
  if (!d.evidencia_id) erros.push("sem evidencia_id");
  if (!DECISOES.includes(d.decisao)) erros.push(`decisão inválida: ${d.decisao}`);
  if (!texto(d.justificativa, 600)) erros.push("sem justificativa");
  if (d.decisao === "descartar" && !MOTIVOS_DESCARTE[d.motivo]) erros.push(`motivo de descarte inválido: ${d.motivo}`);
  if (d.decisao === "descartar" && d.motivo === "repetida" && !d.repete_id) erros.push("repetida sem repete_id");
  if (d.decisao === "vincular") {
    const alvo = String(d.projeto_id || "");
    if (!alvo) erros.push("vincular sem projeto_id");
    else if (alvo.startsWith("ref:") ? !refs.has(alvo.slice(4)) : !projetosDoGrupo.has(alvo)) erros.push(`projeto_id fora do grupo: ${alvo}`);
  }
  if (d.decisao === "criar_projeto") {
    const p = d.projeto || {};
    if (!texto(p.titulo, 200)) erros.push("criar_projeto sem projeto.titulo");
    if (!MOTIVOS_CRIAR.includes(d.motivo)) erros.push(`motivo de criação inválido: ${d.motivo}`);
    if (p.estagio && !ESTAGIOS.includes(p.estagio)) erros.push(`estágio inválido: ${p.estagio}`);
    if (p.uf && !/^[A-Z]{2}$/.test(p.uf)) erros.push(`UF inválida: ${p.uf}`);
    if (p.projeto_pai_id && (!RELACOES.includes(p.relacao) || !projetosDoGrupo.has(String(p.projeto_pai_id)))) erros.push("pai inválido (relacao ou id)");
  }
  if (d.leitura?.estagio && !ESTAGIOS.includes(d.leitura.estagio)) erros.push(`estágio da leitura inválido: ${d.leitura.estagio}`);
  return erros;
}

/** Leitura da manchete no formato do Filtro 1 (extracao). */
function extracaoDe(d) {
  const l = d.leitura || {};
  return {
    capex: d.decisao !== "descartar" || !["nao_investimento", "outra_empresa", "fora_brasil", "generico", "nao_capex"].includes(d.motivo),
    motivo: texto(d.justificativa, 300),
    objeto: texto(l.objeto, 300),
    uf: /^[A-Z]{2}$/.test(l.uf || "") ? l.uf : null,
    municipio: texto(l.municipio, 120),
    valor_brl: numero(l.valor_brl),
    estagio: ESTAGIOS.includes(l.estagio) ? l.estagio : null,
    data_fato: dataValida(l.data_fato),
    ampla: Boolean(l.ampla),
    etapa: "claude-code",
  };
}

function veredito(d, versao) {
  return {
    versao,
    modelo: MODELO,
    decisao: d.decisao === "descartar" ? "descartar" : "manter",
    motivo: d.decisao === "descartar" ? d.motivo : null,
    fato: texto(d.fato, 200),
    repete_id: d.repete_id || null,
    justificativa: texto(d.justificativa, 600),
    em: new Date().toISOString(),
  };
}

async function aplicar(args) {
  if (!args.arquivo) throw new Error("Informe --arquivo <decisoes.json>");
  const seco = Boolean(args.seco);
  const dados = JSON.parse(fs.readFileSync(args.arquivo, "utf8"));
  const decisoes = Array.isArray(dados) ? dados : dados.decisoes || [];
  const ids = decisoes.map((d) => d.evidencia_id).filter(Boolean);
  const { rows: noticias } = await pool.query(
    `select e.id, e.grupo_id, e.titulo, e.data_original, e.extracao, g.nome as grupo, (${NA_FILA}) as na_fila
       from capex_radar.evidencias e join capex_radar.grupos g on g.id = e.grupo_id
      where e.id = any($1::uuid[])`,
    [ids],
  );
  const porId = new Map(noticias.map((n) => [String(n.id), n]));
  const grupos = [...new Set(noticias.map((n) => n.grupo_id))];
  const { rows: projetos } = await pool.query(
    "select id, grupo_id from capex_radar.projetos where grupo_id = any($1::uuid[]) and status <> 'descartado'",
    [grupos],
  );
  const projetosPorGrupo = new Map();
  for (const p of projetos) {
    if (!projetosPorGrupo.has(p.grupo_id)) projetosPorGrupo.set(p.grupo_id, new Set());
    projetosPorGrupo.get(p.grupo_id).add(String(p.id));
  }
  // Validação de tudo antes de gravar qualquer coisa.
  const refs = new Map();
  const problemas = [];
  for (const d of decisoes) {
    const n = porId.get(String(d.evidencia_id));
    if (!n) { problemas.push({ evidencia_id: d.evidencia_id, erros: ["notícia não encontrada"] }); continue; }
    if (!n.na_fila) { problemas.push({ evidencia_id: d.evidencia_id, erros: ["notícia fora da fila (já decidida)"] }); continue; }
    if (d.decisao === "criar_projeto" && d.ref) refs.set(String(d.ref), n.grupo_id);
    const erros = validarDecisao(d, {
      projetosDoGrupo: projetosPorGrupo.get(n.grupo_id) || new Set(),
      refs: new Set([...refs].filter(([, g]) => g === n.grupo_id).map(([r]) => r)),
    });
    if (erros.length) problemas.push({ evidencia_id: d.evidencia_id, titulo: n.titulo.slice(0, 80), erros });
  }
  const resumo = { decisoes: decisoes.length, criar_projeto: 0, vincular: 0, descartar: 0 };
  for (const d of decisoes) resumo[d.decisao] = (resumo[d.decisao] || 0) + 1;
  console.log(JSON.stringify(resumo));
  if (problemas.length) {
    console.table(problemas.map((p) => ({ ...p, erros: p.erros.join("; ") })));
    throw new Error(`${problemas.length} decisão(ões) com erro: nada foi gravado.`);
  }
  if (seco) { console.log("Modo seco: tudo válido, nada gravado."); return; }

  const criados = new Map();
  const tocados = new Set();
  const matrizes = new Map();
  // Ordem: criações primeiro (para os vínculos por ref), depois o resto.
  const ordem = [...decisoes].sort((a, b) => (a.decisao === "criar_projeto" ? 0 : 1) - (b.decisao === "criar_projeto" ? 0 : 1));
  for (const d of ordem) {
    const n = porId.get(String(d.evidencia_id));
    const extracao = extracaoDe(d);
    const m = d.materia;
    if (m && typeof m === "object") {
      extracao.filial_sugerida = await coletor.sugerirFilial(pool, n.grupo_id, m.perfil?.uf ? m.perfil : extracao).catch(() => null);
    } else {
      extracao.filial_sugerida = await coletor.sugerirFilial(pool, n.grupo_id, extracao).catch(() => null);
    }
    // Leitura da manchete, Filtro 2 e (com matéria lida) Enriquecimento e Filtro 3.
    await painel.emTransacao(async (client) => {
      await client.query(
        `update capex_radar.evidencias
            set extracao = $2::jsonb, modelo_triagem = $3, uf = coalesce(uf, $4), municipio = coalesce(municipio, $5),
                filtro = $6::jsonb, filtro_final = $7::jsonb
          where id = $1`,
        [n.id, JSON.stringify(extracao), MODELO, extracao.uf, extracao.municipio,
          JSON.stringify(veredito(d, filtro2.VERSAO_FILTRO)), JSON.stringify(veredito(d, filtro3.VERSAO))],
      );
      if (m && typeof m === "object") {
        const registro = {
          versao: enriquecimento.VERSAO, modelo: MODELO, encontrou: Boolean(m.encontrou),
          url_original: texto(m.url_original, 500), veiculo_original: texto(m.veiculo_original, 120),
          resumo: texto(m.resumo, 1500), perfil: m.perfil || {}, trechos: (m.trechos || []).slice(0, 3).map((t) => String(t).slice(0, 600)),
          observacao: texto(m.observacao, 300), buscas: 0, leituras: m.encontrou ? 1 : 0, em: new Date().toISOString(),
        };
        const corpo = [registro.resumo, ...registro.trechos].filter(Boolean).join("\n\n") || null;
        await client.query(
          `update capex_radar.evidencias set enriquecimento = $2::jsonb, texto = coalesce($3, texto),
                  uf = coalesce($4, uf), municipio = coalesce($5, municipio) where id = $1`,
          [n.id, JSON.stringify(registro), corpo, registro.perfil?.uf || null, registro.perfil?.municipio || null],
        );
      }
    }, ATOR);
    // A decisão do agente.
    const vinculo = { confianca: numero(d.confianca), motivo: texto(d.justificativa, 300), modelo: MODELO };
    let acao;
    let projetoId = null;
    if (d.decisao === "descartar") {
      await painel.descartarNoticia(n.id, rotuloDescarte(d.motivo), { ator: ATOR, rotulo: "Claude Code" });
      acao = "descartada";
    } else if (d.decisao === "vincular") {
      const alvo = String(d.projeto_id);
      projetoId = alvo.startsWith("ref:") ? criados.get(alvo.slice(4)) : alvo;
      await painel.vincularNoticia(n.id, projetoId, { ator: ATOR, origem: "ia", vinculo });
      acao = "vinculada";
    } else {
      if (!matrizes.has(n.grupo_id)) {
        const { rows: [mz] } = await pool.query(
          "select cnpj from capex_radar.matrizes where grupo_id = $1 order by (papel = 'principal') desc, razao_social limit 1", [n.grupo_id]);
        matrizes.set(n.grupo_id, mz?.cnpj || null);
      }
      const matriz = matrizes.get(n.grupo_id);
      if (!matriz) throw new Error(`${n.grupo} não tem CNPJ de matriz: o projeto não pode nascer (${n.titulo})`);
      const p = d.projeto;
      const dataFato = /^\d{4}-\d{2}-\d{2}$/.test(p.data_fato || "") ? p.data_fato : null;
      const projeto = await painel.criarProjetoDaNoticia(n.id, {
        titulo: `${n.grupo} — ${p.titulo}`.slice(0, 200),
        matriz_cnpj: matriz,
        filial_cnpj: extracao.filial_sugerida?.cnpj || null,
        uf: p.uf || extracao.uf || null,
        municipio: p.municipio || extracao.municipio || null,
        objeto: texto(p.objeto, 300) || extracao.objeto,
        valor_estimado_brl: numero(p.valor_brl) ?? extracao.valor_brl,
        estagio: p.estagio || extracao.estagio || "anuncio",
        data_anuncio: dataFato || dia(n.data_original),
        ...(p.projeto_pai_id ? { projeto_pai_id: p.projeto_pai_id, relacao: p.relacao } : {}),
      }, { ator: ATOR, origem: "ia", status: "em_revisao", vinculo });
      if (d.ref) criados.set(String(d.ref), projeto.id);
      projetoId = projeto.id;
      acao = "projeto_criado";
    }
    if (projetoId) tocados.add(String(projetoId));
    // Registro na aba Agente, para avaliação humana (correta/incorreta).
    await pool.query(
      `insert into capex_radar.agente_decisao
         (evidencia_id, grupo_id, modelo, versao_prompt, entrada, saida, decisao, motivo, confianca, acao, acao_motivo, projeto_id)
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12)`,
      [n.id, n.grupo_id, MODELO, VERSAO_DECISAO, JSON.stringify({ noticia: { titulo: n.titulo, data: dia(n.data_original) } }),
        JSON.stringify({ decisao: d.decisao, motivo: d.motivo, confianca: numero(d.confianca), justificativa: d.justificativa, projeto: d.projeto || null, leitura: d.leitura || null }),
        d.decisao, d.motivo || null, numero(d.confianca), acao, "Funil pelo Claude Code", projetoId],
    );
  }
  // Projetos tocados: marcos provisórios na linha do tempo e perfil refeito.
  const sec = require("../src/capex-fontes-secundarias");
  for (const id of tocados) {
    await sec.incluirNaLinhaDoTempo(pool, id, { cronista: null, ator: ATOR }).catch((e) => console.error(`linha do tempo de ${id}: ${e.message}`));
  }
  console.log(JSON.stringify({ gravadas: decisoes.length, ...resumo, projetos_tocados: [...tocados] }));
  console.log("Próximo passo: refazer a linha do tempo dos projetos tocados (capex:reprocessar -- dossie --projeto <id>, docs/claude-code/linha-do-tempo.md).");
}

async function main() {
  const args = argumentos(process.argv.slice(2));
  const comandos = { contar, exportar, aplicar };
  if (!comandos[args.comando]) throw new Error(`Comando desconhecido: ${args.comando || "(nenhum)"}. Use contar, exportar ou aplicar.`);
  await comandos[args.comando](args);
}

if (require.main === module) {
  main()
    .catch((error) => { console.error(error.message); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { validarDecisao, extracaoDe, veredito, MOTIVOS_DESCARTE, MOTIVOS_CRIAR, NA_FILA };
