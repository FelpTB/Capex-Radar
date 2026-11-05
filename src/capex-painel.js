// Tela de Monitoramento (capex_radar, Fase 4): notícias das 38 empresas,
// revisão das sugestões da IA e carteira de projetos.
const { z } = require("zod");
const painel = require("./capex-painel-db");
const { pool } = require("./db");
const { carregarGrupos, triarGrupo } = require("./capex-coletor");
const { ESTAGIOS, iaPadrao } = require("./capex-ia");
const { esc, money, badge, selectOptions, layout } = require("./html");

const NICHOS = {
  papel_celulose: "Papel e Celulose",
  alimentos_bebidas: "Alimentos e Bebidas",
  ecommerce: "E-commerce",
  datacenter: "Datacenters",
};

const ESTAGIO_ROTULO = {
  anuncio: "Anúncio",
  licenciamento: "Licenciamento",
  funding: "Financiamento",
  contratacao_epc: "Contratação EPC",
  mobilizacao: "Mobilização",
  operacao: "Operação",
  desaceleracao: "Desaceleração",
  cancelado: "Cancelado",
};

const LIMITE_TRIAGEM = 100;

function dia(valor) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(valor));
}

// Situação da notícia na revisão, a partir da triagem e da leitura da IA.
function situacaoNoticia(noticia) {
  if (noticia.triagem === "vinculada") return { rotulo: "vinculada", tipo: "success" };
  if (noticia.triagem === "descartada") return { rotulo: "descartada", tipo: "neutral" };
  if (noticia.sugerido_projeto_id) return { rotulo: "vínculo sugerido", tipo: "info" };
  if (noticia.triagem === "novo_projeto") return { rotulo: "possível projeto", tipo: "warning" };
  if (noticia.extracao) return { rotulo: "a revisar", tipo: "warning" };
  return { rotulo: "sem triagem", tipo: "neutral" };
}

function local(uf, municipio) {
  return [municipio, uf].filter(Boolean).join(" / ");
}

// Uma linha curta com o que a IA leu na manchete.
function resumoExtracao(extracao) {
  if (!extracao) return "";
  if (extracao.capex === false) return extracao.motivo || "";
  return [
    extracao.objeto,
    local(extracao.uf, extracao.municipio),
    extracao.valor_brl ? money(extracao.valor_brl) : null,
    extracao.estagio ? ESTAGIO_ROTULO[extracao.estagio] || extracao.estagio : null,
  ].filter(Boolean).join(" · ");
}

function aviso(req) {
  return req.query.message ? `<div class="notice">${esc(req.query.message)}</div>` : "";
}

function abas(ativa, totalProjetos) {
  return `<nav class="view-tabs">
    <a class="${ativa === "noticias" ? "active" : ""}" href="/monitoramento">Notícias</a>
    <a class="${ativa === "carteira" ? "active" : ""}" href="/monitoramento/carteira">Carteira (${totalProjetos})</a>
  </nav>`;
}

function linhaGrupo(grupo) {
  const triar = grupo.nao_triadas
    ? `<form method="post" action="/monitoramento/grupos/${grupo.id}/triar">
         <button class="button button--small button--secondary" type="submit">Triar com IA</button>
       </form>`
    : "";
  return `<tr>
    <td><strong><a href="/monitoramento?${esc(new URLSearchParams({ grupo: grupo.id }).toString())}">${esc(grupo.nome)}</a></strong></td>
    <td>${esc(NICHOS[grupo.nicho] || grupo.nicho)}</td>
    <td>${grupo.total}</td>
    <td>${grupo.nao_triadas}</td>
    <td>${grupo.revisar ? `<strong>${grupo.revisar}</strong>` : 0}</td>
    <td>${grupo.projetos}</td>
    <td>${esc(dia(grupo.ultima_coleta))}</td>
    <td>${triar}</td>
  </tr>`;
}

function linhaNoticia(noticia) {
  const situacao = situacaoNoticia(noticia);
  const leitura = resumoExtracao(noticia.extracao);
  const sugestao = noticia.sugerido_projeto
    ? `<br><span class="muted">Sugerido: ${esc(noticia.sugerido_projeto)}${noticia.sugerido_confianca != null ? ` (${noticia.sugerido_confianca}%)` : ""}</span>`
    : "";
  return `<tr>
    <td>${esc(dia(noticia.data_original))}</td>
    <td>${esc(noticia.grupo)}</td>
    <td>
      <strong><a href="/monitoramento/noticias/${noticia.id}">${esc(noticia.titulo)}</a></strong>
      <br><span class="muted">${esc(noticia.veiculo || "")}${leitura ? ` · ${esc(leitura)}` : ""}</span>${sugestao}
    </td>
    <td>${badge(situacao.rotulo, situacao.tipo)}</td>
    <td><a href="/monitoramento/noticias/${noticia.id}">Revisar →</a></td>
  </tr>`;
}

