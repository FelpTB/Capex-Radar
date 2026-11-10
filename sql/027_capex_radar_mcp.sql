-- Radar CapEx — acesso por MCP para pessoas da ABC Advise.
-- Idempotente: o deploy reaplica todos os arquivos.
--
-- Cada pessoa recebe um token próprio (só o hash fica aqui). O papel define o
-- que o modelo dela pode fazer: 'leitura' consulta; 'edicao' também altera
-- projetos e decide notícias. Toda chamada fica em mcp_uso; as escritas também
-- caem no log_acao com o ator 'usuario:mcp:<email>'. Ver src/capex-mcp.js e
-- docs/acesso-mcp.md.

create table if not exists capex_radar.mcp_acessos (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  email         text not null,
  papel         text not null check (papel in ('leitura', 'edicao')),
  token_hash    text not null unique,          -- sha256 do token, em hex
  token_inicio  text not null,                 -- primeiros caracteres, para reconhecer o token
  criado_por    text not null default capex_radar.ator_atual(),
  criado_em     timestamptz not null default now(),
  revogado_em   timestamptz,
  ultimo_uso_em timestamptz
);

create index if not exists mcp_acessos_email_idx on capex_radar.mcp_acessos (lower(email));

create table if not exists capex_radar.mcp_uso (
  id          bigint generated always as identity primary key,
  acesso_id   uuid not null references capex_radar.mcp_acessos (id) on delete cascade,
  ferramenta  text not null,
  argumentos  jsonb not null default '{}'::jsonb,
  ok          boolean not null,
  erro        text,
  em          timestamptz not null default now()
);

create index if not exists mcp_uso_acesso_idx on capex_radar.mcp_uso (acesso_id, em desc);

alter table capex_radar.mcp_acessos enable row level security;
alter table capex_radar.mcp_uso     enable row level security;

comment on table capex_radar.mcp_acessos is 'Tokens de acesso MCP por pessoa (hash), com papel leitura ou edicao.';
comment on table capex_radar.mcp_uso is 'Cada chamada de ferramenta MCP: quem, qual ferramenta, argumentos e resultado.';
