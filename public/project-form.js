const button = document.querySelector("#extract-button");
const text = document.querySelector("#article_text");
const status = document.querySelector("#extract-status");
const form = document.querySelector("form");
const companyIdentification = document.querySelector("#company-identification");
const projectSplit = document.querySelector("#project-split");

function fillForm(project) {
  const fields = [
    "nome",
    "empresa_nome",
    "nicho",
    "uf",
    "municipio",
    "valor_capex",
    "moeda",
    "status",
    "status_em",
    "status_em_origem",
    "resumo",
  ];
  for (const field of fields) {
    if (project[field] !== null && project[field] !== undefined && form.elements[field]) {
      form.elements[field].value = project[field];
    }
  }
  form.elements.empresa_identificacao.value = project.empresa_identificacao
    ? JSON.stringify(project.empresa_identificacao)
    : "";
}

function showCompanyDecision(decision) {
  companyIdentification.replaceChildren();
  if (!decision) return;

  const title = document.createElement("strong");
  title.textContent = decision.selecionada
    ? `Empresa escolhida: ${decision.selecionada}`
    : "Empresa não identificada com segurança";
  const reason = document.createElement("p");
  reason.textContent = `${decision.motivo} Confiança: ${decision.confianca}.`;
  const options = document.createElement("p");
  options.className = "muted";
  options.textContent = decision.candidatos.length
    ? `Opções detectadas: ${decision.candidatos.join(", ")}`
    : "Nenhuma opção foi detectada no texto.";
  companyIdentification.append(title, reason, options);
}

function showProjects(projects) {
  projectSplit.replaceChildren();
  if (projects.length < 2) return;

  const list = document.createElement("ul");
  list.className = "project-split";
  for (const project of projects) {
    const item = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = project.nome;
    const detail = document.createElement("span");
    detail.textContent = [
      project.empresa_nome,
      [project.municipio, project.uf].filter(Boolean).join(" / "),
      project.valor_capex,
    ].filter(Boolean).join(" · ");
    item.append(name, detail);
    list.append(item);
  }

  const save = document.createElement("button");
  save.className = "button";
  save.type = "button";
  save.textContent = `Salvar os ${projects.length} projetos desta notícia`;
  save.addEventListener("click", async () => {
    if (!form.reportValidity()) return;
    const body = new URLSearchParams({
      url: form.elements.url.value,
      id_fonte: form.elements.id_fonte.value,
      titulo: text.value.split("\n")[0].slice(0, 240),
      projetos: JSON.stringify(projects),
    });
    const response = await fetch("/projetos/lote", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      redirect: "follow",
    });
    window.location.href = response.url || "/projetos";
  });
  projectSplit.append(list, save);
}

button?.addEventListener("click", async () => {
  button.disabled = true;
  status.textContent = "Extraindo informações…";
  try {
    const response = await fetch("/api/extrair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha na extração");
    const projects = Array.isArray(data.projetos) ? data.projetos : [];
    if (!projects.length) throw new Error("Nenhum projeto encontrado");

    fillForm(projects[0]);
    if (!form.elements.titulo.value) {
      form.elements.titulo.value = text.value.split("\n")[0].slice(0, 240);
    }
    showProjects(projects);
    showCompanyDecision(projects.length === 1 ? projects[0].empresa_identificacao : null);
    status.textContent = projects.length > 1
      ? `${projects.length} projetos nesta notícia. Eles compartilham a mesma URL.`
      : "Rascunho preenchido. Revise antes de salvar.";
  } catch (error) {
    showCompanyDecision(null);
    showProjects([]);
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
