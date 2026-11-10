# Acesso ao Radar CapEx por MCP

Pessoas da ABC Advise podem consultar e alterar o Radar CapEx conversando com um modelo (Claude ou outro cliente compatível com MCP). O modelo usa as mesmas regras do painel: cada alteração fica registrada com o nome da pessoa.

## O que é

- **MCP** (Model Context Protocol) é o padrão que conecta um assistente de IA a um sistema. O Radar publica um servidor MCP em `/mcp`.
- Cada pessoa recebe um **token pessoal**. O token define quem ela é e o que pode fazer.
- O modelo não acessa o banco diretamente. Ele só usa as ferramentas descritas abaixo, que chamam as mesmas funções dos botões do painel.

## Papéis

| Papel | Pode | Não pode |
|---|---|---|
| `leitura` | Consultar a carteira, os projetos, as notícias e o histórico de alterações | Alterar qualquer coisa |
| `edicao` | Tudo da leitura, mais corrigir projetos, confirmar ou descartar projetos, e aprovar, vincular, descartar ou restaurar notícias | Excluir projetos, rodar SQL, mudar código e disparar as rodadas de IA (que gastam créditos) |

Exclusões e rodadas de IA ficam com o administrador do Radar.

## Como pedir acesso

Peça ao administrador do Radar, informando nome, e-mail da ABC Advise e papel (`leitura` ou `edicao`). Ele envia o token por um canal privado.

**O token é pessoal.** Não compartilhe, não cole em documentos, e-mails ou canais abertos. Se vazar, avise o administrador: ele revoga o token e cria outro.

## Como conectar

Nos exemplos, `https://<endereço-do-radar>` é o endereço do Radar no Railway e `cxr_...` é o seu token.

### Claude Desktop ou claude.ai

1. Abra **Configurações > Conectores > Adicionar conector personalizado**.
2. Nome: `Radar CapEx`.
3. URL: `https://<endereço-do-radar>/mcp/cxr_...` (o token vai no fim do endereço).
4. Salve e ative o conector numa conversa, pelo menu de ferramentas.

Em planos Team ou Enterprise, o conector pode precisar ser adicionado por um administrador da organização no Claude.

### Claude Code

```bash
claude mcp add --transport http radar-capex https://<endereço-do-radar>/mcp --header "Authorization: Bearer cxr_..."
```

### Outros clientes MCP

Qualquer cliente compatível com **Streamable HTTP** funciona. Há duas formas de passar o token:
- `POST https://<endereço-do-radar>/mcp` com o cabeçalho `Authorization: Bearer cxr_...` (preferida);
- `POST https://<endereço-do-radar>/mcp/cxr_...`, para clientes que não deixam configurar cabeçalhos.

O servidor não mantém sessão: cada requisição é independente.

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

Comandos para quem administra o Radar, rodados na pasta do projeto com acesso ao banco (`SUPABASE_STRING` no `.env`). `RADAR_URL` deixa as instruções impressas com o endereço certo.

```bash
npm run capex:mcp -- criar --nome "Maria Souza" --email maria@abcadvise.com.br --papel edicao
```

Cria o acesso e imprime o token **uma única vez**, já com as instruções de conexão. O banco guarda só o hash do token: se a pessoa perder o token, revogue e crie outro.

```bash
npm run capex:mcp -- listar
```

Mostra os acessos, o papel, se estão ativos, o último uso e o número de chamadas.

```bash
npm run capex:mcp -- revogar --email maria@abcadvise.com.br
```

Revoga na hora: a próxima chamada com esse token recebe 401.

```bash
npm run capex:mcp -- uso --email maria@abcadvise.com.br --limite 50
```

Mostra as últimas chamadas de uma pessoa (ou de todos, sem `--email`).

Para mudar o papel de alguém, revogue o acesso e crie outro com o papel novo.

## Segurança

- Tokens têm 192 bits aleatórios e prefixo `cxr_`. Só o hash SHA-256 fica no banco (`capex_radar.mcp_acessos`).
- O formato com o token no endereço (`/mcp/cxr_...`) existe para clientes que não deixam configurar cabeçalhos, como o conector personalizado do claude.ai. Endereços podem aparecer em logs de proxy: prefira o cabeçalho quando o cliente permitir e revogue tokens que não estejam em uso.
- As ferramentas validam tudo o que recebem (ids, estágios, datas) antes de tocar no banco.
- **O painel web (`/monitoramento`) ainda não tem login.** O MCP exige token, mas quem tiver o endereço do painel consegue usar os botões. Proteger o painel é o próximo passo.

## Implementação

- Servidor: `src/capex-mcp.js`, montado em `src/server.js` (`registrarMcp`).
- Funções de escrita: `src/capex-painel-db.js` (`atualizarProjeto`, `alterarStatusProjeto`, `aprovarNoticia`, `descartarNoticia`, `vincularNoticia`, `restaurarNoticia`).
- Tabelas: `sql/027_capex_radar_mcp.sql`.
- Administração: `scripts/capex-mcp-acesso.js`.
- Testes: `test/capex-mcp.test.js`, incluindo uma conexão real com o cliente MCP oficial.
