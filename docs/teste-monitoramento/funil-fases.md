# Teste de monitoramento: funil de notícias em seis fases

O módulo de captação de notícias passou a ser um funil. Cada fase lê só o que a fase anterior manteve. Só chega à tela de aprovação o que passou por todas as fases de IA ligadas. O mapa das fases e das condições SQL fica em [`src/capex-fases.js`](../../src/capex-fases.js). A migração é a [`sql/024`](../../sql/024_capex_radar_enriquecimento.sql).

| Fase | O que faz | Código | Modelo | Grava em |
| --- | --- | --- | --- | --- |
| 1. Captação | Lê o Google News RSS por empresa e janela, para captar o máximo possível. | `capex-coletor.js` | — | `evidencias` (manchete, veículo, data, link) |
| 2. Filtro 1 | Aplica as regras sem custo, tira manchetes quase iguais e faz a triagem rápida da manchete. | `capex-coletor.js`, `capex-ia.js` | `CLAUDE_MODEL` (Haiku 5.5) | `extracao`, `triagem` |
| 3. Filtro 2 | Aplica a definição rígida de CapEx e tira as repetições do mesmo fato. | `capex-filtro.js` | `CLAUDE_FILTER_MODEL` (Sonnet 5.5) | `filtro` |
| 4. Enriquecimento | Acha a matéria original, lê o texto e monta o perfil do projeto. | `capex-enriquecimento.js` | `CLAUDE_ENRICH_MODEL` (Sonnet 5.5) | `enriquecimento`, `texto`, `uf`, `municipio` |
| 5. Filtro 3 | Relê o perfil enriquecido e tira o que não faz sentido para o radar. | `capex-filtro-final.js` | `CLAUDE_FILTER3_MODEL` (Sonnet 5.5) | `filtro_final` |
| 6. Aprovação humana | O analista aprova (cria o projeto ou aceita o vínculo) ou descarta. | tela `/monitoramento` | — | `projetos`, `evidencia_projeto` |

Os descartes de cada fase vão para `triagem = 'descartada'`. O motivo leva o rótulo da fase:
- `Exclusão no título: ...`
- `Filtro 1: manchete quase igual a "..."`
- o motivo da IA na triagem
- `Filtro 2: ...`
- `Filtro 3: ...`

Na tela, "Desfazer" devolve a notícia ao funil.

## Fase 2: Filtro 1, manchetes quase iguais

Antes da triagem da IA, o código compara cada manchete nova com as manchetes vivas do mesmo grupo num intervalo de 15 dias. Vivas são as já triadas e não descartadas. A comparação também vale entre as manchetes da própria rodada.
- **Quase iguais:** depois de tirar acento, caixa, pontuação e palavras de até 2 letras, as duas manchetes têm 80% ou mais de palavras em comum (Jaccard).
- **Manchete curta:** com menos de 4 palavras, só conta se for idêntica.

Esse passo pega a mesma matéria republicada ou com o título trocado por um detalhe ("(SP)", "a", uma vírgula). Ele não gasta chamada de IA. A repetição do mesmo fato com palavras diferentes continua com o Filtro 2.

## Fase 4: Enriquecimento

**Problema.** A coleta guarda só o link do Google News (`news.google.com/rss/articles/...`). Esse link é uma página de redirecionamento em JavaScript e não entrega o texto.

**Solução.** O modelo recebe duas ferramentas de servidor da API do Claude:
- `web_search_20260209`: no máximo 3 buscas por notícia, com localização Brasil;
- `web_fetch_20260209`: no máximo 3 leituras, cada uma com até 12 mil tokens da página.

Ele acha a matéria pela manchete, pelo veículo e pela data. Se não achar a do veículo, usa outra matéria sobre o mesmo fato. Depois devolve um JSON validado com zod:

