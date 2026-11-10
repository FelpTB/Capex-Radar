// Fontes secundárias e linha do tempo dos maiores projetos da carteira.
//
// Uso:
//   npm run capex:secundarias -- --listar            mostra os projetos escolhidos, sem consultar nada
//   npm run capex:secundarias                        os 20 maiores por valor (ativos e em revisão)
//   npm run capex:secundarias -- --limite 5          os 5 maiores
//   npm run capex:secundarias -- --so linha          refaz só a linha do tempo
//
// As consultas usam as bases carregadas no banco (enr_*), o CNO local
// (pasta cno/) e os diários e portais ao vivo. A correlação de cada registro
// usa CLAUDE_DECISION_MODEL; a linha do tempo, CLAUDE_FILTER3_MODEL.
const { Client } = require("pg");
const { getConfig } = require("../src/config");
const { criarCliente } = require("../src/claude");
const sec = require("../src/capex-fontes-secundarias");

function argumentos(argv) {
  const args = { limite: 20, listar: false };
  for (let i = 0; i < argv.length; i += 1) {
    const chave = argv[i];
    if (chave === "--listar") args.listar = true;
    else if (chave === "--limite") args.limite = Number(argv[++i]);
    else if (chave === "--so") args.so = argv[++i];
    else throw new Error(`Argumento desconhecido: ${chave}`);
  }
  if (args.so && !["fontes", "linha"].includes(args.so)) throw new Error("--so aceita fontes ou linha");
  return args;
}

async function main() {
  const args = argumentos(process.argv.slice(2));
  const config = getConfig();
  const client = new Client({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const projetos = await sec.maioresProjetos(client, args.limite);
    for (const [i, p] of projetos.entries()) {
      const valor = p.valor_estimado_brl == null ? "sem valor" : `R$ ${(Number(p.valor_estimado_brl) / 1e6).toLocaleString("pt-BR")} mi`;
      console.log(`${String(i + 1).padStart(2)}. ${p.titulo} · ${p.status} · ${valor} · ${p.municipio || "—"}/${p.uf || "—"}`);
    }
    if (args.listar) return;
    const anthropic = criarCliente(config.claudeApiKey);
    if (!anthropic) throw new Error("CLAUDE_API_KEY não configurada.");
    if (args.so !== "linha") {
      console.log("\nFontes secundárias:");
      await sec.consultarFontes(client, projetos, { log: (m) => console.log(`  ${m}`) });
    }
    if (args.so !== "fontes") {
      console.log("\nLinha do tempo:");
      const cronista = sec.criarCronista({ client: anthropic, modelo: config.claudeFilter3Model });
      for (const p of projetos) {
        try {
          const r = await sec.montarLinhaDoTempo(client, p, cronista);
          console.log(`  ${p.titulo}: ${r ? `${r.marcos.length} marco(s) de ${r.evidencias} evidência(s)${r.estagio_mudou ? `, estágio ${r.estagio_mudou}` : ""}` : "sem evidências"}`);
        } catch (error) {
          console.log(`  ${p.titulo}: erro (${error.message})`);
        }
      }
    }
  } finally {
    await client.end();
    await require("../src/db").pool.end();
  }
}

main().catch((error) => {
  console.error(`Falha: ${error.message}`);
  process.exitCode = 1;
});
