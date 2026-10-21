-- Separa catálogo ativo de coleta automática.
-- Ativar uma fonte a coloca no mapa do módulo de captura.
-- participa_scanner continua restrito ao piloto de notícias.

alter table fonte
  add column if not exists participa_scanner boolean not null default false,
  add column if not exists papel_captura text,
  add column if not exists formato_dado text,
  add column if not exists auth_acesso text,
  add column if not exists unidade_registro text;

update fonte
set ativo = true,
    updated_at = now()
where not ativo;

alter table fonte drop constraint if exists fonte_papel_captura_chk;
alter table fonte drop constraint if exists fonte_formato_dado_chk;
alter table fonte drop constraint if exists fonte_auth_acesso_chk;

alter table fonte
  add constraint fonte_papel_captura_chk check (
    papel_captura is null or papel_captura in (
      'descoberta', 'enriquecimento', 'lookup', 'indice'
    )
  );

alter table fonte
  add constraint fonte_formato_dado_chk check (
    formato_dado is null or formato_dado in (
      'html', 'json_api', 'csv_zip', 'gis', 'formulario', 'pdf', 'misto'
    )
  );

alter table fonte
  add constraint fonte_auth_acesso_chk check (
    auth_acesso is null or auth_acesso in (
      'nenhuma', 'chave', 'oauth', 'gcp', 'captcha_paywall'
    )
  );

comment on column fonte.participa_scanner is
  'true só nas fontes cujo listing o scanner do piloto pode ler. Não liga processamento das demais.';
comment on column fonte.papel_captura is
  'Papel no módulo de captura: descoberta, enriquecimento, lookup ou indice.';
comment on column fonte.formato_dado is
  'Como o dado está disponível: html, json_api, csv_zip, gis, formulario, pdf ou misto.';
comment on column fonte.auth_acesso is
  'Barreira de acesso: nenhuma, chave, oauth, gcp ou captcha_paywall.';
comment on column fonte.unidade_registro is
  'O que uma linha ou página dessa fonte representa.';
