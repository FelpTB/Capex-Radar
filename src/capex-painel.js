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
const filtroCapex = require("./capex-filtro");
const enriquecimento = require("./capex-enriquecimento");
const filtroFinal = require("./capex-filtro-final");
const avaliacaoProjetos = require("./capex-avaliacao-projetos");
const triagem = require("./capex-triagem-jobs");
const agente = require("./capex-agente");
const { esc, money, badge, selectOptions, layout } = require("./html");

const NICHOS = {
  papel_celulose: "Papel e Celulose",
  alimentos_bebidas: "Alimentos e Bebidas",
  ecommerce: "E-commerce",
  datacenter: "Datacenters",
  industria: "Indústria (outros setores)",
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

const OBRA_ROTULO = {
  por_fazer: "por fazer",
  em_andamento: "em andamento",
  concluida: "concluída",
  sem_obra: "sem obra",
  incerto: "incerta",
};

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
  if (noticia.em_processamento) return { rotulo: "em processamento", tipo: "neutral" };
  if (noticia.sugerido_projeto_id) return { rotulo: "vínculo sugerido", tipo: "info" };
  if (noticia.triagem === "novo_projeto") return { rotulo: "possível projeto", tipo: "warning" };
  if (noticia.extracao) return { rotulo: "a revisar", tipo: "warning" };
  return { rotulo: "sem triagem", tipo: "neutral" };
}

function local(uf, municipio) {
  return [municipio, uf].filter(Boolean).join(" / ");
}

// Local do projeto na carteira. Sem local do projeto nem filial, a view usa a
// sede da matriz, e isso fica dito para não parecer o local da obra.
function localProjeto(p) {
  const texto = local(p.uf, p.municipio);
  if (!texto) return "—";
  return p.local_origem === "matriz" ? `Sede: ${texto}` : texto;
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
    ${aba("evidencias", "/monitoramento/evidencias", "Evidências")}
    ${aba("agente", "/monitoramento/agente", "Agente")}
    ${aba("fontes", "/monitoramento/fontes", "Fontes")}
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
    <form class="js-acao" method="post" action="${base}/aprovar" data-carregando="Aprovando e incluindo na linha do tempo…">
      <button class="button button--small" type="submit">${aprovar}</button>
    </form>
    <form class="js-acao news-card__discard" method="post" action="${base}/descartar">
      <select name="motivo" aria-label="Motivo do descarte">${selectOptions(MOTIVOS_DESCARTE.map((m) => [m, m]))}</select>
      <input name="detalhe" placeholder="observação (opcional)" maxlength="160" aria-label="Observação do descarte">
      <button class="button button--small button--danger" type="submit">Descartar</button>
    </form>
  </div>`;
}

// O que o Enriquecimento achou no texto da matéria, e o veredito do Filtro 3.
function blocoEnriquecimento(noticia) {
  const en = noticia.enriquecimento;
  const f3 = noticia.filtro_final;
  if (!en && !f3) return "";
  const original = en?.url_original
    ? `<a href="${esc(en.url_original)}" target="_blank" rel="noopener">matéria original${en.veiculo_original ? ` (${esc(en.veiculo_original)})` : ""} ↗</a>`
    : en ? '<span class="muted">matéria original não encontrada</span>' : "";
  const p = en?.perfil || {};
  const extras = [
    p.obra ? `obra: ${OBRA_ROTULO[p.obra] || p.obra}` : null,
    p.capacidade, p.empregos ? `${p.empregos} empregos` : null,
    p.previsao_operacao ? `operação: ${p.previsao_operacao}` : null,
    p.construtora ? `construtora: ${p.construtora}` : null,
    p.financiamento ? `financiamento: ${p.financiamento}` : null,
  ].filter(Boolean).join(" · ");
  const veredito = f3?.justificativa && noticia.triagem !== "descartada" ? `<p class="news-card__why">Filtro 3: ${esc(f3.justificativa)}</p>` : "";
  return `<div class="news-card__enriched">
    ${en?.resumo ? `<p>${esc(en.resumo)}</p>` : ""}
    ${extras ? `<p class="muted">${esc(extras)}</p>` : ""}
    ${en?.observacao ? `<p class="news-card__why">Atenção: ${esc(en.observacao)}</p>` : ""}
    ${original ? `<p>${original}</p>` : ""}
    ${veredito}
  </div>`;
}

function cardNoticia(noticia) {
  const situacao = situacaoNoticia(noticia);
  const ex = noticia.extracao ? painel.leituraDaNoticia(noticia) : null;
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
    ${blocoEnriquecimento(noticia)}
    ${sugestao}
    ${linhaAgente(noticia)}
    ${acoesCard(noticia)}
  </article>`;
}

// Dropdown do card: as obras do projeto ligado, com nome, descrição curta, status e valor.

function blocoObrasDoCard(obras = []) {
  if (!obras.length) return `<details class="project-obras"><summary>Obras do projeto <span class="muted">· nenhuma ainda</span></summary><p class="muted">Nenhuma matrícula no CNO ligada ao projeto e nenhum subprojeto.</p></details>`;
  const m2 = (n) => `${Math.round(Number(n)).toLocaleString("pt-BR")} m²`;
  const linha = (o) => {
    if (o.tipo === "cno") {
      const situacao = CNO_SITUACAO[o.situacao] || o.situacao || "—";
      const campo = (rotulo, valor) => `<span><em>${rotulo}</em> ${esc(valor || "—")}</span>`;
      return `<li class="obra-item obra-item--cno">
          <div>
            <strong>${esc(String(o.nome || `CNO ${o.cno}`).slice(0, 90))}</strong> <span class="muted">CNO ${esc(o.cno || "")}</span>
            <div class="obra-item__campos">
              ${campo("Início", o.inicio ? dia(o.inicio) : null)}
              ${campo("Área", o.area ? m2(o.area) : null)}
              ${campo("Município", o.municipio)}
              ${campo("Categoria", [o.categoria, o.destinacao].filter(Boolean).join(" · "))}
            </div>
          </div>
          <div class="obra-item__status"><span>${badge(situacao, OBRA_TOM[situacao] || "neutral")}${ajudaObra(situacao)}</span></div>
        </li>`;
    }
    const rotulo = RELACAO_ROTULO[o.relacao] || "projeto ligado";
    return `<li class="obra-item${o.tipo === "filho" ? " obra-item--filho" : ""}">
        <div><a href="/monitoramento/projetos/${o.id}"><strong>${esc(o.titulo)}</strong></a> <span class="muted">${esc(rotulo)}</span><br><span class="muted">${esc(String(o.objeto || local(o.uf, o.municipio) || "").slice(0, 140))}</span></div>
        <div class="obra-item__status"><span>${badge(ESTAGIO_ROTULO[o.estagio] || o.estagio || "—", "info")}${ajudaEstagio(o.estagio)}</span><span>${esc(o.valor_estimado_brl == null ? "valor —" : money(o.valor_estimado_brl))}</span></div>
      </li>`;
  };
  const cnos = obras.filter((o) => o.tipo === "cno").length;
  const filhos = obras.length - cnos;
  const resumo = [cnos ? `${cnos} obra(s) no CNO` : null, filhos ? `${filhos} projeto(s) ligado(s)` : null].filter(Boolean).join(" · ");
  return `<details class="project-obras">
      <summary>Obras do projeto <span class="muted">· ${resumo}</span></summary>
      <ul>${obras.map(linha).join("")}</ul>
    </details>`;
}

function barraTriagem(job, rotulo = "Funil de notícias") {
  const ativo = job && job.status === "rodando";
  return `<section class="triage-progress${ativo ? "" : " is-hidden"}" id="triagem-progresso" data-job="${ativo ? job.id : ""}" aria-live="polite">
    <div class="triage-progress__head">
      <strong>${ativo && job.modo === "agente" ? "Agente" : rotulo}</strong>
      <span class="js-triagem-texto">${ativo ? `${job.feitas} de ${job.total} · ${esc(job.grupo_atual || job.escopo)}` : ""}</span>
    </div>
    <div class="progress"><div class="progress__bar js-triagem-barra" style="width:${ativo ? job.percentual : 0}%"></div></div>
  </section>`;
}

function linhaGrupo(grupo) {
  const naFila = grupo.nao_triadas + (grupo.processando || 0);
  const triar = naFila
    ? `<button class="button button--small button--secondary js-triar" type="button" data-grupo="${grupo.id}">Processar ${naFila}</button>`
    : "";
  return `<tr>
    <td><strong><a href="/monitoramento?${esc(new URLSearchParams({ grupo: grupo.id }).toString())}">${esc(grupo.nome)}</a></strong></td>
    <td>${esc(NICHOS[grupo.nicho] || grupo.nicho)}</td>
    <td>${grupo.total}</td>
    <td>${grupo.nao_triadas}</td>
    <td>${grupo.processando || 0}</td>
    <td>${grupo.revisar ? `<strong>${grupo.revisar}</strong>` : 0}</td>
    <td>${grupo.projetos}</td>
    <td><a href="/monitoramento/buscas?${esc(new URLSearchParams({ grupo: grupo.id }).toString())}">${esc(dia(grupo.ultima_coleta))}</a></td>
    <td>${triar}</td>
  </tr>`;
}

function contagens(grupos) {
  const soma = (campo) => grupos.reduce((total, g) => total + g[campo], 0);
  return { total: soma("total"), revisar: soma("revisar"), nao_triadas: soma("nao_triadas"), processando: soma("processando") };
}

