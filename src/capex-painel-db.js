// Leituras e decisões da tela de Monitoramento (capex_radar, Fase 4).
//
// Toda escrita roda numa transação com o ator usuario:painel, para o
// log_acao registrar quem decidiu. A IA só sugere; aqui a revisão aceita,
// rejeita, cria projeto ou descarta a notícia.
const { pool } = require("./db");

const ATOR = "usuario:painel";

// Situações da notícia na tela, a partir de triagem, extracao e vínculos.
const SITUACOES = {
  revisar: "A revisar",
  nao_triadas: "Sem triagem",
  vinculadas: "Vinculadas",
  descartadas: "Descartadas",
  todas: "Todas",
};

const FILTRO_SITUACAO = {
  revisar: `(e.triagem = 'novo_projeto' or (e.triagem = 'pendente' and e.extracao is not null)
             or exists (select 1 from capex_radar.evidencia_projeto s where s.evidencia_id = e.id and s.situacao = 'sugerido'))`,
  nao_triadas: "e.triagem = 'pendente' and e.extracao is null",
  vinculadas: "e.triagem = 'vinculada'",
  descartadas: "e.triagem = 'descartada'",
  todas: "true",
};

async function emTransacao(trabalho, ator = ATOR) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('capex_radar.ator', $1, true)", [ator]);
    const resultado = await trabalho(client);
    await client.query("commit");
    return resultado;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function resumoGrupos() {
  const { rows } = await pool.query(`
    select g.id, g.nome, g.nicho,
           count(e.id)::int as total,
           count(e.id) filter (where e.triagem = 'pendente' and e.extracao is null)::int as nao_triadas,
           count(e.id) filter (where ${FILTRO_SITUACAO.revisar})::int as revisar,
           count(e.id) filter (where e.triagem = 'vinculada')::int as vinculadas,
           count(e.id) filter (where e.triagem = 'descartada')::int as descartadas,
           (select count(*)::int from capex_radar.projetos p
             where p.grupo_id = g.id and p.status <> 'descartado') as projetos,
           (select max(j.coletado_em) from capex_radar.coleta_janela j
             where j.grupo_id = g.id and j.status = 'ok') as ultima_coleta
      from capex_radar.grupos g
      left join capex_radar.evidencias e on e.grupo_id = g.id
     where g.ativo
     group by g.id
     order by g.nicho, g.nome`);
  return rows;
}

async function listarNoticias({ grupoId = null, situacao = "revisar", limite = 150, id = null } = {}) {
  const filtro = id ? "e.id = $3" : FILTRO_SITUACAO[situacao] || FILTRO_SITUACAO.revisar;
  const { rows } = await pool.query(
    `select e.id, e.titulo, e.url, e.veiculo, e.data_original, e.triagem, e.triagem_motivo,
            e.extracao, g.id as grupo_id, g.nome as grupo, g.nicho,
            sug.projeto_id as sugerido_projeto_id, sug.projeto_titulo as sugerido_projeto,
            sug.confianca as sugerido_confianca,
            ag.decisao as agente_decisao, ag.motivo as agente_motivo, ag.confianca as agente_confianca,
            ag.acao as agente_acao, ag.acao_motivo as agente_trava
       from capex_radar.evidencias e
       join capex_radar.grupos g on g.id = e.grupo_id
       left join lateral (
         select ep.projeto_id, p.titulo as projeto_titulo, ep.confianca
           from capex_radar.evidencia_projeto ep
           join capex_radar.projetos p on p.id = ep.projeto_id
          where ep.evidencia_id = e.id and ep.situacao = 'sugerido'
          order by ep.confianca desc nulls last
          limit 1
       ) sug on true
       left join lateral (
         select d.decisao, d.motivo, d.confianca, d.acao, d.acao_motivo
           from capex_radar.agente_decisao d
          where d.evidencia_id = e.id
          order by d.criado_em desc
          limit 1
       ) ag on true
      where ($1::uuid is null or e.grupo_id = $1) and ${filtro}
      order by e.data_original desc nulls last
      limit $2`,
    id ? [grupoId, limite, id] : [grupoId, limite],
  );
  return rows;
}

