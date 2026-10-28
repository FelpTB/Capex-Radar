const { DOE_ESTADOS, doeEstado } = require("./doe-registry");
const { sourceOrigin } = require("./source-origin");

const GUIDES = {
  "SEC-BNDES": {
    nome: "BNDES Operações de Financiamento",
    url: "https://dadosabertos.bndes.gov.br/dataset/operacoes-financiamento",
    arquivo: "data/cache/bndes-nao-automaticas.csv. Exemplo bruto em amostras/SEC-BNDES/",
    copia: "Tabela enr_bndes",
    cargas: ["SEC-BNDES"],
    resumo: "Contratos de financiamento não automáticos do BNDES, com valor, município e descrição do projeto, cruzados pelo CNPJ.",
    informa: [
      "Cada linha é um contrato de financiamento direto ou indireto que o BNDES classifica como operação não automática. O arquivo traz o cliente, o CNPJ, a descrição do projeto, o município, o produto, a forma de apoio, o porte do cliente e a situação do contrato.",
      "A evidência da ficha guarda o número do contrato, a data de contratação, a UF, o município, a descrição, a situação e o valor contratado em reais. O valor desembolsado fica na cópia local e não entra na lista de comprovação.",
    ],
    campos: [
      ["Número do contrato", "Identificador da operação no BNDES."],
      ["Data de contratação", "Usada para separar contratos da janela de status dos contratos mais antigos."],
      ["UF e município", "Local do projeto financiado, quando o BNDES preenche."],
      ["Descrição do projeto", "Texto livre do que o contrato diz financiar."],
      ["Situação", "Por exemplo, ativo ou liquidado."],
      ["Valor contratado", "Valor em reais da operação, não o CapEx total da obra."],
    ],
    acesso: [
      "O CSV público de operações não automáticas é baixado de dadosabertos.bndes.gov.br, em Windows-1252, para data/cache/bndes-nao-automaticas.csv. A carga grava as linhas em enr_bndes. Não há chave de API.",
      "A coleta da ficha consulta essa tabela. O arquivo é atualizado quando a carga das bases roda de novo.",
    ],
    associacao: [
      "O CNPJ da ficha precisa ser igual ao CNPJ do contrato. A consulta conta quantas operações existem e quantas foram contratadas a partir de 18 meses antes da data de status. Até 12 contratos entram na comprovação, com os da janela na frente.",
    ],
    alcance: [
      "Operações automáticas, o crédito de balcão em massa, ficam em outro arquivo do BNDES e não entram nesta cópia. O contrato registra o financiamento. A obra física, quando existe, continua no Cadastro Nacional de Obras.",
    ],
  },
  "SEC-CVM-IPE": {
    nome: "CVM dados abertos IPE",
    url: "https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe",
    arquivo: "data/cache/ipe-2025.zip e ipe-2026.zip. Exemplo bruto em amostras/SEC-CVM-IPE/",
    copia: "Tabela enr_cvm_ipe",
    cargas: ["SEC-CVM-IPE"],
    resumo: "Fatos relevantes e comunicados ao mercado de companhias abertas, com assunto, data e link do documento.",
    informa: [
      "O IPE é o conjunto de documentos que a companhia aberta entrega à CVM. O CSV tem 13 colunas e a cópia guarda todas. Desta base entram só duas categorias: Fato Relevante e Comunicado ao Mercado.",
      "Além de assunto, datas e link, a linha traz a espécie do documento e o tipo de apresentação: apresentação original, reapresentação espontânea ou reapresentação por exigência. Na coleta da ficha, os cinco documentos mais recentes, com entrega há menos de um ano, são baixados e convertidos em Markdown.",
    ],
    campos: [
      ["Assunto", "Título informado pela companhia no protocolo."],
      ["Categoria, tipo e espécie", "Fato Relevante ou Comunicado, o tipo dentro da categoria e a espécie, quando a CVM preenche."],
      ["Apresentação", "Original, reapresentação espontânea ou reapresentação por exigência, com o número da versão."],
      ["Datas", "Referência do fato e entrega do documento. A referência entra na janela de status."],
      ["Link", "Endereço do documento na CVM."],
    ],
    acesso: [
      "A carga baixa o ZIP anual de 2025 e o de 2026 em dados.cvm.gov.br (ipe_cia_aberta_ANO.zip), extrai o CSV e grava em enr_cvm_ipe. Os arquivos ficam em data/cache. O acesso é público.",
      "A consulta na ficha lê a tabela pelo CNPJ. Documentos de outros anos e de outras categorias do IPE ficam fora desta cópia.",
    ],
    associacao: [
      "O CNPJ da companhia no documento precisa ser o mesmo da ficha. Até 12 documentos entram na comprovação. A contagem separa os que têm data de referência dentro da janela de 18 meses.",
    ],
    alcance: [
      "Companhia fechada não protocola IPE. Documento com um ano ou mais permanece só no índice, com o link.",
    ],
  },
  "SEC-SIGA": {
    nome: "ANEEL SIGA",
    url: "https://dadosabertos.aneel.gov.br/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel",
    arquivo: "data/cache/siga-diario.csv e data/cache/siga-mensal.csv. Exemplo bruto em amostras/SEC-SIGA/",
    copia: "Tabela enr_siga",
    cargas: ["SEC-SIGA"],
    resumo: "Empreendimentos de geração da ANEEL, com código CEG, fase, potência e municípios.",
    informa: [
      "O SIGA lista os empreendimentos de geração do parque nacional, uma linha por CEG. A cópia guarda as 23 colunas do dicionário: identificação, tipo, fase, origem e combustível, tipo de outorga, potência outorgada, potência fiscalizada e garantia física, geração qualificada, coordenadas, municípios, sub-bacia, vigência da outorga, entrada em operação e o texto de participação.",
      "A evidência repete esses campos e marca se a entrada em operação cai na janela de status. Potência fica em quilowatts. A data 1900-01-03, que o arquivo usa quando não há entrada, não é gravada.",
    ],
    campos: [
      ["CEG", "Código único, no formato tipo, fonte, UF, núcleo, dígito e versão."],
      ["Tipo, fonte e fase", "Sigla da usina, origem, combustível e estágio, como construção ou operação."],
      ["Outorga", "Registro, autorização ou concessão, com início e fim de vigência quando o arquivo traz."],
      ["Potências", "Outorgada, fiscalizada e garantia física, em quilowatts."],
      ["Lugar", "UF, municípios, latitude, longitude e sub-bacia nas hídricas."],
      ["Participação", "Percentual, agente e regime. O CNPJ sai desse texto."],
      ["Entrada em operação", "Data da primeira unidade geradora, usada na janela de status."],
    ],
    acesso: [
      "O CSV diário é baixado do CKAN da ANEEL para data/cache/siga-diario.csv e gravado em enr_siga, uma linha por CEG, com as 23 colunas. Não há chave.",
      "A edição diária de 21/10/2026 tirou o CNPJ do texto de participação. A carga também lê o CSV mensal em data/cache/siga-mensal.csv e, quando o nome do agente é o mesmo, reaproveita o número dessa edição. Nome diferente não herda o CNPJ antigo. cnpj_edicao guarda a data do arquivo mensal de onde o número veio.",
    ],
    associacao: [
      "O CNPJ da ficha precisa aparecer entre os CNPJs lidos no texto de participação. Todos os empreendimentos desse CNPJ entram na evidência.",
    ],
    alcance: [
      "A base é de geração. Linha de transmissão e subestação ficam no plano da EPE. Coordenada, garantia física e vigência passam a entrar na ficha. Não há coluna de reais.",
    ],
  },
  "SEC-IBAMA": {
    nome: "IBAMA SISLIC",
    url: "https://dadosabertos.ibama.gov.br/pt_BR/dataset/licencas-ambientais-de-atividades-e-empreendimentos-licenciados-pelo-ibama",
    arquivo: "data/cache/sislic.csv. Exemplo bruto em amostras/SEC-IBAMA/",
    copia: "Tabela enr_sislic",
    cargas: ["SEC-IBAMA"],
    resumo: "Licenças e autorizações federais do SISLIC. O CSV tem dez colunas e o tipo vem por extenso, não como a sigla LP, LI ou LO.",
    informa: [
      "O catálogo lista oito atributos, com outra grafia em dat_emissão, num_processo_Ibama e Desc_tipologia. O CSV acrescenta PAC e ultima_atualizacao_relatorio. A cópia grava as dez colunas.",
      "A evidência devolve todas as colunas, até 50 atos, da emissão mais recente para a mais antiga.",
    ],
    campos: [
      ["Tipo do ato", "Nome completo, como Licença Prévia. A sigla do catálogo não está no arquivo."],
      ["Número e processo", "Número da licença e número do processo no Ibama."],
      ["Emissão e vencimento", "Datas do ato, no calendário do arquivo."],
      ["Empreendimento e tipologia", "Nome do projeto e o tipo de atividade, entre os 37 valores desta edição."],
      ["Titular", "Nome do empreendedor. O CSV não traz CNPJ nem UF."],
      ["PAC", "Sim ou No. O catálogo não define a coluna."],
      ["Atualização do relatório", "Data e hora em que o Ibama gerou o extrato, igual em todas as linhas."],
    ],
    acesso: [
      "O CSV público sislic-licencas.csv é baixado do armazenamento de dados abertos do Ibama para data/cache/sislic.csv e gravado em enr_sislic. Não há login.",
      "HTML, XML e JSON do mesmo conjunto ficam no catálogo e não são baixados. A amostra desta edição está em amostras/SEC-IBAMA.",
    ],
    associacao: [
      "A busca usa as duas primeiras palavras da razão social, sem acento, contra o nome do titular. O arquivo não é cruzado pelo CNPJ.",
      "Não há coluna de UF. Empreendimento, tipologia, PAC e as duas datas ajudam a ler o ato depois do casamento pelo nome.",
    ],
    alcance: [
      "Licença estadual fica no órgão do estado. O estudo ambiental e o processo completo continuam no SEI do Ibama.",
      "O catálogo fala em LP, LI, LO, LIO, LPS, ASV e ABIO. O arquivo grava o nome completo e também renovação, retificação, prorrogação, anuência e indeferimento.",
    ],
  },
  "SEC-ANTT-INV": {
    nome: "ANTT Investimentos da concessão",
    url: "https://dados.antt.gov.br/",
    arquivo: "data/cache/antt-*.csv. Exemplo bruto em amostras/SEC-ANTT-INV/",
    copia: "Tabela enr_registro, em cinco códigos",
    cargas: ["SEC-ANTT-CAD", "SEC-ANTT-AUT", "SEC-ANTT-ENC", "SEC-ANTT-PIP", "SEC-ANTT-CONC"],
    resumo: "Cinco planilhas da ANTT. O cadastro, a autorização e o encerramento se cruzam por id_sigicor. Nenhum arquivo traz CNPJ.",
    informa: [
      "O SIGICOR publica o cadastro da obra, a autorização do projeto e o encerramento. O id_sigicor é a chave. O PIP é ferroviário. A série anual soma o investimento por concessionária e ano.",
      "A evidência devolve as colunas do cadastro e, no mesmo identificador, as autorizações e os encerramentos. A série anual entra pelo nome da concessionária.",
    ],
    campos: [
      ["id_sigicor", "Chave do SIGICOR entre cadastro, autorização e encerramento."],
      ["Concessionária", "Nome no arquivo. Não há CNPJ. A grafia muda entre o SIGICOR e a série anual."],
      ["Obra", "Descrição, tipo, rodovia, km, sentido, pista e coordenadas, quando o arquivo preenche."],
      ["Processo SEI", "Número do processo. Não é CNPJ."],
      ["Projeto", "Tipo e situação da peça na autorização e no encerramento."],
      ["Valor", "Valor contratual no cadastro, raro, ou total anual na série das concessionárias."],
    ],
    acesso: [
      "Cada CSV é baixado do CKAN em dados.antt.gov.br, sem chave, para data/cache. A carga substitui as linhas em enr_registro. JSON e PDF do mesmo conjunto não são baixados.",
      "A amostra desta edição, com o cruzamento do id 15586, está em amostras/SEC-ANTT-INV.",
    ],
    associacao: [
      "A busca usa as primeiras palavras da razão social contra o nome da concessionária. O número do SEI não entra como CNPJ.",
      "Autorização e encerramento entram pelo id_sigicor do cadastro. A série anual entra pelo nome, sem espaço.",
    ],
    alcance: [
      "O recorte é o investimento regulado da concessão federal. Obra rodoviária fora desses contratos fica em outras bases, como o DNIT.",
      "PIP é ferrovia e não compartilha id_sigicor com o SIGICOR rodoviário.",
    ],
  },
  "SEC-ANTAQ-INST": {
    nome: "ANTAQ Instalações portuárias",
    url: "https://www.gov.br/antaq/pt-br/acesso-a-informacao/dados-abertos",
    arquivo: "data/cache/antaq-instalacoes.csv. Exemplo bruto em amostras/SEC-ANTAQ-INST/",
    copia: "Tabela enr_registro",
    cargas: ["SEC-ANTAQ-INST"],
    resumo: "Cadastro de portos e terminais de uso privado: quem opera a instalação e onde ela fica.",
    informa: [
      "A linha descreve uma instalação portuária. A evidência guarda título, UF, município e valor, quando essas colunas existem, e o restante do CSV no detalhe da linha.",
      "O arquivo em uso é o de outubro de 2022, publicado em dados.transportes.gov.br. O endereço mais novo citado no catálogo da ANTAQ não responde.",
    ],
    campos: [
      ["Instalação", "Nome do porto ou do terminal."],
      ["Local", "UF e município, quando o CSV traz."],
      ["Empresa autorizada", "Nome de quem tem a autorização. O arquivo não publica CNPJ."],
      ["Tipo e carga", "TUP, ETC ou outro tipo de instalação, com perfil e tipo de carga e o instrumento de outorga."],
    ],
    acesso: [
      "A carga baixa o CSV out_2022.csv para data/cache/antaq-instalacoes.csv e grava em enr_registro. Não há chave. A primeira linha do arquivo é um título e o cabeçalho vem na segunda. A coleta lê essa cópia pelas duas primeiras palavras da razão social, comparadas com a empresa autorizada.",
    ],
    associacao: [
      "As duas primeiras palavras da razão social da ficha precisam aparecer no nome da empresa autorizada. O arquivo não traz CNPJ.",
    ],
    alcance: [
      "A fotografia é a de outubro de 2022. Movimentação de carga e estatística aquaviária são outras publicações da ANTAQ.",
    ],
  },
  "SEC-ARTESP": {
    nome: "ARTESP — programação de obras",
    url: "https://dadosabertos.artesp.sp.gov.br/dataset/programacao-de-obras",
    arquivo: "data/cache/artesp/. Exemplo bruto em amostras/SEC-ARTESP/",
    copia: "Tabela enr_registro",
    cargas: ["SEC-ARTESP"],
    resumo: "Programação anual CapEx, revitalização e obras por nível de serviço das concessionárias de rodovia em São Paulo.",
    informa: [
      "O catálogo de 21/10/2026 não publica GeoJSON preenchido de nenhuma concessionária. A carga usa o template Template_LXX_obras_2026_R0.xlsx e marca exemplo=true. A aba Dados tem duas linhas de exemplo (L22) e duas de instrução.",
      "Conservação de rotina fica de fora. O arquivo não traz valor em reais nem avanço físico. Quando a ARTESP publicar GeoJSON real, a carga troca sozinha.",
    ],
    campos: [
      ["Concessionária e lote", "Lote da concessão e o nome da concessionária associado."],
      ["Rodovia", "Código ARTESP e o nome público da rodovia, quando o de-para existir."],
      ["Programa", "CAPEX, REVIT ou NS."],
      ["Serviço e trecho", "Descrição da obra e os quilômetros inicial e final."],
      ["Datas", "Início e fim previstos da programação."],
    ],
    acesso: [
      "A carga lê o catálogo CKAN da ARTESP, prefere GeoJSON de obras que não seja exemplo e, se ainda não houver arquivo real, usa a planilha Template de obras. O de-para de rodovias vem do datastore público. Não há chave.",
      "Enquanto o portal só publicar template ou exemplo, as linhas entram com exemplo=true. Quando a ARTESP publicar os GeoJSON preenchidos, a carga troca sozinha.",
    ],
    associacao: [
      "A busca casa o nome da empresa com a concessionária do lote, o código do lote e palavras do projeto na rodovia ou na descrição do serviço. Só ficha em São Paulo entra na coleta.",
    ],
    alcance: [
      "Só a malha rodoviária concedida sob a ARTESP. Não cobre ANTT, DER nem conservação de rotina. Sem valor monetário do CapEx.",
    ],
  },
  "SEC-IAT": {
    nome: "IAT Licenças GIS (PR)",
    url: "https://geopr.iat.pr.gov.br/server/rest/services/00_PUBLICACOES/licencas_ambientais_sia_sga/FeatureServer/0",
    arquivo: "Sem arquivo nacional. Exemplo bruto em amostras/SEC-IAT/",
    copia: "Tabela enr_registro",
    cargas: ["SEC-IAT"],
    resumo: "Licenças ambientais do Paraná, com protocolo, atividade, município e validade.",
    informa: [
      "A camada pública do IAT traz protocolo, razão social, município, código IBGE, modalidade, grupo e descrição da atividade, data de emissão, data de validade e as coordenadas x e y.",
      "A evidência mostra a razão social como título, a UF, o município e, no detalhe, modalidade, atividade e datas.",
    ],
    campos: [
      ["Razão social", "Nome de quem recebeu a licença."],
      ["Município", "Município paranaense da licença."],
      ["Modalidade", "Tipo do ato ambiental."],
      ["Atividade", "Grupo e descrição da atividade licenciada."],
      ["Emissão e validade", "Datas do ato."],
    ],
    acesso: [
      "A carga lê o FeatureServer do IAT em páginas de até 2.000 registros e grava em enr_registro. O serviço é público. Não há arquivo em data/cache.",
    ],
    associacao: [
      "A camada não tem coluna de CNPJ. A busca usa as duas primeiras palavras da razão social contra o nome da licença. Uma licença da mesma empresa em outro município do Paraná também pode entrar.",
    ],
    alcance: [
      "A camada cobre o Paraná. Licença de outro estado está no órgão daquele estado.",
    ],
  },
  "SEC-CNO": {
    nome: "CNO dados abertos (RFB)",
    url: "https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-de-obras-cno",
    arquivo: "data/dadosgov/cadastro-nacional-de-obras-cno/. Exemplo bruto em amostras/SEC-CNO/",
    copia: "ZIP e os cinco CSV extraídos ao lado. A tabela enr_cno não é preenchida.",
    cargas: [],
    resumo: "Obras civis inscritas na Receita, em cinco CSV com cabeçalho: obra, CNAE, vínculos, áreas e totais.",
    informa: [
      "O ZIP diário publica cinco CSV com cabeçalho, vírgula e encoding ISO-8859-1: cno.csv, cno_cnaes.csv, cno_vinculos.csv, cno_areas.csv e cno_totais.csv. A coluna CNO, com 12 dígitos, liga os arquivos. As datas saem como AAAA-MM-DD.",
      "Em cno.csv a situação é o número da Receita: 01 nula, 02 ativa, 03 suspensa, 14 paralisada e 15 encerrada. O NI do responsável tem 14 dígitos e fica vazio quando a pessoa é física; o nome empresarial também fica vazio nesse caso. Não há coluna de valor.",
      "cno_areas.csv grava categoria, destinação e tipo de obra como texto, por exemplo Obra Nova, Galpão industrial e Alvenaria. cno_cnaes.csv traz o CNAE de 7 dígitos. cno_vinculos.csv traz a qualificação e o NI, e inclui Data de registro, coluna que o PDF desse arquivo não lista.",
    ],
    campos: [
      ["CNO", "Número de 12 dígitos da inscrição, coluna CNO."],
      ["NI do responsável", "CNPJ de 14 dígitos. Fica em branco quando o responsável é pessoa física."],
      ["Nome empresarial", "Razão social do responsável em cno.csv."],
      ["Nome do município e Estado", "Município e sigla da UF da obra."],
      ["Área total", "Área da obra em cno.csv, com decimal em ponto."],
      ["Situação e Data de início", "Código 01, 02, 03, 14 ou 15, e a data de início da obra."],
    ],
    acesso: [
      "O catálogo do dados.gov.br aponta dois recursos. O de dados, em ZIP, é conferido a cada sincronismo: se a data ou o tamanho mudaram, o ZIP é baixado de novo e os cinco CSV são extraídos em data/dadosgov/cadastro-nacional-de-obras-cno/. A chave TOKEN_DADOS_GOV só abre o catálogo.",
      "O dicionário, cno-metadados.pdf, é baixado uma vez. Enquanto o arquivo local existe, o sincronismo não volta a conferir a data dele. Na ficha, a leitura parte do cno.csv já extraído, em latin1 e pelo cabeçalho, e completa cada obra da amostra com as áreas, os CNAEs e os vínculos do mesmo número. cno_totais.csv entra como a contagem da edição. O país inteiro não vai para o Postgres.",
    ],
    associacao: [
      "A busca usa os oito primeiros dígitos do CNPJ, a raiz da empresa, então matriz e filiais entram juntas. A evidência separa o total da raiz, as obras no estado do projeto, as do município, as do CNPJ exato e as com início na janela de 18 meses. A amostra prioriza município, estado e período, e cada obra dela traz a qualificação do responsável, as áreas, os CNAEs e os vínculos daquele CNO.",
    ],
    alcance: [
      "A inscrição confirma que existe uma obra cadastrada naquele CNPJ e naquele lugar. O valor do CapEx continua vindo da notícia ou de outra fonte.",
    ],
  },
  "SEC-ANP-EP": {
    nome: "ANP Dados de E&P",
    url: "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/fase-exploracao",
    arquivo: "data/cache/anp-blocos.csv. Exemplo bruto em amostras/SEC-ANP-EP/",
    copia: "Tabela enr_registro",
    cargas: ["SEC-ANP-EP"],
    resumo: "Blocos de petroleo e gas ainda na fase de exploracao, com as 22 colunas do CSV mensal.",
    informa: [
      "O CSV lista blocos sob contrato que continuam em exploracao. A copia guarda as 22 colunas: bloco, contrato, operador, contratados, ambiente, bacias agrupadas, bacia, area em mil km2, rodada, regime, periodo, presenca de PAD, datas de assinatura, suspensao e vencimentos, UTs comprometidas e pocos perfurados.",
      "Nao ha valor de plataforma ou de FPSO e nao ha coluna de CNPJ. O percentual dos contratados fica no texto, nao vira numero de documento.",
    ],
    campos: [
      ["Bloco e contrato", "Nome do bloco e numero do contrato de exploracao."],
      ["Operador e contratados", "Quem opera e quem participa, com percentual no texto."],
      ["Bacia, area e ambiente", "Bacia, agrupamento, area em mil km2 e se o bloco e terra ou mar."],
      ["Periodo, PAD e vencimentos", "Estagio do periodo, presenca de PAD e as datas do contrato."],
      ["UTs e pocos", "Unidades de trabalho comprometidas e a lista de pocos perfurados."],
    ],
    acesso: [
      "A carga abre a pagina publica da fase de exploracao, escolhe o CSV mensal mais novo de blocos sob contrato e salva em data/cache/anp-blocos.csv. As linhas anteriores desta fonte sao substituidas. Nao ha chave.",
      "Campo que ja produz, plataforma e duto tem paginas proprias. Esta carga continua so com o bloco em exploracao.",
    ],
    associacao: [
      "A busca usa as duas primeiras palavras da razao social contra o nome do operador e dos contratados. Ate 20 blocos entram na comprovacao.",
    ],
    alcance: [
      "Um bloco ja em producao nao aparece neste arquivo. A pagina antiga de gestao de contratos nao tem um CSV estavel e nao e a origem usada.",
    ],
  },
  "SEC-ANA-SNIRH": {
    nome: "ANA Outorgas SNIRH",
    url: "https://portal1.snirh.gov.br/server/rest/services/Hosted/outorgas_federais_superficial/FeatureServer/0",
    arquivo: "Sem arquivo local. Exemplo bruto em amostras/SEC-ANA-SNIRH/",
    copia: "Consulta ao vivo, sem tabela local",
    cargas: [],
    resumo: "Outorgas de água superficial, federais e estaduais, com vazão, volume, vigência, finalidade e corpo d'água.",
    informa: [
      "Cada registro traz o empreendimento, o responsável, o CNPJ, o município, a UF, o corpo d'água, o tipo de interferência, a finalidade, o ato, o número, o processo, o início e o fim da vigência, se a camada marca a outorga como válida, a situação, a vazão média, a vazão máxima e o volume anual. Captação é retirada de água. Lançamento é descarga de efluente.",
      "A camada publica 80 atributos e não escreve a unidade no alias. No registro de exemplo da própria ANA, 270 metros cúbicos por hora, durante 21 horas, em 83 dias, somam 470.610 metros cúbicos, o volume anual do mesmo registro. A ficha guarda essa vazão, esse volume, a vigência e a finalidade. Os 36 campos do regime mensal ficam explicados no formato da origem.",
    ],
    campos: [
      ["Empreendimento", "Nome do uso outorgado."],
      ["Responsável", "Quem responde pela outorga."],
      ["CNPJ", "Empreendedor, no formato publicado pelo SNIRH."],
      ["Município e UF", "Lugar do ponto de uso."],
      ["Corpo d'água", "Rio, córrego ou outro corpo nomeado na camada."],
      ["Ato", "Tipo, número e processo."],
      ["Vigência", "Início, fim e a marca outorga_valida."],
      ["Uso e finalidade", "Captação, lançamento ou barragem, e a finalidade, como indústria ou irrigação."],
      ["Vazão e volume", "Vazão média e máxima em metros cúbicos por hora, e volume anual em metros cúbicos."],
      ["Esfera", "Federal ou estadual, conforme a camada consultada."],
    ],
    acesso: [
      "Na coleta, o Radar consulta dois FeatureServers públicos do SNIRH: outorgas federais superficiais e outorgas estaduais superficiais. Não há arquivo em disco nem chave. Cada camada devolve até 6 registros, primeiro os que têm volume anual e, entre eles, os vigentes de maior volume. A ficha fica com no máximo 12.",
    ],
    associacao: [
      "A busca usa os oito primeiros dígitos do CNPJ, escritos como XX.XXX.XXX. Qualquer estabelecimento da mesma raiz entra, inclusive outorga de outra cidade da empresa. A consulta não filtra pelo município do projeto.",
    ],
    alcance: [
      "O mapa usado é o de água superficial. Outorga subterrânea e a série do SNIS ficam de fora desta consulta. A coordenada entra na evidência. A amostra de cada camada privilegia o maior volume anual, então uma outorga pequena da mesma raiz pode ficar fora das 6 linhas.",
    ],
  },

  "CAPTURA-SIGMINE": {
    nome: "SIGMINE / dados abertos da ANM",
    url: "https://dadosabertos.anm.gov.br/SIGMINE/",
    arquivo: "data/cache/sigmine/UF.zip e o DBF extraído. Exemplo bruto em amostras/CAPTURA-SIGMINE/",
    copia: "Leitura do arquivo do estado na coleta",
    cargas: [],
    resumo: "Processos minerários do estado do projeto: fase, substância, uso, área, titular e último evento.",
    informa: [
      "O ZIP de cada UF traz shapefile. A ficha lê o DBF, que tem 12 colunas: processo, número, ano, área em hectares, identificador, fase, último evento, titular, substância, uso, UF e processo formatado. A evidência guarda processo, fase, titular, substância, uso, UF, área e último evento. Número, ano e identificador repetem o que já está em processo ou no banco da ANM.",
      "O último evento junta código, descrição e data, como 418 - CONC LAV/RAL ANO BASE APRESENTADO EM 07/04/2025. A fase é a do título minerário. Não há valor em reais nem coluna de município. O polígono da área fica no SHP e não entra na ficha. Um recorte de 5 linhas de MG está em amostras/CAPTURA-SIGMINE/.",
    ],
    campos: [
      ["Processo", "Número/ano na ANM. Repetidos entram uma vez."],
      ["Fase", "Estágio do título minerário, com 15 valores na edição de MG."],
      ["Titular", "Nome de quem detém o processo. Sem CNPJ."],
      ["Substância e uso", "O que se pretende lavrar e para qual uso."],
      ["Área", "Hectares do polígono, com 8 decimais."],
      ["Último evento", "Código, descrição e data do último andamento."],
      ["Número, ano e ID", "Colunas do DBF que repetem o processo ou identificam a feição. Ficam no arquivo bruto."],
    ],
    acesso: [
      "Na coleta, o Radar baixa o ZIP PROCESSOS_MINERARIOS/UF.zip da ANM para data/cache/sigmine e lê o DBF. Não há chave. O exemplo de 5 registros da edição de MG de 18/10/2026 fica em amostras/CAPTURA-SIGMINE/, com o DBF, o CPG e o PRJ.",
    ],
    associacao: [
      "A busca usa as três primeiras palavras úteis da razão social contra o titular, depois de tirar sufixos como LTDA e S.A. A ficha precisa de UF. Processos repetidos entram uma vez.",
    ],
    alcance: [
      "Sem UF a fonte não roda. O arquivo da UF pode trazer processo de estado vizinho e linha com DADO NÃO CADASTRADO. O polígono e o município não entram. O título minerário é o direito de lavra, e a licença ambiental fica em outra fonte.",
    ],
  },

  "CAPTURA-ONS-PAR": {
    nome: "ONS — Plano de Ampliações e Reforços",
    url: "https://www.epe.gov.br/pt/publicacoes-dados-abertos/publicacoes/programa-de-expansao-da-transmissao-pet-plano-de-expansao-de-longo-prazo-pelp-ciclo-2025-2-semestre",
    arquivo: "data/cache/ons, planilha de apoio do PET/PELP. Exemplo bruto em amostras/CAPTURA-ONS-PAR/",
    copia: "Tabela enr_registro",
    cargas: ["CAPTURA-ONS-PAR"],
    resumo: "Obras de transmissão previstas no PET/PELP de 2025, com tipo, investimento estimado e ano de necessidade.",
    informa: [
      "Cada linha é uma obra da rede elétrica ainda no plano, antes do leilão. O nome descreve a instalação. SE é subestação. SECC LT é o seccionamento de uma linha que já existe, para ligar uma subestação. C1 e C2 são os circuitos. CD é circuito duplo. A tensão aparece em quilovolts no próprio nome, como 230/138 kV.",
      "A ficha guarda o nome, a UF de origem, o tipo, o ano de necessidade e o investimento estimado em reais. A necessidade é o ano em que o plano diz que a rede precisa da obra. A planilha traz o investimento em milhares de reais de 2025. A cópia multiplica por mil. Uma casa quebrada pode aparecer nessa conta.",
      "Duas linhas com o mesmo nome e valores ou anos diferentes são obras distintas na planilha, com códigos diferentes. O plano não informa a empresa que vai construir.",
    ],
    campos: [
      ["Nome", "Subestação ou trecho, com tensão e circuitos."],
      ["Tipo", "SE para subestação, SECC LT para seccionamento de linha, entre outros tipos do plano."],
      ["UF de origem e de destino", "Estados que a obra atende. A sigla usada na ficha é a de origem."],
      ["Necessidade", "Ano em que o plano marca a obra como necessária."],
      ["Investimento", "Estimativa do plano, em reais de 2025."],
      ["Contratação", "Indicação de contratação, quando a planilha preenche."],
    ],
    acesso: [
      "A página do ONS descreve o Plano de Ampliações e Reforços. A tabela usada é a planilha de apoio do PET e do PELP, ciclo 2025, 2º semestre, publicada pela EPE num arquivo 7z. A carga extrai o Excel para data/cache/ons, lê as abas Empreendimentos_PET e Empreendimentos_PELP e grava em enr_registro. Não há chave.",
    ],
    associacao: [
      "A busca pega até quatro palavras de cinco letras ou mais, do nome do projeto e da empresa, e procura essas palavras no nome da obra. Palavras genéricas, como linha, energia, transmissão, projeto, subestação e obra, são deixadas de lado. Se a ficha tem UF, ficam as obras daquele estado.",
      "Uma cidade no título do projeto, como Itajaí, puxa subestações e trechos cujo nome contém essa cidade. A empresa da ficha entra no cruzamento quando o nome dela também está no título da obra.",
    ],
    alcance: [
      "O registro é a obra prevista para a rede naquele lugar e naquele ano. A usina ou a fábrica da ficha continua nas fontes de geração, de obra civil e de licença.",
    ],
  },
  "CAPTURA-REIDI": {
    nome: "Projetos aprovados no REIDI",
    url: "https://dados.transportes.gov.br/dataset/incentivo-fiscal-reidi",
    arquivo: "data/cache/reidi.csv. Exemplo bruto em amostras/CAPTURA-REIDI/",
    copia: "Tabela enr_registro",
    cargas: ["CAPTURA-REIDI"],
    resumo: "Projetos de infraestrutura de transportes habilitados ao incentivo fiscal REIDI, com titular e portaria.",
    informa: [
      "Cada linha é um projeto enquadrado ou habilitado no Regime Especial de Incentivos para o Desenvolvimento da Infraestrutura, no recorte do Ministério dos Transportes. A ficha guarda a empresa, o CNPJ, a UF, o modal, o contrato, o investimento estimado, o ano, a portaria e o ADE.",
      "O enquadramento sai antes da licença e da obra. O valor é a estimativa do benefício ou do investimento informado na planilha, não a prova de que a construção começou.",
    ],
    campos: [
      ["Empresa e CNPJ", "Titular habilitado ao incentivo."],
      ["Modal e UF", "Rodovia, ferrovia, porto ou outro modal, e o estado informado."],
      ["Contrato", "Contrato ou concessão a que o enquadramento se refere."],
      ["Investimento", "Valor em reais publicado na planilha."],
      ["Ano, portaria e ADE", "Ano de aprovação e os atos citados na linha."],
    ],
    acesso: [
      "A carga consulta o catálogo CKAN do Ministério dos Transportes e baixa o CSV semestral mais novo que não seja dicionário. O arquivo tem linhas de título antes do cabeçalho e vem em Windows-1252. Não há chave.",
      "A planilha de energia e a de portos não estão confirmadas e ficam de fora. A página do ministério lista PDFs de portaria; a coleta usa o CSV.",
    ],
    associacao: [
      "A busca casa o CNPJ da ficha ou as primeiras palavras da razão social com o titular. Até 12 projetos entram na comprovação.",
    ],
    alcance: [
      "Habilitação fiscal não é licença de instalação nem início de obra. Portaria publicada só no Diário Oficial, sem linha nesta planilha, continua na consulta do DOU.",
    ],
  },
  "SEC-ANP-CAMPO": {
    nome: "ANP Campos em produção",
    url: "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/arquivos-fase-de-desenvolvimento-e-producao/producao-por-zona",
    arquivo: "data/cache/anp-zona.csv. Exemplo bruto em amostras/SEC-ANP-CAMPO/",
    copia: "Tabela enr_registro",
    cargas: ["SEC-ANP-CAMPO"],
    resumo: "Campos de petroleo e gas com producao no mes, com as 20 colunas do CSV de zona somadas no campo.",
    informa: [
      "A lista nasce do CSV mensal de producao por zona. Varios pocos do mesmo campo viram uma linha: as 20 colunas do arquivo, com as 14 vazoes somadas, mais a contagem de pocos e de zonas.",
      "O operador entra quando a plataforma, o duto ou a instalacao da ANP citam aquele campo. Sem esse vinculo, a linha fica so com o nome do campo e os volumes do mes.",
    ],
    campos: [
      ["Campo, bacia e ambiente", "Nome do campo, a bacia e se a producao e terra ou mar."],
      ["Periodo", "Mes da producao publicada no CSV."],
      ["Pocos e zonas", "Quantas linhas de poco-zona e quantas zonas distintas o campo tem."],
      ["Volumes do mes", "Soma de oleo, condensado, petroleo, gas, agua e fluidos injetados."],
      ["Operador", "Empresa ligada ao campo por plataforma, duto ou instalacao."],
    ],
    acesso: [
      "A carga testa os CSVs mensais de producao por zona, do mes anterior para tras, e fica com o primeiro arquivo que e de fato uma tabela. O arquivo de pocos inteiro nao e copiado para a amostra.",
      "O operador e lido das listas de plataformas, dutos e instalacoes, no mesmo carregamento. Nao ha chave.",
    ],
    associacao: [
      "A busca usa o nome do operador ou um nome de campo igual a uma palavra do titulo do projeto. Ate 12 campos entram na comprovacao.",
    ],
    alcance: [
      "Bloco que ainda esta em exploracao continua na outra fonte da ANP. Esta lista confirma producao recente e o volume do mes, nao o valor do investimento.",
    ],
  },
  "SEC-ANP-PLAT": {
    nome: "ANP Plataformas em operação",
    url: "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/arquivos-fase-de-desenvolvimento-e-producao/lpo",
    arquivo: "data/cache/anp-plataformas.csv. Exemplo bruto em amostras/SEC-ANP-PLAT/",
    copia: "Tabela enr_registro",
    cargas: ["SEC-ANP-PLAT"],
    resumo: "Plataformas e instalacoes maritimas em operacao, com as 13 colunas do CSV.",
    informa: [
      "O CSV traz as 13 colunas: sigla, nome, campos, bacia, operador, classificacao, lamina d'agua, sistema de escoamento, ano de inicio, latitude, longitude e capacidades nominais de oleo e de gas.",
      "E a lista de quem ja opera no mar. Nao inclui o bloco que ainda esta so em exploracao.",
    ],
    campos: [
      ["Sigla e nome", "Identificacao da plataforma ou instalacao."],
      ["Campos e bacia", "Campos ligados a instalacao e a bacia."],
      ["Operador e classificacao", "Empresa que opera e o tipo da unidade, como FPSO ou jaqueta."],
      ["Lamina, escoamento e inicio", "Lamina d'agua, sistema de escoamento e ano de inicio."],
      ["Coordenada e capacidade", "Latitude, longitude e capacidades nominais de oleo e gas."],
    ],
    acesso: [
      "A carga baixa o CSV publico de plataformas em operacao e substitui as linhas anteriores desta fonte. Nao ha chave.",
    ],
    associacao: [
      "A busca usa as primeiras palavras da razao social contra o operador e o nome da instalacao. Ate 12 instalacoes entram na comprovacao.",
    ],
    alcance: [
      "A capacidade em barris nao e o CapEx da plataforma. Unidade que ainda nao opera nao aparece neste arquivo.",
    ],
  },
  "SEC-ANP-DUTO": {
    nome: "ANP Dutos",
    url: "https://www.gov.br/anp/pt-br/assuntos/exploracao-e-producao-de-oleo-e-gas/desenvolvimento-e-producao/lista-de-codigos",
    arquivo: "data/cache/anp-dutos.csv. Exemplo bruto em amostras/SEC-ANP-DUTO/",
    copia: "Tabela enr_registro",
    cargas: ["SEC-ANP-DUTO"],
    resumo: "Dutos de exploracao e producao, com as 9 colunas do CSV de codigos.",
    informa: [
      "Cada linha e um duto do cadastro de codigos da ANP. A copia guarda as 9 colunas: nome, codigo DPP, marca de nao integrante, campo, tipo, classificacao do sistema, operador, funcao umbilical e situacao.",
      "Oleoduto de transporte fora desse cadastro nao entra. O CSV de instalacoes e lido no mesmo passo so para ligar operador ao campo.",
    ],
    campos: [
      ["Nome e codigo", "Identificacao do duto no cadastro, com o codigo DPP."],
      ["Campo e integrante", "Campo de producao e se o duto nao integra o sistema."],
      ["Tipo, classificacao e funcao", "Tipo do duto, classificacao do sistema e funcao do umbilical."],
      ["Operador e situacao", "Quem opera e a situacao cadastral, inclusive projeto e construcao."],
    ],
    acesso: [
      "A carga baixa o CSV de codigos de dutos publicado pela ANP junto da lista de instalacoes, pocos e trechos. As linhas anteriores desta fonte sao substituidas. Nao ha chave.",
    ],
    associacao: [
      "A busca usa as primeiras palavras da razao social contra o operador e o nome do duto. Ate 12 dutos entram na comprovacao, mesmo quando a empresa tem uma lista maior.",
    ],
    alcance: [
      "O cadastro identifica o duto e o campo. Nao traz diametro, extensao nem valor de investimento.",
    ],
  },
  "CAPTURA-QD": {
    nome: "Querido Diário",
    url: "https://queridodiario.ok.org.br/",
    arquivo: "Sem arquivo local. Exemplo bruto em amostras/CAPTURA-QD/",
    copia: "Consulta ao vivo, sem tabela local",
    cargas: [],
    resumo: "Trechos de diários oficiais municipais, consultados quando a ficha já tem município.",
    informa: [
      "A API devolve a data da edição, o nome do município, um trecho do texto encontrado e o link do PDF. Serve para decreto, alvará ou licença municipal citada no diário.",
      "Não cobre o Diário Oficial da União nem os diários estaduais. Vários municípios ainda não estão na base.",
    ],
    campos: [
      ["Data", "Dia da edição em que o trecho apareceu."],
      ["Município", "Cidade do diário consultado."],
      ["Trecho", "Pedaço do texto em que o termo foi encontrado."],
      ["PDF", "Link da edição no acervo do Querido Diário."],
    ],
    acesso: [
      "Na coleta, o Radar resolve o código IBGE do município e da UF da ficha na API de localidades do IBGE. Em seguida consulta a API pública do Querido Diário com o nome da empresa. Não há chave e não há varredura de todos os municípios.",
      "A consulta pede até cinco trechos. Se a busca com a frase inteira vier vazia, tenta as mesmas palavras sem aspas.",
    ],
    associacao: [
      "Só roda quando a ficha tem município. O termo é o nome da empresa, ou o nome do projeto se a empresa ainda não estiver preenchida. Sem trecho, não grava evidência.",
    ],
    alcance: [
      "Um município ausente da base volta vazio. O trecho mostra que o nome saiu no diário municipal. O ato em si precisa ser lido no PDF.",
    ],
  },
  "CAPTURA-SIGPUB": {
    nome: "Diários oficiais dos municípios (SIGPub)",
    url: "https://www.diariomunicipal.com.br/",
    arquivo: "Sem arquivo local. Exemplo bruto em amostras/CAPTURA-SIGPUB/",
    copia: "Consulta ao vivo, sem tabela local",
    cargas: [],
    resumo: "Matérias dos diários oficiais das associações estaduais de municípios, consultadas pelo CNPJ e pelo nome da empresa na UF da ficha.",
    informa: [
      "A busca devolve o título do ato, a prefeitura, câmara ou consórcio que publicou, o órgão, um trecho com o termo, a data de circulação, a edição e o link da matéria. Serve para decreto, lei, alvará e licença municipal.",
      "Cobre os municípios que publicam pela associação do estado. Capitais e cidades grandes costumam ter diário próprio e ficam fora, como Ouro Preto, Sete Lagoas e Camaçari.",
    ],
    campos: [
      ["Título", "Nome do ato publicado, como decreto, lei ou extrato."],
      ["Entidade", "Prefeitura, câmara ou consórcio que publicou a matéria."],
      ["Trecho", "Pedaço do texto em que o CNPJ ou o nome aparece."],
      ["Data", "Dia de circulação da edição."],
      ["Link", "Endereço da matéria no diário da associação."],
    ],
    acesso: [
      "Na coleta, o Radar escolhe os diários de associação da UF da ficha e abre a página pública de busca com o CNPJ completo, a raiz do CNPJ e as primeiras palavras da razão social. Não há chave nem login.",
      "A busca exige um período. O Radar pede de 2015 até a data da coleta e lê a primeira página de resultados, com até 25 matérias por termo.",
    ],
    associacao: [
      "A busca da plataforma combina as palavras com OU. O Radar só guarda a matéria que traz a raiz do CNPJ ou todas as palavras do nome no título ou no trecho. As do município da ficha vêm primeiro, depois atos como licença e decreto, e por último compras públicas.",
    ],
    alcance: [
      "O nome da empresa também aparece como marca de produto em compra de prefeitura, como vergalhão Gerdau ou refrigerante Ambev. Matéria achada só pelo nome fica de fora se não for licença, decreto ou ato parecido; com a raiz do CNPJ, sempre fica.",
    ],
  },
  "CAPTURA-DOM-METAWAY": {
    nome: "Diários municipais Metaway (Mentor)",
    url: "https://lencois.mentor.metaway.com.br/diario/",
    arquivo: "Sem arquivo local. Exemplo bruto em amostras/CAPTURA-DOM-METAWAY/",
    copia: "Consulta ao vivo, sem tabela local",
    cargas: [],
    resumo: "Edições do diário oficial de prefeituras da plataforma Metaway, consultadas pela marca da empresa quando a ficha é de um município mapeado.",
    informa: [
      "A busca devolve as edições em que o termo aparece, com número e data. O Radar abre o PDF das seis mais recentes e guarda o trecho em volta da marca.",
      "Serve para decreto, alvará, permissão de uso e doação municipal ligados à obra. Hoje o mapa tem Lençóis Paulista/SP, com edições desde abril de 2019.",
    ],
    campos: [
      ["Edição", "Número da edição do diário municipal."],
      ["Data", "Dia de publicação da edição."],
      ["Trecho", "Texto do PDF em volta da marca da empresa."],
      ["PDF", "Link do arquivo da edição na plataforma."],
    ],
    acesso: [
      "Na coleta, o Radar acha a prefeitura pelo município e pela UF da ficha e chama a API pública /recurso/diario/lista com a marca e o período. Não há chave.",
      "Para cada edição lida, chama /recurso/diario/editar/{codigo}, que devolve srcPDF, baixa o PDF e extrai o texto das primeiras 20 páginas.",
    ],
    associacao: [
      "A busca usa a primeira palavra do nome da empresa, que costuma ser a marca, porque a plataforma trata várias palavras como frase. O município da ficha já é a barreira contra homônimos.",
    ],
    alcance: [
      "Só cobre prefeituras que estão no mapa do conector. A busca não traz trecho, então edição sem texto legível no PDF fica sem trecho e marcada como não lida.",
    ],
  },
  "CAPTURA-DOE-BA": {
    nome: "Diário Oficial do Estado da Bahia",
    url: "https://dool.egba.ba.gov.br/",
    arquivo: "Sem arquivo local. Exemplo bruto em amostras/CAPTURA-DOE-BA/",
    copia: "Consulta ao vivo, sem tabela local",
    cargas: [],
    resumo: "Páginas do Diário Oficial da Bahia que citam a raiz do CNPJ ou o nome da empresa, com o trecho destacado pela busca.",
    informa: [
      "Cada resultado é uma página do diário com data, número da página e o trecho em que o termo aparece. Traz portarias de licença do INEMA, resoluções do DESENVOLVE e do PROAUTO, contratos da SDE e despachos.",
      "O texto do ato costuma ter o número do processo, a capacidade licenciada e a validade. O valor do investimento raramente aparece nas resoluções de incentivo.",
    ],
    campos: [
      ["Data", "Dia da edição em que a página saiu."],
      ["Página", "Número da página na edição."],
      ["Trecho", "Frase destacada pela busca com o CNPJ ou o nome."],
      ["Link", "Visualizador da edição aberto na página do ato."],
    ],
    acesso: [
      "Na coleta, o Radar chama a busca pública /busca/busca/buscar/query com a raiz do CNPJ e o nome entre aspas, de 2015 até a data da coleta. Lê até duas páginas de dez resultados por termo.",
      "O servidor não manda o certificado intermediário. O conector soma a cadeia de src/enrichment/certs às raízes do Node e mantém a verificação TLS ligada.",
    ],
    associacao: [
      "O resultado só fica se o trecho trouxer a raiz do CNPJ ou todas as palavras do nome. Os que citam o município da ficha vêm primeiro, depois licença e decreto, por data.",
    ],
    alcance: [
      "O PDF da edição pede login, então a evidência fica com o trecho e o visualizador. Página com vários atos pode trazer o nome em ato de outra empresa.",
    ],
  },
  "CAPTURA-DOE-PR": {
    nome: "Diário Oficial do Estado do Paraná",
    url: "https://www.dioe.pr.gov.br/",
    arquivo: "Sem arquivo local. Exemplo bruto em amostras/CAPTURA-DOE-PR/",
    copia: "Consulta ao vivo, sem tabela local",
    cargas: [],
    resumo: "Páginas do Diário Oficial do Paraná que citam a raiz do CNPJ ou o nome da empresa, com o trecho destacado pela busca.",
    informa: [
      "Cada resultado é uma página do diário com data, número da página e trecho. Traz súmulas de licença e autorização do IAT, TAC, outorgas de água e decretos estaduais.",
      "A súmula costuma dizer a modalidade da licença, o endereço da planta e a atividade. É o texto publicado do que o FeatureServer do IAT mostra como registro.",
    ],
    campos: [
      ["Data", "Dia da edição em que a página saiu."],
      ["Página", "Número da página na edição."],
      ["Trecho", "Frase destacada pela busca com o CNPJ ou o nome."],
      ["PDF", "Link do PDF da página no portal do DIOE."],
    ],
    acesso: [
      "Na coleta, o Radar chama a busca pública /busca/busca/buscar/query do DIOE com a raiz do CNPJ e o nome entre aspas, de 2015 até a data da coleta. Lê até duas páginas de dez resultados por termo.",
      "O motor é o mesmo do DOE-BA e o conector compartilha o código. O PDF da página fica em /portal/edicoes/download/{diario_id}/{pagina}, sem login.",
    ],
    associacao: [
      "O resultado só fica se o trecho trouxer a raiz do CNPJ ou todas as palavras do nome. Os que citam o município da ficha vêm primeiro, depois licença, outorga e TAC, por data.",
    ],
    alcance: [
      "A filial pode ter CNPJ próprio com a mesma raiz e outro município; o trecho mostra qual unidade foi licenciada. O host antigo documentos.dioe.pr.gov.br não é usado.",
    ],
  },
  "CAPTURA-DOE-SP": {
    nome: "Diário Oficial do Estado de São Paulo",
    url: "https://www.doe.sp.gov.br/",
    arquivo: "Sem arquivo local. Exemplo bruto em amostras/CAPTURA-DOE-SP/",
    copia: "Consulta ao vivo, sem tabela local",
    cargas: [],
    resumo: "Atos do Diário Oficial de São Paulo que citam a raiz do CNPJ ou o nome da empresa, com título, órgão e trecho.",
    informa: [
      "Cada ato traz data, título, a hierarquia do órgão e um trecho com o termo. Traz as listas mensais de licenças concedidas e solicitadas da CETESB, autuações e outorgas do DAEE e da SP Águas.",
      "Nas listas da CETESB, a linha da empresa diz o número e o tipo da licença, a atividade e o endereço, o que confirma LP, LI e LO da planta.",
    ],
    campos: [
      ["Data", "Dia da publicação do ato."],
      ["Título", "Título do ato, como Licenças Concedidas ou Portaria."],
      ["Órgão", "Hierarquia de quem publicou, do caderno até a unidade."],
      ["Trecho", "Texto em volta do CNPJ ou do nome."],
      ["Link", "Página do ato no portal do DOE-SP."],
    ],
    acesso: [
      "Na coleta, o Radar chama a API pública de busca avançada do DOE-SP com a raiz do CNPJ e depois com o nome, de 2015 até a data da coleta, e lê até 100 atos por termo.",
      "A API não exige chave. Ela só indexa atos a partir de maio de 2023; o acervo legado do diário anterior fica de fora.",
    ],
    associacao: [
      "O ato só fica se o trecho trouxer a raiz do CNPJ ou todas as palavras do nome. O trecho é recortado em volta do termo, e os atos que citam o município da ficha vêm primeiro.",
    ],
    alcance: [
      "Obra concluída antes de 2023 aparece só pelos atos posteriores, como LO e renovação. As listas da CETESB são longas, e o recorte pode cortar parte da linha da empresa.",
    ],
  },
  "CAPTURA-DOE-MG": {
    nome: "Jornal Minas Gerais",
    url: "https://www.jornalminasgerais.mg.gov.br/",
    arquivo: "Sem arquivo local. Exemplo bruto em amostras/CAPTURA-DOE-MG/",
    copia: "Consulta ao vivo, sem tabela local",
    cargas: [],
    resumo: "Trechos do Jornal Minas Gerais que citam a raiz do CNPJ ou o nome da empresa, nos cadernos do Executivo, dos Municípios e de Terceiros.",
    informa: [
      "Cada trecho traz data, caderno e página. Aparecem licenças da SEMAD e decisões do COPAM, protocolos de intenção e cancelamentos da Invest Minas, outorgas, intervenções ambientais e regimes tributários.",
      "O texto vem sem acento e com quebras do PDF, como fi rmado. O número da licença, a fase LP, LI ou LO e o empreendimento costumam estar no próprio trecho.",
    ],
    campos: [
      ["Data", "Dia da edição."],
      ["Caderno", "Diário do Executivo, dos Municípios ou de Terceiros."],
      ["Página", "Número da página no caderno."],
      ["Trecho", "Texto em volta do termo, como a API devolve."],
      ["Link", "Visualizador da edição aberto na página e no termo."],
    ],
    acesso: [
      "Na coleta, o Radar pede um token anônimo em /api/v1/Autenticacao/Autenticar e chama /Pesquisa/PesquisarJornaisPaginados com a raiz do CNPJ e depois com o nome, de 2015 até a data da coleta.",
      "O servidor não manda o certificado intermediário. O conector soma a cadeia de src/enrichment/certs às raízes do Node e mantém a verificação TLS ligada.",
    ],
    associacao: [
      "O trecho só fica se trouxer a raiz do CNPJ, com ponto, espaço ou sem separador, ou todas as palavras do nome. Os que citam o município da ficha vêm primeiro, depois licença e decreto.",
    ],
    alcance: [
      "Empresa com muitas filiais em MG traz atos de outras plantas; o município no trecho separa a unidade da ficha. Várias palavras na busca viram frase exata.",
    ],
  },
  "SEC-SEMAD": {
    nome: "SEMAD Licenças GIS (MG)",
    url: "https://geoserver.meioambiente.mg.gov.br/ows",
    arquivo: "Sem arquivo local. Exemplo bruto em amostras/SEC-SEMAD/",
    copia: "Consulta ao vivo, sem tabela local",
    cargas: [],
    resumo: "Licenças ambientais do sistema SLA de Minas Gerais, encontradas pelo nome do titular na camada pública da IDE-Sisema.",
    informa: [
      "Cada licença traz processo, município, titular, tipo de solicitação, atividade principal com código, classe, modalidade, fase, status, emissão, validade, coordenada e link de visitante do SLA.",
      "A camada cobre licenças do SLA, de 2019 em diante, com milhares de registros. Licença anterior ao SLA não aparece e continua no Jornal Minas Gerais.",
    ],
    campos: [
      ["Processo", "Número do processo no SLA."],
      ["Município", "Município da solicitação."],
      ["Atividade", "Código e descrição da atividade principal."],
      ["Fase", "LP, LI, LO ou combinação, e a modalidade LAC ou LAS."],
      ["Emissão", "Data de emissão da licença."],
    ],
    acesso: [
      "Na coleta, o Radar chama o WFS público do GeoServer da SEMAD com a camada ide_2101_mg_empreendimentos_licenciados_pto e um filtro CQL pelo nome. Não há chave.",
      "A resposta vem em GeoJSON, com até 500 licenças. O conector lê as propriedades e descarta a geometria, porque latitude e longitude já vêm como campos.",
    ],
    associacao: [
      "O filtro usa as duas primeiras palavras do nome, porque o campo cpf_cnpj vem com os últimos dígitos zerados em parte das linhas. As licenças do município da ficha vêm primeiro, por data de emissão.",
    ],
    alcance: [
      "Nome genérico traz licença de outra empresa; o município e a atividade separam. A camada não traz valor de investimento nem o parecer, que fica no link do SLA.",
    ],
  },
  "CAPTURA-DOU": {
    nome: "Diário Oficial da União",
    url: "https://www.in.gov.br/consulta/-/buscar/dou",
    arquivo: "Sem arquivo local. Exemplo bruto em amostras/CAPTURA-DOU/",
    copia: "Consulta ao vivo, sem tabela local",
    cargas: [],
    resumo: "Atos do Diário Oficial da União encontrados pelo nome da empresa, com resumo curto dos cinco mais recentes.",
    informa: [
      "Não existe uma base de projetos. A consulta devolve o ato: título, data, seção, página, órgão, um resumo curto, um trecho e o link da publicação. É onde saem portaria de REIDI, projeto prioritário, licença e outorga.",
      "A evidência guarda o ato, não a página de busca. O Radar abre a página de cada um dos cinco atos mais recentes para escrever o resumo. Sem modelo, o resumo é o trecho em volta do nome da empresa.",
    ],
    campos: [
      ["Título", "Ementa ou nome do ato."],
      ["Data e seção", "Dia da publicação e a seção do diário."],
      ["Página", "Página da edição."],
      ["Órgão", "Quem assina o ato, lido no cabeçalho da página."],
      ["Resumo", "Uma ou duas frases sobre o que o ato faz com a empresa."],
      ["Trecho e link", "Pedaço do ato e o endereço da publicação."],
    ],
    acesso: [
      "Na coleta, o Radar abre a busca pública da Imprensa Nacional pelo nome da empresa e lê o bloco de resultados que a página já traz. Não percorre o diário do dia nem liga o scanner de notícias. Não há chave.",
      "Dos atos em que as palavras do nome da empresa aparecem no título ou no trecho, ficam os cinco de data mais recente. O limite de cinco atos mais recentes por consulta é uma escolha inicial e pode ser revisado.",
    ],
    associacao: [
      "A busca usa as primeiras palavras da razão social. Ato que não contém essas palavras é descartado. Sem ato, não grava evidência.",
    ],
    alcance: [
      "O ato confirma a publicação oficial. Não substitui a planilha do REIDI nem a licença estadual.",
    ],
  },
};

