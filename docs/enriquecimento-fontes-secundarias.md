# Fontes secundárias — mapa para o enriquecimento

Atualizado em 14 de outubro de 2026. Cobre só as 22 fontes secundárias conectadas ao sistema, as mesmas de `collectableSources()` em `src/enrichment/viability.js`. A coleta da ficha (`src/enrichment/run.js`) consulta cada uma e grava a evidência. As fontes cadastradas e sem conexão ficam no catálogo completo, em [fontes-mapeadas.md](../fontes-mapeadas.md).

Dezesseis fontes têm ficha longa abaixo, escrita no estudo de 29 de setembro de 2026 e apoiada, onde o órgão publica o dicionário, na leitura direta desse dicionário (BNDES, SIGA e IAT/PR). As outras seis (ANP Campos, ANP Plataformas, ANP Dutos, REIDI, Querido Diário e DOU) foram conectadas depois do estudo; a ficha delas está na página da fonte no sistema, em `/fontes/<código>`, e o resumo está na seção 5.

A nota de importância vai de 1 a 10 para **confirmar um projeto privado já nascido da notícia**. Obra só de recurso público tem nota menor nesse recorte, porque o filtro atual tira investimento de órgão, concessão e PPP da fila de aprovação.

## Como a secundária entra no fluxo

A notícia aprovada já gravou `projeto` (nome, nicho, UF, município, empresa, CNPJ, valor de manchete, fase verbal) e uma `evidencia` primária com a URL da matéria.

O CNPJ chega resolvido da estruturação. Projeto de R$ 100 milhões costuma ter dona conhecida; a notícia dá o nome, e o nome vira CNPJ numa base própria de empresas já vistas ou numa API de consulta por razão social, com UF e atividade como desempate. O modelo de texto nunca escreve esse número. Quando a resolução não fecha um cadastro único (grupo com várias SPEs, nome fantasia sem correspondência), a ficha vai à aprovação com `cnpj` vazio e o enriquecimento roda em modo de menor confiança, por nome e UF, até a primeira secundária devolver o número.

O enriquecimento começa nessa ficha, com o CNPJ como chave, não na capa do portal.

1. A rotina escolhe a secundária pelo nicho e pela UF. Energia de geração vai ao SIGA. Crédito, ao BNDES. Licença federal, ao SISLIC. Licença no Paraná, ao IAT. Obra civil, ao CNO. Companhia aberta, à CVM.
2. A consulta usa o CNPJ. Onde a base não indexa por CNPJ (SISLIC, IAT, ANP, SIGMINE, DOU, Querido Diário), a razão social do cadastro e o município substituem o número, e o CNPJ serve para conferir o retorno.
3. O resultado vira `evidencia` com `papel = secundaria`, `id_fonte`, URL do registro e `campos_extraidos` em JSON. Falha de acesso vai para `acesso_log` e atualiza `fonte.status_acesso`.
4. Valor oficial sobe para a ficha só quando a evidência o trouxe. `valor_confianca` passa a `alta`. A fase (`lp`, `li`, `construcao`, `operacao`) só muda quando o registro da secundária for mais novo e mais específico que a manchete. CNPJ divergente entre a ficha e a secundária não sobrescreve nada: vira alerta para a pessoa, porque pode ser SPE do mesmo grupo.

Configuração, hoje, é a linha em `fonte`: `codigo`, `url_base`, `categoria`, `formato_dado`, `auth_acesso`, `papel_captura`. Credencial fica em variável de ambiente no servidor, nunca no HTML nem no git. A coleta lê essa linha e grava evidência. Não há job semanal varrendo essas bases: a cadência é a da ficha (na aprovação e quando uma matéria nova mudar a fase).

Chaves de amarração, da mais forte para a mais fraca:

| Chave na ficha | Onde a secundária responde |
| --- | --- |
| CNPJ de 14 dígitos | BNDES, CVM IPE, SIGA (dentro de `DscPropriRegimePariticipacao`), ANTT, REIDI |
| Raiz do CNPJ (8 dígitos) | CNO, ANA |
| Código estável do ativo, obtido na primeira evidência | CEG no SIGA; `id_cno`; `numero_do_contrato` do BNDES; número de processo do Ibama |
| Razão social do cadastro + UF + município | SISLIC, IAT, ANTAQ, ANP (blocos, campos, plataformas e dutos), SIGMINE, DOU, Querido Diário |
| Lote da concessão ou nome do projeto + UF | ARTESP, ONS |
| Nome do empreendimento | Desempate quando a empresa tem mais de um ativo no mesmo município |

A raiz do CNPJ (8 dígitos) casa matriz e filiais. A SPE de um grupo tem raiz diferente; quando a notícia cita o grupo e a base devolve a SPE, os dois números ficam na evidência, e a SPE passa a ser a dona na ficha depois de confirmação humana.

## Quadro das fontes conectadas