function paginaMonitoramento({ grupos, noticias, filtros, totalProjetos, notice, job = null }) {
  const c = contagens(grupos);
  const grupoOpcoes = [["", "Todas as empresas"], ...grupos.map((g) => [g.id, g.nome])];
  const situacaoOpcoes = Object.entries(painel.SITUACOES);
  const listagem = noticias.length
    ? noticias.map(cardNoticia).join("")
    : `<div class="empty"><h2>Nenhuma notícia neste filtro</h2><p>Troque a empresa ou a situação acima.</p></div>`;
  const naFila = c.nao_triadas + (c.processando || 0);
  const triarTodas = naFila
    ? `<button class="button js-triar" type="button" data-grupo="">Processar ${naFila} no funil</button>`
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
          <p>Captação, Filtro 1, Filtro 2, Enriquecimento e Filtro 3 rodam antes; aqui chega só o que passou por todos. Aprove ou descarte direto no card.</p>
        </div>
        ${triarTodas}
      </section>
      ${abas("noticias", totalProjetos)}
      ${barraTriagem(job)}
      <section class="stats">
        <div><strong data-stat="total">${c.total}</strong><span>Notícias coletadas</span></div>
        <div><strong data-stat="revisar">${c.revisar}</strong><span>A revisar</span></div>
        <div><strong data-stat="nao_triadas">${c.nao_triadas}</strong><span>Sem triagem da IA</span></div>
        <div><strong data-stat="processando">${c.processando || 0}</strong><span>Em processamento</span></div>
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
          <thead><tr><th>Empresa</th><th>Nicho</th><th>Notícias</th><th>Sem triagem</th><th>Em processamento</th><th>A revisar</th><th>Projetos</th><th>Última coleta</th><th></th></tr></thead>
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
           <form method="post" action="/monitoramento/noticias/${noticia.id}/vincular" data-carregando="Aprovando e incluindo na linha do tempo…">
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
  return `<form class="form-card compact" method="post" action="/monitoramento/noticias/${noticia.id}/projeto" data-carregando="Criando o projeto e montando a linha do tempo…">
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
    ? `<form class="form-card compact" method="post" action="/monitoramento/noticias/${noticia.id}/vincular" data-carregando="Aprovando e incluindo na linha do tempo…">
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

// Explicação de cada status, mostrada no "?" ao passar o mouse.
const STATUS_AJUDA = {
  ativo: "Situação na carteira: projeto confirmado por uma pessoa. É o que aparece na carteira por padrão.",
  em_revisao: "Situação na carteira: criado pelo agente de IA a partir de uma notícia, falta a confirmação humana.",
  descartado: "Situação na carteira: tirado da carteira (inválido, duplicado ou sem obra). Reversível, com motivo.",
};
const ESTAGIO_AJUDA = {
  anuncio: "Status do projeto: investimento anunciado, ainda sem licença, financiamento ou obra.",
  licenciamento: "Status do projeto: licença ambiental (LP, LI, LO), outorga ou alvará em andamento ou concedida.",
  funding: "Status do projeto: financiamento contratado ou aprovado (BNDES, debêntures, FIDC, incentivo fiscal).",
  contratacao_epc: "Status do projeto: construtora ou EPC contratada, terreno comprado ou projeto executivo em curso.",
  mobilizacao: "Status do projeto: obra iniciada (canteiro, terraplenagem, matrícula ativa no CNO, obra em andamento).",
  operacao: "Status do projeto: obra concluída (inauguração, licença de operação ou matrícula do CNO encerrada do porte do projeto).",
  desaceleracao: "Status do projeto: atrasado, suspenso, reduzido ou adiado.",
  cancelado: "Status do projeto: a empresa desistiu do investimento.",
};
const OBRA_AJUDA = {
  ativa: "Status da obra (CNO 02): obra em andamento na Receita Federal.",
  encerrada: "Status da obra (CNO 15): obra concluída e baixada. Depois do anúncio, indica conclusão.",
  paralisada: "Status da obra (CNO 14): obra parada.",
  suspensa: "Status da obra (CNO 03): matrícula suspensa.",
  nula: "Status da obra (CNO 01): matrícula anulada (aberta por engano ou em duplicidade). Não indica obra.",
};

function ajuda(texto) {
  if (!texto) return "";
  return `<span class="ajuda" tabindex="0" role="note" aria-label="${esc(texto)}" data-ajuda="${esc(texto)}">?</span>`;
}
const ajudaEstagio = (estagio) => ajuda(ESTAGIO_AJUDA[estagio]);
const ajudaStatus = (status) => ajuda(STATUS_AJUDA[status]);
const ajudaObra = (situacao) => ajuda(OBRA_AJUDA[situacao]);

// Processamento do projeto: fontes secundárias consultadas e linha do tempo montada.
const PROCESSAMENTO = {
  processado: { rotulo: "Com fontes secundárias e linha do tempo", teste: (p) => Boolean(p.secundarias && p.linha_tempo) },
  linha_tempo: { rotulo: "Com linha do tempo montada", teste: (p) => temLinhaDoTempo(p) },
  pendente: { rotulo: "Ainda não processados", teste: (p) => !(p.secundarias && p.linha_tempo) },
  sem_confirmacao: { rotulo: "Sem confirmação de execução", teste: (p) => semConfirmacao(p) != null },
};

// Linha do tempo montada com pelo menos um marco.
function temLinhaDoTempo(p) {
  return Boolean(p.linha_tempo && (p.linha_tempo.marcos || []).length);
}

const STATUS_ORDEM = ["ativo", "em_revisao", "descartado"];

const MARCO_ROTULO = {
  anuncio: "Anúncio", licenca: "Licença", financiamento: "Financiamento", terreno: "Terreno",
  contratacao: "Contratação", obra: "Obra", operacao: "Operação", atraso: "Atraso", cancelamento: "Cancelamento", outro: "Marco",
};

const AVALIACAO_ROTULO = { valido: "válido", invalido: "inválido", duplicado: "duplicado" };

// Uma linha com o que a avaliação da carteira decidiu sobre o projeto.
function linhaAvaliacao(av, { comDuplicado = true } = {}) {
  if (!av) return "";
  const motivo = av.motivo ? ` (${avaliacaoProjetos.MOTIVOS[av.motivo] || av.motivo})` : "";
  const duplicado = comDuplicado && av.duplicado_de ? ` de <a href="/monitoramento/projetos/${esc(av.duplicado_de.id)}">${esc(av.duplicado_de.titulo)}</a>` : "";
  const desfeita = av.desfeita_em ? " · descarte desfeito" : "";
  return `<p class="project-card__review muted">Avaliação: <strong>${esc(AVALIACAO_ROTULO[av.decisao] || av.decisao)}</strong>${duplicado}${esc(motivo)}${desfeita} — ${esc(av.justificativa || "")}</p>`;
}

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

// Projeto anunciado há mais de 18 meses que ainda está antes da obra
// (anúncio, licenciamento ou financiamento) e não tem marco de obra nem de
// operação: não há confirmação de que foi executado. Devolve os meses desde o
// anúncio, ou null.
const MESES_SEM_CONFIRMACAO = 18;
const ESTAGIOS_ANTES_DA_OBRA = new Set(["anuncio", "licenciamento", "funding"]);

function semConfirmacao(p, hoje = new Date()) {
  if (!p || p.status === "descartado" || !ESTAGIOS_ANTES_DA_OBRA.has(p.estagio)) return null;
  const d = dataDoAnuncio(p);
  if (!d) return null;
  const inicio = new Date(d);
  const meses = (hoje.getUTCFullYear() - inicio.getUTCFullYear()) * 12 + hoje.getUTCMonth() - inicio.getUTCMonth();
  if (meses < MESES_SEM_CONFIRMACAO) return null;
  const marcos = Array.isArray(p.linha_tempo?.marcos) ? p.linha_tempo.marcos : [];
  if (marcos.some((m) => m.tipo === "obra" || m.tipo === "operacao")) return null;
  return meses;
}

function alertaSemConfirmacao(p) {
  const meses = semConfirmacao(p);
  if (meses == null) return "";
  const anos = meses >= 24 ? `${Math.floor(meses / 12)} anos` : `${meses} meses`;
  return `<p class="alerta-execucao">${badge("sem confirmação de execução", "warning")}${ajuda(`Anunciado há ${anos} e ainda sem evidência de obra (CNO, licença de instalação, notícia de canteiro) nem de operação (inauguração, licença de operação). Pode ter sido adiado, cancelado ou executado sem notícia: vale uma busca dirigida.`)} <span class="muted">anunciado há ${anos}, sem obra nem operação registrada</span></p>`;
}

const ORIGEM_LANCAMENTO = { noticia: "primeira notícia", cno: "obra no CNO", manual: "informada à mão" };

// De onde veio a data de lançamento (sql/032), ao lado do rótulo na ficha.
function origemLancamento(p) {
  const rotulo = ORIGEM_LANCAMENTO[p.data_anuncio_origem];
  if (!rotulo) return "";
  const ref = p.data_anuncio_ref;
  const detalhe = ref?.titulo ? `Data da primeira evidência forte aceita no projeto: ${ref.titulo}` : "A data de lançamento é a da primeira evidência forte aceita no projeto (notícia ou obra do CNO), não a do fato que a notícia conta.";
  return ` · ${esc(rotulo)}${p.data_anuncio_origem === "manual" ? "" : ajuda(detalhe)}`;
}

// Data informada à mão, mas há evidência aceita anterior a ela.
function alertaLancamento(p) {
  const antiga = p.data_anuncio_origem === "manual" ? p.data_anuncio_ref?.mais_antiga : null;
  if (!antiga) return "";
  return `<p class="alerta-execucao">${badge("evidência anterior ao lançamento", "warning")}${ajuda("A data de lançamento foi informada à mão e há uma evidência aceita mais antiga. Se ela for deste projeto, apague a data na edição para o Radar usar a primeira evidência; se não for, retire a evidência do projeto.")} <span class="muted">${esc(dia(antiga.data))}: ${esc(antiga.titulo || antiga.fonte)}</span></p>`;
}

// Projeto criado de uma obra do CNO (scripts/capex-cno-prospeccao.js), ainda sem notícia.
function seloPreCadastro(p) {
  if (p.origem !== "cno_prospeccao") return "";
  return `<p class="alerta-execucao">${badge("pré-cadastro pelo CNO", "info")}${ajuda("Obra de galpão industrial com mais de 5.000 m² de uma indústria privada, achada no Cadastro Nacional de Obras. Falta a notícia que confirme o projeto: valide e confirme, ou descarte.")}</p>`;
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
    processamento: PROCESSAMENTO[query.processamento] ? query.processamento : "",
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
    && (!f.ano || anoDoProjeto(p) === f.ano)
    && (!f.processamento || PROCESSAMENTO[f.processamento].teste(p)));
  const chave = ORDENS[f.ordem || "recentes"].chave;
  return lista.sort((a, b) => chave(a) - chave(b));
}

// Data de marco da linha do tempo ("2025", "2025-03" ou "2025-03-10") no formato brasileiro.
function dataMarco(data) {
  return data ? String(data).split("-").reverse().join("/") : "sem data";
}

const tomEstagio = (estagio) => (estagio === "cancelado" ? "danger" : estagio === "operacao" ? "success" : "info");

