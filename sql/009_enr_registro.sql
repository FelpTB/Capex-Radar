create table if not exists enr_registro (
  codigo text not null,
  chave text not null,
  cnpj text,
  cnpjs text[] not null default '{}',
  titulo text,
  uf text,
  municipio text,
  valor numeric,
  payload jsonb not null,
  carregado_em timestamptz not null default now(),
  primary key (codigo, chave)
);

create index if not exists enr_registro_cnpj_idx on enr_registro (cnpj);
create index if not exists enr_registro_cnpjs_idx on enr_registro using gin (cnpjs);
create index if not exists enr_registro_codigo_idx on enr_registro (codigo);

comment on table enr_registro is
  'Cópia local das fontes secundárias com arquivo ou API pública. A linha inteira fica em payload.';

alter table enr_registro enable row level security;