| Código | Fonte | Escopo | Formato | Nota | Substituível por |
| --- | --- | --- | --- | --- | --- |
| SEC-BNDES | BNDES operações | Financiamento com valor e CNPJ | CSV | 10 | Base dos Dados, com atraso e GCP |
| SEC-SIGA | ANEEL SIGA | Usina, fase, kW, coordenada, CEG | CSV/XML | 9 | SIGEL cobre o mapa, com menos atributo |
| SEC-IBAMA | Ibama SISLIC | Ato federal pelo nome completo, dez colunas | CSV | 8 | Consulta LAF complementa; não substitui o arquivo |
| SEC-CVM-IPE | CVM IPE (arquivo) | Comunicado de companhia aberta | ZIP | 8 | ENETWeb na consulta pontual; RI no PDF da empresa |
| SEC-CNO | CNO | Canteiro civil, sem valor | ZIP/CSV | 7 | BD `br_rf_cno` |
| SEC-ANP-EP | ANP E&P | Bloco, campo, plataforma | CSV | 7 | Nenhuma base única |
| CAPTURA-SIGMINE | SIGMINE | Processo minerário | ZIP | 7 | Notícia da ANM não substitui o cadastro |
| SEC-ANTT-INV | ANTT investimentos | Cinco CSVs cruzados por id_sigicor | CSV | 6 | Portal Cidadão do DNIT é outra obra |
| SEC-IAT | IAT/PR | Licença do Paraná | JSON GIS | 7 | Só dentro do PR |
| SEC-ANTAQ-INST | ANTAQ instalações | Quem opera o terminal | CSV | 6 | Nenhuma para o cadastro |
| SEC-ANA-SNIRH | ANA / SNIRH | Outorga de água | GIS | 5 | SIGA para a usina; SINISA para o indicador |
| SEC-ARTESP | ARTESP | Programação da concessão paulista | XLSX/GeoJSON | 5 | ANTT não cobre a malha estadual |
| CAPTURA-ONS-PAR | PAR/PET do ONS | Transmissão planejada | PDF | 5 | Outorga da ANEEL vem depois |
| SEC-ANP-CAMPO | ANP campos | Campo com produção no mês | CSV | — | — |
| SEC-ANP-PLAT | ANP plataformas | Plataforma em operação | CSV | — | — |
| SEC-ANP-DUTO | ANP dutos | Duto de exploração e produção | CSV | — | — |
| CAPTURA-REIDI | REIDI | Projeto de transporte habilitado ao incentivo | CSV | — | — |
| CAPTURA-QD | Querido Diário | Trecho de diário municipal | JSON | — | — |
| CAPTURA-DOU | DOU | Ato oficial federal | HTML | — | — |

As seis últimas linhas não passaram pelo estudo de 29 de setembro e ficam sem nota.

---

## 1. Financiamento e companhia aberta

### SEC-BNDES — BNDES Operações de Financiamento

**Escopo.** Operação de financiamento contratada com o BNDES desde 2002, direta ou indireta revisada por analista. É o lugar em que um projeto privado ganha descrição e valor oficial, consultado pelo CNPJ da empresa. Não é a obra e não é o desembolso agregado por UF.

**Acesso.** CKAN público em `https://dadosabertos.bndes.gov.br/dataset/operacoes-financiamento`. Sem token para leitura. Atualização mensal. CSV em Windows-1252, separador `;`, decimal `,`. O recurso útil é “Operações não automáticas”, cerca de 19 MB e 23.815 linhas no datastore em 29 de setembro de 2026 (recurso `6f56b78c-510f-44b6-8274-78a5b7e931f4`). O arquivo de indiretas automáticas tem cerca de 1,1 GB e fica de fora. Cada linha é um subcrédito; a soma dos subcréditos é o contrato.

**Tipo de dado.** CSV, também consultável em JSON pelo `datastore_search`.

**Informação.** Quem tomou, quanto foi contratado, quanto foi desembolsado, em que município, com qual produto e em que situação o contrato está.

**Campos** (dicionário do datastore, operações não automáticas):

| Campo | O que é |
| --- | --- |
| `cliente` | Nome de quem contratou |
| `cnpj` | CNPJ formatado do cliente |
| `descricao_do_projeto` | Texto curto do objeto. É a ponte com o nome da notícia |
| `uf`, `municipio`, `municipio_codigo` | Onde o BNDES registrou a operação. O código é IBGE |
| `numero_do_contrato` | Chave do contrato. Repete quando há mais de um subcrédito |
| `data_da_contratacao` | Data de registro. Pode atrasar em relação à assinatura |
| `valor_contratado_reais` | Valor na data do contrato, já em reais, mesmo se o indexador for outro |
| `valor_desembolsado_reais` | Liberado, atualizado no meio e no fim do ano. Pode passar do contratado se o indexador subir |
| `fonte_de_recurso_desembolsos` | De onde saiu o dinheiro desembolsado |
| `custo_financeiro`, `juros` | Indexador e taxa |
| `prazo_carencia_meses`, `prazo_amortizacao_meses` | Prazos |
| `modalidade_de_apoio` | Reembolsável ou não |
| `forma_de_apoio` | `DIRETA` ou indireta |
| `produto`, `instrumento_financeiro` | Família (FINEM, por exemplo) e instrumento |
| `inovacao` | Marcação de inovação |
| `area_operacional` | Área interna do banco |
| `setor_cnae`, `subsetor_cnae_agrupado`, `subsetor_cnae_codigo`, `subsetor_cnae_nome` | Atividade |
| `setor_bndes`, `subsetor_bndes` | Classificação própria do banco |
| `porte_do_cliente`, `natureza_do_cliente` | Porte e se é empresa, administração pública, etc. |
| `instituicao_financeira_credenciada`, `cnpj_da_instituicao_financeira_credenciada` | Agente, nas indiretas. Nas diretas vem traço |
| `tipo_de_garantia`, `tipo_de_excepcionalidade` | Garantia e exceção |
| `situacao_do_contrato` | Situação do crédito, não a fase da obra |

**Configuração.** A linha `SEC-BNDES` já aponta o dataset. O conector baixa só o recurso não automático, ou consulta o datastore com filtro de CNPJ e de valor. Encoding Windows-1252 na carga do CSV oficial. Não há segredo.

**Amarração.** `projeto.cnpj` com `cnpj` (o arquivo traz o número formatado; a comparação é por dígitos). `projeto.uf` e `municipio_codigo` confirmam o lugar. `descricao_do_projeto` escolhe a operação certa quando a empresa tem várias. `valor_contratado_reais` pode elevar `valor_capex` e `valor_confianca` para alta. Se a operação estiver no nome de uma SPE cuja raiz difere da ficha, a linha entra como evidência e o CNPJ da SPE fica em `campos_extraidos` para a pessoa decidir. A URL da evidência é a do recurso CKAN mais o número do contrato.

**Importância.** 10. É a secundária que transforma “a empresa anunciou” em operação com valor oficial.