/** Uma notícia no formato do card, para redesenhar só ele depois de uma ação. */
async function noticiaDoCard(id) {
  return (await listarNoticias({ id, limite: 1 }))[0] || null;
}

function diaIso(valor) {
  return valor ? new Date(valor).toISOString().slice(0, 10) : null;
}

/**
 * Aprovação com um clique a partir do card: aceita a sugestão de vínculo da
 * IA ou cria o projeto com a leitura da IA (matriz principal, filial sugerida).
 */
async function aprovarNoticia(evidenciaId) {
  const { rows: [noticia] } = await pool.query(
    `select e.id, e.titulo, e.extracao, e.data_original, g.nome as grupo,
            (select ep.projeto_id from capex_radar.evidencia_projeto ep
              where ep.evidencia_id = e.id and ep.situacao = 'sugerido'
              order by ep.confianca desc nulls last limit 1) as sugerido,
            (select m.cnpj from capex_radar.matrizes m where m.grupo_id = e.grupo_id
              order by (m.papel = 'principal') desc, m.razao_social limit 1) as matriz
       from capex_radar.evidencias e
       join capex_radar.grupos g on g.id = e.grupo_id
      where e.id = $1`,
    [evidenciaId],
  );
  if (!noticia) throw new Error("Notícia não encontrada");
  if (noticia.sugerido) {
    await vincularNoticia(evidenciaId, noticia.sugerido);
    return { acao: "vinculada", projeto_id: noticia.sugerido };
  }
  if (!noticia.matriz) throw new Error(`${noticia.grupo} ainda não tem CNPJ cadastrado; o projeto não pode nascer.`);
  const ex = noticia.extracao || {};
  const dataFato = /^\d{4}-\d{2}-\d{2}$/.test(ex.data_fato || "") ? ex.data_fato : null;
  const projeto = await criarProjetoDaNoticia(evidenciaId, {
    titulo: `${noticia.grupo} — ${ex.objeto || noticia.titulo}`.slice(0, 200),
    matriz_cnpj: noticia.matriz,
    filial_cnpj: ex.filial_sugerida?.cnpj || null,
    uf: ex.uf || null,
    municipio: ex.municipio || null,
    objeto: ex.objeto || null,
    valor_estimado_brl: ex.valor_brl ?? null,
    estagio: ex.estagio || "anuncio",
    data_anuncio: dataFato || diaIso(noticia.data_original),
  });
  return { acao: "projeto_criado", projeto_id: projeto.id, projeto_titulo: projeto.titulo };
}

/** Desfaz um descarte: a notícia volta para a revisão (ou para a fila da IA). */
async function restaurarNoticia(evidenciaId) {
  return emTransacao(async (client) => {
    await client.query(
      `update capex_radar.evidencias
          set triagem = case when (extracao->>'capex')::boolean then 'novo_projeto' else 'pendente' end,
              triagem_motivo = null,
              extracao = case when extracao->>'etapa' = 'regras' then null else extracao end
        where id = $1 and triagem = 'descartada'`,
      [evidenciaId],
    );
    // Desfazer um descarte do agente pelo card conta como avaliação: estava errado.
    await client.query(
      `update capex_radar.agente_decisao
          set desfeita = true,
              avaliacao = coalesce(avaliacao, 'incorreta'),
              avaliado_por = coalesce(avaliado_por, $2), avaliado_em = coalesce(avaliado_em, now())
        where evidencia_id = $1 and acao = 'descartada' and not desfeita`,
      [evidenciaId, `${ATOR} (desfez)`],
    ).catch((error) => { if (error.code !== "42P01") throw error; });
  });
}

