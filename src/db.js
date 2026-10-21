const { Pool } = require("pg");
const { getConfig } = require("./config");

const config = getConfig();
const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: config.databaseUrl.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

async function healthcheck() {
  const result = await pool.query("select now() as database_time");
  return result.rows[0];
}

async function listSources() {
  const { rows } = await pool.query(`
    select f.*,
      (select count(*)::int from evidencia e where e.id_fonte = f.id) as total_evidencias,
      (select count(*)::int from acesso_log a where a.id_fonte = f.id) as total_acessos
    from fonte f
    where f.codigo not in ('SEC-PDT', 'CAPTURA-DNIT-PDT')
    order by f.tipo, f.nome
  `);
  return rows;
}

async function getSourceByCode(codigo) {
  const { rows } = await pool.query("select * from fonte where codigo = $1", [codigo]);
  return rows[0] || null;
}

async function latestBaseLoads(codigos) {
  if (!codigos?.length) return [];
  const { rows } = await pool.query(
    `select distinct on (codigo)
       codigo, recurso, status, linhas, bytes, erro, carregado_em
     from base_carga
     where codigo = any($1::text[])
     order by codigo, carregado_em desc`,
    [codigos],
  );
  return rows;
}

async function listSourcesByCodes(codigos) {
  const { rows } = await pool.query(
    `select * from fonte
     where ativo and codigo = any($1::text[])
     order by nome`,
    [codigos],
  );
  return rows;
}

async function listPrimarySources() {
  const { rows } = await pool.query(
    `select * from fonte
     where tipo = 'primaria' and ativo and participa_scanner
       and coalesce(estagio, 'fixa') = 'fixa'
       and status_acesso not in ('bloqueado', 'indisponivel')
     order by nome`,
  );
  return rows;
}

async function listProjects() {
  const { rows } = await pool.query(`
    select p.*, f.nome as fonte_principal_nome,
      count(e.id)::int as total_evidencias
    from projeto p
    left join fonte f on f.id = p.id_fonte_principal
    left join evidencia e on e.id_projeto = p.id
    group by p.id, f.nome
    order by p.updated_at desc
  `);
  return rows;
}

async function getCompany(cnpj) {
  const { rows } = await pool.query(
    "select * from enr_empresa where cnpj = $1",
    [String(cnpj || "").replace(/\D/g, "")],
  );
  return rows[0] || null;
}

async function getProject(id) {
  const [projectResult, evidenceResult, sourcesResult] = await Promise.all([
    pool.query(
      `select p.*, f.nome as fonte_principal_nome
       from projeto p left join fonte f on f.id = p.id_fonte_principal
       where p.id = $1`,
      [id],
    ),
    pool.query(
      `select e.*, f.nome as fonte_nome, f.codigo as fonte_codigo
       from evidencia e left join fonte f on f.id = e.id_fonte
       where e.id_projeto = $1 order by e.coletado_em desc`,
      [id],
    ),
    pool.query("select id, codigo, nome, tipo, conteudo from fonte where ativo order by nome"),
  ]);

  return {
    project: projectResult.rows[0] || null,
    evidence: evidenceResult.rows,
    sources: sourcesResult.rows,
  };
}

async function insertProjectWithEvidence(client, input) {
  const existing = await client.query(
    `select * from projeto
     where url_noticia_principal = $1 and lower(nome) = lower($2)
     limit 1`,
    [input.url, input.nome],
  );
  if (existing.rows[0]) return existing.rows[0];

  const projectResult = await client.query(
    `insert into projeto (
      nome, nicho, uf, municipio, empresa_nome, cnpj,
      valor_capex, moeda, valor_confianca, status, status_em, status_em_origem,
      url_noticia_principal, id_fonte_principal
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    returning *`,
    [
      input.nome,
      input.nicho || null,
      input.uf || null,
      input.municipio || null,
      input.empresa_nome || null,
      input.cnpj || null,
      input.valor_capex || null,
      input.moeda || "BRL",
      input.valor_confianca || "baixa",
      input.status || "anunciado",
      input.status_em || null,
      input.status_em_origem || null,
      input.url,
      input.id_fonte || null,
    ],
  );
  const project = projectResult.rows[0];
  await client.query(
    `insert into evidencia (
      id_projeto, id_fonte, papel, url, titulo_ou_resumo,
      trecho, campos_extraidos
    ) values ($1,$2,'primaria',$3,$4,$5,$6::jsonb)`,
    [
      project.id,
      input.id_fonte || null,
      input.url,
      input.titulo || input.nome,
      input.trecho || input.resumo || null,
      JSON.stringify(input.campos_extraidos || {}),
    ],
  );
  return project;
}