// Linha do tempo resumida do card: um ponto por marco e, em destaque, a data
// mais recente e o estágio do projeto. Sem marcos, usa a última evidência.
function linhaDoTempoCard(p) {
  const marcos = (temLinhaDoTempo(p) ? p.linha_tempo.marcos : [])
    .filter((m) => m.data)
    .sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const ultimo = marcos[marcos.length - 1];
  const data = ultimo ? dataMarco(ultimo.data) : dia(p.ultima_evidencia_em);
  const origem = ultimo ? (MARCO_ROTULO[ultimo.tipo] || ultimo.tipo) : "Última evidência";
  const pontos = (marcos.length ? marcos : [{}]).slice(-8).map((m, i, lista) =>
    `<span class="mini-timeline__dot${i === lista.length - 1 ? " is-last" : ""}" title="${esc(m.data ? `${dataMarco(m.data)} · ${MARCO_ROTULO[m.tipo] || m.tipo}` : "")}"></span>`).join("");
  return `
        <div class="mini-timeline">
          <div class="mini-timeline__track">${pontos}</div>
          <div class="mini-timeline__info">
            <span><strong>${esc(data)}</strong> <span class="muted">${esc(origem)}</span></span>
            <span>${badge(ESTAGIO_ROTULO[p.estagio] || p.estagio || "—", tomEstagio(p.estagio))}${ajudaEstagio(p.estagio)}${p.status && p.status !== "ativo" ? ` ${badge(STATUS_ROTULO[p.status] || p.status, p.status === "descartado" ? "danger" : "warning")}${ajudaStatus(p.status)}` : ""}</span>
          </div>
        </div>`;
}

