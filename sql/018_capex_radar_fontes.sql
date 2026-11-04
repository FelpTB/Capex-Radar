-- Radar CapEx — migra as fontes dos esquemas antigos para capex_radar.fontes.
-- Só fontes: projetos e evidências antigos ficam para trás.
-- Sem perda: cada linha original vai em legado, sob a chave do esquema de origem.
-- Idempotente: on conflict do nothing preserva o que já foi editado em capex_radar.

-- Mesma fonte com códigos diferentes nos esquemas antigos.
create table if not exists capex_radar.fonte_equivalencia (
  codigo_antigo text primary key,
  codigo        text not null references capex_radar.fontes (codigo)
);

do $$
begin
  -- 1. public.fonte (MVP): a base mais completa.
  if to_regclass('public.fonte') is not null then
    insert into capex_radar.fontes (
      codigo, nome, papel, hierarquia, categoria, url_base, status, ciclo, descricao,
      config, ultimo_ok_em, ultimo_erro_em, msg_erro, origem, legado, criado_em
    )
    select
      f.codigo,
      f.nome,
      case when f.papel_captura in ('descoberta', 'enriquecimento', 'indice', 'lookup')
           then f.papel_captura else 'descoberta' end,
      f.tipo::text,
      f.categoria,
      f.url_base,
      case
        when not f.ativo                                   then 'desativada'
        when f.estagio = 'aposentada'                      then 'desativada'
        when f.status_acesso in ('bloqueado', 'indisponivel') then 'quebrada'
        when f.estagio = 'sugerida'                        then 'pendente'
        else 'ativa'
      end,
      f.estagio,
      f.conteudo,
      jsonb_strip_nulls(jsonb_build_object(
        'peculiaridade',       f.peculiaridade,
        'frequencia_projetos', f.frequencia_projetos::text,
        'status_acesso',       f.status_acesso::text,
        'participa_scanner',   f.participa_scanner,
        'formato_dado',        f.formato_dado,
        'auth_acesso',         f.auth_acesso,
        'unidade_registro',    f.unidade_registro,
        'esfera_noticia',      f.esfera_noticia
      )),
      case when f.ultimo_erro is null then f.ultimo_acesso_em end,
      case when f.ultimo_erro is not null then f.ultimo_acesso_em end,
      f.ultimo_erro,
      'public.fonte',
      jsonb_build_object('public.fonte', to_jsonb(f)),
      f.created_at
    from public.fonte f
    on conflict (codigo) do nothing;
  end if;

  -- Equivalências conhecidas entre radar/radar2 e o MVP.
  insert into capex_radar.fonte_equivalencia (codigo_antigo, codigo)
  select v.antigo, v.novo
  from (values ('cno', 'SEC-CNO'), ('cetesb_sp', 'SEC-CETESB'), ('cvm_ipe', 'SEC-CVM-IPE')) v(antigo, novo)
  where exists (select 1 from capex_radar.fontes where codigo = v.novo)
  on conflict (codigo_antigo) do nothing;

  -- 2. radar.fontes
  if to_regclass('radar.fontes') is not null then
    -- equivalentes: só anexa a linha original
    update capex_radar.fontes cf
       set legado = cf.legado || jsonb_build_object('radar.fontes', to_jsonb(r))
      from radar.fontes r
      join capex_radar.fonte_equivalencia eq on eq.codigo_antigo = r.id
     where cf.codigo = eq.codigo
       and not cf.legado ? 'radar.fontes';

    insert into capex_radar.fontes (
      codigo, nome, papel, categoria, url_base, status, config,
      ultimo_ok_em, ultimo_erro_em, msg_erro, origem, legado
    )
    select
      r.id, r.nome, 'descoberta', r.tipo, r.url_base, r.status, coalesce(r.config, '{}'::jsonb),
      r.ultimo_ok, r.ultimo_erro, r.msg_erro, 'radar.fontes',
      jsonb_build_object('radar.fontes', to_jsonb(r))
    from radar.fontes r
    where not exists (select 1 from capex_radar.fonte_equivalencia eq where eq.codigo_antigo = r.id)
    on conflict (codigo) do nothing;
  end if;

  -- 3. radar2.fontes: ids coincidem com radar.fontes na maioria.
  if to_regclass('radar2.fontes') is not null then
    update capex_radar.fontes cf
       set legado = cf.legado || jsonb_build_object('radar2.fontes', to_jsonb(r2))
      from radar2.fontes r2
     where cf.codigo = coalesce((select eq.codigo from capex_radar.fonte_equivalencia eq where eq.codigo_antigo = r2.id), r2.id)
       and not cf.legado ? 'radar2.fontes';

    insert into capex_radar.fontes (
      codigo, nome, papel, status, descricao, config, origem, legado
    )
    select
      r2.id, r2.nome,
      case when r2.papel in ('descoberta', 'acessoria') then r2.papel else 'descoberta' end,
      case r2.situacao when 'piloto' then 'ativa' when 'a_validar' then 'pendente' else 'desativada' end,
      r2.observacao,
      coalesce(r2.config, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'orgao', r2.orgao, 'modo', r2.modo, 'cadencia', r2.cadencia, 'auditoria', r2.auditoria)),
      'radar2.fontes',
      jsonb_build_object('radar2.fontes', to_jsonb(r2))
    from radar2.fontes r2
    where not exists (select 1 from capex_radar.fonte_equivalencia eq where eq.codigo_antigo = r2.id)
    on conflict (codigo) do nothing;
  end if;
end $$;

-- Fonte do teste: Google News RSS é a descoberta inicial.
insert into capex_radar.fontes (codigo, nome, papel, hierarquia, categoria, url_base, status, descricao, documentacao)
values (
  'gnews_rss', 'Google News RSS', 'descoberta', 'primaria', 'rss',
  'https://news.google.com/rss/search', 'ativa',
  'Busca de notícias por empresa no teste de monitoramento.',
  'Formato bruto: RSS 2.0 (item: title, link, pubDate, source). Extração: 1) montar a consulta por empresa; 2) GET em /rss/search?q=...&hl=pt-BR&gl=BR&ceid=BR:pt-419; 3) cada item vira uma evidência com data_original = pubDate e veiculo = source.'
)
on conflict (codigo) do update
  set papel = excluded.papel,
      status = 'ativa',
      documentacao = coalesce(capex_radar.fontes.documentacao, excluded.documentacao);

alter table capex_radar.fonte_equivalencia enable row level security;
