// Reprocessamento da carteira no fluxo v2 (src/capex-fases.js), com o
// julgamento feito fora do Radar (Claude Code), sem a API e sem captação nova.
//
// Passos, por projeto ativo:
//   1. dossie    exporta o projeto, as notícias ligadas (manchete, leitura,
//                matéria) e os outros projetos do grupo, para decidir o
//                Filtro 1 (notícia ampla, repetida, de outro projeto) e a
//                separação em subprojetos e localidades.
//   2. coletar   consulta as fontes secundárias sem julgamento: todo
//                registro analisado fica em registros_analisados como
//                'nao_avaliada' (ou outro_estado).
//   3. registros exporta os registros a julgar e as notícias do projeto.
//   4. aplicar   lê o arquivo de decisões e aplica: Filtro 1, subprojetos,
//                julgamento dos registros, linha do tempo, cronologia e
//                perfil completo.
//
// Uso:
//   npm run capex:reprocessar -- dossie --saida <pasta> [--projeto <id>]
//   npm run capex:reprocessar -- coletar [--projeto <id>] [--limite N]
//   npm run capex:reprocessar -- registros --saida <pasta> [--projeto <id>]
//   npm run capex:reprocessar -- aplicar --arquivo <decisoes.json> [--seco]
//
// Arquivo de decisões (um objeto ou uma lista de objetos):
// {
//   "projeto_id": "...",
//   "filtro1": [{ "evidencia_id": "...", "descarte": "ampla|repetida|outro_projeto", "motivo": "..." }],
//   "novos_projetos": [{ "ref": "a", "titulo": "...", "objeto": "...", "uf": "MS", "municipio": "...",
//                        "valor_brl": null, "estagio": "anuncio", "relacao": "expansao|subprojeto|localidade",
//                        "pai": "<projeto_id ou ref>", "evidencias": ["<evidencia_id>"], "mover": true }],
//   "pai": { "projeto_id": "...", "relacao": "expansao|subprojeto|localidade" },
//   "registros": [{ "chave": "...", "correlacao": "direta|incerta|outro_projeto", "motivo": "..." }],
//   "linha_tempo": { "resumo": "...", "estagio": "obra", "marcos": [{ "data": "2024-03", "marco": "...",
//                    "tipo": "anuncio", "evidencias": ["<evidencia_id>"] }] }
// }
const fs = require("node:fs");
const path = require("node:path");
const { pool } = require("../src/db");
const painel = require("../src/capex-painel-db");
const sec = require("../src/capex-fontes-secundarias");
const perfis = require("../src/capex-perfil");

const ATOR = "usuario:claude-code";
const TIPOS_MARCO = ["anuncio", "licenca", "financiamento", "terreno", "contratacao", "obra", "operacao", "atraso", "cancelamento", "outro"];
const ESTAGIOS = ["anuncio", "licenciamento", "funding", "contratacao_epc", "mobilizacao", "operacao", "desaceleracao", "cancelado"];
const RELACOES = ["expansao", "subprojeto", "localidade"];
const DESCARTES = ["ampla", "repetida", "outro_projeto"];

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

async function projetosAtivos(projetoId) {
  const { rows } = await pool.query(
    `select v.*, p.objeto, p.secundarias, p.linha_tempo, p.data_fim, p.projeto_pai_id, p.relacao
       from capex_radar.vw_carteira v
       join capex_radar.projetos p on p.id = v.id
      where ${projetoId ? "v.id = $1" : "v.status = 'ativo'"}
      order by v.grupo, v.valor_estimado_brl desc nulls last`,
    projetoId ? [projetoId] : [],
  );
  return rows;
}

async function noticiasDoProjeto(projetoId) {
  const { rows } = await pool.query(
    `select e.id, e.titulo, e.veiculo, e.data_original, e.fonte_codigo, e.url,
            e.extracao, e.enriquecimento, e.filtro, e.filtro_final, ep.origem
       from capex_radar.evidencia_projeto ep
       join capex_radar.evidencias e on e.id = ep.evidencia_id
      where ep.projeto_id = $1 and ep.situacao = 'aceito'
      order by e.data_original nulls last`,
    [projetoId],
  );
  return rows.map((e) => ({
    id: e.id,
    data: dia(e.data_original),
    fonte: e.fonte_codigo === "gnews_rss" ? `notícia: ${e.veiculo || ""}` : `registro: ${e.fonte_codigo}`,
    titulo: e.titulo,
    leitura_manchete: e.extracao ? {
      objeto: e.extracao.objeto ?? null, uf: e.extracao.uf ?? null, municipio: e.extracao.municipio ?? null,
      valor_brl: e.extracao.valor_brl ?? null, estagio: e.extracao.estagio ?? null,
    } : null,
    materia: e.enriquecimento?.perfil ? {
      encontrou: e.enriquecimento.encontrou, resumo: e.enriquecimento.resumo,
      trechos: (e.enriquecimento.trechos || []).slice(0, 3), perfil: e.enriquecimento.perfil,
      observacao: e.enriquecimento.observacao || null,
    } : null,
  }));
}