**Substituível.** Pela tabela `br_bndes_operacoes_contratadas` na Base dos Dados, se já houver projeto GCP. Usar um dos dois. Os agregados `consultas`, `aprovacoes` e `desembolsos` do mesmo portal não substituem: são totais, sem o projeto.

### SEC-CVM-IPE — CVM dados abertos IPE

**Escopo.** Índice semanal dos documentos que companhias abertas entregam (fato relevante, comunicado, entre outros). O CapEx está no PDF, não na linha do índice. SPE fechada não aparece.

**Acesso.** `https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe`, download público do ZIP do período. Sem chave.

**Tipo de dado.** ZIP com CSV de metadados e, em fluxo separado, o PDF do documento.

**Informação.** Qual empresa protocolou, que tipo de documento, qual assunto, em que data, e o link do arquivo.

**Campos.** O CSV tem 13 colunas e a carga grava todas: CNPJ_Companhia, Nome_Companhia, Codigo_CVM, Data_Referencia, Categoria, Tipo, Especie, Assunto, Data_Entrega, Tipo_Apresentacao, Protocolo_Entrega, Versao e Link_Download. Especie, nas duas categorias guardadas, é a declaração de aquisição ou de alienação de participação relevante. Tipo_Apresentacao separa a apresentação original da reapresentação espontânea e da reapresentação por exigência. Não há coluna de valor de investimento. O texto útil nasce da leitura do PDF, e só da empresa já ligada ao projeto.

**Configuração.** A carga baixa os ZIPs de 2025 e 2026, filtra Fato Relevante e Comunicado ao Mercado e grava as 13 colunas em enr_cvm_ipe, com chave protocolo e versão. A reapresentação fica distinguida por Tipo_Apresentacao e pelo número da versão.

**Amarração.** Nome da empresa da ficha com o nome ou o código CVM. O PDF vira `evidencia.url`. Trecho que citar o empreendimento entra em `trecho`. Valor citado no PDF pode propor atualização de `valor_capex`, com confiança alta só se o número estiver explícito no documento.

**Importância.** 8 para companhia aberta. 2 para SPE fechada, que simplesmente não está aqui.

**Substituível.** Pelo ENETWeb da CVM na consulta de uma empresa. Pelo portal de RI quando o mesmo PDF já está no site da companhia. Para varredura de um período, o ZIP é o caminho; os outros dois são o caminho pontual.

---

## 2. Ativo setorial

### SEC-SIGA — ANEEL SIGA

**Escopo.** Empreendimento de geração do parque nacional, da fase anterior à outorga até a revogação. É geração, não transmissão e não o contrato. Potência é proxy de porte. Não há coluna de reais.

**Acesso.** CKAN `https://dadosabertos.aneel.gov.br/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel`. Público. Há CSV e XML mensais e um par diário. O datastore do CSV mensal (`11ec447d-698d-4ab8-977f-b424d5deee6a`) tinha 25.133 linhas na geração de 1º de setembro de 2026. A API Conecta “Outorgas de Geração” é outro produto, com OAuth e consulta por CEG; não é este dump.

**Tipo de dado.** CSV e XML. Consulta JSON via `datastore_search`.

**Informação.** Nome, código CEG, fase, tipo de geração, potência, UF, municípios, coordenadas e quem participa.

**Campos** (CSV no datastore):

| Campo | O que é |
| --- | --- |
| `DatGeracaoConjuntoDados` | Data da extração |
| `NomEmpreendimento` | Nome da usina |
| `IdeNucleoCEG` | Núcleo do código |
| `CodCEG` | Código estável no formato GGG.FF.UF.999999-D.VV: tipo, fonte, UF, núcleo, dígito e versão. Exemplo `PCH.PH.MG.000008-6.1`. É a chave que sobrevive à troca de nome |
| `SigUFPrincipal` | UF principal |
| `SigTipoGeracao` | Sigla (PCH, UFV, EOL, UTE…) |
| `DscFaseUsina` | Fase: operação, construção, e as anteriores à outorga, até revogação |
| `DscOrigemCombustivel`, `DscFonteCombustivel`, `NomFonteCombustivel` | Fonte energética |
| `DscTipoOutorga` | Concessão, autorização, registro |
| `DatEntradaOperacao` | Entrada em operação da primeira unidade geradora. O arquivo escreve 1900-01-03 quando não há entrada, e a carga guarda nulo |
| `MdaPotenciaOutorgadaKw`, `MdaPotenciaFiscalizadaKw`, `MdaGarantiaFisicaKw` | Quilowatts, com vírgula decimal. Outorgada é o total autorizado ou registrado. Fiscalizada é a potência em operação, ou a última considerada se a usina não opera mais. Garantia física é a homologada pelo Ministério de Minas e Energia. O valor ,00 vira nulo. Não é megawatt e não é real |
| `IdcGeracaoQualificada` | Sim, Não ou vazio. Sim é o enquadramento da Resolução Normativa 235, de 14 de novembro de 2006 |
| `NumCoordNEmpreendimento`, `NumCoordEEmpreendimento` | Latitude e longitude, vírgula decimal |
| `DatInicioVigencia`, `DatFimVigencia` | Vigência da outorga |
| `DscPropriRegimePariticipacao` | Texto com participantes, percentual e CNPJ. O grafia do nome do campo é a do arquivo |
| `DscSubBacia` | Sub-bacia, quando hídrica |
| `DscMuninicpios` | Municípios, no plural do arquivo, às vezes mais de um |

**Configuração.** A carga baixa o CSV diário e grava as 23 colunas em enr_siga, uma linha por CodCEG. O CSV diário de 21/10/2026 não traz mais o CNPJ dentro de DscPropriRegimePariticipacao. A carga lê também o CSV mensal e, se o nome do agente é o mesmo, guarda o número dessa edição em cnpjs e a data dela em cnpj_edicao. Nome trocado não herda o CNPJ antigo. Fase Operação antiga não entra como pipeline; fase anterior à operação é a que confirma anúncio. A potência permanece em kW, sem conversão para MW.