function cardProjeto(p) {
  return `
      <article class="project-row">
        <div class="project-row__name">
          <h2><a href="/monitoramento/projetos/${p.id}">${esc(p.titulo)}</a></h2>
          ${p.pai_titulo ? `<p class="project-row__parent muted">↳ ${esc(RELACAO_ROTULO[p.relacao] || "ligado")} de <a href="/monitoramento/projetos/${p.projeto_pai_id}">${esc(p.pai_titulo)}</a></p>` : ""}
          ${p.avaliacao && p.avaliacao.decisao !== "valido" ? linhaAvaliacao(p.avaliacao) : ""}
          ${alertaSemConfirmacao(p)}
          ${seloPreCadastro(p)}
        </div>
        <div class="project-row__field"><span>Empresa</span><strong>${esc(p.grupo)}</strong></div>
        <div class="project-row__field"><span>Local</span><strong>${esc(localProjeto(p))}</strong></div>
        <div class="project-row__field project-row__field--valor"><span>Valor</span><strong>${esc(money(p.valor_estimado_brl))}</strong></div>
        ${linhaDoTempoCard(p)}
        ${blocoObrasDoCard(p.obras)}
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
    processamento: [["", "Todos"], ...Object.entries(PROCESSAMENTO).map(([k, v]) => [k, v.rotulo])],
    valor: [["", "Qualquer valor"], ...Object.entries(FAIXAS_VALOR).map(([k, v]) => [k, v.rotulo])],
    ano: [["", "Todos"], ...unicos(projetos.map(anoDoProjeto)).sort().reverse().map((a) => [a, a])],
    ordem: Object.entries(ORDENS).map(([k, v]) => [k, v.rotulo]),
  };
  const campo = (nome, rotulo) => `<div><label>${rotulo}</label><select name="${nome}">${selectOptions(opcoes[nome], filtros[nome] || "")}</select></div>`;
  const algumFiltro = ["grupo", "nicho", "uf", "estagio", "status", "valor", "ano", "processamento"].some((k) => filtros[k]);
  const somaValor = visiveis.reduce((t, p) => t + (p.valor_estimado_brl == null ? 0 : Number(p.valor_estimado_brl)), 0);
  const filtrosHtml = projetos.length ? `
      <form class="source-filters js-filtros" method="get" action="/monitoramento/carteira">
        ${campo("grupo", "Empresa")}
        ${campo("nicho", "Nicho")}
        ${campo("uf", "UF")}
        ${campo("estagio", "Estágio")}
        ${campo("status", "Situação")}
        ${campo("processamento", "Processamento")}
        ${campo("valor", "Valor estimado")}
        ${campo("ano", "Ano do anúncio")}
        ${campo("ordem", "Ordenar por")}
        <div class="source-filters__actions"><noscript><button class="button button--small" type="submit">Filtrar</button></noscript>${algumFiltro ? '<a href="/monitoramento/carteira">Limpar filtros</a>' : ""}</div>
        <p class="source-filters__count muted">${visiveis.length} projeto(s) neste filtro${somaValor ? ` · ${esc(money(somaValor))} em valor estimado` : ""}.</p>
      </form>` : "";
  let cards;
  // Os projetos vêm separados por status (ativo, em revisão, descartado), na ordem escolhida dentro de cada um.
  if (visiveis.length) {
    cards = STATUS_ORDEM.map((status) => {
      const doStatus = visiveis.filter((p) => p.status === status);
      if (!doStatus.length) return "";
      return `<section class="project-status-group"><h2>${esc(STATUS_ROTULO[status])} ${ajudaStatus(status)} <span class="muted">(${doStatus.length})</span></h2>
        <div class="project-list">${doStatus.map(cardProjeto).join("")}</div></section>`;
    }).join("");
  }
  else if (projetos.length) cards = `<div class="empty"><h2>Nenhum projeto neste filtro</h2><p>Troque ou limpe os filtros acima.</p><a class="button" href="/monitoramento/carteira">Limpar filtros</a></div>`;
  else cards = `<div class="empty"><h2>Nenhum projeto ainda</h2><p>Aprove uma notícia na lista para criar o primeiro.</p><a class="button" href="/monitoramento">Ver notícias</a></div>`;
  return layout({
    title: "Carteira",
    active: "projetos",
    scripts: SCRIPT,
    body: `
      ${notice}
      <section class="page-heading">
        <div><p class="eyebrow">Teste de monitoramento</p><h1>Carteira de projetos</h1><p>Projetos aprovados na revisão das notícias, com a linha do tempo das evidências aceitas.</p></div>
      </section>
      ${abas("carteira", naCarteira)}
      ${filtrosHtml}
      ${visiveis.length ? cards : `<section class="project-grid">${cards}</section>`}`,
  });
}

// Linha do tempo montada pelo modelo: resumo e marcos, cada um com as evidências que o sustentam.
function blocoLinhaDoTempo(projeto, timeline) {
  const lt = projeto.linha_tempo;
  if (!lt) return "";
  const porId = new Map(timeline.map((t) => [String(t.evidencia_id), t]));
  const marcos = (lt.marcos || []).map((m) => {
    const fontes = (m.evidencias || []).map((id) => porId.get(String(id))).filter(Boolean)
      .map((t) => `<a href="/monitoramento/noticias/${t.evidencia_id}">${esc(t.veiculo || t.fonte_nome || "evidência")}</a>`).join(", ");
    return `<li class="milestone">
      <span class="milestone__date">${esc(m.data ? m.data.split("-").reverse().join("/") : "sem data")}</span>
      <div>${badge(MARCO_ROTULO[m.tipo] || m.tipo, m.tipo === "cancelamento" || m.tipo === "atraso" ? "danger" : m.tipo === "operacao" ? "success" : "info")} ${esc(m.marco)}
      ${fontes ? `<p class="muted">Fonte: ${fontes}</p>` : ""}</div>
    </li>`;
  }).join("");
  const sec = projeto.secundarias;
  const consultadas = sec ? `<p class="muted">Fontes secundárias consultadas: ${(sec.fontes || []).length}, com ${sec.gravadas || 0} registro(s) de correlação direta${(sec.fontes || []).filter((f) => f.diretas).length ? ` (${esc(sec.fontes.filter((f) => f.diretas).map((f) => f.codigo.replace(/^(SEC|CAPTURA)-/, "")).join(", "))})` : ""}. Atualizado em ${esc(dia(sec.em))}.</p>` : "";
  return `<section class="project-timeline">
    <h2>Linha do tempo do projeto</h2>
    ${lt.resumo ? `<p>${esc(lt.resumo)}</p>` : ""}
    ${consultadas}
    <ol class="milestones">${marcos}</ol>
  </section>`;
}

const classes = require("./capex-classes");

// Códigos do CNO traduzidos (metadados da Receita), para os dados brutos.
const CNO_SITUACAO = { "01": "nula", "02": "ativa", "03": "suspensa", "14": "paralisada", "15": "encerrada" };
const CNO_QUALIFICACAO = { "0070": "proprietário do imóvel", "0057": "dono da obra", "0064": "incorporador de construção civil", "0053": "pessoa jurídica construtora", "0111": "sociedade líder de consórcio", "0109": "consórcio", "0110": "construção em nome coletivo" };

function cnoLegivel(fonte, b) {
  if (fonte !== "SEC-CNO") return b;
  return {
    ...b,
    ...(b.situacao ? { situacao: `${CNO_SITUACAO[b.situacao] || b.situacao} (${b.situacao})` } : {}),
    ...(b.qualificacao ? { qualificacao: `${CNO_QUALIFICACAO[b.qualificacao] || b.qualificacao} (${b.qualificacao})` } : {}),
  };
}

const RELACAO_ROTULO = { expansao: "expansão", subprojeto: "subprojeto", localidade: "localidade" };
const CORRELACAO_ROTULO = {
  direta: ["correlação direta", "success"],
  incerta: ["incerta", "warning"],
  outro_projeto: ["outro projeto", "neutral"],
  outro_estado: ["outro estado", "neutral"],
  nao_avaliada: ["não avaliada", "neutral"],
};
const ETAPA_PERFIL_ROTULO = { inicial: "Perfil inicial", enriquecido: "Perfil enriquecido", completo: "Perfil completo" };
const ORIGEM_ROTULO = { projeto: "cadastro", manchete: "manchete", materia: "matéria", fonte_secundaria: "fonte oficial", linha_tempo: "linha do tempo", texto: "texto das notícias" };
const CAMPOS_PERFIL_ROTULO = [
  ["objeto", "Objeto"], ["tipo_ativo", "Tipo de ativo"], ["local_detalhe", "Local (detalhe)"], ["valor_texto", "Valor (como divulgado)"],
  ["capacidade", "Capacidade"], ["area_construida_m2", "Área construída (m²)"], ["area_terreno_m2", "Área do terreno (m²)"], ["empregos", "Empregos"], ["obra", "Obra"], ["inicio_obra", "Início da obra"],
  ["previsao_operacao", "Previsão de operação"], ["construtora", "Construtora / EPC"], ["financiamento", "Financiamento"],
];

function blocoFamilia(pai, filhos) {
  if (!pai && !filhos.length) return "";
  const item = (x) => `<li><a href="/monitoramento/projetos/${x.id}">${esc(x.titulo)}</a> ${badge(RELACAO_ROTULO[x.relacao] || "projeto", "info")}${x.status !== "ativo" ? ` ${badge(STATUS_ROTULO[x.status] || x.status, "warning")}${ajudaStatus(x.status)}` : ""}</li>`;
  return `<section class="project-family">
    ${pai ? `<p>Este projeto é ${esc(RELACAO_ROTULO[pai.relacao_do_filho] || "ligado a")} de: <a href="/monitoramento/projetos/${pai.id}">${esc(pai.titulo)}</a></p>` : ""}
    ${filhos.length ? `<h2>Subprojetos e localidades (${filhos.length})</h2><ul>${filhos.map(item).join("")}</ul>` : ""}
  </section>`;
}

function blocoPerfil(projeto) {
  const perfil = projeto.perfil;
  if (!perfil) return "";
  const origem = (campo) => (perfil.origem?.[campo] ? ` <span class="muted">(${esc(ORIGEM_ROTULO[perfil.origem[campo]] || perfil.origem[campo])})</span>` : "");
  const linhas = CAMPOS_PERFIL_ROTULO
    .filter(([campo]) => perfil[campo] != null && perfil[campo] !== "")
    .map(([campo, rotulo]) => `<div><dt>${rotulo}</dt><dd>${esc(campo.startsWith("area_") && Number(perfil[campo]) ? Number(perfil[campo]).toLocaleString("pt-BR") : String(perfil[campo]))}${origem(campo)}</dd></div>`).join("");
  const licencas = (perfil.licencas || []).map((l) => `<li>${esc(l.tipo)}${l.numero ? ` nº ${esc(l.numero)}` : ""} · ${esc(l.orgao || l.fonte)}${l.data ? ` · ${esc(dia(l.data))}` : ""}</li>`).join("");
  return `<section class="project-profile">
    <h2>${esc(ETAPA_PERFIL_ROTULO[projeto.perfil_etapa] || "Perfil")} <span class="muted">· atualizado em ${esc(dia(projeto.perfil_em))}</span></h2>
    ${perfil.resumo ? `<p>${esc(perfil.resumo)}</p>` : ""}
    ${linhas ? `<dl class="facts facts--stack">${linhas}</dl>` : ""}
    ${licencas ? `<h3>Licenças e autorizações</h3><ul>${licencas}</ul>` : ""}
    ${perfil.licencas_sem_diario?.length ? `<p class="project-card__review">${badge("pendência", "warning")} Notícia cita licença sem publicação de diário oficial encontrada.</p>` : ""}
    <p class="muted">Fontes: ${perfil.fontes?.noticias || 0} notícia(s), ${perfil.fontes?.materias || 0} matéria(s) lida(s), ${perfil.fontes?.registros_oficiais || 0} registro(s) oficial(is).</p>
  </section>`;
}

// Todo registro que o Enriquecimento 2 analisou, com o dado bruto.
// Classe do registro (sql/031) com o formulário de revisão humana.
function seloClasse(r) {
  const c = classes.CLASSES[r.classe];
  if (!c) return badge(r.correlacao === "nao_avaliada" ? "não avaliado" : (CORRELACAO_ROTULO[r.correlacao]?.[0] || r.correlacao), "neutral");
  return `${badge(`${c.rotulo}${r.probabilidade != null ? ` · ${r.probabilidade}%` : ""}`, c.tom)}${r.revisado_por ? ` ${badge("revisado", "neutral")}` : ""}`;
}

function formClasse(r) {
  const opcoes = classes.ORDEM.map((k) => `<option value="${k}"${k === r.classe ? " selected" : ""}>${classes.CLASSES[k].rotulo} (${classes.CLASSES[k].faixa})</option>`).join("");
  return `<form class="inline-actions" method="post" action="/monitoramento/registros/${r.id}/classe" data-carregando="Trocando a classe e atualizando a linha do tempo…">
      <select name="classe">${opcoes}</select>
      <input name="motivo" placeholder="motivo (opcional)" maxlength="300">
      <button class="button button--small" type="submit">Trocar classe</button>
    </form>`;
}

// Nome do registro para a lista: o campo que descreve o ato ou a obra (o
// "titulo" de várias fontes é só a razão social, então vem por último).
function tituloRegistro(r) {
  const b = r.registro || {};
  const atividade = b.atividade ? [b.modalidade_descricao, b.atividade].filter(Boolean).join(": ") : null;
  // Trecho de diário vem cortado no meio da palavra ("…ÃO DE LICENÇA"): sai o pedaço inicial.
  const cortado = /^\s*…/.test(String(b.trecho || ""));
  const trecho = b.trecho
    ? String(b.trecho).replace(/^[\s….]+/, "").replace(cortado ? /^\S*\s+/ : /^/, "").replace(/\s+/g, " ")
    : null;
  return String(b.empreendimento || b.descricao || b.assunto || b.objeto || atividade || b.finalidade || b.nome || b.tipo_licenca || trecho || b.titulo || r.chave || "");
}

// Data do registro em ISO (AAAA-MM-DD), para ordenar.
function dataIso(valor) {
  if (!valor) return "";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

// Ordem padrão (sem script): data mais recente primeiro; sem data no fim.
function porDataDesc(a, b) {
  return dataIso(b.data_registro).localeCompare(dataIso(a.data_registro));
}

function linhaRegistro(r) {
  const b = r.registro || {};
  const titulo = tituloRegistro(r);
  const url = /^https?:\/\//.test(b.url || b.link || "") ? b.url || b.link : null;
  return `<details class="raw-record" data-data="${esc(dataIso(r.data_registro))}" data-nome="${esc(titulo.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/^[^a-z]+/, "").slice(0, 120))}" data-fonte="${esc(r.fonte_codigo || "")}">
      <summary>${seloClasse(r)} <strong>${esc(r.fonte_codigo)}</strong> <span class="muted">${esc(dia(r.data_registro))}</span> ${esc(String(titulo).slice(0, 160))}</summary>
      ${r.motivo ? `<p class="muted">${esc(r.motivo)}${r.revisado_por ? ` — revisado por ${esc(r.revisado_por)} em ${esc(dia(r.revisado_em))}` : ""}</p>` : ""}
      ${url ? `<p><a href="${esc(url)}" target="_blank" rel="noopener">Abrir a fonte ↗</a></p>` : ""}
      ${formClasse(r)}
      <pre>${esc(JSON.stringify(cnoLegivel(r.fonte_codigo, b), null, 2))}</pre>
    </details>`;
}

// Status do projeto (visão geral: estágio e situação na carteira) e status
// de cada obra do projeto (matrículas do CNO ligadas a ele).
const OBRA_TOM = { ativa: "info", encerrada: "success", paralisada: "danger", suspensa: "warning", nula: "neutral" };

function resumoObras(obras) {
  if (!obras.length) return "nenhuma obra matriculada no CNO ligada ao projeto";
  const n = {};
  for (const o of obras) n[o.situacao_descricao || "?"] = (n[o.situacao_descricao || "?"] || 0) + 1;
  return Object.entries(n).map(([s, q]) => `${q} ${s}`).join(", ");
}

function blocoStatus(projeto, obras) {
  const pend = projeto.municipio_pendencia;
  const linhas = obras.map((o) => `<tr>
      <td>${badge(o.situacao_descricao || "—", OBRA_TOM[o.situacao_descricao] || "neutral")}${ajudaObra(o.situacao_descricao)}</td>
      <td><strong>${esc(o.nome || "—")}</strong><br><span class="muted">CNO ${esc(o.cno)} · ${esc(o.municipio || "")}/${esc(o.uf || "")}${o.responsavel ? ` · ${esc(o.responsavel)}` : ""}${o.qualificacao ? ` (${esc(CNO_QUALIFICACAO[o.qualificacao] || o.qualificacao)})` : ""}</span></td>
      <td>${o.area ? `${Number(o.area).toLocaleString("pt-BR")} m²` : "—"}</td>
      <td>${esc(dia(o.inicio))}</td>
      <td>${esc(dia(o.data_situacao))}</td>
      <td>${seloClasse(o)}</td>
    </tr>`).join("");
  return `<section class="project-status">
    <div class="status-row">
      <div><span class="muted">Status do projeto</span><strong>${esc(ESTAGIO_ROTULO[projeto.estagio] || projeto.estagio)} ${ajudaEstagio(projeto.estagio)}</strong><span class="muted">${esc(STATUS_ROTULO[projeto.status] || projeto.status)} na carteira ${ajudaStatus(projeto.status)}</span></div>
      <div><span class="muted">Status das obras ${ajuda("Situação de cada matrícula do CNO ligada ao projeto: ativa, encerrada, paralisada, suspensa ou nula. Passe o mouse no ? de cada obra para o detalhe.")}</span><strong>${esc(resumoObras(obras))}</strong></div>
    </div>
    ${pend ? `<p class="project-card__review">${badge("revisar município", "warning")} ${esc(pend.motivo || "")}${pend.sugestoes?.length ? ` Sugestões: ${esc(pend.sugestoes.join(", "))}.` : ""}</p>` : ""}
    ${obras.length ? `<h3>Obras do projeto (${obras.length})</h3>
    <div class="table-scroll"><table class="table-compact">
      <thead><tr><th>Status da obra</th><th>Obra</th><th>Área</th><th>Início</th><th>Situação desde</th><th>Correlação</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table></div>` : ""}
  </section>`;
}

// Seções da aba Evidências, na ordem da página.
const SECOES_EVIDENCIA = [
  { chave: "certeira", destino: "linha" },
  { chave: "provavel", destino: "linha" },
  { chave: "sem_nota", rotulo: "Ligadas sem nota", faixa: "sem probabilidade", tom: "info", destino: "linha",
    regra: "Ligadas ao projeto à mão ou por regra (reprocessamento, subprojeto, projeto duplicado), sem nota de probabilidade. Contam como evidência e entram na linha do tempo quando citadas num marco." },
  { chave: "incerta", destino: "possibilidade" },
  { chave: "improvavel", destino: "possibilidade" },
  { chave: "muito_improvavel", destino: "descarte", fechada: true },
  { chave: "descartada", rotulo: "Notícias tiradas do projeto", faixa: "Filtro 1 e cronologia", tom: "neutral", destino: "descarte", fechada: true,
    regra: "Notícias que estavam ligadas e saíram: matéria ampla (sem a obra), repetida, de outro projeto ou fora da cronologia da obra." },
];
const DESTINO_EVIDENCIA = {
  linha: "Liga ao projeto como evidência e entra na linha do tempo quando sustenta um marco.",
  possibilidade: "Não entra na linha do tempo: aparece como possibilidade no perfil, para revisão.",
  descarte: "Descartada: fica só nos dados brutos, no fim da ficha do projeto.",
};
const DESCARTE_EVIDENCIA = { ampla: "matéria ampla", repetida: "repetida", outro_projeto: "de outro projeto", cronologia: "fora da cronologia", rejeitada: "rejeitada" };
const ORIGEM_APROVACAO = { ia: "IA", manual: "manual", regra: "regra" };
const POR_PAGINA = 200;

function filtrosEvidencias(query = {}) {
  const texto = (v) => (typeof v === "string" ? v.trim().slice(0, 100) : "");
  const secoes = SECOES_EVIDENCIA.map((s) => s.chave);
  return {
    grupo: uuid.safeParse(query.grupo).success ? query.grupo : "",
    tipo: ["noticia", "registro"].includes(query.tipo) ? query.tipo : "",
    fonte: texto(query.fonte),
    q: texto(query.q),
    classe: secoes.includes(query.classe) ? query.classe : "",
    pagina: Math.max(1, Number.parseInt(query.pagina, 10) || 1),
  };
}

function secaoEvidencia(s) {
  const c = classes.CLASSES[s.chave] || {};
  return { rotulo: c.rotulo, faixa: c.faixa, tom: c.tom, ...s };
}

// Critérios de avaliação: a escala, o que cada especialista olha e o funil das notícias.
function blocoCriterios() {
  const { ESCALA, ESPECIALISTAS } = require("./capex-especialistas");
  const especialistas = Object.values(ESPECIALISTAS).map((e) => `<div class="criterio">
      <h4>${esc(e.nome)}</h4>
      <p class="muted">${esc(e.contexto)}</p>
      <p><strong>Sobe:</strong> ${esc(e.sobe.join("; "))}.</p>
      <p><strong>Desce:</strong> ${esc(e.desce.join("; "))}.</p>
    </div>`).join("");
  return `<details class="raw-record">
      <summary><strong>Critérios da avaliação</strong> <span class="muted">escala, especialistas por fonte e funil das notícias</span></summary>
      <h3>Escala de probabilidade</h3>
      <pre>${esc(ESCALA)}</pre>
      <h3>Notícias</h3>
      <p>Passam pelo Filtro 1 (manchete com ativo físico), pelo Filtro 2 (CapEx e fato novo, sem repetir outra notícia) e pelo Filtro 3 (matéria lida, obra ainda não concluída). A ligação ao projeto recebe uma confiança de 0 a 100, que dá a classe pela mesma escala. Saem do projeto se forem amplas, repetidas, de outro projeto ou fora da cronologia da obra.</p>
      <h3>Registros oficiais: especialista de cada fonte</h3>
      ${especialistas}
    </details>`;
}

function linhaEvidencia(e, marcosDoProjeto, secao) {
  const b = e.registro || {};
  const titulo = e.titulo || b.titulo || b.nome || b.descricao || b.empreendimento || b.assunto || b.objeto || b.tipo_licenca || "(sem título)";
  const link = e.url || b.url || b.link;
  const url = /^https?:\/\//.test(link || "") ? link : null;
  const tituloHtml = url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(String(titulo).slice(0, 180))} ↗</a>` : esc(String(titulo).slice(0, 180));
  const marcos = e.item === "evidencia" ? marcosDoProjeto.filter((m) => (m.evidencias || []).map(String).includes(e.id)) : [];
  let linha;
  if (marcos.length) {
    linha = `${badge("na linha do tempo", "success")}${marcos.map((m) => `<br><span class="muted">${esc(m.data || "")} · ${esc(m.marco || "")}</span>`).join("")}`;
  } else if (secao.destino === "linha") {
    linha = `${badge("evidência, sem marco", "warning")}<br><span class="muted">ligada ao projeto, mas nenhum marco a cita</span>`;
  } else if (secao.destino === "possibilidade") {
    linha = badge("possibilidade no perfil", "neutral");
  } else {
    linha = `${badge("descartada", "neutral")}${e.descarte ? `<br><span class="muted">${esc(DESCARTE_EVIDENCIA[e.descarte] || e.descarte)}</span>` : ""}`;
  }
  const especialista = e.noticia ? null : require("./capex-especialistas").especialistaDe(e.fonte_codigo).nome;
  const criterios = [
    e.motivo ? `<p>${esc(e.motivo)}</p>` : "",
    especialista ? `<p class="muted">Especialista: ${esc(especialista)}</p>` : "",
    e.noticia && e.origem ? `<p class="muted">Ligação: ${esc(ORIGEM_APROVACAO[e.origem] || e.origem)}${e.probabilidade != null ? `, confiança ${e.probabilidade}%` : ""}</p>` : "",
    e.filtro2 ? `<p class="muted">Filtro 2: ${esc(e.filtro2)}</p>` : "",
    e.filtro3 ? `<p class="muted">Filtro 3: ${esc(e.filtro3)}</p>` : "",
    `<p class="muted">Avaliado por ${esc(e.avaliado_por || "—")} em ${esc(dia(e.avaliado_em))}${e.revisado ? " · revisado por humano" : ""}</p>`,
  ].join("");
  return `<tr>
      <td>${esc(dia(e.data))}</td>
      <td>${e.noticia ? badge("notícia", "info") : badge("registro", "neutral")}<br><span class="muted">${esc(e.noticia ? e.veiculo || "" : e.fonte_codigo)}</span></td>
      <td>${tituloHtml}<br><a class="muted" href="/monitoramento/projetos/${e.projeto_id}">${esc(e.projeto)}</a> <span class="muted">· ${esc(local(e.uf, e.municipio))}</span></td>
      <td>${e.probabilidade != null ? `<strong>${e.probabilidade}%</strong>` : "—"}</td>
      <td>${linha}</td>
      <td class="criterios">${criterios}</td>
    </tr>`;
}

