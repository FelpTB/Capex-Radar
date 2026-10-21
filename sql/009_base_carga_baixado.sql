-- Download sem carga: o arquivo chegou em data/dadosgov, as linhas ainda não entraram.
alter table base_carga drop constraint if exists base_carga_status_chk;
alter table base_carga
  add constraint base_carga_status_chk
  check (status in ('ok', 'erro', 'manual', 'baixado'));
