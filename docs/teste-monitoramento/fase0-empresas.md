# Teste de monitoramento — Fase 0: empresas

Fechada em 04/11/2026. Lista em formato de carga: [`seeds/capex_radar/empresas-teste.json`](../../seeds/capex_radar/empresas-teste.json).

## Critérios

- **Maiores:** rankings publicados, cruzando pelo menos dois por nicho. As fontes estão no JSON (`fontes_ranking`).
- **Alimentos e Bebidas:** o ranking publicado só traz quem divulga balanço. Nestlé, Heineken, Coca-Cola FEMSA, PepsiCo, Mondelez, Lactalis e Danone entram pela relevância, com a receita Brasil a confirmar no relatório da matriz.
- **Tradings fora:** Cargill, Bunge, Amaggi, COFCO, Copersucar e ALZ Grãos.
- **Concessão:** exclui quem tem a concessão pública como negócio (energia, telecom STFC, rodovias, saneamento, Petrobras). Arrendamento portuário usado como logística fica só como nota.
- **Estatais:** nenhuma das escolhidas tem natureza jurídica 2011 (empresa pública) ou 2038 (economia mista) no `cnpj_db`.

## Lista

| Nicho | Empresas |
|---|---|
| Papel e Celulose (7) | Suzano, Klabin, Eldorado, Sylvamo, Cenibra, Bracell, CMPC |
| Alimentos e Bebidas (20) | JBS, MBRF, Ambev, Minerva, Aurora, C.Vale, Camil, Copacol, Três Corações, M. Dias Branco, Piracanjuba, Solar Coca-Cola, Caramuru, Nestlé, Heineken, Coca-Cola FEMSA, PepsiCo, Mondelez, Lactalis, Danone |
| E-commerce (6) | Mercado Livre, Magalu, Shopee, Amazon, Casas Bahia, Shein |
| Datacenters (5) | Ascenty, ODATA, Scala, Elea, Equinix |

## Pendências

- **Shein:** matriz IN GLOW BRASIL INTERMEDIACAO DE NEGOCIOS LTDA (45.814.425/0001-72), localizada em 09/11/2026 pelo sócio ROADGET BUSINESS PTE. LTD. (holding de Singapura) no `cnpj_db`. Relacionadas: IN GLOW BRASIL INTERMEDIACAO E TECNOLOGIA (46.338.048) e MODA MUNDIAL BRASIL PAGAMENTOS (50.617.696). As filiais da IN GLOW em Guarulhos/SP, abertas em 2024, correspondem aos CDs.
- **Receita Brasil das multinacionais:** usada só para ordenar; não muda a lista.

## O que isso muda no esquema (Fase 1)

- **Uma empresa tem várias raízes de CNPJ.** Seara (JBS), BRF (MBRF), Ebazar (Mercado Livre) e Norsa (Solar) são CNPJs próprios. ODATA e Equinix abrem uma SPE por campus. O esquema precisa de um nível **grupo** acima da matriz, ou de "entidades relacionadas" ligadas a ela, para que um projeto em CNPJ de SPE caia na empresa certa.
- **A matriz pode ser holding** (Solar Bebidas, Ascenty Participações). As fábricas ficam nas operacionais, então a busca de filiais deve olhar todas as raízes do grupo.
