const fs = require("node:fs");
const path = require("node:path");
const { esc, date } = require("./html");

const AMOSTRAS = path.join(__dirname, "..", "amostras");
const RAW_LIMIT = 3000;
const RECORD_LIMIT = 3;
const VALUE_LIMIT = 400;

function safeCode(codigo) {
  return /^[A-Z0-9-]+$/.test(String(codigo || "")) ? codigo : null;
}

// Primeiro arquivo bruto da pasta da fonte, cortado para caber na página, e o LEIA.txt.
function readRawSample(codigo) {
  const code = safeCode(codigo);
  if (!code) return null;
  const dir = path.join(AMOSTRAS, code);
  let files;
  try {
    files = fs.readdirSync(dir).filter((file) => file !== "LEIA.txt").sort();
  } catch {
    return null;
  }
  let leia = null;
  try {
    leia = fs.readFileSync(path.join(dir, "LEIA.txt"), "utf8").trim();
  } catch {
    leia = null;
  }
  // Fonte sem registro público acessível: a pasta só tem o LEIA com o que foi tentado.
  if (!files.length) return leia ? { arquivo: null, outros: [], bytes: 0, conteudo: "", cortado: false, leia } : null;
  const arquivo = files[0];
  const buffer = fs.readFileSync(path.join(dir, arquivo));
  const text = buffer.toString("utf8");
  return {
    arquivo: `amostras/${code}/${arquivo}`,
    outros: files.slice(1).map((file) => `amostras/${code}/${file}`),
    bytes: buffer.length,
    conteudo: text.length > RAW_LIMIT ? `${text.slice(0, RAW_LIMIT)}\n…` : text,
    cortado: text.length > RAW_LIMIT,
    leia,
  };
}

function valueText(value) {
  if (value === null || value === undefined || value === "") return "—";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > VALUE_LIMIT ? `${text.slice(0, VALUE_LIMIT)}…` : text;
}

function recordHtml(record, index) {
  const rows = Object.entries(record || {}).map(([key, value]) => {
    const cell = typeof value === "string" && /^https?:\/\//.test(value)
      ? `<a href="${esc(value)}" target="_blank" rel="noopener">${esc(valueText(value))}</a>`
      : esc(valueText(value));
    return `<tr><th scope="row"><code>${esc(key)}</code></th><td>${cell}</td></tr>`;
  }).join("");
  return `
    <div class="sample-record">
      <h4>Registro ${index + 1}</h4>
      <table class="sample-table"><tbody>${rows}</tbody></table>
    </div>`;
}

function sampleSectionHtml({ raw, evidence, manual = false }) {
  if (!raw && !evidence && !manual) return "";
  const rawHtml = raw && !raw.arquivo
    ? `
      <h3>1. Como o dado chega da fonte</h3>
      <p class="muted">Não há arquivo bruto: a fonte não devolveu registro público na última tentativa. O LEIA.txt diz o que foi testado.</p>
      <pre class="sample-raw"><code>${esc(raw.leia)}</code></pre>`
    : raw
    ? `
      <h3>1. Como o dado chega da fonte</h3>
      <p class="muted">Arquivo bruto guardado em <code>${esc(raw.arquivo)}</code>, no formato original (${esc(raw.bytes)} bytes${raw.cortado ? `; a página mostra os primeiros ${RAW_LIMIT} caracteres` : ""}).${raw.outros.length ? ` Outros arquivos: ${raw.outros.map((file) => `<code>${esc(file)}</code>`).join(", ")}.` : ""}</p>
      <pre class="sample-raw"><code>${esc(raw.conteudo)}</code></pre>
      ${raw.leia ? `<details class="sample-leia"><summary>LEIA.txt da amostra</summary><pre class="sample-raw"><code>${esc(raw.leia)}</code></pre></details>` : ""}`
    : `<h3>1. Como o dado chega da fonte</h3><p class="muted">Sem arquivo bruto guardado em amostras/ para esta fonte.</p>`;
  const linhas = Array.isArray(evidence?.linhas) ? evidence.linhas : [];
  const evidenceHtml = manual
    ? `<h3>2. Como o dado entra na ficha</h3><p class="muted">Esta fonte não tem conector, então o Radar não grava registros dela sozinho. Na consulta manual, os campos do registro acima viram uma evidência secundária, com o link da publicação.</p>`
    : linhas.length
    ? `
      <h3>2. Como o Radar guarda o dado extraído</h3>
      <p class="muted">Registros da evidência mais recente desta fonte, coletada em ${esc(date(evidence.coletado_em))} para o projeto <a href="/projetos/${esc(evidence.projeto_id)}">${esc(evidence.projeto_nome)}</a>. A ficha guarda ${esc(linhas.length)} registro(s); a página mostra até ${RECORD_LIMIT}.</p>
      <p><strong>Anotação gravada.</strong> ${esc(evidence.titulo_ou_resumo || "—")}</p>
      <div class="sample-records">${linhas.slice(0, RECORD_LIMIT).map(recordHtml).join("")}</div>`
    : `<h3>2. Como o Radar guarda o dado extraído</h3><p class="muted">Nenhuma ficha recebeu evidência desta fonte ainda. Os campos guardados estão descritos em "Formato dos dados extraídos".</p>`;
  return `
    <section class="source-sample">
      <h2>Amostra de extração</h2>
      <p>Exemplo real do caminho do dado: o registro como a origem publica e o mesmo dado depois que o Radar filtra, recorta e grava na ficha.</p>
      ${rawHtml}
      ${evidenceHtml}
    </section>`;
}

module.exports = { readRawSample, sampleSectionHtml };
