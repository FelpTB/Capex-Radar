// Gera docs/diarios-oficiais-estaduais.md: um documento só, com uma seção por UF.
// É o texto que vai para o Notion. Sai das mesmas fontes que montam /fontes/{codigo}:
// src/doe-registry.js, src/source-extraction.js, src/source-native.js, source-guides e source-origin.
const fs = require("node:fs");
const path = require("node:path");
const { EXTRACAO, REGRA_CORRELACAO } = require("../src/source-extraction");
const { NATIVE } = require("../src/source-native");
const { sourceGuide } = require("../src/source-guides");
const { sourceOrigin } = require("../src/source-origin");
const { doeEstado, PASSOS_COMUNS } = require("../src/doe-registry");
const { DOE_UFS } = require("../src/enrichment/viability");

const UF_NOMES = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul",
  MT: "Mato Grosso", PA: "Pará", PB: "Paraíba", PE: "Pernambuco", PI: "Piauí", PR: "Paraná",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul",
  SC: "Santa Catarina", SE: "Sergipe", SP: "São Paulo", TO: "Tocantins",
};

const cell = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const amostras = (codigo) => {
  try {
    return fs.readdirSync(path.join(__dirname, "..", "amostras", codigo)).map((file) => `amostras/${codigo}/${file}`);
  } catch {
    return [];
  }
};

function mecanismo(codigo) {
  const estado = doeEstado(codigo);
  if (estado?.motor === "indice_pdf") return "Índice de PDFs do Radar";
  if (estado?.motor === "ionews") return "API de busca (motor IONEWS)";
  if (["CAPTURA-DOE-BA", "CAPTURA-DOE-PR"].includes(codigo)) return "API de busca (motor IONEWS)";
  return "API ou página de busca própria";
}

const out = [
  "# Diários oficiais estaduais no Radar CapEx",
  "",
  `Gerado por \`npm run docs:doe\` em ${new Date().toISOString().slice(0, 10)}, a partir do registro dos diários (\`src/doe-registry.js\`) e dos módulos que montam o hub de fontes. Edite lá, não aqui. Cada seção corresponde à página \`/fontes/CAPTURA-DOE-{UF}\` do MVP.`,
  "",
  "## Resumo",
  "",
  "As 27 UFs estão conectadas ao fluxo de enriquecimento. A ficha escolhe o diário pela UF do projeto e procura a raiz do CNPJ e o nome da empresa. 23 estados têm busca pública no portal, que o Radar chama ao vivo. PA, PB, RO e RR só publicam o PDF da edição: o Radar baixa as edições, extrai o texto de cada página e consulta o próprio índice.",
  "",
  "| UF | Diário | Como o Radar lê | Unidade | Acervo |",
  "| --- | --- | --- | --- | --- |",
];

for (const uf of DOE_UFS) {
  const codigo = `CAPTURA-DOE-${uf}`;
  const guide = sourceGuide(codigo);
  const estado = doeEstado(codigo);
  out.push(`| ${uf} | ${cell(guide?.nome)} | ${mecanismo(codigo)} | ${cell(estado?.unidade || (uf === "SP" ? "ato" : uf === "MG" ? "trecho" : "página"))} | ${cell(estado?.acervo || sourceOrigin(codigo)?.publicacao || "")} |`);
}

