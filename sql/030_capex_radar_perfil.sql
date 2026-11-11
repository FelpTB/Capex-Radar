-- Radar CapEx — fluxo com perfis do projeto, subprojetos e registros brutos.
-- Idempotente: o deploy reaplica todos os arquivos.
--
-- Fluxo (src/capex-fases.js): Captação → Filtro 1 → Perfil inicial →
-- Enriquecimento → Perfil enriquecido → Filtro 2 → Enriquecimento 2 →
-- Perfil completo.
--
-- 1. Projeto pai e filhos. Um projeto pode nascer de outro: expansão da
--    mesma planta, subprojeto (ETA, ETE, subestação, ramal) ou a mesma obra
--    em outra localidade. Cada filho tem a própria busca nas fontes
--    secundárias e a própria linha do tempo.
-- 2. Perfil padronizado do projeto (src/capex-perfil.js), com a etapa em que
--    foi montado: inicial (notícias), enriquecido (texto das matérias) ou
--    completo (com as fontes secundárias).
-- 3. Registros brutos: tudo o que o Enriquecimento 2 analisou para o
--    projeto, aceito ou não, com o registro original e o motivo.
-- 4. Evidência fora da cronologia (antes do anúncio ou depois da conclusão):
--    o vínculo fica 'rejeitado' com descarte = 'cronologia'.
--
-- vw_carteira não muda: a 021 recria a view a cada deploy. As colunas novas
-- são lidas direto de projetos.

alter table capex_radar.projetos add column if not exists projeto_pai_id uuid
  references capex_radar.projetos(id) on delete set null;
alter table capex_radar.projetos add column if not exists relacao text;
alter table capex_radar.projetos add column if not exists perfil jsonb;
alter table capex_radar.projetos add column if not exists perfil_etapa text;
alter table capex_radar.projetos add column if not exists perfil_em timestamptz;

do $$ begin
  alter table capex_radar.projetos add constraint projetos_relacao_chk
    check (relacao is null or relacao in ('expansao', 'subprojeto', 'localidade'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table capex_radar.projetos add constraint projetos_perfil_etapa_chk
    check (perfil_etapa is null or perfil_etapa in ('inicial', 'enriquecido', 'completo'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table capex_radar.projetos add constraint projetos_pai_chk
    check (projeto_pai_id is null or projeto_pai_id <> id);
exception when duplicate_object then null; end $$;

create index if not exists projetos_pai_idx on capex_radar.projetos (projeto_pai_id);

comment on column capex_radar.projetos.projeto_pai_id is
  'Projeto de origem: expansão, subprojeto (ETA, ETE, subestação) ou outra localidade da mesma obra.';
comment on column capex_radar.projetos.perfil is
  'Perfil padronizado (src/capex-perfil.js): objeto, local, valor, estágio, datas, obra, licenças, fontes.';

alter table capex_radar.evidencia_projeto add column if not exists descarte text;

do $$ begin
  alter table capex_radar.evidencia_projeto add constraint evidencia_projeto_descarte_chk
    check (descarte is null or descarte in ('cronologia', 'ampla', 'outro_projeto', 'repetida'));
exception when duplicate_object then null; end $$;

create table if not exists capex_radar.registros_analisados (
  id bigint generated always as identity primary key,
  projeto_id uuid not null references capex_radar.projetos(id) on delete cascade,
  fonte_codigo text not null,
  chave text not null,
  registro jsonb not null,
  data_registro date,
  correlacao text not null
    check (correlacao in ('direta', 'incerta', 'outro_projeto', 'outro_estado', 'nao_avaliada')),
  motivo text,
  evidencia_id uuid references capex_radar.evidencias(id) on delete set null,
  analisado_por text not null,
  em timestamptz not null default now(),
  unique (projeto_id, chave)
);

create index if not exists registros_analisados_projeto_idx
  on capex_radar.registros_analisados (projeto_id, correlacao);
alter table capex_radar.registros_analisados enable row level security;

comment on table capex_radar.registros_analisados is
  'Registros das fontes secundárias analisados para cada projeto, aceitos ou não, com o dado bruto.';
