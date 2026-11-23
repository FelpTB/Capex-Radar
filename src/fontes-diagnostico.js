// Hub de fontes › Por que não aproveita: para cada fonte secundária, onde se
// perdem os registros (outra UF, diário sem o município, fora do período,
// julgados sem ligação...) e a explicação da análise feita pelo Claude Code
// (docs/diagnostico-fontes.json, gerada com scripts/capex-diagnostico-fontes.js).
const fs = require("node:fs");
const path = require("node:path");
const { pool } = require("./db");
const { esc, layout } = require("./html");

const ARQUIVO_EXPLICACOES = path.join(__dirname, "..", "docs", "diagnostico-fontes.json");

// Ordem = ordem das barras. aproveitado e possibilidade são o que a fonte rende.
const CATEGORIAS = {
  aproveitado: { rotulo: "Na linha do tempo", classe: "dv-fill--linha", explica: "Classe certeira ou provável: virou evidência do projeto." },
  possibilidade: { rotulo: "Possibilidade", classe: "dv-fill--possivel", explica: "Classe incerta ou improvável: fica no perfil para revisão." },
  outra_uf: { rotulo: "Outra UF", classe: "dv-fill--uf", explica: "A busca é pelo CNPJ ou nome da empresa e traz registros do país inteiro; o de outro estado não é do projeto." },
  sem_municipio: { rotulo: "Sem o município", classe: "dv-fill--municipio", explica: "Diário ou registro que não cita o município de nenhum projeto da empresa (pré-triagem, sem IA)." },
  fora_periodo: { rotulo: "Fora do período", classe: "dv-fill--periodo", explica: "Registro muito anterior ao anúncio do projeto (outra obra, já concluída)." },
  sem_ligacao: { rotulo: "Sem ligação", classe: "dv-fill--ligacao", explica: "Lido no julgamento por empresa e atribuído a nenhum projeto (ou a outro projeto da empresa)." },
  outro_ato: { rotulo: "Ato sem obra / outra unidade", classe: "dv-fill--descarte", explica: "Julgado muito improvável: ato societário, capital de giro, rotina, outra unidade." },
  nao_avaliado: { rotulo: "Sem julgamento", classe: "dv-fill--sem", explica: "Coletado e ainda não julgado." },
};

/** Categoria da perda (ou do aproveitamento) de um registro analisado. */
function categoriaDaPerda({ classe, correlacao, motivo }) {
  const m = String(motivo || "");
  if (classe === "certeira" || classe === "provavel") return "aproveitado";
  if (classe === "incerta" || classe === "improvavel") return "possibilidade";
  if (correlacao === "outro_estado" || /^UF do registro diferente/i.test(m)) return "outra_uf";
  if (/sem o munic[íi]pio|n[ãa]o cita o munic[íi]pio/i.test(m)) return "sem_municipio";
  if (/mais de \d+ anos antes|muito anterior|cronologia|anterior ao an[úu]ncio/i.test(m)) return "fora_periodo";
  if (/^Lido no julgamento por empresa: sem liga/i.test(m)) return "sem_ligacao";
  if (!classe && correlacao === "nao_avaliada") return "nao_avaliado";
  return "outro_ato";
}

function lerExplicacoes(arquivo = ARQUIVO_EXPLICACOES) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch {
    return { em: null, fontes: {} };
  }
}

/**
 * Por fonte: quantos projetos a consultaram (resumo das secundárias), quantos
 * registros vieram e a contagem por categoria; mais a explicação gravada.
 */