/** Janelas de busca de um grupo, com a consulta usada e o resultado. */
async function historicoBuscas(grupoId) {
  const [grupo, termos, janelas] = await Promise.all([
    pool.query("select id, nome, nicho from capex_radar.grupos where id = $1", [grupoId]),
    pool.query(
      `select termo, tipo, ativo from capex_radar.grupo_termos
        where grupo_id = $1 order by ativo desc, tipo, termo`,
      [grupoId],
    ),
    pool.query(
      `select to_char(j.desde, 'YYYY-MM-DD') as desde, to_char(j.ate, 'YYYY-MM-DD') as ate,
              j.consulta, j.itens, j.novos, j.status, j.erro, j.coletado_em,
              (select count(*)::int from capex_radar.evidencias e
                where e.grupo_id = j.grupo_id and e.data_original >= j.desde and e.data_original < j.ate) as guardadas
         from capex_radar.coleta_janela j
        where j.grupo_id = $1
        order by j.coletado_em desc, j.desde desc
        limit 200`,
      [grupoId],
    ),
  ]);
  if (!grupo.rows[0]) return null;
  return { grupo: grupo.rows[0], termos: termos.rows, janelas: janelas.rows };
}

/** Notícias guardadas de um grupo numa janela [desde, ate). */
async function noticiasDaJanela(grupoId, desde, ate) {
  const { rows } = await pool.query(
    `select id, titulo, veiculo, data_original, triagem, url
       from capex_radar.evidencias
      where grupo_id = $1 and data_original >= $2 and data_original < $3
      order by data_original desc
      limit 120`,
    [grupoId, desde, ate],
  );
  return rows;
}

async function obterNoticia(id) {
  const { rows } = await pool.query(
    `select e.*, g.nome as grupo, g.nicho
       from capex_radar.evidencias e
       left join capex_radar.grupos g on g.id = e.grupo_id
      where e.id = $1`,
    [id],
  );
  const noticia = rows[0];
  if (!noticia) return null;
  const [vinculos, projetos, matrizes, filiais] = await Promise.all([
    pool.query(
      `select ep.*, p.titulo as projeto_titulo
         from capex_radar.evidencia_projeto ep
         join capex_radar.projetos p on p.id = ep.projeto_id
        where ep.evidencia_id = $1
        order by ep.sugerido_em`,
      [id],
    ),
    pool.query(
      `select id, titulo, uf, municipio, estagio from capex_radar.projetos
        where grupo_id = $1 and status <> 'descartado' order by atualizado_em desc`,
      [noticia.grupo_id],
    ),
    pool.query(
      `select cnpj, razao_social, papel, uf, municipio from capex_radar.matrizes
        where grupo_id = $1 order by (papel = 'principal') desc, razao_social`,
      [noticia.grupo_id],
    ),
    pool.query(
      `select cnpj, municipio, uf, prioridade, nome_fantasia from capex_radar.vw_filiais
        where grupo_id = $1 and prioritaria
          and ($2::text is null or uf = $2)
        order by uf, municipio, cnpj
        limit 300`,
      [noticia.grupo_id, noticia.extracao?.uf || noticia.uf || null],
    ),
  ]);
  return {
    noticia,
    vinculos: vinculos.rows,
    projetos: projetos.rows,
    matrizes: matrizes.rows,
    filiais: filiais.rows,
  };
}

// Quando a revisão humana decide uma notícia que o agente deixou para ela,
// a decisão humana vira o rótulo da decisão do agente (conjunto de treino).
async function rotularPelaRevisao(client, evidenciaId, decisaoHumana, motivo = null) {
  await client.query(
    `update capex_radar.agente_decisao
        set avaliacao = case when decisao = $2 then 'correta' else 'incorreta' end,
            decisao_correta = $2, motivo_correto = $3,
            avaliado_por = $4, avaliado_em = now()
      where evidencia_id = $1 and acao = 'revisao_humana' and avaliacao is null`,
    [evidenciaId, decisaoHumana, motivo, `${ATOR} (revisão)`],
  ).catch((error) => {
    // Sem a migração 022 a tabela não existe; a revisão segue normalmente.
    if (error.code !== "42P01") throw error;
  });
}

async function marcarVinculada(client, evidenciaId) {
  await client.query(
    "update capex_radar.evidencias set triagem = 'vinculada' where id = $1",
    [evidenciaId],
  );
}

