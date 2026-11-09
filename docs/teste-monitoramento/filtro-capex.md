# Teste de monitoramento — filtro CapEx

Segunda passada sobre a fila "A revisar", depois da triagem e antes do agente e da revisão humana. O código está em [`src/capex-filtro.js`](../../src/capex-filtro.js) e a migração em [`sql/023`](../../sql/023_capex_radar_filtro.sql).

## Por que existe

A triagem usa o Claude Haiku e lê só a manchete. Ela é larga de propósito: deixa passar tudo que fala de ativo físico do grupo. Depois da carga histórica (09/11/2026), sobraram 1.506 notícias marcadas como possível projeto novo. Muitas eram:

- **repetições do mesmo fato**: o mesmo anúncio publicado por vários veículos, como as sete manchetes da JBS em Diamantino entre 18 e 21/06/2023;
- **coisas que não são CapEx**: aquisição de frigorífico, reabertura de unidade, inauguração de obra pronta, plano agregado ("R$ 15 bi até 2026"), governo tentando atrair a empresa, expansão fora do Brasil.

## Como funciona

1. **Fila.** Notícias da fila "A revisar" que a versão atual do filtro (`filtro-v1`) ainda não leu.
2. **Ordem.** Por grupo, em ordem cronológica, em lotes de 25 manchetes.
3. **Contexto de cada lote.**
   - os projetos cadastrados do grupo;
   - as manchetes que seguem vivas até 120 dias antes ou depois do lote: as mantidas pelo filtro, as vinculadas e as com vínculo aceito.
4. **Modelo.** `CLAUDE_FILTER_MODEL` (padrão `claude-sonnet-5-5`), com esforço médio. O prompt traz a definição de CapEx do radar e manda o modelo ser rígido: na dúvida, descarta.
5. **Decisão.** Para cada manchete, `manter` ou `descartar` com um motivo:

| Motivo | Quando |
| --- | --- |
| `repetida` | mesmo fato de outra manchete (aponta qual) |
| `aquisicao` | aquisição, fusão ou compra de ativo pronto |
| `sem_obra` | máquinas, TI, frota, manutenção, marketing |
| `reabertura` | reabertura ou retomada de unidade existente, sem obra |
| `concluido` | inauguração ou obra pronta sem projeto cadastrado |
| `generico` | plano ou valor agregado sem ativo identificado |
| `especulacao` | governo quer atrair, empresa "estuda", sem decisão |
| `nao_investimento` | resultado, mercado, produto, varejo, gestão |
| `outra_empresa` | outra empresa, governo ou homônimo |
| `fora_brasil` | ativo fora do Brasil |
| `cancelado` | cancelado sem projeto cadastrado |

6. **Repetição.** Fica só uma manchete por fato, a mais completa. Um fato novo do mesmo empreendimento (licença, início de obra, financiamento) é mantido, para o agente ligar ao projeto.
7. **Travas em código** (`fecharDecisoes`):
   - descartar sem motivo válido vira manter;
   - `repetida` precisa apontar para uma manchete mantida; se não apontar, vira manter;
   - uma cadeia de repetidas é seguida até a manchete mantida.

## O que é gravado

- `capex_radar.evidencias.filtro`: `{versao, modelo, decisao, motivo, repete_id, justificativa, em}`.
- No descarte, a notícia vai para `triagem = 'descartada'` com o motivo "Filtro CapEx: …" (na repetição, com a manchete repetida). O vínculo sugerido é rejeitado.
- O ator nos logs é `ia:filtro`.
- A notícia descartada continua na aba Descartadas e pode ser restaurada pelo card.

## Onde roda

- **Botões da tela:** "Triar" e "Rodar o agente" fazem a triagem, depois o filtro e depois o agente.
- **Coleta semanal:** o agendador roda o filtro antes do agente.
- **Linha de comando:** `npm run capex:filtrar`. Opções:
  - `--grupo JBS`: só um grupo;
  - `--limite 50`: no máximo N notícias por grupo;
  - `--simular`: lista as decisões sem gravar, para conferir o prompt antes de aplicar;
  - `--modelo`: troca o modelo.
- **Agente:** com o filtro ligado, ele só lê as notícias que o filtro manteve. `CAPEX_FILTRO=0` desliga o filtro e devolve a fila inteira ao agente.

Quando o prompt mudar, suba `VERSAO_FILTRO`. A fila da nova versão inclui o que ainda está em "A revisar"; o que a versão anterior já descartou não volta.
