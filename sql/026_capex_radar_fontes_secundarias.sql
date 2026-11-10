-- Radar CapEx — fontes secundárias e linha do tempo dos projetos da carteira.
-- Idempotente: o deploy reaplica todos os arquivos.
--
-- Os registros das fontes secundárias (BNDES, SIGA, Ibama, CNO, CVM, diários
-- oficiais...) com correlação direta com o projeto entram como evidências
-- (capex_radar.evidencias, triagem 'vinculada') ligadas ao projeto. Depois um
-- modelo monta a linha do tempo do projeto com as notícias e esses registros.
-- Ver src/capex-fontes-secundarias.js.

alter table capex_radar.projetos add column if not exists secundarias jsonb;
alter table capex_radar.projetos add column if not exists linha_tempo jsonb;

comment on column capex_radar.projetos.secundarias is
  'Consulta às fontes secundárias: {versao, em, fontes: [{codigo, avaliadas, diretas}], gravadas}.';
comment on column capex_radar.projetos.linha_tempo is
  'Linha do tempo montada por modelo: {versao, modelo, resumo, estagio, marcos: [{data, marco, tipo, evidencias}], em}.';