/**
 * Cria o projeto a partir da notícia e aceita o vínculo na mesma transação.
 * O agente passa ator, origem 'ia', status 'em_revisao' e os dados do vínculo.
 */
async function criarProjetoDaNoticia(evidenciaId, dados, { ator = ATOR, origem = "manual", status = "ativo", vinculo = {} } = {}) {
  return emTransacao(async (client) => {
    const { rows: [noticia] } = await client.query(
      "select id, grupo_id from capex_radar.evidencias where id = $1 for update",
      [evidenciaId],
    );
    if (!noticia?.grupo_id) throw new Error("Notícia sem empresa: não dá para criar o projeto.");
    const { rows: [projeto] } = await client.query(
      `insert into capex_radar.projetos
         (titulo, grupo_id, matriz_cnpj, filial_cnpj, uf, municipio, objeto,
          valor_estimado_brl, fonte_valor, estagio, data_anuncio, evidencia_primaria_id, status)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       returning id, titulo`,
      [dados.titulo, noticia.grupo_id, dados.matriz_cnpj, dados.filial_cnpj || null,
        dados.uf || null, dados.municipio || null, dados.objeto || null,
        dados.valor_estimado_brl ?? null, dados.valor_estimado_brl ? "noticia" : null,
        dados.estagio, dados.data_anuncio || null, evidenciaId, status],
    );
    await client.query(
      `insert into capex_radar.evidencia_projeto
         (evidencia_id, projeto_id, origem, situacao, confianca, motivo, modelo, revisado_por, revisado_em)
       values ($1, $2, $3, 'aceito', $4, $5, $6, $7, now())`,
      [evidenciaId, projeto.id, origem, vinculo.confianca ?? null, vinculo.motivo ?? null, vinculo.modelo ?? null, ator],
    );
    await client.query(
      `update capex_radar.evidencia_projeto set situacao = 'rejeitado', revisado_por = $2, revisado_em = now()
        where evidencia_id = $1 and situacao = 'sugerido'`,
      [evidenciaId, ator],
    );
    await marcarVinculada(client, evidenciaId);
    if (ator === ATOR) await rotularPelaRevisao(client, evidenciaId, "criar_projeto");
    return projeto;
  }, ator);
}

/** Liga a notícia a um projeto do mesmo grupo (aceita a sugestão, se houver). */
async function vincularNoticia(evidenciaId, projetoId, { ator = ATOR, origem = "manual", vinculo = {} } = {}) {
  return emTransacao(async (client) => {
    const { rows } = await client.query(
      `select p.id from capex_radar.projetos p
         join capex_radar.evidencias e on e.grupo_id = p.grupo_id
        where p.id = $1 and e.id = $2`,
      [projetoId, evidenciaId],
    );
    if (!rows.length) throw new Error("O projeto não é da mesma empresa da notícia.");
    await client.query(
      `insert into capex_radar.evidencia_projeto
         (evidencia_id, projeto_id, origem, situacao, confianca, motivo, modelo, revisado_por, revisado_em)
       values ($1, $2, $3, 'aceito', $4, $5, $6, $7, now())
       on conflict (evidencia_id, projeto_id) do update
         set situacao = 'aceito', revisado_por = excluded.revisado_por, revisado_em = now()`,
      [evidenciaId, projetoId, origem, vinculo.confianca ?? null, vinculo.motivo ?? null, vinculo.modelo ?? null, ator],
    );
    await client.query(
      `update capex_radar.evidencia_projeto set situacao = 'rejeitado', revisado_por = $3, revisado_em = now()
        where evidencia_id = $1 and projeto_id <> $2 and situacao = 'sugerido'`,
      [evidenciaId, projetoId, ator],
    );
    await marcarVinculada(client, evidenciaId);
    if (ator === ATOR) await rotularPelaRevisao(client, evidenciaId, "vincular");
  }, ator);
}