function paginaEvidencias({ contagem, itens, marcos, grupos, fontes, filtros, totalProjetos }) {
  const opcoes = {
    grupo: [["", "Todas"], ...grupos.map((g) => [g.id, g.nome])],
    tipo: [["", "Notícias e registros"], ["noticia", "Notícias"], ["registro", "Registros oficiais"]],
    fonte: [["", "Todas"], ...fontes.sort((a, b) => String(a[1]).localeCompare(String(b[1]), "pt-BR"))],
  };
  const campo = (nome, rotulo) => `<div><label>${rotulo}</label><select name="${nome}">${selectOptions(opcoes[nome], filtros[nome] || "")}</select></div>`;
  const algum = filtros.grupo || filtros.tipo || filtros.fonte || filtros.q;
  const link = (extra) => {
    const p = new URLSearchParams(Object.entries({ ...filtros, ...extra }).filter(([k, v]) => v && !(k === "pagina" && v === 1)));
    return `/monitoramento/evidencias${p.toString() ? `?${p}` : ""}`;
  };
  const secoes = SECOES_EVIDENCIA.map(secaoEvidencia).filter((s) => !filtros.classe || s.chave === filtros.classe);
  const total = (k) => contagem[k]?.n || 0;
  const naLinha = itens.filter((e) => e.item === "evidencia" && (marcos[e.projeto_id] || []).some((m) => (m.evidencias || []).map(String).includes(e.id))).length;
  const resumo = SECOES_EVIDENCIA.map(secaoEvidencia).map((s) => `<a class="chip" href="${link({ classe: s.chave, pagina: 1 })}">${badge(s.rotulo, s.tom)} ${total(s.chave).toLocaleString("pt-BR")}</a>`).join(" ");
  const corpo = secoes.map((s) => {
    const lista = itens.filter((e) => e.classe === s.chave);
    const n = total(s.chave);
    const paginas = Math.max(1, Math.ceil(n / POR_PAGINA));
    const navegacao = filtros.classe
      ? (paginas > 1 ? `<p class="muted">Página ${filtros.pagina} de ${paginas}${filtros.pagina > 1 ? ` · <a href="${link({ pagina: filtros.pagina - 1 })}">← anterior</a>` : ""}${filtros.pagina < paginas ? ` · <a href="${link({ pagina: filtros.pagina + 1 })}">próxima →</a>` : ""}</p>` : "")
      : (n > lista.length ? `<p><a href="${link({ classe: s.chave, pagina: 1 })}">Ver as ${n.toLocaleString("pt-BR")} →</a></p>` : "");
    const ligadas = s.destino === "linha" ? lista.filter((e) => (marcos[e.projeto_id] || []).some((m) => (m.evidencias || []).map(String).includes(e.id))).length : 0;
    const tabela = lista.length ? `<div class="table-scroll"><table class="table-compact">
          <thead><tr><th>Data</th><th>Tipo</th><th>Evidência e projeto</th><th>Prob.</th><th>Linha do tempo</th><th>Critérios da avaliação</th></tr></thead>
          <tbody>${lista.map((e) => linhaEvidencia(e, marcos[e.projeto_id] || [], s)).join("")}</tbody>
        </table></div>` : '<p class="muted">Nada nesta classe com os filtros atuais.</p>';
    return `<details class="evidence-class"${s.fechada && !filtros.classe ? "" : " open"} id="classe-${s.chave}">
        <summary><h2>${badge(s.rotulo, s.tom)} ${esc(s.faixa)} <span class="muted">· ${n.toLocaleString("pt-BR")} em ${(contagem[s.chave]?.projetos || 0)} projeto(s)</span></h2></summary>
        <p>${esc(s.regra || DESTINO_EVIDENCIA[s.destino])}${s.regra ? ` ${esc(DESTINO_EVIDENCIA[s.destino])}` : ""}${s.destino === "linha" && lista.length ? ` <strong>${ligadas} de ${lista.length} listadas estão num marco da linha do tempo.</strong>` : ""}</p>
        ${tabela}
        ${navegacao}
      </details>`;
  }).join("");
  return layout({
    title: "Evidências",
    active: "projetos",
    body: `
      <section class="page-heading">
        <div><p class="eyebrow">Teste de monitoramento</p><h1>Evidências por classe</h1><p>Tudo o que foi avaliado para os projetos da carteira, separado pela classe de correlação: as ligadas à linha do tempo, as possibilidades e as descartadas, com o que levou a cada decisão. Para trocar a classe ou tirar uma evidência, abra o projeto.</p></div>
      </section>
      ${abas("evidencias", totalProjetos)}
      <form class="source-filters" method="get" action="/monitoramento/evidencias">
        ${campo("grupo", "Empresa")}
        ${campo("tipo", "Tipo")}
        ${campo("fonte", "Fonte")}
        <div><label>Busca</label><input name="q" value="${esc(filtros.q)}" placeholder="título, projeto, município, motivo"></div>
        ${filtros.classe ? `<input type="hidden" name="classe" value="${esc(filtros.classe)}">` : ""}
        <div class="source-filters__actions"><button class="button button--small" type="submit">Filtrar</button>${algum || filtros.classe ? '<a href="/monitoramento/evidencias">Limpar filtros</a>' : ""}</div>
      </form>
      <section class="raw-records">
        <p class="evidence-summary">${resumo}${filtros.classe ? ` · <a href="${link({ classe: "", pagina: 1 })}">ver todas as classes</a>` : ""}</p>
        ${filtros.classe ? "" : `<p class="muted">Nesta página, ${naLinha} evidência(s) listadas estão num marco da linha do tempo.</p>`}
        ${blocoCriterios()}
      </section>
      <section class="raw-records">${corpo}</section>`,
  });
}

