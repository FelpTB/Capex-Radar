# Teste de monitoramento — Fase 3: coletor de notícias

Migração [`sql/020_capex_radar_coleta.sql`](../../sql/020_capex_radar_coleta.sql), módulos [`src/capex-coletor.js`](../../src/capex-coletor.js) e [`src/capex-ia.js`](../../src/capex-ia.js), script [`scripts/capex-coletar.js`](../../scripts/capex-coletar.js).

## Decisões

- **O que fica gravado da notícia:** título (sem o sufixo do veículo), veículo, data e link do Google News, além do item original do RSS em `conteudo_bruto`. O corpo da matéria não entra.
- **Carga histórica:** roda uma vez por script, de 2023-01-01 até hoje. O agendador só faz a atualização semanal.
- **Projeto:** a IA não cria projeto. Ela marca a notícia como `novo_projeto` ou sugere o vínculo com um projeto que já existe. O projeto só nasce quando alguém aceita a sugestão na revisão (Fase 4).

## Fluxo por grupo

1. **Busca.** A consulta vem de `buscaDoGrupo` (Fase 2), com o contexto do nicho tirado do seed `termos-busca.json`. A janela é fatiada em trimestres. Quando um trimestre traz 90 itens ou mais, que é o teto do RSS, ele é marcado como `subdividida` e refeito mês a mês. Há uma pausa de 1,5 s entre as consultas.
2. **Gravação.** Cada item vira uma linha em `capex_radar.evidencias`, com `chave_dedupe = gnews:<guid>`: a mesma matéria não entra duas vezes, nem quando aparece na busca de outro grupo. Cada janela lida vai para `capex_radar.coleta_janela` com o número de itens, os novos e o status (`ok`, `subdividida` ou `erro`). O ator é `sistema:coletor`.
3. **Regras.** A notícia com uma exclusão do grupo no título fica `descartada`. A que não cita a empresa no título continua, marcada com `cita_empresa: false`, porque o Google acha o termo no corpo da matéria: "Gigante da celulose muda local e vai investir US$ 4,5 bilhões no Vale da Celulose" é a Bracell.
4. **Triagem da IA** (`CLAUDE_MODEL`, Claude Haiku 5.5 por padrão, 20 títulos por chamada, ator `ia:triagem`). Para cada título, a IA diz se fala de um ativo físico do grupo e extrai objeto, UF, município, valor em reais, estágio e data do fato. O resultado vai para `evidencias.extracao`, e quem não passa fica `descartada`, com o motivo.
5. **Filial sugerida.** A sugestão é a filial prioritária do grupo (`vw_filiais`) no mesmo município, ou a única prioritária da UF. Ela fica em `extracao.filial_sugerida`, com o critério usado.
6. **Vínculo** (ator `ia:vinculo`). A IA recebe a lista fechada dos projetos do grupo e escolhe um deles ou null. Quando escolhe, grava `evidencia_projeto` com `situacao = sugerido`, a confiança e o motivo. Quando não escolhe, a notícia fica `novo_projeto`. Nos dois casos ela aparece em `vw_fila_revisao`.

Se uma janela der erro, as outras continuam. Se um lote da IA der erro, ele continua pendente e volta na próxima rodada. Sem `CLAUDE_API_KEY`, só as regras rodam.

**Quando o Google recusa o servidor.** Na primeira rodada no Railway (05/11/2026), 14 grupos foram lidos e os 24 seguintes receberam HTTP 503. Por isso:

- a semana vence por grupo, e um reinício no meio da rodada retoma só os grupos que faltaram;
- um grupo com erro fica parado 6 h e depois volta para a fila, em vez de esperar a semana seguinte;
- depois de 3 grupos seguidos sem nenhuma janela lida, a rodada para. Os grupos que sobraram ficam para a próxima.

## Como rodar

Carga histórica, uma vez, no Railway:

```bash
railway run npm run capex:coletar
```

Opções: `--grupo Bracell` (aceita `%`), `--desde 2025-01-01`, `--ate 2025-07-01`, `--sem-ia`, `--refazer` e `--pausa 1500`. A carga pode ser retomada: as janelas já lidas são puladas.

**Atualização semanal:** o agendador do app lê os últimos 14 dias dos 38 grupos uma vez por semana. A sobreposição com a semana anterior não custa nada, porque a chave barra a repetição. `DISABLE_SCHEDULER=1` desliga essa atualização junto com o resto do agendador.

## Teste ao vivo (05/11/2026, sem banco)

Bracell no 1º semestre de 2025: 2 trimestres, 34 notícias, nenhuma repetida. Na primeira versão das regras, 9 títulos que não citam a empresa teriam sido descartados, entre eles a nova fábrica no MS e a audiência pública da fábrica de R$ 16 bi. Por isso a regra passou a só marcar esses títulos. A triagem da IA não pôde ser testada ao vivo, porque a chave da OpenAI do `.env` local devolve 401.

## O que fica para a Fase 4

- Telas da fila de revisão (aceitar, rejeitar, criar projeto a partir de `novo_projeto`) e da carteira, sobre as views da Fase 1.
- Agrupar as notícias `novo_projeto` do mesmo ativo antes da revisão. Hoje cada notícia é uma sugestão separada.
- Ler o corpo da matéria das notícias com `cita_empresa: false`, se a triagem pelo título não bastar.