out.push(
  "",
  "## Fluxo comum",
  "",
  "1. A ficha do projeto tem UF, município, CNPJ e razão social da empresa. A UF escolhe o diário (`src/enrichment/viability.js`).",
  "2. O conector busca a raiz do CNPJ com máscara (XX.XXX.XXX) e o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI), desde 2015.",
  ...PASSOS_COMUNS.map((passo, index) => `${index + 3}. ${passo}`),
  "",
  "### Índice de PDFs (PA, PB, RO, RR)",
  "",
  "- Tabelas `doe_pdf_edicao` (uma linha por PDF lido) e `doe_pdf_pagina` (texto, texto compacto e raízes de CNPJ de cada página), criadas em `sql/016_doe_pdf_indice.sql`.",
  "- Carga: `npm run doe:pdf-sync -- --dias N [--uf PA,RO]`. O agendador do servidor relê todo dia os últimos 7 dias; cada rodada grava uma linha em `base_carga`, que aparece na página da fonte.",
  "- A ficha consulta o índice por `raizes @> array[raiz]` ou pelo nome colado no texto compacto. O portal só é chamado pelo sincronizador.",
  "",
  "### Correlação direta com o projeto",
  "",
  ...REGRA_CORRELACAO.flatMap((item) => [item, ""]),
);

for (const uf of DOE_UFS) {
  const codigo = `CAPTURA-DOE-${uf}`;
  const guide = sourceGuide(codigo);
  const origem = sourceOrigin(codigo);
  const extracao = EXTRACAO[codigo];
  const native = NATIVE[codigo];
  const estado = doeEstado(codigo);
  out.push(`## ${uf} — ${UF_NOMES[uf]}`, "");
  out.push(`**${guide?.nome || codigo}** · código \`${codigo}\``, "");
  out.push(`- **Situação:** conectado. ${mecanismo(codigo)}.`);
  if (origem?.orgao) out.push(`- **Órgão:** ${origem.orgao}`);
  out.push(`- **Portal:** <${guide?.url}>`);
  for (const link of origem?.links || []) if (link.url !== guide?.url) out.push(`- **${link.papel}:** \`${link.url}\``);
  if (estado?.acervo) out.push(`- **Acervo:** ${estado.acervo}`);
  if (estado?.atos) out.push(`- **O que se acha:** ${estado.atos}.`);
  out.push("");
  if (extracao?.formato?.length) out.push("### Como o portal funciona e como o dado aparece", "", ...extracao.formato.map((item) => `- ${item}`), "");
  if (native) {
    out.push("### Campos do dado", "", native.meio, "");
    for (const grupo of native.grupos) {
      out.push(`**${grupo.nome}**`, "", "| Campo | Tipo | O que é e o que a ficha faz |", "| --- | --- | --- |");
      for (const [chave, tipo, detalhe] of grupo.campos) out.push(`| \`${cell(chave)}\` | ${cell(tipo)} | ${cell(detalhe)} |`);
      out.push("");
    }
  }
  if (extracao?.requisicoes?.length) {
    out.push("### Chamadas feitas pelo Radar", "");
    for (const item of extracao.requisicoes) {
      out.push(`\`${item.metodo} ${item.url}\``, "");
      if (item.parametros.length) {
        out.push("| Parâmetro | Valor | Para quê |", "| --- | --- | --- |");
        for (const [nome, valor, funcao] of item.parametros) out.push(`| \`${cell(nome)}\` | \`${cell(valor)}\` | ${cell(funcao)} |`);
        out.push("");
      }
      if (item.nota) out.push(item.nota, "");
    }
  }
  if (extracao?.passos?.length) out.push("### Passo a passo da extração", "", ...extracao.passos.map((passo, index) => `${index + 1}. ${passo}`), "");
  if (extracao?.correlacao?.length) out.push("### Particularidades da correlação", "", ...extracao.correlacao.map((item) => `- ${item}`), "");
  if (guide?.alcance?.length) out.push("### Limitações", "", ...guide.alcance.map((item) => `- ${item}`), "");
  const arquivos = amostras(codigo);
  if (arquivos.length) out.push("### Amostra bruta", "", ...arquivos.map((file) => `- \`${file}\``), "");
}

const target = path.join(__dirname, "..", "docs", "diarios-oficiais-estaduais.md");
fs.writeFileSync(target, out.join("\n"));
console.log(`Gravado ${path.relative(process.cwd(), target)} (${DOE_UFS.length} UFs)`);