const DEEP_PROFILES = {
  "SEC-BNDES": {
    modo: "CNPJ exato contra o cliente da operação não automática",
    status: "Contrato ativo e data de contratação na janela de 18 meses indicam financiamento vigente; liquidado ou antigo enfraquece o vínculo com a obra atual.",
    acesso: "A carga baixa o CSV público de operações não automáticas do BNDES para data/cache/bndes-nao-automaticas.csv e grava enr_bndes, sem chave.",
    secundario: "A consulta conta contratos totais e os da janela de 18 meses, limita a evidência a 12 linhas e usa UF e município só para desambiguar.",
    limite: "Operações automáticas ficam em outro arquivo, o valor contratado não é o CapEx total e a descrição livre pode falar de outro projeto do mesmo CNPJ.",
    fetch: "Baixar o CSV público de operações não automáticas",
    store: "Normalizar CNPJ, datas e valores e gravar em enr_bndes",
    query: "Consultar contratos pelo CNPJ exato da ficha",
    match: "Separar os contratos da janela de 18 meses e conferir UF",
    evidence: "Expor contrato, data, local, descrição, situação e valor contratado",
    implication: "Inferir financiamento contratado, sem afirmar que a obra avançou",
  },
  "SEC-CVM-IPE": {
    modo: "CNPJ exato contra o protocolo IPE da companhia aberta",
    status: "Fato relevante ou comunicado recente pode anunciar investimento, contratação ou operação; a data de referência alimenta a janela de status.",
    acesso: "A carga baixa os ZIPs anuais de 2025 e 2026, extrai o CSV e grava em enr_cvm_ipe só Fato Relevante e Comunicado ao Mercado.",
    secundario: "A consulta lê pelo CNPJ, limita a 12 documentos e, na coleta, baixa os cinco mais recentes com menos de um ano para Markdown.",
    limite: "Companhia fechada não protocola IPE, outras categorias do arquivo ficam de fora e o documento antigo permanece só com o link.",
    fetch: "Baixar os ZIPs anuais ipe_cia_aberta de 2025 e 2026",
    store: "Filtrar duas categorias e gravar as 13 colunas em enr_cvm_ipe",
    query: "Consultar protocolos pelo CNPJ da companhia",
    match: "Ordenar pela data de referência e marcar a janela de 18 meses",
    evidence: "Expor assunto, categoria, espécie, apresentação, datas e link",
    implication: "Inferir anúncio ao mercado, sem tratar o texto como fase da obra",
  },
  "SEC-SIGA": {
    modo: "CNPJ lido no texto de participação contra o empreendimento de geração",
    status: "Fase, potência e entrada em operação descrevem o parque gerador; construção ou operação situam o ativo, sem valor de investimento.",
    acesso: "A carga baixa o CSV diário do SIGA e, quando o nome do agente coincide, reaproveita o CNPJ do CSV mensal.",
    secundario: "A consulta lê as 23 colunas pelo CNPJ encontrado, limita a evidência e marca se a entrada cai na janela de status.",
    limite: "Edição diária pode omitir o CNPJ, nome divergente não herda o número antigo e a data sentinela 1900-01-03 não é gravada.",
    fetch: "Baixar o CSV diário e o CSV mensal do SIGA",
    store: "Normalizar as 23 colunas e gravar em enr_siga",
    query: "Consultar empreendimentos pelo CNPJ do texto de participação",
    match: "Conferir CEG, fase, potência, município e entrada em operação",
    evidence: "Expor CEG, fase, combustível, potências, coordenada, vigência e município",
    implication: "Inferir usina outorgada ou em operação, sem CapEx da planta",
  },
  "SEC-IBAMA": {
    modo: "Razão social em duas palavras contra o titular da licença federal",
    status: "O nome completo do ato, a tipologia e as datas situam o licenciamento; renovação ou indeferimento mudam a leitura da fase.",
    acesso: "A carga baixa o CSV público sislic-licencas.csv e grava as dez colunas em enr_sislic, sem chave.",
    secundario: "A busca compara as duas primeiras palavras da razão social com NOM_PESSOA; não há coluna de CNPJ nem de UF.",
    limite: "Homônimo nacional pode entrar, o catálogo descreve só oito atributos e o PAC do arquivo não é a fase da obra.",
    fetch: "Baixar o CSV público do SISLIC",
    store: "Ler as dez colunas e gravar em enr_sislic",
    query: "Pesquisar o titular pelas palavras iniciais da razão social",
    match: "Conferir ato, tipologia, processo, PAC e datas",
    evidence: "Expor ato, número, empreendimento, titular, tipologia, processo, PAC e datas",
    implication: "Mapear o ato federal à fase que ele autoriza",
  },
  "SEC-ANTT-INV": {
    modo: "Nome da concessionária contra o cadastro de investimentos da ANTT",
    status: "Cadastro, autorização e encerramento descrevem a obra do PER; o encerramento é o recorte mais próximo de conclusão.",
    acesso: "A carga baixa os cinco CSVs do CKAN, cruza CAD, AUT e ENC por id_sigicor e grava em enr_registro.",
    secundario: "A busca usa o nome da concessionária, sem CNPJ; a série anual cruza pelo nome dobrado sem espaço.",
    limite: "Nenhum arquivo publica CNPJ, PIP é ferroviário sem id_sigicor e a grafia do nome muda entre o SIGICOR e a série anual.",
    fetch: "Baixar cadastro, autorização, encerramento, PIP e série anual",
    store: "Cruzar por id_sigicor e gravar as planilhas em enr_registro",
    query: "Pesquisar a concessionária pelo nome, sem tratar processo SEI como CNPJ",
    match: "Juntar autorização e encerramento do mesmo id_sigicor",
    evidence: "Expor obra do PER, autorização, encerramento e total anual",
    implication: "Inferir investimento de concessão, não CapEx industrial",
  },
  "SEC-ANTAQ-INST": {
    modo: "Razão social em duas palavras contra a empresa autorizada do terminal",
    status: "A autorização do TUP ou ETC confirma instalação portuária; o arquivo de 2022 não data obra nova.",
    acesso: "A carga baixa o CSV de outubro de 2022 para data/cache/antaq-instalacoes.csv e grava em enr_registro.",
    secundario: "A primeira linha do arquivo é título; o cabeçalho vem na segunda. Não há coluna de CNPJ.",
    limite: "O endereço mais novo citado no catálogo não responde e a fotografia é de outubro de 2022.",
    fetch: "Baixar o CSV de instalações portuárias privadas",
    store: "Pular a linha de título e gravar em enr_registro",
    query: "Pesquisar a empresa autorizada pelas palavras da razão social",
    match: "Conferir município, UF, tipo de instalação e instrumento",
    evidence: "Expor instalação, empresa, local, tipo, carga e outorga",
    implication: "Inferir terminal autorizado, sem movimentação recente",
  },
  "SEC-ARTESP": {
    modo: "Lote convertido em concessionária contra nome da empresa da ficha",
    status: "Programas CAPEX, REVIT e NS sinalizam obra programada na concessão, com datas previstas; a linha não comprova mobilização, avanço físico, desembolso ou conclusão efetiva.",
    acesso: "A carga chama package_show do CKAN para programacao-de-obras, prefere GeoJSON real e usa o template com exemplo=true como fallback; o cache fica em data/cache/artesp e o resultado em enr_registro.",
    secundario: "O de-para lote→concessionária é o vínculo principal, complementado por palavras do projeto na rodovia ou serviço e filtro obrigatório de UF SP; conservação rotineira é excluída.",
    limite: "A fonte cobre apenas concessões paulistas reguladas pela ARTESP, não ANTT ou DER; não há valor em reais e o fallback de template pode produzir somente exemplos claramente marcados.",
    fetch: "Consultar package_show e selecionar o recurso GeoJSON de obras",
    store: "Resolver lote e concessionária e gravar em enr_registro",
    query: "Consultar programação apenas para fichas localizadas em SP",
    match: "Cruzar concessionária, lote e tokens de rodovia ou serviço",
    evidence: "Expor programa, trecho, serviço, datas e marcador de exemplo",
    implication: "Inferir programação futura, sem afirmar execução física",
  },
  "SEC-IAT": {
    modo: "Razão social em duas palavras contra titular da licença no Paraná",
    status: "Modalidade, emissão e validade situam o ato ambiental e podem indicar autorização prévia, instalação ou operação conforme a nomenclatura publicada pelo IAT.",
    acesso: "A carga pagina até 2.000 feições por chamada no FeatureServer público 00_PUBLICACOES/licencas_ambientais_sia_sga/FeatureServer/0 e grava os atributos em enr_registro, sem arquivo local.",
    secundario: "A correlação nominal é restrita à UF PR; município, protocolo, atividade e modalidade ajudam a rejeitar homônimos, mas licenças da mesma empresa em cidades diferentes ainda podem entrar.",
    limite: "A camada não publica CNPJ, criando risco de falso positivo por nome, e não cobre outros estados; coordenadas e anexos do processo não são copiados para a evidência.",
    fetch: "Paginar a camada pública de licenças ambientais do IAT",
    store: "Normalizar atributos e persistir as feições em enr_registro",
    query: "Pesquisar titulares pelas palavras iniciais da razão social",
    match: "Filtrar PR e conferir município, atividade e protocolo",
    evidence: "Expor modalidade, atividade, emissão e validade da licença",
    implication: "Mapear a modalidade ambiental à fase que ela autoriza",
  },
  "SEC-CNO": {
    modo: "Raiz de oito dígitos do CNPJ contra responsável pela obra",
    status: "Situação ativa e início recente são sinais de construção registrada; paralisada, suspensa ou encerrada alteram a leitura da fase, sem informar percentual executado ou valor.",
    acesso: "O sincronismo baixa o ZIP quando a Receita publica versão nova e extrai os cinco CSV ao lado dele. A ficha lê o cno.csv extraído, em latin1, e completa a amostra com cno_areas.csv, cno_cnaes.csv, cno_vinculos.csv e a contagem de cno_totais.csv. O dicionário PDF não é reconferido enquanto estiver no disco.",
    secundario: "A raiz reúne matriz e filiais; as contagens distinguem CNPJ exato, UF, município e início nos últimos 18 meses. A amostra prioriza município, estado e período e leva área, CNAE e vínculo do mesmo CNO.",
    limite: "O CNO não traz valor de investimento e pode representar reforma, demolição ou obra sem relação com o projeto pesquisado; o uso da raiz amplia falsos positivos entre filiais.",
    fetch: "Abrir o ZIP local atualizado pelo catálogo do dados.gov.br",
    store: "Ler os cinco CSV pelo cabeçalho, em latin1, sem gravar tabela nacional",
    query: "Selecionar linhas pela raiz de oito dígitos do CNPJ",
    match: "Priorizar CNPJ exato, município, UF e início em 18 meses, e juntar área, CNAE e vínculo pelo CNO",
    evidence: "Expor CNO, responsável, qualificação, área, CNAE, vínculo, início e situação cadastral",
    implication: "Inferir construção registrada ou paralisação pelo código vigente",
  },
  "SEC-ANP-EP": {
    modo: "Razão social em duas palavras contra operador ou contratados",
    status: "Bloco presente no arquivo mensal está em exploração, e período exploratório, rodada e regime refinam a etapa contratual; isso antecede desenvolvimento e produção.",
    acesso: "A carga localiza na página da ANP o CSV mensal mais recente de blocos sob contrato, salva-o em data/cache/anp-blocos.csv e substitui as linhas SEC-ANP-EP em enr_registro.",
    secundario: "Operador e contratados recebem a mesma comparação nominal; bacia, ambiente e nome do bloco ajudam a confirmar o projeto, com limite de 20 blocos na comprovação.",
    limite: "Correspondencia por nome pode confundir grupos empresariais, campos ja produtores ficam em outra lista e o arquivo nao informa CapEx de pocos, plataformas ou campanhas sismicas.",
    fetch: "Descobrir e baixar o CSV mensal mais recente de blocos",
    store: "Normalizar operadores e contratos e gravar em enr_registro",
    query: "Pesquisar operador e contratados pelas palavras da empresa",
    match: "Conferir bloco, bacia, ambiente, rodada e regime",
    evidence: "Expor as 22 colunas do bloco, inclusive area, PAD, vencimentos, UTs e pocos",
    implication: "Inferir fase de exploração anterior ao desenvolvimento produtivo",
  },
  "SEC-ANA-SNIRH": {
    modo: "Raiz do CNPJ mascarada como XX.XXX.XXX contra empreendedor",
    status: "Tipo do ato, finalidade e situação distinguem captação, lançamento, barragem e a fase da interferência. Uma outorga vigente sinaliza autorização hídrica, mas não prova que a planta foi construída ou opera.",
    acesso: "Cada enriquecimento consulta ao vivo os FeatureServers públicos de outorgas superficiais federais e estaduais do SNIRH, sem autenticação, cache em disco ou tabela local.",
    secundario: "A máscara da raiz inclui matriz e filiais. Cada camada devolve até 6 registros, primeiro os de maior volume anual entre os que publicam volume, e o total da ficha continua em 12. Empreendimento e município contextualizam, mas não são filtros obrigatórios.",
    limite: "A consulta exclui águas subterrâneas, pode trazer outorga de outra cidade da mesma raiz e depende dos serviços GIS. Cada camada devolve no máximo 6 registros, ordenados pela validade e pelo volume anual.",
    fetch: "Consultar ao vivo as camadas federal e estadual superficiais",
    store: "Manter somente a resposta da coleta, sem persistência local",
    query: "Filtrar o empreendedor pela máscara da raiz do CNPJ",
    match: "Comparar empreendimento, município, corpo d'água, ato, uso, finalidade, vigência, vazão e volume",
    evidence: "Expor outorga, local, corpo d'água, finalidade, vigência, vazão e volume anual",
    implication: "Inferir autorização hídrica, sem presumir implantação ou operação",
  },

  "CAPTURA-SIGMINE": {
    modo: "Razão social em três palavras contra titular no arquivo da UF",
    status: "A fase do título separa requerimento, pesquisa, licenciamento e concessão de lavra. O último evento acrescenta código, descrição e data, como suspensão de lavra ou RAL apresentado. Isso é o andamento do título minerário.",
    acesso: "Na coleta, o ZIP PROCESSOS_MINERARIOS/UF.zip é baixado da ANM para data/cache/sigmine, o DBF é extraído e lido localmente, sem autenticação ou carga no Postgres.",
    secundario: "A ficha precisa de UF e a comparação usa três palavras após remover sufixos societários. Processo, substância, uso e área validam o vínculo e duplicatas de processo são eliminadas.",
    limite: "Sem UF a fonte não roda. Mudança de titular ou abreviação pode escapar do nome. Não há valor em reais, nem município, e o polígono do SHP fica de fora. O título minerário convive com a licença ambiental, que está em outra fonte.",
    fetch: "Baixar o ZIP de processos minerários da UF informada",
    store: "Extrair e ler o DBF no cache data/cache/sigmine",
    query: "Pesquisar titulares pelas três palavras úteis da empresa",
    match: "Deduplicar processo e conferir substância, uso, área e UF",
    evidence: "Expor processo, fase, titular, substância, uso, área e último evento",
    implication: "Inferir a maturidade do direito minerário pela fase e pelo último andamento",
  },

  "CAPTURA-ONS-PAR": {
    modo: "Tokens do nome do projeto contra obra PET/PELP com filtro de UF",
    status: "Ano de necessidade e indicação de contratação posicionam reforços ainda em planejamento; a inclusão no PET/PELP não significa leilão concluído, licença ou construção iniciada.",
    acesso: "A carga baixa o 7z do ciclo PET/PELP 2025 segundo semestre, extrai XLSX via Python em data/cache/ons, lê Empreendimentos_PET e Empreendimentos_PELP e grava enr_registro.",
    secundario: "São usadas até quatro palavras com cinco ou mais letras, removendo termos genéricos, e a UF da ficha restringe candidatos; a empresa só ajuda quando também aparece no nome da obra.",
    limite: "O plano não identifica necessariamente quem construirá, estimativas podem conter células problemáticas e obras com nomes genéricos geram falsos positivos; valores são reais de 2025, não orçamento contratado.",
    fetch: "Baixar e extrair o 7z da planilha PET e PELP",
    store: "Ler duas abas via Python e carregar em enr_registro",
    query: "Gerar até quatro tokens específicos do projeto e empresa",
    match: "Buscar tokens no título e restringir pela UF informada",
    evidence: "Expor obra, tipo, necessidade e investimento estimado",
    implication: "Inferir planejamento da transmissão, não contratação da obra",
  },
  "CAPTURA-REIDI": {
    modo: "CNPJ exato ou razão social contra titular habilitado no REIDI",
    status: "Enquadramento ou habilitação no REIDI é sinal prévio de estruturação e benefício fiscal; portaria e ano ajudam a datar aprovação, mas não comprovam licença nem construção.",
    acesso: "A carga consulta o CKAN de dados.transportes.gov.br, seleciona o CSV semestral mais recente, ignora linhas anteriores ao cabeçalho, decodifica Windows-1252 e grava enr_registro.",
    secundario: "O CNPJ prevalece e o nome funciona como fallback; UF, modal, contrato, portaria e ADE validam o projeto, com no máximo 12 linhas retornadas.",
    limite: "O recorte confirmado é do Ministério dos Transportes, podendo omitir energia e portos; valores variam entre investimento e benefício e atos apenas no DOU podem não constar no CSV.",
    fetch: "Descobrir e baixar o CSV semestral mais novo do REIDI",
    store: "Decodificar Windows-1252 e carregar linhas em enr_registro",
    query: "Consultar primeiro pelo CNPJ e depois pelo nome titular",
    match: "Conferir UF, modal, contrato, portaria, ADE e ano",
    evidence: "Expor habilitação, ato e investimento informado na planilha",
    implication: "Inferir estruturação fiscal anterior à licença e construção",
  },
  "SEC-ANP-CAMPO": {
    modo: "Operador ou token exato do projeto contra nome do campo",
    status: "Produção no mês mais recente confirma fase operacional do campo; vínculos com plataforma, duto ou instalação atribuem operador, mas não datam novos investimentos.",
    acesso: "A carga testa retrospectivamente CSVs mensais de produção por zona até achar uma tabela válida, agrega poços por campo e grava SEC-ANP-CAMPO em enr_registro.",
    secundario: "A razão social pode casar com operador derivado das listas ANP, ou uma palavra do título com o campo; bacia, ambiente e período refinam o resultado, limitado a 12 campos.",
    limite: "Campo homonimo ao token do projeto pode gerar falso positivo, operador pode faltar quando listas auxiliares nao citam o campo e o volume do mes nao e CapEx.",
    fetch: "Localizar o CSV mensal válido de produção por zona",
    store: "Agregar pocos por campo, somar volumes e carregar em enr_registro",
    query: "Pesquisar operador e tokens exatos do nome do campo",
    match: "Conferir bacia, ambiente e mês de produção publicado",
    evidence: "Expor campo, operador, pocos, zonas e as 14 vazoes somadas do mes",
    implication: "Inferir operação produtiva, sem quantificar investimento associado",
  },
  "SEC-ANP-PLAT": {
    modo: "Razão social contra operador e nome da plataforma",
    status: "A presença na lista de plataformas em operação e o ano de início confirmam ativo operacional offshore; capacidade nominal não informa produção corrente nem novo CapEx.",
    acesso: "O CSV público de plataformas e instalações marítimas em operação é baixado para data/cache/anp-plataformas.csv e substitui as linhas SEC-ANP-PLAT em enr_registro, sem chave.",
    secundario: "As primeiras palavras da empresa são comparadas ao operador e ao nome da instalação; sigla, campos, bacia e início validam o vínculo, com limite de 12 resultados.",
    limite: "Unidades em construção, desmobilizadas ou ainda não operacionais podem faltar, nomes societários divergentes podem escapar e capacidades de óleo e gás não equivalem a valor investido.",
    fetch: "Baixar o CSV público de plataformas em operação",
    store: "Normalizar instalações e substituir linhas em enr_registro",
    query: "Pesquisar operador e instalação pelas palavras da empresa",
    match: "Conferir sigla, campos, bacia, lamina, coordenada, capacidades e ano de inicio",
    evidence: "Expor as 13 colunas da plataforma, inclusive lamina, coordenada e capacidades nominais",
    implication: "Inferir operação offshore existente, não obra nova",
  },
  "SEC-ANP-DUTO": {
    modo: "Razão social contra operador ou nome do duto",
    status: "A situação cadastral distingue duto em operação de outros estados administrativos; campo e classificação mostram sua função no escoamento, sem cronograma construtivo.",
    acesso: "A carga baixa o CSV de códigos de dutos na lista pública da ANP para data/cache/anp-dutos.csv e substitui as linhas SEC-ANP-DUTO em enr_registro, sem autenticação.",
    secundario: "As palavras iniciais da empresa são comparadas ao operador e nome do duto; campo, tipo, classificação e situação validam o resultado, limitado a 12 linhas.",
    limite: "O cadastro de E&P não cobre toda a malha de transporte, não traz extensão, diâmetro ou CapEx e pode manter denominações operacionais diferentes da razão social atual.",
    fetch: "Baixar o CSV de códigos de dutos publicado pela ANP",
    store: "Normalizar códigos e substituir registros em enr_registro",
    query: "Pesquisar operador e nome do duto por razão social",
    match: "Conferir campo, tipo, classificacao, nao integrante, funcao umbilical e situacao",
    evidence: "Expor as 9 colunas do duto, inclusive nao integrante, classificacao e funcao umbilical",
    implication: "Inferir infraestrutura de escoamento existente e sua situação",
  },
  "CAPTURA-QD": {
    modo: "Nome da empresa ou projeto contra texto do diário municipal",
    status: "Trechos podem revelar alvará, licença, decreto, desapropriação ou contrato municipal e assim indicar autorização ou implantação, mas a fase só é confirmada pela leitura do ato.",
    acesso: "Na coleta ao vivo, a API de localidades do IBGE resolve territory_id pelo município e UF e a API pública do Querido Diário busca até cinco ocorrências; não há token, cache ou tabela.",
    secundario: "A fonte exige município; busca primeiro a frase inteira e depois palavras sem aspas, usando empresa ou projeto, e mantém o território IBGE como barreira contra homônimos nacionais.",
    limite: "Muitos municípios não são cobertos, OCR e recortes podem perder contexto e nomes comuns geram falsos positivos; o trecho não substitui o PDF nem alcança diários estaduais ou federal.",
    fetch: "Resolver o territory_id municipal pela API pública do IBGE",
    store: "Consultar ao vivo sem persistir edições ou PDFs localmente",
    query: "Buscar empresa ou projeto na API do Querido Diário",
    match: "Restringir ao município e tentar frase e palavras separadas",
    evidence: "Expor edição, trecho contextual e link do PDF municipal",
    implication: "Inferir possível ato local, sujeito à leitura integral",
  },
  "CAPTURA-SIGPUB": {
    modo: "CNPJ completo, raiz do CNPJ e nome da empresa contra o texto das matérias do diário da associação da UF",
    status: "Decreto de desmembramento, lei de incentivo, alvará ou licença municipal indicam terreno, autorização ou implantação. A fase só se confirma lendo o ato.",
    acesso: "Na coleta ao vivo, a página pública de busca de cada associação da UF é aberta por HTTP GET com período de 2015 até hoje, sem token, cache ou tabela.",
    secundario: "A UF da ficha escolhe a associação. O filtro exige a raiz do CNPJ ou todas as palavras do nome, e o município da ficha ordena primeiro.",
    limite: "Só cobre municípios associados à plataforma. A primeira página traz até 25 matérias por termo, nomes de marca geram ruído em licitação e mudanças no HTML interrompem a leitura.",
    fetch: "Abrir a busca HTML pública do diário da associação",
    store: "Consultar ao vivo sem persistir matérias localmente",
    query: "Buscar CNPJ, raiz e nome da empresa no período",
    match: "Exigir CNPJ ou todas as palavras e ordenar pelo município",
    evidence: "Expor título, entidade, órgão, trecho, data, edição e link",
    implication: "Inferir ato municipal ligado ao terreno ou à obra, sujeito à leitura integral",
  },
  "CAPTURA-DOM-METAWAY": {
    modo: "Marca da empresa contra o texto das edições do diário da prefeitura do município da ficha",
    status: "Decreto, permissão de uso, doação ou alvará citando a empresa marcam terreno, apoio local ou obra em curso; a fase só se confirma no ato.",
    acesso: "Na coleta ao vivo, a API JSON da plataforma lista as edições com o termo e cada PDF é baixado e lido, sem token, cache ou tabela.",
    secundario: "O município e a UF da ficha escolhem a prefeitura; sem prefeitura no mapa, a fonte não roda. As seis edições mais recentes são lidas.",
    limite: "Só cobre prefeituras mapeadas, a busca não traz trecho e o PDF pode ter texto ilegível ou mais de 20 páginas.",
    fetch: "Listar as edições com o termo na API da prefeitura",
    store: "Ler os PDFs ao vivo sem persistir edições localmente",
    query: "Buscar a marca da empresa no período",
    match: "Exigir o município da ficha e achar o termo no PDF",
    evidence: "Expor edição, data, trecho do PDF e link do arquivo",
    implication: "Inferir ato municipal sobre o terreno ou a obra, sujeito à leitura integral",
  },
  "CAPTURA-DOE-BA": {
    modo: "Raiz do CNPJ e nome da empresa entre aspas contra o texto integral das páginas do DOE-BA",
    status: "Portaria de LI, LO ou licença de alteração do INEMA, habilitação em DESENVOLVE ou PROAUTO e contrato de terreno da SDE marcam autorização, incentivo e implantação.",
    acesso: "Na coleta ao vivo, a API JSON da busca do DOOL é chamada por HTTPS com a cadeia intermediária embutida, sem token, cache ou tabela.",
    secundario: "O trecho tem de trazer a raiz do CNPJ ou todas as palavras do nome; o município da ficha e o tipo de ato ordenam o resultado.",
    limite: "Página com vários atos traz ruído, o PDF pede login e a resolução de incentivo raramente traz valor; a leitura para em duas páginas de resultado por termo.",
    fetch: "Chamar a busca JSON do Diário Oficial da Bahia",
    store: "Consultar ao vivo sem persistir páginas localmente",
    query: "Buscar raiz de CNPJ e nome entre aspas desde 2015",
    match: "Exigir CNPJ ou nome no trecho e ordenar pelo município",
    evidence: "Expor data, página, trecho destacado, tipo de ato e link",
    implication: "Inferir licença, incentivo ou terreno estadual ligado à obra",
  },
  "CAPTURA-DOE-PR": {
    modo: "Raiz do CNPJ e nome da empresa entre aspas contra o texto integral das páginas do DIOE-PR",
    status: "Súmula de LP, LI ou LO do IAT, TAC e outorga de água marcam autorização ambiental e implantação da planta no Paraná.",
    acesso: "Na coleta ao vivo, a API JSON da busca do DIOE é chamada por HTTPS, sem token, cache ou tabela; o motor é o mesmo do DOE-BA.",
    secundario: "O trecho tem de trazer a raiz do CNPJ ou todas as palavras do nome; o município da ficha e o tipo de ato ordenam o resultado.",
    limite: "Página com vários atos traz ruído e filiais da mesma raiz aparecem com outro município; a leitura para em duas páginas de resultado por termo.",
    fetch: "Chamar a busca JSON do Diário Oficial do Paraná",
    store: "Consultar ao vivo sem persistir páginas localmente",
    query: "Buscar raiz de CNPJ e nome entre aspas desde 2015",
    match: "Exigir CNPJ ou nome no trecho e ordenar pelo município",
    evidence: "Expor data, página, trecho destacado, tipo de ato e PDF",
    implication: "Inferir licença, outorga ou TAC estadual ligado à planta",
  },
  "CAPTURA-DOE-SP": {
    modo: "Raiz do CNPJ e nome da empresa contra título e texto dos atos do DOE-SP",
    status: "Linha da empresa nas listas de licenças da CETESB, outorga do DAEE e autuação ambiental marcam LP, LI, LO e operação.",
    acesso: "Na coleta ao vivo, a API JSON de busca avançada do DOE-SP é chamada sem token, cache ou tabela.",
    secundario: "O ato tem de trazer a raiz do CNPJ ou todas as palavras do nome; o trecho é recortado no termo e o município da ficha ordena.",
    limite: "Só indexa desde maio de 2023, as listas da CETESB são longas e a primeira página traz até 100 atos por termo.",
    fetch: "Chamar a busca avançada JSON do Diário Oficial de SP",
    store: "Consultar ao vivo sem persistir atos localmente",
    query: "Buscar raiz de CNPJ e nome desde 2015",
    match: "Exigir CNPJ ou nome e recortar o trecho no termo",
    evidence: "Expor data, título, órgão, trecho, tipo de ato e link",
    implication: "Inferir licença CETESB ou outorga estadual ligada à planta",
  },
  "CAPTURA-DOE-MG": {
    modo: "Raiz do CNPJ e nome da empresa contra o texto do Jornal Minas Gerais",
    status: "Licença da SEMAD, decisão do COPAM, protocolo de intenção da Invest Minas e regime tributário marcam anúncio, autorização e implantação.",
    acesso: "Na coleta ao vivo, a API v1 é chamada com token anônimo e cadeia intermediária embutida, sem cache ou tabela.",
    secundario: "O trecho tem de trazer a raiz do CNPJ, em qualquer separador, ou todas as palavras do nome; o município da ficha ordena primeiro.",
    limite: "Empresa com várias plantas traz atos de outras unidades, o texto vem sem acento e a primeira página traz até 40 trechos por termo.",
    fetch: "Pedir token anônimo e chamar a pesquisa paginada do Jornal",
    store: "Consultar ao vivo sem persistir trechos localmente",
    query: "Buscar raiz de CNPJ e nome desde 2015",
    match: "Exigir CNPJ ou nome no trecho e ordenar pelo município",
    evidence: "Expor data, caderno, página, trecho, tipo de ato e link",
    implication: "Inferir licença, protocolo ou incentivo estadual ligado à obra",
  },
  "SEC-SEMAD": {
    modo: "Duas primeiras palavras do nome contra o titular das licenças do SLA",
    status: "Modalidade, fase LP, LI ou LO e status deferido com data de emissão dizem em que etapa ambiental a planta está.",
    acesso: "Na coleta ao vivo, o WFS público devolve GeoJSON filtrado por CQL, sem token, cache ou tabela.",
    secundario: "O município da ficha ordena primeiro; a atividade com código separa mina, planta industrial e apoio.",
    limite: "O CNPJ está corrompido em parte das linhas, o nome genérico traz homônimos e a camada só cobre o SLA, de 2019 em diante.",
    fetch: "Chamar o WFS da IDE-Sisema com filtro CQL pelo nome",
    store: "Consultar ao vivo sem persistir licenças localmente",
    query: "Filtrar o titular pelas duas primeiras palavras do nome",
    match: "Ordenar pelo município da ficha e pela emissão",
    evidence: "Expor processo, município, atividade, fase, status, datas e link do SLA",
    implication: "Inferir a etapa do licenciamento estadual da planta",
  },
  "CAPTURA-DOU": {
    modo: "Razão social em palavras contra título ou trecho do ato no DOU",
    status: "Portarias, outorgas, licenças e enquadramentos podem marcar aprovação ou autorização federal; data, seção e conteúdo determinam a fase, não a simples menção da empresa.",
    acesso: "Cada coleta consulta a página HTML de busca em in.gov.br e interpreta BuscaDouPortlet_params e os blocos retornados, sem autenticação, arquivo em data/ ou tabela local.",
    secundario: "As primeiras palavras da razão social formam a busca e resultados sem essas palavras no título ou trecho são descartados; dos até oito atos devolvidos ficam os cinco mais recentes, cada um com órgão, resumo e link oficial.",
    limite: "Mudanças no HTML podem interromper a extração, nomes comuns geram ruído e o corte em cinco atos pode deixar de fora publicações antigas relevantes; o limite de cinco atos mais recentes por consulta é uma escolha inicial e pode ser revisado. A busca não substitui bases estruturadas de REIDI, contratos ou licenciamento.",
    fetch: "Abrir a busca HTML pública da Imprensa Nacional",
    store: "Interpretar BuscaDouPortlet_params sem persistência local",
    query: "Pesquisar as palavras iniciais da razão social",
    match: "Exigir as palavras no título ou trecho e limitar oito atos",
    evidence: "Expor título, data, seção, página, trecho e link",
    implication: "Inferir ato federal e validar sua fase pelo conteúdo",
  },
};

