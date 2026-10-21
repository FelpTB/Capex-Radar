alter table projeto add column if not exists status_em date;
alter table projeto add column if not exists status_em_origem text;

alter table projeto drop constraint if exists projeto_status_em_origem_chk;
alter table projeto
  add constraint projeto_status_em_origem_chk
  check (status_em_origem is null or status_em_origem in ('texto', 'publicacao'));

comment on column projeto.status_em is
  'Data aproximada em que a notícia viu o projeto nesse status. Sai do texto ou, se ele não tiver data, da publicação.';
comment on column projeto.status_em_origem is
  'texto quando a data está na notícia; publicacao quando vale a data da matéria.';
