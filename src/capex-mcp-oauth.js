// Login no MCP do Radar com a conta Google da ABC Advise (OAuth 2.1).
//
// A pessoa adiciona o conector no Claude só com o endereço .../mcp. O cliente
// descobre este servidor de autorização, registra-se sozinho e manda a pessoa
// para /authorize; daqui ela vai para o Google, entra com a conta do domínio
// (MCP_DOMINIO) e volta com um código que o cliente troca por tokens.
//
// Papel: quem entra pela primeira vez ganha 'leitura'; quem o administrador
// liberou por e-mail (capex:mcp -- liberar) entra com o papel liberado. Acesso
// revogado não entra de novo sozinho.
//
// Tokens: acesso (cxa_, 8 h) e renovação (cxf_, 90 dias, trocado a cada uso).
// Só o hash fica no banco (capex_radar.mcp_oauth_tokens).
const crypto = require("node:crypto");
const { pool } = require("./db");
const { hashToken } = require("./capex-mcp");

const PREFIXO_ACESSO = "cxa_";
const PREFIXO_RENOVACAO = "cxf_";
const DURACAO_CODIGO_S = 10 * 60;
const DURACAO_PEDIDO_S = 15 * 60;
const DURACAO_ACESSO_S = 8 * 60 * 60;
const DURACAO_RENOVACAO_S = 90 * 24 * 60 * 60;
const GOOGLE_AUTORIZAR = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const CALLBACK_GOOGLE = "/oauth/google/callback";

function erros() {
  return require("@modelcontextprotocol/sdk/server/auth/errors.js");
}

const aleatorio = (prefixo = "") => prefixo + crypto.randomBytes(24).toString("base64url");
const daquiA = (segundos) => new Date(Date.now() + segundos * 1000);

/** Lê o payload do id_token. Ele vem direto do Google, por TLS, na troca autenticada com o segredo. */
function lerIdToken(idToken) {
  const partes = String(idToken || "").split(".");
  if (partes.length !== 3) throw new Error("id_token inválido");
  return JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8"));
}

/** A conta do Google pode entrar? Só e-mail verificado do domínio da organização. */
function contaDoDominio(perfil, dominio) {
  const email = String(perfil?.email || "").toLowerCase();
  if (!perfil?.email_verified) return { ok: false, motivo: "O Google não confirmou este e-mail." };
  if (!email.endsWith(`@${dominio}`) || (perfil.hd && perfil.hd.toLowerCase() !== dominio)) {
    return { ok: false, motivo: `Só contas @${dominio} podem acessar o Radar CapEx.` };
  }
  return { ok: true, email };
}

/**
 * Acesso da pessoa: o ativo do e-mail, ou um novo com papel 'leitura'.
 * Se o único acesso do e-mail foi revogado, não cria outro.
 */
async function acessoDoEmail(db, email, nome) {
  const { rows } = await db.query(
    `select id, nome, email, papel, revogado_em, origem from capex_radar.mcp_acessos
      where lower(email) = $1 order by revogado_em is not null, criado_em desc`,
    [email],
  );
  const ativo = rows.find((r) => !r.revogado_em);
  if (ativo) {
    // Acesso liberado só pelo e-mail ganha o nome da conta Google no primeiro login.
    if (nome && (ativo.nome === ativo.email || !ativo.nome)) {
      await db.query("update capex_radar.mcp_acessos set nome = $2 where id = $1", [ativo.id, nome]);
      ativo.nome = nome;
    }
    return ativo;
  }
  if (rows.length) return null;
  const { rows: [novo] } = await db.query(
    `insert into capex_radar.mcp_acessos (nome, email, papel, origem)
     values ($1, $2, 'leitura', 'google')
     returning id, nome, email, papel`,
    [nome || email, email],
  );
  return novo;
}

function paginaErro(res, status, mensagem) {
  const texto = String(mensagem).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  res.status(status).type("html").send(`<!doctype html><meta charset="utf-8"><title>Radar CapEx</title>
<body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5">
<h1 style="font-size:1.25rem">Não foi possível entrar no Radar CapEx</h1><p>${texto}</p>
<p style="color:#666">Se precisar de acesso, fale com o administrador do Radar.</p></body>`);
}

/**
 * Provedor OAuth para o mcpAuthRouter do SDK.
 * deps.google: { autorizarUrl(state), trocarCodigo(code) -> perfil } (substituível nos testes).
 */