async function outrosDoGrupo(grupoId, exceto) {
  const { rows } = await pool.query(
    `select id, titulo, uf, municipio, estagio, status, projeto_pai_id, relacao
       from capex_radar.projetos where grupo_id = $1 and id <> $2 and status <> 'descartado'
      order by titulo`,
    [grupoId, exceto],
  );
  return rows;
}

async function dossie(args) {
  if (!args.saida) throw new Error("Informe --saida <pasta>");
  fs.mkdirSync(args.saida, { recursive: true });
  const projetos = await projetosAtivos(args.projeto);
  for (const p of projetos) {
    const doc = {
      projeto: {
        id: p.id, titulo: p.titulo, grupo: p.grupo, nicho: p.nicho, objeto: p.objeto,
        uf: p.uf, municipio: p.municipio, local_origem: p.local_origem, valor_brl: p.valor_estimado_brl == null ? null : Number(p.valor_estimado_brl),
        estagio: p.estagio, data_anuncio: dia(p.data_anuncio), data_fim: dia(p.data_fim),
        projeto_pai_id: p.projeto_pai_id, relacao: p.relacao,
      },
      noticias: await noticiasDoProjeto(p.id),
      outros_projetos_do_grupo: await outrosDoGrupo(p.grupo_id, p.id),
    };
    fs.writeFileSync(path.join(args.saida, `${p.id}.json`), JSON.stringify(doc, null, 1));
  }
  console.log(`${projetos.length} dossiê(s) em ${args.saida}`);
}

async function coletar(args) {
  const todos = await projetosAtivos(args.projeto);
  const limite = args.limite ? Number(args.limite) : todos.length;
  // Retomável: pula quem já foi coletado nesta rodada (secundarias.julgamento = pendente ou externo).
  const fila = todos.filter((p) => args.projeto || args.refazer || !["pendente", "externo"].includes(p.secundarias?.julgamento)).slice(0, limite);
  console.log(`${fila.length} projeto(s) para coletar (de ${todos.length}).`);
  for (const [i, p] of fila.entries()) {
    const inicio = Date.now();
    try {
      const [r] = await sec.consultarFontes(pool, [p], { semJulgamento: true });
      console.log(`${i + 1}/${fila.length} ${p.titulo}: ${r.fontes.length} fonte(s), ${r.analisados} registro(s) analisado(s) (${Math.round((Date.now() - inicio) / 1000)}s)`);
    } catch (error) {
      console.log(`${i + 1}/${fila.length} ${p.titulo}: erro (${error.message})`);
    }
  }
}

async function registros(args) {
  if (!args.saida) throw new Error("Informe --saida <pasta>");
  fs.mkdirSync(args.saida, { recursive: true });
  const projetos = await projetosAtivos(args.projeto);
  let total = 0;
  for (const p of projetos) {
    const { rows } = await pool.query(
      `select chave, fonte_codigo, data_registro, correlacao, motivo, registro
         from capex_radar.registros_analisados
        where projeto_id = $1 and correlacao <> 'outro_estado'
        order by fonte_codigo, data_registro nulls last`,
      [p.id],
    );
    const doc = {
      projeto: { id: p.id, titulo: p.titulo, grupo: p.grupo, objeto: p.objeto, uf: p.uf, municipio: p.municipio, cnpj_matriz: p.matriz_cnpj, razao_social: p.matriz_razao_social, data_anuncio: dia(p.data_anuncio) },
      noticias: (await noticiasDoProjeto(p.id)).map((n) => ({ id: n.id, data: n.data, titulo: n.titulo, resumo: n.materia?.resumo || null, trechos: n.materia?.trechos || [] })),
      registros: rows.map((r) => {
        const { contexto, ...campos } = r.registro || {};
        return {
          chave: r.chave, fonte: r.fonte_codigo, data: dia(r.data_registro), situacao_atual: r.correlacao,
          campos: JSON.stringify(campos).slice(0, 1200), contexto: contexto ? String(contexto).slice(0, 1500) : null,
        };
      }),
    };
    total += rows.length;
    fs.writeFileSync(path.join(args.saida, `${p.id}.json`), JSON.stringify(doc, null, 1));
  }
  console.log(`${projetos.length} projeto(s), ${total} registro(s) em ${args.saida}`);
}

