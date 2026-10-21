alter table enr_cvm_ipe
  add column if not exists especie text,
  add column if not exists tipo_apresentacao text;

comment on table enr_cvm_ipe is
  'Índice de fato relevante e comunicado ao mercado, com as 13 colunas do CSV IPE. O texto convertido fica em enr_cvm_documento.';
