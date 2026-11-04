# Teste de monitoramento — Fase 2: cadastro das empresas

Fechada em 04/11/2026. Migração [`sql/019_capex_radar_busca.sql`](../../sql/019_capex_radar_busca.sql) e carga com `npm run capex:carga-empresas`, que agora também grava os termos de busca.

## O que a fase entrega

1. **Matrizes e filiais carregadas** do `cnpj_db` (detalhes em [fase1-esquema.md](fase1-esquema.md#carga-das-empresas)).
2. **Prioridade de cada filial pelo CNAE do nicho**, para separar fábrica e CD de loja, açougue e escritório.
3. **Termos de busca por empresa** e o módulo que monta a consulta do Google News RSS para o coletor da Fase 3.

## Prioridade pelo CNAE

A tabela `capex_radar.nicho_cnae` lista, por nicho, os prefixos de CNAE que importam. A view `capex_radar.vw_filiais` marca cada filial pelo prefixo mais longo que casa com o CNAE principal:

| Tipo | Significa |
|---|---|
| `industrial` | Fábrica: celulose, papel, embalagem, alimentos, bebidas |
| `logistica` | CD, armazém, transporte, atacado usado como CD |
| `insumo` | Base de matéria-prima: florestas plantadas, granjas |
| `infraestrutura` | Campus de datacenter: colocation, telecom, energia, SPE de obra |

| Nicho | Filiais | Industrial | Logística | Insumo | Infraestrutura | Sem prioridade |
|---|---|---|---|---|---|---|
| Alimentos e Bebidas | 2.394 | 556 | 730 | 156 | — | 952 |
| Datacenters | 94 | — | — | — | 90 | 4 |
| E-commerce | 3.280 | — | 212 | — | — | 3.068 |
| Papel e Celulose | 1.241 | 124 | 11 | 1.021 | — | 85 |

- **E-commerce:** 3.008 das 3.280 são lojas (4713, 4753), sem prioridade. O CapEx do nicho está nos 212 CDs e transportadoras.
- **Alimentos:** atacado de bebidas e alimentos (4632–4639) conta como logística, porque é o CNAE dos CDs de distribuição (Ambev, Solar). Açougues da JBS (4722) e escritórios ficam sem prioridade.
- **Papel e celulose:** 1.021 filiais são áreas de eucalipto (`insumo`). Projeto de fábrica nova costuma vir com expansão florestal, então elas ficam visíveis, mas separadas da fábrica.
- Só o CNAE principal conta. Uma sede com CNAE secundário industrial fica sem prioridade.

Para mudar a regra, edite `nicho_cnae`. A view recalcula na hora.

## Termos de busca

O seed [`seeds/capex_radar/termos-busca.json`](../../seeds/capex_radar/termos-busca.json) vira `capex_radar.grupo_termos`, com 104 termos nas 38 empresas. Cada termo tem um tipo: `marca`, `razao_social`, `variacao` ou `exclusao`. A carga não apaga termos criados direto no banco; para desligar um termo, use `ativo = false`.

O módulo [`src/capex-busca.js`](../../src/capex-busca.js) monta a consulta assim:

```
(termos da empresa com OR) (contexto do nicho com OR) -"exclusões" after:2023-01-01
```

Exemplo (Mercado Livre):

```
("Mercado Livre" OR "Mercado Libre" OR "Ebazar" OR "Mercado Envios") ("centro de distribuição" OR CD OR galpão OR hub OR investimento OR expansão OR obra OR inaugura OR "centro logístico") after:2023-01-01
```

- **O contexto é obrigatório.** Sem ele, a marca traz resultado trimestral, promoção e homônimos.
- **Marcas ambíguas entram na forma composta:** "Minerva Foods", "Scala Data Centers", "Solar Coca-Cola", "Eldorado Brasil", "Amazon Brasil".
- **Exclusões só onde o ruído é certo:** Suzano, Três Corações e Piracanjuba também são municípios, então ficam de fora "Prefeitura de …". A Amazon exclui "Amazônia", "Prime Video" e "AWS".
- **Testado ao vivo em 04/11/2026:** Amazon trouxe 31 itens e Bracell trouxe 55, com notícias de investimento no topo. Ainda vem ruído (livros "na Amazon Brasil"), e filtrar isso fica para a Fase 3.

## O que fica para a Fase 3

- O RSS devolve no máximo cerca de 100 itens por consulta. Para cobrir 2023 até hoje, o coletor precisa fatiar a janela com `after:`/`before:`; `consultaGoogleNews` já aceita `desde` e `ate`.
- A Shein tem termos, mas segue sem matriz. Uma notícia dela pode virar evidência, mas o projeto só nasce quando houver CNPJ.
- Garoto (Nestlé), Itambé (Lactalis) e Purina estão nos termos, mas os CNPJs delas não estão nas relacionadas. Um projeto nessas marcas cai na matriz do grupo até alguém incluir a raiz.