/** Rejeita a sugestão da IA; a notícia volta como possível projeto novo. */
async function rejeitarSugestao(evidenciaId, projetoId) {
  return emTransacao(async (client) => {
    await client.query(
      `update capex_radar.evidencia_projeto set situacao = 'rejeitado', revisado_por = $3, revisado_em = now()
        where evidencia_id = $1 and projeto_id = $2 and situacao = 'sugerido'`,
      [evidenciaId, projetoId, ATOR],
    );
    await client.query(
      `update capex_radar.evidencias set triagem = 'novo_projeto'
        where id = $1 and triagem = 'pendente'
          and not exists (select 1 from capex_radar.evidencia_projeto
                           where evidencia_id = $1 and situacao in ('sugerido', 'aceito'))`,
      [evidenciaId],
    );
  });
}

async function descartarNoticia(evidenciaId, motivo, { ator = ATOR, rotulo = "Revisão" } = {}) {
  return emTransacao(async (client) => {
    await client.query(
      `update capex_radar.evidencias set triagem = 'descartada', triagem_motivo = $2 where id = $1`,
      [evidenciaId, `${rotulo}: ${motivo || "não é projeto"}`],
    );
    await client.query(
      `update capex_radar.evidencia_projeto set situacao = 'rejeitado', revisado_por = $2, revisado_em = now()
        where evidencia_id = $1 and situacao = 'sugerido'`,
      [evidenciaId, ator],
    );
    if (ator === ATOR) await rotularPelaRevisao(client, evidenciaId, "descartar", motivo || null);
  }, ator);
}

// Projetos da carteira. Os descartados ficam fora, a não ser que sejam pedidos.
async function carteira({ incluirDescartados = false } = {}) {
  const { rows } = await pool.query(
    `select * from capex_radar.vw_carteira where $1 or status <> 'descartado'
      order by coalesce(ultima_evidencia_em, criado_em) desc`,
    [incluirDescartados],
  );
  return rows;
}

async function obterProjeto(id) {
  const { rows } = await pool.query("select * from capex_radar.vw_carteira where id = $1", [id]);
  if (!rows[0]) return null;
  const [timeline, projeto] = await Promise.all([
    pool.query(
      `select evidencia_id, titulo, url, veiculo, data_original, fonte_nome, primaria
         from capex_radar.vw_projeto_timeline where projeto_id = $1
        order by data_original nulls last`,
      [id],
    ),
    pool.query("select objeto, fonte_valor from capex_radar.projetos where id = $1", [id]),
  ]);
  return { projeto: { ...rows[0], ...projeto.rows[0] }, timeline: timeline.rows };
}

/**
 * Exclui o projeto, os vínculos e as notícias que só pertenciam a ele.
 * Notícia ligada também a outro projeto fica, sem o vínculo com este.
 */
async function excluirProjeto(id) {
  return emTransacao(async (client) => {
    const { rows: [projeto] } = await client.query(
      "select id, titulo from capex_radar.projetos where id = $1 for update",
      [id],
    );
    if (!projeto) return null;
    const { rows: exclusivas } = await client.query(
      `select ep.evidencia_id from capex_radar.evidencia_projeto ep
        where ep.projeto_id = $1
          and not exists (select 1 from capex_radar.evidencia_projeto o
                           where o.evidencia_id = ep.evidencia_id and o.projeto_id <> $1)`,
      [id],
    );
    await client.query("delete from capex_radar.projetos where id = $1", [id]);
    const ids = exclusivas.map((row) => row.evidencia_id);
    const removidas = ids.length
      ? (await client.query("delete from capex_radar.evidencias where id = any($1::uuid[])", [ids])).rowCount
      : 0;
    return { ...projeto, evidencias: removidas };
  });
}

module.exports = {
  ATOR,
  SITUACOES,
  FILTRO_SITUACAO,
  emTransacao,
  resumoGrupos,
  listarNoticias,
  noticiaDoCard,
  aprovarNoticia,
  restaurarNoticia,
  historicoBuscas,
  noticiasDaJanela,
  obterNoticia,
  criarProjetoDaNoticia,
  vincularNoticia,
  rejeitarSugestao,
  descartarNoticia,
  carteira,
  obterProjeto,
  excluirProjeto,
};
