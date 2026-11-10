# Acesso ao Radar CapEx por MCP

Pessoas da ABC Advise podem consultar e alterar o Radar CapEx conversando com um modelo (Claude ou outro cliente compatível com MCP). Basta adicionar o endereço do Radar no Claude: não precisa de login nem de token.

## O que é

- **MCP** (Model Context Protocol) é o padrão que conecta um assistente de IA a um sistema. O Radar publica um servidor MCP em `https://capex-radar-buscafornecedor.up.railway.app/mcp`.
- O acesso é **aberto**: quem tem o endereço consulta e altera. O Radar é uma ferramenta interna, sem dados sensíveis.
- O modelo não acessa o banco diretamente. Ele só usa as ferramentas descritas abaixo, que chamam as mesmas funções dos botões do painel. Nenhuma ferramenta apaga dados, e os descartes podem ser desfeitos.

## Como conectar

### Claude Desktop ou claude.ai

1. Abra **Configurações > Conectores > Adicionar conector personalizado**.
2. Nome: `Radar CapEx`.
3. URL: `https://capex-radar-buscafornecedor.up.railway.app/mcp`
4. Salve e ative o conector numa conversa, pelo menu de ferramentas.

Em planos Team ou Enterprise, um administrador da organização no Claude pode adicionar o conector uma vez para todos.

### Claude Code

```bash
claude mcp add --transport http radar-capex https://capex-radar-buscafornecedor.up.railway.app/mcp
```

### Outros clientes MCP

Qualquer cliente compatível com **Streamable HTTP** funciona, apontando para o mesmo endereço. O servidor não mantém sessão: cada requisição é independente.

## O que dá para fazer

Pelo acesso aberto, qualquer pessoa pode consultar a carteira, os projetos, as notícias e o histórico. Também pode corrigir projetos, confirmar ou descartar projetos e decidir notícias.

O acesso aberto não permite excluir projetos, rodar SQL, mudar código nem disparar as rodadas de IA, que gastam créditos. Isso fica com o administrador do Radar.

## Ferramentas

### Consulta

| Ferramenta | O que faz |
|---|---|
| `resumo_radar` | Projetos por status e estágio, valor total da carteira e notícias a revisar por empresa |
| `buscar_projetos` | Lista projetos por texto, empresa, UF, status, estágio, valor mínimo e se já passaram pelas fontes secundárias |
| `obter_projeto` | Ficha completa: dados, avaliação da IA, linha do tempo com marcos e evidências |
| `buscar_noticias` | Notícias por situação (`revisar`, `processando`, `vinculadas`, `descartadas`...), empresa e texto |
| `obter_noticia` | Texto da notícia, leitura e enriquecimento da IA, vínculos e projetos candidatos da mesma empresa |
| `historico_alteracoes` | Quem mudou o quê num projeto ou numa notícia |

### Edição (liberada no acesso aberto; com login, só no papel `edicao`)

| Ferramenta | O que faz | Equivale no painel a |
|---|---|---|
| `atualizar_projeto` | Corrige título, objeto, UF, município, valor, fonte do valor, validação, estágio, tendência e datas | — (só pelo MCP) |
| `alterar_status_projeto` | `ativo` confirma um projeto em revisão; `em_revisao` devolve para revisão; `descartado` tira da carteira (motivo obrigatório, reversível) | Avaliar como correta na aba Agente / Restaurar |
| `aprovar_noticia` | Vincula ao projeto sugerido pela IA ou cria um projeto novo (ativo) | Aprovar como projeto |
| `vincular_noticia` | Liga a notícia a um projeto existente da mesma empresa | Vincular |
| `descartar_noticia` | Descarta notícia que não é projeto (com motivo) | Descartar |
| `restaurar_noticia` | Desfaz o descarte de uma notícia | Restaurar |

Nenhuma ferramenta apaga dados. Descartes são reversíveis.

## Exemplos de pedidos

- "Quais são os 10 maiores projetos em revisão? Mostre empresa, UF e estágio."
- "Confirme o projeto da Heineken em Passos; ele já foi inaugurado, então mude o estágio para operação."
- "Liste as notícias a revisar da Suzano e me diga quais parecem projeto novo."
- "O município do projeto da Lactalis no Paraná está errado: é Carambeí. Corrija."
- "Quem alterou o projeto da CMPC no último mês?"

O modelo deve mostrar o que vai mudar e pedir confirmação antes de alterar. Confira o resultado que ele devolve.

## Auditoria

- **Toda chamada** (consulta ou edição) fica em `capex_radar.mcp_uso`, com a ferramenta, os argumentos e se deu certo.
- **Toda alteração** também fica em `capex_radar.log_acao`, com o antes e o depois. No acesso aberto o ator é `usuario:mcp:acesso-aberto@radar`, e não dá para saber qual pessoa fez a alteração. Com login, o ator é `usuario:mcp:<email>` da pessoa. É o mesmo log das alterações feitas pelo painel e pelo agente.
- Decisões sobre notícias feitas pelo MCP contam como revisão humana: viram rótulo de treino do agente, como no painel.

