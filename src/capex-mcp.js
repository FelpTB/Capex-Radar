// Acesso ao Radar CapEx por MCP (Model Context Protocol) para a ABC Advise.
//
// Cada pessoa conecta o próprio cliente (Claude Desktop, claude.ai, Claude
// Code ou outro compatível) em /mcp com um token pessoal. O modelo dela passa
// a consultar a carteira e as notícias e, com o papel 'edicao', a corrigir
// projetos e decidir notícias. As ferramentas chamam as mesmas funções do
// painel (capex-painel-db.js): mesmas regras, nada de SQL livre, sem excluir
// nada e sem disparar as rodadas pagas de IA.
//
// Auditoria: cada chamada vai para capex_radar.mcp_uso; cada escrita também
// cai no log_acao com o ator 'usuario:mcp:<email>'. Ver docs/acesso-mcp.md.
const crypto = require("node:crypto");
const { z } = require("zod");
const { pool } = require("./db");
const painel = require("./capex-painel-db");
const { ESTAGIOS } = require("./capex-ia");

const NOME_SERVIDOR = "radar-capex";
const PAPEIS = ["leitura", "edicao"];
const PREFIXO_TOKEN = "cxr_";

const INSTRUCOES = `Radar CapEx da ABC Advise: carteira de projetos de investimento (CapEx) de 38 grupos empresariais, montada a partir de notícias e de fontes oficiais.
- Projeto: status 'ativo' (confirmado por uma pessoa), 'em_revisao' (criado pelo agente de IA, falta confirmar) ou 'descartado'. Estágios: ${ESTAGIOS.join(", ")}.
- Notícia: passa por filtros de IA; em 'revisar' esperam decisão humana (aprovar como projeto, vincular a um projeto existente ou descartar).
- Comece por resumo_radar ou buscar_projetos. Use ids exatamente como vierem das ferramentas.
- Antes de alterar algo, mostre à pessoa o que vai mudar e confirme. Toda alteração fica registrada com o nome dela.`;

