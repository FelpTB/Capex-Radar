-- Radar CapEx — avaliação dos projetos da carteira por um modelo.
-- Idempotente: o deploy reaplica todos os arquivos.
--
-- O modelo relê cada projeto com as notícias ligadas a ele (já enriquecidas)
-- e decide: válido (com correções de local, valor e estágio), inválido ou
-- duplicado de outro projeto do grupo. Inválido e duplicado vão para
-- status 'descartado'; o status anterior fica em avaliacao.status_anterior,
-- para a tela poder desfazer. Ver src/capex-avaliacao-projetos.js.
--
-- A coluna não entra em vw_carteira: a 021 recria a view a cada deploy e um
-- create or replace com uma coluna a menos falharia. A carteira lê a
-- avaliação direto de capex_radar.projetos.

alter table capex_radar.projetos add column if not exists avaliacao jsonb;

comment on column capex_radar.projetos.avaliacao is
  'Avaliação da carteira: {versao, modelo, decisao (valido|invalido|duplicado), motivo, duplicado_de, justificativa, correcoes, aplicado, status_anterior, em}.';
