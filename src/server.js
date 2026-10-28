const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const { z } = require("zod");
const { getConfig } = require("./config");
const db = require("./db");
const { extractProjects } = require("./ai");
const { enrichProject, updateProjectFromEvidence } = require("./enrichment/run");
const { collectableSources } = require("./enrichment/viability");
const { sourceGuide } = require("./source-guides");
const { REGRA_CORRELACAO, sourceExtraction } = require("./source-extraction");
const { scanPrimarySources } = require("./scanner");
const { startScheduler } = require("./scheduler");
const { NEWS_QUERIES, googleNewsUrl } = require("./news-queries");
const { probeAllSources, MANUAL_REASON, MANUAL_BY_CODE } = require("./access-probe");
const { esc, money, date, badge, selectOptions, statusKind, layout } = require("./html");
const { fieldSpecRow } = require("./field-detail-html");
const { formatDay } = require("./status-date");
const { SOURCE_CATEGORIES, sourceCategory } = require("./source-categories");
const { filterAndSortSources } = require("./source-filters");
const { SCOPES, sourceScope } = require("./source-scope");
const { catalogPageBody, hasSourcePage, hubBody, scopeBadge, scopeSection } = require("./source-hub-html");
const { BRAZIL_UFS } = require("./source-lifecycle");
const { readRawSample, sampleSectionHtml } = require("./source-sample");
const {
  CAPTURE_DECISIONS,
  DASHBOARD_PROFILES,
  POSSIBLE_GROUPS,
  POSSIBLE_SOURCES,
  label: captureLabel,
} = require("./capture-catalog");

const config = getConfig();
const app = express();

if (config.isProduction || config.onRailway) {
  app.set("trust proxy", 1);
}

function proofLine(row) {
  if (row && typeof row === "object" && row.texto) {
    const title = [row.assunto, row.tipo, row.especie, row.tipo_apresentacao, row.data_referencia].filter(Boolean).join(" · ");
    const body = esc(row.texto).replace(/\n/g, "<br>");
    return `<li><strong>${esc(title || "Documento")}</strong><br>${body}</li>`;
  }
  if (row && typeof row === "object" && row.resumo) {
    const title = [row.titulo, row.orgao, row.data, row.secao ? `Seção ${String(row.secao).replace(/^DO/, "")}` : null].filter(Boolean).join(" · ");
    const link = row.url ? ` <a href="${esc(row.url)}" target="_blank" rel="noopener">Abrir o ato ↗</a>` : "";
    return `<li><strong>${esc(title || "Ato")}</strong><br>${esc(row.resumo)}${link}</li>`;
  }
  return `<li><code>${esc(JSON.stringify(row))}</code></li>`;
}

function stageCell(value) {
  if (value === "fixa") return badge("fixa", "success");
  if (value === "prova") return badge("prova", "info");
  if (value === "sugerida") return badge("sugerida", "neutral");
  if (value === "aposentada") return badge("aposentada", "warning");
  return `<span class="muted">—</span>`;
}

function sourceTitle(source) {
  const name = esc(source.nome);
  if (!hasSourcePage(source.codigo)) return `<strong>${name}</strong>`;
  return `<strong><a href="/fontes/${esc(source.codigo)}">${name}</a></strong>`;
}

function connectedSourceCodes() {
  return new Set(collectableSources().map((source) => source.codigo));
}

function dashboardAccess(source, connectedCodes) {
  if (connectedCodes.has(source.codigo)) return "ok";
  if (source.status_acesso === "ok") return "nao_conectada";
  return source.status_acesso;
}

function accessBadge(status) {
  if (status === "ok") return badge("ok", "success");
  if (status === "nao_conectada") return badge("não conectada", "neutral");
  return badge(status, statusKind(status));
}

function sourceLinks(source) {
  const page = hasSourcePage(source.codigo)
    ? `<a href="/fontes/${esc(source.codigo)}">Página</a>`
    : "";
  const external = source.url_base
    ? `<a href="${esc(source.url_base)}" target="_blank" rel="noopener">Abrir ↗</a>`
    : "";
  return [page, external].filter(Boolean).join("<br>") || "—";
}