async function createProjectWithEvidence(input) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const project = await insertProjectWithEvidence(client, input);
    await client.query("commit");
    return project;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function createProjectsSharingNews({ url, id_fonte, titulo, projetos }) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const created = [];
    for (const item of projetos) {
      created.push(await insertProjectWithEvidence(client, {
        nome: item.nome,
        nicho: item.nicho,
        uf: item.uf,
        municipio: item.municipio,
        empresa_nome: item.empresa_nome,
        valor_capex: item.valor_capex,
        moeda: item.moeda || "BRL",
        status: item.status || "anunciado",
        status_em: item.status_em,
        status_em_origem: item.status_em_origem,
        url,
        id_fonte,
        titulo: titulo || item.nome,
        trecho: item.trecho || item.resumo,
        campos_extraidos: item,
      }));
    }
    await client.query("commit");
    return created;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function projectsSharingNews(url, exceptId) {
  const { rows } = await pool.query(
    `select id, nome, empresa_nome, status
     from projeto
     where url_noticia_principal = $1 and id <> $2
     order by nome`,
    [url, exceptId],
  );
  return rows;
}

async function addEvidence(projectId, input) {
  const { rows } = await pool.query(
    `insert into evidencia (
      id_projeto, id_fonte, papel, url, titulo_ou_resumo,
      trecho, campos_extraidos
    ) values ($1,$2,$3,$4,$5,$6,$7::jsonb)
    returning *`,
    [
      projectId,
      input.id_fonte || null,
      input.papel || "secundaria",
      input.url,
      input.titulo_ou_resumo || null,
      input.trecho || null,
      JSON.stringify(input.campos_extraidos || {}),
    ],
  );
  return rows[0];
}

async function updateProjectStatus(projectId, status) {
  await pool.query(
    "update projeto set status = $2, updated_at = now() where id = $1",
    [projectId, status],
  );
}

async function updateProjectReading(projectId, { status, leitura }) {
  await pool.query(
    `update projeto
     set status = $2, leitura_status = $3, updated_at = now()
     where id = $1`,
    [projectId, status, leitura],
  );
}

async function dashboardStats() {
  const { rows } = await pool.query(`
    select
      (select count(*)::int from projeto) as projetos,
      (select count(*)::int from evidencia) as evidencias,
      (select count(*)::int from fonte where ativo) as fontes,
      (select count(*)::int from fonte where status_acesso <> 'ok') as fontes_com_alerta
  `);
  return rows[0];
}

async function upsertCandidate(candidate) {
  const { rows } = await pool.query(
    `insert into candidato_projeto (
      id_fonte, url, titulo, resumo, publicado_em, relevancia
    ) values ($1,$2,$3,$4,$5,$6)
    on conflict (url) do update set
      titulo = excluded.titulo,
      resumo = excluded.resumo,
      relevancia = greatest(candidato_projeto.relevancia, excluded.relevancia)
    returning *`,
    [
      candidate.id_fonte,
      candidate.url,
      candidate.titulo,
      candidate.resumo || null,
      candidate.publicado_em || null,
      candidate.relevancia,
    ],
  );
  return rows[0];
}

async function markCandidateAnalyzed(id, data, model) {
  await pool.query(
    `update candidato_projeto set
      dados_extraidos = $2::jsonb,
      status = 'analisado',
      analisado_em = now(),
      modelo_extracao = $3,
      erro = null
    where id = $1 and status in ('novo', 'erro')`,
    [id, JSON.stringify(data), model || null],
  );
}

