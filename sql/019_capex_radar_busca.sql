-- Radar CapEx — Fase 2 do teste de monitoramento (nov/2026).
--
-- 1. nicho_cnae: CNAE (por prefixo) que importam em cada nicho. Uma filial é
--    prioritária quando o CNAE principal começa por um desses prefixos.
--    O tipo separa a fábrica (industrial) do CD (logistica), da base de
--    matéria-prima (insumo) e do campus de datacenter (infraestrutura).
-- 2. grupo_termos: termos de busca de cada empresa (marca, razão social,
--    variações e exclusões). O coletor da Fase 3 monta a consulta com eles.
-- 3. vw_filiais: filiais com grupo, nicho e prioridade.
--
-- Idempotente: o deploy reaplica todos os arquivos.

create table if not exists capex_radar.nicho_cnae (
  nicho         text not null
                check (nicho in ('papel_celulose', 'alimentos_bebidas', 'ecommerce', 'datacenter')),
  cnae_prefixo  text not null check (cnae_prefixo ~ '^[0-9]{2,7}$'),
  tipo          text not null check (tipo in ('industrial', 'logistica', 'insumo', 'infraestrutura')),
  descricao     text not null,
  primary key (nicho, cnae_prefixo)
);

comment on table capex_radar.nicho_cnae is
  'CNAE prioritários por nicho (prefixo do CNAE principal da filial). Fase 2 do teste de monitoramento.';

insert into capex_radar.nicho_cnae (nicho, cnae_prefixo, tipo, descricao) values
  -- Papel e celulose
  ('papel_celulose', '1710', 'industrial', 'Fabricação de celulose e outras pastas'),
  ('papel_celulose', '1721', 'industrial', 'Fabricação de papel'),
  ('papel_celulose', '1722', 'industrial', 'Fabricação de cartolina e papel-cartão'),
  ('papel_celulose', '173',  'industrial', 'Embalagens de papel, cartolina, papel-cartão e papelão ondulado'),
  ('papel_celulose', '174',  'industrial', 'Produtos diversos de papel (inclui tissue)'),
  ('papel_celulose', '0210', 'insumo',     'Produção florestal: florestas plantadas (eucalipto, pinus)'),
  ('papel_celulose', '0230', 'insumo',     'Apoio à produção florestal'),
  ('papel_celulose', '5211', 'logistica',  'Armazenamento'),
  ('papel_celulose', '5212', 'logistica',  'Carga e descarga'),
  -- Alimentos e bebidas
  ('alimentos_bebidas', '10',   'industrial', 'Fabricação de produtos alimentícios'),
  ('alimentos_bebidas', '11',   'industrial', 'Fabricação de bebidas'),
  ('alimentos_bebidas', '0151', 'insumo',     'Criação de bovinos'),
  ('alimentos_bebidas', '0154', 'insumo',     'Criação de suínos'),
  ('alimentos_bebidas', '0155', 'insumo',     'Criação de aves'),
  ('alimentos_bebidas', '4632', 'logistica',  'Atacado de cereais e leguminosas (CDs)'),
  ('alimentos_bebidas', '4634', 'logistica',  'Atacado de carnes e derivados (CDs)'),
  ('alimentos_bebidas', '4635', 'logistica',  'Atacado de bebidas (CDs de bebidas)'),
  ('alimentos_bebidas', '4637', 'logistica',  'Atacado de café, chocolates e outros alimentos (CDs)'),
  ('alimentos_bebidas', '4639', 'logistica',  'Atacado de produtos alimentícios em geral (CDs)'),
  ('alimentos_bebidas', '5211', 'logistica',  'Armazenamento'),
  -- E-commerce: lojas (4713, 4753...) ficam fora; o CapEx está nos CDs.
  ('ecommerce', '5211', 'logistica', 'Armazenamento (centros de distribuição)'),
  ('ecommerce', '5212', 'logistica', 'Carga e descarga'),
  ('ecommerce', '5250', 'logistica', 'Atividades auxiliares e operador logístico'),
  ('ecommerce', '4930', 'logistica', 'Transporte rodoviário de carga'),
  ('ecommerce', '5320', 'logistica', 'Entrega e malote'),
  ('ecommerce', '4649', 'logistica', 'Atacado de bens de uso pessoal e doméstico (CDs)'),
  ('ecommerce', '4693', 'logistica', 'Atacado de mercadorias em geral (CDs)'),
  -- Datacenters: holdings (6462, 6463) e escritório (8211) ficam fora.
  ('datacenter', '6311', 'infraestrutura', 'Tratamento de dados e hospedagem'),
  ('datacenter', '6319', 'infraestrutura', 'Portais e serviços de informação'),
  ('datacenter', '7733', 'infraestrutura', 'Aluguel de equipamentos de informática (colocation)'),
  ('datacenter', '7739', 'infraestrutura', 'Aluguel de outras máquinas e equipamentos (colocation)'),
  ('datacenter', '61',   'infraestrutura', 'Telecomunicações (conectividade do campus)'),
  ('datacenter', '6209', 'infraestrutura', 'Suporte técnico em TI'),
  ('datacenter', '3511', 'infraestrutura', 'Geração de energia (autoprodução do campus)'),
  ('datacenter', '41',   'infraestrutura', 'Construção de edifícios (SPE de obra)'),
  ('datacenter', '42',   'infraestrutura', 'Obras de infraestrutura (SPE de obra)')
on conflict (nicho, cnae_prefixo) do update set
  tipo = excluded.tipo, descricao = excluded.descricao;

create table if not exists capex_radar.grupo_termos (
  id         bigint generated always as identity primary key,
  grupo_id   uuid not null references capex_radar.grupos (id) on delete cascade,
  termo      text not null check (length(trim(termo)) > 1),
  tipo       text not null check (tipo in ('marca', 'razao_social', 'variacao', 'exclusao')),
  ativo      boolean not null default true,
  notas      text,
  criado_em  timestamptz not null default now(),
  unique (grupo_id, termo)
);

comment on table capex_radar.grupo_termos is
  'Termos de busca por empresa. marca/razao_social/variacao entram com OR; exclusao entra com sinal de menos.';

create index if not exists grupo_termos_grupo_idx on capex_radar.grupo_termos (grupo_id) where ativo;

drop trigger if exists tg_grupo_termos_log on capex_radar.grupo_termos;
create trigger tg_grupo_termos_log
  after insert or update or delete on capex_radar.grupo_termos
  for each row execute function capex_radar.tg_log_acao();

create or replace view capex_radar.vw_filiais as
select f.*,
       m.grupo_id,
       g.nome  as grupo,
       g.nicho,
       m.papel as papel_matriz,
       p.tipo  as prioridade,
       p.descricao as prioridade_descricao,
       p.tipo is not null as prioritaria
  from capex_radar.filiais f
  join capex_radar.matrizes m on m.cnpj = f.matriz_cnpj
  join capex_radar.grupos g on g.id = m.grupo_id
  left join lateral (
    select n.tipo, n.descricao
      from capex_radar.nicho_cnae n
     where n.nicho = g.nicho and f.cnae like n.cnae_prefixo || '%'
     order by length(n.cnae_prefixo) desc
     limit 1
  ) p on true;

comment on view capex_radar.vw_filiais is
  'Filiais com grupo, nicho e prioridade pelo CNAE principal (capex_radar.nicho_cnae).';
