-- Radar CapEx — Enriquecimento (fase 4) e Filtro 3 (fase 5) das notícias.
-- Idempotente: o deploy reaplica todos os arquivos.
--
-- Depois do Filtro 2, a IA acha a matéria original, lê o texto e grava o
-- perfil do projeto em enriquecimento. O Filtro 3 relê esse perfil e grava a
-- decisão em filtro_final; o descarte também vai para triagem
-- ('descartada', motivo "Filtro 3: ..."). A tela só mostra para aprovação o
-- que passou por todas as fases (ver src/capex-fases.js).

alter table capex_radar.evidencias add column if not exists enriquecimento jsonb;
alter table capex_radar.evidencias add column if not exists filtro_final jsonb;

create index if not exists evidencias_enriquecida_idx
  on capex_radar.evidencias (grupo_id) where enriquecimento is not null;
create index if not exists evidencias_filtro_final_decisao_idx
  on capex_radar.evidencias (grupo_id, (filtro_final->>'decisao'));

comment on column capex_radar.evidencias.enriquecimento is
  'Enriquecimento: {versao, modelo, encontrou, url_original, resumo, perfil do projeto, trechos, buscas, em}. Ver src/capex-enriquecimento.js.';
comment on column capex_radar.evidencias.filtro_final is
  'Filtro 3: {versao, modelo, decisao (manter|descartar), motivo, fato, repete_id, justificativa, em}. Ver src/capex-filtro-final.js.';