// ---------------------------------------------------------------------------
// Aplicar decisões
// ---------------------------------------------------------------------------

function validar(d) {
  const erros = [];
  if (!d.projeto_id) erros.push("projeto_id ausente");
  for (const f of d.filtro1 || []) if (!DESCARTES.includes(f.descarte)) erros.push(`descarte inválido: ${f.descarte}`);
  for (const n of d.novos_projetos || []) {
    if (!n.titulo || !RELACOES.includes(n.relacao)) erros.push(`novo projeto sem título ou relação: ${n.ref}`);
    if (n.estagio && !ESTAGIOS.includes(n.estagio)) erros.push(`estágio inválido: ${n.estagio}`);
  }
  if (d.pai && !RELACOES.includes(d.pai.relacao)) erros.push("relação do pai inválida");
  for (const m of d.linha_tempo?.marcos || []) {
    if (!TIPOS_MARCO.includes(m.tipo)) erros.push(`tipo de marco inválido: ${m.tipo}`);
    if (m.data && !/^\d{4}(-\d{2}){0,2}$/.test(m.data)) erros.push(`data de marco inválida: ${m.data}`);
  }
  if (d.linha_tempo?.estagio && !ESTAGIOS.includes(d.linha_tempo.estagio)) erros.push(`estágio inválido: ${d.linha_tempo.estagio}`);
  return erros;
}

async function aplicarFiltro1(client, projetoId, itens) {
  let n = 0;
  for (const f of itens) {
    const r = await client.query(
      `update capex_radar.evidencia_projeto
          set situacao = 'rejeitado', descarte = $3, motivo = $4, revisado_por = $5, revisado_em = now()
        where projeto_id = $1 and evidencia_id = $2 and situacao = 'aceito'`,
      [projetoId, f.evidencia_id, f.descarte, `Filtro 1: ${f.motivo || f.descarte}`.slice(0, 300), ATOR],
    );
    n += r.rowCount;
  }
  return n;
}

async function criarNovos(client, projeto, novos) {
  const refs = new Map();
  const criados = [];
  for (const n of novos) {
    const pai = n.pai === "self" || !n.pai ? projeto.id : refs.get(n.pai) || n.pai;
    const primeira = (n.evidencias || [])[0] || null;
    const { rows: [novo] } = await client.query(
      `insert into capex_radar.projetos
         (titulo, grupo_id, matriz_cnpj, uf, municipio, objeto, valor_estimado_brl, fonte_valor,
          estagio, data_anuncio, evidencia_primaria_id, status, projeto_pai_id, relacao, criado_por)
       select $1, p.grupo_id, p.matriz_cnpj, $2, $3, $4, $5, case when $5::numeric is null then null else 'noticia' end,
              coalesce($6, 'anuncio'), $7, $8, 'ativo', $9, $10, $11
         from capex_radar.projetos p where p.id = $12
       returning id, titulo`,
      [n.titulo.slice(0, 200), n.uf || null, n.municipio || null, n.objeto || null, n.valor_brl ?? null,
        n.estagio || null, n.data_anuncio || null, primeira, pai, n.relacao, ATOR, projeto.id],
    );
    if (n.ref) refs.set(n.ref, novo.id);
    for (const ev of n.evidencias || []) {
      await client.query(
        `insert into capex_radar.evidencia_projeto (evidencia_id, projeto_id, origem, situacao, motivo, revisado_por, revisado_em)
         values ($1, $2, 'manual', 'aceito', $3, $4, now())
         on conflict (evidencia_id, projeto_id) do update set situacao = 'aceito', descarte = null`,
        [ev, novo.id, `Perfil inicial: ${n.relacao}`, ATOR],
      );
      if (n.mover !== false) {
        await client.query(
          `update capex_radar.evidencia_projeto
              set situacao = 'rejeitado', descarte = 'outro_projeto', motivo = $3, revisado_por = $4, revisado_em = now()
            where projeto_id = $1 and evidencia_id = $2 and situacao = 'aceito'`,
          [projeto.id, ev, `Perfil inicial: movida para ${novo.titulo}`.slice(0, 300), ATOR],
        );
      }
    }
    criados.push(novo);
  }
  return criados;
}

