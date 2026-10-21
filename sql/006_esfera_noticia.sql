-- Diferencia portal de notícia público (órgão) de portal privado (imprensa).
-- Nulo nas fontes que não são notícia.

alter table fonte
  add column if not exists esfera_noticia text;

alter table fonte drop constraint if exists fonte_esfera_noticia_chk;

alter table fonte
  add constraint fonte_esfera_noticia_chk check (
    esfera_noticia is null or esfera_noticia in ('publica', 'privada')
  );

comment on column fonte.esfera_noticia is
  'Portal de notícia: publica (órgão ou agência estatal) ou privada (imprensa). Nulo quando a fonte não é notícia.';