function gerarToken() {
  return PREFIXO_TOKEN + crypto.randomBytes(24).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function atorDe(acesso) {
  return `usuario:mcp:${acesso.email}`;
}

/** Token do cabeçalho Authorization: Bearer, ou do caminho /mcp/<token>. */
function tokenDaRequisicao(req) {
  const cabecalho = req.get?.("authorization") || req.headers?.authorization || "";
  const bearer = /^Bearer\s+(\S+)$/i.exec(cabecalho);
  if (bearer) return bearer[1];
  return req.params?.token || null;
}

/**
 * Quem é a pessoa: token pessoal fixo (cxr_) ou token do login com Google
 * (cxa_, emitido pelo provedor OAuth de capex-mcp-oauth.js).
 */
async function autenticar(token, { db = pool, provedor = null } = {}) {
  if (token && provedor && token.startsWith("cxa_")) {
    const info = await provedor.verifyAccessToken(token).catch(() => null);
    return info?.extra?.acesso || null;
  }
  if (!token || !token.startsWith(PREFIXO_TOKEN)) return null;
  const { rows: [acesso] } = await db.query(
    `update capex_radar.mcp_acessos set ultimo_uso_em = now()
      where token_hash = $1 and revogado_em is null
      returning id, nome, email, papel`,
    [hashToken(token)],
  );
  return acesso || null;
}

async function registrarUso(db, acesso, ferramenta, argumentos, erro) {
  await db.query(
    `insert into capex_radar.mcp_uso (acesso_id, ferramenta, argumentos, ok, erro)
     values ($1, $2, $3, $4, $5)`,
    [acesso.id, ferramenta, JSON.stringify(argumentos || {}), !erro, erro ? String(erro.message || erro).slice(0, 1000) : null],
  ).catch((e) => console.error("[mcp] não registrou o uso:", e.message));
}

// ---------------------------------------------------------------------------
// Formatação das respostas: só o que ajuda o modelo, sem o bruto das fontes.
// ---------------------------------------------------------------------------

function projetoResumido(p) {
  return {
    id: p.id,
    titulo: p.titulo,
    empresa: p.grupo,
    nicho: p.nicho,
    uf: p.uf,
    municipio: p.municipio,
    valor_estimado_brl: p.valor_estimado_brl == null ? null : Number(p.valor_estimado_brl),
    estagio: p.estagio,
    status: p.status,
    evidencias: p.n_evidencias,
    ultima_evidencia_em: p.ultima_evidencia_em,
    fontes_secundarias: Boolean(p.secundarias),
    linha_do_tempo: Boolean(p.linha_tempo),
  };
}

function noticiaResumida(n) {
  const leitura = painel.leituraDaNoticia(n);
  return {
    id: n.id,
    titulo: n.titulo,
    url: n.url,
    veiculo: n.veiculo,
    data: n.data_original,
    empresa: n.grupo,
    triagem: n.triagem,
    motivo: n.triagem_motivo,
    leitura: {
      objeto: leitura.objeto ?? null,
      uf: leitura.uf ?? null,
      municipio: leitura.municipio ?? null,
      valor_brl: leitura.valor_brl ?? null,
      estagio: leitura.estagio ?? null,
    },
    resumo: n.enriquecimento?.resumo || null,
    projeto_sugerido: n.sugerido_projeto_id ? { id: n.sugerido_projeto_id, titulo: n.sugerido_projeto } : null,
    agente: n.agente_decisao ? { decisao: n.agente_decisao, motivo: n.agente_motivo } : null,
  };
}

/** Só os campos que mudaram entre o antes e o depois de um registro do log. */
function diferencas(antes, depois) {
  if (!antes || !depois) return null;
  const ignorar = new Set(["atualizado_em"]);
  const mudou = {};
  for (const chave of new Set([...Object.keys(antes), ...Object.keys(depois)])) {
    if (ignorar.has(chave)) continue;
    if (JSON.stringify(antes[chave]) !== JSON.stringify(depois[chave])) {
      mudou[chave] = { de: antes[chave] ?? null, para: depois[chave] ?? null };
    }
  }
  return mudou;
}

const normalizar = (texto) => String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const contem = (valor, busca) => normalizar(valor).includes(normalizar(busca));

async function gruposPorNome(db, empresa) {
  const { rows } = await db.query("select id, nome from capex_radar.grupos where ativo order by nome");
  return rows.filter((g) => contem(g.nome, empresa));
}

// ---------------------------------------------------------------------------
// Ferramentas. edicao: true só aparece para quem tem o papel 'edicao'.
// ---------------------------------------------------------------------------

const id = (descricao) => z.string().uuid().describe(descricao);
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD").nullable();

function ferramentas(deps = {}) {
  const db = deps.db || pool;
  const p = deps.painel || painel;
  return [
    {
      nome: "resumo_radar",
      titulo: "Resumo do radar",
      descricao: "Visão geral: projetos por status e estágio, e notícias por situação em cada empresa monitorada.",
      entrada: {},
      async executar() {
        const [grupos, projetos] = await Promise.all([p.resumoGrupos(), p.carteira({ incluirDescartados: true })]);
        const contar = (lista, campo) => lista.reduce((acc, item) => ({ ...acc, [item[campo]]: (acc[item[campo]] || 0) + 1 }), {});
        const naCarteira = projetos.filter((x) => x.status !== "descartado");
        return {
          projetos: {
            por_status: contar(projetos, "status"),
            por_estagio: contar(naCarteira, "estagio"),
            valor_total_brl: naCarteira.reduce((s, x) => s + Number(x.valor_estimado_brl || 0), 0),
          },
          empresas: grupos.map((g) => ({
            empresa: g.nome, nicho: g.nicho, projetos: g.projetos,
            noticias_a_revisar: g.revisar, em_processamento: g.processando, ultima_coleta: g.ultima_coleta,
          })),
        };
      },
    },
    {
      nome: "buscar_projetos",
      titulo: "Buscar projetos",
      descricao: "Lista projetos da carteira com filtros. Sem filtros, traz ativos e em revisão, do maior valor para o menor.",
      entrada: {
        texto: z.string().optional().describe("Trecho do título, empresa ou município"),
        empresa: z.string().optional().describe("Nome (ou parte) do grupo empresarial"),
        uf: z.string().length(2).optional(),
        status: z.enum(["ativo", "em_revisao", "descartado"]).optional(),
        estagio: z.enum(ESTAGIOS).optional(),
        valor_minimo_brl: z.number().nonnegative().optional(),
        processados: z.boolean().optional().describe("true: só os que já passaram pelas fontes secundárias; false: só os que não"),
        ordem: z.enum(["valor", "recentes"]).default("valor"),
        limite: z.number().int().min(1).max(100).default(30),
      },
      async executar(a) {
        let lista = await p.carteira({ incluirDescartados: a.status === "descartado" });
        if (a.status) lista = lista.filter((x) => x.status === a.status);
        if (a.texto) lista = lista.filter((x) => [x.titulo, x.grupo, x.municipio].some((v) => contem(v, a.texto)));
        if (a.empresa) lista = lista.filter((x) => contem(x.grupo, a.empresa));
        if (a.uf) lista = lista.filter((x) => String(x.uf || "").toUpperCase() === a.uf.toUpperCase());
        if (a.estagio) lista = lista.filter((x) => x.estagio === a.estagio);
        if (a.valor_minimo_brl != null) lista = lista.filter((x) => Number(x.valor_estimado_brl || 0) >= a.valor_minimo_brl);
        if (a.processados != null) lista = lista.filter((x) => Boolean(x.secundarias) === a.processados);
        if (a.ordem === "valor") lista = [...lista].sort((x, y) => Number(y.valor_estimado_brl || 0) - Number(x.valor_estimado_brl || 0));
        return { total: lista.length, projetos: lista.slice(0, a.limite ?? 30).map(projetoResumido) };
      },
    },
    {
      nome: "obter_projeto",
      titulo: "Detalhes do projeto",
      descricao: "Ficha completa de um projeto: dados, avaliação da IA, linha do tempo com marcos e evidências (notícias e fontes oficiais).",
      entrada: { id: id("Id do projeto") },
      async executar(a) {
        const r = await p.obterProjeto(a.id);
        if (!r) throw new Error("Projeto não encontrado.");
        const { secundarias, ...projeto } = r.projeto;
        return {
          projeto: { ...projeto, fontes_secundarias: secundarias?.fontes || null },
          evidencias: r.timeline.map((t) => ({
            id: t.evidencia_id, titulo: t.titulo, url: t.url, veiculo: t.veiculo,
            data: t.data_original, fonte: t.fonte_nome, primaria: t.primaria,
          })),
        };
      },
    },
    {
      nome: "buscar_noticias",
      titulo: "Buscar notícias",
      descricao: "Notícias coletadas por situação. 'revisar' são as que esperam decisão humana (aprovar, vincular ou descartar).",
      entrada: {
        situacao: z.enum(Object.keys(painel.SITUACOES)).default("revisar"),
        empresa: z.string().optional().describe("Nome (ou parte) do grupo empresarial"),
        texto: z.string().optional().describe("Trecho do título"),
        limite: z.number().int().min(1).max(50).default(20),
      },
      async executar(a) {
        const situacao = a.situacao || "revisar";
        const grupos = a.empresa ? await gruposPorNome(db, a.empresa) : [null];
        if (!grupos.length) throw new Error(`Nenhuma empresa monitorada corresponde a "${a.empresa}".`);
        const listas = await Promise.all(grupos.map((g) => p.listarNoticias({ grupoId: g?.id || null, situacao, limite: 150 })));
        let lista = listas.flat();
        if (a.texto) lista = lista.filter((n) => contem(n.titulo, a.texto));
        lista.sort((x, y) => new Date(y.data_original || 0) - new Date(x.data_original || 0));
        return { total: lista.length, noticias: lista.slice(0, a.limite ?? 20).map(noticiaResumida) };
      },
    },
    {
      nome: "obter_noticia",
      titulo: "Detalhes da notícia",
      descricao: "Notícia completa: texto, leitura e enriquecimento da IA, vínculos e os projetos da mesma empresa (candidatos a vínculo).",
      entrada: { id: id("Id da notícia") },
      async executar(a) {
        const r = await p.obterNoticia(a.id);
        if (!r) throw new Error("Notícia não encontrada.");
        const { conteudo_bruto: _bruto, texto, ...noticia } = r.noticia;
        return {
          noticia: { ...noticia, texto: texto ? String(texto).slice(0, 6000) : null },
          vinculos: r.vinculos.map((v) => ({ projeto_id: v.projeto_id, projeto: v.projeto_titulo, situacao: v.situacao, origem: v.origem, motivo: v.motivo })),
          projetos_da_empresa: r.projetos,
        };
      },
    },
    {
      nome: "historico_alteracoes",
      titulo: "Histórico de alterações",
      descricao: "Quem alterou o quê num projeto ou numa notícia (pessoas, agente de IA, sistema), do mais recente ao mais antigo.",
      entrada: { id: id("Id do projeto ou da notícia"), limite: z.number().int().min(1).max(100).default(30) },
      async executar(a) {
        const { rows } = await db.query(
          `select ator, tabela, operacao, em, antes, depois from capex_radar.log_acao
            where registro_id = $1 or registro_id like $1 || ':%' or registro_id like '%:' || $1
            order by em desc limit $2`,
          [a.id, a.limite ?? 30],
        );
        return rows.map((r) => ({
          em: r.em, ator: r.ator, tabela: r.tabela, operacao: r.operacao,
          mudancas: r.operacao === "UPDATE" ? diferencas(r.antes, r.depois) : undefined,
        }));
      },
    },

    // --- Edição ---------------------------------------------------------------
    {
      nome: "atualizar_projeto",
      titulo: "Corrigir dados do projeto",
      edicao: true,
      descricao: "Corrige campos de um projeto. Informe só o que muda; null apaga o valor. Datas em AAAA-MM-DD.",
      entrada: {
        id: id("Id do projeto"),
        titulo: z.string().min(3).max(200).optional(),
        objeto: z.string().max(2000).nullable().optional(),
        uf: z.string().length(2).nullable().optional(),
        municipio: z.string().max(120).nullable().optional(),
        valor_estimado_brl: z.number().nonnegative().nullable().optional(),
        fonte_valor: z.string().max(200).nullable().optional().describe("De onde veio o valor (ex.: release da empresa, BNDES)"),
        flag_validacao: z.enum(["A_VALIDAR", "ESTIMATIVA_ABC", "CONFIRMADO"]).optional(),
        estagio: z.enum(ESTAGIOS).optional(),
        tendencia: z.enum(["acelerando", "estavel", "desacelerando"]).nullable().optional(),
        data_anuncio: dataIso.optional(),
        data_inicio: dataIso.optional(),
        data_fim: dataIso.optional(),
      },
      async executar({ id: projetoId, ...campos }, ctx) {
        if (campos.uf) campos.uf = campos.uf.toUpperCase();
        return p.atualizarProjeto(projetoId, campos, { ator: ctx.ator });
      },
    },
    {
      nome: "alterar_status_projeto",
      titulo: "Confirmar, revisar ou descartar projeto",
      edicao: true,
      descricao: "Muda o status do projeto: 'ativo' confirma um projeto em revisão; 'em_revisao' devolve para revisão; 'descartado' tira da carteira (reversível, motivo obrigatório).",
      entrada: {
        id: id("Id do projeto"),
        status: z.enum(["ativo", "em_revisao", "descartado"]),
        motivo: z.string().max(500).optional().describe("Obrigatório para descartar"),
      },
      async executar(a, ctx) {
        if (a.status === "descartado" && !a.motivo?.trim()) throw new Error("Informe o motivo do descarte.");
        return p.alterarStatusProjeto(a.id, a.status, { ator: ctx.ator, motivo: a.motivo || null });
      },
    },
    {
      nome: "aprovar_noticia",
      titulo: "Aprovar notícia",
      edicao: true,
      descricao: "Aprova uma notícia: se a IA sugeriu um projeto, vincula a ele; senão cria um projeto novo (ativo) com a leitura da notícia.",
      entrada: { id: id("Id da notícia") },
      async executar(a, ctx) {
        return p.aprovarNoticia(a.id, { ator: ctx.ator });
      },
    },
    {
      nome: "vincular_noticia",
      titulo: "Vincular notícia a projeto",
      edicao: true,
      descricao: "Liga a notícia a um projeto existente da mesma empresa, como evidência dele.",
      entrada: { noticia_id: id("Id da notícia"), projeto_id: id("Id do projeto") },
      async executar(a, ctx) {
        await p.vincularNoticia(a.noticia_id, a.projeto_id, { ator: ctx.ator });
        return { ok: true, noticia_id: a.noticia_id, projeto_id: a.projeto_id };
      },
    },
    {
      nome: "descartar_noticia",
      titulo: "Descartar notícia",
      edicao: true,
      descricao: "Descarta uma notícia que não é projeto de investimento (reversível com restaurar_noticia).",
      entrada: { id: id("Id da notícia"), motivo: z.string().min(3).max(500) },
      async executar(a, ctx) {
        await p.descartarNoticia(a.id, a.motivo, { ator: ctx.ator });
        return { ok: true, id: a.id };
      },
    },
    {
      nome: "restaurar_noticia",
      titulo: "Restaurar notícia descartada",
      edicao: true,
      descricao: "Desfaz o descarte de uma notícia; ela volta para a revisão.",
      entrada: { id: id("Id da notícia") },
      async executar(a, ctx) {
        await p.restaurarNoticia(a.id, { ator: ctx.ator });
        return { ok: true, id: a.id };
      },
    },
  ];
}

function ferramentasDoPapel(papel, deps) {
  return ferramentas(deps).filter((f) => !f.edicao || papel === "edicao");
}

/** Executa uma ferramenta como o MCP faria: valida, roda, audita e formata. */
async function chamarFerramenta(ferramenta, argumentos, acesso, { db = pool } = {}) {
  try {
    const args = z.object(ferramenta.entrada).parse(argumentos || {});
    const resultado = await ferramenta.executar(args, { acesso, ator: atorDe(acesso) });
    await registrarUso(db, acesso, ferramenta.nome, argumentos);
    return { content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }] };
  } catch (error) {
    await registrarUso(db, acesso, ferramenta.nome, argumentos, error);
    const mensagem = error instanceof z.ZodError
      ? error.issues.map((i) => `${i.path.join(".") || "entrada"}: ${i.message}`).join("; ")
      : error.message;
    return { isError: true, content: [{ type: "text", text: `Erro: ${mensagem}` }] };
  }
}