const pct = (n, d) => (d ? `${((100 * n) / d).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—");

function paginaFontes({ funil, veiculos, secundarias, totalProjetos }) {
  const etapas = [
    ["Captadas (Google News)", funil.captadas],
    ["Passaram o Filtro 1 (manchete com ativo físico)", funil.filtro1],
    ["Mantidas no Filtro 2 (CapEx e fato novo)", funil.filtro2],
    ["Matéria original lida (Enriquecimento)", funil.enriquecidas],
    ["Mantidas no Filtro 3", funil.filtro3],
    ["Ligadas a um projeto da carteira", funil.em_projeto],
  ];
  const linhasFunil = etapas.map(([rotulo, n]) => `<tr>
      <td>${esc(rotulo)}</td><td>${n.toLocaleString("pt-BR")}</td><td>${pct(n, funil.captadas)}</td>
    </tr>`).join("");
  const linhasVeiculos = veiculos.map((v) => `<tr><td>${esc(v.veiculo)}</td><td>${v.captadas}</td><td>${v.filtro1}</td><td>${v.em_projeto}</td><td>${pct(v.em_projeto, v.captadas)}</td></tr>`).join("");
  const tot = secundarias.reduce((a, r) => {
    for (const k of ["total", "certeira", "provavel", "incerta", "improvavel", "muito_improvavel", "nao_avaliada", "revisados"]) a[k] = (a[k] || 0) + r[k];
    return a;
  }, {});
  const linhasSec = secundarias.map((r) => {
    const ligados = r.certeira + r.provavel;
    const avaliados = r.total - r.nao_avaliada;
    return `<tr>
      <td><strong>${esc(r.fonte_codigo)}</strong>${r.nome ? `<br><span class="muted">${esc(r.nome)}</span>` : ""}</td>
      <td>${r.total}</td><td>${r.certeira}</td><td>${r.provavel}</td><td>${r.incerta}</td><td>${r.improvavel}</td><td>${r.muito_improvavel}</td>
      <td><strong>${pct(ligados, avaliados)}</strong></td><td>${r.projetos_ligados}/${r.projetos}</td><td>${r.revisados || ""}</td>
    </tr>`;
  }).join("");
  return layout({
    title: "Fontes",
    active: "projetos",
    body: `
      <section class="page-heading">
        <div><p class="eyebrow">Teste de monitoramento</p><h1>Eficiência das fontes</h1><p>Quanto do que cada fonte traz chega a um projeto. Primárias: o funil das notícias. Secundárias: os registros oficiais analisados para cada projeto, por classe de correlação.</p></div>
      </section>
      ${abas("fontes", totalProjetos)}
      <section class="raw-records">
        <h2>Fontes primárias: funil das notícias</h2>
        <p class="muted">As etapas não são encaixadas: notícias aprovadas na revisão antes do fluxo atual não passaram por todos os filtros, e o Enriquecimento também lê notícias já ligadas a projetos.</p>
        <div class="table-scroll"><table class="table-compact">
          <thead><tr><th>Etapa</th><th>Notícias</th><th>Das captadas</th></tr></thead>
          <tbody>${linhasFunil}</tbody>
        </table></div>
        <h3>Veículos (25 com mais notícias em projetos)</h3>
        <div class="table-scroll"><table class="table-compact">
          <thead><tr><th>Veículo</th><th>Captadas</th><th>Filtro 1</th><th>Em projeto</th><th>Aproveitamento</th></tr></thead>
          <tbody>${linhasVeiculos}</tbody>
        </table></div>
      </section>
      <section class="raw-records">
        <h2>Fontes secundárias: registros por classe</h2>
        <p class="muted">${tot.total || 0} registros analisados nos projetos ativos; ${(tot.certeira || 0) + (tot.provavel || 0)} ligados à linha do tempo (certeira ou provável), ${(tot.incerta || 0) + (tot.improvavel || 0)} possibilidades, ${tot.muito_improvavel || 0} descartados${tot.nao_avaliada ? `, ${tot.nao_avaliada} ainda sem julgamento` : ""}${tot.revisados ? `; ${tot.revisados} revisados por humano` : ""}. Aproveitamento = certeira + provável sobre os avaliados.</p>
        <div class="table-scroll"><table class="table-compact">
          <thead><tr><th>Fonte</th><th>Registros</th><th>Certeira</th><th>Provável</th><th>Incerta</th><th>Improvável</th><th>Muito improv.</th><th>Aproveitamento</th><th>Projetos ligados</th><th>Revisados</th></tr></thead>
          <tbody>${linhasSec}</tbody>
        </table></div>
      </section>`,
  });
}

// Possibilidades: incertas e improváveis, destacadas para revisão (acima da linha do tempo).
// Barra de ordenação dos registros (public/monitoramento.js reordena no lugar).
function barraOrdem() {
  return `<div class="raw-sort js-ordem-registros" role="group" aria-label="Ordenar registros">
      <span class="muted">Ordenar por:</span>
      <button type="button" class="chip is-active" data-ordem="data">Data (recente)</button>
      <button type="button" class="chip" data-ordem="nome">Nome (A–Z)</button>
      <button type="button" class="chip" data-ordem="fonte">Fonte</button>
    </div>`;
}

function listaRegistros(lista) {
  return `<div class="raw-list">${[...lista].sort(porDataDesc).map(linhaRegistro).join("")}</div>`;
}

function blocoPossibilidades(registros) {
  const lista = registros.filter((r) => classes.ehPossibilidade(r.classe));
  if (!lista.length) return "";
  return `<section class="raw-records possibilities">
    <h2>Possibilidades <span class="muted">(${lista.length})</span></h2>
    <p class="muted">Registros oficiais que podem ser deste projeto (incertos ou improváveis). Revise e troque a classe: provável ou certeira leva o registro para a linha do tempo.</p>
    ${barraOrdem()}
    ${listaRegistros(lista)}
  </section>`;
}

// Todo registro analisado, com o dado bruto e a classe (os descartados ficam no fim da ficha).
function blocoRegistros(registros) {
  if (!registros.length) return "";
  const contagem = {};
  for (const r of registros) {
    const k = r.classe || (r.correlacao === "nao_avaliada" ? "nao_avaliada" : r.correlacao);
    contagem[k] = (contagem[k] || 0) + 1;
  }
  const resumo = Object.entries(contagem).map(([c, n]) => `${n} ${esc(classes.CLASSES[c]?.rotulo.toLowerCase() || CORRELACAO_ROTULO[c]?.[0] || c)}`).join(" · ");
  const ligados = registros.filter((r) => classes.ligaLinhaDoTempo(r.classe));
  const descartados = registros.filter((r) => !classes.ligaLinhaDoTempo(r.classe) && !classes.ehPossibilidade(r.classe));
  return `<section class="raw-records">
    <h2>Dados brutos analisados <span class="muted">(${registros.length})</span></h2>
    <p class="muted">${resumo}. Provável e certeira viram evidência na linha do tempo; incerta e improvável aparecem em Possibilidades; o resto fica aqui. Toda classe pode ser trocada.</p>
    ${barraOrdem()}
    ${ligados.length ? `<h3>Ligados à linha do tempo (${ligados.length})</h3>${listaRegistros(ligados)}` : ""}
    ${descartados.length ? `<h3>Descartados (${descartados.length})</h3>${listaRegistros(descartados)}` : ""}
  </section>`;
}

const DESCARTE_ROTULO = { cronologia: "fora da cronologia", ampla: "notícia ampla", repetida: "repetida", outro_projeto: "outro projeto" };

function blocoRetiradas(retiradas) {
  if (!retiradas.length) return "";
  return `<section class="removed-evidence">
    <h2>Evidências retiradas <span class="muted">(${retiradas.length})</span></h2>
    <ul>${retiradas.map((r) => `<li>${badge(DESCARTE_ROTULO[r.descarte] || r.descarte, "neutral")} <a href="/monitoramento/noticias/${r.id}">${esc(r.titulo)}</a> <span class="muted">${esc(dia(r.data_original))} · ${esc(r.motivo || "")}</span></li>`).join("")}</ul>
  </section>`;
}

function paginaProjeto({ projeto, timeline, notice, pai = null, filhos = [], registros = [], retiradas = [], obras = [] }) {
  const itens = timeline.map((t) => `
    <article class="evidence">
      <div>${t.primaria ? badge("primária", "info") : /google news/i.test(t.fonte_nome || "") || !t.fonte_nome ? badge("notícia", "success") : badge("fonte oficial", "warning")} <span class="muted">${esc(dia(t.data_original))} · ${esc(t.veiculo || t.fonte_nome || "")}</span></div>
      <h3><a href="/monitoramento/noticias/${t.evidencia_id}">${esc(t.titulo)}</a></h3>
      ${t.url ? `<p class="evidence-links"><a href="${esc(t.url)}" target="_blank" rel="noopener">Abrir a publicação ↗</a></p>` : ""}
    </article>`).join("");
  return layout({
    title: projeto.titulo,
    active: "projetos",
    scripts: SCRIPT,
    body: `
      ${notice}
      <p><a href="/monitoramento/carteira">← Carteira</a></p>
      <section class="project-hero">
        <div>
          ${badge(ESTAGIO_ROTULO[projeto.estagio] || projeto.estagio, "info")}${ajudaEstagio(projeto.estagio)} ${badge(projeto.flag_validacao, "neutral")}
          <p class="eyebrow">${esc(projeto.grupo)} · ${esc(NICHOS[projeto.nicho] || projeto.nicho)}</p>
          <h1>${esc(projeto.titulo)}</h1>
          ${alertaSemConfirmacao(projeto)}
          ${seloPreCadastro(projeto)}
          <p>${esc(projeto.matriz_razao_social)} · ${esc(projeto.matriz_cnpj)}${projeto.filial_cnpj ? ` · filial ${esc(projeto.filial_cnpj)}` : ""}</p>
        </div>
      </section>
      <section class="stats">
        <div><strong>${esc(money(projeto.valor_estimado_brl))}</strong><span>Valor estimado${projeto.fonte_valor ? ` · ${esc(projeto.fonte_valor)}` : ""}</span></div>
        <div><strong>${esc(localProjeto(projeto))}</strong><span>${projeto.local_origem === "matriz" ? "Local não informado (sede da matriz)" : "Local"}</span></div>
        <div><strong>${timeline.length}</strong><span>Evidências</span></div>
        <div><strong>${esc(dia(projeto.data_anuncio))}</strong><span>Lançamento${origemLancamento(projeto)}</span></div>
      </section>
      ${alertaLancamento(projeto)}
      ${blocoFamilia(pai ? { ...pai, relacao_do_filho: projeto.relacao } : null, filhos)}
      ${blocoStatus(projeto, obras)}
      ${blocoPerfil(projeto)}
      ${blocoPossibilidades(registros)}
      ${blocoLinhaDoTempo(projeto, timeline)}
      <div class="detail-grid">
        <section><h2>Evidências</h2>${projeto.objeto ? `<p>${esc(projeto.objeto)}</p>` : ""}<div class="evidence-list">${itens}</div></section>
        <aside>
          ${projeto.avaliacao ? `<section class="form-card compact">
            <h2>Avaliação da carteira</h2>
            ${linhaAvaliacao(projeto.avaliacao)}
            ${Object.keys(projeto.avaliacao.aplicado || {}).length ? `<p class="muted">Campos corrigidos: ${esc(Object.keys(projeto.avaliacao.aplicado).join(", "))}.</p>` : ""}
            ${projeto.status === "descartado" && !projeto.avaliacao.desfeita_em ? `<form method="post" action="/monitoramento/projetos/${projeto.id}/restaurar">
              <button class="button button--secondary" type="submit">Desfazer descarte</button>
            </form>` : ""}
          </section>` : ""}
          <form class="form-card compact" method="post" action="/monitoramento/projetos/${projeto.id}/excluir" onsubmit="return confirm('Excluir este projeto e as ${timeline.length} evidência(s) dele? A ação não pode ser desfeita.')">
            <h2>Excluir projeto</h2>
            <p class="muted">Apaga o projeto, os vínculos e as notícias que só pertenciam a ele.</p>
            <button class="button button--danger" type="submit">Excluir projeto</button>
          </form>
        </aside>
      </div>
      ${blocoRetiradas(retiradas)}
      ${blocoRegistros(registros)}`,
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

// ---------------------------------------------------------------------------
// Agente: decisões automáticas e avaliação para o conjunto de treino
// ---------------------------------------------------------------------------

const DECISAO_ROTULO = {
  criar_projeto: "Criar projeto",
  vincular: "Vincular a projeto existente",
  descartar: "Descartar",
  revisar: "Revisão humana",
};

const ACAO_TIPO = {
  projeto_criado: "success",
  vinculada: "info",
  descartada: "danger",
  revisao_humana: "warning",
  erro: "danger",
};

const SITUACAO_OBRA_ROTULO = {
  anunciado: "anunciado",
  em_construcao: "em construção",
  concluido: "concluído",
  incerto: "incerto",
};

function sinal(valor) {
  if (valor === true) return "sim";
  if (valor === false) return "não";
  return "—";
}

// Linha com a sugestão do agente no card da notícia (quando ele deixou para a revisão).
function linhaAgente(noticia) {
  if (noticia.agente_acao !== "revisao_humana" || !noticia.agente_decisao) return "";
  const motivo = agente.MOTIVOS[noticia.agente_motivo]?.rotulo || noticia.agente_motivo || "";
  return `<p class="news-card__agent">Agente: <strong>${esc(DECISAO_ROTULO[noticia.agente_decisao] || noticia.agente_decisao)}</strong>${noticia.agente_confianca != null ? ` (${noticia.agente_confianca}%)` : ""}${motivo ? ` · ${esc(motivo)}` : ""}${noticia.agente_trava ? ` · deixou para você: ${esc(noticia.agente_trava)}` : ""}</p>`;
}

function formAvaliacao(d) {
  const base = `/monitoramento/agente/${d.id}/avaliar`;
  const podeDesfazer = ["projeto_criado", "vinculada", "descartada"].includes(d.acao) && !d.desfeita;
  const motivos = [["", "motivo (opcional)"], ...Object.entries(agente.MOTIVOS)
    .filter(([, m]) => m.decisao !== "revisar")
    .map(([codigo, m]) => [codigo, m.rotulo])];
  const decisoes = Object.entries(DECISAO_ROTULO).filter(([k]) => k !== "revisar" && k !== d.decisao);
  return `<div class="news-card__actions">
    <form class="js-acao" method="post" action="${base}">
      <input type="hidden" name="avaliacao" value="correta">
      <button class="button button--small" type="submit">Correta</button>
    </form>
    <details class="agent-wrong">
      <summary class="button button--small button--secondary">Incorreta…</summary>
      <form class="js-acao agent-wrong__form" method="post" action="${base}">
        <input type="hidden" name="avaliacao" value="incorreta">
        <label>O certo era<select name="decisao_correta">${selectOptions(decisoes)}</select></label>
        <label>Motivo<select name="motivo_correto">${selectOptions(motivos)}</select></label>
        <label>Observação<input name="observacao" maxlength="600" placeholder="por que o agente errou (opcional)"></label>
        ${podeDesfazer ? `<label class="checkbox"><input type="checkbox" name="desfazer" value="1" checked> Desfazer a ação do agente e devolver a notícia para a revisão</label>` : ""}
        <button class="button button--small button--danger" type="submit">Salvar avaliação</button>
      </form>
    </details>
    ${d.acao === "revisao_humana" && d.evidencia_id ? `<a class="news-card__more" href="/monitoramento/noticias/${d.evidencia_id}">decidir a notícia →</a>` : ""}
  </div>`;
}

function cardDecisao(d) {
  const saida = d.saida || {};
  const analise = saida.analise || {};
  const motivo = agente.MOTIVOS[d.motivo]?.rotulo || d.motivo || "";
  const titulo = d.url
    ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.titulo || d.entrada?.noticia?.titulo || "")}</a>`
    : esc(d.titulo || d.entrada?.noticia?.titulo || "(notícia excluída)");
  const projeto = d.projeto_id && d.projeto_titulo
    ? `<p class="news-card__hint">Projeto: <a href="/monitoramento/projetos/${d.projeto_id}">${esc(d.projeto_titulo)}</a>${d.projeto_status === "em_revisao" ? ` ${badge("em revisão", "warning")}` : ""}</p>`
    : "";
  const proposto = saida.projeto && d.decisao === "criar_projeto"
    ? `<p class="news-card__reading">${esc([saida.projeto.titulo, local(saida.projeto.uf, saida.projeto.municipio),
      saida.projeto.valor_brl ? money(saida.projeto.valor_brl) : "", ESTAGIO_ROTULO[saida.projeto.estagio] || ""].filter(Boolean).join(" · "))}</p>`
    : "";
  const mesmo = analise.mesmo_projeto_id
    ? (d.entrada?.projetos || []).find((p) => String(p.id) === String(analise.mesmo_projeto_id))?.titulo || analise.mesmo_projeto_id
    : "";
  const avaliado = d.avaliacao
    ? `<div class="news-card__done">${badge(d.avaliacao === "correta" ? "avaliada: correta" : "avaliada: incorreta", d.avaliacao === "correta" ? "success" : "danger")}
        <span class="muted">${d.avaliacao === "incorreta" && d.decisao_correta ? `o certo era ${esc(DECISAO_ROTULO[d.decisao_correta])}${d.motivo_correto ? ` (${esc(agente.MOTIVOS[d.motivo_correto]?.rotulo || d.motivo_correto)})` : ""}` : ""}${d.observacao ? ` · ${esc(d.observacao)}` : ""}${d.desfeita ? " · ação desfeita" : ""} · ${esc(d.avaliado_por || "")}</span></div>`
    : "";
  return `<article class="news-card news-card--agente" id="decisao-${d.id}" data-id="${d.id}">
    <div class="news-card__meta">
      ${badge(agente.ACOES[d.acao] || d.acao, ACAO_TIPO[d.acao] || "neutral")}
      ${d.confianca != null ? `<span>${d.confianca}% de confiança</span>` : ""}
      <span>${esc(dia(d.data_original || d.entrada?.noticia?.data))}</span>
      <span>${esc(d.veiculo || d.entrada?.noticia?.veiculo || "")}</span>
      <span>${esc(d.grupo || "")}</span>
      <span class="news-card__more muted">${esc(d.modelo)} · ${esc(d.versao_prompt)} · ${esc(diaHora(d.criado_em))}</span>
    </div>
    <h3 class="news-card__title">${titulo}</h3>
    ${d.decisao ? `<p class="news-card__reading">${esc(DECISAO_ROTULO[d.decisao])}${motivo ? ` · ${esc(motivo)}` : ""}</p>` : ""}
    ${saida.justificativa ? `<p class="news-card__why">${esc(saida.justificativa)}</p>` : ""}
    ${saida.analise ? `<p class="news-card__hint">Investimento: ${sinal(analise.investimento)} · gera obra: ${sinal(analise.gera_obra)} · situação: ${esc(SITUACAO_OBRA_ROTULO[analise.situacao] || "—")} · no Brasil: ${sinal(analise.no_brasil)}${mesmo ? ` · mesmo projeto: ${esc(mesmo)}` : ""}</p>` : ""}
    ${proposto}
    ${projeto}
    ${d.acao_motivo ? `<p class="news-card__hint">${d.acao === "erro" ? "Erro" : "Ajuste"}: ${esc(d.acao_motivo)}</p>` : ""}
    ${avaliado || formAvaliacao(d)}
  </article>`;
}