**Amarração.** Nicho energia e UF da ficha. O CSV não tem coluna de CNPJ; o número está dentro do texto de `DscPropriRegimePariticipacao`. O conector extrai os CNPJs desse campo na carga e indexa por eles. A busca é `projeto.cnpj` (ou a raiz) nesse índice, com `DscMuninicpios` para escolher a usina certa quando a empresa tem várias. `NomEmpreendimento` é desempate, não chave. Se bater, `CodCEG` fica em `campos_extraidos` e a fase do SIGA pode propor `status` (`construcao`, `operacao`). Usina em nome de SPE do grupo aparece com outra raiz; aí a evidência guarda o CNPJ da SPE para a pessoa. A URL da evidência é a do recurso CSV.

**Importância.** 9 para geração. 1 para fábrica, porto ou mina.

**Substituível.** O SIGEL mostra o mesmo empreendimento no mapa, com menos fase e sem este dicionário. Não substitui o CSV. A notícia da ANEEL anuncia o ato; o SIGA é o cadastro.

### SEC-ANTT-INV — ANTT, investimentos da concessão

**Escopo.** Obra prevista ou acompanhada no contrato de concessão rodoviária ou ferroviária: duplicação, praça, pátio, trecho. É o cadastro regulatório que traz valor em reais. Não é a obra direta do DNIT nem o repasse do Obrasgov. Duplicação “em estudo” não é canteiro.

**Acesso.** Cinco URLs fixas no CKAN `https://dados.antt.gov.br/`. A autorização passou ao recurso cec76fd2 em 14/10/2026. Cada conjunto tem PDF de dicionário; a carga lê o CSV.

**Tipo de dado.** CSV e JSON.

**Informação.** Objeto do investimento, trecho, concessionária, valor e a etapa do acompanhamento (planejado, autorizado, em execução, encerrado).

**Campos.** O cadastro tem 27 colunas, a autorização 17, o encerramento 19, o PIP 6 e a série anual 3. A lista fechada está na página da fonte e em amostras/SEC-ANTT-INV/LEIA.txt. Nenhum arquivo tem CNPJ. O número do SEI não é documento da empresa. id_sigicor é a chave entre as três planilhas do SIGICOR. Somar autorização e cadastro infla o CapEx.

**Configuração.** Download dos cinco CSVs, parser sem aspas de CSV, índice por concessionária e por id_sigicor. PIP entra pelo nome curto da ferrovia.

**Amarração.** Nome da concessionária contra `payload.concessionaria`. Autorização e encerramento entram pelo `id_sigicor`. A série anual entra pelo nome sem espaço. O valor anual é o total da concessão, não o da obra.

**Importância.** 6 no cadastro de concessão. Menor no recorte estrito de fábrica privada sem contrato de concessão.

**Substituível.** Não pela ANTT notícias (isso é primária) nem pelo DNIT. O Portal Cidadão do DNIT é obra de contrato direto, outro objeto.

### SEC-ANTAQ-INST — ANTAQ, instalações portuárias

**Escopo.** Cadastro de porto e terminal de uso privado: quem opera e onde. Obra nova quase não aparece como linha de investimento. O estatístico aquaviário é movimentação em toneladas, outro arquivo, e não é CapEx.

**Acesso.** CSV trimestral apontado em `https://www.gov.br/antaq/pt-br/acesso-a-informacao/dados-abertos` e no dados.gov. Público, sem chave.

**Tipo de dado.** CSV.

**Informação.** Instalação, tipo (porto organizado, TUP e afins), operador e localização.

**Campos do arquivo.** O CSV de outubro de 2022 abre com uma linha de título, "Instalações Privadas Autorizadas", e o cabeçalho vem na segunda linha: Nº, Empresa Autorizada, Município, UF, Região, Tipo Instalação, Perfil de Carga, Tipo de Carga e Instrumento de Outorga. Não há CNPJ. A carga pula a linha de título e a ficha procura a empresa autorizada pelas duas primeiras palavras da razão social. Nome de terminal diverge da manchete com frequência.

**Configuração.** Baixar o CSV de instalações, ignorar o ZIP estatístico, indexar por operador e município.

**Amarração.** Empresa e UF ou município da ficha de porto. A evidência confirma que o terminal existe e quem opera. Não preenche `valor_capex`.

**Importância.** 6 para porto e terminal. 1 fora desse nicho.

**Substituível.** Não, para o cadastro. A notícia da ANTAQ e a do Ministério de Portos anunciam o ato; não substituem a lista de instalações.

### SEC-ANP-EP — ANP, dados de exploração e produção

**Escopo.** Blocos sob contrato ainda em exploração. Descreve a fase contratual do ativo. Não traz o real da FPSO. O contrato oficial em PDF não está no CSV.

**Acesso.** Página `https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/fase-exploracao`. A carga escolhe o CSV mensal mais novo de blocos sob contrato. Público, sem chave.

**Tipo de dado.** CSV Windows-1252, ponto e vírgula, 411 x 22 na edição consultada.

**Informação.** As 22 colunas do arquivo: bloco, contrato, operador, contratados, ambiente, bacias agrupadas, bacia, área, rodada, regime, período, PAD, datas, UTs e poços.

**Campos.** Dicionário campo a campo na página `/fontes/SEC-ANP-EP`. Amostra em `amostras/SEC-ANP-EP/`.

**Amarração.** Primeiras palavras da razão social contra operador e contratados. Sem CNPJ e sem valor.

**Importância.** 7 no nicho de óleo e gás.

**Substituível.** Não por uma base única. Campo, plataforma e duto são fontes irmãs.

### SEC-ANA-SNIRH — Outorgas de uso da água

**Escopo.** Outorga de captação ou lançamento: ponto, empreendimento, vazão, finalidade e datas. Sinal de que o projeto usa água. Não é o cadastro da usina (SIGA) nem o indicador de saneamento (SINISA). A camada mistura outorga federal e estadual, e a irrigação pequena domina o volume.