const OBTENCAO = {
  "SEC-BNDES": {
    identificar: "O conector aponta o dataset público de operações de financiamento no CKAN do BNDES e escolhe o recurso CSV de operações não automáticas, descartando o arquivo de balcão automático.",
    acessar: "Faz HTTP GET no URL fixo do CSV, sem chave, com User-Agent do Radar, e grava o arquivo bruto em data/cache/bndes-nao-automaticas.csv.",
    extrair: "Lê o CSV em Windows-1252, separa colunas, normaliza CNPJ e mapeia contrato, datas, local, situação e valores para as colunas de enr_bndes.",
  },
  "SEC-CVM-IPE": {
    identificar: "O conector monta as URLs anuais ipe_cia_aberta_ANO.zip no diretório público de documentos IPE da CVM para 2025 e 2026.",
    acessar: "Baixa cada ZIP por HTTP GET sem autenticação, extrai o CSV com tar para data/cache/ipe-ANO e mantém o pacote local para reprocesso.",
    extrair: "Filtra só Fato Relevante e Comunicado ao Mercado e grava as 13 colunas do CSV em enr_cvm_ipe, inclusive espécie e tipo de apresentação.",
  },
  "SEC-SIGA": {
    identificar: "O conector usa o resource ID fixo do CSV diário do SIGA no CKAN da ANEEL, publicado como empreendimentos de geração.",
    acessar: "Baixa o CSV diário por HTTP GET sem chave para data/cache/siga-diario.csv e substitui a carga anterior na importação.",
    extrair: "Percorre as 23 colunas, extrai CNPJs do texto de participação e completa com o CSV mensal quando o nome do agente é o mesmo. Grava potências, garantia física, combustível, outorga, coordenadas, sub-bacia, vigência e entrada em operação em enr_siga.",
  },
  "SEC-IBAMA": {
    identificar: "O conector aponta o CSV público sislic-licencas no armazenamento de dados abertos do Ibama, publicado como licenças federais.",
    acessar: "Baixa o arquivo por HTTP GET sem login para data/cache/sislic.csv e registra a carga em base_carga.",
    extrair: "Lê as dez colunas do CSV, converte as datas e grava tipo, número, emissão, vencimento, empreendimento, titular, processo, tipologia, PAC e a geração do extrato em enr_sislic.",
  },
  "SEC-ANTT-INV": {
    identificar: "O conector mantém cinco URLs fixas de recursos CSV no CKAN da ANTT: cadastro, autorização, encerramento, PIP e concessionárias.",
    acessar: "Baixa cada CSV por HTTP GET sem chave para data/cache/antt-*.csv e trata os cinco arquivos como uma família da mesma fonte.",
    extrair: "Lê cada CSV linha a linha, guarda todas as colunas no payload, não trata processo SEI como CNPJ e grava as cinco séries em enr_registro. A consulta cruza cadastro, autorização e encerramento por id_sigicor.",
  },
  "SEC-ANTAQ-INST": {
    identificar: "O conector usa a URL confirmada do snapshot out_2022.csv em dados.transportes.gov.br, porque o endpoint mais novo da ANTAQ não responde.",
    acessar: "Baixa esse CSV estático por HTTP GET sem chave para data/cache/antaq-instalacoes.csv.",
    extrair: "Pula a linha de título, lê empresa autorizada, município, UF, tipo de instalação, carga e instrumento de outorga e substitui as linhas SEC-ANTAQ-INST em enr_registro.",
  },
  "SEC-ARTESP": {
    identificar: "O conector consulta package_show do CKAN da ARTESP no pacote programacao-de-obras e escolhe GeoJSON de obras CapEx; se não houver arquivo real, cai no template XLSX.",
    acessar: "Baixa o recurso escolhido e o de-para de rodovias do datastore público, sem chave, para data/cache/artesp.",
    extrair: "Lê features ou a aba Dados, mantém só CAPEX, REVIT e NS, resolve lote→concessionária e grava serviço, trecho e datas em enr_registro.",
  },
  "SEC-IAT": {
    identificar: "O conector aponta o FeatureServer público 00_PUBLICACOES/licencas_ambientais_sia_sga/FeatureServer/0 do IAT/PR.",
    acessar: "Consulta o serviço GIS por HTTP GET, página a página, sem arquivo em disco e sem autenticação.",
    extrair: "Lê atributos de titular, município, modalidade, atividade e datas e grava cada feição em enr_registro como SEC-IAT.",
  },
  "SEC-CNO": {
    identificar: "O sincronismo do dados.gov.br localiza o conjunto Cadastro Nacional de Obras, o ZIP de dados e o PDF do dicionário.",
    acessar: "Com TOKEN_DADOS_GOV só no catálogo, baixa o ZIP quando Last-Modified ou tamanho mudam e extrai todos os CSV. O PDF do dicionário fica como está depois da primeira carga.",
    extrair: "A extração grava cno.csv, cno_cnaes.csv, cno_vinculos.csv, cno_areas.csv e cno_totais.csv ao lado do ZIP. A ficha lê o cno.csv em latin1 e, para cada obra da amostra, acrescenta as linhas de área, CNAE e vínculo do mesmo CNO, além da contagem de cno_totais.csv.",
  },
  "SEC-ANP-EP": {
    identificar: "O conector abre a página pública da fase de exploração da ANP e descobre o href do CSV mensal mais recente de blocos sob contrato.",
    acessar: "Baixa esse CSV por HTTP GET sem chave para data/cache/anp-blocos.csv e substitui a carga anterior.",
    extrair: "Le as 22 colunas do CSV de blocos e grava em enr_registro como SEC-ANP-EP.",
  },
  "SEC-ANA-SNIRH": {
    identificar: "O conector aponta dois FeatureServers públicos do SNIRH: outorgas federais superficiais e outorgas estaduais superficiais.",
    acessar: "Na coleta da ficha, consulta as camadas ao vivo por HTTP GET, sem token e sem gravar resposta em data/cache.",
    extrair: "Filtra pelo empreendedor com máscara da raiz do CNPJ e lê empreendimento, responsável, município, UF, corpo d'água, ato, número, processo, vigência, validade, uso, finalidade, situação, vazão, volume e coordenada, até 6 registros por camada.",
  },

  "CAPTURA-SIGMINE": {
    identificar: "O conector monta a URL PROCESSOS_MINERARIOS/UF.zip a partir da UF da ficha no diretório SIGMINE da ANM.",
    acessar: "Baixa o ZIP estadual por HTTP GET sem chave para data/cache/sigmine e extrai a tabela DBF do pacote.",
    extrair: "Lê as 12 colunas do DBF. A evidência guarda processo, fase, titular, substância, uso, UF, área e último evento. Número, ano, identificador e o polígono do SHP permanecem no arquivo.",
  },

  "CAPTURA-ONS-PAR": {
    identificar: "O conector usa a URL do pacote 7z de apoio do PET/PELP ciclo 2025, 2º semestre, publicado pela EPE na página do plano de transmissão.",
    acessar: "Baixa o 7z, extrai a planilha XLSX para data/cache/ons e localiza as abas Empreendimentos_PET e Empreendimentos_PELP.",
    extrair: "Via Python/openpyxl, lê nome, tipo, UFs, necessidade e investimento em milhares de reais, multiplica por mil e grava em enr_registro.",
  },
  "CAPTURA-REIDI": {
    identificar: "O conector consulta package_show do CKAN do Ministério dos Transportes no pacote incentivo-fiscal-reidi e escolhe o CSV semestral mais novo que não seja dicionário.",
    acessar: "Baixa esse CSV por HTTP GET sem chave para data/cache/reidi.csv.",
    extrair: "Ignora o preâmbulo até o cabeçalho com CNPJ, decodifica Windows-1252 e mapeia empresa, UF, modal, investimento, ano, portaria e ADE para enr_registro.",
  },
  "SEC-ANP-CAMPO": {
    identificar: "O conector monta URLs mensais de producao_zona_MM-AAAA.csv e testa os meses mais recentes até achar um CSV válido da ANP.",
    acessar: "Baixa o mês encontrado para data/cache/anp-zona.csv e cruza operadores vindos das listas de plataforma, duto e instalação.",
    extrair: "Agrega pocos por campo, soma as 14 colunas de volume, conta pocos e zonas, anexa operador quando existir e grava as 20 colunas mais os derivados em enr_registro como SEC-ANP-CAMPO.",
  },
  "SEC-ANP-PLAT": {
    identificar: "O conector aponta a URL pública do CSV de plataformas e instalações marítimas em operação na ANP.",
    acessar: "Baixa o arquivo por HTTP GET sem chave para data/cache/anp-plataformas.csv.",
    extrair: "Le as 13 colunas do CSV de plataformas, inclusive lamina, escoamento, coordenada e capacidades, e substitui as linhas SEC-ANP-PLAT em enr_registro.",
  },
  "SEC-ANP-DUTO": {
    identificar: "O conector aponta a URL pública do CSV de códigos de dutos na lista da ANP.",
    acessar: "Baixa o arquivo por HTTP GET sem chave para data/cache/anp-dutos.csv.",
    extrair: "Le as 9 colunas do CSV de dutos, inclusive nao integrante e funcao umbilical, e substitui as linhas SEC-ANP-DUTO em enr_registro.",
  },
  "CAPTURA-QD": {
    identificar: "O conector resolve o município da ficha na API de localidades do IBGE para obter o territory_id usado pelo Querido Diário.",
    acessar: "Consulta ao vivo a API pública api.queridodiario.org.br com esse território, sem token e sem arquivo local.",
    extrair: "Busca a empresa ou o projeto no texto das edições e devolve data, município, trecho e URL do PDF, até o limite da coleta.",
  },
  "CAPTURA-SIGPUB": {
    identificar: "O conector escolhe pela UF da ficha os diários de associação na plataforma diariomunicipal.com.br, como amm-mg, amp ou apm.",
    acessar: "Abre a página pública /pesquisar de cada associação por HTTP GET, com texto, dataInicio e dataFim, sem chave e sem arquivo local.",
    extrair: "Lê cada li.materia-card e devolve título, entidade, órgão, trecho, data de circulação, edição, tipo do ato e link, ficando com as cinco mais relevantes.",
  },
  "CAPTURA-DOM-METAWAY": {
    identificar: "O conector acha a prefeitura da ficha no mapa METAWAY_MUNICIPIOS, pela UF e pelo município sem acento.",
    acessar: "Chama /recurso/diario/lista com a marca e o período, depois /recurso/diario/editar/{codigo} e baixa o PDF de srcPDF, sem chave.",
    extrair: "Converte o PDF em texto, acha a marca e devolve edição, data, trecho, tipo do ato, link do PDF e se o texto foi lido, para as seis edições mais recentes.",
  },
  "CAPTURA-DOE-BA": {
    identificar: "O conector monta a busca do DOOL com a raiz do CNPJ e o nome da empresa entre aspas e o período desde 2015.",
    acessar: "Chama /busca/busca/buscar/query/{pagina} por HTTPS com a cadeia intermediária embutida, sem chave, até duas páginas por termo.",
    extrair: "Lê hits.hits, junta o destaque de conteudo e devolve data, página, trecho, tipo do ato, município e link do visualizador, ficando com os oito mais relevantes.",
  },
  "CAPTURA-DOE-PR": {
    identificar: "O conector monta a busca do DIOE com a raiz do CNPJ e o nome da empresa entre aspas e o período desde 2015.",
    acessar: "Chama /busca/busca/buscar/query/{pagina} do DIOE por HTTPS, sem chave, até duas páginas por termo.",
    extrair: "Lê hits.hits, junta o destaque de conteudo e devolve data, página, trecho, tipo do ato, município e link do PDF da página, ficando com os oito mais relevantes.",
  },
  "CAPTURA-DOE-SP": {
    identificar: "O conector monta a busca avançada do DOE-SP com a raiz do CNPJ e depois com o nome, no período desde 2015.",
    acessar: "Chama a API v2/advanced-search/publications por HTTPS, sem chave, com até 100 atos por termo.",
    extrair: "Lê items, recorta o trecho no termo e devolve data, título, órgão, trecho, tipo do ato, município e link do ato, ficando com os oito mais relevantes.",
  },
  "CAPTURA-DOE-MG": {
    identificar: "O conector pede um token anônimo e monta a pesquisa paginada com a raiz do CNPJ e depois com o nome, desde 2015.",
    acessar: "Chama /api/v1/Pesquisa/PesquisarJornaisPaginados com o token, em todos os cadernos, por HTTPS com a cadeia intermediária embutida.",
    extrair: "Lê dados e devolve data, caderno, página, trecho, tipo do ato, município e link do visualizador, ficando com os oito mais relevantes.",
  },
  "SEC-SEMAD": {
    identificar: "O conector monta o filtro CQL nome_pf_pj ILIKE com as duas primeiras palavras da razão social.",
    acessar: "Chama o WFS GetFeature da camada ide_2101_mg_empreendimentos_licenciados_pto em GeoJSON, sem chave, com até 500 licenças.",
    extrair: "Lê as propriedades de cada feição e devolve processo, município, titular, solicitação, atividade, classe, modalidade, fase, status, datas, coordenada e link do SLA.",
  },
  "CAPTURA-DOU": {
    identificar: "O conector monta a URL de busca da Imprensa Nacional com as palavras iniciais da razão social da ficha.",
    acessar: "Abre a página HTML pública de in.gov.br por HTTP GET, sem chave e sem scraper do diário completo do dia.",
    extrair: "Lê o JSON embutido BuscaDouPortlet_params, filtra atos que citam a empresa, fica com os cinco mais recentes, abre a página de cada um e devolve título, data, seção, página, órgão, resumo, trecho e link.",
  },
};