| Campo | Conteúdo |
| --- | --- |
| `encontrou`, `url_original`, `veiculo_original` | Se leu uma matéria e qual. `encontrou` só vale `true` com um endereço válido. |
| `resumo` | 2 a 4 frases com o fato e os números. |
| `empresa`, `mesmo_grupo` | Quem investe; `false` quando é fornecedor, cliente, governo ou homônimo. |
| `objeto`, `tipo_ativo`, `uf`, `municipio`, `local_detalhe` | O ativo e onde fica. |
| `valor_brl`, `valor_texto` | Valor em reais (inteiro) e como está escrito no texto; valor em dólar ou euro fica só no texto. |
| `capacidade`, `empregos` | Como está no texto. |
| `estagio` | Um dos estágios do radar. |
| `obra` | `por_fazer`, `em_andamento`, `concluida`, `sem_obra` ou `incerto`. |
| `data_fato`, `inicio_obra`, `previsao_operacao` | Datas do fato e da obra. |
| `construtora`, `financiamento` | Construtora, EPC, fornecedores; BNDES, debêntures, recursos próprios... |
| `trechos` | Até 3 frases copiadas do texto que sustentam a leitura. |
| `observacao` | O que põe o projeto em dúvida. |

**Validação.** Um campo malformado vira `null` e não derruba a notícia. Quando o perfil traz a UF, a filial sugerida é refeita com o local do texto.

**Gravação.** O registro vai para `enriquecimento`. O resumo e os trechos vão para `texto`. Matéria não encontrada também é gravada, com `encontrou = false`: o Filtro 3 decide pela manchete e a notícia não volta à fila. Notícia com erro de API fica na fila e volta na próxima rodada.

**Velocidade.** Três notícias por vez.

**Custo estimado.** Entre US$ 0,04 e US$ 0,08 por notícia:
- Sonnet 5.5 a US$ 2 / US$ 10 por milhão de tokens, com 15 a 25 mil tokens de entrada (resultados de busca e página);
- busca a US$ 10 por mil.

Para 300 notícias, algo entre US$ 12 e US$ 24. A conta é uma estimativa a partir da tabela de preços, ainda não medida numa rodada real.

## Fase 5: Filtro 3

**Lotes.** As notícias vão em lotes de 10. Cada item leva o perfil enriquecido, sem campos nulos: resumo, trechos, observação e a justificativa do Filtro 2. Cada lote também vê:
- os projetos do grupo;
- as notícias que seguem vivas depois do Filtro 3 até 120 dias antes ou depois: mantidas, vinculadas ou com vínculo aceito.

**Regras.** As regras de fechamento são as do Filtro 2 (`fecharDecisoes`):
- descarte só com motivo válido;
- `repetida` precisa apontar para uma notícia mantida;
- um fato fica com uma notícia só.

**Motivos.** Os motivos são os do Filtro 2, mais `fora_contexto`: o texto não confirma o que a manchete sugeria. Quando a matéria não foi achada, o filtro mantém a notícia só se a manchete descreve claramente um ativo físico novo ou ampliado do grupo.

## Fase 6: aprovação humana

**Situações na tela.**
- **A revisar:** notícias no funil que passaram por todas as fases de IA ligadas.
- **Em processamento:** as que ainda estão entre o Filtro 1 e o Filtro 3. Elas aparecem com o selo "em processamento" e podem ser aprovadas ou descartadas, se for preciso.

**Card.** Mostra o resumo do texto, a obra, a construtora, o financiamento, o link da matéria original e a justificativa do Filtro 3.

**Aprovar.** O projeto nasce com os dados do texto. O perfil enriquecido vale sobre a leitura da manchete, campo a campo: objeto, UF, município, valor, estágio, data e filial (`leituraDaNoticia`).

**Agente.** O agente (modo "agente" e `CAPEX_AGENTE_AUTO`) continua existindo, depois do Filtro 3. Ele só lê a fila pronta e cria projetos em revisão, que dependem da aprovação humana.

## Como rodar

- **Tela.** O botão "Processar N" roda as fases em ordem para uma empresa ou para todas, com a barra de progresso. N soma as notícias sem triagem e as que estão em processamento.
- **Coleta semanal.** Roda as mesmas fases nas empresas coletadas.
- **Linha de comando.** Roda o Enriquecimento e o Filtro 3. Teste com um limite antes da carga toda:

```bash
npm run capex:processar -- --grupo Bracell --limite 5
```

- **Desligar uma fase.** `CAPEX_FILTRO=0`, `CAPEX_ENRIQUECIMENTO=0` ou `CAPEX_FILTRO_FINAL=0`. A fase desligada sai das condições, e a próxima fase lê direto o que a anterior manteve.

## Efeito nas notícias já guardadas

As notícias que o Filtro 2 manteve antes desta mudança saem de "A revisar" e vão para "Em processamento". Elas só voltam depois do Enriquecimento e do Filtro 3. O botão "Processar" faz isso.
