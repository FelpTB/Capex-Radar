alter table enr_siga
  add column if not exists nucleo_ceg text,
  add column if not exists origem_combustivel text,
  add column if not exists fonte_combustivel text,
  add column if not exists tipo_outorga text,
  add column if not exists nome_fonte text,
  add column if not exists potencia_fiscalizada_kw numeric,
  add column if not exists garantia_fisica_kw numeric,
  add column if not exists geracao_qualificada text,
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists sub_bacia text,
  add column if not exists cnpj_edicao date,
  add column if not exists inicio_vigencia date,
  add column if not exists fim_vigencia date,
  add column if not exists gerado_em date;

comment on table enr_siga is
  'Empreendimentos de geração da ANEEL, as 23 colunas do CSV. cnpjs sai do texto de participação; cnpj_edicao marca o número recuperado de uma edição anterior.';
