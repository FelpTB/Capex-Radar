const test = require("node:test");
const assert = require("node:assert/strict");

// capex-mcp importa db.js, que exige a URI do banco; o pool não conecta sem consulta.
process.env.SUPABASE_STRING ||= "postgres://teste:teste@localhost:5432/teste";
const express = require("express");
const mcp = require("../src/capex-mcp");

const PROJETO = "11111111-1111-4111-8111-111111111111";
const NOTICIA = "22222222-2222-4222-8222-222222222222";

// Banco falso: autentica um token conhecido e guarda o que foi auditado.
function bancoFalso(acessos = {}) {
  const usos = [];
  return {
    usos,
    async query(sql, params) {
      if (sql.includes("mcp_acessos set ultimo_uso_em")) {
        const acesso = acessos[params[0]];
        return { rows: acesso ? [acesso] : [] };
      }
      if (sql.includes("insert into capex_radar.mcp_uso")) {
        usos.push({ ferramenta: params[1], argumentos: JSON.parse(params[2]), ok: params[3], erro: params[4] });
        return { rows: [] };
      }
      if (sql.includes("from capex_radar.grupos")) return { rows: [{ id: "g1", nome: "Bracell" }] };
      throw new Error(`consulta inesperada: ${sql}`);
    },
  };
}

function painelFalso() {
  const chamadas = [];
  return {
    chamadas,
    async carteira() {
      return [
        { id: PROJETO, titulo: "Bracell — fábrica MS", grupo: "Bracell", uf: "MS", municipio: "Bataguassu", valor_estimado_brl: "25000000000", estagio: "licenciamento", status: "em_revisao", secundarias: { fontes: [] } },
        { id: "p2", titulo: "Suzano — terminal", grupo: "Suzano", uf: "SP", valor_estimado_brl: "1000000000", estagio: "anuncio", status: "ativo" },
      ];
    },
    async alterarStatusProjeto(id, status, opcoes) {
      chamadas.push({ id, status, ...opcoes });
      return { id, status, alterado: true };
    },
    async atualizarProjeto(id, campos, opcoes) {
      chamadas.push({ id, campos, ...opcoes });
      return { id, ...campos };
    },
  };
}

const LEITOR = { id: "a1", nome: "Ana Leitora", email: "ana@abc.com", papel: "leitura" };
const EDITOR = { id: "a2", nome: "Edu Editor", email: "edu@abc.com", papel: "edicao" };

test("token: prefixo, aleatório e só o hash vai para o banco", () => {
  const a = mcp.gerarToken();
  const b = mcp.gerarToken();
  assert.ok(a.startsWith("cxr_"));
  assert.notEqual(a, b);
  assert.equal(mcp.hashToken(a), mcp.hashToken(a));
  assert.equal(mcp.hashToken(a).length, 64);
  assert.ok(!mcp.hashToken(a).includes(a.slice(4)));
});

test("token vem do Bearer ou do caminho /mcp/<token>", () => {
  assert.equal(mcp.tokenDaRequisicao({ headers: { authorization: "Bearer cxr_abc" } }), "cxr_abc");
  assert.equal(mcp.tokenDaRequisicao({ headers: {}, params: { token: "cxr_xyz" } }), "cxr_xyz");
  assert.equal(mcp.tokenDaRequisicao({ headers: {} }), null);
});

test("papel leitura não vê ferramentas de edição", () => {
  const leitura = mcp.ferramentasDoPapel("leitura").map((f) => f.nome);
  const edicao = mcp.ferramentasDoPapel("edicao").map((f) => f.nome);
  assert.ok(leitura.includes("buscar_projetos"));
  assert.ok(!leitura.includes("alterar_status_projeto"));
  assert.ok(!leitura.includes("aprovar_noticia"));
  assert.ok(edicao.includes("alterar_status_projeto"));
  assert.ok(edicao.length > leitura.length);
  // Nada de excluir nem de rodar SQL livre.
  assert.ok(!edicao.some((n) => /exclu|sql|deletar/.test(n)));
});

