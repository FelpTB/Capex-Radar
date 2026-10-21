alter table projeto add column if not exists leitura_status text;

comment on column projeto.leitura_status is
  'Parágrafo do agente que leu as evidências anotadas e descreve o que se sabe sobre o status.';
