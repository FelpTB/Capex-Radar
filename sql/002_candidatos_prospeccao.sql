-- Fila de projetos encontrados automaticamente nas fontes primárias.

create table if not exists candidato_projeto (
  id uuid primary key default gen_random_uuid(),
  id_fonte uuid not null references fonte (id),
  url text unique not null,
  titulo text not null,
  resumo text,
  publicado_em timestamptz,
  relevancia integer not null default 0,
  dados_extraidos jsonb not null default '{}'::jsonb,
  status text not null default 'novo'
    check (status in ('novo', 'analisado', 'aprovado', 'descartado', 'erro')),
  erro text,
  encontrado_em timestamptz not null default now(),
  analisado_em timestamptz,
  constraint candidato_url_chk check (url ~ '^https?://')
);

create index if not exists candidato_fonte_idx on candidato_projeto (id_fonte);
create index if not exists candidato_status_relevancia_idx
  on candidato_projeto (status, relevancia desc);

alter table candidato_projeto enable row level security;

comment on table candidato_projeto is
  'Fila de notícias candidatas encontradas pelo scanner; aprovação cria projeto e evidência.';