async function gravarLinha(projetoId, linha, evidenciasValidas) {
  const ids = new Set(evidenciasValidas.map((e) => String(e.id)));
  const marcos = (linha.marcos || [])
    .map((m) => ({ data: m.data || null, marco: String(m.marco).slice(0, 400), tipo: m.tipo, evidencias: (m.evidencias || []).map(String).filter((id) => ids.has(id)) }))
    .sort((a, b) => String(a.data || "9999").localeCompare(String(b.data || "9999")));
  const registro = {
    versao: sec.VERSAO_LINHA, modelo: "claude-code", resumo: String(linha.resumo || "").slice(0, 1500),
    estagio: linha.estagio || null, marcos, evidencias: evidenciasValidas.length, em: new Date().toISOString(),
  };
  await painel.emTransacao(async (client) => {
    const { rows: [p] } = await client.query("select estagio from capex_radar.projetos where id = $1", [projetoId]);
    const muda = sec.avancaEstagio(p.estagio, linha.estagio);
    await client.query(
      `update capex_radar.projetos set linha_tempo = $2::jsonb,
              estagio = case when $3 then $4 else estagio end, atualizado_em = now()
        where id = $1`,
      [projetoId, JSON.stringify(registro), muda, linha.estagio || null],
    );
  }, ATOR);
  return registro;
}

async function aplicarUma(d, { seco }) {
  const erros = validar(d);
  if (erros.length) return { projeto_id: d.projeto_id, erros };
  const [projeto] = await projetosAtivos(d.projeto_id);
  if (!projeto) return { projeto_id: d.projeto_id, erros: ["projeto não encontrado"] };
  if (seco) return { projeto: projeto.titulo, ok: "validado" };
  const r = { projeto: projeto.titulo };
  // Passo 1: Filtro 1, pai e subprojetos.
  const passo1 = await painel.emTransacao(async (client) => {
    const removidas = await aplicarFiltro1(client, projeto.id, d.filtro1 || []);
    if (d.pai?.projeto_id) {
      await client.query("update capex_radar.projetos set projeto_pai_id = $2, relacao = $3 where id = $1", [projeto.id, d.pai.projeto_id, d.pai.relacao]);
    }
    const novos = await criarNovos(client, projeto, d.novos_projetos || []);
    return { removidas, novos };
  }, ATOR);
  r.filtro1 = passo1.removidas;
  r.novos = passo1.novos.map((n) => n.titulo);
  // Passo 2: julgamento dos registros.
  if (d.registros?.length) {
    const j = await sec.aplicarJulgamento(pool, projeto, d.registros, { ator: ATOR });
    r.registros = j;
    await painel.emTransacao((client) => client.query(
      "update capex_radar.projetos set secundarias = secundarias || jsonb_build_object('julgamento', 'externo', 'julgado_em', now()) where id = $1",
      [projeto.id],
    ), ATOR);
  }
  // Linha do tempo, cronologia e perfil.
  const atuais = await sec.evidenciasDoProjeto(pool, projeto.id);
  if (d.linha_tempo) {
    const linha = await gravarLinha(projeto.id, d.linha_tempo, atuais);
    r.marcos = linha.marcos.length;
  }
  const [recarregado] = await projetosAtivos(projeto.id);
  const fora = sec.foraDaCronologia(recarregado, atuais);
  r.fora_da_cronologia = await sec.aplicarCronologia(projeto.id, fora, ATOR);
  if (r.fora_da_cronologia && d.linha_tempo) {
    const restantes = await sec.evidenciasDoProjeto(pool, projeto.id);
    await gravarLinha(projeto.id, d.linha_tempo, restantes);
  }
  const perfil = await painel.emTransacao((client) => perfis.montarPerfil(client, projeto.id), ATOR);
  r.perfil = perfil?.etapa;
  for (const novo of passo1.novos) {
    await painel.emTransacao((client) => perfis.montarPerfil(client, novo.id), ATOR);
  }
  return r;
}

async function aplicar(args) {
  if (!args.arquivo) throw new Error("Informe --arquivo <decisoes.json>");
  const dados = JSON.parse(fs.readFileSync(args.arquivo, "utf8"));
  const lista = Array.isArray(dados) ? dados : [dados];
  for (const d of lista) {
    try {
      console.log(JSON.stringify(await aplicarUma(d, { seco: Boolean(args.seco) })));
    } catch (error) {
      console.log(JSON.stringify({ projeto_id: d.projeto_id, erro: error.message }));
    }
  }
}

async function main() {
  const args = argumentos(process.argv.slice(2));
  const comandos = { dossie, coletar, registros, aplicar };
  if (!comandos[args.comando]) throw new Error("Comandos: dossie, coletar, registros, aplicar");
  await comandos[args.comando](args);
}

main()
  .catch((error) => {
    console.error(`Falha: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
