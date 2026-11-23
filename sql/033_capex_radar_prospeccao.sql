-- Prospecção pelo CNO (Pontos de Melhora 23/11/2026, item 2): obras de galpão
-- industrial de indústrias privadas viram projetos em pré-cadastro. Marca a
-- origem do grupo e do projeto. Os nichos novos (inclusive 'industria') ficam
-- na 034, que roda depois desta a cada deploy.

alter table capex_radar.grupos add column if not exists origem text not null default 'curadoria';
alter table capex_radar.projetos add column if not exists origem text;

do $$ begin
  alter table capex_radar.grupos add constraint grupos_origem_chk check (origem in ('curadoria', 'cno_prospeccao'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table capex_radar.projetos add constraint projetos_origem_chk check (origem is null or origem in ('cno_prospeccao'));
exception when duplicate_object then null; end $$;

comment on column capex_radar.grupos.origem is 'curadoria (lista inicial) ou cno_prospeccao (empresa achada por obra no CNO).';
comment on column capex_radar.projetos.origem is 'cno_prospeccao: pré-cadastro criado de uma obra do CNO, a validar com notícias.';