function criarServidorMcp(acesso, deps = {}) {
  const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
  const servidor = new McpServer(
    { name: NOME_SERVIDOR, version: "1.0.0" },
    { instructions: `${INSTRUCOES}\nVocê está conectado como ${acesso.nome} (papel: ${acesso.papel}).` },
  );
  for (const f of ferramentasDoPapel(acesso.papel, deps)) {
    servidor.registerTool(f.nome, {
      title: f.titulo,
      description: f.descricao,
      inputSchema: f.entrada,
      annotations: { readOnlyHint: !f.edicao, destructiveHint: false, openWorldHint: false },
    }, (args) => chamarFerramenta(f, args, acesso, deps));
  }
  return servidor;
}

function erroJsonRpc(res, status, mensagem) {
  res.status(status).json({ jsonrpc: "2.0", error: { code: -32000, message: mensagem }, id: null });
}

/** Rotas /mcp (token no Authorization: Bearer) e /mcp/<token> (para clientes sem cabeçalho). */
function registrarMcp(app, deps = {}) {
  const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
  const { getOAuthProtectedResourceMetadataUrl } = require("@modelcontextprotocol/sdk/server/auth/router.js");
  const oauth = require("./capex-mcp-oauth");
  const config = deps.config || require("./config").getConfig();
  // Login com a conta Google da organização: o cliente MCP descobre e conduz sozinho.
  const provedor = deps.provedor || oauth.criarProvedor({ db: deps.db, config, google: deps.google });
  oauth.registrarOAuth(app, provedor, config);
  const metadados = getOAuthProtectedResourceMetadataUrl(new URL(`${config.radarUrl}/mcp`));
  const tratar = async (req, res) => {
    const acesso = await autenticar(tokenDaRequisicao(req), { ...deps, provedor }).catch((error) => {
      console.error("[mcp] autenticação:", error.message);
      return null;
    });
    if (!acesso) {
      res.set("WWW-Authenticate", `Bearer realm="radar-capex", resource_metadata="${metadados}"`);
      return erroJsonRpc(res, 401, "Entre com a sua conta Google da organização (o cliente MCP abre o login) ou use um token pessoal válido.");
    }
    // Sem sessão: cada requisição sobe um servidor com as ferramentas do papel da pessoa.
    const servidor = criarServidorMcp(acesso, deps);
    const transporte = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      transporte.close();
      servidor.close();
    });
    try {
      await servidor.connect(transporte);
      await transporte.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("[mcp]", error);
      if (!res.headersSent) erroJsonRpc(res, 500, "Erro interno do servidor MCP.");
    }
  };
  const naoSuportado = (_req, res) => erroJsonRpc(res, 405, "Use POST: este servidor MCP não mantém sessão.");
  for (const rota of ["/mcp", "/mcp/:token"]) {
    app.post(rota, tratar);
    app.get(rota, naoSuportado);
    app.delete(rota, naoSuportado);
  }
}

module.exports = {
  NOME_SERVIDOR,
  PAPEIS,
  PREFIXO_TOKEN,
  INSTRUCOES,
  gerarToken,
  hashToken,
  atorDe,
  tokenDaRequisicao,
  autenticar,
  diferencas,
  ferramentas,
  ferramentasDoPapel,
  chamarFerramenta,
  criarServidorMcp,
  registrarMcp,
};
