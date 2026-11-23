// Diagnóstico das fontes secundárias: por que não geram evidência (ou geram
// pouca). Exporta, por fonte, a contagem por categoria de perda
// (src/fontes-diagnostico.js) e uma amostra dos registros de cada categoria,
// para o Claude Code analisar (docs/claude-code/diagnostico-fontes.md) e
// escrever docs/diagnostico-fontes.json, que a página
// /fontes/hub/diagnostico mostra. Só lê o banco.
//
// Uso:
//   npm run capex:diagnostico-fontes -- exportar --saida <pasta> [--amostra 4]
const fs = require("node:fs");
const path = require("node:path");
const { pool } = require("../src/db");
const diag = require("../src/fontes-diagnostico");

function argumentos(argv) {
  const [comando, ...resto] = argv;
  const args = { comando };
  for (let i = 0; i < resto.length; i += 1) {
    const chave = resto[i].replace(/^--/, "");
    args[chave] = resto[i + 1] && !resto[i + 1].startsWith("--") ? resto[++i] : true;
  }
  return args;
}

// O essencial do registro bruto: nome, local, data e um pedaço do texto.
function compacto(registro = {}) {
  const { contexto, areas, cnaes, vinculos, ...resto } = registro || {};
  const campos = Object.fromEntries(Object.entries(resto).filter(([, v]) => v != null && v !== "" && typeof v !== "object").slice(0, 14)
    .map(([k, v]) => [k, String(v).slice(0, 160)]));
  return { ...campos, ...(contexto ? { contexto: String(contexto).slice(0, 500) } : {}) };
}

async function exportar(args) {
  if (!args.saida) throw new Error("Informe --saida <pasta>");
  const porCategoria = Number(args.amostra) || 4;
  fs.mkdirSync(args.saida, { recursive: true });
  const dados = await diag.dadosDiagnostico(pool);
  const saida = [];
  for (const f of dados.fontes) {
    const { rows } = await pool.query(
      `select r.classe, r.correlacao, r.motivo, r.probabilidade, r.data_registro, r.registro,
              p.titulo as projeto, p.uf as projeto_uf, p.municipio as projeto_municipio
         from capex_radar.registros_analisados r
         join capex_radar.projetos p on p.id = r.projeto_id and p.status <> 'descartado'
        where r.fonte_codigo = $1
        order by md5(r.chave)
        limit 400`,
      [f.fonte_codigo],
    );
    const amostras = {};
    for (const r of rows) {
      const cat = diag.categoriaDaPerda(r);
      amostras[cat] ||= [];
      if (amostras[cat].length >= porCategoria) continue;
      amostras[cat].push({
        projeto: `${r.projeto} (${r.projeto_municipio || "?"}/${r.projeto_uf || "?"})`,
        classe: r.classe, probabilidade: r.probabilidade, motivo: r.motivo,
        data: r.data_registro ? new Date(r.data_registro).toISOString().slice(0, 10) : null,
        registro: compacto(r.registro),
      });
    }
    saida.push({ fonte_codigo: f.fonte_codigo, nome: f.nome, consultas: f.consultas, total: f.total, categorias: f.categorias, amostras });
  }
  fs.writeFileSync(path.join(args.saida, "_fontes.json"), JSON.stringify({ categorias: diag.CATEGORIAS, fontes: saida }, null, 1));
  fs.copyFileSync(path.join(__dirname, "..", "docs", "claude-code", "diagnostico-fontes.md"), path.join(args.saida, "LEIA.md"));
  console.log(`${saida.length} fontes exportadas em ${args.saida}`);
}

async function main() {
  const args = argumentos(process.argv.slice(2));
  const comandos = { exportar };
  if (!comandos[args.comando]) throw new Error(`Comandos: ${Object.keys(comandos).join(", ")}`);
  await comandos[args.comando](args);
}

main()
  .catch((error) => {
    console.error(`Falha: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