const DESCRICOES = {
  "SEC-BNDES": "Linhas de financiamento, encontradas por CNPJ. CSV baixado e transformado em base, dados normalizados para facilitar a consulta. Por meio dessa fonte é possível observar se uma empresa pegou algum crédito no período do projeto, conseguindo descrição e localização do projeto.",
  "SEC-CVM-IPE": "Fatos relevantes e comunicados ao mercado de companhia aberta, encontrados por CNPJ. ZIPs anuais baixados e transformados em base, só com essas duas categorias e com as 13 colunas do CSV. Por meio dessa fonte é possível ver se a empresa anunciou investimento, contratação ou início de operação no período, com a espécie, a apresentação, a data e o link do documento. Na coleta, os cinco mais recentes com menos de um ano são convertidos em Markdown.",
  "SEC-SIGA": "Empreendimentos de geração, encontrados pelo CNPJ lido no texto de participação. CSV diário baixado e transformado em base, com as 23 colunas do dicionário. Por meio dessa fonte é possível ver se a empresa tem usina, a fase, o combustível, a potência outorgada e a fiscalizada, a garantia física, a coordenada, a vigência e o município.",
  "SEC-IBAMA": "Licenças e autorizações federais, encontradas pelas primeiras palavras da razão social. CSV baixado e transformado em base, com as dez colunas. Por meio dessa fonte é possível ver o nome completo do ato, a tipologia, o processo, o PAC e as datas.",
  "SEC-ANTT-INV": "Investimentos de concessão federal, encontrados pelo nome da concessionária. Cinco CSVs baixados e cruzados por id_sigicor. Por meio dessa fonte é possível ver a obra do PER, a autorização do projeto, o encerramento e o total anual.",
  "SEC-ANTAQ-INST": "Instalações portuárias, encontradas pelo nome da empresa autorizada. CSV de outubro de 2022 baixado e transformado em base. Por meio dessa fonte é possível saber se a empresa opera porto ou terminal e onde a instalação fica.",
  "SEC-IAT": "Licenças ambientais do Paraná, encontradas pelas primeiras palavras da razão social. Camada geográfica baixada em páginas e transformada em base. Por meio dessa fonte é possível ver a modalidade, a atividade, a emissão e a validade da licença no estado.",
  "SEC-CNO": "Cadastro da obra, localização do canteiro e status da obra, encontrado pela raiz do CNPJ. A fonte é consultada em tempo real com as linhas mais importantes sendo baixadas. Por meio dessa fonte é possível saber se a empresa tem alguma obra na localidade do projeto e qual o status da obra.",
  "SEC-ANP-EP": "Blocos de petroleo e gas em exploracao, encontrados pelas primeiras palavras da razao social no operador ou nos contratados. CSV mensal mais novo baixado e transformado em base, com as 22 colunas. Por meio dessa fonte e possivel saber se a empresa opera bloco, a area, o periodo, o PAD, as UTs e os pocos perfurados.",
  "SEC-ANA-SNIRH": "Outorgas de água superficial, encontradas pela raiz do CNPJ. Consulta ao vivo nas camadas federal e estadual, sem cópia nacional. Por meio dessa fonte é possível saber se a empresa tem captação, lançamento ou barragem, a finalidade, o corpo d'água, a vigência, a vazão em metros cúbicos por hora e o volume anual.",
  "CAPTURA-SIGMINE": "Processos minerários do estado do projeto, encontrados pelas primeiras palavras do nome do titular. ZIP da UF baixado na coleta e lido na hora. Por meio dessa fonte é possível ver a fase do título, a substância, o uso, a área e o último andamento, com código e data.",
  "CAPTURA-ONS-PAR": "Obras de transmissão previstas no plano, encontradas por palavras do nome do projeto e pela UF. Planilha do PET/PELP extraída e transformada em base. Por meio dessa fonte é possível ver a obra planejada na rede, o ano de necessidade e o investimento estimado.",
  "CAPTURA-REIDI": "Projetos de transporte habilitados ao incentivo, encontrados por CNPJ ou pelo nome da empresa. CSV semestral mais novo baixado e transformado em base. Por meio dessa fonte é possível ver o enquadramento, a portaria, o modal e o investimento informado.",
  "SEC-ANP-CAMPO": "Campos de petroleo e gas com producao no mes, encontrados pelo nome do operador ou do campo. CSV mensal baixado, agregado por campo, com as 20 colunas e as vazoes somadas. Por meio dessa fonte e possivel saber se o campo produz, com bacia, ambiente, pocos e volumes do mes.",
  "SEC-ANP-PLAT": "Plataformas em operacao, encontradas pelo nome do operador. CSV baixado e transformado em base, com as 13 colunas. Por meio dessa fonte e possivel saber se a empresa opera plataforma, a lamina, a coordenada, a capacidade e desde que ano.",
  "SEC-ANP-DUTO": "Dutos de exploracao e producao, encontrados pelo nome do operador. CSV baixado e transformado em base, com as 9 colunas. Por meio dessa fonte e possivel saber se a empresa opera duto, o tipo, se e integrante, a funcao do umbilical e a situacao.",
  "CAPTURA-QD": "Trechos de diário municipal, encontrados pelo nome da empresa ou do projeto no município da ficha. Consulta ao vivo, sem cópia local. Por meio dessa fonte é possível achar alvará, licença ou decreto local que mencione o projeto.",
  "CAPTURA-SIGPUB": "Matérias dos diários das associações de municípios, encontradas pelo CNPJ ou pelo nome da empresa na UF da ficha. Busca lida ao vivo, sem cópia local. Por meio dessa fonte é possível achar decreto, lei, alvará ou licença de prefeitura que cite a empresa, com o município primeiro.",
  "CAPTURA-DOM-METAWAY": "Edições do diário oficial da prefeitura, encontradas pela marca da empresa no município da ficha. Lista lida ao vivo e PDF aberto na hora. Por meio dessa fonte é possível achar decreto, permissão de uso ou doação municipal ligados à obra.",
  "CAPTURA-DOE-BA": "Páginas do Diário Oficial da Bahia, encontradas pela raiz do CNPJ ou pelo nome da empresa. Busca lida ao vivo, sem cópia local. Por meio dessa fonte é possível ver licença do INEMA, incentivo DESENVOLVE ou PROAUTO e contrato de terreno do estado.",
  "CAPTURA-DOE-PR": "Páginas do Diário Oficial do Paraná, encontradas pela raiz do CNPJ ou pelo nome da empresa. Busca lida ao vivo, sem cópia local. Por meio dessa fonte é possível ver súmula de licença, TAC e outorga do Instituto Água e Terra.",
  "CAPTURA-DOE-SP": "Atos do Diário Oficial de São Paulo, encontrados pela raiz do CNPJ ou pelo nome da empresa. Busca lida ao vivo, desde maio de 2023. Por meio dessa fonte é possível ver licença da CETESB, outorga do DAEE e autuação ambiental.",
  "CAPTURA-DOE-MG": "Trechos do Jornal Minas Gerais, encontrados pela raiz do CNPJ ou pelo nome da empresa. Busca lida ao vivo com token anônimo. Por meio dessa fonte é possível ver licença da SEMAD, decisão do COPAM, protocolo de intenção e incentivo do estado.",
  "SEC-SEMAD": "Licenças ambientais do SLA de Minas Gerais, encontradas pelas primeiras palavras da razão social. Camada WFS lida ao vivo. Por meio dessa fonte é possível ver a modalidade, a fase, a atividade, o status, a emissão e a validade da licença no estado.",
  "CAPTURA-DOU": "Atos do Diário Oficial da União, encontrados pelas primeiras palavras da razão social. Página de busca lida ao vivo, sem cópia local; ficam os cinco atos mais recentes, cada um com um resumo curto. Por meio dessa fonte é possível achar portaria, licença ou outorga publicada.",
  "SEC-ARTESP": "Programação de obras das concessões paulistas, encontrada pelo lote da concessionária e por palavras da rodovia, só em São Paulo. Arquivo do portal baixado e transformado em base. Por meio dessa fonte é possível ver a obra programada, o trecho e as datas, sem valor em reais.",
};

