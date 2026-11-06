# Teste de monitoramento — Fase 5: revisão mais rápida e buscas transparentes

Ajustes na tela de Monitoramento ([Fase 4](fase4-tela.md)) para acelerar a triagem. O código está em [`src/capex-painel.js`](../../src/capex-painel.js), [`src/capex-triagem-jobs.js`](../../src/capex-triagem-jobs.js) e [`public/monitoramento.js`](../../public/monitoramento.js).

## Revisão no card

A lista de notícias virou uma lista de cards. Cada card mostra:

- o título, com link para a matéria;
- o veículo, a data e a empresa;
- a leitura da IA (objeto, local, valor, estágio) e o motivo dela;
- a sugestão de vínculo, quando houver.

Ações no próprio card, sem abrir a notícia e sem recarregar a página:

- **Aprovar como projeto.** Cria o projeto com a leitura da IA: matriz principal, filial sugerida, data do fato ou da publicação. Quando a IA sugeriu um projeto existente, o botão vira **Aceitar vínculo**.
- **Descartar.** Pede um motivo da lista (não é CapEx, homônimo, resultado financeiro, repetida, fora do Brasil, já em operação) e aceita uma observação opcional.
- **Desfazer.** Aparece no card descartado e devolve a notícia para a revisão.

O card é redesenhado no mesmo lugar, os números do topo se atualizam e a posição da página não muda. Para ajustar um projeto antes de criá-lo (título, filial, valor), use o link **detalhes**.

## Triagem com barra de progresso

**Triar N sem triagem** (no topo) e **Triar N** (por empresa) iniciam a triagem em segundo plano. A barra mostra quantas notícias já foram lidas e qual empresa está em andamento. No fim, aparece o resumo e a lista se atualiza sozinha.

Roda uma triagem por vez. Se a página for reaberta no meio, a barra continua de onde está. O andamento fica em memória: um reinício do app perde só a barra, porque o que foi triado já está gravado.

## Buscas (aba nova)

`/monitoramento/buscas?grupo=…` mostra, por empresa:

- **a receita da consulta:** termos por tipo (marca, razão social, variação, exclusão), o contexto do nicho e a consulta dos últimos 90 dias, com o link para abrir no Google News;
- **Testar a busca agora:** lê o RSS ao vivo, sem gravar nada, e marca o que é novo e o que já estava guardado;
- **o histórico de janelas:** período, status, matérias devolvidas, novas e guardadas no período, a explicação do resultado e a consulta exata. Ao abrir uma janela, aparecem as notícias guardadas dela.

A explicação mostra se a janela veio vazia (o Google não achou nada com termos e contexto), se todas as matérias já estavam guardadas, se bateu no teto do RSS ou se o Google recusou o servidor (HTTP 503).

Em 05/11/2026, a busca da Heineken aparecia como "O Google recusou o servidor" no Railway e, testada localmente, trouxe 59 matérias. A janela vazia era bloqueio do servidor, não falta de notícia.

## Navegação

- As abas, os links internos do monitoramento e os filtros trocam só o conteúdo da página, com transição suave. Os filtros aplicam ao mudar o select, sem botão e sem voltar ao topo.
- O voltar e o avançar do navegador funcionam e devolvem a posição da página.
- Sem JavaScript, links e formulários continuam funcionando com recarga normal.

## Projetos do modelo antigo

Os 5 projetos e as 41 evidências de `public.projeto` e `public.evidencia` foram excluídos em 05/11/2026, para o foco ficar no teste. O backup está em `data/backups/projetos-antigos-2026-11-05.json`, que não é versionado.

A página inicial e o logo agora abrem o Monitoramento. O menu antigo continua como "Projetos (MVP)".

## Filtros da carteira

`/monitoramento/carteira` filtra os projetos por empresa, nicho, UF, estágio, situação (ativos e em revisão por padrão; descartados só quando pedidos), faixa de valor estimado e ano do anúncio. O ano usa a data do anúncio ou, sem ela, a da primeira evidência. A ordem pode ser por evidência mais recente, maior valor, anúncio mais recente ou número de evidências.

Os filtros aplicam ao mudar o select, sem recarregar a página, e ficam na URL. Abaixo deles aparecem a contagem e a soma do valor estimado do que está filtrado.
