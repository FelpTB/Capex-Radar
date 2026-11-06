# Teste de monitoramento — agente de triagem automática

O agente decide a fila "A revisar" sem esperar a revisão humana. O código está em [`src/capex-agente.js`](../../src/capex-agente.js); a tela, em `/monitoramento/agente`.

## O que ele decide

Cada notícia que a triagem marcou como CapEx passa pelo agente, uma por vez e em ordem cronológica. Desde a v2, **toda notícia sai decidida**:

| Decisão | Quando | O que acontece |
| --- | --- | --- |
| `criar_projeto` | investimento da própria empresa, com obra, não concluído, no Brasil, sem projeto igual cadastrado | cria o projeto com status **em revisão**, a notícia como evidência primária e o vínculo `origem = ia` |
| `vincular` | é um projeto já cadastrado (mesmo ativo e local, ou o mesmo anúncio), inclusive a inauguração dele | liga a notícia ao projeto |
| `descartar` | não é investimento, não gera obra (máquinas, TI, frota), compra ou aquisição, inauguração ou obra já concluída sem projeto cadastrado, outra empresa, fora do Brasil, cancelado | descarta com o motivo "Agente: …" |

Há uma única exceção. Quando a decisão é criar projeto e a empresa não tem o CNPJ da matriz cadastrado (hoje, a Shein), a notícia fica para a revisão humana, porque o projeto não tem como nascer.

A ordem cronológica importa. A primeira notícia de um empreendimento cria o projeto. Cada decisão atualiza o que o agente vê, então as notícias seguintes sobre o mesmo empreendimento são vinculadas a ele.

## O que ele recebe

- **A notícia:** manchete, veículo, data e link, mais a leitura prévia da triagem (objeto, local, valor, estágio).
- **Os projetos do grupo:** cada um com até 3 manchetes já ligadas a ele.
- **As manchetes próximas do grupo (v2):** até 20 notícias de até 120 dias antes ou depois, cada uma com o que já foi decidido sobre ela ("projeto: …", "descartada: …" ou "na fila"). Isso serve para reconhecer o mesmo anúncio repetido por vários veículos, ligar uma manchete genérica ("R$ 400 milhões no RS") ao projeto específico da mesma época e completar o município e o valor.

## O prompt (v2)

O prompt (`PROMPT`, versão `agente-v2`) segue cinco passos: investimento, mesmo projeto, gera obra, situação e decisão. Em relação à v1, ele mudou nestes pontos:

- **Sem revisão:** a opção "revisar" deixou de existir, e o agente sempre escolhe criar, vincular ou descartar.
- **Regras de presunção para manchetes incompletas:**
  - investir em fábrica ou unidade para ampliar produção ou capacidade presume obra, a menos que o texto diga que é só equipamento, TI ou manutenção;
  - "vai investir" ou "investe até 20XX" conta como anunciado;
  - concluído só quando o texto diz que inaugurou, concluiu ou entrou em operação.
- **Município:** a falta dele, do valor ou do detalhe da obra não impede criar o projeto nem reduz a confiança.
- **Mesmo projeto:** passa a contar também o mesmo anúncio (valor próximo, mesma UF, mesmo período) com uma manchete mais genérica.
- **Confiança:** é a probabilidade de a decisão estar certa. Ela só é registrada e não bloqueia mais nada.

A resposta é um JSON:

```json
{"analise":{"investimento":true,"gera_obra":true,"situacao":"anunciado","no_brasil":true,"mesmo_projeto_id":null},
 "decisao":"criar_projeto","motivo":"obra_nova","confianca":80,
 "justificativa":"…","projeto":{"titulo":"…","objeto":"…","uf":"MS","municipio":"…","valor_brl":null,"estagio":"anuncio","data_fato":null}}
```

Quando o prompt mudar, suba `VERSAO_PROMPT`. A fila considera só as decisões da versão atual. Com isso, o que uma versão anterior deixou para revisão volta a ser decidido; o que ela já executou (criou, vinculou ou descartou) não volta.

## Decisão final

`decisaoFinal` garante que toda resposta vire uma ação:

1. **A resposta é coerente:** a decisão existe, o motivo combina com ela e ela combina com a análise (por exemplo, não dá para criar um projeto que a própria análise diz que não gera obra). Nesse caso, ela é executada.
2. **A resposta não é coerente:** o agente recebe a resposta anterior e o problema, e responde de novo.
3. **A segunda resposta também não fecha:** `resolverDecisao` segue a análise do próprio agente.
   - Se apontou um projeto igual da lista, vincula.
   - Se é investimento com obra, não concluído e no Brasil, cria o projeto.
   - Caso contrário, descarta com o motivo correspondente: fora do Brasil, não é investimento, concluído ou sem obra.

A saída gravada é a decisão final. Quando houve correção, a saída leva junto o campo `correcao`, com o problema e a resposta anterior. A coluna `acao_motivo` diz se a decisão foi corrigida pelo agente ou fechada pela regra, e o card mostra isso como "Ajuste".

## Modelo e execução

- O agente usa `CLAUDE_DECISION_MODEL` (ou, sem ela, `CLAUDE_MODEL`; o padrão é o Claude Haiku 5.5). Para mais qualidade, aponte `CLAUDE_DECISION_MODEL` para um modelo maior. A triagem continua no modelo leve.
- **Pela tela:** **Rodar o agente**, na aba Agente, faz a triagem das notícias pendentes e depois o agente decide a fila. A barra de progresso é a mesma da triagem.
- **No agendador:** depois da coleta semanal, o agente roda nas empresas coletadas. Para desligar, use `CAPEX_AGENTE_AUTO=0`.
- Uma decisão que deu erro (por exemplo, falha na chamada ao Claude) volta para a fila na próxima rodada.
- O ator nos logs é `ia:agente`.

## Avaliação e conjunto de treino

Todas as decisões ficam em `capex_radar.agente_decisao` (migração [`sql/022`](../../sql/022_capex_radar_agente.sql)). Cada uma guarda:

- `entrada`: o que o agente viu;
- `saida`: a decisão final;
- `acao`: o que foi feito;
- a avaliação humana.

A avaliação é sobre a decisão final. A aba **Agente** filtra por avaliação, ação, empresa e versão do prompt:

- **Correta** confirma a decisão. Se ela tinha criado um projeto, o projeto passa de "em revisão" para "ativo".
- **Incorreta…** pede a decisão certa, o motivo e uma observação. Por padrão, também desfaz a ação do agente: exclui o projeto criado (se ele ainda tiver só esta notícia), desliga o vínculo ou restaura a notícia descartada. A notícia volta para a revisão.

Duas avaliações são registradas sozinhas:

- Desfazer, pelo card da notícia, um descarte feito pelo agente marca a decisão como incorreta.
- Quando você decide no card uma notícia que ficou para a revisão humana, sua decisão vira o rótulo.

**Baixar conjunto de treino (JSONL)** (`/monitoramento/agente/treino.jsonl`) exporta uma linha por decisão avaliada, com os campos `entrada`, `saida_agente`, `acao`, `avaliacao`, `decisao_correta`, `motivo_correto` e `observacao`, além do modelo e da versão do prompt. Com `?todas=1`, a exportação inclui também as decisões ainda não avaliadas.

## Histórico

- **v1 (06/11/2026):** a confiança mínima de 75% e as travas mandavam as dúvidas para a revisão humana. Na Lactalis, decidiu 7 das 23 notícias sozinho e deixou 16 para revisão, quase todas por falta de município ou de detalhe da obra na manchete.
- **v2 (06/11/2026):** decide tudo, recebe as manchetes próximas e usa as regras de presunção.