function paginaMonitoramento({ grupos, noticias, filtros, totalProjetos, notice }) {
  const soma = (campo) => grupos.reduce((total, g) => total + g[campo], 0);
  const grupoOpcoes = [["", "Todas as empresas"], ...grupos.map((g) => [g.id, g.nome])];
  const situacaoOpcoes = Object.entries(painel.SITUACOES);
  const listagem = noticias.length
    ? `<div class="table-wrap"><table class="table-compact">
         <thead><tr><th>Data</th><th>Empresa</th><th>Notícia</th><th>Situação</th><th></th></tr></thead>
         <tbody>${noticias.map(linhaNoticia).join("")}</tbody>
       </table></div>`
    : `<div class="empty"><h2>Nenhuma notícia neste filtro</h2><p>Troque a empresa ou a situação acima.</p></div>`;
  return layout({
    title: "Monitoramento",
    active: "monitoramento",
    body: `
      ${notice}
      <section class="page-heading">
        <div>
          <p class="eyebrow">Teste de monitoramento · ${grupos.length} empresas</p>
          <h1>Monitoramento</h1>
          <p>Notícias coletadas por empresa. A IA sugere; aqui você cria o projeto, vincula ou descarta.</p>
        </div>
      </section>
      ${abas("noticias", totalProjetos)}
      <section class="stats">
        <div><strong>${soma("total")}</strong><span>Notícias coletadas</span></div>
        <div><strong>${soma("revisar")}</strong><span>A revisar</span></div>
        <div><strong>${soma("nao_triadas")}</strong><span>Sem triagem da IA</span></div>
        <div><strong>${totalProjetos}</strong><span>Projetos na carteira</span></div>
      </section>
      <form class="source-filters" method="get" action="/monitoramento">
        <div><label>Empresa</label><select name="grupo">${selectOptions(grupoOpcoes, filtros.grupo || "")}</select></div>
        <div><label>Situação</label><select name="situacao">${selectOptions(situacaoOpcoes, filtros.situacao)}</select></div>
        <div class="source-filters__actions"><button class="button button--small" type="submit">Filtrar</button></div>
        <p class="source-filters__count muted">${noticias.length} notícia(s) neste filtro${noticias.length >= 150 ? " (mostrando as 150 mais recentes)" : ""}.</p>
      </form>
      <section>${listagem}</section>
      <section class="capture-group monitor-groups">
        <h2>Empresas</h2>
        <p>"Triar com IA" lê até ${LIMITE_TRIAGEM} notícias sem triagem da empresa com o Claude.</p>
        <div class="table-wrap"><table class="table-compact">
          <thead><tr><th>Empresa</th><th>Nicho</th><th>Notícias</th><th>Sem triagem</th><th>A revisar</th><th>Projetos</th><th>Última coleta</th><th></th></tr></thead>
          <tbody>${grupos.map(linhaGrupo).join("")}</tbody>
        </table></div>
      </section>`,
  });
}

function blocoLeitura(noticia) {
  const ex = noticia.extracao;
  if (!ex) {
    return `<section class="form-card compact"><h2>Leitura da IA</h2><p class="muted">Ainda sem triagem. Use "Triar com IA" na lista de empresas.</p></section>`;
  }
  const filial = ex.filial_sugerida
    ? `${esc(local(ex.filial_sugerida.uf, ex.filial_sugerida.municipio))} · ${esc(ex.filial_sugerida.cnpj)} (${esc(ex.filial_sugerida.prioridade || "")}, por ${ex.filial_sugerida.criterio === "municipio" ? "município" : "única na UF"})`
    : "—";
  return `<section class="form-card compact">
    <h2>Leitura da IA</h2>
    <dl class="facts facts--stack">
      <div><dt>É CapEx?</dt><dd>${ex.capex ? "Sim" : "Não"}</dd></div>
      <div><dt>Objeto</dt><dd>${esc(ex.objeto || "—")}</dd></div>
      <div><dt>Local</dt><dd>${esc(local(ex.uf, ex.municipio) || "—")}</dd></div>
      <div><dt>Valor</dt><dd>${esc(ex.valor_brl ? money(ex.valor_brl) : "—")}</dd></div>
      <div><dt>Estágio</dt><dd>${esc(ESTAGIO_ROTULO[ex.estagio] || ex.estagio || "—")}</dd></div>
      <div><dt>Data do fato</dt><dd>${esc(ex.data_fato || "—")}</dd></div>
      <div><dt>Filial sugerida</dt><dd>${filial}</dd></div>
      <div><dt>Título cita a empresa?</dt><dd>${ex.cita_empresa === false ? "Não (achada no corpo da matéria)" : "Sim"}</dd></div>
    </dl>
    <p class="decision-note">${esc(ex.motivo || noticia.triagem_motivo || "")}</p>
  </section>`;
}

