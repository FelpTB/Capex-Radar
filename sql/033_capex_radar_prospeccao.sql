-- Prospecção pelo CNO (Pontos de Melhora 23/11/2026, item 2): obras de galpão
-- industrial de indústrias privadas viram projetos em pré-cadastro. Abre o
-- nicho 'industria' para empresas fora dos quatro nichos iniciais e marca a
-- origem do grupo e do projeto.

alter table capex_radar.grupos drop constraint if exists grupos_nicho_check;
alter table capex_radar.grupos add constraint grupos_nicho_check
  check (nicho in ('papel_celulose', 'alimentos_bebidas', 'ecommerce', 'datacenter', 'industria'));

alter table capex_radar.nicho_cnae drop constraint if exists nicho_cnae_nicho_check;
alter table capex_radar.nicho_cnae add constraint nicho_cnae_nicho_check
  check (nicho in ('papel_celulose', 'alimentos_bebidas', 'ecommerce', 'datacenter', 'industria'));

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
