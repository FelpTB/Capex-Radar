// Tela de Monitoramento (capex_radar, Fases 4 e 5): notícias das 38 empresas,
// revisão direto no card, triagem da IA com progresso, transparência das
// buscas e carteira de projetos.
//
// As ações de revisão respondem JSON quando o pedido vem do script da tela
// (public/monitoramento.js): o card é redesenhado no lugar, sem recarregar a
// página nem perder a posição. Sem script, os formulários funcionam com
// redirecionamento comum.
const { z } = require("zod");
const painel = require("./capex-painel-db");
const { pool } = require("./db");
const { lerRss, noticiasDoRss, chaveDedupe, carregarGrupos } = require("./capex-coletor");
const { buscaDoGrupo } = require("./capex-busca");
const { googleNewsUrl } = require("./news-queries");
const { ESTAGIOS, iaPadrao } = require("./capex-ia");
const triagem = require("./capex-triagem-jobs");
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

const MOTIVOS_DESCARTE = [
  "não é CapEx",
  "outra empresa ou homônimo",
  "resultado financeiro ou mercado",
  "notícia repetida",
  "fora do Brasil",
  "ativo já em operação, sem obra",
];

const SCRIPT = '<script src="/monitoramento.js" defer></script>';

function dia(valor) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(valor));
}

function diaHora(valor) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(valor));
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
  const aba = (chave, href, rotulo) => `<a class="${ativa === chave ? "active" : ""}" href="${href}">${rotulo}</a>`;
  return `<nav class="view-tabs">
    ${aba("noticias", "/monitoramento", "Notícias")}
    ${aba("buscas", "/monitoramento/buscas", "Buscas")}
    ${aba("carteira", "/monitoramento/carteira", `Carteira (${totalProjetos})`)}
  </nav>`;
}

// Ações do card: aprovar e descartar com motivo, ou desfazer o descarte.
function acoesCard(noticia) {
  const base = `/monitoramento/noticias/${noticia.id}`;
  if (noticia.triagem === "vinculada") {
    return `<div class="news-card__done">${badge("aprovada", "success")} <a href="${base}">ver vínculos →</a></div>`;
  }
  if (noticia.triagem === "descartada") {
    return `<div class="news-card__done">
      <span class="muted">${esc(noticia.triagem_motivo || "Descartada")}</span>
      <form class="js-acao" method="post" action="${base}/restaurar">
        <button class="link-button link-button--neutral" type="submit">Desfazer</button>
      </form>
    </div>`;
  }
  const aprovar = noticia.sugerido_projeto_id ? "Aceitar vínculo" : "Aprovar como projeto";
  return `<div class="news-card__actions">
    <form class="js-acao" method="post" action="${base}/aprovar">
      <button class="button button--small" type="submit">${aprovar}</button>
    </form>
    <form class="js-acao news-card__discard" method="post" action="${base}/descartar">
      <select name="motivo" aria-label="Motivo do descarte">${selectOptions(MOTIVOS_DESCARTE.map((m) => [m, m]))}</select>
      <input name="detalhe" placeholder="observação (opcional)" maxlength="160" aria-label="Observação do descarte">
      <button class="button button--small button--danger" type="submit">Descartar</button>
    </form>
  </div>`;
}

function cardNoticia(noticia) {
  const situacao = situacaoNoticia(noticia);
  const ex = noticia.extracao;
  const leitura = ex?.capex ? resumoExtracao(ex) : "";
  const motivoIa = ex?.motivo && noticia.triagem !== "descartada" ? ex.motivo : "";
  const sugestao = noticia.sugerido_projeto
    ? `<p class="news-card__hint">Mesmo projeto que <strong>${esc(noticia.sugerido_projeto)}</strong>${noticia.sugerido_confianca != null ? ` (${noticia.sugerido_confianca}%)` : ""}</p>`
    : "";
  const titulo = noticia.url
    ? `<a href="${esc(noticia.url)}" target="_blank" rel="noopener">${esc(noticia.titulo)}</a>`
    : esc(noticia.titulo);
  return `<article class="news-card news-card--${esc(noticia.triagem)}" id="noticia-${noticia.id}" data-id="${noticia.id}">
    <div class="news-card__meta">
      ${badge(situacao.rotulo, situacao.tipo)}
      <span>${esc(dia(noticia.data_original))}</span>
      <span>${esc(noticia.veiculo || "")}</span>
      <a href="/monitoramento?${esc(new URLSearchParams({ grupo: noticia.grupo_id }).toString())}">${esc(noticia.grupo)}</a>
      <a class="news-card__more" href="/monitoramento/noticias/${noticia.id}">detalhes</a>
    </div>
    <h3 class="news-card__title">${titulo}</h3>
    ${leitura ? `<p class="news-card__reading">${esc(leitura)}</p>` : ""}
    ${motivoIa ? `<p class="news-card__why">IA: ${esc(motivoIa)}</p>` : ""}
    ${sugestao}
    ${acoesCard(noticia)}
  </article>`;
}

