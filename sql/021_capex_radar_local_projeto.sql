-- Local do projeto na carteira: UF e município saem sempre da mesma origem.
--
-- Antes, uf e municipio eram coalesce independentes (projeto, filial, matriz).
-- Um projeto com UF lida pela IA e sem município ganhava o município da sede
-- da matriz ("CHAPECO / MS"), e um projeto sem local mostrava a sede como se
-- fosse a obra. Agora:
--   1. o projeto tem UF: vale a UF do projeto; o município é o do projeto ou,
--      se a filial estiver na mesma UF, o da filial;
--   2. sem UF no projeto e com filial: UF e município da filial;
--   3. sem nenhum dos dois: a sede da matriz, marcada em local_origem = 'matriz'.
-- A coluna nova fica no fim para o create or replace aceitar a view.

create or replace view capex_radar.vw_carteira as
select
  p.id,
  p.titulo,
  g.id               as grupo_id,
  g.nome             as grupo,
  g.nicho,
  p.matriz_cnpj,
  m.razao_social     as matriz_razao_social,
  p.filial_cnpj,
  case
    when p.uf is not null  then p.uf
    when fl.cnpj is not null then fl.uf
    else m.uf
  end                as uf,
  case
    when p.uf is not null then coalesce(p.municipio, case when fl.uf = p.uf then fl.municipio end)
    when fl.cnpj is not null then coalesce(p.municipio, fl.municipio)
    else coalesce(p.municipio, m.municipio)
  end                as municipio,
  p.valor_estimado_brl,
  p.flag_validacao,
  p.estagio,
  p.tendencia,
  p.status,
  p.data_anuncio,
  p.data_inicio,
  p.data_fim,
  ev.n_evidencias,
  ev.primeira_evidencia_em,
  ev.ultima_evidencia_em,
  p.criado_em,
  p.atualizado_em,
  case
    when p.uf is not null or p.municipio is not null then 'projeto'
    when fl.cnpj is not null then 'filial'
    else 'matriz'
  end                as local_origem
from capex_radar.projetos p
join capex_radar.grupos g        on g.id = p.grupo_id
join capex_radar.matrizes m      on m.cnpj = p.matriz_cnpj
left join capex_radar.filiais fl on fl.cnpj = p.filial_cnpj
left join lateral (
  select count(*)::int        as n_evidencias,
         min(t.data_original) as primeira_evidencia_em,
         max(t.data_original) as ultima_evidencia_em
  from capex_radar.vw_projeto_timeline t
  where t.projeto_id = p.id
) ev on true;