**Acesso.** GIS do SNIRH em `https://www.snirh.gov.br/`. FeatureServer com paginação. Consulta por nome ou recorte espacial quando o projeto já existe. Sem baixar o país inteiro.

**Tipo de dado.** JSON de feição geográfica.

**Informação.** Ponto, nome do empreendimento, vazão, finalidade, datas de outorga.

**Campos.** O inventário fixou ponto, empreendimento, vazão, finalidade e datas. O nome da camada e a lista completa de atributos mudam com o serviço; o conector grava o que a feição devolver e não promove vazão a “porte da usina”.

**Configuração.** Consulta filtrada por município ou por retângulo em volta da coordenada, se o SIGA ou a notícia já tiverem coordenada. Paginação obrigatória.

**Amarração.** Nome do empreendimento e município. A evidência anexa a outorga. Não altera `valor_capex`.

**Importância.** 5 para hidrelétrica, indústria com uso intensivo de água e irrigação grande. Baixa para fábrica seca.

**Substituível.** Não para a outorga. O SIGA responde “qual é a usina”. O SINISA responde “quanto o município investiu em saneamento”, em agregado.

### CAPTURA-SIGMINE — SIGMINE / ANM

**Escopo.** Processo minerário nacional: fase, substância, titular e polígono. Não traz CapEx. Fase de pesquisa ou lavra não é fase de construção civil. Título antigo permanece no mapa.

**Acesso.** Arquivos em `https://dadosabertos.anm.gov.br/SIGMINE/`, inclusive `BRASIL.zip` e metadados. Download público. Arquivo pesado. Atualização frequente o bastante para o catálogo marcar recorrência alta.

**Tipo de dado.** ZIP geoespacial e CSV.

**Informação.** Número do processo, fase, substância, titular, área.

**Campos observados.** Processo, fase, substância, titular, geometria da área. Sem valor. Um processo pode ter vários polígonos; isso é uma área só, não vários projetos. Cessão muda o titular e o número pode permanecer.

**Configuração.** Carga do pacote nacional para um índice local por número de processo, titular normalizado e município do centróide. A consulta do enriquecimento é nesse índice, não um download a cada ficha.

**Amarração.** Empresa ou município da notícia de mineração. O número do processo fica em `campos_extraidos`. Licença ambiental do mesmo projeto continua no órgão estadual ou no Ibama.

**Importância.** 7 para mina e planta de minério.

**Substituível.** Não pelo portal de notícias da ANM. A notícia anuncia; o SIGMINE é o título.

### CAPTURA-ONS-PAR — Plano de Ampliações e Reforços

**Escopo.** Planejamento de transmissão (PAR/PET): linha e subestação que podem ir a leilão. Não é o canteiro e não é o SIGA. A amostra vista não é uma tabela aberta com valor. O ciclo útil termina na outorga da ANEEL.

**Acesso.** Página `https://www.ons.org.br/paginas/energia-no-futuro/transmissao/expansao`, que descreve o plano e aponta o PDF do ciclo. Público. Cadência baixa. O conector lê o PDF consolidado, não a página institucional.

**Tipo de dado.** PDF.

**Informação.** Obra de reforço ou ampliação, subestação ou linha, no texto e nas tabelas do plano. Valor, quando aparece, não foi tratado como confiável na amostra.

**Campos.** Não há CSV. A extração, se for feita, produz obra, instalação e trecho a partir da tabela do PDF, com a URL do arquivo. Layout muda a cada ciclo.

**Configuração.** URL do PDF do ciclo vigente, revisada quando o ONS publicar outro. Sem parser da home.

**Amarração.** Nome da linha ou da subestação citado na notícia de transmissão. A evidência marca “planejado no PAR”. A outorga posterior, se existir, vem de ato da ANEEL, não deste PDF.

**Importância.** 5 para transmissão. 1 para geração, que está no SIGA.

**Substituível.** Não na antecipação. A outorga da ANEEL substitui o plano quando o empreendimento já foi autorizado, e aí a fonte de cadastro deixa de ser o PAR.

---

## 3. Licença ambiental

A licença diz que o empreendimento existe e em que porta está: LP (projeto), LI (pode construir), LO (opera). Não traz CapEx. Competência federal (Ibama: interestadual, petróleo em plataforma, grande infra) é diferente da estadual. O conector da UF só roda se `projeto.uf` for a daquele órgão.

### SEC-IBAMA — SISLIC

**Escopo.** Licenças federais (LP, LI, LO, e também ASV de supressão). Atualização do CSV perto de diária. Não cobre a obra que o estado licencia.

**Acesso.** CKAN `https://dadosabertos.ibama.gov.br/pt_BR/dataset/licencas-ambientais-de-atividades-e-empreendimentos-licenciados-pelo-ibama`. CSV ou JSON, público. Há ainda FeatureServer no Pamgia, citado no mapeamento, para a geometria.

**Tipo de dado.** CSV e JSON.

**Informação.** Empreendimento, pessoa, número do processo, tipologia, tipo de licença e datas.

**Campos.** O CSV de 21/10/2026 01:02 tem 14352 linhas e dez colunas: DES_TIPOLICENCA, NUM_LICENCA, DAT_EMISSAO, DAT_VENCIMENTO, NOM_EMPREENDIMENTO, NOM_PESSOA, NUM_PROCESSO_IBAMA, DES_TIPOLOGIA, PAC e ultima_atualizacao_relatorio. O catálogo descreve só as oito primeiras e escreve dat_emissão, num_processo_Ibama e Desc_tipologia. Não há CNPJ, UF nem valor. DES_TIPOLICENCA traz o nome completo, com 60 textos nesta edição, e não a sigla LP, LI, LO, LIO, LPS, ASV ou ABIO. DES_TIPOLOGIA tem 37 valores. PAC é Sim ou No. ultima_atualizacao_relatorio é a geração do extrato e se repete em todas as linhas. A lista fechada está em amostras/SEC-IBAMA/LEIA.txt.

**Configuração.** Download do recurso, filtro de tipologia de infra, óleo, porto e duto, índice por processo, nome e documento do titular.