function barraTriagem(job) {
  const ativo = job && job.status === "rodando";
  return `<section class="triage-progress${ativo ? "" : " is-hidden"}" id="triagem-progresso" data-job="${ativo ? job.id : ""}" aria-live="polite">
    <div class="triage-progress__head">
      <strong>Triagem da IA</strong>
      <span class="js-triagem-texto">${ativo ? `${job.feitas} de ${job.total} · ${esc(job.grupo_atual || job.escopo)}` : ""}</span>
    </div>
    <div class="progress"><div class="progress__bar js-triagem-barra" style="width:${ativo ? job.percentual : 0}%"></div></div>
  </section>`;
}

function linhaGrupo(grupo) {
  const triar = grupo.nao_triadas
    ? `<button class="button button--small button--secondary js-triar" type="button" data-grupo="${grupo.id}">Triar ${grupo.nao_triadas}</button>`
    : "";
  return `<tr>
    <td><strong><a href="/monitoramento?${esc(new URLSearchParams({ grupo: grupo.id }).toString())}">${esc(grupo.nome)}</a></strong></td>
    <td>${esc(NICHOS[grupo.nicho] || grupo.nicho)}</td>
    <td>${grupo.total}</td>
    <td>${grupo.nao_triadas}</td>
    <td>${grupo.revisar ? `<strong>${grupo.revisar}</strong>` : 0}</td>
    <td>${grupo.projetos}</td>
    <td><a href="/monitoramento/buscas?${esc(new URLSearchParams({ grupo: grupo.id }).toString())}">${esc(dia(grupo.ultima_coleta))}</a></td>
    <td>${triar}</td>
  </tr>`;
}

function contagens(grupos) {
  const soma = (campo) => grupos.reduce((total, g) => total + g[campo], 0);
  return { total: soma("total"), revisar: soma("revisar"), nao_triadas: soma("nao_triadas") };
}