function newsSphereCell(value) {
  if (value === "privada") return badge("privada", "info");
  if (value === "publica") return badge("pública", "neutral");
  return `<span class="muted">—</span>`;
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: false, limit: "200kb" }));
app.use(express.json({ limit: "200kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

const companyIdentificationInput = z.object({
  candidatos: z.array(z.string().trim().min(1)).max(30),
  selecionada: z.string().trim().min(1).nullable(),
  confianca: z.enum(["alta", "media", "baixa"]),
  trecho: z.string().trim().max(400).nullable(),
  motivo: z.string().trim().min(1).max(1000),
  modelo: z.string().trim().min(1).max(100),
});

const projectInput = z.object({
  nome: z.string().trim().min(3),
  nicho: z.string().trim().optional(),
  uf: z.string().trim().toUpperCase().max(2).optional(),
  municipio: z.string().trim().optional(),
  empresa_nome: z.string().trim().optional(),
  valor_capex: z.string().optional(),
  moeda: z.enum(["BRL", "USD", "desconhecida"]).default("BRL"),
  status: z.enum([
    "rumor", "anunciado", "leilao", "outorga", "lp",
    "li", "construcao", "operacao", "cancelado",
  ]),
  url: z.string().url(),
  id_fonte: z.string().uuid(),
  titulo: z.string().trim().optional(),
  resumo: z.string().trim().optional(),
  empresa_identificacao: z.string().max(10_000).optional(),
  status_em: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional(),
  status_em_origem: z.enum(["texto", "publicacao"]).or(z.literal("")).optional(),
});

function extractedProjects(data) {
  if (Array.isArray(data?.projetos) && data.projetos.length) return data.projetos;
  if (data?.nome) return [data];
  return [];
}

function projectSplitHtml(projects) {
  if (projects.length < 2) return "";
  return `<ul class="project-split">${projects.map((item) => `
    <li>
      <strong>${esc(item.nome)}</strong>
      <span>${esc([
        item.empresa_nome,
        [item.municipio, item.uf].filter(Boolean).join(" / "),
        item.valor_capex ? money(item.valor_capex, item.moeda) : null,
        item.esfera,
      ].filter(Boolean).join(" · "))}</span>
    </li>`).join("")}</ul>`;
}

function companyIdentificationHtml(identification) {
  if (!identification || !Array.isArray(identification.candidatos)) return "";
  const confidenceKind = identification.confianca === "alta"
    ? "success"
    : identification.confianca === "media" ? "warning" : "neutral";
  const options = identification.candidatos
    .map((candidate) => `<li>${esc(candidate)}</li>`)
    .join("");
  return `
    <details class="company-decision">
      <summary>Como a empresa foi identificada ${badge(
        `confiança ${identification.confianca || "baixa"}`,
        confidenceKind,
      )}</summary>
      ${identification.trecho ? `<blockquote>“${esc(identification.trecho)}”</blockquote>` : ""}
      <p>${esc(identification.motivo || "Sem justificativa do modelo.")}</p>
      <p class="muted">Opções detectadas no texto:</p>
      <ul>${options || "<li>Nenhuma</li>"}</ul>
    </details>`;
}

app.get("/", (_req, res) => res.redirect("/projetos"));

app.get("/health", async (_req, res) => {
  try {
    const { database_time } = await db.healthcheck();
    res.json({ status: "ok", database: "ok", database_time });
  } catch (error) {
    res.status(503).json({ status: "error", database: "error" });
  }
});

app.get("/projetos", async (_req, res) => {
  const [projects, stats] = await Promise.all([
    db.listProjects(),
    db.dashboardStats(),
  ]);
  const cards = projects.length
    ? projects.map((project) => `
      <article class="project-card">
        <div class="project-card__top">
          ${badge(project.status, statusKind(project.status))}
          <span class="muted">${esc(project.status_em ? formatDay(project.status_em) : "sem data do status")}</span>
          <span class="muted">${esc(project.nicho || "Nicho não informado")}</span>
        </div>
        <h2><a href="/projetos/${project.id}">${esc(project.nome)}</a></h2>
        <p class="project-card__company">${esc(project.empresa_nome || "Empresa ainda não identificada")}</p>
        <dl class="facts">
          <div><dt>Local</dt><dd>${esc([project.municipio, project.uf].filter(Boolean).join(" / ") || "—")}</dd></div>
          <div><dt>CapEx</dt><dd>${esc(money(project.valor_capex, project.moeda))}</dd></div>
          <div><dt>Evidências</dt><dd>${project.total_evidencias}</dd></div>
        </dl>
        <div class="card-actions">
          <a href="${esc(project.url_noticia_principal)}" target="_blank" rel="noopener">Notícia principal ↗</a>
          <a href="/projetos/${project.id}">Ver evidências →</a>
        </div>
      </article>`).join("")
    : `<div class="empty"><h2>Nenhum projeto ainda</h2><p>Explore as fontes primárias para encontrar os primeiros candidatos.</p><a class="button" href="/prospeccao">Explorar fontes</a></div>`;

  res.send(layout({
    title: "Projetos",
    active: "projetos",
    body: `
      <section class="page-heading">
        <div><p class="eyebrow">MVP · meta de 5</p><h1>Projetos prospectados</h1><p>Notícia abre a ficha; fontes secundárias confirmam o projeto.</p></div>
        <a class="button" href="/prospeccao">Explorar fontes</a>
      </section>
      <section class="stats">
        <div><strong>${stats.projetos}</strong><span>Projetos</span></div>
        <div><strong>${stats.evidencias}</strong><span>Evidências</span></div>
        <div><strong>${stats.fontes}</strong><span>Fontes ativas</span></div>
        <div><strong>${stats.fontes_com_alerta}</strong><span>Fontes com alerta</span></div>
      </section>
      <section class="project-grid">${cards}</section>`,
  }));
});

app.get("/prospeccao", async (req, res) => {
  const history = req.query.view === "historico";
  const [candidates, stats, sources, cycle] = await Promise.all([
    db.listCandidates({ history }),
    db.candidateStats(),
    db.listSources(),
    db.cycleState(),
  ]);
  const message = req.query.message
    ? `<div class="notice">${esc(req.query.message)}</div>`
    : "";
  const manualSources = sources.filter((source) => MANUAL_REASON[source.auth_acesso]);
  const manualRows = manualSources.map((source) => `
    <tr>
      <td><strong>${esc(source.nome)}</strong><br><span class="muted">${esc(source.codigo)}</span></td>
      <td>${esc(MANUAL_BY_CODE[source.codigo] || MANUAL_REASON[source.auth_acesso])}</td>
      <td>${badge(source.status_acesso, statusKind(source.status_acesso))}<br><span class="muted">${esc(date(source.ultimo_acesso_em))}</span></td>
      <td><a href="${esc(source.url_base)}" target="_blank" rel="noopener">Abrir ↗</a></td>
    </tr>`).join("");
  const cards = candidates.length
    ? candidates.map((candidate) => {
      const data = candidate.dados_extraidos || {};
      const projects = extractedProjects(data);
      const pendingDecision = candidate.rotulo_projeto === null;
      const many = projects.length > 1;
      return `
        <article class="candidate-card">
          <div class="project-card__top">
            ${badge(candidate.status, candidate.status === "analisado" ? "success" : statusKind(candidate.status))}
            <span class="muted">${esc(candidate.fonte_nome)} · score ${candidate.relevancia}</span>
          </div>
          <h2>${esc(many ? candidate.titulo : (data.nome || candidate.titulo))}</h2>
          <p>${esc(candidate.resumo || data.resumo || "Sem resumo no listing.")}</p>
          ${many ? projectSplitHtml(projects) : `
          <dl class="facts">
            <div><dt>Projeto</dt><dd>${esc([data.esfera === "privada" ? "privado" : data.esfera, data.pais].filter(Boolean).join(" · ") || "—")}</dd></div>
            <div><dt>Empresa</dt><dd>${esc(data.empresa_nome || "—")}</dd></div>
            <div><dt>Local</dt><dd>${esc([data.municipio, data.uf].filter(Boolean).join(" / ") || "—")}</dd></div>
            <div><dt>CapEx</dt><dd>${esc(money(data.valor_capex, data.moeda))}</dd></div>
          </dl>`}
          ${many ? "" : companyIdentificationHtml(data.empresa_identificacao)}
          ${candidate.erro ? `<p class="error-text">${esc(candidate.erro)}</p>` : ""}
          ${candidate.motivo_decisao ? `<p class="decision-note"><strong>Decisão:</strong> ${esc(candidate.motivo_decisao)} · ${esc(date(candidate.decidido_em))}</p>` : ""}
          <div class="candidate-actions">
            <a href="${esc(candidate.url)}" target="_blank" rel="noopener">Ler notícia ↗</a>
            ${pendingDecision ? `<div>
              <form class="reject-form" method="post" action="/prospeccao/${candidate.id}/rejeitar">
                <select name="motivo" aria-label="Motivo da rejeição">
                  <option value="não é projeto">Não é projeto</option>
                  <option value="projeto público">Projeto público</option>
                  <option value="projeto internacional">Projeto internacional</option>
                  <option value="projeto pequeno">Projeto pequeno</option>
                  <option value="sem CapEx identificável">Sem CapEx</option>
                  <option value="fora do escopo">Fora do escopo</option>
                  <option value="notícia duplicada">Duplicada</option>
                </select>
                <button class="link-button" type="submit">Não aprovar</button>
              </form>
              <form method="post" action="/prospeccao/${candidate.id}/aprovar"><button class="button button--small" type="submit">${many ? `Aprovar ${projects.length} projetos` : "Aprovar projeto"}</button></form>
            </div>` : ""}
          </div>
        </article>`;
    }).join("")
    : `<div class="empty"><h2>Nenhum candidato</h2><p>Inicie uma varredura nas fontes primárias configuradas.</p></div>`;

  res.send(layout({
    title: "Prospecção",
    active: "projetos",
    body: `
      <section class="page-heading">
        <div><p class="eyebrow">Descoberta automática</p><h1>Explorar fontes</h1><p>No início, a leitura automática das fontes fixas e a busca de portais no Google acontecem uma vez por semana. Não há cota diária de modelo. Manchete e corpo do Google ficam de fora do banco. O botão abaixo dispara uma rodada na hora.</p></div>
        <div class="heading-actions">
          <form method="post" action="/prospeccao/acesso"><button class="button button--secondary" type="submit">Verificar acesso</button></form>
          <form method="post" action="/prospeccao/scan"><button class="button" type="submit">Buscar novos projetos</button></form>
        </div>
      </section>
      <section class="stats candidate-stats">
        <div><strong>${stats.total}</strong><span>Notícias prospectadas</span></div>
        <div><strong>${stats.aprovados}</strong><span>Aprovadas</span></div>
        <div><strong>${stats.rejeitados}</strong><span>Não aprovadas</span></div>
        <div><strong>${stats.pendentes}</strong><span>Pendentes</span></div>
      </section>
      <nav class="view-tabs">
        <a class="${history ? "" : "active"}" href="/prospeccao">Pendentes</a>
        <a class="${history ? "active" : ""}" href="/prospeccao?view=historico">Histórico de treino</a>
        <a href="/api/treino/candidatos.jsonl">Exportar JSONL ↓</a>
      </nav>
      ${message}
      <section class="page-heading">
        <div>
          <p class="eyebrow">Aba Notícias</p>
          <h2>Achar veículo privado</h2>
          <p>Estas buscas abrem o Google Notícias. Servem para ver qual jornal está publicando fábrica, planta e data center. O resultado fica no navegador.</p>
        </div>
      </section>
      <ul class="news-searches">
        ${NEWS_QUERIES.map((query) => `<li><a href="${esc(googleNewsUrl(query.q))}" target="_blank" rel="noopener">${esc(query.label)}</a></li>`).join("")}
      </ul>
      <p class="muted">Última descoberta: ${esc(date(cycle?.ultima_descoberta_em))} · Última varredura: ${esc(date(cycle?.ultimo_scan_em))}${cycle?.ultimo_resumo ? ` · ${esc(cycle.ultimo_resumo)}` : ""}</p>
      <section class="candidate-grid">${cards}</section>
      <section class="page-heading">
        <div>
          <p class="eyebrow">Fora da coleta automática</p>
          <h2>Fontes que pedem credencial ou uma pessoa</h2>
          <p>O dado dessas fontes não entra na coleta automática. Falta chave, projeto em nuvem, captcha ou assinatura.</p>
        </div>
      </section>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Fonte</th><th>O que falta</th><th>Último acesso</th><th></th></tr></thead>
          <tbody>${manualRows}</tbody>
        </table>
      </div>
      <p class="manual-link">Não encontrou a matéria? <a href="/projetos/novo">Cadastrar manualmente</a>.</p>`,
  }));
});

app.get("/api/treino/candidatos.jsonl", async (_req, res) => {
  const examples = await db.trainingExamples();
  const body = examples.map((example) => JSON.stringify({
    input: {
      titulo: example.titulo,
      resumo: example.resumo,
      fonte: example.fonte_codigo,
      relevancia_heuristica: example.relevancia,
    },
    output: {
      projeto: example.rotulo_projeto,
      motivo: example.motivo_decisao,
      extracao: example.dados_extraidos,
    },
    metadata: {
      url: example.url,
      modelo_extracao: example.modelo_extracao,
      decidido_em: example.decidido_em,
    },
  })).join("\n");
  res.type("application/x-ndjson");
  res.setHeader("Content-Disposition", "attachment; filename=radar-candidatos-treino.jsonl");
  res.send(body ? `${body}\n` : "");
});

app.post("/prospeccao/acesso", async (_req, res) => {
  const result = await probeAllSources();
  const message = [
    `${result.total} fontes acessadas`,
    `${result.ok} responderam`,
    result.failed.length ? `${result.failed.length} com falha de coleta` : null,
    result.manual.length ? `${result.manual.length} dependem de credencial ou de uma pessoa` : null,
  ].filter(Boolean).join(" · ");
  res.redirect(`/prospeccao?message=${encodeURIComponent(message)}`);
});

app.post("/prospeccao/scan", async (_req, res) => {
  const result = await scanPrimarySources();
  const message = [
    `${result.sources} fontes consultadas`,
    `${result.discovered} links relevantes`,
    `${result.analyzed} analisados`,
    `${result.kept ?? 0} projetos privados`,
    result.filteredOut ? `${result.filteredOut} fora do alvo privado` : null,
    result.sourcesWithError ? `${result.sourcesWithError} fontes com erro` : null,
  ].filter(Boolean).join(" · ");
  res.redirect(`/prospeccao?message=${encodeURIComponent(message)}`);
});

app.post("/prospeccao/:id/aprovar", async (req, res) => {
  const projects = await db.approveCandidate(req.params.id);
  if (projects.length === 1) return res.redirect(`/projetos/${projects[0].id}`);
  res.redirect("/projetos");
});

app.post("/prospeccao/:id/rejeitar", async (req, res) => {
  const input = z.object({
    motivo: z.enum([
      "não é projeto",
      "projeto público",
      "projeto internacional",
      "projeto pequeno",
      "sem CapEx identificável",
      "fora do escopo",
      "notícia duplicada",
    ]),
  }).parse(req.body);
  await db.rejectCandidate(req.params.id, input.motivo);
  res.redirect("/prospeccao");
});

const sourceFilterQuery = z.object({
  acesso: z.enum(["", "ok", "nao_conectada", "instavel", "bloqueado", "indisponivel"]).optional(),
  papel: z.enum(["", "primaria", "secundaria"]).optional(),
  recorrencia: z.enum(["", "alta", "media", "baixa", "desconhecida"]).optional(),
  extracao: z.enum(["", ...Object.keys(SOURCE_CATEGORIES)]).optional(),
  noticia: z.enum(["", "publica", "privada"]).optional(),
  estagio: z.enum(["", "sugerida", "prova", "fixa", "aposentada"]).optional(),
  abrangencia: z.enum(["", ...Object.keys(SCOPES)]).optional(),
  ordenar: z.enum(["nome", "papel", "acesso", "recorrencia"]).optional(),
});

app.get("/captura", async (_req, res) => {
  const sources = await db.listSources();
  const scannerCount = sources.filter((source) => source.participa_scanner).length;
  const groups = Object.keys(SOURCE_CATEGORIES).map((key) => {
    const category = sourceCategory(key);
    const rows = sources
      .filter((source) => source.categoria === key)
      .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"));
    return { key, category, rows };
  }).filter((group) => group.rows.length);

  const groupHtml = groups.map(({ category, rows }) => `
    <section class="capture-group">
      <h2>${esc(category.label)}</h2>
      <p>${esc(category.description)}</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Fonte</th><th>Papel</th><th>Registro</th><th>Formato</th><th>Acesso</th><th>Coleta</th><th>Nota</th></tr></thead>
          <tbody>${rows.map((source) => `
            <tr>
              <td>${sourceTitle(source)}<br><span class="muted">${esc(source.codigo)}</span><br>${newsSphereCell(source.esfera_noticia)}</td>
              <td>${badge(source.papel_captura ? captureLabel("papel_captura", source.papel_captura) : source.tipo, source.tipo === "primaria" ? "info" : "neutral")}</td>
              <td>${esc(source.unidade_registro || "—")}</td>
              <td>${esc(captureLabel("formato_dado", source.formato_dado))}</td>
              <td>${esc(captureLabel("auth_acesso", source.auth_acesso))}<br>${badge(source.status_acesso, statusKind(source.status_acesso))}</td>
              <td>${source.participa_scanner ? badge("scanner piloto", "success") : badge("mapeada", "neutral")}</td>
              <td>${esc(source.peculiaridade || "—")}</td>
            </tr>`).join("")}</tbody>
        </table>
      </div>
    </section>`).join("");

  const pendingSources = POSSIBLE_SOURCES.filter((source) => !DASHBOARD_PROFILES[source.codigo]);
  const possibleHtml = POSSIBLE_GROUPS.map((group) => {
    const rows = pendingSources.filter((source) => source.familia === group);
    if (!rows.length) return "";
    return `
      <section class="capture-group">
        <h2>${esc(group)}</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Candidata</th><th>Decisão</th><th>Como o dado aparece</th><th>Avaliação</th></tr></thead>
            <tbody>${rows.map((source) => {
              const decision = CAPTURE_DECISIONS[source.decisao] || CAPTURE_DECISIONS.adiar;
              const link = source.url
                ? `<a href="${esc(source.url)}" target="_blank" rel="noopener">Abrir ↗</a>`
                : "";
              return `
              <tr>
                <td><strong>${esc(source.nome)}</strong><br><span class="muted">${esc(source.codigo)} · ${esc(source.papel)}</span><br>${link}</td>
                <td>${badge(decision.label, decision.kind)}</td>
                <td><strong>${esc(source.modo)}</strong><br>${esc(source.disponibilidade)}</td>
                <td>${esc(source.porque)}</td>
              </tr>`;
            }).join("")}</tbody>
          </table>
        </div>
      </section>`;
  }).join("");

  res.send(layout({
    title: "Captura",
    active: "captura",
    body: `
      <section class="page-heading">
        <div>
          <p class="eyebrow">Módulo de captura</p>
          <h1>Mapa de disponibilidade</h1>
          <p>Todas as fontes catalogadas estão ativas. Esta página registra como cada uma entrega dados. A coleta automática continua limitada ao scanner piloto.</p>
        </div>
      </section>
      <section class="stats">
        <div><strong>${sources.length}</strong><span>Fontes ativas</span></div>
        <div><strong>${sources.filter((source) => source.tipo === "primaria").length}</strong><span>Primárias</span></div>
        <div><strong>${sources.filter((source) => source.tipo === "secundaria").length}</strong><span>Secundárias</span></div>
        <div><strong>${scannerCount}</strong><span>No scanner piloto</span></div>
        <div><strong>${pendingSources.length}</strong><span>Ainda fora do dashboard</span></div>
      </section>
      ${groupHtml}
      <section class="page-heading">
        <div>
          <p class="eyebrow">Fora do catálogo operacional</p>
          <h2>Ainda fora do dashboard</h2>
          <p>Estas duas ainda não têm uma URL de dados confirmada. As demais fontes avaliadas já aparecem no dashboard, com a explicação de cada uma.</p>
        </div>
      </section>
      ${possibleHtml}`,
  }));
});

function bytesLabel(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return null;
  if (size >= 1_000_000) return `${(size / 1_000_000).toFixed(1)} MB`;
  if (size >= 1_000) return `${Math.round(size / 1_000)} KB`;
  return `${size} bytes`;
}

const hubQuery = z.object({
  uf: z.enum(["", ...BRAZIL_UFS]).optional(),
  municipio: z.string().trim().max(80).optional(),
});

app.get("/fontes/hub", async (req, res) => {
  const parsed = hubQuery.safeParse(req.query);
  const filters = parsed.success ? parsed.data : {};
  const sources = await db.listSources();
  res.send(layout({
    title: "Hub de fontes",
    active: "hub",
    body: hubBody(sources, filters),
  }));
});

app.get("/fontes/:codigo", async (req, res) => {
  const codigo = String(req.params.codigo || "").toUpperCase();
  const guide = sourceGuide(codigo);
  if (!guide && hasSourcePage(codigo)) {
    const source = await db.getSourceByCode(codigo);
    if (source) {
      return res.send(layout({
        title: source.nome,
        active: "hub",
        body: catalogPageBody(source),
      }));
    }
  }
  if (!guide) {
    return res.status(404).send(layout({
      title: "Fonte",
      active: "fontes",
      body: `<div class="empty"><h1>Fonte sem página</h1><p>Esta fonte ainda não tem uma página de explicação.</p><a href="/fontes">Voltar às fontes</a></div>`,
    }));
  }
  const [source, loads, evidenceSample] = await Promise.all([
    db.getSourceByCode(codigo),
    db.latestBaseLoads(guide.cargas),
    db.latestEvidenceSample(codigo),
  ]);
  const amostra = sampleSectionHtml({ raw: readRawSample(codigo), evidence: evidenceSample });
  const nome = source?.nome || guide.nome;
  const grupos = guide.extraido?.grupos || [];
  const formato = `
    <section class="source-format">
      <h2>Formato dos dados extraídos</h2>
      <p>Formato do registro como a fonte o publica, antes da normalização do Radar. Os nomes abaixo são os da origem.</p>
      <p class="source-format__meio"><strong>Suporte.</strong> ${esc(guide.extraido?.meio || "")}</p>
      ${grupos.map((grupo) => `
        <div class="field-group">
          <h3>${esc(grupo.nome)}</h3>
          <div class="field-specs">${(grupo.campos || []).map(([chave, tipo, detalhe]) =>
            fieldSpecRow(chave, tipo, detalhe, esc)).join("")}</div>
        </div>`).join("")}
    </section>`;
  const paragraphs = (items) => (items || []).map((item) => `<p>${esc(item)}</p>`).join("");
  const extracao = sourceExtraction(codigo);
  const extracaoHtml = extracao ? `
    <section class="source-extraction">
      <h2>Como o dado aparece na fonte</h2>
      ${paragraphs(extracao.formato)}
      <h2>Chamadas feitas pelo Radar</h2>
      ${extracao.requisicoes.map((item) => `
        <div class="source-request">
          <p><code>${esc(item.metodo)}</code> <code>${esc(item.url)}</code></p>
          ${item.parametros.length ? `<table class="source-request__params">
            <thead><tr><th>Parâmetro</th><th>Valor</th><th>Para quê</th></tr></thead>
            <tbody>${item.parametros.map(([nome, valor, funcao]) => `
              <tr><td><code>${esc(nome)}</code></td><td><code>${esc(valor)}</code></td><td>${esc(funcao)}</td></tr>`).join("")}</tbody>
          </table>` : ""}
          ${item.nota ? `<p class="muted">${esc(item.nota)}</p>` : ""}
        </div>`).join("")}
      <h2>Passo a passo da extração</h2>
      <ol class="source-steps">${extracao.passos.map((step) => `<li>${esc(step)}</li>`).join("")}</ol>
    </section>` : "";
  const fluxo = (guide.fluxo || []).map((step, index) => `
    <li>
      <span class="source-flow__n">${index + 1}</span>
      <span>${esc(step)}</span>
    </li>`).join("");
  const linhas = loads.reduce((sum, load) => sum + (Number(load.linhas) || 0), 0);
  const httpUrl = (value) => /^https?:\/\//i.test(String(value || "")) ? String(value) : "";
  const coletaLinks = loads
    .map((load) => ({ ...load, url: httpUrl(load.recurso) }))
    .filter((load) => load.url);
  const coletaHtml = coletaLinks.length
    ? `<p><strong>Última coleta.</strong> ${coletaLinks.map((load) => `<a href="${esc(load.url)}" target="_blank" rel="noopener">${esc(loads.length > 1 ? load.codigo : "Abrir o arquivo usado na última carga")} ↗</a>`).join(" · ")}</p>`
    : `<p class="muted"><strong>Última coleta.</strong> Esta fonte não gravou um endereço de arquivo. A consulta usa o endereço ao vivo da publicação.</p>`;
  const loadHtml = loads.length
    ? `<ul class="source-loads">${loads.map((load) => `
        <li>
          <strong>${esc(load.codigo)}</strong>
          <span>${load.linhas == null ? "carga sem contagem" : `${load.linhas} linha(s)`}${bytesLabel(load.bytes) ? ` · ${esc(bytesLabel(load.bytes))}` : ""}</span>
          <span class="muted">${esc(date(load.carregado_em))} · ${esc(load.status)}</span>
          ${httpUrl(load.recurso) ? `<a href="${esc(httpUrl(load.recurso))}" target="_blank" rel="noopener">${esc(httpUrl(load.recurso))}</a>` : ""}
        </li>`).join("")}</ul>`
    : `<p class="muted">${esc(guide.copia)}</p>`;

  res.send(layout({
    title: nome,
    active: "fontes",
    body: `
      <section class="page-heading">
        <div>
          <p class="eyebrow">Fonte conectada · ${esc(codigo)}</p>
          <h1>${esc(nome)}</h1>
          <p>${esc(guide.resumo)}</p>
        </div>
        <a class="button button--secondary" href="${esc(guide.url)}" target="_blank" rel="noopener">Publicação original ↗</a>
      </section>
      <section class="stats">
        <div><strong>${esc(SCOPES[sourceScope(codigo).abrangencia].label)}</strong><span>Abrangência</span></div>
        <div><strong>${esc(source?.tipo || "secundaria")}</strong><span>Papel no Radar</span></div>
        <div><strong>${guide.cargas.length ? (linhas || "—") : "na coleta"}</strong><span>${guide.cargas.length ? "Linhas na última carga" : "Cópia lida na hora da ficha"}</span></div>
        <div><strong>ok</strong><span>Acesso na coleta</span></div>
      </section>
      <article class="source-doc">
        <section>
          <h2>O que a fonte informa</h2>
          ${paragraphs(guide.informa)}
        </section>
        ${scopeSection(codigo)}
        ${formato}
        ${extracaoHtml}
        ${amostra}
        <section>
          <h2>Origem e links de acesso</h2>
          <p><strong>Fonte inicial.</strong> ${esc(guide.origem.orgao)}. ${esc(guide.origem.publicacao)}</p>
          <p>${esc(guide.origem.acesso)}</p>
          <ul class="source-loads">${guide.origem.links.map((link) => `
            <li>
              <strong>${esc(link.papel)}</strong>
              ${link.fixa ? badge("URL fixa no código", "info") : badge("endereço achado na consulta", "neutral")}
              <a href="${esc(link.url)}" target="_blank" rel="noopener">${esc(link.url)}</a>
              <span>${esc(link.nota)}</span>
            </li>`).join("")}</ul>
        </section>
        <section>
          <h2>Como os dados são obtidos</h2>
          ${paragraphs(guide.acesso)}
          <p><strong>Cópia usada na coleta.</strong> ${esc(guide.copia.replace(/\.$/, ""))}.${guide.arquivo ? ` Arquivo: ${esc(guide.arquivo)}.` : ""}</p>
          ${coletaHtml}
          ${loadHtml}
          <h3>Fluxograma</h3>
          <p class="muted">Como o Radar reconhece a fonte, chega até ela e retira os dados até a cópia usada na coleta.</p>
          <ol class="source-flow">${fluxo}</ol>
        </section>
        <section>
          <h2>Como é feita a correlação</h2>
          <p class="source-mode"><strong>Modo principal:</strong> ${esc(guide.modo || "Definido na descrição abaixo.")}</p>
          ${paragraphs(guide.associacao)}
          <h3>Correlação direta com o projeto</h3>
          ${paragraphs(REGRA_CORRELACAO)}
          ${extracao?.correlacao?.length ? `<h3>Nesta fonte</h3>${paragraphs(extracao.correlacao)}` : ""}
        </section>
        <section>
          <h2>Limitações</h2>
          ${paragraphs(guide.alcance)}
        </section>
      </article>
      <p class="manual-link"><a href="/fontes/hub">Hub de fontes</a> · <a href="/fontes">Todas as fontes</a></p>`,
  }));
});

app.get("/fontes", async (req, res) => {
  const filters = sourceFilterQuery.parse(req.query);
  const connectedCodes = connectedSourceCodes();
  const allSources = (await db.listSources()).map((source) => ({
    ...source,
    status_acesso: dashboardAccess(source, connectedCodes),
    abrangencia: sourceScope(source.codigo).abrangencia,
  }));
  const sources = filterAndSortSources(allSources, filters);
  const rows = sources.map((source) => {
    const extraction = sourceCategory(source.categoria);
    return `
    <tr>
      <td>${sourceTitle(source)}<br><span class="muted">${esc(source.codigo)}</span>${source.ativo ? "" : ` ${badge("inativa", "warning")}`}</td>
      <td>${badge(source.tipo, source.tipo === "primaria" ? "info" : "neutral")}</td>
      <td>${scopeBadge(source.codigo)}</td>
      <td>${newsSphereCell(source.esfera_noticia)}</td>
      <td>${stageCell(source.estagio)}</td>
      <td><strong>${esc(extraction.label)}</strong><br><span class="muted">${esc(extraction.description)}</span></td>
      <td>${accessBadge(source.status_acesso)}<br><span class="muted">${esc(date(source.ultimo_acesso_em))}</span></td>
      <td>${badge(source.frequencia_projetos, "neutral")}</td>
      <td>${esc(source.conteudo || "—")}</td>
      <td>${esc(source.peculiaridade || source.ultimo_erro || "—")}</td>
      <td>${sourceLinks(source)}</td>
    </tr>`;
  }).join("");
  const categoryLegend = Object.entries(SOURCE_CATEGORIES).map(([key, category]) => `
    <article class="category-card">
      <div>${badge(category.label, "neutral")}</div>
      <p>${esc(category.description)}</p>
      <span class="muted">${sources.filter((source) => source.categoria === key).length} fonte(s)</span>
    </article>`).join("");
  const tableBody = rows || `<tr><td colspan="11"><div class="empty"><h2>Nenhuma fonte neste filtro</h2><p>Ajuste acesso, papel, abrangência, notícia, estágio, extração ou recorrência.</p></div></td></tr>`;

  res.send(layout({
    title: "Fontes",
    active: "fontes",
    body: `
      <section class="page-heading">
        <div><p class="eyebrow">Saúde operacional</p><h1>Dashboard de Fontes</h1><p>Acesso ok marca só as fontes que a coleta já usa. O nome e o link Página abrem a explicação de cada uma.</p></div>
        <a class="button button--secondary" href="/fontes/hub">Hub de fontes</a>
      </section>
      <form class="source-filters" method="get" action="/fontes">
        <label>Acesso
          <select name="acesso">${selectOptions([
            ["", "Todos"],
            ["ok", "ok"],
            ["nao_conectada", "não conectada"],
            ["instavel", "instável"],
            ["bloqueado", "bloqueado"],
            ["indisponivel", "indisponível"],
          ], filters.acesso || "")}</select>
        </label>
        <label>Papel
          <select name="papel">${selectOptions([
            ["", "Todos"],
            ["primaria", "primária"],
            ["secundaria", "secundária"],
          ], filters.papel || "")}</select>
        </label>
        <label>Abrangência
          <select name="abrangencia">${selectOptions([
            ["", "Todas"],
            ...Object.entries(SCOPES).map(([key, scope]) => [key, scope.label]),
          ], filters.abrangencia || "")}</select>
        </label>
        <label>Recorrência
          <select name="recorrencia">${selectOptions([
            ["", "Todas"],
            ["alta", "alta"],
            ["media", "média"],
            ["baixa", "baixa"],
            ["desconhecida", "desconhecida"],
          ], filters.recorrencia || "")}</select>
        </label>
        <label>Notícia
          <select name="noticia">${selectOptions([
            ["", "Todas"],
            ["privada", "privada"],
            ["publica", "pública"],
          ], filters.noticia || "")}</select>
        </label>
        <label>Estágio
          <select name="estagio">${selectOptions([
            ["", "Todos"],
            ["sugerida", "sugerida"],
            ["prova", "prova"],
            ["fixa", "fixa"],
            ["aposentada", "aposentada"],
          ], filters.estagio || "")}</select>
        </label>
        <label>Extração
          <select name="extracao">${selectOptions([
            ["", "Todas"],
            ...Object.entries(SOURCE_CATEGORIES).map(([key, category]) => [key, category.label]),
          ], filters.extracao || "")}</select>
        </label>
        <label>Ordenar
          <select name="ordenar">${selectOptions([
            ["nome", "Nome"],
            ["papel", "Papel"],
            ["acesso", "Acesso"],
            ["recorrencia", "Recorrência"],
          ], filters.ordenar || "nome")}</select>
        </label>
        <div class="source-filters__actions">
          <button class="button" type="submit">Aplicar</button>
          <a class="button button--secondary" href="/fontes">Limpar</a>
        </div>
        <p class="muted source-filters__count">${sources.length} de ${allSources.length} fonte(s)</p>
      </form>
      <section class="category-legend" aria-label="Categorias de extração">${categoryLegend}</section>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Fonte</th><th>Papel</th><th>Abrangência</th><th>Notícia</th><th>Estágio</th><th>Extração</th><th>Acesso</th><th>Recorrência</th><th>O que publica</th><th>Explicação</th><th>Link</th></tr></thead>
          <tbody>${tableBody}</tbody>
        </table>
      </div>`,
  }));
});

app.get("/projetos/novo", async (_req, res) => {
  const sources = (await db.listSources()).filter((source) => source.tipo === "primaria");
  const options = sources.map((source) =>
    `<option value="${source.id}">${esc(source.nome)}</option>`).join("");
  const statuses = ["rumor", "anunciado", "leilao", "outorga", "lp", "li", "construcao", "operacao", "cancelado"];

  res.send(layout({
    title: "Novo projeto",
    active: "projetos",
    scripts: `<script src="/project-form.js" defer></script>`,
    body: `
      <section class="page-heading"><div><p class="eyebrow">Prospecção assistida</p><h1>Novo projeto</h1><p>Cole a notícia, revise a extração da OpenAI e confirme.</p></div></section>
      <div class="form-layout">
        <aside class="extract-panel">
          <label for="article_text">Título + lead da notícia</label>
          <textarea id="article_text" rows="12" placeholder="Cole aqui o texto que descreve o investimento..."></textarea>
          <button id="extract-button" class="button button--secondary" type="button">Extrair com OpenAI</button>
          <p id="extract-status" class="muted">A OpenAI não define CNPJ nem confirma valor oficial.</p>
          <div id="project-split"></div>
          <div id="company-identification"></div>
        </aside>
        <form class="form-card" method="post" action="/projetos">
          <input name="empresa_identificacao" type="hidden">
          <div class="field full"><label>URL da notícia *</label><input name="url" type="url" required></div>
          <div class="field full"><label>Fonte primária *</label><select name="id_fonte" required>${options}</select></div>
          <div class="field full"><label>Nome do projeto *</label><input name="nome" required minlength="3"></div>
          <div class="field"><label>Nicho</label><input name="nicho"></div>
          <div class="field"><label>Empresa</label><input name="empresa_nome"></div>
          <div class="field"><label>UF</label><input name="uf" maxlength="2"></div>
          <div class="field"><label>Município</label><input name="municipio"></div>
          <div class="field"><label>Valor CapEx</label><input name="valor_capex" type="number" min="0" step="0.01"></div>
          <div class="field"><label>Moeda</label><select name="moeda"><option>BRL</option><option>USD</option><option>desconhecida</option></select></div>
          <div class="field"><label>Status</label><select name="status">${statuses.map((s) => `<option value="${s}" ${s === "anunciado" ? "selected" : ""}>${s}</option>`).join("")}</select></div>
          <input name="status_em" type="hidden">
          <input name="status_em_origem" type="hidden">
          <div class="field"><label>Confiança do valor</label><input value="baixa (notícia)" disabled></div>
          <div class="field full"><label>Título da evidência</label><input name="titulo"></div>
          <div class="field full"><label>Resumo</label><textarea name="resumo" rows="4"></textarea></div>
          <div class="form-actions"><button class="button" type="submit">Salvar projeto + evidência</button></div>
        </form>
      </div>`,
  }));
});

app.post("/api/extrair", async (req, res) => {
  try {
    res.json(await extractProjects(req.body.text));
  } catch (error) {
    res.status(422).json({ error: error.message });
  }
});

app.post("/projetos/lote", async (req, res) => {
  const input = z.object({
    url: z.string().url(),
    id_fonte: z.string().uuid(),
    titulo: z.string().trim().optional(),
    projetos: z.string().max(80_000),
  }).parse(req.body);
  const projetos = z.array(z.object({
    nome: z.string().trim().min(3),
    nicho: z.string().nullable().optional(),
    uf: z.string().nullable().optional(),
    municipio: z.string().nullable().optional(),
    empresa_nome: z.string().nullable().optional(),
    valor_capex: z.number().nullable().optional(),
    moeda: z.enum(["BRL", "USD", "desconhecida"]).optional(),
    status: z.enum([
      "rumor", "anunciado", "leilao", "outorga", "lp",
      "li", "construcao", "operacao", "cancelado",
    ]),
    resumo: z.string().optional(),
    trecho: z.string().nullable().optional(),
    status_em: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    status_em_origem: z.enum(["texto", "publicacao"]).nullable().optional(),
    esfera: z.string().optional(),
    empresa_identificacao: companyIdentificationInput.nullable().optional(),
  })).min(1).max(6).parse(JSON.parse(input.projetos))
    .filter((item) => item.esfera !== "fora");
  if (!projetos.length) return res.status(422).send("Nenhum projeto para salvar");
  await db.createProjectsSharingNews({ ...input, projetos });
  res.redirect("/projetos");
});

app.post("/projetos", async (req, res) => {
  const input = projectInput.parse(req.body);
  const {
    empresa_identificacao: rawCompanyIdentification,
    ...projectData
  } = input;
  let companyIdentification = null;
  if (rawCompanyIdentification) {
    companyIdentification = companyIdentificationInput.parse(
      JSON.parse(rawCompanyIdentification),
    );
    if (companyIdentification.selecionada !== projectData.empresa_nome) {
      companyIdentification = null;
    }
  }
  const project = await db.createProjectWithEvidence({
    ...projectData,
    valor_capex: projectData.valor_capex
      ? Number(projectData.valor_capex)
      : null,
    campos_extraidos: companyIdentification
      ? { empresa_identificacao: companyIdentification }
      : {},
  });
  res.redirect(`/projetos/${project.id}`);
});

app.get("/projetos/:id", async (req, res) => {
  const { project, evidence, sources } = await db.getProject(req.params.id);
  if (!project) return res.status(404).send("Projeto não encontrado");
  const company = project.cnpj ? await db.getCompany(project.cnpj) : null;
  const identityHtml = company ? `
    <section class="identity">
      <h2>Identidade da empresa</h2>
      <dl>
        <div><dt>Razão social</dt><dd>${esc(company.razao_social)}</dd></div>
        <div><dt>Fantasia</dt><dd>${esc(company.nome_fantasia || "—")}</dd></div>
        <div><dt>CNPJ</dt><dd>${esc(company.cnpj)}</dd></div>
        <div><dt>Situação</dt><dd>${esc(company.situacao || "—")}</dd></div>
        <div><dt>Atividade</dt><dd>${esc(company.cnae || "—")}</dd></div>
        <div><dt>Matriz</dt><dd>${esc([company.municipio, company.uf].filter(Boolean).join(" / ") || "—")}</dd></div>
      </dl>
    </section>` : "";
  const notice = req.query.message
    ? `<div class="notice">${esc(req.query.message)}</div>`
    : "";
  const siblings = await db.projectsSharingNews(project.url_noticia_principal, project.id);
  const siblingsHtml = siblings.length
    ? `<p class="muted">Mesma notícia: ${siblings.map((item) => `<a href="/projetos/${item.id}">${esc(item.nome)}</a>`).join(" · ")}</p>`
    : "";
  const evidenceHtml = evidence.map((item) => {
    const linhas = item.campos_extraidos?.linhas;
    const proof = Array.isArray(linhas) && linhas.length
      ? `<details><summary>${linhas.length} registro(s) de comprovação</summary><ul>${linhas.slice(0, 12).map((row) => proofLine(row)).join("")}</ul></details>`
      : "";
    return `
    <article class="evidence">
      <div>${badge(item.papel, item.papel === "primaria" ? "info" : "success")} <span class="muted">${esc(date(item.coletado_em))}</span></div>
      <h3>${esc(item.titulo_ou_resumo || item.fonte_nome || "Evidência")}</h3>
      <p>${esc(item.trecho || "")}</p>
      ${proof}
      <p class="evidence-links">${item.fonte_codigo && hasSourcePage(item.fonte_codigo) ? `<a href="/fontes/${esc(item.fonte_codigo)}">${esc(item.fonte_nome || "Fonte")}</a>` : ""}${item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener">Abrir a publicação ↗</a>` : ""}</p>
    </article>`;
  }).join("");
  const usedSourceIds = new Set(evidence.map((item) => item.id_fonte).filter(Boolean));
  const connectedCodes = new Set(collectableSources().map((source) => source.codigo));
  const secondarySources = sources
    .filter((source) => connectedCodes.has(source.codigo))
    .sort((left, right) => {
      const used = Number(usedSourceIds.has(right.id)) - Number(usedSourceIds.has(left.id));
      return used || left.nome.localeCompare(right.nome, "pt-BR");
    });
  const usedSecondary = secondarySources.filter((source) => usedSourceIds.has(source.id)).length;
  const secondaryHtml = secondarySources.map((source) => {
    const used = usedSourceIds.has(source.id);
    return `
      <li class="${used ? "is-used" : ""}">
        <span class="source-check${used ? " is-on" : ""}" role="img" aria-label="${used ? "Utilizada nesta ficha" : "Ainda não utilizada"}">${used ? "✓" : ""}</span>
        <div>
          ${sourceTitle(source)} ${scopeBadge(source.codigo)}
          <span>${esc(sourceGuide(source.codigo)?.resumo || source.conteudo || "Sem explicação cadastrada.")}</span>
        </div>
      </li>`;
  }).join("");
  const sourceOptions = sources.map((source) =>
    `<option value="${source.id}">${esc(source.nome)} · ${esc(source.tipo)}</option>`).join("");
  const statuses = ["rumor", "anunciado", "leilao", "outorga", "lp", "li", "construcao", "operacao", "cancelado"];

  res.send(layout({
    title: project.nome,
    active: "projetos",
    body: `
      ${notice}
      <section class="project-hero">
        <div>${badge(project.status, statusKind(project.status))} ${project.status_em ? `<span class="muted">${esc(formatDay(project.status_em))} · ${project.status_em_origem === "texto" ? "data do texto" : "data da publicação"}</span>` : ""}<p class="eyebrow">${esc(project.nicho || "Nicho não informado")}</p><h1>${esc(project.nome)}</h1><p>${esc(project.empresa_nome || "Empresa ainda não identificada")}${project.cnpj ? ` · ${esc(project.cnpj)}` : ""}</p>${siblingsHtml}</div>
        <a class="button button--secondary" href="${esc(project.url_noticia_principal)}" target="_blank" rel="noopener">Notícia principal ↗</a>
      </section>
      ${identityHtml}
      ${project.leitura_status ? `<section class="notice"><h2>Leitura do status</h2><p>${esc(project.leitura_status)}</p></section>` : ""}
      <section class="stats">
        <div><strong>${esc(money(project.valor_capex, project.moeda))}</strong><span>CapEx · confiança ${esc(project.valor_confianca)}</span></div>
        <div><strong>${esc([project.municipio, project.uf].filter(Boolean).join(" / ") || "—")}</strong><span>Local</span></div>
        <div><strong>${evidence.length}</strong><span>Evidências</span></div>
      </section>
      <div class="detail-grid">
        <section><h2>Evidências</h2><div class="evidence-list">${evidenceHtml}</div></section>
        <aside>
          <form class="form-card compact" method="post" action="/projetos/${project.id}/enriquecer">
            <h2>Coletar evidências</h2>
            <p class="muted">${project.cnpj
              ? "Percorre as fontes conectadas e anota o que encontrar, com as linhas que comprovam."
              : "Fecha o CNPJ da empresa e depois percorre as fontes conectadas."}</p>
            <button class="button" type="submit">Coletar evidências</button>
          </form>
          <form class="form-card compact" method="post" action="/projetos/${project.id}/status">
            <h2>Atualizar status</h2>
            <p class="muted">Um agente lê só as evidências já anotadas e grava o status e a leitura atual.</p>
            <button class="button button--secondary" type="submit">Atualizar status</button>
          </form>
          <form class="form-card compact" method="post" action="/projetos/${project.id}/evidencias">
            <h2>Adicionar enriquecimento</h2>
            <label>Fonte</label><select name="id_fonte" required>${sourceOptions}</select>
            <label>URL da evidência *</label><input name="url" type="url" required>
            <label>Título / resumo</label><input name="titulo_ou_resumo">
            <label>Trecho relevante</label><textarea name="trecho" rows="4"></textarea>
            <label>Novo status (opcional)</label><select name="status"><option value="">Manter ${esc(project.status)}</option>${statuses.map((s) => `<option value="${s}">${s}</option>`).join("")}</select>
            <button class="button" type="submit">Salvar evidência</button>
          </form>
        </aside>
      </div>
      <section class="secondary-sources">
        <div class="page-heading">
          <div>
            <h2>Fontes conectadas</h2>
            <p>${usedSecondary} de ${secondarySources.length} fontes conectadas já deixaram evidência nesta ficha.</p>
          </div>
          ${project.uf ? `<a class="button button--secondary" href="/fontes/hub?${esc(new URLSearchParams({ uf: project.uf, municipio: project.municipio || "" }).toString())}">Fontes para ${esc([project.municipio, project.uf].filter(Boolean).join("/"))}</a>` : ""}
        </div>
        <ul>${secondaryHtml}</ul>
      </section>`,
  }));
});

app.post("/projetos/:id/enriquecer", async (req, res) => {
  const { project } = await db.getProject(req.params.id);
  if (!project) return res.status(404).send("Projeto não encontrado");
  let message;
  try {
    const result = await enrichProject(project);
    message = result.mensagem;
  } catch (error) {
    message = `Enriquecimento interrompido: ${error.message}`;
  }
  res.redirect(`/projetos/${project.id}?message=${encodeURIComponent(message)}`);
});

app.post("/projetos/:id/status", async (req, res) => {
  const { project } = await db.getProject(req.params.id);
  if (!project) return res.status(404).send("Projeto não encontrado");
  let message;
  try {
    const result = await updateProjectFromEvidence(project);
    message = result.status
      ? `Status ${result.status}. ${result.mensagem}`
      : result.mensagem;
  } catch (error) {
    message = `Atualização de status interrompida: ${error.message}`;
  }
  res.redirect(`/projetos/${project.id}?message=${encodeURIComponent(message)}`);
});

app.post("/projetos/:id/evidencias", async (req, res) => {
  const input = z.object({
    id_fonte: z.string().uuid(),
    url: z.string().url(),
    titulo_ou_resumo: z.string().trim().optional(),
    trecho: z.string().trim().optional(),
    status: z.string().optional(),
  }).parse(req.body);
  await db.addEvidence(req.params.id, { ...input, papel: "secundaria" });
  if (input.status) await db.updateProjectStatus(req.params.id, input.status);
  res.redirect(`/projetos/${req.params.id}`);
});

app.use((error, _req, res, _next) => {
  console.error(error instanceof z.ZodError ? error.issues : error.message);
  res.status(500).send(layout({
    title: "Erro",
    body: `<div class="empty"><h1>Não foi possível concluir</h1><p>${esc(error.message)}</p><a href="javascript:history.back()">Voltar</a></div>`,
  }));
});

app.listen(config.port, "0.0.0.0", () => {
  const where = config.onRailway
    ? "Railway"
    : config.isProduction
      ? "produção"
      : "local";
  console.log(`Radar CapEx (${where}) na porta ${config.port}`);
  if (config.schedulerEnabled) startScheduler();
  else console.log("Agendador desligado (DISABLE_SCHEDULER).");
});