async function markCandidateError(id, error) {
  await pool.query(
    `update candidato_projeto set status = 'erro', erro = $2,
      analisado_em = now() where id = $1 and status <> 'aprovado'`,
    [id, String(error).slice(0, 500)],
  );
}

async function listCandidates({ history = false } = {}) {
  const statuses = history
    ? ["aprovado", "rejeitado"]
    : ["novo", "analisado", "erro"];
  const { rows } = await pool.query(`
    select c.*, f.nome as fonte_nome
    from candidato_projeto c
    join fonte f on f.id = c.id_fonte
    where c.status = any($1::text[])
    order by
      case c.status when 'analisado' then 0 when 'novo' then 1 else 2 end,
      coalesce(c.decidido_em, c.encontrado_em) desc,
      c.relevancia desc
    limit 100`,
    [statuses],
  );
  return rows;
}

async function candidateStats() {
  const { rows } = await pool.query(`
    select
      count(*)::int as total,
      count(*) filter (where rotulo_projeto is true)::int as aprovados,
      count(*) filter (where rotulo_projeto is false)::int as rejeitados,
      count(*) filter (where rotulo_projeto is null)::int as pendentes
    from candidato_projeto
  `);
  return rows[0];
}

async function trainingExamples() {
  const { rows } = await pool.query(`
    select c.titulo, c.resumo, c.url, c.relevancia,
      c.dados_extraidos, c.rotulo_projeto, c.motivo_decisao,
      c.modelo_extracao, c.decidido_em, f.codigo as fonte_codigo
    from candidato_projeto c
    join fonte f on f.id = c.id_fonte
    where c.rotulo_projeto is not null
    order by c.decidido_em
  `);
  return rows;
}

async function registerSourceAccess(sourceId, { httpStatus, error = null, status = null }) {
  const client = await pool.connect();
  const erro = error ? String(error).slice(0, 500) : null;
  try {
    await client.query("begin");
    await client.query(
      `insert into acesso_log (id_fonte, url, http_status, erro)
       select id, url_base, $2, $3 from fonte where id = $1`,
      [sourceId, httpStatus || null, erro],
    );
    await client.query(
      `update fonte set
        ultimo_acesso_em = now(),
        ultimo_erro = $2,
        status_acesso = case
          when $3::text is not null then $3::radar_status_acesso
          when $2::text is null then 'ok'::radar_status_acesso
          when status_acesso = 'bloqueado' then status_acesso
          else 'instavel'::radar_status_acesso
        end,
        updated_at = now()
       where id = $1`,
      [sourceId, erro, status],
    );
    await client.query("commit");
  } catch (dbError) {
    await client.query("rollback");
    throw dbError;
  } finally {
    client.release();
  }
}

async function approveCandidate(id) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const candidateResult = await client.query(
      "select * from candidato_projeto where id = $1 for update",
      [id],
    );
    const candidate = candidateResult.rows[0];
    if (!candidate) throw new Error("Candidato não encontrado");
    if (["aprovado", "rejeitado"].includes(candidate.status)) {
      throw new Error("Este candidato já recebeu uma decisão");
    }
    const data = candidate.dados_extraidos || {};
    const extracted = Array.isArray(data.projetos) && data.projetos.length
      ? data.projetos
      : [data];
    const projetos = extracted.filter((item) => item && item.esfera !== "fora");
    if (!projetos.length) throw new Error("Nenhum projeto para criar nesta notícia");
    const projects = [];
    for (const item of projetos) {
      projects.push(await insertProjectWithEvidence(client, {
        nome: item.nome || candidate.titulo,
        nicho: item.nicho,
        uf: item.uf,
        municipio: item.municipio,
        empresa_nome: item.empresa_nome,
        valor_capex: item.valor_capex,
        moeda: item.moeda || "desconhecida",
        status: item.status || "anunciado",
        status_em: item.status_em,
        status_em_origem: item.status_em_origem,
        url: candidate.url,
        id_fonte: candidate.id_fonte,
        titulo: candidate.titulo,
        trecho: item.trecho || item.resumo || candidate.resumo,
        campos_extraidos: item,
      }));
    }
    await client.query(
      `update candidato_projeto set
        status = 'aprovado',
        rotulo_projeto = true,
        decidido_em = now(),
        motivo_decisao = $2
       where id = $1`,
      [id, projects.length > 1
        ? `${projects.length} projetos da mesma notícia`
        : "aprovado como projeto"],
    );
    await client.query("commit");
    return projects;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