// Diários estaduais do registro: o guia sai dos fatos testados em cada portal.
const DOE_PLURAL = { página: "Páginas", matéria: "Matérias", edição: "Edições", "página do PDF": "Páginas" };
const DOE_LINHAS = {
  data: ["Data", "Dia da publicação do ato ou da edição."],
  pagina: ["Página", "Página da edição em que o termo aparece."],
  titulo: ["Título", "Título, tipo do ato ou nome da edição."],
  orgao: ["Órgão", "Órgão ou seção que publicou."],
  caderno: ["Caderno", "Parte ou caderno do diário."],
  trecho: ["Trecho", "Texto em volta do CNPJ ou do nome, até 400 caracteres."],
  url: ["Link", "Endereço do ato, da página ou do PDF da edição."],
};
for (const estado of DOE_ESTADOS) {
  const principal = estado.requisicoes[0];
  // PA, PB, RO e RR: sem busca no portal, a ficha lê o índice de PDFs que o sincronizador grava.
  const indice = estado.motor === "indice_pdf";
  const leitura = indice
    ? "Índice próprio dos PDFs, atualizado todo dia."
    : "Busca lida ao vivo, sem cópia local.";
  const resumo = `${DOE_PLURAL[estado.unidade]} do ${estado.nome}, encontradas pela raiz do CNPJ ou pelo nome da empresa. ${leitura} Por meio dessa fonte é possível ver ${estado.atos}.`;
  GUIDES[estado.codigo] = {
    nome: estado.nome,
    url: estado.portal,
    arquivo: indice
      ? `Tabelas doe_pdf_edicao e doe_pdf_pagina (sql/016). Exemplo bruto em amostras/${estado.codigo}/`
      : `Sem arquivo local. Exemplo bruto em amostras/${estado.codigo}/`,
    copia: indice
      ? `Texto de cada página dos PDFs do ${estado.uf}, gravado por npm run doe:pdf-sync e pelo agendador diário`
      : "Consulta ao vivo, sem tabela local",
    cargas: indice ? [estado.codigo] : [],
    resumo,
    informa: [
      `A busca devolve, para cada ${estado.unidade} que cita a empresa, ${estado.linhas.map((key) => DOE_LINHAS[key][0].toLowerCase()).join(", ")}. ${estado.acervo}`,
      `Serve para achar ${estado.atos}. A menção da empresa não basta: a fase e o vínculo com a obra só se confirmam lendo o ato.`,
    ],
    campos: estado.linhas.map((key) => DOE_LINHAS[key]),
    acesso: indice
      ? [
        `O portal não tem busca de texto. O sincronizador lista as edições em ${principal.url}, baixa cada PDF, extrai o texto de todas as páginas e grava no banco. O agendador repete isso todo dia para os últimos 7 dias.`,
        `Na coleta, o Radar escolhe o diário pela UF da ficha (${estado.uf}) e consulta o índice pela raiz do CNPJ e pelo nome da empresa, sem chamar o portal.`,
      ]
      : [
        `Na coleta, o Radar escolhe o diário pela UF da ficha (${estado.uf}) e chama ${principal.metodo} ${principal.url}, desde 2015, uma vez para a raiz do CNPJ e outra para o nome da empresa.`,
        principal.nota || "Sem chave nem login.",
      ],
    associacao: [
      "O Radar só guarda o ato que traz os dígitos da raiz do CNPJ ou todas as palavras do nome. Os do município da ficha vêm primeiro, depois licença, decreto e atos parecidos, e por último compras públicas.",
    ],
    alcance: estado.limitacoes,
  };
  DEEP_PROFILES[estado.codigo] = {
    modo: indice
      ? "Raiz do CNPJ e nome da empresa contra o texto das páginas dos PDFs indexados do diário da UF da ficha"
      : "Raiz do CNPJ com máscara e nome da empresa contra o texto do diário oficial da UF da ficha",
    status: "Licença, incentivo, desapropriação, outorga ou contrato citando a empresa pode marcar etapa da obra; a fase só se confirma lendo o ato.",
    acesso: indice
      ? `Na coleta, a ficha lê as tabelas doe_pdf_edicao e doe_pdf_pagina. O portal (${estado.modo.toLowerCase()}) só é chamado pelo sincronizador.`
      : `Na coleta ao vivo, a busca do diário (${estado.modo}) é chamada sem token, cache ou tabela.`,
    secundario: "A UF da ficha escolhe o diário; o município da ficha ordena os atos, e a correlação lê o contexto de cada um antes de virar evidência.",
    limite: estado.limitacoes.join(" "),
    fetch: indice ? `Baixar os PDFs do ${estado.nome} e extrair o texto de cada página` : `Chamar a busca pública do ${estado.nome}`,
    store: indice ? "Gravar o texto, o texto compacto e as raízes de CNPJ de cada página" : "Consultar ao vivo sem persistir atos localmente",
    query: indice ? "Buscar a raiz do CNPJ e o nome colado no índice da UF" : "Buscar a raiz do CNPJ e o nome da empresa desde 2015",
    match: "Exigir o CNPJ ou todas as palavras e ordenar pelo município",
    evidence: `Expor ${estado.linhas.map((key) => DOE_LINHAS[key][0].toLowerCase()).join(", ")}`,
    implication: "Inferir ato estadual ligado à obra, sujeito à leitura do contexto",
  };
  OBTENCAO[estado.codigo] = {
    identificar: `O conector escolhe o ${estado.nome} pela UF da ficha (${estado.uf}). Sem ficha nesse estado, a fonte não roda.`,
    acessar: indice
      ? `Consulta doe_pdf_pagina da UF ${estado.uf} pela raiz do CNPJ (raizes) e pelo nome colado (compacto). As páginas vêm de ${principal.metodo} ${principal.url} e do download de cada PDF, feitos pelo sincronizador.`
      : `Faz ${principal.metodo} em ${principal.url} com a raiz do CNPJ e depois com o nome, sem chave e sem arquivo local.`,
    extrair: `Lê cada ${estado.unidade} da resposta e devolve ${estado.linhas.map((key) => DOE_LINHAS[key][0].toLowerCase()).join(", ")}, tipo do ato e se cita o município da ficha.`,
  };
  DESCRICOES[estado.codigo] = resumo;
}

