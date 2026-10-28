const { esc, badge, selectOptions } = require("./html");
const { SCOPES, scopeApplies, scopeCoverage, sourceScope } = require("./source-scope");
const { sourceGuide } = require("./source-guides");
const { sourceCategory } = require("./source-categories");
const { CAPTURE_DECISIONS, POSSIBLE_SOURCES, label: captureLabel } = require("./capture-catalog");
const { BRAZIL_UFS } = require("./source-lifecycle");
const { readRawSample, sampleSectionHtml } = require("./source-sample");

// Notícia é descoberta de projeto, não enriquecimento; fica no dashboard, sem página própria.
function hasSourcePage(codigo) {
  return Boolean(sourceGuide(codigo)) || !String(codigo || "").toUpperCase().startsWith("NEWS-");
}

function scopeKind(abrangencia) {
  if (abrangencia === "municipal") return "success";
  if (abrangencia === "estadual") return "info";
  return "neutral";
}

function scopeBadge(codigo) {
  const scope = sourceScope(codigo);
  return badge(SCOPES[scope.abrangencia].label, scopeKind(scope.abrangencia));
}

function scopeSection(codigo) {
  const scope = sourceScope(codigo);
  const info = SCOPES[scope.abrangencia];
  return `
    <section>
      <h2>Abrangência</h2>
      <p>${scopeBadge(codigo)} ${esc(info.description)}</p>
      <p><strong>Cobertura.</strong> ${esc(scopeCoverage(scope))}</p>
    </section>`;
}

function possibleSource(codigo) {
  return POSSIBLE_SOURCES.find((item) => item.codigo === codigo) || null;
}

// Página de fonte sem conector: o que o catálogo sabe dela e como consultá-la à mão.
function catalogPageBody(source) {
  const extraction = sourceCategory(source.categoria);
  const candidata = possibleSource(source.codigo);
  const decision = candidata ? CAPTURE_DECISIONS[candidata.decisao] : null;
  const scope = sourceScope(source.codigo);
  const external = source.url_base
    ? `<a class="button button--secondary" href="${esc(source.url_base)}" target="_blank" rel="noopener">Publicação original ↗</a>`
    : "";
  return `
    <section class="page-heading">
      <div>
        <p class="eyebrow">Fonte de consulta manual · ${esc(source.codigo)}</p>
        <h1>${esc(source.nome)}</h1>
        <p>${esc(source.conteudo || candidata?.disponibilidade || "Sem descrição cadastrada.")}</p>
      </div>
      ${external}
    </section>
    <section class="stats">
      <div><strong>${esc(SCOPES[scope.abrangencia].label)}</strong><span>Abrangência</span></div>
      <div><strong>${esc(source.tipo)}</strong><span>Papel no Radar</span></div>
      <div><strong>sem conector</strong><span>Coleta da ficha</span></div>
      <div><strong>${esc(source.status_acesso)}</strong><span>Acesso conferido</span></div>
    </section>
    <article class="source-doc">
      <section>
        <h2>O que a fonte informa</h2>
        <p>${esc(source.conteudo || "Sem descrição cadastrada.")}</p>
        ${candidata ? `<p>${esc(candidata.disponibilidade)}</p>` : ""}
        <p><strong>Unidade do registro.</strong> ${esc(source.unidade_registro || "—")}</p>
      </section>
      ${scopeSection(source.codigo)}
      <section>
        <h2>Como os dados são obtidos</h2>
        <p><strong>Extração.</strong> ${esc(extraction.label)}. ${esc(extraction.description)}</p>
        <p><strong>Formato.</strong> ${esc(captureLabel("formato_dado", source.formato_dado))} · <strong>Acesso.</strong> ${esc(captureLabel("auth_acesso", source.auth_acesso))} · <strong>Papel na captura.</strong> ${esc(captureLabel("papel_captura", source.papel_captura))}</p>
        ${candidata ? `<p><strong>Modo.</strong> ${esc(candidata.modo)}</p>` : ""}
        <p>Esta fonte ainda não tem conector. O enriquecimento da ficha não a consulta; a leitura é feita à mão no endereço da publicação, e o achado entra na ficha como evidência secundária.</p>
      </section>
      ${sampleSectionHtml({ raw: readRawSample(source.codigo), evidence: null, manual: true })}
      <section>
        <h2>Avaliação e limitações</h2>
        ${decision ? `<p>${badge(decision.label, decision.kind)} ${esc(candidata.porque)}</p>` : ""}
        <p>${esc(source.peculiaridade || "Sem observação cadastrada.")}</p>
      </section>
    </article>
    <p class="manual-link"><a href="/fontes/hub">Hub de fontes</a> · <a href="/fontes">Dashboard de fontes</a></p>`;
}