function blocoVinculos(noticia, vinculos) {
  if (!vinculos.length) return "";
  const itens = vinculos.map((v) => {
    const acoes = v.situacao === "sugerido"
      ? `<div class="inline-actions">
           <form method="post" action="/monitoramento/noticias/${noticia.id}/vincular">
             <input type="hidden" name="projeto_id" value="${v.projeto_id}">
             <button class="button button--small" type="submit">Aceitar</button>
           </form>
           <form method="post" action="/monitoramento/noticias/${noticia.id}/rejeitar">
             <input type="hidden" name="projeto_id" value="${v.projeto_id}">
             <button class="button button--small button--danger" type="submit">Rejeitar</button>
           </form>
         </div>`
      : "";
    return `<li>
      ${badge(v.situacao, v.situacao === "aceito" ? "success" : v.situacao === "rejeitado" ? "neutral" : "info")}
      <a href="/monitoramento/projetos/${v.projeto_id}">${esc(v.projeto_titulo)}</a>
      <span class="muted">${esc(v.origem)}${v.confianca != null ? ` · ${v.confianca}%` : ""}${v.motivo ? ` · ${esc(v.motivo)}` : ""}</span>
      ${acoes}
    </li>`;
  }).join("");
  return `<section class="form-card compact"><h2>Vínculos com projetos</h2><ul class="project-split">${itens}</ul></section>`;
}

function formularioProjeto(noticia, matrizes, filiais) {
  const ex = noticia.extracao || {};
  const sugerida = ex.filial_sugerida?.cnpj || "";
  const dataFato = /^\d{4}-\d{2}-\d{2}$/.test(ex.data_fato || "") ? ex.data_fato : null;
  const dataAnuncio = dataFato || (noticia.data_original ? new Date(noticia.data_original).toISOString().slice(0, 10) : "");
  const matrizOpcoes = matrizes.map((m) => [m.cnpj, `${m.razao_social} · ${m.papel}${m.uf ? ` · ${m.uf}` : ""}`]);
  const filialOpcoes = [["", "Ainda não definida"], ...filiais.map((f) => [f.cnpj, `${local(f.uf, f.municipio)} · ${f.prioridade} · ${f.cnpj}`])];
  if (!matrizes.length) {
    return `<section class="form-card compact"><h2>Criar projeto</h2><p class="muted">Esta empresa ainda não tem CNPJ cadastrado (matriz). O projeto só nasce quando houver a raiz.</p></section>`;
  }
  return `<form class="form-card compact" method="post" action="/monitoramento/noticias/${noticia.id}/projeto">
    <h2>Criar projeto</h2>
    <p class="muted">Pré-preenchido com a leitura da IA. A notícia vira a evidência primária.</p>
    <label>Título *</label><input name="titulo" required maxlength="200" value="${esc(ex.objeto ? `${noticia.grupo} — ${ex.objeto}` : noticia.titulo)}">
    <label>Matriz (CNPJ) *</label><select name="matriz_cnpj" required>${selectOptions(matrizOpcoes, matrizes[0].cnpj)}</select>
    <label>Filial${ex.uf ? ` (prioritárias em ${esc(ex.uf)})` : ""}</label><select name="filial_cnpj">${selectOptions(filialOpcoes, sugerida)}</select>
    <label>UF</label><input name="uf" maxlength="2" value="${esc(ex.uf || "")}">
    <label>Município</label><input name="municipio" value="${esc(ex.municipio || "")}">
    <label>Objeto</label><input name="objeto" value="${esc(ex.objeto || "")}">
    <label>Valor estimado (R$)</label><input name="valor_estimado_brl" inputmode="numeric" value="${esc(ex.valor_brl ?? "")}">
    <label>Estágio</label><select name="estagio">${selectOptions(ESTAGIOS.map((e) => [e, ESTAGIO_ROTULO[e]]), ex.estagio || "anuncio")}</select>
    <label>Data do anúncio</label><input name="data_anuncio" type="date" value="${esc(dataAnuncio)}">
    <button class="button" type="submit">Criar projeto</button>
  </form>`;
}