function contagensAgente(r) {
  const pct = r.avaliadas ? Math.round((r.corretas / r.avaliadas) * 100) : null;
  return {
    ag_total: r.total,
    ag_pendentes: r.total - r.avaliadas,
    ag_avaliadas: r.avaliadas,
    ag_acerto: pct == null ? "—" : `${pct}%`,
  };
}

function paginaAgente({ resumo, decisoes, filtros, grupos, fila, totalProjetos, notice = "", job = null, modelo, temChave, versoes = [] }) {
  const c = contagensAgente(resumo);
  const rodar = temChave
    ? `<button class="button js-triar" type="button" data-grupo="" data-modo="agente">Rodar o agente${fila ? ` (${fila} na fila)` : ""}</button>`
    : `<span class="muted">CLAUDE_API_KEY não configurada</span>`;
  const opcoes = {
    avaliacao: Object.entries(agente.AVALIACOES),
    acao: [["", "Todas as ações"], ...Object.entries(agente.ACOES)],
    grupo: [["", "Todas as empresas"], ...grupos.map((g) => [g.id, g.nome])],
    versao: [["", "Todas as versões"], ...versoes.map((v) => [v, v])],
  };
  const lista = decisoes.length
    ? decisoes.map(cardDecisao).join("")
    : `<div class="empty"><h2>Nenhuma decisão neste filtro</h2><p>${resumo.total ? "Troque o filtro acima." : "Rode o agente para ele decidir a fila de notícias."}</p></div>`;
  return layout({
    title: "Agente",
    active: "monitoramento",
    scripts: SCRIPT,
    body: `
      ${notice}
      <section class="page-heading">
        <div>
          <p class="eyebrow">Teste de monitoramento · triagem automática</p>
          <h1>Agente de triagem</h1>
          <p>O agente lê a fila "A revisar" e decide cada notícia: cria o projeto, liga a um projeto existente ou descarta. A avaliação é sobre a decisão final dele e forma o conjunto de treino.</p>
        </div>
        ${rodar}
      </section>
      ${abas("agente", totalProjetos)}
      ${barraTriagem(job, "Agente")}
      <section class="stats">
        <div><strong data-stat="ag_total">${c.ag_total}</strong><span>Decisões do agente</span></div>
        <div><strong data-stat="ag_pendentes">${c.ag_pendentes}</strong><span>Sem avaliação</span></div>
        <div><strong data-stat="ag_avaliadas">${c.ag_avaliadas}</strong><span>Avaliadas</span></div>
        <div><strong data-stat="ag_acerto">${c.ag_acerto}</strong><span>Acerto nas avaliadas</span></div>
      </section>
      <p class="muted">${resumo.projeto_criado} projetos criados · ${resumo.vinculada} vinculadas · ${resumo.descartada} descartadas · ${resumo.revisao_humana} para revisão humana${resumo.erro ? ` · ${resumo.erro} com erro` : ""} · modelo ${esc(modelo)} · prompt ${esc(agente.VERSAO_PROMPT)} ·
        <a href="/monitoramento/agente/treino.jsonl">baixar conjunto de treino (JSONL)</a></p>
      <form class="source-filters js-filtros" method="get" action="/monitoramento/agente">
        <div><label>Avaliação</label><select name="avaliacao">${selectOptions(opcoes.avaliacao, filtros.avaliacao)}</select></div>
        <div><label>Ação</label><select name="acao">${selectOptions(opcoes.acao, filtros.acao || "")}</select></div>
        <div><label>Empresa</label><select name="grupo">${selectOptions(opcoes.grupo, filtros.grupo || "")}</select></div>
        <div><label>Versão do prompt</label><select name="versao">${selectOptions(opcoes.versao, filtros.versao || "")}</select></div>
        <div class="source-filters__actions"><noscript><button class="button button--small" type="submit">Filtrar</button></noscript></div>
        <p class="source-filters__count muted">${decisoes.length} decisão(ões) neste filtro${decisoes.length >= 100 ? " (as 100 mais recentes)" : ""}.</p>
      </form>
      <section class="news-list">${lista}</section>`,
  });
}

