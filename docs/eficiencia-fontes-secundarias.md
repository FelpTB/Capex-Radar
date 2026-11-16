# Eficiência das fontes secundárias

Análise dos registros do reprocessamento da carteira (nov/2026, 117 projetos ativos). Cada registro encontrado nas fontes secundárias foi julgado contra o projeto. Base: `capex_radar.registros_analisados`.

## Resultado das consultas

- 9.228 registros analisados; **124 com correlação direta (1,3%)**.
- 1.601 eram de outro estado e já saíam pela UF.
- Dos 7.627 restantes, 6.839 não citavam o município do projeto. Só 7 deles tinham correlação direta (0,1%).

As consultas buscam pelo CNPJ e pela razão social da **empresa**. Por isso trazem os atos de todas as unidades dela: outorgas de outras fábricas, multas, débitos de ICMS, comunicados da CVM.

### Por fonte

| Fonte | Registros | Diretas | Observação |
|---|---|---|---|
| DOE-SP | 2.157 | 23 | 1.752 sem o município de nenhum projeto da empresa |
| ANA (SNIRH) | 874 | 3 | 694 de outro estado |
| IAT (PR) | 719 | 15 | traz o código IBGE, não o nome do município |
| DOE-MS | 670 | 0 | |
| BNDES | 587 | 7 | 414 de outro estado |
| CNO | 524 | 23 | melhor fonte estruturada (17 projetos com direta) |
| DOU | 473 | 9 | |
| ANM (SIGMINE) | 433 | 0 | títulos minerários, sem relação com os nichos |
| DOE-PR | 432 | 21 | |
| ANEEL (SIGA) | 303 | 0 | cadastro de geradores |
| CVM | 202 | 1 | comunicados gerais da empresa |
| ONS/EPE (PAR) | 44 | 0 | plano da transmissão, não é obra da empresa |

## O que separa os registros aproveitados

| Sinal | Registros | Diretas | Aproveitamento |
|---|---|---|---|
| Cita o município do projeto | 788 | 117 | 14,8% |
| Não cita | 6.839 | 7 | 0,1% |
| CNPJ da filial do município | 201 | 20 | 10,0% |
| Mais de 2 anos antes do anúncio | 1.626 | 4 | 0,2% |
| Ato de rotina sem obra/licença | 1.289 | 2 | 0,2% |
| Município + data (−2 a +3 anos) + ato de obra/licença | 144 | 59 | 41,0% |

## O que mudou

**Pré-triagem antes do julgamento** (`preTriagem`, em `src/enrichment/correlacao.js`). O registro só vai para o julgamento quando passa nas três regras:

1. Cita o município do projeto, o CNPJ da filial ou o mesmo código IBGE. Projeto sem município (só UF ou várias localidades) não tem essa exigência.
2. Não é de mais de 2 anos antes do anúncio. O limite é de 5 anos para licença prévia ou de instalação, outorga e EIA/RIMA. O CNO (matrícula de obra) não tem limite.
3. Não é ato de rotina (multa, débito de ICMS, pregão, ata, intimação) sem ato de obra ou licença.

O que não passa fica em `registros_analisados` como `outro_projeto`, com o motivo, e continua visível na ficha do projeto.

Sobre os mesmos 7.627 registros, a regra:
- corta **87,7%** do volume;
- mantém **119 das 124** diretas;
- leva a precisão de 1,6% para **12,7%**.

**Fontes sem retorno** (ANM/SIGMINE e ONS/EPE) não são mais consultadas no Enriquecimento 2 (`FONTES_SEM_RETORNO`, em `src/capex-fontes-secundarias.js`).

**Código IBGE do projeto**: é preenchido pela API do IBGE na primeira consulta, para casar com a base do IAT.

## Próximos passos possíveis

- **Buscar já com o município.** Os diários são consultados pelo nome da empresa desde uma data fixa. Incluir o município e a janela de datas na própria busca (onde o portal permite) reduziria o tempo de coleta, que levou ~3 h para 117 projetos. Hoje o corte acontece só depois da coleta.
- **Rever DOE-MS, DOE-RJ e DOE-MA.** Não tiveram nenhuma direta. Vale ver se a busca acha os atos de licenciamento desses estados (Imasul, Inea, Sema-MA) ou só atos fiscais.
- **CVM:** só fato relevante que cite a obra ou o município.
