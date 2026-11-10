// Acessos MCP ao Radar CapEx: cria, lista e revoga tokens pessoais.
//
// Uso:
//   npm run capex:mcp -- criar --nome "Maria Souza" --email maria@abcadvise.com.br --papel edicao
//   npm run capex:mcp -- listar
//   npm run capex:mcp -- revogar --email maria@abcadvise.com.br
//   npm run capex:mcp -- uso [--email maria@abcadvise.com.br] [--limite 50]
//
// O token aparece uma única vez, na criação; o banco guarda só o hash. Para
// trocar um token, revogue e crie outro. Papéis: leitura | edicao.
// Endereço mostrado nas instruções: RADAR_URL, ou o do Railway por padrão.
const { Client } = require("pg");
const { getConfig } = require("../src/config");
const mcp = require("../src/capex-mcp");

function argumentos(argv) {
  const [comando, ...resto] = argv;
  const args = { comando, limite: 30 };
  for (let i = 0; i < resto.length; i += 1) {
    const chave = resto[i];
    if (!chave.startsWith("--")) throw new Error(`Argumento desconhecido: ${chave}`);
    args[chave.slice(2)] = resto[++i];
  }
  return args;
}

async function criar(client, args) {
  if (!args.nome || !args.email) throw new Error('Informe --nome "Nome Sobrenome" e --email.');
  const papel = args.papel || "leitura";
  if (!mcp.PAPEIS.includes(papel)) throw new Error(`Papel inválido: ${papel}. Use ${mcp.PAPEIS.join(" ou ")}.`);
  const email = args.email.trim().toLowerCase();
  const { rows: ativos } = await client.query(
    "select id from capex_radar.mcp_acessos where lower(email) = $1 and revogado_em is null",
    [email],
  );
  if (ativos.length) throw new Error(`${email} já tem um acesso ativo. Revogue antes de criar outro.`);
  const token = mcp.gerarToken();
  await client.query("select set_config('capex_radar.ator', 'usuario:admin:capex-mcp', false)");
  await client.query(
    `insert into capex_radar.mcp_acessos (nome, email, papel, token_hash, token_inicio)
     values ($1, $2, $3, $4, $5)`,
    [args.nome.trim(), email, papel, mcp.hashToken(token), token.slice(0, 10)],
  );
  const base = (process.env.RADAR_URL || "https://capex-radar-buscafornecedor.up.railway.app").replace(/\/+$/, "");
  console.log(`Acesso criado para ${args.nome} <${email}>, papel ${papel}.

Token (aparece só agora; envie por um canal privado):
  ${token}

Claude Code:
  claude mcp add --transport http radar-capex ${base}/mcp --header "Authorization: Bearer ${token}"

Claude Desktop / claude.ai (Configurações > Conectores > Adicionar conector personalizado):
  ${base}/mcp/${token}
`);
}

async function listar(client) {
  const { rows } = await client.query(
    `select a.nome, a.email, a.papel, a.token_inicio, a.criado_em, a.revogado_em, a.ultimo_uso_em,
            (select count(*)::int from capex_radar.mcp_uso u where u.acesso_id = a.id) as chamadas
       from capex_radar.mcp_acessos a
      order by a.revogado_em is not null, a.nome`,
  );
  if (!rows.length) return console.log("Nenhum acesso criado.");
  for (const r of rows) {
    const situacao = r.revogado_em ? `revogado em ${r.revogado_em.toISOString().slice(0, 10)}` : "ativo";
    const uso = r.ultimo_uso_em ? `último uso ${r.ultimo_uso_em.toISOString().slice(0, 16).replace("T", " ")}` : "nunca usado";
    console.log(`${r.nome.padEnd(28)} ${r.email.padEnd(36)} ${r.papel.padEnd(8)} ${r.token_inicio}…  ${situacao}, ${uso}, ${r.chamadas} chamadas`);
  }
}

async function revogar(client, args) {
  if (!args.email) throw new Error("Informe --email.");
  const { rows } = await client.query(
    `update capex_radar.mcp_acessos set revogado_em = now()
      where lower(email) = lower($1) and revogado_em is null returning nome`,
    [args.email.trim()],
  );
  console.log(rows.length ? `Acesso de ${rows[0].nome} revogado.` : "Nenhum acesso ativo com esse e-mail.");
}

async function uso(client, args) {
  const { rows } = await client.query(
    `select u.em, a.nome, u.ferramenta, u.ok, u.erro, u.argumentos
       from capex_radar.mcp_uso u join capex_radar.mcp_acessos a on a.id = u.acesso_id
      where $1::text is null or lower(a.email) = lower($1)
      order by u.em desc limit $2`,
    [args.email || null, Number(args.limite) || 30],
  );
  for (const r of rows) {
    console.log(`${r.em.toISOString().slice(0, 16).replace("T", " ")}  ${r.nome.padEnd(24)} ${r.ferramenta.padEnd(24)} ${r.ok ? "ok" : `ERRO ${r.erro}`}  ${JSON.stringify(r.argumentos)}`);
  }
  if (!rows.length) console.log("Nenhuma chamada registrada.");
}

async function main() {
  const args = argumentos(process.argv.slice(2));
  const comandos = { criar, listar, revogar, uso };
  if (!comandos[args.comando]) throw new Error("Comando: criar | listar | revogar | uso");
  const config = getConfig();
  const client = new Client({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await comandos[args.comando](client, args);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
