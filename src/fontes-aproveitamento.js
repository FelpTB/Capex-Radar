// Hub de fontes › Aproveitamento: gráficos e números de quanto cada fonte
// chega aos projetos. Primárias: o funil das notícias (Google News). Secundárias:
// os registros oficiais analisados para cada projeto (DOE, CNO, licenças...).
// Os gráficos são HTML e CSS puros, com dica ao passar o mouse ou focar.
const { pool } = require("./db");
const painel = require("./capex-painel-db");
const { esc, layout } = require("./html");

const MESES = 12;
const NOME_NOTICIAS = "Notícias (Google News)";

// Rótulo curto para a barra; o nome completo fica na dica.
function nomeCurto(nome) {
  return String(nome || "")
    .replace(/^Diário Oficial da União/i, "DOU")
    .replace(/^Diário Oficial do Estado (de |do |da )?/i, "DOE ")
    .replace(/^Diário Oficial (de |do |da )?/i, "DO ");
}

const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");
const pct = (a, b) => (b ? `${(100 * a / b).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—");

/** Os dados da página: o funil e as secundárias da aba Fontes, mais a série mensal e os marcos por fonte. */
async function dadosAproveitamento() {
  const emProjeto = `exists (select 1 from capex_radar.evidencia_projeto ep join capex_radar.projetos p on p.id = ep.projeto_id
                              where ep.evidencia_id = e.id and ep.situacao = 'aceito' and p.status <> 'descartado')`;
  const [base, mensal, marcos] = await Promise.all([
    painel.eficienciaFontes(),
    pool.query(
      `select to_char(date_trunc('month', e.data_original), 'YYYY-MM') as mes,
              count(*)::int as captadas,
              count(*) filter (where ${emProjeto})::int as em_projeto
         from capex_radar.evidencias e
        where e.fonte_codigo = 'gnews_rss'
          and e.data_original >= date_trunc('month', now()) - make_interval(months => $1)
        group by 1 order by 1`,
      [MESES - 1],
    ),
    // Cada evidência citada num marco da linha do tempo, contada pela fonte dela.
    pool.query(
      `select coalesce(e.fonte_codigo, 'gnews_rss') as fonte, f.nome,
              count(*)::int as citacoes, count(distinct p.id)::int as projetos
         from capex_radar.projetos p
         cross join lateral jsonb_array_elements(
           case when jsonb_typeof(p.linha_tempo->'marcos') = 'array' then p.linha_tempo->'marcos' else '[]'::jsonb end) m
         cross join lateral jsonb_array_elements_text(
           case when jsonb_typeof(m->'evidencias') = 'array' then m->'evidencias' else '[]'::jsonb end) ev
         join capex_radar.evidencias e on e.id::text = ev
         left join capex_radar.fontes f on f.codigo = e.fonte_codigo
        where p.status <> 'descartado'
        group by 1, 2 order by citacoes desc`,
    ),
  ]);
  // Os últimos 12 meses, com zero nos meses sem notícia.
  const porMes = new Map(mensal.rows.map((r) => [r.mes, r]));
  const meses = [];
  const hoje = new Date();
  for (let i = MESES - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1));
    const mes = d.toISOString().slice(0, 7);
    meses.push(porMes.get(mes) || { mes, captadas: 0, em_projeto: 0 });
  }
  return { ...base, meses, marcos: marcos.rows };
}

// ---------------------------------------------------------------------------
// Peças dos gráficos
// ---------------------------------------------------------------------------

// Barra horizontal de uma série: rótulo, barra proporcional ao maior valor e o número.
function barras(linhas, { max = Math.max(1, ...linhas.map((l) => l.valor)) } = {}) {
  return `<div class="dv-bars">${linhas.map((l) => `
    <div class="dv-bar" tabindex="0" data-tip="${esc(l.dica)}">
      <span class="dv-bar__rotulo">${esc(nomeCurto(l.rotulo))}</span>
      <span class="dv-bar__trilho"><span class="dv-bar__valor" style="width:${Math.max(l.valor ? 0.6 : 0, 100 * l.valor / max).toFixed(2)}%"></span></span>
      <span class="dv-bar__numero">${esc(l.numero)}</span>
    </div>`).join("")}</div>`;
}

function legenda(itens) {
  return `<ul class="dv-legend">${itens.map(([classe, texto]) => `<li><span class="dv-swatch ${classe}"></span>${esc(texto)}</li>`).join("")}</ul>`;
}

const NOME_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (mes) => `${NOME_MES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;

// Colunas por mês de uma medida, com escala própria e o número em cima.
function colunas(meses, campo, classe, titulo) {
  const max = Math.max(1, ...meses.map((m) => m[campo]));
  return `<h3 class="dv-mini-title">${esc(titulo)}</h3>
  <div class="dv-cols" role="img" aria-label="${esc(titulo)} por mês">
    ${meses.map((m, i) => `<div class="dv-col" tabindex="0" data-tip="${esc(`${rotuloMes(m.mes)}: ${fmt(m.captadas)} captadas, ${fmt(m.em_projeto)} em projeto (${pct(m.em_projeto, m.captadas)})`)}">
        <span class="dv-col__numero">${m[campo] ? fmt(m[campo]) : ""}</span>
        <span class="dv-col__pilha" style="height:${(85 * m[campo] / max).toFixed(2)}%">${m[campo] ? `<span class="dv-col__seg ${classe}" style="flex:1"></span>` : ""}</span>
        <span class="dv-col__rotulo">${esc(i === 0 || m.mes.endsWith("-01") ? rotuloMes(m.mes) : NOME_MES[Number(m.mes.slice(5, 7)) - 1])}</span>
      </div>`).join("")}
  </div>`;
}

// Dois gráficos pequenos, cada um com a sua escala: as notícias em projeto são
// poucas perto das captadas e sumiriam numa coluna empilhada.
function colunasMensais(meses) {
  return `${colunas(meses, "captadas", "dv-fill--resto", "Captadas")}
  ${colunas(meses, "em_projeto", "dv-fill--sim", "Em projeto")}
  <p class="dv-axis-note muted">Cada gráfico tem a sua escala. Passe o mouse num mês para ver o aproveitamento.</p>`;
}

// Barra 100% de cada fonte secundária, pelo destino da classe.
const DESTINOS = [
  ["linha", "dv-fill--linha", "Na linha do tempo (certeira, provável)"],
  ["possibilidade", "dv-fill--possivel", "Possibilidade (incerta, improvável)"],
  ["descarte", "dv-fill--descarte", "Descartado (muito improvável)"],
  ["sem", "dv-fill--sem", "Sem julgamento"],
];

function barrasSecundarias(fontes) {
  return `<div class="dv-stack-list">${fontes.map((f) => {
    const partes = { linha: f.certeira + f.provavel, possibilidade: f.incerta + f.improvavel, descarte: f.muito_improvavel, sem: f.nao_avaliada };
    const avaliados = f.total - f.nao_avaliada;
    const nome = f.nome || f.fonte_codigo;
    return `<div class="dv-stack-row">
      <span class="dv-bar__rotulo" title="${esc(nome)} (${esc(f.fonte_codigo)})">${esc(nomeCurto(nome))}</span>
      <span class="dv-stack">${DESTINOS.filter(([k]) => partes[k]).map(([k, classe, texto]) => `<span class="dv-stack__seg ${classe}" style="flex:${partes[k]}" tabindex="0" data-tip="${esc(`${nome} · ${texto}: ${fmt(partes[k])} de ${fmt(f.total)} (${pct(partes[k], f.total)})`)}"></span>`).join("")}</span>
      <span class="dv-bar__numero"><strong>${pct(partes.linha, avaliados)}</strong> <span class="muted">de ${fmt(f.total)}</span></span>
    </div>`;
  }).join("")}</div>`;
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

function subnavHub(ativo) {
  const item = (chave, href, texto) => `<a class="${chave === ativo ? "active" : ""}" href="${href}">${texto}</a>`;
  return `<nav class="hub-tabs">${item("fontes", "/fontes/hub", "Fontes por abrangência")}${item("aproveitamento", "/fontes/hub/aproveitamento", "Aproveitamento das fontes")}${item("diagnostico", "/fontes/hub/diagnostico", "Por que não aproveita")}</nav>`;
}

function paginaAproveitamento({ funil = {}, veiculos = [], secundarias = [], meses = [], marcos = [] }) {
  const captadas = funil.captadas || 0;
  const tot = secundarias.reduce((a, r) => {
    for (const k of ["total", "certeira", "provavel", "incerta", "improvavel", "muito_improvavel", "nao_avaliada", "revisados"]) a[k] = (a[k] || 0) + (r[k] || 0);
    return a;
  }, {});
  const ligadosSec = (tot.certeira || 0) + (tot.provavel || 0);
  const avaliadosSec = (tot.total || 0) - (tot.nao_avaliada || 0);
  const citacoes = marcos.reduce((a, m) => a + m.citacoes, 0);
  const citNoticias = marcos.filter((m) => m.fonte === "gnews_rss").reduce((a, m) => a + m.citacoes, 0);

  const etapas = [
    ["Captadas", captadas, "Tudo o que a busca trouxe do Google News."],
    ["Filtro 1 (é CapEx?)", funil.filtro1, "A IA leu a manchete e disse que é investimento em obra."],
    ["Filtro 2 (manter)", funil.filtro2, "Segunda leitura: notícia sobre um projeto concreto."],
    ["Enriquecidas", funil.enriquecidas, "A matéria completa foi lida e trouxe dados do projeto."],
    ["Filtro 3 (aprovação)", funil.filtro3, "Veredito final: segue para a aprovação."],
    ["Em projeto", funil.em_projeto, "Ligadas a um projeto da carteira (vínculo aceito)."],
  ];
  const graficoFunil = barras(etapas.map(([rotulo, n, explica]) => ({
    rotulo, valor: n || 0, numero: `${fmt(n)} · ${pct(n || 0, captadas)}`, dica: `${rotulo}: ${fmt(n)} notícias, ${pct(n || 0, captadas)} das captadas. ${explica}`,
  })), { max: captadas || 1 });

  const topVeiculos = veiculos.filter((v) => v.em_projeto).slice(0, 12);
  const graficoVeiculos = barras(topVeiculos.map((v) => ({
    rotulo: v.veiculo, valor: v.em_projeto, numero: `${fmt(v.em_projeto)} · ${pct(v.em_projeto, v.captadas)}`,
    dica: `${v.veiculo}: ${fmt(v.em_projeto)} em projeto de ${fmt(v.captadas)} captadas (${pct(v.em_projeto, v.captadas)}); ${fmt(v.filtro1)} passaram no Filtro 1.`,
  })));

  const secOrdenadas = [...secundarias].sort((a, b) => (b.certeira + b.provavel) - (a.certeira + a.provavel) || b.total - a.total);

  const graficoMarcos = barras(marcos.map((m) => {
    const nome = m.fonte === "gnews_rss" ? NOME_NOTICIAS : m.nome || m.fonte;
    return { rotulo: nome, valor: m.citacoes, numero: `${fmt(m.citacoes)} · ${pct(m.citacoes, citacoes)}`, dica: `${nome}: citada ${fmt(m.citacoes)} vez(es) em marcos de ${fmt(m.projetos)} projeto(s), ${pct(m.citacoes, citacoes)} de todas as citações.` };
  }));

  const linhasSec = secOrdenadas.map((r) => {
    const avaliados = r.total - r.nao_avaliada;
    return `<tr><td><strong>${esc(r.nome || r.fonte_codigo)}</strong><br><span class="muted">${esc(r.fonte_codigo)}</span></td>
      <td>${fmt(r.total)}</td><td>${fmt(r.certeira)}</td><td>${fmt(r.provavel)}</td><td>${fmt(r.incerta)}</td><td>${fmt(r.improvavel)}</td><td>${fmt(r.muito_improvavel)}</td><td>${fmt(r.nao_avaliada)}</td>
      <td><strong>${pct(r.certeira + r.provavel, avaliados)}</strong></td><td>${fmt(r.projetos_ligados)}/${fmt(r.projetos)}</td></tr>`;
  }).join("");
  const linhasMes = meses.map((m) => `<tr><td>${esc(rotuloMes(m.mes))}</td><td>${fmt(m.captadas)}</td><td>${fmt(m.em_projeto)}</td><td>${pct(m.em_projeto, m.captadas)}</td></tr>`).join("");
  const linhasVeic = veiculos.map((v) => `<tr><td>${esc(v.veiculo)}</td><td>${fmt(v.captadas)}</td><td>${fmt(v.filtro1)}</td><td>${fmt(v.em_projeto)}</td><td>${pct(v.em_projeto, v.captadas)}</td></tr>`).join("");

  return layout({
    title: "Aproveitamento das fontes",
    active: "hub",
    scripts: `<script src="/graficos.js" defer></script>`,
    body: `
      <section class="page-heading">
        <div>
          <p class="eyebrow">Hub de fontes</p>
          <h1>Aproveitamento das fontes</h1>
          <p>Quanto do que cada fonte traz chega aos projetos. Primárias: as notícias do Google News, etapa por etapa do funil. Secundárias: os registros oficiais analisados para cada projeto (DOE, CNO, licenças, financiamento), pela classe de correlação.</p>
        </div>
      </section>
      ${subnavHub("aproveitamento")}
      <section class="stats">
        <div><strong>${fmt(captadas)}</strong><span>Notícias captadas</span></div>
        <div><strong>${pct(funil.em_projeto || 0, captadas)}</strong><span>Das notícias chegam a um projeto (${fmt(funil.em_projeto)})</span></div>
        <div><strong>${fmt(tot.total)}</strong><span>Registros oficiais analisados</span></div>
        <div><strong>${pct(ligadosSec, avaliadosSec)}</strong><span>Dos registros avaliados vão para a linha do tempo (${fmt(ligadosSec)})</span></div>
        <div><strong>${pct(citacoes - citNoticias, citacoes)}</strong><span>Das citações nos marcos vêm de fontes oficiais</span></div>
      </section>

      <div class="dv-grid">
        <section class="dv-card">
          <h2>Funil das notícias</h2>
          <p class="muted">Notícias em cada etapa, em proporção às captadas. As etapas não são encaixadas: notícias aprovadas antes do fluxo atual não passaram por todos os filtros.</p>
          ${graficoFunil}
        </section>
        <section class="dv-card">
          <h2>Notícias por mês</h2>
          <p class="muted">Últimos ${MESES} meses, pela data da publicação.</p>
          ${colunasMensais(meses)}
        </section>
        <section class="dv-card">
          <h2>Veículos que mais rendem projetos</h2>
          <p class="muted">Notícias ligadas a projetos, por veículo; ao lado, o aproveitamento sobre as captadas do veículo.</p>
          ${topVeiculos.length ? graficoVeiculos : '<p class="muted">Nenhum veículo com notícia em projeto ainda.</p>'}
        </section>
        <section class="dv-card">
          <h2>Quem alimenta a linha do tempo</h2>
          <p class="muted">Evidências citadas nos marcos das linhas do tempo da carteira, pela fonte. ${fmt(citacoes)} citações no total.</p>
          ${marcos.length ? graficoMarcos : '<p class="muted">Nenhuma linha do tempo montada ainda.</p>'}
        </section>
        <section class="dv-card dv-card--wide">
          <h2>Fontes secundárias por destino</h2>
          <p class="muted">Cada barra é o total de registros da fonte, dividido pelo destino da classe. À direita, o aproveitamento: certeira e provável sobre os avaliados.</p>
          ${legenda(DESTINOS.map(([, classe, texto]) => [classe, texto]))}
          ${secOrdenadas.length ? barrasSecundarias(secOrdenadas) : '<p class="muted">Nenhum registro analisado ainda.</p>'}
        </section>
      </div>

      <details class="raw-records">
        <summary><strong>Ver os números em tabela</strong></summary>
        <h3>Fontes secundárias</h3>
        <div class="table-scroll"><table class="table-compact">
          <thead><tr><th>Fonte</th><th>Registros</th><th>Certeira</th><th>Provável</th><th>Incerta</th><th>Improvável</th><th>Muito improv.</th><th>Sem julgamento</th><th>Aproveitamento</th><th>Projetos ligados</th></tr></thead>
          <tbody>${linhasSec}</tbody>
        </table></div>
        <h3>Notícias por mês</h3>
        <div class="table-scroll"><table class="table-compact">
          <thead><tr><th>Mês</th><th>Captadas</th><th>Em projeto</th><th>Aproveitamento</th></tr></thead>
          <tbody>${linhasMes}</tbody>
        </table></div>
        <h3>Veículos (25 com mais notícias em projetos)</h3>
        <div class="table-scroll"><table class="table-compact">
          <thead><tr><th>Veículo</th><th>Captadas</th><th>Filtro 1</th><th>Em projeto</th><th>Aproveitamento</th></tr></thead>
          <tbody>${linhasVeic}</tbody>
        </table></div>
      </details>
      <p class="manual-link"><a href="/fontes/hub">Hub de fontes</a> · <a href="/monitoramento/fontes">Eficiência no monitoramento</a></p>`,
  });
}

module.exports = { dadosAproveitamento, paginaAproveitamento, subnavHub };