function paginaNoticia({ noticia, vinculos, projetos, matrizes, filiais, notice }) {
  const situacao = situacaoNoticia({ ...noticia, sugerido_projeto_id: vinculos.find((v) => v.situacao === "sugerido")?.projeto_id });
  const vincular = projetos.length
    ? `<form class="form-card compact" method="post" action="/monitoramento/noticias/${noticia.id}/vincular">
         <h2>Vincular a projeto existente</h2>
         <select name="projeto_id" required>${selectOptions(projetos.map((p) => [p.id, `${p.titulo}${p.uf ? ` · ${p.uf}` : ""}`]))}</select>
         <button class="button button--secondary" type="submit">Vincular</button>
       </form>`
    : "";
  const descartar = noticia.triagem === "descartada"
    ? ""
    : `<form class="form-card compact" method="post" action="/monitoramento/noticias/${noticia.id}/descartar">
         <h2>Descartar</h2>
         <label>Motivo</label><input name="motivo" placeholder="não é projeto, outra empresa, repetida…">
         <button class="button button--danger" type="submit">Descartar notícia</button>
       </form>`;
  return layout({
    title: noticia.titulo,
    active: "monitoramento",
    body: `
      ${notice}
      <p><a href="/monitoramento?${esc(new URLSearchParams({ grupo: noticia.grupo_id || "" }).toString())}">← ${esc(noticia.grupo || "Monitoramento")}</a></p>
      <section class="project-hero">
        <div>
          ${badge(situacao.rotulo, situacao.tipo)} <span class="muted">${esc(noticia.veiculo || "")} · ${esc(dia(noticia.data_original))}</span>
          <p class="eyebrow">${esc(noticia.grupo || "")} · ${esc(NICHOS[noticia.nicho] || "")}</p>
          <h1>${esc(noticia.titulo)}</h1>
          <p class="muted">Consulta: ${esc(noticia.consulta || "—")}</p>
        </div>
        ${noticia.url ? `<a class="button button--secondary" href="${esc(noticia.url)}" target="_blank" rel="noopener">Abrir notícia ↗</a>` : ""}
      </section>
      <div class="detail-grid">
        <section class="evidence-list">
          ${blocoLeitura(noticia)}
          ${blocoVinculos(noticia, vinculos)}
        </section>
        <aside>
          ${formularioProjeto(noticia, matrizes, filiais)}
          ${vincular}
          ${descartar}
        </aside>
      </div>`,
  });
}

function paginaCarteira({ projetos, notice }) {
  const cards = projetos.length
    ? projetos.map((p) => `
      <article class="project-card">
        <div class="project-card__top">
          ${badge(ESTAGIO_ROTULO[p.estagio] || p.estagio, p.estagio === "cancelado" ? "danger" : p.estagio === "operacao" ? "success" : "info")}
          <span class="muted">${esc(NICHOS[p.nicho] || p.nicho)}</span>
        </div>
        <h2><a href="/monitoramento/projetos/${p.id}">${esc(p.titulo)}</a></h2>
        <p class="project-card__company">${esc(p.grupo)} · ${esc(p.matriz_razao_social)}</p>
        <dl class="facts">
          <div><dt>Local</dt><dd>${esc(local(p.uf, p.municipio) || "—")}</dd></div>
          <div><dt>Valor</dt><dd>${esc(money(p.valor_estimado_brl))}</dd></div>
          <div><dt>Evidências</dt><dd>${p.n_evidencias || 0}</dd></div>
        </dl>
        <div class="card-actions">
          <span class="muted">Última evidência: ${esc(dia(p.ultima_evidencia_em))}</span>
          <a href="/monitoramento/projetos/${p.id}">Linha do tempo →</a>
        </div>
      </article>`).join("")
    : `<div class="empty"><h2>Nenhum projeto ainda</h2><p>Abra uma notícia "a revisar" e use "Criar projeto".</p><a class="button" href="/monitoramento">Ver notícias</a></div>`;
  return layout({
    title: "Carteira",
    active: "monitoramento",
    body: `
      ${notice}
      <section class="page-heading">
        <div><p class="eyebrow">Teste de monitoramento</p><h1>Carteira de projetos</h1><p>Projetos criados na revisão das notícias, com a linha do tempo das evidências aceitas.</p></div>
      </section>
      ${abas("carteira", projetos.length)}
      <section class="project-grid">${cards}</section>`,
  });
}

