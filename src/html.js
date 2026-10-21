function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value, currency = "BRL") {
  if (value === null || value === undefined) return "Não informado";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency === "USD" ? "USD" : "BRL",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function date(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function badge(value, kind = "neutral") {
  return `<span class="badge badge--${esc(kind)}">${esc(value)}</span>`;
}

function selectOptions(items, selected = "") {
  return items.map(([value, label]) =>
    `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(label)}</option>`).join("");
}

function statusKind(status) {
  if (["construcao", "operacao", "ok"].includes(status)) return "success";
  if (["cancelado", "bloqueado", "indisponivel", "rejeitado"].includes(status)) return "danger";
  if (["instavel", "rumor"].includes(status)) return "warning";
  return "info";
}

function layout({ title, body, active = "", scripts = "" }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)} · Radar CapEx</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="topbar">
    <a class="brand" href="/projetos">Radar <strong>CapEx</strong></a>
    <nav>
      <a class="${active === "projetos" ? "active" : ""}" href="/projetos">Projetos</a>
      <a class="${active === "fontes" ? "active" : ""}" href="/fontes">Fontes</a>
      <a class="${active === "captura" ? "active" : ""}" href="/captura">Captura</a>
      <a class="button button--small" href="/prospeccao">Prospectar</a>
    </nav>
  </header>
  <main class="container">${body}</main>
  ${scripts}
</body>
</html>`;
}

module.exports = { esc, money, date, badge, selectOptions, statusKind, layout };
