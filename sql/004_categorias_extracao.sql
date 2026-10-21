-- Classifica a forma técnica de extração de cada fonte.
-- "Data lake" foi evitado porque as fontes atuais são datasets/portais,
-- não uma arquitetura de armazenamento controlada pelo Radar.

update fonte
set categoria = case
  when codigo in ('NEWS-INFRA', 'NEWS-BENEWS', 'NEWS-MEGAWHAT', 'NEWS-ANEEL', 'NEWS-MPOR')
    then 'portal_web'
  when codigo in ('SEC-IBAMA', 'SEC-SIGA', 'SEC-BNDES')
    then 'dataset_download'
  when codigo = 'SEC-OBRASGOV'
    then 'api_publica'
  when codigo = 'SEC-CVM'
    then 'base_consultavel'
  else categoria
end;

alter table fonte drop constraint if exists fonte_categoria_extracao_chk;

alter table fonte
  add constraint fonte_categoria_extracao_chk check (
    categoria in (
      'api_publica',
      'api_privada',
      'dataset_download',
      'base_consultavel',
      'portal_web'
    )
  );

alter table fonte alter column categoria set not null;

comment on column fonte.categoria is
  'Forma de extração: api_publica, api_privada, dataset_download, base_consultavel ou portal_web.';
