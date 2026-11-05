-- Radar CapEx — Fase 3: coletor de notícias por empresa (capex_radar).
-- Idempotente: o deploy reaplica todos os arquivos.

-- Resultado da triagem da IA sobre a notícia: se fala de ativo físico do
-- grupo e o que dá para extrair do título (objeto, UF, município, valor,
-- estágio, data do fato) e a filial sugerida.
alter table capex_radar.evidencias add column if not exists extracao jsonb;
alter table capex_radar.evidencias add column if not exists modelo_triagem text;

create index if not exists evidencias_grupo_triagem_idx
  on capex_radar.evidencias (grupo_id, triagem);

-- Janelas já consultadas por grupo e fonte. A carga histórica pula as
-- janelas com status ok, e a atualização semanal parte da última delas.
create table if not exists capex_radar.coleta_janela (
  grupo_id      uuid not null references capex_radar.grupos (id),
  fonte_codigo  text not null references capex_radar.fontes (codigo),
  desde         date not null,
  ate           date not null,
  consulta      text not null,
  itens         integer not null default 0,
  novos         integer not null default 0,
  status        text not null check (status in ('ok', 'subdividida', 'erro')),
  erro          text,
  coletado_em   timestamptz not null default now(),
  primary key (grupo_id, fonte_codigo, desde, ate),
  constraint coleta_janela_datas_chk check (ate > desde)
);

create index if not exists coleta_janela_recente_idx
  on capex_radar.coleta_janela (fonte_codigo, coletado_em desc);

alter table capex_radar.coleta_janela enable row level security;

comment on table capex_radar.coleta_janela is
  'Janelas de busca já lidas por grupo e fonte. status subdividida: a janela trouxe o teto do RSS e foi fatiada em meses.';
comment on column capex_radar.evidencias.extracao is
  'Triagem da IA: {capex, motivo, objeto, uf, municipio, valor_brl, estagio, data_fato, filial_sugerida}.';
