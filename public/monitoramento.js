// Tela de Monitoramento: ações no card sem recarregar, barra de progresso da
// triagem e navegação entre as páginas do monitoramento trocando só o conteúdo.
// Sem este script, os formulários e links continuam funcionando normalmente.
(() => {
  if (window.__monitoramento) return;
  window.__monitoramento = true;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  // -------------------------------------------------------------------------
  // Avisos curtos no canto da tela
  // -------------------------------------------------------------------------
  const toasts = document.createElement("div");
  toasts.className = "toasts";
  toasts.setAttribute("aria-live", "polite");
  document.body.appendChild(toasts);

  function avisar(texto, tipo = "ok") {
    const el = document.createElement("div");
    el.className = `toast toast--${tipo}`;
    el.textContent = texto;
    toasts.appendChild(el);
    const ms = Math.max(3800, texto.length * 60);
    setTimeout(() => el.classList.add("is-leaving"), ms);
    setTimeout(() => el.remove(), ms + 500);
  }

  // -------------------------------------------------------------------------
  // Pedidos JSON tolerantes: o proxy do Railway responde 429 com o texto
  // "rate limited" (não é JSON). Nesse caso espera e tenta de novo algumas
  // vezes; qualquer outra resposta que não seja JSON vira uma mensagem legível.
  // -------------------------------------------------------------------------
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  async function pedirJson(url, opcoes = {}, { tentativas = 4 } = {}) {
    for (let tentativa = 1; ; tentativa += 1) {
      const resposta = await fetch(url, opcoes);
      if (resposta.status === 429 && tentativa < tentativas) {
        const retry = Number(resposta.headers.get("Retry-After"));
        await esperar(Number.isFinite(retry) && retry > 0 ? retry * 1000 : 1500 * 2 ** (tentativa - 1));
        continue;
      }
      const texto = await resposta.text();
      let dados = null;
      try { dados = JSON.parse(texto); } catch { /* resposta não é JSON */ }
      if (dados) return { resposta, dados };
      const erro = new Error(resposta.status === 429
        ? "O servidor limitou os pedidos por um momento. Espere alguns segundos e tente de novo."
        : `O servidor respondeu ${resposta.status}${texto ? `: ${texto.slice(0, 120)}` : ""}`);
      erro.status = resposta.status;
      throw erro;
    }
  }

  function atualizarNumeros(contagens) {
    if (!contagens) return;
    for (const [chave, valor] of Object.entries(contagens)) {
      document.querySelectorAll(`[data-stat="${chave}"]`).forEach((el) => { el.textContent = valor; });
    }
  }

  // -------------------------------------------------------------------------
  // Navegação: troca só o <main>, mantém a posição quando faz sentido
  // -------------------------------------------------------------------------
  const main = () => document.querySelector("main.container");

  // Troca o <main> com transição suave. O navegador só roda a transição quando
  // pinta um quadro; se ela não rodar logo (aba em segundo plano), troca direto.
  function trocarConteudo(html, depois) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const novo = doc.querySelector("main.container");
    if (!novo) return false;
    let feito = false;
    const aplicar = () => {
      if (feito) return;
      feito = true;
      main().replaceWith(novo);
      document.title = doc.title;
      // O destaque do menu muda entre Monitoramento e Projetos (Carteira).
      const menu = doc.querySelector(".topbar nav");
      if (menu) document.querySelector(".topbar nav")?.replaceWith(menu);
      depois();
    };
    if (document.startViewTransition && !document.hidden) {
      document.startViewTransition(aplicar);
      setTimeout(aplicar, 400);
    } else {
      aplicar();
    }
    return true;
  }

  async function navegar(url, { empilhar = true, scroll = 0 } = {}) {
    const alvo = new URL(url, location.href);
    document.body.classList.add("is-loading");
    try {
      const resposta = await fetch(alvo, { headers: { "X-Requested-With": "fetch" } });
      if (empilhar) history.replaceState({ ...(history.state || {}), scroll: window.scrollY }, "");
      let concluir;
      const trocado = new Promise((resolve) => { concluir = resolve; });
      const trocou = resposta.ok && trocarConteudo(await resposta.text(), () => {
        window.scrollTo(0, scroll);
        iniciar();
        concluir();
      });
      if (!trocou) {
        location.href = alvo.href;
        return;
      }
      if (empilhar) history.pushState({ scroll }, "", alvo.pathname + alvo.search + alvo.hash);
      await trocado;
    } catch {
      location.href = alvo.href;
    } finally {
      document.body.classList.remove("is-loading");
    }
  }

  // Recarrega a página atual sem sair do lugar (depois da triagem, por exemplo).
  function recarregarConteudo() {
    return navegar(location.href, { empilhar: false, scroll: window.scrollY });
  }

  window.addEventListener("popstate", (event) => {
    navegar(location.href, { empilhar: false, scroll: event.state?.scroll || 0 });
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target === "_blank" || link.hasAttribute("download")) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith("/monitoramento")) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
    event.preventDefault();
    navegar(url.href);
  });

  // Filtros: trocar o select já filtra, sem botão e sem voltar ao topo.
  document.addEventListener("change", (event) => {
    const form = event.target.closest("form.js-filtros");
    if (!form) return;
    const url = new URL(form.action, location.href);
    for (const [chave, valor] of new FormData(form)) if (valor) url.searchParams.set(chave, valor);
    navegar(url.href, { scroll: window.scrollY });
  });

  // -------------------------------------------------------------------------
  // Aviso de carregamento para ações demoradas (aprovação com linha do tempo).
  // O formulário pede o aviso com data-carregando="texto".
  // -------------------------------------------------------------------------
  function mostrarCarregando(texto) {
    let el = document.getElementById("carregando");
    if (!el) {
      el = document.createElement("div");
      el.id = "carregando";
      el.className = "carregando";
      el.setAttribute("role", "alertdialog");
      el.setAttribute("aria-live", "assertive");
      el.innerHTML = `<div class="carregando__caixa">
          <span class="carregando__giro" aria-hidden="true"></span>
          <strong class="js-carregando-texto"></strong>
          <span class="carregando__etapa js-carregando-etapa"></span>
          <span class="muted js-carregando-tempo"></span>
          <p class="muted">A linha do tempo é refeita pelo modelo: pode levar até 2 minutos. Não feche a página.</p>
        </div>`;
      document.body.appendChild(el);
    }
    el.querySelector(".js-carregando-texto").textContent = texto;
    const etapa = el.querySelector(".js-carregando-etapa");
    const tempo = el.querySelector(".js-carregando-tempo");
    const inicio = Date.now();
    const etapas = [[0, "Gravando a aprovação…"], [3, "Montando a linha do tempo com o modelo…"], [45, "Ainda montando: projetos com muitas evidências demoram mais…"], [120, "Quase no limite; se o modelo não responder, a evidência entra como marco provisório."]];
    const tique = () => {
      const s = Math.round((Date.now() - inicio) / 1000);
      etapa.textContent = etapas.filter(([de]) => s >= de).pop()[1];
      tempo.textContent = `${s} s`;
    };
    clearInterval(el._timer);
    tique();
    el._timer = setInterval(tique, 1000);
    el.hidden = false;
    document.body.classList.add("is-waiting");
    return () => {
      clearInterval(el._timer);
      el.hidden = true;
      document.body.classList.remove("is-waiting");
    };
  }

  // Voltando à página pelo histórico, o aviso não fica preso na tela.
  window.addEventListener("pageshow", () => {
    const el = document.getElementById("carregando");
    if (el) { clearInterval(el._timer); el.hidden = true; }
    document.body.classList.remove("is-waiting");
  });

  // Formulário comum (sem script de ação): só mostra o aviso e deixa enviar.
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (event.defaultPrevented || form.matches("form.js-acao") || !form.dataset.carregando) return;
    mostrarCarregando(form.dataset.carregando);
  });

  // -------------------------------------------------------------------------
  // Dados brutos analisados: ordenar por data, nome ou fonte (agrupada)
  // -------------------------------------------------------------------------
  const ORDENS = {
    data: (a, b) => (b.dataset.data || "").localeCompare(a.dataset.data || ""),
    nome: (a, b) => (a.dataset.nome || "").localeCompare(b.dataset.nome || "", "pt-BR"),
    fonte: (a, b) => (a.dataset.fonte || "").localeCompare(b.dataset.fonte || "") || (b.dataset.data || "").localeCompare(a.dataset.data || ""),
  };

  function ordenarRegistros(secao, ordem) {
    if (!secao || !ORDENS[ordem]) return;
    secao.querySelectorAll(".raw-list").forEach((lista) => {
      lista.querySelectorAll(".raw-group").forEach((h) => h.remove());
      const itens = [...lista.querySelectorAll(":scope > details.raw-record")].sort(ORDENS[ordem]);
      let fonteAtual = null;
      for (const item of itens) {
        if (ordem === "fonte" && item.dataset.fonte !== fonteAtual) {
          fonteAtual = item.dataset.fonte;
          const n = itens.filter((x) => x.dataset.fonte === fonteAtual).length;
          const h = document.createElement("h4");
          h.className = "raw-group";
          h.textContent = `${fonteAtual || "sem fonte"} (${n})`;
          lista.appendChild(h);
        }
        lista.appendChild(item);
      }
    });
    secao.querySelectorAll(".js-ordem-registros [data-ordem]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.ordem === ordem);
      b.setAttribute("aria-pressed", String(b.dataset.ordem === ordem));
    });
  }

  document.addEventListener("click", (event) => {
    const botao = event.target.closest(".js-ordem-registros [data-ordem]");
    if (!botao) return;
    ordenarRegistros(botao.closest("section"), botao.dataset.ordem);
    try { localStorage.setItem("radar:ordem-registros", botao.dataset.ordem); } catch { /* sem armazenamento */ }
  });

  // Ao abrir a ficha, aplica a última ordem escolhida.
  function ordemSalva() {
    let ordem = null;
    try { ordem = localStorage.getItem("radar:ordem-registros"); } catch { /* sem armazenamento */ }
    if (!ORDENS[ordem] || ordem === "data") return;
    document.querySelectorAll(".js-ordem-registros").forEach((barra) => ordenarRegistros(barra.closest("section"), ordem));
  }

  // -------------------------------------------------------------------------
  // Ações do card: aprovar, descartar e desfazer
  // -------------------------------------------------------------------------
  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (form.matches("form.js-acao")) {
      const fecharAviso = form.dataset.carregando ? mostrarCarregando(form.dataset.carregando) : () => {};
      event.preventDefault();
      const card = form.closest(".news-card");
      // Lê o formulário antes de desabilitar: campo desabilitado não é enviado.
      const corpo = new URLSearchParams(new FormData(form));
      const botoes = card ? card.querySelectorAll("button, select, input") : form.querySelectorAll("button");
      botoes.forEach((el) => { el.disabled = true; });
      card?.classList.add("is-busy");
      try {
        const { resposta, dados } = await pedirJson(form.action, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
          body: corpo,
        });
        if (!resposta.ok || !dados.ok) throw new Error(dados.mensagem || "Não foi possível concluir");
        if (card && dados.card) {
          const tmp = document.createElement("div");
          tmp.innerHTML = dados.card.trim();
          const novo = tmp.firstElementChild;
          novo.classList.add("is-updated");
          card.replaceWith(novo);
        }
        atualizarNumeros(dados.contagens);
        avisar(dados.mensagem);
      } catch (error) {
        avisar(error.message, "erro");
        botoes.forEach((el) => { el.disabled = false; });
        card?.classList.remove("is-busy");
      } finally {
        fecharAviso();
      }
      return;
    }
    if (form.matches("form.js-testar")) {
      event.preventDefault();
      const saida = form.querySelector(".js-testar-resultado");
      const botao = form.querySelector("button[type=submit]");
      botao.disabled = true;
      saida.innerHTML = '<p class="muted">Consultando o Google News…</p>';
      try {
        const url = new URL(form.action, location.href);
        for (const [chave, valor] of new FormData(form)) url.searchParams.set(chave, valor);
        saida.innerHTML = await (await fetch(url)).text();
      } catch {
        saida.innerHTML = '<p class="error-text">Falha ao testar a busca.</p>';
      } finally {
        botao.disabled = false;
      }
    }
  });

  // Histórico de buscas: as notícias da janela carregam ao abrir.
  document.addEventListener("toggle", async (event) => {
    const det = event.target;
    if (!det.matches?.("details.js-janela") || !det.open || det.dataset.carregado) return;
    det.dataset.carregado = "1";
    const alvo = det.querySelector(".js-janela-noticias");
    const url = `/monitoramento/buscas/noticias?${new URLSearchParams({ grupo: det.dataset.grupo, desde: det.dataset.desde, ate: det.dataset.ate })}`;
    try {
      alvo.innerHTML = await (await fetch(url)).text();
      alvo.classList.remove("muted");
    } catch {
      alvo.textContent = "Falha ao carregar as notícias.";
    }
  }, true);

  // -------------------------------------------------------------------------
  // Triagem da IA com barra de progresso
  // -------------------------------------------------------------------------
  let acompanhando = null;

  function mostrarProgresso(job) {
    const box = document.getElementById("triagem-progresso");
    if (!box) return;
    box.classList.remove("is-hidden");
    box.dataset.job = job.status === "rodando" ? job.id : "";
    box.querySelector(".js-triagem-barra").style.width = `${job.percentual}%`;
    const ag = job.agente || {};
    const fimAgente = `Agente: ${ag.projetos_criados} projeto(s) criado(s) · ${ag.vinculadas} vinculada(s) · ${ag.descartadas} descartada(s) · ${ag.revisao_humana} para você${ag.erros ? ` · ${ag.erros} erro(s)` : ""}`;
    const r = job.resumo;
    const fases = [
      `Filtro 1: ${r.lidas} lidas, ${r.capex} seguem, ${r.regras + (r.repetidas || 0) + r.ia_descartadas} descartadas${r.repetidas ? ` (${r.repetidas} manchete(s) repetida(s))` : ""}${r.erros_ia ? `, ${r.erros_ia} lote(s) com erro` : ""}`,
    ];
    const fi = job.filtro || {};
    if (fi.ativo) fases.push(`Filtro 2: ${fi.mantidas} mantida(s), ${fi.descartadas} descartada(s)${fi.erros ? `, ${fi.erros} erro(s)` : ""}`);
    const en = job.enriquecimento || {};
    if (en.ativo) fases.push(`Enriquecimento: ${en.enriquecidas} com matéria, ${en.sem_materia} sem${en.erros ? `, ${en.erros} erro(s)` : ""}`);
    const f3 = job.filtro_final || {};
    if (f3.ativo) fases.push(`Filtro 3: ${f3.mantidas} para aprovação, ${f3.descartadas} descartada(s)${f3.erros ? `, ${f3.erros} erro(s)` : ""}`);
    if (job.modo === "agente") fases.push(fimAgente);
    const texto = job.status === "rodando"
      ? `${job.feitas} de ${job.total} · ${job.grupo_atual || job.escopo}`
      : job.status === "erro"
        ? `Parou com erro: ${job.erro}`
        : `Concluído · ${fases.join(" · ")}`;
    const rotulo = box.querySelector(".triage-progress__head strong");
    if (rotulo) rotulo.textContent = job.modo === "agente" ? "Agente" : "Funil de notícias";
    box.querySelector(".js-triagem-texto").textContent = texto;
    box.classList.toggle("is-done", job.status !== "rodando");
    document.querySelectorAll(".js-triar").forEach((b) => { b.disabled = job.status === "rodando"; });
  }

  async function acompanhar(id) {
    if (acompanhando === id) return;
    acompanhando = id;
    while (acompanhando === id) {
      // Com a aba em segundo plano, não consulta: poupa pedidos ao servidor.
      if (document.hidden) { await esperar(3000); continue; }
      let dados;
      try {
        ({ dados } = await pedirJson(`/monitoramento/triagem/${id}`, { headers: { Accept: "application/json" } }, { tentativas: 1 }));
      } catch {
        await esperar(6000);
        continue;
      }
      if (!dados.ok) { avisar(dados.mensagem, "erro"); acompanhando = null; return; }
      mostrarProgresso(dados.job);
      if (dados.job.status !== "rodando") {
        acompanhando = null;
        const nome = dados.job.modo === "agente" ? "O agente" : "O funil";
        avisar(dados.job.status === "erro" ? `${nome} parou com erro.` : `${nome} terminou.`, dados.job.status === "erro" ? "erro" : "ok");
        await recarregarConteudo();
        const box = document.getElementById("triagem-progresso");
        if (box) mostrarProgresso(dados.job);
        return;
      }
      await esperar(3000);
    }
  }

  document.addEventListener("click", async (event) => {
    const botao = event.target.closest(".js-triar");
    if (!botao) return;
    botao.disabled = true;
    try {
      const { dados } = await pedirJson("/monitoramento/triagem", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grupo_id: botao.dataset.grupo || "", modo: botao.dataset.modo || "triagem" }),
      });
      if (!dados.ok) throw new Error(dados.mensagem);
      mostrarProgresso(dados.job);
      if (dados.job.status === "rodando") acompanhar(dados.job.id);
      else avisar("Nada no funil para processar.");
    } catch (error) {
      avisar(error.message || "Falha ao iniciar a triagem.", "erro");
      botao.disabled = false;
    }
  });

  // Ao abrir ou trocar de página, retoma a barra de uma triagem em andamento.
  function iniciar() {
    ordemSalva();
    const box = document.getElementById("triagem-progresso");
    if (box?.dataset.job) acompanhar(box.dataset.job);
  }

  iniciar();
})();
