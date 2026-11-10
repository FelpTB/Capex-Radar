-- Radar CapEx — esquema capex_radar (teste de monitoramento, nov/2026).
-- Começa do zero. Dos esquemas antigos só as fontes são migradas (018).
-- Idempotente: o runner reaplica todos os arquivos a cada deploy.
-- RLS ativo sem policy, como no MVP: o backend usa service_role.

create schema if not exists capex_radar;

-- ---------------------------------------------------------------------------
-- Apoio: autoria e updated_at
-- ---------------------------------------------------------------------------

-- Quem escreve define o ator na transação:
--   set local capex_radar.ator = 'usuario:felipe' | 'agente:claude' | 'ia:vinculo' | 'sistema:coletor';
create or replace function capex_radar.ator_atual() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('capex_radar.ator', true), ''), 'sistema:desconhecido')
$$;

create or replace function capex_radar.tg_atualizado_em() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Fontes
-- ---------------------------------------------------------------------------

create table if not exists capex_radar.fontes (
  codigo         text primary key,
  nome           text not null,
  papel          text not null default 'descoberta'
                 check (papel in ('descoberta', 'enriquecimento', 'indice', 'lookup', 'acessoria')),
  hierarquia     text check (hierarquia in ('primaria', 'secundaria')),
  categoria      text,            -- meio de acesso: rss, api_publica, portal_web, dataset_download, scraper...
  url_base       text,
  status         text not null default 'ativa'
                 check (status in ('ativa', 'pendente', 'quebrada', 'desativada')),
  ciclo          text,            -- ciclo de vida de portais do MVP: sugerida, prova, fixa, aposentada
  descricao      text,
  documentacao   text,            -- formato bruto + extração passo a passo
  config         jsonb not null default '{}'::jsonb,
  ultimo_ok_em   timestamptz,
  ultimo_erro_em timestamptz,
  msg_erro       text,
  origem         text not null default 'capex_radar',  -- public.fonte | radar.fontes | radar2.fontes | capex_radar
  legado         jsonb not null default '{}'::jsonb,   -- linhas originais dos esquemas antigos
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Empresas: grupo -> matrizes (raízes de CNPJ) -> filiais
-- ---------------------------------------------------------------------------

create table if not exists capex_radar.grupos (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null unique,
  nicho          text not null
                 check (nicho in ('papel_celulose', 'alimentos_bebidas', 'ecommerce', 'datacenter')),
  ordem_ranking  smallint,
  ranking        jsonb not null default '{}'::jsonb,   -- {fonte, metrica, valor}
  controle       text,
  subsetor       text,
  notas          text,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create table if not exists capex_radar.matrizes (
  cnpj               char(14) primary key check (cnpj ~ '^[0-9]{14}$'),
  cnpj_basico        char(8) generated always as (left(cnpj, 8)) stored unique,
  grupo_id           uuid not null references capex_radar.grupos (id),
  papel              text not null default 'principal'
                     check (papel in ('principal', 'operacional', 'holding', 'spe')),
  razao_social       text not null,
  nome_fantasia      text,
  natureza_juridica  text,
  cnae               text,
  uf                 char(2),
  municipio          text,
  codigo_ibge        char(7),
  notas              text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

create table if not exists capex_radar.filiais (
  cnpj                    char(14) primary key check (cnpj ~ '^[0-9]{14}$'),
  matriz_cnpj             char(14) not null references capex_radar.matrizes (cnpj),
  nome_fantasia           text,
  situacao_cadastral      text,
  data_inicio_atividades  date,
  cnae                    text,
  cnaes_secundarios       text[],
  logradouro              text,
  numero                  text,
  bairro                  text,
  cep                     char(8),
  uf                      char(2),
  municipio               text,
  codigo_ibge             char(7),
  latitude                numeric(9, 6),
  longitude               numeric(9, 6),
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Projetos (estágio, tendência e validação seguem o esquema radar)
-- ---------------------------------------------------------------------------

create table if not exists capex_radar.projetos (
  id                    uuid primary key default gen_random_uuid(),
  titulo                text not null,
  grupo_id              uuid not null references capex_radar.grupos (id),
  matriz_cnpj           char(14) not null references capex_radar.matrizes (cnpj),
  filial_cnpj           char(14) references capex_radar.filiais (cnpj),  -- opcional; evidências podem defini-la depois
  uf                    char(2),
  municipio             text,
  codigo_ibge           char(7),
  objeto                text,
  valor_estimado_brl    numeric,
  fonte_valor           text,
  flag_validacao        text not null default 'A_VALIDAR'
                        check (flag_validacao in ('A_VALIDAR', 'ESTIMATIVA_ABC', 'CONFIRMADO')),
  estagio               text not null default 'anuncio'
                        check (estagio in ('anuncio', 'licenciamento', 'funding', 'contratacao_epc',
                                           'mobilizacao', 'operacao', 'desaceleracao', 'cancelado')),
  tendencia             text check (tendencia in ('acelerando', 'estavel', 'desacelerando')),
  status                text not null default 'ativo'        -- situação da ficha no radar
                        check (status in ('ativo', 'em_revisao', 'descartado')),
  data_anuncio          date,
  data_inicio           date,
  data_fim              date,
  evidencia_primaria_id uuid,
  criado_por            text not null default capex_radar.ator_atual(),
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  constraint projetos_datas_chk check (data_fim is null or data_inicio is null or data_fim >= data_inicio)
);

-- ---------------------------------------------------------------------------
-- Evidências (brutas) e vínculos com projetos
-- ---------------------------------------------------------------------------

create table if not exists capex_radar.evidencias (
  id                   uuid primary key default gen_random_uuid(),
  fonte_codigo         text not null references capex_radar.fontes (codigo),
  chave_dedupe         text not null unique,     -- ex.: url normalizada; ou id nativo da fonte
  titulo               text not null,
  url                  text check (url is null or url ~ '^https?://'),
  veiculo              text,                     -- publicador (notícias) ou órgão
  data_original        timestamptz,              -- data do fato/publicação: ordena a linha do tempo
  data_precisao        text not null default 'dia'
                       check (data_precisao in ('hora', 'dia', 'mes', 'ano', 'desconhecida')),
  data_extracao        timestamptz not null default now(),
  grupo_id             uuid references capex_radar.grupos (id),  -- empresa consultada na coleta
  consulta             text,                     -- consulta que trouxe a evidência
  uf                   char(2),
  municipio            text,
  texto                text,
  conteudo_bruto       jsonb not null default '{}'::jsonb,
  triagem              text not null default 'pendente'
                       check (triagem in ('pendente', 'vinculada', 'novo_projeto', 'descartada')),
  triagem_motivo       text,
  criado_em            timestamptz not null default now()
);

do $$ begin
  alter table capex_radar.projetos
    add constraint projetos_evidencia_primaria_fk
    foreign key (evidencia_primaria_id) references capex_radar.evidencias (id) on delete set null;
exception when duplicate_object then null;
end $$;

create table if not exists capex_radar.evidencia_projeto (
  evidencia_id   uuid not null references capex_radar.evidencias (id) on delete cascade,
  projeto_id     uuid not null references capex_radar.projetos (id) on delete cascade,
  origem         text not null check (origem in ('ia', 'manual', 'regra')),
  situacao       text not null default 'sugerido'
                 check (situacao in ('sugerido', 'aceito', 'rejeitado')),
  confianca      smallint check (confianca between 0 and 100),
  motivo         text,
  modelo         text,                 -- modelo de IA que sugeriu, quando origem = 'ia'
  sugerido_por   text not null default capex_radar.ator_atual(),
  sugerido_em    timestamptz not null default now(),
  revisado_por   text,
  revisado_em    timestamptz,
  primary key (evidencia_id, projeto_id)
);

-- ---------------------------------------------------------------------------
-- Log de ações (usuário, agente, IA, sistema)
-- ---------------------------------------------------------------------------

create table if not exists capex_radar.log_acao (
  id           bigint generated always as identity primary key,
  ator         text not null,
  tabela       text not null,
  operacao     text not null,
  registro_id  text,
  antes        jsonb,
  depois       jsonb,
  em           timestamptz not null default now()
);

create or replace function capex_radar.tg_log_acao() returns trigger
language plpgsql as $$
declare
  v_row jsonb := coalesce(to_jsonb(new), to_jsonb(old));
  v_id  text;
begin
  v_id := case tg_table_name
    when 'evidencia_projeto' then (v_row ->> 'evidencia_id') || ':' || (v_row ->> 'projeto_id')
    else coalesce(v_row ->> 'id', v_row ->> 'cnpj', v_row ->> 'codigo')
  end;
  insert into capex_radar.log_acao (ator, tabela, operacao, registro_id, antes, depois)
  values (capex_radar.ator_atual(), tg_table_name, tg_op, v_id,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

-- Triggers (drop + create para manter idempotência)
do $$
declare t text;
begin
  foreach t in array array['fontes', 'grupos', 'matrizes', 'filiais', 'projetos'] loop
    execute format('drop trigger if exists %I on capex_radar.%I', 'tg_' || t || '_atualizado_em', t);
    execute format('create trigger %I before update on capex_radar.%I for each row execute function capex_radar.tg_atualizado_em()', 'tg_' || t || '_atualizado_em', t);
  end loop;
  foreach t in array array['grupos', 'matrizes', 'projetos', 'evidencia_projeto'] loop
    execute format('drop trigger if exists %I on capex_radar.%I', 'tg_' || t || '_log', t);
    execute format('create trigger %I after insert or update or delete on capex_radar.%I for each row execute function capex_radar.tg_log_acao()', 'tg_' || t || '_log', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create index if not exists matrizes_grupo_idx        on capex_radar.matrizes (grupo_id);
create index if not exists filiais_matriz_idx        on capex_radar.filiais (matriz_cnpj);
create index if not exists filiais_uf_municipio_idx  on capex_radar.filiais (uf, municipio);
create index if not exists projetos_grupo_idx        on capex_radar.projetos (grupo_id);
create index if not exists projetos_matriz_idx       on capex_radar.projetos (matriz_cnpj);
create index if not exists projetos_filial_idx       on capex_radar.projetos (filial_cnpj);
create index if not exists projetos_uf_idx           on capex_radar.projetos (uf, municipio);
create index if not exists evidencias_grupo_data_idx on capex_radar.evidencias (grupo_id, data_original desc);
create index if not exists evidencias_triagem_idx    on capex_radar.evidencias (triagem) where triagem = 'pendente';
create index if not exists evidencias_fonte_idx      on capex_radar.evidencias (fonte_codigo);
create index if not exists ev_proj_projeto_idx       on capex_radar.evidencia_projeto (projeto_id, situacao);
create index if not exists log_acao_registro_idx     on capex_radar.log_acao (tabela, registro_id, em desc);

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

-- Linha do tempo: evidências aceitas de cada projeto, pela data original.
create or replace view capex_radar.vw_projeto_timeline as
select
  ep.projeto_id,
  e.id               as evidencia_id,
  e.data_original,
  e.data_precisao,
  e.data_extracao,
  e.titulo,
  e.url,
  e.veiculo,
  e.fonte_codigo,
  f.nome             as fonte_nome,
  f.papel            as fonte_papel,
  e.uf,
  e.municipio,
  ep.origem          as vinculo_origem,
  ep.confianca       as vinculo_confianca,
  (p.evidencia_primaria_id = e.id) as primaria,
  e.conteudo_bruto
from capex_radar.evidencia_projeto ep
join capex_radar.evidencias e on e.id = ep.evidencia_id
join capex_radar.projetos p   on p.id = ep.projeto_id
join capex_radar.fontes f     on f.codigo = e.fonte_codigo
where ep.situacao = 'aceito';

-- Carteira: projeto com empresa, local e resumo das evidências (base dos filtros).
-- Só cria a view quando ela não existe. A 021 redefine a view com uma coluna a
-- mais (local_origem), e um create or replace com a versão antiga falharia no
-- deploy ("cannot drop columns from view"), que reaplica todos os arquivos.
do $do$
begin
  if to_regclass('capex_radar.vw_carteira') is null then
    execute $v$
create view capex_radar.vw_carteira as
select
  p.id,
  p.titulo,
  g.id               as grupo_id,
  g.nome             as grupo,
  g.nicho,
  p.matriz_cnpj,
  m.razao_social     as matriz_razao_social,
  p.filial_cnpj,
  coalesce(p.uf, fl.uf, m.uf)                   as uf,
  coalesce(p.municipio, fl.municipio, m.municipio) as municipio,
  p.valor_estimado_brl,
  p.flag_validacao,
  p.estagio,
  p.tendencia,
  p.status,
  p.data_anuncio,
  p.data_inicio,
  p.data_fim,
  ev.n_evidencias,
  ev.primeira_evidencia_em,
  ev.ultima_evidencia_em,
  p.criado_em,
  p.atualizado_em
from capex_radar.projetos p
join capex_radar.grupos g        on g.id = p.grupo_id
join capex_radar.matrizes m      on m.cnpj = p.matriz_cnpj
left join capex_radar.filiais fl on fl.cnpj = p.filial_cnpj
left join lateral (
  select count(*)::int        as n_evidencias,
         min(t.data_original) as primeira_evidencia_em,
         max(t.data_original) as ultima_evidencia_em
  from capex_radar.vw_projeto_timeline t
  where t.projeto_id = p.id
) ev on true
    $v$;
  end if;
end
$do$;

-- Fila de revisão: vínculos sugeridos ainda não revisados e evidências sem destino.
create or replace view capex_radar.vw_fila_revisao as
select
  'vinculo_sugerido'::text as tipo,
  e.id               as evidencia_id,
  ep.projeto_id,
  p.titulo           as projeto_titulo,
  e.titulo,
  e.url,
  e.data_original,
  e.grupo_id,
  ep.origem,
  ep.confianca,
  ep.motivo,
  ep.sugerido_em     as desde
from capex_radar.evidencia_projeto ep
join capex_radar.evidencias e on e.id = ep.evidencia_id
join capex_radar.projetos p   on p.id = ep.projeto_id
where ep.situacao = 'sugerido'
union all
select
  case e.triagem when 'novo_projeto' then 'novo_projeto_sugerido' else 'sem_vinculo' end,
  e.id, null, null, e.titulo, e.url, e.data_original, e.grupo_id,
  null, null, e.triagem_motivo, e.criado_em
from capex_radar.evidencias e
where e.triagem in ('pendente', 'novo_projeto')
  and not exists (select 1 from capex_radar.evidencia_projeto ep where ep.evidencia_id = e.id);

-- ---------------------------------------------------------------------------
-- RLS e comentários
-- ---------------------------------------------------------------------------

alter table capex_radar.fontes            enable row level security;
alter table capex_radar.grupos            enable row level security;
alter table capex_radar.matrizes          enable row level security;
alter table capex_radar.filiais           enable row level security;
alter table capex_radar.projetos          enable row level security;
alter table capex_radar.evidencias        enable row level security;
alter table capex_radar.evidencia_projeto enable row level security;
alter table capex_radar.log_acao          enable row level security;

comment on schema capex_radar is 'Radar CapEx reestruturado: teste de monitoramento de 38 empresas (nov/2026).';
comment on table capex_radar.grupos is 'Empresa observada no teste (ex.: JBS). Agrupa uma ou mais raízes de CNPJ.';
comment on table capex_radar.matrizes is 'Raiz de CNPJ (estabelecimento matriz) de um grupo: principal, operacional, holding ou SPE.';
comment on table capex_radar.filiais is 'Estabelecimentos da matriz, com localização para correlacionar projetos.';
comment on table capex_radar.projetos is 'Projeto de investimento. Nasce de evidências; fica na matriz até uma evidência apontar a filial.';
comment on table capex_radar.evidencias is 'Evidência bruta (notícia, ato, registro). data_original ordena a linha do tempo.';
comment on table capex_radar.evidencia_projeto is 'Vínculo evidência-projeto. A IA só sugere; aceite/rejeição é revisão.';
comment on table capex_radar.log_acao is 'Auditoria de escritas, com o ator definido em capex_radar.ator.';
