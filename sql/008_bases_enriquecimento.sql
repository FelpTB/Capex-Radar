-- Cópias locais das bases secundárias usadas no enriquecimento.
-- A ficha consulta estas tabelas pelo CNPJ. A origem oficial continua sendo a evidência.

create table if not exists base_carga (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  recurso text not null,
  status text not null,
  linhas integer,
  bytes bigint,
  erro text,
  carregado_em timestamptz not null default now(),
  constraint base_carga_status_chk check (status in ('ok', 'erro', 'manual'))
);

create index if not exists base_carga_codigo_idx
  on base_carga (codigo, carregado_em desc);

comment on table base_carga is
  'Histórico de cada carga de base secundária: o que foi lido, quantas linhas e se falhou.';

create table if not exists enr_bndes (
  id bigserial primary key,
  cnpj text,
  cliente text,
  descricao text,
  uf text,
  municipio text,
  municipio_codigo text,
  numero_contrato text,
  data_contratacao date,
  valor_contratado numeric,
  valor_desembolsado numeric,
  produto text,
  forma_apoio text,
  natureza_cliente text,
  porte_cliente text,
  situacao_contrato text,
  carregado_em timestamptz not null default now()
);

create index if not exists enr_bndes_cnpj_idx on enr_bndes (cnpj);
create index if not exists enr_bndes_uf_idx on enr_bndes (uf);

comment on table enr_bndes is
  'Operações não automáticas do BNDES. Uma linha é um subcrédito. Sem valor de CapEx total.';

create table if not exists enr_siga (
  cod_ceg text primary key,
  nome text,
  nucleo_ceg text,
  uf text,
  tipo_geracao text,
  fase text,
  origem_combustivel text,
  fonte_combustivel text,
  tipo_outorga text,
  nome_fonte text,
  potencia_kw numeric,
  potencia_fiscalizada_kw numeric,
  garantia_fisica_kw numeric,
  geracao_qualificada text,
  latitude numeric,
  longitude numeric,
  municipios text,
  sub_bacia text,
  cnpjs text[] not null default '{}',
  participacao text,
  cnpj_edicao date,
  entrada_operacao date,
  inicio_vigencia date,
  fim_vigencia date,
  gerado_em date,
  carregado_em timestamptz not null default now()
);

create index if not exists enr_siga_cnpjs_idx on enr_siga using gin (cnpjs);
create index if not exists enr_siga_uf_idx on enr_siga (uf);

comment on table enr_siga is
  'Empreendimentos de geração da ANEEL, as 23 colunas do CSV. cnpjs sai do texto de participação; cnpj_edicao marca o número recuperado de uma edição anterior.';

create table if not exists enr_sislic (
  id bigserial primary key,
  tipo_licenca text,
  numero_licenca text,
  data_emissao date,
  data_vencimento date,
  empreendimento text,
  pessoa text,
  processo text,
  tipologia text,
  pac text,
  atualizado_em timestamp,
  carregado_em timestamptz not null default now()
);

create index if not exists enr_sislic_pessoa_idx on enr_sislic (lower(pessoa));
create index if not exists enr_sislic_processo_idx on enr_sislic (processo);

comment on table enr_sislic is
  'Licenças federais do Ibama. O CSV público não traz CNPJ; a busca é pela razão social.';

create table if not exists enr_cvm_ipe (
  protocolo text not null,
  versao integer not null default 1,
  cnpj text,
  codigo_cvm text,
  nome text,
  categoria text,
  tipo text,
  especie text,
  assunto text,
  tipo_apresentacao text,
  data_entrega date,
  data_referencia date,
  link text,
  ano integer not null,
  carregado_em timestamptz not null default now(),
  primary key (protocolo, versao)
);

create index if not exists enr_cvm_ipe_cnpj_idx on enr_cvm_ipe (cnpj, data_entrega desc);

comment on table enr_cvm_ipe is
  'Índice de fato relevante e comunicado ao mercado. O PDF não é baixado; o link fica na linha.';

create table if not exists enr_cno (
  id_cno text primary key,
  cnpj_responsavel text,
  situacao text,
  municipio text,
  uf text,
  area numeric,
  carregado_em timestamptz not null default now()
);

create index if not exists enr_cno_cnpj_idx on enr_cno (cnpj_responsavel);

comment on table enr_cno is
  'Obra civil da Receita. Sem valor. A carga espera o ZIP em data/incoming/cno.zip.';

create table if not exists enr_empresa (
  cnpj text primary key,
  razao_social text,
  nome_fantasia text,
  cnae text,
  uf text,
  municipio text,
  situacao text,
  origem text not null default 'cnpj',
  atualizado_em timestamptz not null default now()
);

create index if not exists enr_empresa_razao_idx on enr_empresa (lower(razao_social));

comment on table enr_empresa is
  'Recorte do cadastro de CNPJ usado para resolver e confirmar a empresa. Não é o dump nacional.';

alter table base_carga enable row level security;
alter table enr_bndes enable row level security;
alter table enr_siga enable row level security;
alter table enr_sislic enable row level security;
alter table enr_cvm_ipe enable row level security;
alter table enr_cno enable row level security;
alter table enr_empresa enable row level security;
