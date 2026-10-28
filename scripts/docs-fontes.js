// Gera docs/fontes-estaduais-municipais.md a partir de src/source-extraction.js e src/source-native.js.
const fs = require("node:fs");
const path = require("node:path");
const { EXTRACAO, REGRA_CORRELACAO } = require("../src/source-extraction");
const { NATIVE } = require("../src/source-native");
const { sourceGuide } = require("../src/source-guides");
const { DOE_ESTADOS } = require("../src/doe-registry");

const cell = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const out = [
  "# Fontes estaduais e municipais",
  "",
  "Gerado por `npm run docs:fontes` a partir de `src/source-extraction.js`, `src/source-native.js` e `src/doe-registry.js`. Edite lá, não aqui.",
  "A mesma documentação aparece em `/fontes/{codigo}`.",
  "",
  "## Correlação direta com o projeto",
  "",
  ...REGRA_CORRELACAO.flatMap((item) => [item, ""]),
  "## Diários estaduais sem busca no portal",
  "",
  "Estes estados só publicam o PDF da edição. O Radar mantém um índice próprio (`npm run doe:pdf-sync`, agendador diário) e a ficha consulta o índice. O documento completo dos 27 diários está em `docs/diarios-oficiais-estaduais.md` (`npm run docs:doe`).",
  "",
  "| UF | Diário | Listagem lida pelo sincronizador |",
  "| --- | --- | --- |",
  ...DOE_ESTADOS.filter((item) => item.motor === "indice_pdf").map((item) => `| ${item.uf} | ${cell(item.nome)} | \`${cell(item.busca)}\` |`),
  "",
];

for (const [codigo, doc] of Object.entries(EXTRACAO)) {
  const guide = sourceGuide(codigo);
  const native = NATIVE[codigo];
  out.push(`## ${codigo} — ${guide?.nome || codigo}`, "");
  if (guide?.url) out.push(`Publicação original: <${guide.url}>`, "");
  out.push("### Como o dado aparece na fonte", "", ...doc.formato.flatMap((item) => [item, ""]));
  if (native) {
    out.push(`Suporte: ${native.meio}`, "");
    for (const grupo of native.grupos) {
      out.push(`#### ${grupo.nome}`, "", "| Campo | Tipo | O que é e o que a ficha faz |", "| --- | --- | --- |");
      for (const [chave, tipo, detalhe] of grupo.campos) out.push(`| \`${cell(chave)}\` | ${cell(tipo)} | ${cell(detalhe)} |`);
      out.push("");
    }
  }
  out.push("### Chamadas feitas pelo Radar", "");
  for (const item of doc.requisicoes) {
    out.push(`\`${item.metodo} ${item.url}\``, "");
    if (item.parametros.length) {
      out.push("| Parâmetro | Valor | Para quê |", "| --- | --- | --- |");
      for (const [nome, valor, funcao] of item.parametros) out.push(`| \`${cell(nome)}\` | \`${cell(valor)}\` | ${cell(funcao)} |`);
      out.push("");
    }
    if (item.nota) out.push(item.nota, "");
  }
  out.push("### Passo a passo da extração", "", ...doc.passos.map((step, index) => `${index + 1}. ${step}`), "");
  if (doc.correlacao?.length) out.push("### Correlação nesta fonte", "", ...doc.correlacao.flatMap((item) => [item, ""]));
}

const target = path.join(__dirname, "..", "docs", "fontes-estaduais-municipais.md");
fs.writeFileSync(target, out.join("\n"));
console.log(`Gravado ${path.relative(process.cwd(), target)}`);