for (const [codigo, guide] of Object.entries(GUIDES)) {
  const profile = { ...DEEP_PROFILES[codigo], ...OBTENCAO[codigo] };
  const origem = sourceOrigin(codigo);
  if (!DEEP_PROFILES[codigo]) throw new Error(`Perfil profundo ausente para ${codigo}`);
  if (!OBTENCAO[codigo]) throw new Error(`Passos de obtenção ausentes para ${codigo}`);
  if (!origem?.links?.length) throw new Error(`Origem e links ausentes para ${codigo}`);
  guide.origem = origem;
  const originalInforma = guide.informa.join(" ");
  const originalAcesso = guide.acesso.join(" ");
  const originalAlcance = guide.alcance.join(" ");
  const indicePdf = doeEstado(codigo)?.motor === "indice_pdf";
  const frequencia = indicePdf
    ? "O agendador lê todo dia as edições dos últimos 7 dias; a carga inicial e reposições usam `npm run doe:pdf-sync -- --dias N --uf UF`. No enriquecimento da ficha o Radar lê o índice já gravado e não baixa PDF."
    : guide.cargas.length
      ? "A cópia local só muda quando a carga das bases roda de novo (`npm run db:load-bases` ou a carga dessa fonte). No enriquecimento da ficha o Radar lê a tabela já gravada e não baixa o arquivo outra vez."
      : "Não há dump completo em tabela local para esta fonte. Cada enriquecimento da ficha consulta a origem ao vivo, com timeout e limite de páginas ou registros definidos no conector.";
  guide.modo = profile.modo;
  guide.resumo = DESCRICOES[codigo] || guide.resumo;
  guide.informa = [
    originalInforma,
    profile.status,
    `No fluxo do Radar CapEx, o retorno desta fonte é evidência secundária para avaliar o estado do projeto: ${profile.implication.charAt(0).toLowerCase()}${profile.implication.slice(1)}. A comprovação materializa isso ao ${profile.evidence.charAt(0).toLowerCase()}${profile.evidence.slice(1)}.`,
  ];
  if (!profile.identificar || !profile.acessar || !profile.extrair) {
    throw new Error(`Passos de obtenção incompletos para ${codigo}`);
  }
  guide.acesso = [
    profile.identificar,
    profile.acessar,
    profile.extrair,
    profile.acesso,
    originalAcesso,
    frequencia,
    `Publicação original: ${guide.url}. Cópia usada na coleta: ${guide.copia}.${guide.arquivo ? ` Arquivo ou pasta de apoio: ${guide.arquivo}.` : ""}`,
  ];
  guide.associacao = [
    `Modo principal: ${profile.modo}. É a chave que a consulta usa primeiro para achar a empresa. Achar a empresa não basta: registro de outra UF sai, e o contexto de cada registro decide se ele é deste projeto (veja a regra de correlação direta abaixo).`,
    `${guide.associacao.join(" ")} ${profile.secundario}`,
  ];
  guide.alcance = [
    originalAlcance,
    profile.limite,
    "A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.",
  ];
  guide.fluxo = [
    `Identificar a origem: ${profile.identificar}`,
    `Acessar a fonte: ${profile.acessar}`,
    `Extrair os dados: ${profile.extrair}`,
    `Materializar a cópia: ${profile.store}`,
    guide.cargas.length
      ? "Registrar a carga em base_carga e deixar a cópia local pronta para a coleta da ficha"
      : "Entregar os registros lidos ao vivo à coleta da ficha, sem gravar dump nacional",
  ];
}

