-- Radar CapEx — classes de correlação, revisão humana, obras (CNO) e município.
-- Idempotente: o deploy reaplica todos os arquivos.
--
-- 1. Cada registro analisado ganha a probabilidade de correlação com o
--    projeto (0 a 100) e a classe:
--      certeira           75-100  → evidência na linha do tempo
--      provavel           60-74   → evidência na linha do tempo
--      incerta            50-59   → possibilidade no perfil
--      improvavel         30-49   → possibilidade no perfil
--      muito_improvavel    0-29   → descartado (dados brutos, fim da ficha)
--    A classe é dada pelo especialista da fonte (src/capex-especialistas.js)
--    e pode ser trocada por um humano (revisado_por / revisado_em).
--    correlacao continua, derivada da classe, para o código antigo.
-- 2. Obras do projeto: os registros do CNO com classe provável ou certeira
--    (vw_obras_projeto), cada uma com a própria situação (status da obra).
-- 3. Município do projeto validado (src/municipios.js); o que não existe
--    fica em municipio_pendencia para revisão.

alter table capex_radar.registros_analisados add column if not exists probabilidade smallint;
alter table capex_radar.registros_analisados add column if not exists classe text;
alter table capex_radar.registros_analisados add column if not exists revisado_por text;
alter table capex_radar.registros_analisados add column if not exists revisado_em timestamptz;

do $$ begin
  alter table capex_radar.registros_analisados add constraint registros_analisados_classe_chk
    check (classe is null or classe in ('certeira', 'provavel', 'incerta', 'improvavel', 'muito_improvavel'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table capex_radar.registros_analisados add constraint registros_analisados_probabilidade_chk
    check (probabilidade is null or probabilidade between 0 and 100);
exception when duplicate_object then null; end $$;

-- Classe a partir da probabilidade (a mesma regra de src/capex-classes.js).
create or replace function capex_radar.classe_da_probabilidade(p integer) returns text
language sql immutable as $$
  select case
    when p is null then null
    when p >= 75 then 'certeira'
    when p >= 60 then 'provavel'
    when p >= 50 then 'incerta'
    when p >= 30 then 'improvavel'
    else 'muito_improvavel'
  end
$$;

-- Registros já julgados (antes das classes): direta = certeira, incerta = incerta,
-- outro projeto / outro estado = muito improvável.
update capex_radar.registros_analisados
   set probabilidade = case correlacao when 'direta' then 85 when 'incerta' then 55 when 'outro_projeto' then 10 when 'outro_estado' then 0 end,
       classe = case correlacao when 'direta' then 'certeira' when 'incerta' then 'incerta' when 'outro_projeto' then 'muito_improvavel' when 'outro_estado' then 'muito_improvavel' end
 where classe is null and correlacao in ('direta', 'incerta', 'outro_projeto', 'outro_estado');

create index if not exists registros_analisados_classe_idx on capex_radar.registros_analisados (projeto_id, classe);

-- Revisão humana fica no log (só mudança de classe, para não encher o log na coleta).
drop trigger if exists tg_registros_analisados_log on capex_radar.registros_analisados;
create trigger tg_registros_analisados_log after update on capex_radar.registros_analisados
  for each row when (old.classe is distinct from new.classe)
  execute function capex_radar.tg_log_acao();

-- Obras do projeto: matrículas do CNO ligadas ao projeto (provável ou certeira).
create or replace view capex_radar.vw_obras_projeto as
select r.projeto_id,
       r.registro->>'cno' as cno,
       coalesce(nullif(r.registro->>'nome', ''), r.registro->>'empresa') as nome,
       r.registro->>'empresa' as responsavel,
       r.registro->>'ni' as responsavel_cnpj,
       r.registro->>'qualificacao' as qualificacao,
       r.registro->>'municipio' as municipio,
       r.registro->>'uf' as uf,
       nullif(r.registro->>'area', '')::numeric as area,
       r.registro->>'inicio' as inicio,
       r.registro->>'situacao' as situacao,
       case r.registro->>'situacao'
         when '01' then 'nula' when '02' then 'ativa' when '03' then 'suspensa'
         when '14' then 'paralisada' when '15' then 'encerrada' end as situacao_descricao,
       r.registro->>'data_situacao' as data_situacao,
       r.registro->>'origem_cno' as origem,
       r.probabilidade,
       r.classe,
       r.evidencia_id
  from capex_radar.registros_analisados r
 where r.fonte_codigo = 'SEC-CNO' and r.classe in ('certeira', 'provavel');

alter table capex_radar.projetos add column if not exists municipio_pendencia jsonb;
comment on column capex_radar.projetos.municipio_pendencia is
  'Município que não existe na UF (src/municipios.js): motivo e sugestões, até a revisão.';
