-- Radar CapEx — login próprio no MCP (OAuth com a conta Google da ABC Advise).
-- Idempotente: o deploy reaplica todos os arquivos.
--
-- A pessoa adiciona o conector no Claude e entra com a conta Google
-- @abcadvise.com.br; ninguém precisa enviar token. Quem entra pela primeira vez
-- ganha papel 'leitura'; o administrador libera 'edicao' por e-mail
-- (npm run capex:mcp -- liberar). O token pessoal fixo (cxr_) continua valendo
-- para clientes sem OAuth. Ver src/capex-mcp-oauth.js e docs/acesso-mcp.md.

alter table capex_radar.mcp_acessos alter column token_hash drop not null;
alter table capex_radar.mcp_acessos alter column token_inicio drop not null;
alter table capex_radar.mcp_acessos add column if not exists origem text not null default 'token';

do $$ begin
  alter table capex_radar.mcp_acessos
    add constraint mcp_acessos_origem_chk check (origem in ('token', 'google', 'liberado'));
exception when duplicate_object then null;
end $$;

-- Um acesso ativo por e-mail.
create unique index if not exists mcp_acessos_email_ativo_uq
  on capex_radar.mcp_acessos (lower(email)) where revogado_em is null;

-- Clientes OAuth registrados sozinhos (registro dinâmico: claude.ai, Claude Desktop...).
create table if not exists capex_radar.mcp_oauth_clientes (
  client_id  text primary key,
  dados      jsonb not null,
  criado_em  timestamptz not null default now()
);

-- Pedido de autorização em andamento, enquanto a pessoa entra no Google.
create table if not exists capex_radar.mcp_oauth_pedidos (
  id         text primary key,                  -- vai como state para o Google
  client_id  text not null references capex_radar.mcp_oauth_clientes (client_id) on delete cascade,
  parametros jsonb not null,                    -- redirect_uri, state, code_challenge, scopes, resource
  expira_em  timestamptz not null,
  criado_em  timestamptz not null default now()
);

-- Códigos de autorização e tokens emitidos (só o hash).
create table if not exists capex_radar.mcp_oauth_tokens (
  hash        text primary key,
  tipo        text not null check (tipo in ('codigo', 'acesso', 'renovacao')),
  client_id   text not null references capex_radar.mcp_oauth_clientes (client_id) on delete cascade,
  acesso_id   uuid not null references capex_radar.mcp_acessos (id) on delete cascade,
  dados       jsonb not null default '{}'::jsonb,  -- código: code_challenge, redirect_uri
  expira_em   timestamptz not null,
  usado_em    timestamptz,
  revogado_em timestamptz,
  criado_em   timestamptz not null default now()
);

create index if not exists mcp_oauth_tokens_acesso_idx on capex_radar.mcp_oauth_tokens (acesso_id, tipo);

alter table capex_radar.mcp_oauth_clientes enable row level security;
alter table capex_radar.mcp_oauth_pedidos  enable row level security;
alter table capex_radar.mcp_oauth_tokens   enable row level security;

comment on table capex_radar.mcp_oauth_clientes is 'Clientes OAuth do MCP (registro dinâmico).';
comment on table capex_radar.mcp_oauth_pedidos is 'Autorizações OAuth em andamento, durante o login no Google.';
comment on table capex_radar.mcp_oauth_tokens is 'Códigos e tokens OAuth do MCP (hash), ligados ao acesso da pessoa.';
