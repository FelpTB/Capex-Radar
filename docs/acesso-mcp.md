# Acesso ao Radar CapEx por MCP

Pessoas da ABC Advise podem consultar e alterar o Radar CapEx conversando com um modelo (Claude ou outro cliente compatível com MCP). Cada pessoa conecta sozinha, entrando com a própria conta Google da empresa. O modelo segue as mesmas regras do painel, e cada alteração fica registrada com o nome da pessoa.

## O que é

- **MCP** (Model Context Protocol) é o padrão que conecta um assistente de IA a um sistema. O Radar publica um servidor MCP em `https://capex-radar-buscafornecedor.up.railway.app/mcp`.
- Na primeira conexão, o Claude abre o login do Google. Só entram contas **@abcadvise.com.br**.
- O modelo não acessa o banco diretamente. Ele só usa as ferramentas descritas abaixo, que chamam as mesmas funções dos botões do painel.

## Papéis

| Papel | Quem tem | Pode | Não pode |
|---|---|---|---|
| `leitura` | Qualquer conta @abcadvise.com.br, a partir do primeiro login | Consultar a carteira, os projetos, as notícias e o histórico de alterações | Alterar qualquer coisa |
| `edicao` | Quem o administrador liberou pelo e-mail | Tudo da leitura, mais corrigir projetos, confirmar ou descartar projetos, e aprovar, vincular, descartar ou restaurar notícias | Excluir projetos, rodar SQL, mudar código e disparar as rodadas de IA (que gastam créditos) |

Exclusões e rodadas de IA ficam com o administrador do Radar. Para ter edição, peça ao administrador. Não precisa receber nada: depois de liberado, o papel vale na próxima conversa.

## Como conectar

Ninguém precisa enviar nada para você. Só são necessários o endereço e a sua conta Google da ABC Advise.

### Claude Desktop ou claude.ai

1. Abra **Configurações > Conectores > Adicionar conector personalizado**.
2. Nome: `Radar CapEx`.
3. URL: `https://capex-radar-buscafornecedor.up.railway.app/mcp`
4. Clique em **Conectar**. Abre o login do Google: entre com a conta @abcadvise.com.br.
5. Ative o conector numa conversa, pelo menu de ferramentas.

Em planos Team ou Enterprise, um administrador da organização no Claude pode adicionar o conector uma vez para todos. Cada pessoa só clica em **Conectar** e entra com a própria conta.

### Claude Code

```bash
claude mcp add --transport http radar-capex https://capex-radar-buscafornecedor.up.railway.app/mcp
```

Depois, dentro do Claude Code, rode `/mcp`, escolha `radar-capex` e autentique. O navegador abre o login do Google.

### Outros clientes MCP

Qualquer cliente compatível com **Streamable HTTP** e com autorização OAuth do MCP funciona. Ele descobre o login sozinho a partir da resposta 401 de `/mcp`. O servidor não mantém sessão: cada requisição é independente.

Para clientes sem OAuth, o administrador pode gerar um token pessoal fixo (`cxr_...`). Ele é usado no cabeçalho `Authorization: Bearer cxr_...` ou no fim do endereço (`/mcp/cxr_...`). Esse token é pessoal: não compartilhe e avise o administrador se vazar.

## Ferramentas

### Consulta (todos os papéis)

| Ferramenta | O que faz |
|---|---|
| `resumo_radar` | Projetos por status e estágio, valor total da carteira e notícias a revisar por empresa |
| `buscar_projetos` | Lista projetos por texto, empresa, UF, status, estágio, valor mínimo e se já passaram pelas fontes secundárias |
| `obter_projeto` | Ficha completa: dados, avaliação da IA, linha do tempo com marcos e evidências |
| `buscar_noticias` | Notícias por situação (`revisar`, `processando`, `vinculadas`, `descartadas`...), empresa e texto |
| `obter_noticia` | Texto da notícia, leitura e enriquecimento da IA, vínculos e projetos candidatos da mesma empresa |
| `historico_alteracoes` | Quem mudou o quê num projeto ou numa notícia |

### Edição (papel `edicao`)

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

- **Toda chamada** (consulta ou edição) fica em `capex_radar.mcp_uso`, com a pessoa, a ferramenta, os argumentos e se deu certo.
- **Toda alteração** também fica em `capex_radar.log_acao`, com o antes e o depois e o ator `usuario:mcp:<email>`. É o mesmo log das alterações feitas pelo painel e pelo agente.
- Decisões sobre notícias feitas pelo MCP contam como revisão humana: viram rótulo de treino do agente, como no painel.

## Administração

### Configuração única: login com Google

Feita uma vez, por quem administra o Google Workspace da ABC Advise ou um projeto no Google Cloud:

1. No [Google Cloud Console](https://console.cloud.google.com/), crie ou escolha um projeto e abra **APIs e serviços > Tela de consentimento OAuth**. Tipo **Interno**: só contas da ABC Advise. Nome: `Radar CapEx`.
2. Em **Credenciais > Criar credenciais > ID do cliente OAuth**, escolha **Aplicativo da Web**.
3. Em **URIs de redirecionamento autorizados**, informe `https://capex-radar-buscafornecedor.up.railway.app/oauth/google/callback`.
4. No Railway, adicione as variáveis `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` com os valores gerados. Opcionalmente, configure `MCP_DOMINIO` (padrão `abcadvise.com.br`) e `RADAR_URL` (padrão: o endereço do Railway).

Sem essas variáveis, quem tenta conectar vê a mensagem "login com Google ainda não foi configurado". Os tokens fixos continuam funcionando.

### Comandos

Rodados na pasta do projeto com acesso ao banco (`SUPABASE_STRING` no `.env`).

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

- O login exige conta Google com e-mail verificado do domínio `abcadvise.com.br`. Contas de fora recebem "sem acesso", e acessos revogados não voltam sozinhos.
- O fluxo é OAuth 2.1 com PKCE e registro dinâmico de clientes. O token de acesso vale 8 horas, e o de renovação vale 90 dias e é trocado a cada uso. Códigos valem 10 minutos e uma única vez.
- Só o hash SHA-256 dos tokens fica no banco (`capex_radar.mcp_acessos` e `capex_radar.mcp_oauth_tokens`).
- O token fixo no endereço (`/mcp/cxr_...`) pode aparecer em logs de proxy. Prefira o login Google.
- As ferramentas validam tudo o que recebem (ids, estágios, datas) antes de tocar no banco.
- **O painel web (`/monitoramento`) ainda não tem login.** O MCP exige login, mas quem tiver o endereço do painel consegue usar os botões.

## Implementação

- Servidor MCP: `src/capex-mcp.js`, montado em `src/server.js` (`registrarMcp`).
- Login OAuth com Google: `src/capex-mcp-oauth.js`. Usa o `mcpAuthRouter` do SDK oficial, que serve `/authorize`, `/token`, `/register`, `/revoke` e os `.well-known`, e o retorno do Google em `/oauth/google/callback`.
- Funções de escrita: `src/capex-painel-db.js` (`atualizarProjeto`, `alterarStatusProjeto`, `aprovarNoticia`, `descartarNoticia`, `vincularNoticia`, `restaurarNoticia`).
- Tabelas: `sql/027_capex_radar_mcp.sql` e `sql/028_capex_radar_mcp_oauth.sql`.
- Administração: `scripts/capex-mcp-acesso.js`.
- Testes: `test/capex-mcp.test.js`, incluindo uma conexão real com o cliente MCP oficial.
