-- Radar CapEx — filtro CapEx (segunda passada depois da triagem).
-- Idempotente: o deploy reaplica todos os arquivos.
--
-- O filtro relê a fila "A revisar" com um modelo mais forte e uma definição
-- rígida de CapEx, e tira o que não é obra e as repetições do mesmo fato.
-- A decisão fica na própria notícia; o descarte também vai para triagem
-- ('descartada', motivo "Filtro CapEx: ..."), como os outros descartes.

alter table capex_radar.evidencias add column if not exists filtro jsonb;

-- Fila do filtro e do agente: notícias da fila ainda sem decisão do filtro.
create index if not exists evidencias_filtro_decisao_idx
  on capex_radar.evidencias (grupo_id, (filtro->>'decisao'));

comment on column capex_radar.evidencias.filtro is
  'Filtro CapEx: {versao, modelo, decisao (manter|descartar), motivo, repete_id, justificativa, ajuste?, em}. Ver src/capex-filtro.js.';