// Depois de aprovar: a evidência entra na linha do tempo do projeto. Devolve
// o complemento da mensagem; um erro aqui não desfaz a aprovação.
async function linhaAposAprovacao(projetoId) {
  if (!projetoId) return "";
  try {
    const r = await require("./capex-fontes-secundarias").incluirNaLinhaDoTempo(pool, projetoId);
    if (!r) return "";
    if (r.modo === "modelo") {
      return ` Linha do tempo refeita: ${r.marcos} marco(s)${r.estagio_mudou ? `, estágio ${r.estagio_mudou}` : ""}.`;
    }
    return ` Evidência incluída na linha do tempo (${r.marcos} marco(s); provisória até o modelo revisar).`;
  } catch (error) {
    console.error("linha do tempo após aprovação:", error.message);
    return " A linha do tempo não foi atualizada agora; ela é refeita na próxima rodada.";
  }
}

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
    const projetos = await painel.carteira({ incluirDescartados: true });
    const obras = await painel.obrasDosProjetos(projetos.map((x) => x.id));
    for (const x of projetos) x.obras = obras.get(x.id) || [];
    res.send(paginaCarteira({
      projetos,
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
      const mensagem = (r.acao === "projeto_criado"
        ? `Projeto "${r.projeto_titulo}" criado.`
        : "Notícia vinculada ao projeto sugerido.") + await linhaAposAprovacao(r.projeto_id);
      await responderAcao(req, res, id, mensagem, "/monitoramento");
    } catch (error) {
      if (!querJson(req)) throw error;
      res.status(422).json({ ok: false, mensagem: error.message });
    }
  });

  app.post("/monitoramento/noticias/:id/projeto", async (req, res) => {
    const id = uuid.parse(req.params.id);
    const projeto = await painel.criarProjetoDaNoticia(id, projetoSchema.parse(req.body));
    const linha = await linhaAposAprovacao(projeto.id);
    res.redirect(`/monitoramento/projetos/${projeto.id}?message=${encodeURIComponent(`Projeto "${projeto.titulo}" criado com a notícia como evidência primária.${linha}`)}`);
  });

  app.post("/monitoramento/noticias/:id/vincular", async (req, res) => {
    const id = uuid.parse(req.params.id);
    const projetoId = uuid.parse(req.body.projeto_id);
    await painel.vincularNoticia(id, projetoId);
    await responderAcao(req, res, id, `Notícia vinculada ao projeto.${await linhaAposAprovacao(projetoId)}`, `/monitoramento/noticias/${id}`);
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

  // Aba Evidências: uma seção por classe, com a linha do tempo e os critérios.
  app.get("/monitoramento/evidencias", async (req, res) => {
    const filtros = filtrosEvidencias(req.query);
    const [dados, projetos] = await Promise.all([
      painel.evidenciasPorClasse({ ...filtros, porPagina: POR_PAGINA }),
      painel.carteira(),
    ]);
    res.send(paginaEvidencias({ ...dados, filtros, totalProjetos: projetos.length }));
  });

  // Aba Fontes: eficiência das fontes primárias e secundárias.
  app.get("/monitoramento/fontes", async (req, res) => {
    const [dados, projetos] = await Promise.all([painel.eficienciaFontes(), painel.carteira()]);
    res.send(paginaFontes({ ...dados, totalProjetos: projetos.length }));
  });

  // Revisão humana da classe de um registro analisado (sql/031).
  app.post("/monitoramento/registros/:id/classe", async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const classe = z.enum(classes.ORDEM).parse(req.body?.classe);
    const motivo = typeof req.body?.motivo === "string" && req.body.motivo.trim() ? req.body.motivo.trim().slice(0, 300) : `Revisão humana: ${classes.CLASSES[classe].rotulo}`;
    const r = await require("./capex-fontes-secundarias").revisarRegistro(require("./db").pool, id, { classe, motivo, ator: "usuario:painel" });
    if (!r) return res.status(404).send("Registro não encontrado");
    const linha = classes.CLASSES[classe].destino === "linha" ? await linhaAposAprovacao(r.projeto_id) : "";
    res.redirect(`/monitoramento/projetos/${r.projeto_id}?message=${encodeURIComponent(`Classe trocada para ${classes.CLASSES[classe].rotulo}.${linha}`)}`);
  });

  app.post("/monitoramento/projetos/:id/restaurar", async (req, res) => {
    const id = uuid.parse(req.params.id);
    const p = await avaliacaoProjetos.restaurarProjeto(id);
    const msg = p ? `Projeto "${p.titulo}" voltou para a carteira.` : "O projeto não estava descartado pela avaliação.";
    res.redirect(`/monitoramento/projetos/${id}?message=${encodeURIComponent(msg)}`);
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
    const comAgente = req.body.modo === "agente" ? agente.agentePadrao() : null;
    res.json({ ok: true, job: await triagem.iniciarTriagem({
      grupoId,
      ia,
      agente: comAgente,
      filtro: filtroCapex.filtroPadrao(),
      enriquecedor: enriquecimento.enriquecedorPadrao(),
      filtroFinal: filtroFinal.filtroFinalPadrao(),
    }) });
  });

  // Agente: decisões, avaliação e conjunto de treino.
  app.get("/monitoramento/agente", async (req, res) => {
    const filtros = {
      avaliacao: agente.AVALIACOES[req.query.avaliacao] ? req.query.avaliacao : "pendentes",
      acao: agente.ACOES[req.query.acao] ? req.query.acao : "",
      grupo: uuid.safeParse(req.query.grupo).success ? req.query.grupo : "",
      versao: /^agente-v\d+$/.test(req.query.versao || "") ? req.query.versao : "",
    };
    const grupos = await painel.resumoGrupos();
    const [resumo, decisoes, fila, projetos, versoes] = await Promise.all([
      agente.resumoDecisoes(pool, { versao: filtros.versao || null }),
      agente.listarDecisoes(pool, { avaliacao: filtros.avaliacao, acao: filtros.acao, grupoId: filtros.grupo || null, versao: filtros.versao || null }),
      agente.contarFila(pool, grupos.map((g) => g.id)),
      painel.carteira(),
      agente.versoesDoPrompt(pool),
    ]);
    const { getConfig } = require("./config");
    const config = getConfig();
    res.send(paginaAgente({
      resumo, decisoes, filtros, grupos,
      fila: [...fila.values()].reduce((t, n) => t + n, 0),
      totalProjetos: projetos.length,
      notice: aviso(req),
      job: triagem.triagemAtiva(),
      versoes,
      modelo: config.claudeDecisionModel,
      temChave: Boolean(config.claudeApiKey),
    }));
  });

  app.post("/monitoramento/agente/:id/avaliar", async (req, res) => {
    const id = uuid.parse(req.params.id);
    const mensagemOk = req.body.avaliacao === "correta" ? "Decisão marcada como correta." : "Avaliação salva.";
    try {
      await agente.avaliarDecisao(id, {
        avaliacao: req.body.avaliacao,
        decisao_correta: req.body.decisao_correta || null,
        motivo_correto: req.body.motivo_correto || null,
        observacao: req.body.observacao || null,
        desfazer: req.body.desfazer === "1",
      });
    } catch (error) {
      if (!querJson(req)) throw error;
      return res.status(422).json({ ok: false, mensagem: error.message });
    }
    if (!querJson(req)) return res.redirect(`/monitoramento/agente?message=${encodeURIComponent(mensagemOk)}`);
    const [[decisao], resumo] = await Promise.all([agente.listarDecisoes(pool, { id, limite: 1 }), agente.resumoDecisoes(pool)]);
    res.json({ ok: true, mensagem: mensagemOk, card: decisao ? cardDecisao(decisao) : "", contagens: contagensAgente(resumo) });
  });

  app.get("/monitoramento/agente/treino.jsonl", async (req, res) => {
    const exemplos = await agente.exportarTreino(pool, { incluirPendentes: req.query.todas === "1" });
    res.set("Content-Type", "application/x-ndjson; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="capex-agente-treino-${new Date().toISOString().slice(0, 10)}.jsonl"`);
    res.send(exemplos.map((e) => JSON.stringify(e)).join("\n") + (exemplos.length ? "\n" : ""));
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
  paginaAgente,
  cardDecisao,
  linhaAgente,
  filtrosCarteira,
  filtrarCarteira,
  localProjeto,
  paginaProjeto,
  semConfirmacao,
};