function hubCard(source, project) {
  const scope = sourceScope(source.codigo);
  const guide = sourceGuide(source.codigo);
  const connected = Boolean(guide);
  const resumo = guide?.resumo || source.conteudo || "Sem descrição cadastrada.";
  const aplica = project.uf ? scopeApplies(source.codigo, project) : null;
  return `
    <article class="hub-card${aplica === false ? " hub-card--off" : ""}">
      <div class="hub-card__badges">
        ${connected ? badge("conectada", "success") : badge("consulta manual", "neutral")}
        ${badge(source.tipo, source.tipo === "primaria" ? "info" : "neutral")}
      </div>
      <h3><a href="/fontes/${esc(source.codigo)}">${esc(source.nome)}</a></h3>
      <p class="muted">${esc(source.codigo)}</p>
      <p>${esc(resumo)}</p>
      <p class="hub-card__cobertura"><strong>Cobertura.</strong> ${esc(scopeCoverage(scope))}</p>
    </article>`;
}

function hubBody(sources, filters = {}) {
  const project = { uf: filters.uf || "", municipio: filters.municipio || "" };
  const withPage = sources.filter((source) => hasSourcePage(source.codigo));
  const visible = project.uf
    ? withPage.filter((source) => scopeApplies(source.codigo, project))
    : withPage;
  const sections = Object.entries(SCOPES).map(([key, info]) => {
    const rows = visible
      .filter((source) => sourceScope(source.codigo).abrangencia === key)
      .sort((a, b) => (
        Number(Boolean(sourceGuide(b.codigo))) - Number(Boolean(sourceGuide(a.codigo)))
        || a.nome.localeCompare(b.nome, "pt-BR")
      ));
    const empty = project.uf
      ? `<p class="muted">Nenhuma fonte ${esc(info.label.toLowerCase())} cobre ${esc([project.municipio, project.uf].filter(Boolean).join("/"))}.</p>`
      : `<p class="muted">Nenhuma fonte nesta categoria.</p>`;
    return `
      <section class="hub-group" id="${esc(key)}">
        <div class="hub-group__head">
          <h2>${esc(info.label)} ${badge(`${rows.length} fonte(s)`, scopeKind(key))}</h2>
          <p>${esc(info.description)}</p>
        </div>
        ${rows.length ? `<div class="hub-grid">${rows.map((source) => hubCard(source, project)).join("")}</div>` : empty}
      </section>`;
  }).join("");
  const conectadas = visible.filter((source) => sourceGuide(source.codigo)).length;
  const alvo = project.uf
    ? `Fontes que podem trazer informação de um projeto em ${[project.municipio, project.uf].filter(Boolean).join("/")}.`
    : "Todas as fontes de dados e documentos com página própria, separadas por abrangência. Informe a UF e o município de um projeto para ver só as que se aplicam.";
  return `
    <section class="page-heading">
      <div>
        <p class="eyebrow">Hub de fontes</p>
        <h1>Fontes por abrangência</h1>
        <p>${esc(alvo)}</p>
      </div>
    </section>
    <form class="source-filters hub-filters" method="get" action="/fontes/hub">
      <label>UF do projeto
        <select name="uf">${selectOptions([["", "Todas"], ...BRAZIL_UFS.map((uf) => [uf, uf])], project.uf)}</select>
      </label>
      <label>Município do projeto
        <input name="municipio" value="${esc(project.municipio)}" placeholder="Ex.: Ouro Preto">
      </label>
      <div class="source-filters__actions">
        <button class="button" type="submit">Filtrar</button>
        <a class="button button--secondary" href="/fontes/hub">Limpar</a>
      </div>
    </form>
    <section class="stats">
      <div><strong>${visible.length}</strong><span>Fontes com página</span></div>
      <div><strong>${conectadas}</strong><span>Conectadas à coleta</span></div>
      <div><strong>${visible.length - conectadas}</strong><span>Consulta manual</span></div>
      <div><strong>${sources.length - withPage.length}</strong><span>Portais de notícia, só no dashboard</span></div>
    </section>
    <nav class="hub-jump">${Object.entries(SCOPES).map(([key, info]) => `<a href="#${esc(key)}">${esc(info.label)}</a>`).join("")}</nav>
    ${sections}
    <p class="manual-link"><a href="/fontes">Dashboard de fontes</a></p>`;
}

module.exports = {
  catalogPageBody,
  hasSourcePage,
  hubBody,
  scopeBadge,
  scopeSection,
};