**Amarração.** O CSV não traz CNPJ nem UF. O vínculo é pelas duas primeiras palavras da razão social contra NOM_PESSOA. O número do processo abre a consulta LAF. Licença Prévia, de Instalação e de Operação propõem `status`. Retificação, renovação e autorização de supressão ou de material biológico não são uma fase nova da fábrica. Várias licenças: vale a mais específica e a mais nova, não a soma.

**Importância.** 8 para empreendimento de competência federal.

**Substituível.** Não pelo órgão estadual. A consulta LAF acrescenta o documento; não substitui a lista.

### SEC-IAT — Licenças do Paraná (FeatureServer)

**Escopo.** Licença ambiental georreferenciada do IAT, só Paraná. Não é o processo completo do SGA, que pede login. Sem CapEx. O extrato mensal em PDF no site do órgão tem outra cadência.

**Acesso.** ArcGIS REST público:

`https://geopr.iat.pr.gov.br/server/rest/services/00_PUBLICACOES/licencas_ambientais_sia_sga/FeatureServer/0`

Consulta com `resultOffset`, no máximo 2.000 feições por página (`maxRecordCount` 2000). Sem o offset, o serviço devolve `exceededTransferLimit` e o resto do estado some. Formatos de saída: JSON, GeoJSON, PBF; exportação também em CSV e shapefile. Sem chave.

**Tipo de dado.** JSON de feição (ponto, SIRGAS 2000 / EPSG 4674).

**Campos** (camada lida em 29 de setembro de 2026):

| Campo | O que é |
| --- | --- |
| `objectid` | Id interno da feição |
| `num_protocolo` | Protocolo da licença |
| `nome_razao_social` | Titular. Grafia instável; não é CNPJ |
| `cod_ibge`, `nome_municipio`, `uf` | Município. `uf` deve ser PR |
| `sigla_modalidade`, `desc_modalidade` | Tipo da licença |
| `desc_grupo_atividade`, `desc_atividade` | Atividade. Não separa porte por valor |
| `dt_emissao`, `dt_validade` | Emissão e validade |
| `x`, `y`, `shape` | Coordenadas e geometria do ponto |

**Configuração.** A URL da camada na `fonte.url_base`. Paginação por `resultOffset` até acabarem as feições do município ou do intervalo de data. Índice local por protocolo e razão social, porque 2.000 é página, não filtro de negócio.

**Amarração.** `projeto.uf = PR`, município e a razão social oficial (a do cadastro do CNPJ resolvido, não o nome da manchete) com `nome_razao_social`. A camada não tem coluna de CNPJ, então a comparação é por razão social normalizada, e a evidência registra que o casamento foi por nome. Protocolo e modalidade entram na evidência.

**Importância.** 7 quando a ficha é do Paraná. 1 nos outros estados.

**Substituível.** Não, dentro do PR. Ibama não vê a licença estadual.

---

## 4. Obra e dinheiro público

Estas fontes descrevem recurso público, contrato público ou obra de órgão. No recorte atual de projeto privado elas entram só quando a ficha já existe e o registro ajuda a completar CNPJ, fase ou valor de um ativo que a notícia tratou como da empresa. Não são o caminho para aprovar obra de governo.

### SEC-CNO — Cadastro Nacional de Obras

**Escopo.** Obra de construção civil inscrita na Receita, pública ou privada. É o canteiro, não o contrato e não o CapEx. Situações: ativa, paralisada, encerrada, nula, suspensa. Área grande e destinação industrial são pista fraca de porte, não o corte de R$ 100 milhões.

**Acesso.** O conjunto no dados.gov.br tem dois recursos. O de dados é o ZIP diário, num compartilhamento Nextcloud da Receita (`index.php/s/<token>/download`), conferido por `HEAD` (`Last-Modified` e tamanho). `npm run dadosgov:sync` baixa o ZIP quando a versão local está ultrapassada e extrai todos os CSV em `data/dadosgov/cadastro-nacional-de-obras-cno/`: `cno.csv`, `cno_cnaes.csv`, `cno_vinculos.csv`, `cno_areas.csv` e `cno_totais.csv`. O dicionário é o PDF `cno-metadados.pdf`, o recurso do tipo dicionário de dados; o link atual resolvido pelo catálogo é `https://arquivos.receitafederal.gov.br/index.php/s/XEa8aE7wJdMGzkE`. A data dele no compartilhamento é 29 de janeiro de 2026. O sincronismo baixa esse PDF uma vez e não volta a conferir a data enquanto o arquivo local existir. Sem API de consulta. O e-CAC mostra só a obra do usuário logado e não entra. A carga em `enr_cno` continua desligada. A ficha lê o `cno.csv` extraído e completa cada obra da amostra com `cno_areas.csv`, `cno_cnaes.csv` e `cno_vinculos.csv`. `cno_totais.csv` entra como a contagem da edição.

**Tipo de dado.** ZIP/CSV.

**Informação.** Identificador da obra, responsável, situação, CNAE, metragem, destinação, endereço.

**Campos que o arquivo publica.** O ZIP traz cinco CSV com cabeçalho, separador vírgula, texto entre aspas e encoding ISO-8859-1. A chave é a coluna `CNO`, de 12 dígitos. `cno.csv` traz país, datas em AAAA-MM-DD, CNO vinculado, CEP, NI do responsável (14 dígitos; em branco se for CPF), qualificação (0053, 0057, 0064, 0070, 0109, 0110, 0111), nome da obra, município TOM, endereço, Estado, unidade de medida, área total, situação (01 nula, 02 ativa, 03 suspensa, 14 paralisada, 15 encerrada), data da situação, nome empresarial (em branco se pessoa física) e código de localização. `cno_cnaes.csv` traz CNAE de 7 dígitos. `cno_vinculos.csv` traz início, fim, data de registro, qualificação e NI. `cno_areas.csv` grava o texto do dicionário, não o número: categoria (Obra Nova, Acréscimo, Reforma, Demolição, Existente), destinação (residencial, comercial, galpão industrial e as demais do manual), tipo de obra (Alvenaria, Madeira, Mista) e tipo de área (Principal ou Complementar). `cno_totais.csv` conta os registros dos outros quatro. Sem coluna de valor. O PDF `cno-metadados.pdf` é o dicionário dos códigos; o cabeçalho do CSV é o nome usado na leitura. O sincronismo deixa os cinco CSV no disco. A ficha usa os cinco: a obra vem de `cno.csv` e a amostra ganha área, CNAE, vínculo e a contagem publicada em `cno_totais.csv`.

