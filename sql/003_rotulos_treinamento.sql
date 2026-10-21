-- Preserva toda notícia prospectada e registra a decisão humana como rótulo.

alter table candidato_projeto
  drop constraint if exists candidato_projeto_status_check;

update candidato_projeto
set status = 'rejeitado'
where status = 'descartado';

alter table candidato_projeto
  add constraint candidato_projeto_status_check
  check (status in ('novo', 'analisado', 'aprovado', 'rejeitado', 'erro'));

alter table candidato_projeto
  add column if not exists rotulo_projeto boolean,
  add column if not exists decidido_em timestamptz,
  add column if not exists motivo_decisao text,
  add column if not exists modelo_extracao text;

update candidato_projeto
set rotulo_projeto = true,
    decidido_em = coalesce(decidido_em, analisado_em, encontrado_em)
where status = 'aprovado' and rotulo_projeto is null;

update candidato_projeto
set rotulo_projeto = false,
    decidido_em = coalesce(decidido_em, analisado_em, encontrado_em)
where status = 'rejeitado' and rotulo_projeto is null;

create index if not exists candidato_rotulo_idx
  on candidato_projeto (rotulo_projeto, decidido_em desc);

comment on column candidato_projeto.rotulo_projeto is
  'Rótulo humano para futuro treinamento: true=projeto, false=não projeto.';
