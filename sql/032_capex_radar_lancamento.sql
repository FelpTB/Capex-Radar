-- Data de lançamento do projeto (data_anuncio) = data da primeira evidência
-- forte aceita: notícia ou obra do CNO. A origem diz de onde veio; 'manual'
-- é a correção de uma pessoa, que o recálculo não sobrescreve.
alter table capex_radar.projetos add column if not exists data_anuncio_origem text;
alter table capex_radar.projetos add column if not exists data_anuncio_ref jsonb;

do $$ begin
  alter table capex_radar.projetos add constraint projetos_data_anuncio_origem_chk
    check (data_anuncio_origem is null or data_anuncio_origem in ('noticia', 'cno', 'manual'));
exception when duplicate_object then null; end $$;

comment on column capex_radar.projetos.data_anuncio_origem is
  'De onde veio a data de lançamento: noticia, cno (primeira evidência aceita) ou manual.';
comment on column capex_radar.projetos.data_anuncio_ref is
  'Evidência que deu a data {evidencia_id, titulo, fonte, data}; com origem manual, mais_antiga aponta evidência anterior à data informada.';
