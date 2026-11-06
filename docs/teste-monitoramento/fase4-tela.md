# Teste de monitoramento — Fase 4: tela de Monitoramento

Item **Monitoramento** no menu. Rotas em [`src/capex-painel.js`](../../src/capex-painel.js) e consultas em [`src/capex-painel-db.js`](../../src/capex-painel-db.js). A fase não tem migração: a tela usa as tabelas e views das Fases 1 a 3.

## Páginas

| Rota | O que mostra |
|---|---|
| `/monitoramento` | Números do teste, filtro por empresa e situação, notícias (150 mais recentes do filtro) e tabela das 38 empresas, com o botão **Triar com IA** quando há notícia sem triagem. |
| `/monitoramento/noticias/:id` | Notícia, leitura da IA (objeto, local, valor, estágio, filial sugerida), vínculos e as ações de revisão. |
| `/monitoramento/carteira` | Projetos criados na revisão (`vw_carteira`), com filtros por empresa, nicho, UF, estágio, situação, faixa de valor e ano do anúncio, e ordenação. |
| `/monitoramento/projetos/:id` | Projeto com a linha do tempo das evidências aceitas (`vw_projeto_timeline`) e a exclusão. |

**Situações da notícia:**

- **A revisar:** a IA leu e achou CapEx, ou sugeriu um vínculo.
- **Sem triagem:** ainda não passou pela IA.
- **Vinculadas:** já estão ligadas a um projeto.
- **Descartadas:** saíram pelas regras, pela IA ou na revisão.

Sem filtro escolhido, a página abre em "A revisar". Se não houver nada para revisar, abre em "Todas".

## Ações de revisão

Todas gravam com o ator `usuario:painel` no `log_acao`.

- **Criar projeto.** O formulário vem pré-preenchido com a leitura da IA. A matriz é a principal do grupo, a filial é a sugerida (lista das prioritárias da UF) e a data é a do fato ou a da publicação. Na mesma transação, o projeto nasce com a notícia como evidência primária, o vínculo fica `aceito` (origem `manual`), as sugestões abertas viram `rejeitado` e a notícia passa a `vinculada`. Grupo sem matriz (Shein) não oferece o formulário.
- **Vincular a projeto existente.** Aceita a sugestão da IA, se houver, ou cria o vínculo manual. Só aceita projeto da mesma empresa.
- **Rejeitar sugestão.** A notícia volta como possível projeto novo.
- **Descartar.** A notícia vai para `descartada`, com o motivo `Revisão: …`, e as sugestões abertas dela são rejeitadas.
- **Triar com IA.** Roda a triagem da Fase 3 (Claude Haiku 5.5) em até 100 notícias sem triagem da empresa e mostra o resumo no topo.
- **Excluir projeto.** Apaga o projeto, os vínculos e as notícias que só pertenciam a ele. A notícia ligada também a outro projeto fica, sem o vínculo apagado.

## O que fica para depois

- Editar um projeto depois de criado (estágio, valor, filial).
- Agrupar as notícias do mesmo ativo antes da revisão.
- Login: hoje qualquer pessoa com o link pode revisar, e o ator é sempre `usuario:painel`.