## Administração

### Exigir login (opcional)

O acesso é aberto enquanto `MCP_ABERTO` não for `0`. Para exigir login, com cada pessoa entrando com a conta Google @abcadvise.com.br, com leitura por padrão e edição liberada por e-mail:

1. No Railway, defina `MCP_ABERTO=0`.
2. No [Google Cloud Console](https://console.cloud.google.com/), crie ou escolha um projeto e abra **APIs e serviços > Tela de consentimento OAuth**. Tipo **Interno**: só contas da ABC Advise. Nome: `Radar CapEx`.
3. Em **Credenciais > Criar credenciais > ID do cliente OAuth**, escolha **Aplicativo da Web**.
4. Em **URIs de redirecionamento autorizados**, informe `https://capex-radar-buscafornecedor.up.railway.app/oauth/google/callback`.
5. No Railway, adicione as variáveis `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` com os valores gerados. Opcionalmente, configure `MCP_DOMINIO` (padrão `abcadvise.com.br`) e `RADAR_URL` (padrão: o endereço do Railway).

Com o login ligado e sem essas variáveis, quem tenta conectar vê a mensagem "login com Google ainda não foi configurado". Os tokens fixos continuam funcionando.

### Comandos

Valem para o modo com login. Rodados na pasta do projeto com acesso ao banco (`SUPABASE_STRING` no `.env`).

```bash
npm run capex:mcp -- liberar --email maria@abcadvise.com.br --papel edicao
```

Dá papel de edição a um e-mail. Pode ser antes ou depois do primeiro login, e vale na próxima conversa da pessoa. Com `--papel leitura`, tira a edição.

```bash
npm run capex:mcp -- listar
```

Mostra os acessos, o papel, a forma de entrada (login Google ou token fixo), se estão ativos, o último uso e o número de chamadas.

```bash
npm run capex:mcp -- revogar --email maria@abcadvise.com.br
```

Revoga na hora: os tokens da pessoa param de valer e ela não consegue entrar de novo pelo Google. Para devolver o acesso, use `liberar`.

```bash
npm run capex:mcp -- uso --email maria@abcadvise.com.br --limite 50
```

Mostra as últimas chamadas de uma pessoa (ou de todos, sem `--email`).

```bash
npm run capex:mcp -- criar --nome "Maria Souza" --email maria@abcadvise.com.br --papel edicao
```

Token pessoal fixo, só para clientes MCP sem OAuth. Imprime o token **uma única vez**. O banco guarda só o hash.

## Segurança

- **No acesso aberto (padrão), qualquer pessoa com o endereço consulta e altera.** Nenhuma ferramenta apaga dados, os descartes podem ser desfeitos e tudo fica no log. Para restringir, use `MCP_ABERTO=0`.
- Com login, ele exige conta Google com e-mail verificado do domínio `abcadvise.com.br`. Contas de fora recebem "sem acesso", e acessos revogados não voltam sozinhos.
- O fluxo é OAuth 2.1 com PKCE e registro dinâmico de clientes. O token de acesso vale 8 horas, e o de renovação vale 90 dias e é trocado a cada uso. Códigos valem 10 minutos e uma única vez.
- Só o hash SHA-256 dos tokens fica no banco (`capex_radar.mcp_acessos` e `capex_radar.mcp_oauth_tokens`).
- O token fixo no endereço (`/mcp/cxr_...`) pode aparecer em logs de proxy. Prefira o login Google.
- As ferramentas validam tudo o que recebem (ids, estágios, datas) antes de tocar no banco.
- O painel web (`/monitoramento`) também não tem login.

## Implementação

- Servidor MCP: `src/capex-mcp.js`, montado em `src/server.js` (`registrarMcp`).
- Login OAuth com Google: `src/capex-mcp-oauth.js`. Usa o `mcpAuthRouter` do SDK oficial, que serve `/authorize`, `/token`, `/register`, `/revoke` e os `.well-known`, e o retorno do Google em `/oauth/google/callback`.
- Funções de escrita: `src/capex-painel-db.js` (`atualizarProjeto`, `alterarStatusProjeto`, `aprovarNoticia`, `descartarNoticia`, `vincularNoticia`, `restaurarNoticia`).
- Tabelas: `sql/027_capex_radar_mcp.sql` e `sql/028_capex_radar_mcp_oauth.sql`.
- Administração: `scripts/capex-mcp-acesso.js`.
- Testes: `test/capex-mcp.test.js`, incluindo uma conexão real com o cliente MCP oficial.