const CYCLE_COLUMNS = new Set([
  "ultimo_scan_em",
  "ultima_descoberta_em",
  "ultima_aposentadoria_em",
]);

const BRAZIL_UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

async function withCycleLock(work) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "select pg_try_advisory_lock(842001) as locked",
    );
    if (!rows[0].locked) return { pulado: "ciclo já em execução" };
    try {
      return await work();
    } finally {
      await client.query("select pg_advisory_unlock(842001)");
    }
  } finally {
    client.release();
  }
}

async function cycleState() {
  const { rows } = await pool.query("select * from ciclo_estado where id = 1");
  return rows[0];
}

async function touchCycle(column) {
  if (!CYCLE_COLUMNS.has(column)) throw new Error("coluna de ciclo inválida");
  await pool.query(`update ciclo_estado set ${column} = now() where id = 1`);
}

async function setCycleSummary(text) {
  await pool.query("update ciclo_estado set ultimo_resumo = $1 where id = 1", [
    String(text).slice(0, 500),
  ]);
}

async function countAnalysesToday() {
  const { rows } = await pool.query(`
    select count(*)::int as total
    from candidato_projeto
    where analisado_em >= date_trunc('day', now() at time zone 'America/Sao_Paulo')
      at time zone 'America/Sao_Paulo'
  `);
  return rows[0].total;
}

async function listSourcesByStage(estagio) {
  const { rows } = await pool.query(
    `select * from fonte where ativo and estagio = $1 order by nome`,
    [estagio],
  );
  return rows;
}

async function insertAppearance({ dominio, nome, consulta }) {
  await pool.query(
    `insert into fonte_aparicao (dominio, nome_portal, consulta)
     values ($1, $2, $3)`,
    [dominio, nome || null, consulta],
  );
}

async function domainsReadyForProva() {
  const { rows } = await pool.query(`
    select dominio
    from fonte_aparicao
    where visto_em >= now() - interval '14 days'
    group by dominio
    having count(distinct (visto_em at time zone 'America/Sao_Paulo')::date) >= 3
  `);
  return rows.map((row) => row.dominio);
}

async function recentAppearanceDomains() {
  const { rows } = await pool.query(`
    select distinct on (dominio) dominio, nome_portal
    from fonte_aparicao
    where visto_em >= now() - interval '14 days'
    order by dominio, visto_em desc
  `);
  return rows;
}

async function findSourceByDomain(dominio) {
  const { rows } = await pool.query(
    `select * from fonte
     where regexp_replace(
       lower(split_part(regexp_replace(url_base, '^https?://', ''), '/', 1)),
       '^www\\.', ''
     ) = $1
     limit 1`,
    [dominio],
  );
  return rows[0] || null;
}

async function createObservedSource({ dominio, nome, estagio, codigo }) {
  let nextCode = codigo;
  let suffix = 2;
  while (true) {
    const clash = await pool.query(
      "select url_base from fonte where codigo = $1",
      [nextCode],
    );
    if (!clash.rows[0]) break;
    const host = String(clash.rows[0].url_base || "")
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .toLowerCase()
      .replace(/^www\./, "");
    if (host === dominio) return findSourceByDomain(dominio);
    nextCode = `${codigo}-${suffix}`;
    suffix += 1;
  }

  const { rows } = await pool.query(
    `insert into fonte (
      codigo, nome, tipo, categoria, url_base, conteudo,
      frequencia_projetos, status_acesso, peculiaridade, ativo,
      participa_scanner, papel_captura, formato_dado,
      auth_acesso, unidade_registro, esfera_noticia,
      estagio, estagio_desde
    ) values (
      $1, $2, 'primaria', 'portal_web', $3, $4,
      'desconhecida', 'ok', $5, true,
      false, 'descoberta', 'html',
      'nenhuma', 'notícia', 'privada',
      $6, now()
    ) returning *`,
    [
      nextCode,
      nome || dominio,
      `https://${dominio}/`,
      "Capa do veículo. A leitura automática começa na prova.",
      "Portal observado nas buscas de investimento. A matéria do Google não entra no banco.",
      estagio,
    ],
  );
  return rows[0];
}