**Configuração.** Carga do ZIP para índice pela coluna `CNO` + NI do responsável + município + situação. A ficha consulta o índice. Delta entre dois ZIPs mostra obra nova ou situação que mudou. Não ingerir também o `br_rf_cno`.

**Amarração.** `projeto.cnpj` lista os CNO daquele responsável no município. A coluna `CNO` fica na evidência. Situação 02 (ativa) combina com `status = construcao`; situação 15 (encerrada) não vira operação industrial sozinha.

**Importância.** 7 para obra civil. Menor para usina, que pode não ter CNO, e nula como prova de valor.

**Substituível.** Por `br_rf_cno` na Base dos Dados. Não pelo Obrasgov: um é inscrição fiscal, o outro é obra com recurso federal.

### SEC-OBRASGOV — API pública de obras com recurso federal

Fora do MVP desde 20 de outubro de 2026. A análise das empresas alvo mostrou que a fonte só publica obra pública, e o Radar deixou de consultá-la.

**Escopo.** Obra cadastrada por gestor no Transferegov/Obrasgov, com recurso da União. Perto de 144 mil projetos na amostra do mapeamento. Não cobre obra privada nem obra só estadual ou municipal. Um projeto do Radar pode ser vários ids.

**Acesso.** Base `https://api-publica.obrasgov.gestao.gov.br/obras`. OpenAPI em `/obras/openapi.json`. Sem chave. Paginação `page` e `page_size` (padrão 50), com `total_pages` e `total_items`. Não há query de valor mínimo.

**Tipo de dado.** JSON.

**Endpoints.** `GET /data-atualizacao`, `GET /projeto-investimento` (o hub), `GET /empenho`, `GET /execucao-fisica`, `GET /contrato`, `GET /geometria`, `GET /historico-situacao-cancelada-paralisada`, `GET /estudo-viabilidade`.

**Campos já fixados no hub.** `id_projeto_investimento`; situação; `investimentos_previstos[].vl_investimento_previsto`; CNPJs `cnpj_organizacao_resp`, `cnpj_executor`, `cnpj_tomador`, `cnpj_repassador` e, no contrato, `cnpj_fornecedor_contrato`; geometria e `pins`; UF, município e IBGE; número de contrato e de licitação. Execução física e empenho vêm dos endpoints satélite, cruzados pelo mesmo id. O dicionário completo é o OpenAPI; estes são os campos de amarração.

**Configuração.** Cliente HTTP na URL da fonte, página a página, corte de R$ 100 milhões no cliente sobre `vl_investimento_previsto`. No enriquecimento a chamada é filtrada pela chave (CNPJ, município, id), não um dump a cada ficha. `GET /data-atualizacao` diz se vale reler.

**Amarração.** CNPJ do executor ou do tomador com o CNPJ da ficha, mais município. O id fica na evidência. Valor previsto pode ter confiança alta, com a ressalva de que é o previsto do gestor, não o pago. Situação atrasada é comum. CNPJ de órgão não sobrescreve a empresa privada da ficha.

**Importância.** 4 no recorte privado. 8 se o escopo voltar a incluir obra com recurso federal.

**Substituível.** Não no cadastro da obra federal. O manual do Transferegov não tem dados. O TCU acrescenta a leitura de paralisação, com atraso. O PNCP acrescenta o edital, não o percentual físico.

### SEC-PDT — Portal da Transparência (CGU)

Fora do MVP desde 21 de outubro de 2026. A fonte trata de contrato, empenho e despesa pública federal, e o Radar deixou de consultá-la.

### SEC-OBRAS-MG — Portal de Obras de Minas Gerais

Fora do MVP desde 20 de outubro de 2026. A análise das empresas alvo mostrou que a fonte só publica obra pública, e o Radar deixou de consultá-la.

**Escopo.** Obra do Poder Executivo de Minas Gerais. Não inclui obra municipal nem CapEx privado. Atualização vista em 10 de junho de 2026. Convênio federal repete o que o Obrasgov já tem.

**Acesso.** `https://dados.mg.gov.br/dataset/portal_obras`. Data package anual, público.

**Tipo de dado.** CSV no pacote (`datapackage.json` mais recursos).

**Campos do pacote.** Recursos separados de obra, contratos, situação, municípios, coordenadas, fiscais e trechos, ligados pela chave do pacote. A unidade é a obra do órgão estadual.

**Configuração.** Baixar o ano, juntar obra e contrato pela chave, corte de valor no cliente. Não somar o valor duas vezes ao unir os arquivos. Contrato de fiscalização não é a obra.

**Amarração.** Município e nome, UF MG. Coordenada pode cruzar com a licença da SEMAD. Evidência com a URL do recurso do ano.

**Importância.** 3.

**Substituível.** Pelo Obrasgov no caso de convênio federal. Não no restante do Executivo mineiro.

### SEC-ARTESP — programação de obras (São Paulo)

**Escopo.** Programação anual das concessionárias de rodovias paulistas: conservação de rotina e obra contratual de CapEx, por rodovia, programa e atividade. Só a malha concedida sob a ARTESP. Não é rodovia federal nem obra direta do DER. Programação não é medição.

**Acesso.** `https://dadosabertos.artesp.sp.gov.br/dataset/programacao-de-obras`. XLSX e GeoJSON públicos. O arquivo `rodovias.xlsx` é de-para de códigos, não a lista de obras. Editais e contratos estão em outro conjunto do mesmo portal.

