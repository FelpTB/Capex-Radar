// Dica dos gráficos: ao passar o mouse ou focar um elemento com data-tip,
// mostra o texto perto do ponteiro (ou do elemento, no teclado).
(() => {
  const dica = document.createElement("div");
  dica.className = "dv-tooltip";
  dica.setAttribute("role", "tooltip");
  dica.hidden = true;
  document.body.appendChild(dica);

  function posicionar(x, y) {
    const margem = 12;
    const { offsetWidth: w, offsetHeight: h } = dica;
    let left = x + margem;
    let top = y - h - margem;
    if (left + w > window.innerWidth - 8) left = x - w - margem;
    if (top < 8) top = y + margem;
    dica.style.left = `${Math.max(8, left)}px`;
    dica.style.top = `${top}px`;
  }

  function mostrar(el, x, y) {
    dica.textContent = el.dataset.tip;
    dica.hidden = false;
    el.classList.add("is-hover");
    posicionar(x, y);
  }

  function esconder(el) {
    dica.hidden = true;
    el?.classList.remove("is-hover");
  }

  document.addEventListener("mousemove", (event) => {
    const el = event.target.closest?.("[data-tip]");
    document.querySelectorAll("[data-tip].is-hover").forEach((x) => { if (x !== el) x.classList.remove("is-hover"); });
    if (!el) { dica.hidden = true; return; }
    mostrar(el, event.clientX, event.clientY);
  });
  document.addEventListener("focusin", (event) => {
    const el = event.target.closest?.("[data-tip]");
    if (!el) return;
    const r = el.getBoundingClientRect();
    mostrar(el, r.left + Math.min(r.width / 2, 160), r.top);
  });
  document.addEventListener("focusout", (event) => esconder(event.target.closest?.("[data-tip]")));
  window.addEventListener("scroll", () => { dica.hidden = true; }, { passive: true });
})();
