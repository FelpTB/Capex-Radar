-- Agente de triagem automática (capex_radar).
--
-- O agente lê as notícias que a triagem marcou como CapEx e decide: criar o
-- projeto, ligar a um projeto existente (mesmo ativo) ou descartar. Cada
-- decisão fica gravada com o que o agente viu (entrada) e o que respondeu
-- (saida), para a revisão humana avaliar e o par virar exemplo de treino.

create table if not exists capex_radar.agente_decisao (
  id               uuid primary key default gen_random_uuid(),
  evidencia_id     uuid references capex_radar.evidencias (id) on delete set null,
  grupo_id         uuid references capex_radar.grupos (id) on delete set null,
  modelo           text not null,
  versao_prompt    text not null,
  entrada          jsonb not null,          -- notícia e projetos candidatos, como o agente viu
  saida            jsonb,                   -- resposta validada do modelo
  decisao          text check (decisao in ('criar_projeto', 'vincular', 'descartar', 'revisar')),
  motivo           text,                    -- código do motivo (ver src/capex-agente.js)
  confianca        smallint check (confianca between 0 and 100),
  -- O que foi feito de fato: as travas podem mandar para a revisão humana.
  acao             text not null check (acao in ('projeto_criado', 'vinculada', 'descartada', 'revisao_humana', 'erro')),
  acao_motivo      text,                    -- por que a ação difere da decisão (trava), ou o erro
  projeto_id       uuid,                    -- projeto criado ou ligado (sem FK: o projeto pode ser excluído)
  desfeita         boolean not null default false,
  criado_em        timestamptz not null default now(),
  -- Avaliação humana: forma o conjunto de treino.
  avaliacao        text check (avaliacao in ('correta', 'incorreta')),
  decisao_correta  text check (decisao_correta in ('criar_projeto', 'vincular', 'descartar')),
  motivo_correto   text,
  observacao       text,
  avaliado_por     text,
  avaliado_em      timestamptz
);

create index if not exists agente_decisao_evidencia_idx on capex_radar.agente_decisao (evidencia_id);
create index if not exists agente_decisao_criado_idx on capex_radar.agente_decisao (criado_em desc);
create index if not exists agente_decisao_avaliacao_idx on capex_radar.agente_decisao (avaliacao);

drop trigger if exists tg_agente_decisao_log on capex_radar.agente_decisao;
create trigger tg_agente_decisao_log after insert or update or delete on capex_radar.agente_decisao
  for each row execute function capex_radar.tg_log_acao();