**Tipo de dado.** XLSX e GeoJSON.

**Campos.** Template de obras e template de conservação. A obra contratual traz rodovia, programa, atividade e período. O de-para transforma o código de rodovia em trecho. Conservação de rotina sai do corte de CapEx.

**Configuração.** Baixar `programacao-de-obras`, separar os dois templates, cruzar o lote com o conjunto de editais quando o contrato for necessário. Lote atrasado deixa o ano incompleto.

**Amarração.** Concessionária e rodovia da ficha, UF SP. Valor da obra contratual pode alimentar `valor_capex` daquele lote, com a URL do arquivo do ano.

**Importância.** 5 para concessão rodoviária paulista.

**Substituível.** Não pela ANTT. A ABAR só diz que a ARTESP existe.

---

## 5. Conectadas depois do estudo

A ficha completa de cada uma está na página da fonte no sistema (`/fontes/<código>`), gerada de `src/source-guides.js`.

### SEC-ANP-CAMPO — ANP, campos em produção

Campos de petróleo e gás que produziram no mês mais recente publicado. A carga baixa o CSV mensal de produção por zona (13.430 x 20 em 01/08/2026), agrupa os poços por campo e grava as 20 colunas: as 14 vazões somadas, a contagem de poços e de zonas, mais o operador lido das listas de plataforma, duto e instalação. A busca usa o nome do operador ou um nome de campo no título do projeto. Confirma produção recente e o volume do mês; não traz valor de investimento. Dicionário em `/fontes/SEC-ANP-CAMPO`. Amostra em `amostras/SEC-ANP-CAMPO/`.

### SEC-ANP-PLAT — ANP, plataformas em operação

Plataformas e instalações marítimas em operação, com as 13 colunas do CSV: sigla, nome, campos, bacia, operador, classificação, lâmina d'água, escoamento, ano de início, latitude, longitude e capacidades nominais de óleo e gás. CSV público, sem chave, gravado em `enr_registro`. A busca usa as primeiras palavras da razão social contra o operador e o nome da instalação. Unidade que ainda não opera não aparece. Dicionário em `/fontes/SEC-ANP-PLAT`. Amostra em `amostras/SEC-ANP-PLAT/`.

### SEC-ANP-DUTO — ANP, dutos

Dutos do cadastro de códigos da ANP, com as 9 colunas: nome, código DPP, não integrante, campo, tipo, classificação do sistema, operador, função umbilical e situação. CSV público, sem chave, gravado em `enr_registro`. A busca usa a razão social contra o operador e o nome do duto. Não traz diâmetro, extensão nem valor. Dicionário em `/fontes/SEC-ANP-DUTO`. Amostra em `amostras/SEC-ANP-DUTO/`.

### CAPTURA-REIDI — Projetos aprovados no REIDI

Projetos de transporte habilitados ao incentivo fiscal: empresa, CNPJ, UF, modal, contrato, investimento estimado, ano, portaria e ADE. A carga lê o CKAN do Ministério dos Transportes e baixa o CSV semestral mais novo (Windows-1252, com linhas de título antes do cabeçalho). A busca casa o CNPJ ou a razão social com o titular. Habilitação fiscal não é licença nem início de obra.

### CAPTURA-QD — Querido Diário

Trechos de diários oficiais municipais. Consulta ao vivo, sem cópia local: o Radar resolve o código IBGE do município da ficha e pergunta à API pública pelo nome da empresa, com até cinco trechos. Só roda quando a ficha tem município. Município fora da base volta vazio.

### CAPTURA-DOU — Diário Oficial da União

Atos federais (portaria, licença, outorga, projeto prioritário) encontrados pelas primeiras palavras da razão social. Consulta ao vivo na busca pública da Imprensa Nacional, com até oito atos; ato sem as palavras do nome é descartado. Confirma a publicação oficial; não substitui a planilha do REIDI.

---

## Ordem de consulta

A ficha privada chega com CNPJ, conferido no cadastro `cnpj_db` (razão social, CNAE, situação e estabelecimento no município do projeto). A primeira leva de enriquecimento, por nicho, é curta:

1. **BNDES** por CNPJ, para descrição e valor oficial quando houver financiamento.
2. **SIGA** se o nicho for geração, pelo CNPJ dentro do campo de participação.
3. **SISLIC** se a matéria citar licença federal, óleo, porto, duto ou empreendimento em mais de um estado; no Paraná, também o **IAT**.
4. **CNO** se o nicho for obra civil, pela raiz do CNPJ.
5. **CVM** se a empresa for companhia aberta.

O restante espera a ficha pedir: ANP (blocos, campos, plataformas e dutos) no óleo, SIGMINE na mina, ANA na captação de água, ANTAQ no terminal, ANTT, ARTESP ou REIDI na concessão e no transporte, ONS na transmissão. DOU e Querido Diário procuram o ato oficial pelo nome da empresa.

Quando a ficha chegou com `cnpj` vazio, a ordem muda: BNDES, licença e CNO rodam por razão social e UF, e o primeiro número que voltar passa pela confirmação humana antes de ir para `projeto.cnpj`.

## Carga local

`npm run db:load-bases` baixa e grava as cópias com arquivo ou API pública. `enr_bndes`, `enr_siga`, `enr_sislic` e `enr_cvm_ipe` (fato relevante e comunicado de 2025 e 2026) ficam nas tabelas próprias. ANTT (cadastro, autorização, encerramento, PIP e concessionárias), instalações portuárias privadas (CSV de outubro de 2022; o arquivo de 2026 em web3.antaq.gov.br não resolve), licenças do IAT/PR vão para `enr_registro`, com a linha inteira em `payload`. A ANP deixa concessões numa consulta interativa, sem CSV estável. O histórico fica em `base_carga`. O CNPJ usado na resolução é o schema `cnpj_db`, já presente no mesmo banco. `enr_cno` continua sem carga. Para repetir uma base: `npm run db:load-bases -- SEC-SIGA`.