function criarProvedor({ db = pool, config, google } = {}) {
  const base = config.radarUrl;
  const callback = `${base}${CALLBACK_GOOGLE}`;
  const googleLigado = Boolean(google || (config.googleClientId && config.googleClientSecret));
  const g = google || {
    autorizarUrl(state) {
      const url = new URL(GOOGLE_AUTORIZAR);
      url.search = new URLSearchParams({
        client_id: config.googleClientId,
        redirect_uri: callback,
        response_type: "code",
        scope: "openid email profile",
        state,
        hd: config.mcpDominio,
        prompt: "select_account",
      }).toString();
      return url.toString();
    },
    async trocarCodigo(code) {
      const resposta = await fetch(GOOGLE_TOKEN, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: config.googleClientId,
          client_secret: config.googleClientSecret,
          redirect_uri: callback,
          grant_type: "authorization_code",
        }),
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok || !corpo.id_token) throw new Error(`Google recusou o login: ${corpo.error_description || corpo.error || resposta.status}`);
      return lerIdToken(corpo.id_token);
    },
  };

  const clientsStore = {
    async getClient(clientId) {
      const { rows } = await db.query("select dados from capex_radar.mcp_oauth_clientes where client_id = $1", [clientId]);
      return rows[0]?.dados;
    },
    async registerClient(cliente) {
      await db.query(
        "insert into capex_radar.mcp_oauth_clientes (client_id, dados) values ($1, $2) on conflict (client_id) do update set dados = excluded.dados",
        [cliente.client_id, JSON.stringify(cliente)],
      );
      return cliente;
    },
  };

  async function emitirTokens(clientId, acessoId, resource) {
    const acesso = aleatorio(PREFIXO_ACESSO);
    const renovacao = aleatorio(PREFIXO_RENOVACAO);
    const dados = JSON.stringify({ resource: resource ? String(resource) : null });
    await db.query(
      `insert into capex_radar.mcp_oauth_tokens (hash, tipo, client_id, acesso_id, dados, expira_em)
       values ($1, 'acesso', $3, $4, $5, $6), ($2, 'renovacao', $3, $4, $5, $7)`,
      [hashToken(acesso), hashToken(renovacao), clientId, acessoId, dados, daquiA(DURACAO_ACESSO_S), daquiA(DURACAO_RENOVACAO_S)],
    );
    return { access_token: acesso, token_type: "bearer", expires_in: DURACAO_ACESSO_S, refresh_token: renovacao };
  }

  /** Consome um código ou token de renovação: só uma vez, dentro da validade, do mesmo cliente, de acesso ativo. */
  async function consumir(tipo, valor, clientId) {
    const { rows: [linha] } = await db.query(
      `update capex_radar.mcp_oauth_tokens t set usado_em = now()
         from capex_radar.mcp_acessos a
        where t.hash = $1 and t.tipo = $2 and t.client_id = $3 and a.id = t.acesso_id
          and t.usado_em is null and t.revogado_em is null and t.expira_em > now() and a.revogado_em is null
        returning t.acesso_id, t.dados`,
      [hashToken(valor), tipo, clientId],
    );
    return linha || null;
  }

  return {
    googleLigado,
    clientsStore,

    async authorize(client, params, res) {
      if (!googleLigado) return paginaErro(res, 503, "O login com Google ainda não foi configurado no Radar (GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET).");
      const id = aleatorio();
      await db.query(
        `insert into capex_radar.mcp_oauth_pedidos (id, client_id, parametros, expira_em) values ($1, $2, $3, $4)`,
        [id, client.client_id, JSON.stringify({
          redirect_uri: params.redirectUri,
          state: params.state ?? null,
          code_challenge: params.codeChallenge,
          scopes: params.scopes || [],
          resource: params.resource ? String(params.resource) : null,
        }), daquiA(DURACAO_PEDIDO_S)],
      );
      res.redirect(g.autorizarUrl(id));
    },

    /** Volta do Google: confere a conta, acha ou cria o acesso e devolve o código ao cliente. */
    async callbackGoogle(req, res) {
      const { state, code, error } = req.query;
      const { rows: [pedido] } = await db.query(
        `delete from capex_radar.mcp_oauth_pedidos where id = $1 and expira_em > now() returning client_id, parametros`,
        [String(state || "")],
      );
      if (!pedido) return paginaErro(res, 400, "Esta tentativa de login expirou. Volte ao Claude e conecte o Radar de novo.");
      const voltar = (extras) => {
        const url = new URL(pedido.parametros.redirect_uri);
        for (const [k, v] of Object.entries(extras)) if (v != null) url.searchParams.set(k, v);
        if (pedido.parametros.state != null) url.searchParams.set("state", pedido.parametros.state);
        res.redirect(url.toString());
      };
      if (error || !code) return voltar({ error: "access_denied", error_description: "Login no Google cancelado." });
      let perfil;
      try {
        perfil = await g.trocarCodigo(String(code));
      } catch (e) {
        console.error("[mcp-oauth]", e.message);
        return paginaErro(res, 502, "Não foi possível confirmar o login com o Google. Tente de novo.");
      }
      const conta = contaDoDominio(perfil, config.mcpDominio);
      if (!conta.ok) return paginaErro(res, 403, conta.motivo);
      const acesso = await acessoDoEmail(db, conta.email, perfil.name);
      if (!acesso) return paginaErro(res, 403, "O acesso deste e-mail ao Radar foi revogado.");
      const codigo = aleatorio();
      await db.query(
        `insert into capex_radar.mcp_oauth_tokens (hash, tipo, client_id, acesso_id, dados, expira_em)
         values ($1, 'codigo', $2, $3, $4, $5)`,
        [hashToken(codigo), pedido.client_id, acesso.id, JSON.stringify(pedido.parametros), daquiA(DURACAO_CODIGO_S)],
      );
      voltar({ code: codigo });
    },

    async challengeForAuthorizationCode(client, codigo) {
      const { rows: [linha] } = await db.query(
        `select dados from capex_radar.mcp_oauth_tokens
          where hash = $1 and tipo = 'codigo' and client_id = $2 and usado_em is null and expira_em > now()`,
        [hashToken(codigo), client.client_id],
      );
      if (!linha) throw new (erros().InvalidGrantError)("Código de autorização inválido ou expirado.");
      return linha.dados.code_challenge;
    },

    async exchangeAuthorizationCode(client, codigo, _verifier, redirectUri) {
      const linha = await consumir("codigo", codigo, client.client_id);
      if (!linha) throw new (erros().InvalidGrantError)("Código de autorização inválido ou expirado.");
      if (redirectUri && redirectUri !== linha.dados.redirect_uri) throw new (erros().InvalidGrantError)("redirect_uri diferente do pedido.");
      return emitirTokens(client.client_id, linha.acesso_id, linha.dados.resource);
    },

    async exchangeRefreshToken(client, renovacao) {
      const linha = await consumir("renovacao", renovacao, client.client_id);
      if (!linha) throw new (erros().InvalidGrantError)("Token de renovação inválido, expirado ou já usado.");
      return emitirTokens(client.client_id, linha.acesso_id, linha.dados.resource);
    },

    async verifyAccessToken(token) {
      const { rows: [linha] } = await db.query(
        `select t.client_id, t.expira_em, a.id, a.nome, a.email, a.papel
           from capex_radar.mcp_oauth_tokens t
           join capex_radar.mcp_acessos a on a.id = t.acesso_id
          where t.hash = $1 and t.tipo = 'acesso' and t.revogado_em is null and t.expira_em > now()
            and a.revogado_em is null`,
        [hashToken(token)],
      );
      if (!linha) throw new (erros().InvalidTokenError)("Token inválido, expirado ou revogado.");
      await db.query("update capex_radar.mcp_acessos set ultimo_uso_em = now() where id = $1", [linha.id]);
      return {
        token,
        clientId: linha.client_id,
        scopes: [],
        expiresAt: Math.floor(new Date(linha.expira_em).getTime() / 1000),
        extra: { acesso: { id: linha.id, nome: linha.nome, email: linha.email, papel: linha.papel } },
      };
    },

    async revokeToken(client, { token }) {
      await db.query(
        "update capex_radar.mcp_oauth_tokens set revogado_em = now() where hash = $1 and client_id = $2",
        [hashToken(token), client.client_id],
      );
    },
  };
}

/** Monta /authorize, /token, /register, /revoke, os .well-known e o retorno do Google. */
function registrarOAuth(app, provedor, config) {
  const { mcpAuthRouter } = require("@modelcontextprotocol/sdk/server/auth/router.js");
  app.use(mcpAuthRouter({
    provider: provedor,
    issuerUrl: new URL(config.radarUrl),
    resourceServerUrl: new URL(`${config.radarUrl}/mcp`),
    resourceName: "Radar CapEx",
    serviceDocumentationUrl: new URL("https://github.com/FelpTB/Capex-Radar/blob/main/docs/acesso-mcp.md"),
  }));
  app.get(CALLBACK_GOOGLE, (req, res, next) => provedor.callbackGoogle(req, res).catch(next));
}

module.exports = {
  PREFIXO_ACESSO,
  PREFIXO_RENOVACAO,
  CALLBACK_GOOGLE,
  lerIdToken,
  contaDoDominio,
  acessoDoEmail,
  criarProvedor,
  registrarOAuth,
};
