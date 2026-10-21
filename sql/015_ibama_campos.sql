alter table enr_sislic add column if not exists pac text;
alter table enr_sislic add column if not exists atualizado_em timestamp;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'enr_sislic'
      and column_name = 'atualizado_em'
      and data_type = 'timestamp with time zone'
  ) then
    alter table enr_sislic
      alter column atualizado_em type timestamp
      using atualizado_em at time zone 'UTC';
  end if;
end $$;

comment on column enr_sislic.pac is
  'Coluna PAC do CSV. Nesta edição os valores são Sim e No. O catálogo do Ibama não define a coluna.';
comment on column enr_sislic.atualizado_em is
  'Coluna ultima_atualizacao_relatorio. Horário em que o Ibama gerou o extrato, igual em todas as linhas.';
