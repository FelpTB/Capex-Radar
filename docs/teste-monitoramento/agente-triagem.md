# Teste de monitoramento — agente de triagem automática

O agente decide a fila "A revisar" sem esperar a revisão humana. O código está em [`src/capex-agente.js`](../../src/capex-agente.js); a tela, em `/monitoramento/agente`.

## O que ele decide

Cada notícia que a triagem marcou como CapEx passa pelo agente, uma por vez e em ordem cronológica. Para cada uma, ele recebe a notícia, a leitura prévia da triagem e os projetos já cadastrados do grupo (com até 3 manchetes de cada). Depois decide uma destas opções:

| Decisão | Quando | O que acontece |
| --- | --- | --- |
| `criar_projeto` | investimento da própria empresa, com obra, anunciado ou em construção, no Brasil, sem projeto igual cadastrado | cria o projeto com status **em revisão**, a notícia como evidência primária e o vínculo `origem = ia` |
| `vincular` | é um projeto já cadastrado (mesmo ativo e local), inclusive a inauguração dele | liga a notícia ao projeto |
| `descartar` | não é investimento, não gera obra (máquinas, TI, frota), compra ou aquisição, inauguração ou obra já concluída sem projeto cadastrado, outra empresa, fora do Brasil, cancelado | descarta com o motivo "Agente: …" |
| `revisar` | falta informação | deixa para a revisão humana |

A ordem cronológica importa. Quando a primeira notícia de um empreendimento cria o projeto, as notícias seguintes sobre ele já o encontram na lista e são vinculadas, em vez de virar projetos repetidos.

## O prompt

O prompt (`PROMPT`, versão `agente-v1`) segue cinco passos: investimento, mesmo projeto, gera obra, situação e decisão. Ele fixa a lista de motivos e pede a resposta em JSON:

```json
{"analise":{"investimento":true,"gera_obra":true,"situacao":"anunciado","no_brasil":true,"mesmo_projeto_id":null},
 "decisao":"criar_projeto","motivo":"obra_nova","confianca":80,
 "justificativa":"…","projeto":{"titulo":"…","objeto":"…","uf":"MS","municipio":"…","valor_brl":null,"estagio":"anuncio","data_fato":null}}
```

Quando o prompt mudar, suba `VERSAO_PROMPT`. Cada decisão guarda a versão usada, o que permite comparar o acerto entre versões.

## Travas

O modelo decide, mas as travas em código (`aplicarTravas`) só deixam agir quando:

- a confiança é de pelo menos `CAPEX_AGENTE_CONFIANCA` (padrão: 75);
- o motivo combina com a decisão;
- para criar o projeto: a análise diz investimento, obra, situação anunciado ou em construção, no Brasil, sem projeto igual, com os dados do projeto preenchidos e com a matriz cadastrada;
- para vincular: o projeto apontado está na lista que o agente recebeu.

Fora disso, a notícia vai para a revisão humana. No card da notícia aparece a linha "Agente: …" com a sugestão e o motivo da trava.

## Modelo e execução

- O agente usa `CLAUDE_DECISION_MODEL` (ou, sem ela, `CLAUDE_MODEL`; o padrão é o Claude Haiku 5.5). Para mais qualidade, aponte `CLAUDE_DECISION_MODEL` para um modelo maior. A triagem continua no modelo leve.
- Pela tela: **Rodar o agente**, na aba Agente, faz a triagem das notícias pendentes e depois o agente decide a fila. A barra de progresso é a mesma da triagem.
- No agendador: depois da coleta semanal, o agente roda nas empresas coletadas. Para desligar, use `CAPEX_AGENTE_AUTO=0`.
- Uma notícia decidida pelo agente não volta para ele, nem quando a ação é desfeita. Só voltam as decisões que deram erro.
- O ator nos logs é `ia:agente`.

## Avaliação e conjunto de treino

Todas as decisões ficam em `capex_radar.agente_decisao` (migração [`sql/022`](../../sql/022_capex_radar_agente.sql)). Cada uma guarda:

- `entrada`: o que o agente viu;
- `saida`: o que ele respondeu;
- `acao`: o que foi feito de fato;
- a avaliação humana.

Na aba **Agente**:

- **Correta** confirma a decisão. Se ela tinha criado um projeto, o projeto passa de "em revisão" para "ativo".
- **Incorreta…** pede a decisão certa, o motivo e uma observação. Por padrão, também desfaz a ação do agente: exclui o projeto criado (se ele ainda tiver só esta notícia), desliga o vínculo ou restaura a notícia descartada. A notícia volta para a revisão.

Algumas avaliações são registradas sozinhas:

- Quando o agente deixou a notícia para você e você aprova, vincula ou descarta pelo card, sua decisão vira o rótulo dele.
- Desfazer, pelo card, um descarte feito pelo agente marca a decisão como incorreta.

**Baixar conjunto de treino (JSONL)** (`/monitoramento/agente/treino.jsonl`) exporta uma linha por decisão avaliada, com os campos `entrada`, `saida_agente`, `acao`, `avaliacao`, `decisao_correta`, `motivo_correto` e `observacao`, além do modelo e da versão do prompt. Com `?todas=1`, a exportação inclui também as decisões ainda não avaliadas.
