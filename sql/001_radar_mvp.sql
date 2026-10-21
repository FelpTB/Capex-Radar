-- Radar CapEx MVP
-- Aplicar no SQL Editor do projeto Supabase.
-- RLS ativo: sem policy para anon/authenticated. Backend usa service_role.

create extension if not exists "pgcrypto";

do $$ begin
  create type radar_tipo_fonte as enum ('primaria', 'secundaria');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type radar_status_acesso as enum ('ok', 'instavel', 'bloqueado', 'indisponivel');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type radar_frequencia as enum ('baixa', 'media', 'alta', 'desconhecida');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type radar_status_projeto as enum (
    'rumor', 'anunciado', 'leilao', 'outorga',
    'lp', 'li', 'construcao', 'operacao', 'cancelado'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type radar_valor_confianca as enum ('baixa', 'alta');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type radar_papel_evidencia as enum ('primaria', 'secundaria');
exception when duplicate_object then null;
end $$;

create table if not exists fonte (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  nome text not null,
  tipo radar_tipo_fonte not null,
  categoria text,
  url_base text not null,
  conteudo text,
  frequencia_projetos radar_frequencia not null default 'desconhecida',
  status_acesso radar_status_acesso not null default 'ok',
  peculiaridade text,
  ultimo_erro text,
  ultimo_acesso_em timestamptz,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projeto (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nicho text,
  uf text,
  municipio text,
  empresa_nome text,
  cnpj text,
  valor_capex numeric,
  moeda text default 'BRL',
  valor_confianca radar_valor_confianca not null default 'baixa',
  status radar_status_projeto not null default 'anunciado',
  url_noticia_principal text not null,
  id_fonte_principal uuid references fonte (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projeto_url_noticia_chk check (url_noticia_principal ~ '^https?://')
);

create table if not exists evidencia (
  id uuid primary key default gen_random_uuid(),
  id_projeto uuid not null references projeto (id) on delete cascade,
  id_fonte uuid references fonte (id),
  papel radar_papel_evidencia not null,
  url text not null,
  titulo_ou_resumo text,
  trecho text,
  campos_extraidos jsonb not null default '{}'::jsonb,
  coletado_em timestamptz not null default now(),
  constraint evidencia_url_chk check (url ~ '^https?://')
);

create table if not exists acesso_log (
  id uuid primary key default gen_random_uuid(),
  id_fonte uuid references fonte (id),
  url text not null,
  http_status integer,
  erro text,
  em timestamptz not null default now()
);

create index if not exists evidencia_projeto_idx on evidencia (id_projeto);
create index if not exists evidencia_fonte_idx on evidencia (id_fonte);
create index if not exists acesso_log_fonte_idx on acesso_log (id_fonte, em desc);
create index if not exists projeto_fonte_principal_idx on projeto (id_fonte_principal);

alter table fonte enable row level security;
alter table projeto enable row level security;
alter table evidencia enable row level security;
alter table acesso_log enable row level security;

comment on table fonte is 'Cadastro operacional das fontes (primaria/secundaria) e saude de acesso.';
comment on table projeto is 'Ficha Radar. Nasce com url_noticia_principal.';
comment on table evidencia is 'Sinal com link obrigatorio (noticia ou enriquecimento).';
comment on table acesso_log is 'Tentativas de acesso, inclusive falha (WAF, timeout).';
