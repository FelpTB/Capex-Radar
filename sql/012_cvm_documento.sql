create table if not exists enr_cvm_documento (
  protocolo text not null,
  versao integer not null default 1,
  cnpj text,
  link text,
  data_entrega date,
  markdown text,
  status text not null,
  erro text,
  convertido_em timestamptz not null default now(),
  primary key (protocolo, versao)
);

create index if not exists enr_cvm_documento_cnpj_idx
  on enr_cvm_documento (cnpj, data_entrega desc);

comment on table enr_cvm_documento is
  'Markdown dos documentos IPE lidos na coleta de uma empresa. No máximo cinco, com entrega há menos de um ano.';

comment on table enr_cvm_ipe is
  'Índice de fato relevante e comunicado ao mercado. O texto convertido fica em enr_cvm_documento.';

alter table enr_cvm_documento enable row level security;