function paginaMonitoramento({ grupos, noticias, filtros, totalProjetos, notice, job = null }) {
  const c = contagens(grupos);
  const grupoOpcoes = [["", "Todas as empresas"], ...grupos.map((g) => [g.id, g.nome])];
  const situacaoOpcoes = Object.entries(painel.SITUACOES);
  const listagem = noticias.length
    ? noticias.map(cardNoticia).join("")
    : `<div class="empty"><h2>Nenhuma notícia neste filtro</h2><p>Troque a empresa ou a situação acima.</p></div>`;
  const triarTodas = c.nao_triadas
    ? `<button class="button js-triar" type="button" data-grupo="">Triar ${c.nao_triadas} sem triagem</button>`
    : "";
  return layout({
    title: "Monitoramento",
    active: "monitoramento",
    scripts: SCRIPT,
    body: `
      ${notice}
      <section class="page-heading">
        <div>
          <p class="eyebrow">Teste de monitoramento · ${grupos.length} empresas</p>
          <h1>Monitoramento</h1>
          <p>Aprove ou descarte direto no card. A IA sugere; a decisão é sua.</p>
        </div>
        ${triarTodas}
      </section>
      ${abas("noticias", totalProjetos)}
      ${barraTriagem(job)}
      <section class="stats">
        <div><strong data-stat="total">${c.total}</strong><span>Notícias coletadas</span></div>
        <div><strong data-stat="revisar">${c.revisar}</strong><span>A revisar</span></div>
        <div><strong data-stat="nao_triadas">${c.nao_triadas}</strong><span>Sem triagem da IA</span></div>
        <div><strong data-stat="projetos">${totalProjetos}</strong><span>Projetos na carteira</span></div>
      </section>
      <form class="source-filters js-filtros" method="get" action="/monitoramento">
        <div><label>Empresa</label><select name="grupo">${selectOptions(grupoOpcoes, filtros.grupo || "")}</select></div>
        <div><label>Situação</label><select name="situacao">${selectOptions(situacaoOpcoes, filtros.situacao)}</select></div>
        <div class="source-filters__actions"><noscript><button class="button button--small" type="submit">Filtrar</button></noscript></div>
        <p class="source-filters__count muted">${noticias.length} notícia(s) neste filtro${noticias.length >= 150 ? " (as 150 mais recentes)" : ""}.</p>
      </form>
      <section class="news-list" id="noticias">${listagem}</section>
      <section class="capture-group monitor-groups">
        <h2>Empresas</h2>
        <p>A data da última coleta leva ao histórico de buscas da empresa.</p>
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
    return `<section class="form-card compact"><h2>Leitura da IA</h2><p class="muted">Ainda sem triagem. Use "Triar" na lista de empresas.</p></section>`;
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
         <label>Motivo</label><select name="motivo">${selectOptions(MOTIVOS_DESCARTE.map((m) => [m, m]))}</select>
         <label>Observação</label><input name="detalhe" maxlength="160">
         <button class="button button--danger" type="submit">Descartar notícia</button>
       </form>`;
  return layout({
    title: noticia.titulo,
    active: "monitoramento",
    scripts: SCRIPT,
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

// ---------------------------------------------------------------------------
// Buscas: o que foi consultado, o que voltou e por quê
// ---------------------------------------------------------------------------

function explicarJanela(j) {
  if (j.status === "erro") {
    return /503|429/.test(j.erro || "")
      ? "O Google recusou o servidor (bloqueio temporário). A janela volta para a fila."
      : `Erro na leitura: ${j.erro || "sem detalhe"}.`;
  }
  if (j.status === "subdividida") return "Chegou ao teto do RSS (~100 itens) e foi refeita mês a mês.";
  if (!j.itens) return "O Google não devolveu nenhuma matéria com os termos e o contexto nesse período.";
  if (!j.novos) return "Todas as matérias já estavam guardadas por uma busca anterior.";
  return `${j.novos} matéria(s) nova(s) guardada(s).`;
}

function badgeJanela(status) {
  if (status === "ok") return badge("ok", "success");
  if (status === "subdividida") return badge("subdividida", "info");
  return badge(status, "danger");
}

function paginaBuscas({ grupos, historico, consultaAtual, totalProjetos }) {
  const grupoOpcoes = grupos.map((g) => [g.id, g.nome]);
  if (!historico) {
    return layout({ title: "Buscas", active: "monitoramento", scripts: SCRIPT, body: `<div class="empty"><h2>Empresa não encontrada</h2></div>` });
  }
  const { grupo, termos, janelas } = historico;
  const tipoBadge = { marca: "success", razao_social: "info", variacao: "neutral", exclusao: "danger" };
  const termosHtml = termos.length
    ? termos.map((t) => `${badge(`${t.tipo.replace("_", " ")}: ${t.termo}`, t.ativo ? tipoBadge[t.tipo] : "neutral")}`).join(" ")
    : `<span class="muted">Sem termos ativos: o grupo não entra na coleta.</span>`;
  const linhas = janelas.map((j) => `
    <tr>
      <td>${esc(dia(j.desde))} a ${esc(dia(j.ate))}</td>
      <td>${badgeJanela(j.status)}</td>
      <td>${j.itens}</td>
      <td>${j.novos}</td>
      <td>${j.guardadas}</td>
      <td>${esc(explicarJanela(j))}</td>
      <td>${esc(diaHora(j.coletado_em))}</td>
      <td>
        <details class="js-janela" data-grupo="${grupo.id}" data-desde="${j.desde}" data-ate="${j.ate}">
          <summary>ver</summary>
          <p class="mono">${esc(j.consulta)}</p>
          <div class="js-janela-noticias muted">Carregando…</div>
        </details>
      </td>
    </tr>`).join("");
  const resumo = janelas.reduce((r, j) => {
    r.itens += j.itens; r.novos += j.novos; r[j.status] = (r[j.status] || 0) + 1; return r;
  }, { itens: 0, novos: 0 });
  return layout({
    title: `Buscas · ${grupo.nome}`,
    active: "monitoramento",
    scripts: SCRIPT,
    body: `
      <section class="page-heading">
        <div>
          <p class="eyebrow">Transparência da coleta</p>
          <h1>Buscas de ${esc(grupo.nome)}</h1>
          <p>O que foi perguntado ao Google News, o que voltou e por que uma janela veio vazia.</p>
        </div>
      </section>
      ${abas("buscas", totalProjetos)}
      <form class="source-filters js-filtros" method="get" action="/monitoramento/buscas">
        <div><label>Empresa</label><select name="grupo">${selectOptions(grupoOpcoes, grupo.id)}</select></div>
        <div class="source-filters__actions"><noscript><button class="button button--small" type="submit">Ver</button></noscript></div>
      </form>
      <section class="stats">
        <div><strong>${janelas.length}</strong><span>Janelas consultadas</span></div>
        <div><strong>${resumo.itens}</strong><span>Matérias devolvidas</span></div>
        <div><strong>${resumo.novos}</strong><span>Guardadas como novas</span></div>
        <div><strong>${resumo.erro || 0}</strong><span>Janelas com erro</span></div>
      </section>
      <section class="form-card compact search-recipe">
        <h2>Como a consulta é montada</h2>
        <p class="muted">(termos da empresa com OR) + (pelo menos uma palavra de contexto do ${esc(NICHOS[grupo.nicho] || grupo.nicho)}) − exclusões + período</p>
        <p>${termosHtml}</p>
        <p class="muted">Contexto: ${esc(consultaAtual.contexto.join(", "))}</p>
        <p class="mono">${esc(consultaAtual.consulta)}</p>
        <p class="inline-actions">
          <a class="button button--small button--secondary" href="${esc(googleNewsUrl(consultaAtual.consulta))}" target="_blank" rel="noopener">Abrir no Google News ↗</a>
        </p>
      </section>
      <form class="form-card compact js-testar" method="get" action="/monitoramento/buscas/testar">
        <h2>Testar a busca agora</h2>
        <p class="muted">Lê o RSS ao vivo, sem gravar nada, e mostra o que voltou e o que já estava guardado.</p>
        <input type="hidden" name="grupo" value="${grupo.id}">
        <div class="inline-fields">
          <div><label>De</label><input type="date" name="desde" value="${esc(consultaAtual.desde)}"></div>
          <div><label>Até</label><input type="date" name="ate" value="${esc(consultaAtual.ate)}"></div>
          <div class="inline-fields__action"><button class="button button--small" type="submit">Testar</button></div>
        </div>
        <div class="js-testar-resultado"></div>
      </form>
      <section class="capture-group">
        <h2>Histórico de janelas</h2>
        ${janelas.length
          ? `<div class="table-wrap"><table class="table-compact">
              <thead><tr><th>Período</th><th>Status</th><th>Devolvidas</th><th>Novas</th><th>Guardadas no período</th><th>Leitura</th><th>Quando</th><th>Consulta</th></tr></thead>
              <tbody>${linhas}</tbody>
            </table></div>`
          : `<div class="empty"><h2>Nenhuma busca ainda</h2><p>A coleta semanal ou a carga histórica ainda não passou por esta empresa.</p></div>`}
      </section>`,
  });
}

function listaCurtaNoticias(noticias, guardadas = new Set()) {
  if (!noticias.length) return `<p class="muted">Nenhuma matéria.</p>`;
  return `<ul class="mini-list">${noticias.map((n) => {
    const marca = n.triagem
      ? badge(situacaoNoticia(n).rotulo, situacaoNoticia(n).tipo)
      : guardadas.has(n.chave) ? badge("já guardada", "neutral") : badge("nova", "info");
    const titulo = n.url ? `<a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.titulo)}</a>` : esc(n.titulo);
    return `<li>${marca} <span class="muted">${esc(dia(n.data_original || n.publicado_em))} · ${esc(n.veiculo || "")}</span><br>${titulo}</li>`;
  }).join("")}</ul>`;
}

// ---------------------------------------------------------------------------
// Carteira e projeto
// ---------------------------------------------------------------------------

const STATUS_ROTULO = { ativo: "Ativo", em_revisao: "Em revisão", descartado: "Descartado" };

// Faixas de valor estimado (R$). "sem" pega os projetos sem valor informado.
const FAIXAS_VALOR = {
  sem: { rotulo: "Sem valor informado", teste: (v) => v == null },
  ate100m: { rotulo: "Até R$ 100 mi", teste: (v) => v != null && v < 1e8 },
  "100m": { rotulo: "R$ 100 mi a 500 mi", teste: (v) => v != null && v >= 1e8 && v < 5e8 },
  "500m": { rotulo: "R$ 500 mi a 1 bi", teste: (v) => v != null && v >= 5e8 && v < 1e9 },
  "1b": { rotulo: "R$ 1 bi ou mais", teste: (v) => v != null && v >= 1e9 },
};

const ORDENS = {
  recentes: { rotulo: "Evidência mais recente", chave: (p) => -tempo(p.ultima_evidencia_em || p.criado_em) },
  valor: { rotulo: "Maior valor", chave: (p) => -(p.valor_estimado_brl == null ? -1 : Number(p.valor_estimado_brl)) },
  anuncio: { rotulo: "Anúncio mais recente", chave: (p) => -tempo(dataDoAnuncio(p)) },
  evidencias: { rotulo: "Mais evidências", chave: (p) => -(p.n_evidencias || 0) },
};

function tempo(valor) {
  return valor ? new Date(valor).getTime() : 0;
}

// Data do projeto: a do anúncio ou, sem ela, a da primeira evidência.
function dataDoAnuncio(p) {
  return p.data_anuncio || p.primeira_evidencia_em || null;
}

function anoDoProjeto(p) {
  const d = dataDoAnuncio(p);
  return d ? String(new Date(d).getUTCFullYear()) : "";
}

// Lê os filtros da query string, aceitando só valores conhecidos.
function filtrosCarteira(query = {}) {
  const texto = (v) => (typeof v === "string" ? v.trim() : "");
  return {
    grupo: uuid.safeParse(query.grupo).success ? query.grupo : "",
    nicho: NICHOS[query.nicho] ? query.nicho : "",
    uf: /^[A-Za-z]{2}$/.test(texto(query.uf)) ? texto(query.uf).toUpperCase() : "",
    estagio: ESTAGIO_ROTULO[query.estagio] ? query.estagio : "",
    status: STATUS_ROTULO[query.status] || query.status === "todos" ? query.status : "",
    valor: FAIXAS_VALOR[query.valor] ? query.valor : "",
    ano: /^\d{4}$/.test(texto(query.ano)) ? texto(query.ano) : "",
    ordem: ORDENS[query.ordem] ? query.ordem : "recentes",
  };
}

// Aplica os filtros e a ordem. Sem situação escolhida, mostra ativos e em revisão.
function filtrarCarteira(projetos, f) {
  const lista = projetos.filter((p) =>
    (!f.grupo || p.grupo_id === f.grupo)
    && (!f.nicho || p.nicho === f.nicho)
    && (!f.uf || p.uf === f.uf)
    && (!f.estagio || p.estagio === f.estagio)
    && (f.status === "todos" || (f.status ? p.status === f.status : p.status !== "descartado"))
    && (!f.valor || FAIXAS_VALOR[f.valor].teste(p.valor_estimado_brl == null ? null : Number(p.valor_estimado_brl)))
    && (!f.ano || anoDoProjeto(p) === f.ano));
  const chave = ORDENS[f.ordem || "recentes"].chave;
  return lista.sort((a, b) => chave(a) - chave(b));
}

function cardProjeto(p) {
  return `
      <article class="project-card">
        <div class="project-card__top">
          ${badge(ESTAGIO_ROTULO[p.estagio] || p.estagio, p.estagio === "cancelado" ? "danger" : p.estagio === "operacao" ? "success" : "info")}
          ${p.status && p.status !== "ativo" ? badge(STATUS_ROTULO[p.status] || p.status, p.status === "descartado" ? "danger" : "warning") : ""}
          <span class="muted">${esc(NICHOS[p.nicho] || p.nicho)}</span>
        </div>
        <h2><a href="/monitoramento/projetos/${p.id}">${esc(p.titulo)}</a></h2>
        <p class="project-card__company">${esc(p.grupo)} · ${esc(p.matriz_razao_social)}</p>
        <dl class="facts">
          <div><dt>Local</dt><dd>${esc(local(p.uf, p.municipio) || "—")}</dd></div>
          <div><dt>Valor</dt><dd>${esc(money(p.valor_estimado_brl))}</dd></div>
          <div><dt>Evidências</dt><dd>${p.n_evidencias || 0}</dd></div>
          <div><dt>Anúncio</dt><dd>${esc(dia(dataDoAnuncio(p)))}</dd></div>
        </dl>
        <div class="card-actions">
          <span class="muted">Última evidência: ${esc(dia(p.ultima_evidencia_em))}</span>
          <a href="/monitoramento/projetos/${p.id}">Linha do tempo →</a>
        </div>
      </article>`;
}

// `projetos` é a carteira inteira (com descartados); os filtros são aplicados aqui,
// e as opções de empresa, UF e ano saem dos próprios projetos.
function paginaCarteira({ projetos, filtros = filtrosCarteira(), notice = "" }) {
  const visiveis = filtrarCarteira([...projetos], filtros);
  const naCarteira = projetos.filter((p) => p.status !== "descartado").length;
  const unicos = (lista) => [...new Set(lista.filter(Boolean))];
  const empresas = new Map(projetos.map((p) => [p.grupo_id, p.grupo]));
  const opcoes = {
    grupo: [["", "Todas"], ...[...empresas].sort((a, b) => String(a[1]).localeCompare(String(b[1]), "pt-BR"))],
    nicho: [["", "Todos"], ...Object.entries(NICHOS)],
    uf: [["", "Todas"], ...unicos(projetos.map((p) => p.uf)).sort().map((uf) => [uf, uf])],
    estagio: [["", "Todos"], ...Object.entries(ESTAGIO_ROTULO)],
    status: [["", "Ativos e em revisão"], ...Object.entries(STATUS_ROTULO), ["todos", "Todos"]],
    valor: [["", "Qualquer valor"], ...Object.entries(FAIXAS_VALOR).map(([k, v]) => [k, v.rotulo])],
    ano: [["", "Todos"], ...unicos(projetos.map(anoDoProjeto)).sort().reverse().map((a) => [a, a])],
    ordem: Object.entries(ORDENS).map(([k, v]) => [k, v.rotulo]),
  };
  const campo = (nome, rotulo) => `<div><label>${rotulo}</label><select name="${nome}">${selectOptions(opcoes[nome], filtros[nome] || "")}</select></div>`;
  const algumFiltro = ["grupo", "nicho", "uf", "estagio", "status", "valor", "ano"].some((k) => filtros[k]);
  const somaValor = visiveis.reduce((t, p) => t + (p.valor_estimado_brl == null ? 0 : Number(p.valor_estimado_brl)), 0);
  const filtrosHtml = projetos.length ? `
      <form class="source-filters js-filtros" method="get" action="/monitoramento/carteira">
        ${campo("grupo", "Empresa")}
        ${campo("nicho", "Nicho")}
        ${campo("uf", "UF")}
        ${campo("estagio", "Estágio")}
        ${campo("status", "Situação")}
        ${campo("valor", "Valor estimado")}
        ${campo("ano", "Ano do anúncio")}
        ${campo("ordem", "Ordenar por")}
        <div class="source-filters__actions"><noscript><button class="button button--small" type="submit">Filtrar</button></noscript>${algumFiltro ? '<a href="/monitoramento/carteira">Limpar filtros</a>' : ""}</div>
        <p class="source-filters__count muted">${visiveis.length} projeto(s) neste filtro${somaValor ? ` · ${esc(money(somaValor))} em valor estimado` : ""}.</p>
      </form>` : "";
  let cards;
  if (visiveis.length) cards = visiveis.map(cardProjeto).join("");
  else if (projetos.length) cards = `<div class="empty"><h2>Nenhum projeto neste filtro</h2><p>Troque ou limpe os filtros acima.</p><a class="button" href="/monitoramento/carteira">Limpar filtros</a></div>`;
  else cards = `<div class="empty"><h2>Nenhum projeto ainda</h2><p>Aprove uma notícia na lista para criar o primeiro.</p><a class="button" href="/monitoramento">Ver notícias</a></div>`;
  return layout({
    title: "Carteira",
    active: "monitoramento",
    scripts: SCRIPT,
    body: `
      ${notice}
      <section class="page-heading">
        <div><p class="eyebrow">Teste de monitoramento</p><h1>Carteira de projetos</h1><p>Projetos aprovados na revisão das notícias, com a linha do tempo das evidências aceitas.</p></div>
      </section>
      ${abas("carteira", naCarteira)}
      ${filtrosHtml}
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
    scripts: SCRIPT,
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

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

const uuid = z.string().uuid();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
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

function querJson(req) {
  return (req.get("accept") || "").includes("application/json");
}

function motivoDescarte(body) {
  const motivo = String(body.motivo || "").trim().slice(0, 80) || "não é projeto";
  const detalhe = String(body.detalhe || "").trim().slice(0, 160);
  return detalhe ? `${motivo} — ${detalhe}` : motivo;
}

// Responde à ação do card: JSON com o card novo e os números, ou redirecionamento.
async function responderAcao(req, res, id, mensagem, destino) {
  if (!querJson(req)) {
    return res.redirect(`${destino}?message=${encodeURIComponent(mensagem)}`);
  }
  const [noticia, grupos, projetos] = await Promise.all([
    painel.noticiaDoCard(id),
    painel.resumoGrupos(),
    painel.carteira(),
  ]);
  res.json({
    ok: true,
    mensagem,
    card: noticia ? cardNoticia(noticia) : "",
    contagens: { ...contagens(grupos), projetos: projetos.length },
  });
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
    res.send(paginaMonitoramento({
      grupos, noticias, filtros, totalProjetos: projetos.length, notice: aviso(req), job: triagem.triagemAtiva(),
    }));
  });

  app.get("/monitoramento/carteira", async (req, res) => {
    res.send(paginaCarteira({
      projetos: await painel.carteira({ incluirDescartados: true }),
      filtros: filtrosCarteira(req.query),
      notice: aviso(req),
    }));
  });

  app.get("/monitoramento/noticias/:id", async (req, res) => {
    const dados = await painel.obterNoticia(uuid.parse(req.params.id));
    if (!dados) return res.status(404).send("Notícia não encontrada");
    res.send(paginaNoticia({ ...dados, notice: aviso(req) }));
  });

  app.post("/monitoramento/noticias/:id/aprovar", async (req, res) => {
    const id = uuid.parse(req.params.id);
    try {
      const r = await painel.aprovarNoticia(id);
      const mensagem = r.acao === "projeto_criado"
        ? `Projeto "${r.projeto_titulo}" criado.`
        : "Notícia vinculada ao projeto sugerido.";
      await responderAcao(req, res, id, mensagem, "/monitoramento");
    } catch (error) {
      if (!querJson(req)) throw error;
      res.status(422).json({ ok: false, mensagem: error.message });
    }
  });

  app.post("/monitoramento/noticias/:id/projeto", async (req, res) => {
    const id = uuid.parse(req.params.id);
    const projeto = await painel.criarProjetoDaNoticia(id, projetoSchema.parse(req.body));
    res.redirect(`/monitoramento/projetos/${projeto.id}?message=${encodeURIComponent(`Projeto "${projeto.titulo}" criado com a notícia como evidência primária.`)}`);
  });

  app.post("/monitoramento/noticias/:id/vincular", async (req, res) => {
    const id = uuid.parse(req.params.id);
    await painel.vincularNoticia(id, uuid.parse(req.body.projeto_id));
    await responderAcao(req, res, id, "Notícia vinculada ao projeto.", `/monitoramento/noticias/${id}`);
  });

  app.post("/monitoramento/noticias/:id/rejeitar", async (req, res) => {
    const id = uuid.parse(req.params.id);
    await painel.rejeitarSugestao(id, uuid.parse(req.body.projeto_id));
    await responderAcao(req, res, id, "Sugestão rejeitada.", `/monitoramento/noticias/${id}`);
  });

  app.post("/monitoramento/noticias/:id/descartar", async (req, res) => {
    const id = uuid.parse(req.params.id);
    await painel.descartarNoticia(id, motivoDescarte(req.body));
    await responderAcao(req, res, id, "Notícia descartada.", "/monitoramento");
  });

  app.post("/monitoramento/noticias/:id/restaurar", async (req, res) => {
    const id = uuid.parse(req.params.id);
    await painel.restaurarNoticia(id);
    await responderAcao(req, res, id, "Descarte desfeito.", "/monitoramento");
  });

  app.get("/monitoramento/projetos/:id", async (req, res) => {
    const dados = await painel.obterProjeto(uuid.parse(req.params.id));
    if (!dados) return res.status(404).send("Projeto não encontrado");
    res.send(paginaProjeto({ ...dados, notice: aviso(req) }));
  });

  app.post("/monitoramento/projetos/:id/excluir", async (req, res) => {
    const excluido = await painel.excluirProjeto(uuid.parse(req.params.id));
    if (!excluido) return res.status(404).send("Projeto não encontrado");
    res.redirect(`/monitoramento/carteira?message=${encodeURIComponent(`Projeto "${excluido.titulo}" excluído com ${excluido.evidencias} notícia(s).`)}`);
  });

  // Triagem em segundo plano: inicia e consulta o andamento.
  app.post("/monitoramento/triagem", async (req, res) => {
    const grupoId = uuid.safeParse(req.body.grupo_id).success ? req.body.grupo_id : null;
    const ia = iaPadrao();
    if (!ia) return res.status(422).json({ ok: false, mensagem: "CLAUDE_API_KEY não configurada: a triagem precisa da IA." });
    res.json({ ok: true, job: await triagem.iniciarTriagem({ grupoId, ia }) });
  });

  app.get("/monitoramento/triagem/:id", (req, res) => {
    const job = triagem.obterTriagem(req.params.id);
    if (!job) return res.status(404).json({ ok: false, mensagem: "Triagem não encontrada (o app pode ter reiniciado)." });
    res.json({ ok: true, job });
  });

  // Buscas: histórico por empresa, notícias de uma janela e teste ao vivo.
  app.get("/monitoramento/buscas", async (req, res) => {
    const [grupos, projetos] = await Promise.all([painel.resumoGrupos(), painel.carteira()]);
    const grupoId = uuid.safeParse(req.query.grupo).success ? req.query.grupo : grupos[0]?.id;
    const historico = grupoId ? await painel.historicoBuscas(grupoId) : null;
    let consultaAtual = { consulta: "", contexto: [], desde: "", ate: "" };
    if (historico) {
      const client = await pool.connect();
      try {
        const grupo = (await carregarGrupos(client)).find((g) => g.id === grupoId);
        const hoje = new Date();
        const ate = new Date(hoje.getTime() + 86400000).toISOString().slice(0, 10);
        const desde = new Date(hoje.getTime() - 90 * 86400000).toISOString().slice(0, 10);
        if (grupo) {
          consultaAtual = { ...buscaDoGrupo({ linhas: grupo.linhas, contexto: grupo.contexto, desde, ate }), contexto: grupo.contexto, desde, ate };
        }
      } finally {
        client.release();
      }
    }
    res.send(paginaBuscas({ grupos, historico, consultaAtual, totalProjetos: projetos.length }));
  });

  app.get("/monitoramento/buscas/noticias", async (req, res) => {
    const noticias = await painel.noticiasDaJanela(uuid.parse(req.query.grupo), data.parse(req.query.desde), data.parse(req.query.ate));
    res.send(listaCurtaNoticias(noticias));
  });

  app.get("/monitoramento/buscas/testar", async (req, res) => {
    const grupoId = uuid.parse(req.query.grupo);
    const desde = data.parse(req.query.desde);
    const ate = data.parse(req.query.ate);
    const client = await pool.connect();
    let grupo;
    try {
      grupo = (await carregarGrupos(client)).find((g) => g.id === grupoId);
    } finally {
      client.release();
    }
    if (!grupo) return res.status(404).send(`<p class="error-text">Empresa sem termos de busca ativos.</p>`);
    const { consulta, url } = buscaDoGrupo({ linhas: grupo.linhas, contexto: grupo.contexto, desde, ate });
    let noticias;
    try {
      noticias = noticiasDoRss(await lerRss(url));
    } catch (error) {
      return res.send(`<div class="test-result">
        <p class="error-text">O Google não respondeu: ${esc(error.message)}. ${/503|429/.test(error.message) ? "É um bloqueio temporário do servidor; tente de novo mais tarde." : ""}</p>
        <p class="mono">${esc(consulta)}</p></div>`);
    }
    const chaves = noticias.map(chaveDedupe);
    const { rows } = await pool.query(
      "select chave_dedupe from capex_radar.evidencias where chave_dedupe = any($1::text[])",
      [chaves],
    );
    const guardadas = new Set(rows.map((r) => r.chave_dedupe));
    const itens = noticias.map((n) => ({ ...n, chave: chaveDedupe(n) }));
    const novas = itens.filter((n) => !guardadas.has(n.chave)).length;
    const explicacao = !itens.length
      ? "Nenhuma matéria: o Google não achou nada com os termos da empresa e pelo menos uma palavra de contexto nesse período. Tente um período maior ou revise os termos."
      : itens.length >= 90
        ? "Chegou perto do teto do RSS (~100): a coleta fatiaria este período em meses."
        : `${itens.length} matéria(s), ${novas} ainda não guardada(s).`;
    res.send(`<div class="test-result">
      <p><strong>${esc(explicacao)}</strong></p>
      <p class="mono">${esc(consulta)}</p>
      ${listaCurtaNoticias(itens, guardadas)}
    </div>`);
  });
}

module.exports = {
  registrarMonitoramento,
  situacaoNoticia,
  resumoExtracao,
  cardNoticia,
  explicarJanela,
  projetoSchema,
  paginaMonitoramento,
  paginaNoticia,
  paginaBuscas,
  paginaCarteira,
  filtrosCarteira,
  filtrarCarteira,
  paginaProjeto,
};