function paginaProjeto({ projeto, timeline, notice }) {
  const itens = timeline.map((t) => `
    <article class="evidence">
      <div>${t.primaria ? badge("primária", "info") : badge("evidência", "success")} <span class="muted">${esc(dia(t.data_original))} · ${esc(t.veiculo || t.fonte_nome || "")}</span></div>
      <h3><a href="/monitoramento/noticias/${t.evidencia_id}">${esc(t.titulo)}</a></h3>
      ${t.url ? `<p class="evidence-links"><a href="${esc(t.url)}" target="_blank" rel="noopener">Abrir a publicação ↗</a></p>` : ""}
    </article>`).join("");
  return layout({
    title: projeto.titulo,
    active: "monitoramento",
    body: `
      ${notice}
      <p><a href="/monitoramento/carteira">← Carteira</a></p>
      <section class="project-hero">
        <div>
          ${badge(ESTAGIO_ROTULO[projeto.estagio] || projeto.estagio, "info")} ${badge(projeto.flag_validacao, "neutral")}
          <p class="eyebrow">${esc(projeto.grupo)} · ${esc(NICHOS[projeto.nicho] || projeto.nicho)}</p>
          <h1>${esc(projeto.titulo)}</h1>
          <p>${esc(projeto.matriz_razao_social)} · ${esc(projeto.matriz_cnpj)}${projeto.filial_cnpj ? ` · filial ${esc(projeto.filial_cnpj)}` : ""}</p>
        </div>
      </section>
      <section class="stats">
        <div><strong>${esc(money(projeto.valor_estimado_brl))}</strong><span>Valor estimado${projeto.fonte_valor ? ` · ${esc(projeto.fonte_valor)}` : ""}</span></div>
        <div><strong>${esc(local(projeto.uf, projeto.municipio) || "—")}</strong><span>Local</span></div>
        <div><strong>${timeline.length}</strong><span>Evidências</span></div>
        <div><strong>${esc(dia(projeto.data_anuncio))}</strong><span>Anúncio</span></div>
      </section>
      <div class="detail-grid">
        <section><h2>Linha do tempo</h2>${projeto.objeto ? `<p>${esc(projeto.objeto)}</p>` : ""}<div class="evidence-list">${itens}</div></section>
        <aside>
          <form class="form-card compact" method="post" action="/monitoramento/projetos/${projeto.id}/excluir" onsubmit="return confirm('Excluir este projeto e as ${timeline.length} evidência(s) dele? A ação não pode ser desfeita.')">
            <h2>Excluir projeto</h2>
            <p class="muted">Apaga o projeto, os vínculos e as notícias que só pertenciam a ele.</p>
            <button class="button button--danger" type="submit">Excluir projeto</button>
          </form>
        </aside>
      </div>`,
  });
}

const uuid = z.string().uuid();
const vazioParaNull = (valor) => (valor === "" ? null : valor);

const projetoSchema = z.object({
  titulo: z.string().trim().min(3).max(200),
  matriz_cnpj: z.string().regex(/^\d{14}$/),
  filial_cnpj: z.preprocess(vazioParaNull, z.string().regex(/^\d{14}$/).nullable()),
  uf: z.preprocess(vazioParaNull, z.string().trim().length(2).transform((v) => v.toUpperCase()).nullable()),
  municipio: z.preprocess(vazioParaNull, z.string().trim().max(120).nullable()),
  objeto: z.preprocess(vazioParaNull, z.string().trim().max(500).nullable()),
  valor_estimado_brl: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(String(v).replace(/\./g, "").replace(",", "."))),
    z.number().nonnegative().nullable(),
  ),
  estagio: z.enum(ESTAGIOS),
  data_anuncio: z.preprocess(vazioParaNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
});

function voltar(res, caminho, mensagem) {
  res.redirect(`${caminho}?message=${encodeURIComponent(mensagem)}`);
}