async function setSourceStage(id, estagio, { participaScanner = null } = {}) {
  await pool.query(
    `update fonte set
      estagio = $2,
      estagio_desde = case when estagio is distinct from $2 then now() else estagio_desde end,
      participa_scanner = coalesce($3, participa_scanner),
      updated_at = now()
     where id = $1`,
    [id, estagio, participaScanner],
  );
}

async function provaStats(sourceId, since) {
  const { rows } = await pool.query(
    `select
      count(*) filter (where analisado_em is not null)::int as analyzed,
      count(*) filter (
        where status in ('analisado', 'aprovado')
          and dados_extraidos->>'esfera' = 'privada'
          and dados_extraidos->>'uf' = any($3::text[])
      )::int as private_brazil
     from candidato_projeto
     where id_fonte = $1 and analisado_em >= $2`,
    [sourceId, since || new Date(0), BRAZIL_UFS],
  );
  return {
    analyzed: rows[0].analyzed,
    privateBrazil: rows[0].private_brazil,
  };
}

async function sourcesForRetirement() {
  const { rows } = await pool.query(`
    select f.id, f.codigo, f.estagio, f.status_acesso, f.estagio_desde,
      extract(epoch from (now() - f.estagio_desde)) / 86400 as days_in_stage,
      (
        select extract(epoch from (now() - max(c.analisado_em))) / 86400
        from candidato_projeto c
        where c.id_fonte = f.id
          and c.status in ('analisado', 'aprovado')
          and c.dados_extraidos->>'esfera' = 'privada'
      ) as days_since_private,
      (
        select count(*)::int from candidato_projeto c
        where c.id_fonte = f.id and c.analisado_em >= f.estagio_desde
      ) as analyzed,
      (
        select count(*)::int from candidato_projeto c
        where c.id_fonte = f.id
          and c.analisado_em >= f.estagio_desde
          and c.status in ('analisado', 'aprovado')
          and c.dados_extraidos->>'esfera' = 'privada'
          and c.dados_extraidos->>'uf' = any($1::text[])
      ) as private_brazil
    from fonte f
    where f.estagio in ('fixa', 'prova', 'sugerida')
  `, [BRAZIL_UFS]);
  return rows;
}

async function rejectCandidate(id, reason) {
  await pool.query(
    `update candidato_projeto set
      status = 'rejeitado',
      rotulo_projeto = false,
      decidido_em = now(),
      motivo_decisao = $2
     where id = $1 and status not in ('aprovado', 'rejeitado')`,
    [id, reason || "não é projeto"],
  );
}

module.exports = {
  pool,
  healthcheck,
  listSources,
  getSourceByCode,
  latestBaseLoads,
  listPrimarySources,
  listSourcesByCodes,
  listProjects,
  getProject,
  getCompany,
  createProjectWithEvidence,
  createProjectsSharingNews,
  projectsSharingNews,
  addEvidence,
  updateProjectStatus,
  updateProjectReading,
  dashboardStats,
  upsertCandidate,
  markCandidateAnalyzed,
  markCandidateError,
  listCandidates,
  candidateStats,
  trainingExamples,
  registerSourceAccess,
  approveCandidate,
  rejectCandidate,
  withCycleLock,
  cycleState,
  touchCycle,
  setCycleSummary,
  countAnalysesToday,
  listSourcesByStage,
  insertAppearance,
  domainsReadyForProva,
  recentAppearanceDomains,
  findSourceByDomain,
  createObservedSource,
  setSourceStage,
  provaStats,
  sourcesForRetirement,
};