test("edição grava com o ator da pessoa e fica auditada", async () => {
  const db = bancoFalso();
  const painel = painelFalso();
  const f = mcp.ferramentasDoPapel("edicao", { db, painel }).find((x) => x.nome === "alterar_status_projeto");
  const r = await mcp.chamarFerramenta(f, { id: PROJETO, status: "ativo" }, EDITOR, { db });
  assert.ok(!r.isError);
  assert.equal(painel.chamadas[0].ator, "usuario:mcp:edu@abc.com");
  assert.deepEqual(db.usos, [{ ferramenta: "alterar_status_projeto", argumentos: { id: PROJETO, status: "ativo" }, ok: true, erro: null }]);
});

test("descartar projeto exige motivo; o erro volta legível e auditado", async () => {
  const db = bancoFalso();
  const painel = painelFalso();
  const f = mcp.ferramentasDoPapel("edicao", { db, painel }).find((x) => x.nome === "alterar_status_projeto");
  const r = await mcp.chamarFerramenta(f, { id: PROJETO, status: "descartado" }, EDITOR, { db });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /motivo/);
  assert.equal(painel.chamadas.length, 0);
  assert.equal(db.usos[0].ok, false);
});

test("entrada inválida não chega ao banco", async () => {
  const db = bancoFalso();
  const painel = painelFalso();
  const f = mcp.ferramentasDoPapel("edicao", { db, painel }).find((x) => x.nome === "atualizar_projeto");
  const r = await mcp.chamarFerramenta(f, { id: "nao-e-uuid", estagio: "obra" }, EDITOR, { db });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /id/);
  assert.equal(painel.chamadas.length, 0);
});

test("buscar_projetos filtra e ordena por valor", async () => {
  const f = mcp.ferramentas({ painel: painelFalso() }).find((x) => x.nome === "buscar_projetos");
  const r = await f.executar({ uf: "ms", ordem: "valor", limite: 10 });
  assert.equal(r.total, 1);
  assert.equal(r.projetos[0].empresa, "Bracell");
  assert.equal(r.projetos[0].valor_estimado_brl, 25e9);
  assert.equal(r.projetos[0].fontes_secundarias, true);
  const todos = await f.executar({ ordem: "valor" });
  assert.deepEqual(todos.projetos.map((p) => p.id), [PROJETO, "p2"]);
});

test("diferenças do log mostram só o que mudou", () => {
  assert.deepEqual(
    mcp.diferencas({ status: "em_revisao", uf: "MS", atualizado_em: 1 }, { status: "ativo", uf: "MS", atualizado_em: 2 }),
    { status: { de: "em_revisao", para: "ativo" } },
  );
});

test("servidor HTTP: sem token 401; com token lista as ferramentas do papel e executa", async () => {
  const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
  const tokenLeitor = mcp.gerarToken();
  const tokenEditor = mcp.gerarToken();
  const db = bancoFalso({ [mcp.hashToken(tokenLeitor)]: LEITOR, [mcp.hashToken(tokenEditor)]: EDITOR });
  const painel = painelFalso();
  const app = express();
  app.use(express.json());
  mcp.registrarMcp(app, { db, painel });
  const servidor = app.listen(0);
  const base = `http://127.0.0.1:${servidor.address().port}`;
  try {
    const semToken = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    assert.equal(semToken.status, 401);

    const conectar = async (url, headers = {}) => {
      const cliente = new Client({ name: "teste", version: "1.0.0" });
      await cliente.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers } }));
      return cliente;
    };

    const leitor = await conectar(`${base}/mcp`, { authorization: `Bearer ${tokenLeitor}` });
    const nomesLeitor = (await leitor.listTools()).tools.map((t) => t.name);
    assert.ok(nomesLeitor.includes("buscar_projetos"));
    assert.ok(!nomesLeitor.includes("atualizar_projeto"));
    await leitor.close();

    // Token no caminho, como no conector do claude.ai.
    const editor = await conectar(`${base}/mcp/${tokenEditor}`);
    const nomesEditor = (await editor.listTools()).tools.map((t) => t.name);
    assert.ok(nomesEditor.includes("atualizar_projeto"));
    const r = await editor.callTool({ name: "atualizar_projeto", arguments: { id: PROJETO, municipio: "Três Lagoas", uf: "ms" } });
    assert.ok(!r.isError, r.content?.[0]?.text);
    assert.deepEqual(painel.chamadas[0], { id: PROJETO, campos: { municipio: "Três Lagoas", uf: "MS" }, ator: "usuario:mcp:edu@abc.com" });
    await editor.close();
  } finally {
    servidor.close();
  }
});
