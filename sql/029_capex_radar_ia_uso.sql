-- Radar CapEx — tokens de cada chamada ao Claude.
-- Idempotente: o deploy reaplica todos os arquivos.
--
-- Cada chamada de src/claude.js grava a etapa, o modelo, os tokens e as
-- buscas na web. A view soma por dia, etapa e modelo e estima o custo em
-- dólar pelos preços de tabela (Haiku 5.5: 0,10/0,50; Sonnet 5.5: 2/10 por
-- milhão de tokens de entrada/saída; busca na web: 10 por mil).

create table if not exists capex_radar.ia_uso (
  id bigint generated always as identity primary key,
  etapa text,
  modelo text not null,
  entrada int not null default 0,
  saida int not null default 0,
  cache_leitura int not null default 0,
  cache_escrita int not null default 0,
  buscas int not null default 0,
  voltas int not null default 1,
  ok boolean not null default true,
  em timestamptz not null default now()
);

create index if not exists ia_uso_em_idx on capex_radar.ia_uso (em);
alter table capex_radar.ia_uso enable row level security;

create or replace view capex_radar.vw_ia_uso_dia as
select (em at time zone 'UTC')::date as dia,
       etapa,
       modelo,
       count(*) as chamadas,
       sum(entrada + cache_leitura + cache_escrita) as tokens_entrada,
       sum(saida) as tokens_saida,
       sum(buscas) as buscas,
       round((
         sum(entrada + cache_escrita * 1.25 + cache_leitura * 0.1) * case when modelo like 'claude-sonnet%' then 2 when modelo like 'claude-haiku%' then 0.1 when modelo like 'claude-opus%' then 4 else 2 end
         + sum(saida) * case when modelo like 'claude-sonnet%' then 10 when modelo like 'claude-haiku%' then 0.5 when modelo like 'claude-opus%' then 20 else 10 end
       ) / 1e6 + sum(buscas) * 0.01, 4) as custo_usd
  from capex_radar.ia_uso
 group by 1, 2, 3;
