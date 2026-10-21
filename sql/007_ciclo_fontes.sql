-- Ciclo das fontes de notícia: sugerida, prova, fixa, aposentada.
-- A aparição guarda o portal visto na busca, sem matéria do Google.

alter table fonte
  add column if not exists estagio text,
  add column if not exists estagio_desde timestamptz;

alter table fonte drop constraint if exists fonte_estagio_chk;

alter table fonte
  add constraint fonte_estagio_chk check (
    estagio is null or estagio in ('sugerida', 'prova', 'fixa', 'aposentada')
  );

update fonte
set estagio = 'fixa',
    estagio_desde = coalesce(estagio_desde, now())
where participa_scanner
  and estagio is null;

comment on column fonte.estagio is
  'Ciclo da notícia privada: sugerida, prova, fixa ou aposentada. Nulo fora desse ciclo.';
comment on column fonte.estagio_desde is
  'Momento em que o estágio atual começou.';

create table if not exists fonte_aparicao (
  id uuid primary key default gen_random_uuid(),
  dominio text not null,
  nome_portal text,
  consulta text not null,
  visto_em timestamptz not null default now()
);

create index if not exists fonte_aparicao_dominio_visto_idx
  on fonte_aparicao (dominio, visto_em desc);

alter table fonte_aparicao enable row level security;

comment on table fonte_aparicao is
  'Portal observado numa busca. Não guarda manchete, link nem corpo do Google.';

create table if not exists ciclo_estado (
  id smallint primary key default 1,
  ultimo_scan_em timestamptz,
  ultima_descoberta_em timestamptz,
  ultima_aposentadoria_em timestamptz,
  ultimo_resumo text,
  constraint ciclo_estado_singleton check (id = 1)
);

insert into ciclo_estado (id) values (1) on conflict (id) do nothing;

alter table ciclo_estado enable row level security;

comment on table ciclo_estado is
  'Relógio do ciclo local: varredura, descoberta de portais e aposentadoria.';