function registrarMonitoramento(app) {
  app.get("/monitoramento", async (req, res) => {
    const grupos = await painel.resumoGrupos();
    const grupo = uuid.safeParse(req.query.grupo).success ? req.query.grupo : null;
    // Sem filtro escolhido, abre em "A revisar"; se não houver nada para revisar, em "Todas".
    const aRevisar = grupos.filter((g) => !grupo || g.id === grupo).reduce((total, g) => total + g.revisar, 0);
    const filtros = {
      grupo,
      situacao: painel.SITUACOES[req.query.situacao] ? req.query.situacao : aRevisar ? "revisar" : "todas",
    };
    const [noticias, projetos] = await Promise.all([
      painel.listarNoticias({ grupoId: filtros.grupo, situacao: filtros.situacao }),
      painel.carteira(),
    ]);
    res.send(paginaMonitoramento({ grupos, noticias, filtros, totalProjetos: projetos.length, notice: aviso(req) }));
  });

  app.get("/monitoramento/carteira", async (req, res) => {
    res.send(paginaCarteira({ projetos: await painel.carteira(), notice: aviso(req) }));
  });

  app.get("/monitoramento/noticias/:id", async (req, res) => {
    const dados = await painel.obterNoticia(uuid.parse(req.params.id));
    if (!dados) return res.status(404).send("Notícia não encontrada");
    res.send(paginaNoticia({ ...dados, notice: aviso(req) }));
  });

  app.post("/monitoramento/noticias/:id/projeto", async (req, res) => {
    const id = uuid.parse(req.params.id);
    const projeto = await painel.criarProjetoDaNoticia(id, projetoSchema.parse(req.body));
    voltar(res, `/monitoramento/projetos/${projeto.id}`, `Projeto "${projeto.titulo}" criado com a notícia como evidência primária.`);
  });

  app.post("/monitoramento/noticias/:id/vincular", async (req, res) => {
    const id = uuid.parse(req.params.id);
    await painel.vincularNoticia(id, uuid.parse(req.body.projeto_id));
    voltar(res, `/monitoramento/noticias/${id}`, "Notícia vinculada ao projeto.");
  });

  app.post("/monitoramento/noticias/:id/rejeitar", async (req, res) => {
    const id = uuid.parse(req.params.id);
    await painel.rejeitarSugestao(id, uuid.parse(req.body.projeto_id));
    voltar(res, `/monitoramento/noticias/${id}`, "Sugestão rejeitada.");
  });

  app.post("/monitoramento/noticias/:id/descartar", async (req, res) => {
    const id = uuid.parse(req.params.id);
    await painel.descartarNoticia(id, String(req.body.motivo || "").trim().slice(0, 200));
    voltar(res, "/monitoramento", "Notícia descartada.");
  });

  app.get("/monitoramento/projetos/:id", async (req, res) => {
    const dados = await painel.obterProjeto(uuid.parse(req.params.id));
    if (!dados) return res.status(404).send("Projeto não encontrado");
    res.send(paginaProjeto({ ...dados, notice: aviso(req) }));
  });

  app.post("/monitoramento/projetos/:id/excluir", async (req, res) => {
    const excluido = await painel.excluirProjeto(uuid.parse(req.params.id));
    if (!excluido) return res.status(404).send("Projeto não encontrado");
    voltar(res, "/monitoramento/carteira", `Projeto "${excluido.titulo}" excluído com ${excluido.evidencias} notícia(s).`);
  });

  app.post("/monitoramento/grupos/:id/triar", async (req, res) => {
    const id = uuid.parse(req.params.id);
    const ia = iaPadrao();
    if (!ia) return voltar(res, "/monitoramento", "CLAUDE_API_KEY não configurada: a triagem precisa da IA.");
    const client = await pool.connect();
    let mensagem;
    try {
      const grupo = (await carregarGrupos(client)).find((g) => g.id === id);
      if (!grupo) return res.status(404).send("Empresa não encontrada");
      const r = await triarGrupo({ client, grupo, ia, limite: LIMITE_TRIAGEM });
      mensagem = `${grupo.nome}: ${r.lidas} notícias lidas · ${r.capex} de CapEx · ${r.ia_descartadas + r.regras} descartadas`
        + `${r.erros_ia ? ` · ${r.erros_ia} lote(s) com erro da IA` : ""}.`;
    } finally {
      client.release();
    }
    res.redirect(`/monitoramento?${new URLSearchParams({ grupo: id, message: mensagem })}`);
  });
}

module.exports = {
  registrarMonitoramento,
  situacaoNoticia,
  resumoExtracao,
  projetoSchema,
  paginaMonitoramento,
  paginaNoticia,
  paginaCarteira,
  paginaProjeto,
};
