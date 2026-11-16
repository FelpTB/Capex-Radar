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

## Coleta focada: trazer menos informação inútil

A pré-triagem só descarta depois da coleta. Para trazer menos, a própria consulta passou a usar o que separa os registros úteis.

### O que os portais aceitam (testado em nov/2026)

| Portal | Empresa **e** município na mesma busca? |
|---|---|
| DOU | Sim: `"Ascenty" "Vinhedo"` traz 2 atos, contra 33 só com o nome |
| DOE-SP | Não: termos se somam (OU); frase com o município não acha nada |
| DOE-PR, BA, GO, MT, ES, SE, AP (IONEWS) | Não de forma confiável |
| DOE-MS | Não: as palavras são somadas (OU) |

Onde o portal não aceita o município, os filtros possíveis são a data, o CNPJ buscado e o órgão do ato.

### Padrões que guiam a coleta

- **Diários.** As 74 diretas citavam o município. Nenhuma era de mais de 2 anos antes do anúncio. Todas vieram de órgãos de meio ambiente, águas, energia, desenvolvimento ou prefeituras. Os atos da Junta Comercial, do Ministério Público, de metrologia, de ensino e de finanças somavam 1.824 atos, nenhum útil.
- **Raiz do CNPJ.** A busca pela raiz trazia os atos de todas as unidades da empresa: ~1.700 registros para 4 diretas.
- **Fontes estruturadas** (ANA, BNDES, SIGA, CNO). Vinham da empresa no país inteiro: 80% das outorgas da ANA e 70% dos contratos do BNDES eram de outra UF.

### O que mudou na consulta

| Fonte | Antes | Agora |
|---|---|---|
| Todos os diários | desde 2015 | desde 3 anos antes do anúncio do projeto (`desde_busca`) |
| Diários estaduais e municipais (SIGPUB) | raiz do CNPJ + nome | CNPJ completo das filiais do grupo no município + nome. Sem filial conhecida, raiz + nome. 93 dos 117 projetos têm filial no município |
| Diários com órgão no resultado (DOE-SP, DOU, PE, SC, RJ, SIGPUB) | todo ato | sai ato de órgão que não publica obra (`orgaoSemObra`, em `src/enrichment/estaduais.js`) |
| DOU | só o nome; os 5 atos mais recentes | nome **e** município. Sem resultado, só o nome. Ficam os atos da janela, e os que citam o município vêm antes |
| ANA (outorgas) | empresa no país | empresa na UF do projeto |
| BNDES | empresa no país | UF do projeto, contratos da janela |
| ANEEL SIGA | empresa no país | UF do projeto |
| CVM | 12 documentos mais recentes | documentos da janela |
| IAT e ANTAQ (por nome) | 100 registros do estado | município do projeto (nome ou código IBGE) |
| CNO | até 8 obras, inclusive de outras UFs, as mais antigas primeiro | obras da UF do projeto (o município vem antes), as mais recentes primeiro. O campus de Tamboré tem obras em Barueri e em Santana de Parnaíba |
| ANM (SIGMINE), ONS/EPE | consultados | fora do Enriquecimento 2 |

### Medição (12 projetos, coleta nova sem gravar × coleta de nov/2026)

| | Antes | Agora |
|---|---|---|
| Registros coletados | 1.163 | **712 (−39%)** |
| Registros que vão ao julgamento (após a pré-triagem) | 1.163 | **252 (−78%)** |
| Diretas ainda encontradas | 60 | **55 (92%)** |

Perdas conhecidas:
- **4 outorgas da Ambev em Carambeí (2022).** Saíram no nome da filial de Ponta Grossa (0027-49), antes de a fábrica nova ter CNPJ próprio. O texto não cita Carambeí, só a bacia. Só voltariam com a busca pela raiz, que traz ~1.700 registros inúteis.
- **1 ato da Bracell no DOE-SP.** A busca pelo nome devolve no máximo 100 atos por termo.

## Próximos passos possíveis

- **DOE-MS** (112 registros em um projeto, nenhuma direta). O resultado é a página inteira do diário, sem órgão. Vale buscar só no caderno do Imasul, se o portal permitir.
- **CVM** (34 registros na amostra, nenhuma direta). Ler só fato relevante cujo assunto cite obra, ampliação ou investimento.
- **Filiais antigas.** Incluir no cadastro as filiais baixadas ou de outro município que já responderam pela obra (caso Ambev 0027-49).