async function dadosDiagnostico(db = pool) {
  const [registros, consultas, nomes] = await Promise.all([
    db.query(
      `select r.fonte_codigo, r.classe, r.correlacao, left(coalesce(r.motivo, ''), 120) as motivo, count(*)::int as n,
              count(distinct r.projeto_id)::int as projetos
         from capex_radar.registros_analisados r
         join capex_radar.projetos p on p.id = r.projeto_id and p.status <> 'descartado'
        group by 1, 2, 3, 4`,
    ),
    db.query(
      `select f->>'codigo' as fonte_codigo, count(distinct p.id)::int as consultas
         from capex_radar.projetos p
         cross join lateral jsonb_array_elements(
           case when jsonb_typeof(p.secundarias->'fontes') = 'array' then p.secundarias->'fontes' else '[]'::jsonb end) f
        where p.status <> 'descartado'
        group by 1`,
    ),
    db.query("select codigo, nome from capex_radar.fontes"),
  ]);
  const nome = new Map(nomes.rows.map((r) => [r.codigo, r.nome]));
  const porFonte = new Map();
  const fonte = (codigo) => {
    if (!porFonte.has(codigo)) {
      porFonte.set(codigo, { fonte_codigo: codigo, nome: nome.get(codigo) || null, consultas: 0, total: 0, categorias: Object.fromEntries(Object.keys(CATEGORIAS).map((k) => [k, 0])) });
    }
    return porFonte.get(codigo);
  };
  for (const r of registros.rows) {
    const f = fonte(r.fonte_codigo);
    f.total += r.n;
    f.categorias[categoriaDaPerda(r)] += r.n;
  }
  for (const c of consultas.rows) fonte(c.fonte_codigo).consultas = c.consultas;
  const explicacoes = lerExplicacoes();
  const fontes = [...porFonte.values()]
    .map((f) => ({ ...f, explicacao: explicacoes.fontes?.[f.fonte_codigo] || null }))
    .sort((a, b) => b.total - a.total || b.consultas - a.consultas);
  return { fontes, explicacoes_em: explicacoes.em || null, resumo_geral: explicacoes.resumo || null };
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");
const pct = (a, b) => (b ? `${(100 * a / b).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—");

function barra(f) {
  return `<span class="dv-stack">${Object.entries(CATEGORIAS).filter(([k]) => f.categorias[k]).map(([k, c]) =>
    `<span class="dv-stack__seg ${c.classe}" style="flex:${f.categorias[k]}" tabindex="0" data-tip="${esc(`${f.nome || f.fonte_codigo} · ${c.rotulo}: ${fmt(f.categorias[k])} de ${fmt(f.total)} (${pct(f.categorias[k], f.total)}). ${c.explica}`)}"></span>`).join("")}</span>`;
}

// A maior perda da fonte (fora o que ela rende), para o resumo da linha.
function maiorPerda(f) {
  const perdas = Object.entries(f.categorias).filter(([k, n]) => n && k !== "aproveitado" && k !== "possibilidade");
  if (!perdas.length) return null;
  const [k, n] = perdas.sort((a, b) => b[1] - a[1])[0];
  return `${CATEGORIAS[k].rotulo}: ${pct(n, f.total)}`;
}

function cartaoFonte(f) {
  const e = f.explicacao;
  const rende = f.categorias.aproveitado;
  return `<article class="diag-fonte">
    <header>
      <h3>${esc(f.nome || f.fonte_codigo)} <span class="muted">${esc(f.fonte_codigo)}</span></h3>
      <p class="muted">${f.consultas ? `consultada em ${fmt(f.consultas)} projeto(s) · ` : ""}${fmt(f.total)} registro(s) · <strong>${fmt(rende)}</strong> na linha do tempo (${pct(rende, f.total)})${maiorPerda(f) ? ` · maior perda: ${esc(maiorPerda(f))}` : ""}</p>
    </header>
    ${f.total ? barra(f) : ""}
    ${e ? `<p>${esc(e.explicacao)}</p>${e.recomendacao ? `<p class="diag-fonte__acao"><strong>O que fazer:</strong> ${esc(e.recomendacao)}</p>` : ""}` : '<p class="muted">Sem análise ainda.</p>'}
  </article>`;
}

function paginaDiagnostico({ fontes = [], explicacoes_em = null, resumo_geral = null }) {
  const { subnavHub } = require("./fontes-aproveitamento");
  const comRegistros = fontes.filter((f) => f.total);
  const semRetorno = fontes.filter((f) => !f.total && f.consultas);
  const legenda = `<ul class="dv-legend">${Object.values(CATEGORIAS).map((c) => `<li title="${esc(c.explica)}"><span class="dv-swatch ${c.classe}"></span>${esc(c.rotulo)}</li>`).join("")}</ul>`;
  return layout({
    title: "Por que as fontes não aproveitam",
    active: "hub",
    scripts: `<script src="/graficos.js" defer></script>`,
    body: `
      <section class="page-heading">
        <div>
          <p class="eyebrow">Hub de fontes</p>
          <h1>Por que as fontes não aproveitam</h1>
          <p>Onde se perdem os registros de cada fonte secundária e por quê. As barras contam os registros analisados nos projetos da carteira; o texto é a análise de uma amostra feita pelo Claude Code${explicacoes_em ? `, em ${esc(String(explicacoes_em).slice(0, 10).split("-").reverse().join("/"))}` : ""}.</p>
        </div>
      </section>
      ${subnavHub("diagnostico")}
      ${resumo_geral ? `<section class="dv-card dv-card--wide"><h2>Resumo</h2>${(Array.isArray(resumo_geral) ? resumo_geral : [resumo_geral]).map((p) => `<p>${esc(p)}</p>`).join("")}</section>` : ""}
      <section class="dv-card dv-card--wide">
        <h2>Fontes com registros</h2>
        ${legenda}
        <div class="diag-lista">${comRegistros.map(cartaoFonte).join("") || '<p class="muted">Nenhum registro analisado ainda.</p>'}</div>
      </section>
      ${semRetorno.length ? `<section class="dv-card dv-card--wide">
        <h2>Consultadas sem nenhum retorno</h2>
        <p class="muted">A busca rodou para os projetos e não trouxe registro.</p>
        <div class="diag-lista">${semRetorno.map(cartaoFonte).join("")}</div>
      </section>` : ""}`,
  });
}

module.exports = { CATEGORIAS, categoriaDaPerda, lerExplicacoes, dadosDiagnostico, paginaDiagnostico };