const EXTRAIDO = {
  "SEC-BNDES": {
    extras: [
      ["abertos", "número", "Quantos contratos não estão com situação liquidada."],
      ["no_periodo", "número", "Quantos foram contratados dentro da janela de 18 meses."],
    ],
    linhas: [
      ["numero_contrato", "texto", "Identificador da operação no BNDES."],
      ["data_contratacao", "data AAAA-MM-DD", "Data de contratação. O campo some se o BNDES não informar."],
      ["uf", "texto", "Sigla do estado do projeto financiado."],
      ["municipio", "texto", "Município informado pelo BNDES."],
      ["descricao", "texto", "Texto livre do que o contrato diz financiar."],
      ["situacao_contrato", "texto", "Situação, por exemplo ativo ou liquidado."],
      ["valor_contratado", "número em reais", "Valor contratado. O Postgres entrega este número como texto."],
    ],
  },
  "SEC-CVM-IPE": {
    extras: [
      ["no_periodo", "número", "Quantos documentos têm data de referência dentro da janela de 18 meses."],
    ],
    linhas: [
      ["assunto", "texto", "Assunto informado pela companhia no documento."],
      ["data_referencia", "data AAAA-MM-DD", "Data de referência do documento."],
      ["data_entrega", "data AAAA-MM-DD", "Data de entrega ou recebimento do documento."],
      ["categoria", "texto", "Fato Relevante ou Comunicado ao Mercado."],
      ["tipo", "texto", "Tipo dentro da categoria. Vazio quando a CVM não preenche."],
      ["especie", "texto", "Espécie do documento. Nas duas categorias, declaração de aquisição ou de alienação de participação relevante, quando existe."],
      ["tipo_apresentacao", "texto", "AP apresentação, RE reapresentação espontânea ou RC reapresentação por exigência."],
      ["link", "texto", "Endereço do arquivo no site da CVM."],
      ["texto", "markdown", "Trecho do documento convertido. Entra nos cinco mais recentes, com entrega há menos de um ano."],
    ],
  },
  "SEC-SIGA": {
    linhas: [
      ["cod_ceg", "texto", "Código único do empreendimento de geração."],
      ["nucleo_ceg", "texto", "Núcleo de seis dígitos dentro do CEG."],
      ["nome", "texto", "Nome da usina ou empreendimento."],
      ["uf", "texto", "Sigla do estado da usina."],
      ["tipo_geracao", "texto", "Sigla do tipo, como UHE, UTE, EOL, UFV, PCH ou CGH."],
      ["fase", "texto", "Fase no SIGA, como operação ou construção."],
      ["origem_combustivel", "texto", "Origem da fonte, como Hídrica, Solar, Fóssil ou Biomassa."],
      ["fonte_combustivel", "texto", "Tipo da fonte, como Potencial hidráulico ou Petróleo."],
      ["nome_fonte", "texto", "Combustível ou fonte específica."],
      ["tipo_outorga", "texto", "Registro, autorização ou concessão."],
      ["potencia_kw", "número", "Potência outorgada ou registrada, em quilowatts."],
      ["potencia_fiscalizada_kw", "número", "Potência em operação, em quilowatts. Zero enquanto não opera."],
      ["garantia_fisica_kw", "número", "Garantia física homologada pelo Ministério de Minas e Energia, em quilowatts. Ausente quando o arquivo traz só vírgula e zeros."],
      ["geracao_qualificada", "texto", "Sim, Não ou vazio, pelo enquadramento da Resolução Normativa 235/2006."],
      ["latitude", "número", "Latitude do centróide, em grau decimal."],
      ["longitude", "número", "Longitude do centróide, em grau decimal."],
      ["municipios", "texto", "Municípios e UFs do empreendimento."],
      ["sub_bacia", "texto", "Código e nome da sub-bacia. Preenchida nas hídricas."],
      ["participacao", "texto", "Percentual, agente e regime de exploração."],
      ["cnpjs", "lista", "CNPJs lidos no texto de participação."],
      ["cnpj_edicao", "data AAAA-MM-DD", "Data do CSV mensal de onde o CNPJ foi recuperado. Vazio quando o próprio arquivo diário trouxe o número."],
      ["entrada_operacao", "data AAAA-MM-DD", "Entrada da primeira unidade geradora. Vazio quando o arquivo traz 1900-01-03."],
      ["inicio_vigencia", "data AAAA-MM-DD", "Início da vigência da outorga, quando existe."],
      ["fim_vigencia", "data AAAA-MM-DD", "Fim da vigência da outorga, quando existe."],
      ["gerado_em", "data AAAA-MM-DD", "Data em que a ANEEL gerou o arquivo diário."],
      ["no_periodo", "booleano", "Verdadeiro se a entrada cai na janela de 18 meses."],
    ],
  },
  "SEC-IBAMA": {
    linhas: [
      ["tipo_licenca", "texto", "Nome completo do ato, como o CSV grava. Não é a sigla LP, LI ou LO."],
      ["numero_licenca", "texto", "Número da licença ou da autorização."],
      ["data_emissao", "data AAAA-MM-DD", "Data de emissão. Vazia quando o CSV não traz."],
      ["data_vencimento", "data AAAA-MM-DD", "Data de vencimento. Vazia quando o CSV não traz."],
      ["empreendimento", "texto", "Nome da atividade ou do empreendimento."],
      ["pessoa", "texto", "Nome do empreendedor. Não há CNPJ nesta coluna."],
      ["processo", "texto", "Número do processo no Ibama."],
      ["tipologia", "texto", "Tipo de atividade, um dos valores de DES_TIPOLOGIA."],
      ["pac", "texto", "Sim ou No, como o CSV grava a coluna PAC."],
      ["atualizado_em", "data e hora", "Geração do extrato, igual em todas as linhas."],
      ["no_periodo", "booleano", "Verdadeiro se a emissão cai na janela de 18 meses."],
    ],
  },
  "SEC-ANTT-INV": {
    linhas: [
      ["codigo", "texto", "Planilha de origem: cadastro, autorização, encerramento, PIP ou série anual."],
      ["id_sigicor", "texto", "Chave do SIGICOR. Junta cadastro, autorização e encerramento."],
      ["concessionaria", "texto", "Nome da concessionária no arquivo. Não há CNPJ."],
      ["titulo", "texto", "Descrição da obra, título do PIP ou ano da série."],
      ["uf", "texto", "UF da rodovia ou o estado do PIP."],
      ["valor", "número em reais", "Valor contratual do cadastro ou total anual da série."],
      ["autorizacoes", "lista", "Linhas da autorização com o mesmo id_sigicor."],
      ["encerramentos", "lista", "Linhas do encerramento com o mesmo id_sigicor."],
      ["serie", "lista", "Totais anuais da mesma concessionária na planilha de investimentos."],
    ],
  },
  "SEC-ANTAQ-INST": {
    linhas: [
      ["codigo", "texto", "Sempre SEC-ANTAQ-INST nesta fonte."],
      ["titulo", "texto", "Nome da empresa autorizada."],
      ["uf", "texto", "Sigla do estado da instalação."],
      ["municipio", "texto", "Município da instalação."],
      ["valor", "número", "Quase sempre ausente: o cadastro não é uma obra com valor."],
    ],
  },
  "SEC-ARTESP": {
    linhas: [
      ["titulo", "texto", "Concessionária e descrição da obra programada, juntos."],
      ["lote", "texto", "Código do lote da concessão, como L22."],
      ["concessionaria", "texto", "Nome da concessionária associado ao lote."],
      ["rodovia", "texto", "Código da rodovia no padrão ARTESP."],
      ["rodovia_nome", "texto", "Nome público da rodovia vindo do de-para. Ausente se o código não estiver na tabela."],
      ["programa", "texto", "Tipo do programa: CAPEX, REVIT ou obra por nível de serviço (NS)."],
      ["detalhamento_servico", "texto", "Descrição do serviço programado."],
      ["km_inicial", "texto", "Quilômetro inicial do trecho. O Postgres entrega este número como texto."],
      ["km_final", "texto", "Quilômetro final do trecho. O Postgres entrega este número como texto."],
      ["data_inicial", "texto", "Data de início prevista, no formato que o arquivo trouxe."],
      ["data_final", "texto", "Data de término prevista, no formato que o arquivo trouxe."],
    ],
  },
  "SEC-IAT": {
    linhas: [
      ["codigo", "texto", "Sempre SEC-IAT nesta fonte."],
      ["titulo", "texto", "Nome de quem pediu a licença ou do empreendimento."],
      ["uf", "texto", "Sigla do estado, em geral PR."],
      ["municipio", "texto", "Município da licença no Paraná."],
    ],
  },
  "SEC-CNO": {
    extras: [
      ["total_raiz", "número", "Obras da mesma raiz de CNPJ, matriz e filiais juntas."],
      ["no_uf", "número", "Quantas dessas obras estão no estado da ficha."],
      ["no_municipio", "número", "Quantas estão no município da ficha."],
      ["mesmo_cnpj", "número", "Quantas estão no CNPJ exato, sem outras filiais."],
      ["no_periodo", "número", "Quantas têm início dentro da janela de 18 meses."],
      ["totais", "objeto", "Contagem de cno_totais.csv da edição lida: obras, cnaes, areas e vinculos, como o arquivo publicou."],
    ],
    linhas: [
      ["cno", "texto", "Número da inscrição da obra."],
      ["ni", "texto", "CNPJ de quem inscreveu a obra, só dígitos."],
      ["municipio", "texto", "Nome do município da obra."],
      ["uf", "texto", "Sigla do estado da obra."],
      ["area", "texto", "Área total como veio no arquivo da Receita."],
      ["situacao", "texto", "Código da Receita: 01 nula, 02 ativa, 14 paralisada, 03 suspensa, 15 encerrada."],
      ["inicio", "data AAAA-MM-DD", "Data de início da obra."],
      ["empresa", "texto", "Nome empresarial do responsável."],
      ["nome", "texto", "Nome da obra em cno.csv."],
      ["qualificacao", "código de 4 dígitos", "Qualificação do responsável em cno.csv: 0053 construtora, 0057 dono da obra, 0064 incorporador, 0070 proprietário do imóvel, 0109 consórcio, 0110 construção em nome coletivo, 0111 sociedade líder de consórcio."],
      ["papel", "texto", "Nome da qualificação, lido a partir do código."],
      ["cno_vinculado", "texto", "Outra inscrição ligada a esta, quando cno.csv traz."],
      ["data_situacao", "data AAAA-MM-DD", "Data da situação atual em cno.csv."],
      ["areas", "lista", "Linhas de cno_areas.csv desta inscrição: categoria, destinação, tipo de obra, tipo de área, tipo complementar e metragem."],
      ["cnaes", "lista", "Linhas de cno_cnaes.csv desta inscrição: CNAE de 7 dígitos e data de registro."],
      ["vinculos", "lista", "Linhas de cno_vinculos.csv desta inscrição: início, fim, registro, qualificação, papel e NI. Fim vazio significa vínculo aberto."],
    ],
  },
  "SEC-ANP-EP": {
    linhas: [
      ["BLOCO", "texto", "Nome do bloco sob contrato de exploracao."],
      ["CONTRATO", "texto", "Numero do contrato de exploracao."],
      ["OPERADOR", "texto", "Empresa que opera o bloco."],
      ["CONTRATADOS", "texto", "Demais empresas do contrato, com percentual no texto."],
      ["AMBIENTE", "texto", "Terra ou mar."],
      ["BACIAS AGRUPADAS", "texto", "Agrupamento de bacias publicado pela ANP."],
      ["BACIA", "texto", "Nome da bacia sedimentar."],
      ["ÁREA (MIL km²)", "numero", "Area do bloco em mil quilometros quadrados."],
      ["RODADA", "texto", "Rodada de licitacao de origem."],
      ["REGIME CONTRATUAL", "texto", "Concessao, Partilha ou OPartilha."],
      ["PERÍODO", "texto", "Periodo exploratorio vigente."],
      ["PRESENÇA PAD", "texto", "Se houve ou ha PAD no bloco."],
      ["DATA ASSINATURA CONTRATO", "data", "Data de assinatura do contrato."],
      ["DATA INÍCIO SUSPENSÃO", "data", "Inicio da suspensao, quando existe."],
      ["1º PE VENCIMENTO", "data", "Vencimento do primeiro periodo exploratorio."],
      ["2º PE VENCIMENTO", "data", "Vencimento do segundo periodo, quando existe."],
      ["3º PE VENCIMENTO", "data", "Vencimento do terceiro periodo, quando existe."],
      ["ÚLTIMO PAD VENCIMENTO", "data", "Vencimento do ultimo PAD, quando existe."],
      ["FASE EXPLORATÓRIA VENCIMENTO", "data", "Vencimento da fase exploratoria."],
      ["UTs COMPROMISSADAS", "texto", "Unidades de trabalho comprometidas."],
      ["QTD POÇOS PERFURADOS", "texto", "Quantidade de pocos perfurados."],
      ["POÇOS PERFURADOS", "texto", "Lista dos pocos perfurados."],
    ],
  },
  "SEC-ANA-SNIRH": {
    linhas: [
      ["empreendimento", "texto", "Nome do empreendimento na outorga."],
      ["responsavel", "texto", "Quem responde pela outorga."],
      ["cnpj", "texto", "CPF ou CNPJ como a ANA grava, com pontuação."],
      ["municipio", "texto", "Município do ponto de uso."],
      ["uf", "texto", "Sigla da UF do município."],
      ["corpo", "texto", "Nome do corpo d'água."],
      ["ato", "texto", "Tipo do ato, como resolução ou portaria."],
      ["numero_ato", "texto", "Número do ato."],
      ["processo", "texto", "Número do processo administrativo."],
      ["inicio", "data", "Início da vigência, já convertido para AAAA-MM-DD."],
      ["fim", "data", "Fim da vigência, já convertido para AAAA-MM-DD."],
      ["valida", "booleano", "Verdadeiro quando outorga_valida é 1."],
      ["uso", "texto", "Captação, lançamento, barragem ou outro tipo."],
      ["finalidade", "texto", "Finalidade, como indústria ou irrigação."],
      ["situacao", "texto", "Situação da interferência, como Operação."],
      ["vazao_media_m3h", "número", "Vazão média em metros cúbicos por hora."],
      ["vazao_maxima_m3h", "número", "Vazão máxima em metros cúbicos por hora."],
      ["volume_anual_m3", "número", "Volume anual em metros cúbicos."],
      ["latitude", "número", "Latitude do ponto."],
      ["longitude", "número", "Longitude do ponto."],
      ["esfera", "texto", "federal ou estadual, conforme a camada consultada."],
    ],
  },

  "CAPTURA-SIGMINE": {
    linhas: [
      ["processo", "texto", "Número/ano do processo minerário, como a coluna PROCESSO."],
      ["fase", "texto", "Fase do título, como requerimento de lavra ou concessão de lavra."],
      ["titular", "texto", "Nome de quem detém o processo, coluna NOME."],
      ["substancia", "texto", "Substância requerida, coluna SUBS."],
      ["uso", "texto", "Uso declarado, coluna USO."],
      ["uf", "texto", "Sigla do estado do processo, coluna UF."],
      ["area_ha", "texto", "Área em hectares, coluna AREA_HA, com 8 decimais."],
      ["ultimo_evento", "texto", "Código, descrição e data do último andamento, coluna ULT_EVENTO."],
    ],
  },

  "CAPTURA-ONS-PAR": {
    linhas: [
      ["titulo", "texto", "Nome da obra no plano, como SE ou trecho de linha."],
      ["uf", "texto", "Sigla do estado de origem."],
      ["valor", "número em reais", "Investimento estimado. A planilha traz milhares de reais; a evidência multiplica por 1000."],
      ["tipo", "texto", "Tipo do empreendimento, como SE para subestação ou SECC LT para seccionamento de linha."],
      ["necessidade", "texto", "Ano em que o plano marca a necessidade da obra."],
    ],
  },
  "CAPTURA-REIDI": {
    linhas: [
      ["titulo", "texto", "Razão social do titular habilitado."],
      ["uf", "texto", "Sigla do estado. Some se a planilha trouxer mais de uma UF na mesma célula."],
      ["valor", "número em reais", "Investimento informado na planilha."],
      ["modal", "texto", "Modal, como rodovia ou ferrovia."],
      ["ano", "texto", "Ano em que o projeto foi aprovado."],
      ["portaria", "texto", "Portaria citada na linha."],
      ["contrato", "texto", "Contrato ou concessão a que o enquadramento se refere."],
    ],
  },
  "SEC-ANP-CAMPO": {
    linhas: [
      ["Campo", "texto", "Nome do campo que produziu no mes."],
      ["Bacia", "texto", "Nome da bacia sedimentar."],
      ["Ambiente", "texto", "Ambiente da producao: terra ou mar."],
      ["Data", "texto", "Data do mes de producao, como veio no CSV."],
      ["pocos", "numero", "Linhas de poco-zona agregadas neste campo."],
      ["zonas", "numero", "Zonas distintas do campo neste mes."],
      ["operador", "texto", "Empresas ligadas ao campo pelas listas da ANP."],
      ["Óleo (m³/d)", "numero", "Soma do oleo do mes, em metros cubicos por dia."],
      ["Condensado (m³/d)", "numero", "Soma do condensado do mes."],
      ["Petróleo (m³/d)", "numero", "Soma do petroleo do mes."],
      ["Gás associado (Mil m³/d)", "numero", "Soma do gas associado do mes."],
      ["Gás não associado (Mil m³/d)", "numero", "Soma do gas nao associado do mes."],
      ["Gás total (Mil m³/d)", "numero", "Soma do gas total do mes."],
      ["Água (m³/d)", "numero", "Soma da agua produzida no mes."],
      ["Água injetada para descarte (m³/d)", "numero", "Soma da agua injetada para descarte."],
      ["Água injetada para rec. secundária (m³/d)", "numero", "Soma da agua injetada para recuperacao secundaria."],
      ["Vapor injetado (t/d)", "numero", "Soma do vapor injetado."],
      ["Gás injetado (Mil m³/d)", "numero", "Soma do gas injetado."],
      ["CO2 injetado (Mil m³/d)", "numero", "Soma do dioxido de carbono injetado."],
      ["N2 injetado (Mil m³/d)", "numero", "Soma do nitrogenio injetado."],
      ["Outros fluidos injetados (m³/d)", "numero", "Soma dos outros fluidos injetados."],
    ],
  },
  "SEC-ANP-PLAT": {
    linhas: [
      ["SIGLA DA INSTALAÇÃO", "texto", "Sigla da plataforma ou instalacao."],
      ["NOME DA INSTALAÇÃO", "texto", "Nome da unidade."],
      ["CAMPOS", "texto", "Campos ligados a plataforma."],
      ["BACIA", "texto", "Nome da bacia sedimentar."],
      ["OPERADOR", "texto", "Empresa que opera a unidade."],
      ["CLASSIFICAÇÃO", "texto", "Tipo da unidade, como FPSO ou jaqueta."],
      ["LÂMINA D'ÁGUA (m)", "numero", "Lamina d'agua em metros."],
      ["SISTEMA DE ESCOAMENTO", "texto", "Sistema de escoamento informado."],
      ["ANO DE INÍCIO DE OPERAÇÃO", "texto", "Ano de inicio de operacao."],
      ["LATITUDE", "coordenada", "Latitude da unidade."],
      ["LONGITUDE", "coordenada", "Longitude da unidade."],
      ["CAPACIDADE DE PRODUÇÃO DE PETRÓLEO (bbl/d)", "numero", "Capacidade nominal de petroleo."],
      ["CAPACIDADE DE PRODUÇÃO DE GÁS NATURAL (Mil m³/d)", "numero", "Capacidade nominal de gas natural."],
    ],
  },
  "SEC-ANP-DUTO": {
    linhas: [
      ["Nome", "texto", "Nome ou codigo operacional do duto."],
      ["Código DPP", "texto", "Codigo do duto na lista."],
      ["Não Integrante?", "texto", "Marca se o duto nao integra o sistema do campo."],
      ["Campo Integrante", "texto", "Campo de producao ligado ao duto."],
      ["Tipo", "texto", "Tipo, como oleoduto, multifasico ou umbilical."],
      ["Classificação do Sistema", "texto", "Coleta da producao, escoamento ou outra classe."],
      ["Operador", "texto", "Quem opera o duto."],
      ["Função Umbilical", "texto", "Funcao do umbilical, quando o tipo e umbilical."],
      ["Situação", "texto", "Situacao no cadastro, como em operacao ou em construcao."],
    ],
  },
  "CAPTURA-QD": {
    linhas: [
      ["data", "data AAAA-MM-DD", "Dia da edição do diário municipal."],
      ["municipio", "texto", "Nome do município da edição."],
      ["trecho", "texto", "Pedaço do texto encontrado, no máximo 240 caracteres, sem marcação HTML."],
      ["url", "texto", "Link do PDF da edição."],
    ],
  },
  "CAPTURA-SIGPUB": {
    linhas: [
      ["titulo", "texto", "Título da matéria, como decreto, lei ou extrato."],
      ["entidade", "texto", "Prefeitura, câmara ou consórcio que publicou."],
      ["orgao", "texto", "Secretaria ou setor que assinou a matéria."],
      ["trecho", "texto", "Pedaço do texto com o termo, no máximo 300 caracteres."],
      ["data", "data AAAA-MM-DD", "Dia de circulação da edição."],
      ["edicao", "texto", "Número da edição do diário da associação."],
      ["url", "texto", "Link da matéria em diariomunicipal.com.br."],
      ["tipo_ato", "texto", "ato_relevante, compra_publica ou outro, pelo título, órgão e trecho."],
      ["no_municipio", "sim ou não", "Diz se a entidade que publicou é do município da ficha."],
    ],
  },
  "CAPTURA-DOM-METAWAY": {
    linhas: [
      ["data", "data AAAA-MM-DD", "Dia de publicação da edição."],
      ["edicao", "número", "Número da edição do diário municipal."],
      ["trecho", "texto", "Texto do PDF em volta da marca, cerca de 320 caracteres."],
      ["tipo_ato", "texto", "ato_relevante, compra_publica ou outro, pelo trecho."],
      ["url", "texto", "Link do PDF da edição."],
      ["texto_lido", "sim ou não", "Diz se o PDF foi baixado e lido."],
    ],
  },
  "CAPTURA-DOE-BA": {
    linhas: [
      ["data", "data AAAA-MM-DD", "Dia da edição do Diário Oficial da Bahia."],
      ["pagina", "texto", "Número da página na edição."],
      ["trecho", "texto", "Destaque da busca com o termo, no máximo 400 caracteres."],
      ["url", "texto", "Visualizador da edição aberto na página."],
      ["tipo_ato", "texto", "ato_relevante, compra_publica ou outro, pelo trecho."],
      ["no_municipio", "sim ou não", "Diz se o trecho cita o município da ficha."],
    ],
  },
  "CAPTURA-DOE-PR": {
    linhas: [
      ["data", "data AAAA-MM-DD", "Dia da edição do Diário Oficial do Paraná."],
      ["pagina", "texto", "Número da página na edição."],
      ["trecho", "texto", "Destaque da busca com o termo, no máximo 400 caracteres."],
      ["url", "texto", "Link do PDF da página."],
      ["tipo_ato", "texto", "ato_relevante, compra_publica ou outro, pelo trecho."],
      ["no_municipio", "sim ou não", "Diz se o trecho cita o município da ficha."],
    ],
  },
  "CAPTURA-DOE-SP": {
    linhas: [
      ["data", "data AAAA-MM-DD", "Dia da publicação do ato."],
      ["titulo", "texto", "Título do ato no DOE-SP."],
      ["orgao", "texto", "Hierarquia do órgão que publicou."],
      ["trecho", "texto", "Título e texto em volta do termo, no máximo 400 caracteres."],
      ["url", "texto", "Página do ato no portal do DOE-SP."],
      ["tipo_ato", "texto", "ato_relevante, compra_publica ou outro, pelo trecho."],
      ["no_municipio", "sim ou não", "Diz se o trecho cita o município da ficha."],
    ],
  },
  "CAPTURA-DOE-MG": {
    linhas: [
      ["data", "data AAAA-MM-DD", "Dia da edição do Jornal Minas Gerais."],
      ["caderno", "texto", "Diário do Executivo, dos Municípios ou de Terceiros."],
      ["pagina", "número", "Número da página no caderno."],
      ["trecho", "texto", "Texto em volta do termo, como a API devolve."],
      ["url", "texto", "Visualizador da edição aberto na página."],
      ["tipo_ato", "texto", "ato_relevante, compra_publica ou outro, pelo trecho."],
      ["no_municipio", "sim ou não", "Diz se o trecho cita o município da ficha."],
    ],
  },
  "SEC-SEMAD": {
    linhas: [
      ["processo", "texto", "Número do processo no SLA."],
      ["municipio", "texto", "Município da solicitação."],
      ["titular", "texto", "Nome do titular da licença."],
      ["atividade", "texto", "Código e descrição da atividade principal."],
      ["modalidade", "texto", "LAC1, LAC2, LAS ou outra modalidade."],
      ["fase", "texto", "LP, LI, LO ou combinação."],
      ["status", "texto", "Situação do processo, como Concluído Deferido."],
      ["emissao", "data AAAA-MM-DD", "Data de emissão da licença."],
      ["validade", "data AAAA-MM-DD", "Data de validade da licença."],
      ["url", "texto", "Link de visitante do processo no SLA."],
      ["no_municipio", "sim ou não", "Diz se a licença é do município da ficha."],
    ],
  },
  "CAPTURA-DOU": {
    linhas: [
      ["titulo", "texto", "Título do ato, sem marcação HTML."],
      ["data", "data DD/MM/AAAA", "Data da publicação, no formato do Diário Oficial."],
      ["secao", "texto", "Seção: DO1, DO2 ou DO3."],
      ["pagina", "texto", "Número da página na edição."],
      ["trecho", "texto", "Título e começo do ato, no máximo 240 caracteres."],
      ["url", "texto", "Link da publicação em in.gov.br."],
      ["orgao", "texto", "Órgão que assina o ato, lido no cabeçalho da página da publicação."],
      ["resumo", "texto", "Uma ou duas frases sobre o que o ato faz com a empresa, escritas a partir do texto integral. Sem modelo, é o trecho em volta do nome da empresa."],
      ["texto_lido", "sim ou não", "Diz se a página do ato foi aberta. Quando falha, o resumo sai do trecho da busca."],
    ],
  },
};

function sourceGuide(codigo) {
  const { NATIVE } = require("./source-native");
  const guide = GUIDES[codigo];
  if (!guide) return null;
  return { ...guide, extraido: NATIVE[codigo] || null };
}

function sourceGuides() {
  return GUIDES;
}

module.exports = { sourceGuide, sourceGuides };
