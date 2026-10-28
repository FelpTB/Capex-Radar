// Documentação detalhada das fontes estaduais e municipais: como o dado aparece na origem,
// as chamadas que o Radar faz, o passo a passo da extração e a correlação com o projeto.
// Cada item segue o código do conector; ao mudar o conector, mude o texto aqui.

const { DOE_ESTADOS } = require("./doe-registry");

const req = (metodo, url, parametros, nota) => ({ metodo, url, parametros, nota });
const param = (nome, valor, funcao) => [nome, valor, funcao];

// Vale para toda fonte de enriquecimento. Código em src/enrichment/correlacao.js.
const REGRA_CORRELACAO = [
  "A busca acha registros da empresa, pelo CNPJ ou pelo nome. Isso não basta: a mesma empresa tem outras plantas, minas, filiais e obras. Um registro só vira evidência da ficha quando tem correlação direta com o projeto.",
  "1. Corte por estado, sem modelo. Registro com UF diferente da UF da ficha é descartado como outro_estado. Uma licença do Paraná não comprova uma obra em Minas Gerais, mesmo sendo da mesma empresa.",
  "2. Ordem por município. Os registros que citam o município da ficha vão primeiro para a leitura. Até 60 registros por fonte são lidos; o que passa disso conta como não avaliado e não vira evidência.",
  "3. Leitura do contexto. O modelo recebe o nome, o nicho, o município e a UF do projeto e, para cada registro, o texto em volta do CNPJ ou do nome (até 1.500 caracteres) e os campos estruturados. Ele classifica cada registro como direta, outro_projeto ou incerta. Município, atividade, objeto e empreendimento citados no texto pesam mais que o nome da empresa.",
  "4. Só direta vira evidência. outro_projeto e incerta ficam fora. Na dúvida, fica fora. As contagens da anotação (por exemplo \"Foram achados 3 trechos\") passam a contar só os registros diretos.",
  "5. Rastro. A evidência guarda em campos_extraidos.correlacao quantos registros foram avaliados e quantos saíram por motivo, e cada linha mantida traz em correlacao a frase que justifica o vínculo.",
  "6. Sem modelo. Se a chave da OpenAI faltar ou a chamada falhar, o filtro cai para o município da ficha: só passa registro com município igual ao do projeto. O método usado fica gravado em correlacao.metodo (contexto ou municipio).",
  "7. Limpeza. Se uma fonte consultada com sucesso não tiver nenhum registro direto, a evidência secundária antiga dessa fonte na ficha é apagada. Erro de rede não apaga nada.",
];

const DOOL_FORMATO = (diario, exemplo) => [
  `O ${diario} não publica uma API documentada. A busca do portal chama um Elasticsearch, e o Radar lê a mesma resposta JSON que a página usa.`,
  "O envelope é o padrão do Elasticsearch: took, timed_out, _shards e hits. Em hits vêm total (quantas páginas do diário têm o termo), max_score e a lista hits.hits.",
  "Cada item de hits.hits é uma página inteira de uma edição, não um ato. _id junta edição e página (21987_41 é a página 41 da edição 21987). _source.conteudo traz o texto corrido da página toda, já sem quebras, com todos os atos daquela página misturados. _source traz também data (AAAA-MM-DD), pagina, paginas, diario_id, pdf_id, year, month, day e tipo_edicao.",
  "highlight.conteudo é uma lista de frases da página em HTML, com o termo buscado em <strong>. É a parte que interessa: mostra onde o CNPJ ou o nome aparece.",
  exemplo,
  "O CNPJ aparece no texto com pontos (50.351.104/0001-10), com espaços ou sem separador, conforme o órgão que publicou. Por isso a busca usa a raiz com máscara e o filtro compara só os dígitos.",
];

const DOOL_PASSOS = (link) => [
  "Monta os termos: a raiz do CNPJ com máscara (XX.XXX.XXX) e o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI), quando tem pelo menos quatro letras. Cada termo vai entre aspas, para buscar a frase.",
  "Para cada termo, chama a busca na página 0. Se vierem 10 resultados, chama também a página 1. São no máximo 20 páginas do diário por termo, 40 no total.",
  "Para cada resultado, junta as frases de highlight.conteudo com \" … \" e tira o HTML. Sem destaque, usa _source.conteudo.",
  "Recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Em lista corrida, o que vem antes do termo é outro registro, então o recorte começa só 1/5 da janela antes.",
  "Guarda também um contexto de 1.200 caracteres em volta do termo. Ele não vai para a ficha; serve só para a correlação ler o ato inteiro.",
  "Descarta a página que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (com três letras ou mais), comparadas sem acento.",
  "Tira repetidos pelo _id, porque a mesma página volta na busca pelo CNPJ e na busca pelo nome.",
  "Classifica o ato pelo trecho: ato_relevante (licença, alvará, decreto, incentivo, outorga, TAC, implantação, ampliação…), compra_publica (licitação, pregão, registro de preço, homologação, dispensa) ou outro.",
  "Marca no_municipio quando o trecho cita o município da ficha e ordena: município primeiro, depois ato relevante, outro e compra pública, e por fim a data mais recente.",
  `Monta o link: ${link}`,
  "Passa todos os atos para a correlação. Os diretos viram a evidência, com até 8 linhas: data, pagina, trecho, url, tipo_ato, no_municipio e o motivo da correlação.",
];

const EXTRACAO = {
  "CAPTURA-DOE-MG": {
    formato: [
      "O Jornal Minas Gerais tem uma API REST (v1) usada pelo próprio portal. A pesquisa não exige cadastro, mas só responde com um token: chamada sem o cabeçalho Authorization volta HTTP 401. Por isso abrir a URL da pesquisa direto no navegador sempre dá 401.",
      "O token é anônimo e se pede em POST /api/v1/Autenticacao/Autenticar com corpo {}. A resposta é {\"dados\": \"<JWT>\"}. O JWT tem usuário genérico (\"Usuário\"), emissor e público segov-portal-ui e vale 2 horas. GET nesse endereço responde 405.",
      "Para testar à mão (bash): T=$(curl -s -X POST -H 'content-type: application/json' -d '{}' https://www.jornalminasgerais.mg.gov.br/api/v1/Autenticacao/Autenticar | sed 's/.*\"dados\":\"\\([^\"]*\\)\".*/\\1/') e depois curl -H \"Authorization: Bearer $T\" 'https://www.jornalminasgerais.mg.gov.br/api/v1/Pesquisa/PesquisarJornaisPaginados?DataPublicacaoInicial=2015-01-01&DataPublicacaoFinal=2026-10-27&TextoPesquisa=17.227.422&PaginaAtual=1&TamanhoPagina=3'. Sem a palavra Bearer antes do token a API também responde 401. Teste feito em 27/10/2026: sem token 401; com token 200 e 6 trechos para a raiz 17.227.422 (totalDeRegistros). O conector, somando a busca pela raiz e pelo nome, achou 51 trechos da Gerdau Açominas.",
      "Coleção Postman com a autenticação automática e os testes de 200, 401 e 405: docs/postman/jornal-minas-gerais.postman_collection.json. Rodada com o Newman em 27/10/2026: 10 de 10 verificações passaram.",
      "A resposta da pesquisa é um envelope com dados (lista de trechos), paginaAtual, totalDePaginas, totalDeRegistros e erros.",
      "Cada item de dados é um trecho de uma página, não um ato inteiro: idJornal (o caderno da edição), dataPublicacao (data e hora ISO, sempre meia-noite), tipoCaderno (Diário do Executivo, Diário dos Municípios ou Diário de Terceiros), pagina e textoResultado.",
      "textoResultado tem cerca de 200 caracteres em volta do termo. O texto sai do PDF sem acento, sem pontuação no CNPJ e com ligaduras quebradas: \"fi rmado com Gerdau Acominas S A (CNPJ:17 227 422/0001-05) e fi liais de Barao de Cocais\".",
      "Exemplo real (Gerdau, 17/09/2026, página 11 do Diário do Executivo): \"*Gerdau Acominas S A, Vigia, CNPJ N: 17 227 422/0140-76, Corte ou aproveitamento de arvores isoladas nativas vivas, Ouro Preto-MG, Processo N: 2100…\". O município e a atividade estão no próprio trecho, que é o que a correlação lê.",
      "O mesmo trecho pode citar outra unidade da empresa. No exemplo de 29/09/2026, o protocolo de intenções cancelado é das filiais de Barão de Cocais e Divinópolis, não da mina de Miguel Burnier.",
    ],
    requisicoes: [
      req("POST", "https://www.jornalminasgerais.mg.gov.br/api/v1/Autenticacao/Autenticar", [
        param("corpo", "{}", "Sem usuário nem senha. A resposta traz o token JWT em dados."),
        param("content-type", "application/json", "Cabeçalho exigido pela API."),
      ], "Tem de ser POST: GET responde 405. Uma vez por consulta da ficha; o token vale 2 horas e não é guardado."),
      req("GET", "https://www.jornalminasgerais.mg.gov.br/api/v1/Pesquisa/PesquisarJornaisPaginados", [
        param("Authorization", "Bearer {token}", "Obrigatório. Sem ele, ou sem o prefixo Bearer, a API responde 401."),
        param("TextoPesquisa", "17.227.422 ou gerdau acominas", "Uma chamada para a raiz do CNPJ e outra para o nome."),
        param("DataPublicacaoInicial", "2015-01-01", "Início fixo do período."),
        param("DataPublicacaoFinal", "data de hoje", "Fim do período."),
        param("DiarioExecutivo, DiarioMunicipios, DiarioTerceiros, EdicaoExtra", "true", "Todos os cadernos entram."),
        param("PaginaAtual", "1", "Só a primeira página da pesquisa."),
        param("TamanhoPagina", "40", "Até 40 trechos por termo."),
      ], "O servidor não manda o certificado intermediário (Sectigo DV R36). Navegador e curl no Windows buscam o intermediário sozinhos e não percebem; o Node falha com UNABLE_TO_VERIFY_LEAF_SIGNATURE. A cadeia fica em src/enrichment/certs/ e soma-se às raízes do Node; a verificação TLS continua ligada."),
    ],
    passos: [
      "Pede o token anônimo.",
      "Faz duas pesquisas: a raiz do CNPJ com máscara (XX.XXX.XXX) e o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). São até 80 trechos.",
      "Normaliza cada trecho: junta espaços, corta dataPublicacao em AAAA-MM-DD e guarda caderno, pagina e trecho.",
      "Monta a chave idJornal:pagina:primeiros 60 caracteres do trecho para tirar repetidos entre as duas pesquisas.",
      "Descarta o trecho que não cita a empresa: precisa ter os dígitos da raiz do CNPJ (o texto vem como 17 227 422, e a comparação é só de dígitos) ou todas as palavras do nome.",
      "Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.",
      "Monta o link do visualizador: /edicao-do-dia?dados= seguido do JSON {dataPublicacaoSelecionada, idCadernoEdicaoSelecionado, paginaSelecionada, textoPesquisa} codificado na URL. O link abre a página certa com o termo marcado.",
      "Passa todos os trechos para a correlação. O contexto lido é o próprio textoResultado, porque a API não devolve mais texto. Os diretos viram a evidência, com até 8 linhas.",
    ],
    correlacao: [
      "Como o trecho tem só uns 200 caracteres, muitos registros chegam sem local nem objeto e saem como incerta. É uma escolha conservadora: o trecho que não diz onde nem o quê não prova o projeto.",
      "Para ler mais contexto, o caminho é baixar a página em PDF que a API devolve em base64 e recortar em volta do termo. Ainda não está ligado.",
    ],
  },
  "CAPTURA-DOE-SP": {
    formato: [
      "O novo Diário Oficial de São Paulo publica uma API de busca (v2/advanced-search/publications) usada pelo portal doe.sp.gov.br. Não pede token.",
      "A resposta é um envelope com items, currentPage, totalPages, totalItems, pageSize, hasPreviousPage e hasNextPage.",
      "Cada item é um ato: id (UUID), isLegacy, publicationTypeId, secondLevelSectionId, thirdLevelSectionId, date (data e hora ISO), title, slug, excerpt, hierarchy, totalTermsFound e termsFound.",
      "excerpt é o texto do ato em volta do termo, já sem HTML na maior parte dos casos. hierarchy diz o caderno, a seção e o órgão separados por \" > \", como \"Executivo > Atos Normativos > Secretaria de Meio Ambiente, Infraestrutura e Logística > Departamento de Águas e Energia Elétrica\".",
      "Exemplo real (Bracell, 10/07/2023): \"PORTARIA DA SUPERINTENDENTE DO DAEE DE 07/07/2023\" com o trecho \"Fica outorgada, em nome de BRACELL SP CELULOSE LTDA., CPF/CNPJ 53.943.098/0001-87, a autorização administrativa para o(s) uso(s) em recursos hídricos superficiais, para fins de irrigação, no município de Itatinga\". É da mesma empresa, mas em Itatinga e para irrigação de floresta. Não é a fábrica de Lençóis Paulista, então a correlação marca outro_projeto.",
      "As listas mensais de licenças da CETESB saem como um ato só, com centenas de empresas. O excerpt pode começar em outra empresa; por isso o recorte é feito em volta do CNPJ ou do nome.",
      "A API só indexa atos a partir de maio de 2023. O acervo antigo fica fora.",
    ],
    requisicoes: [
      req("GET", "https://do-api-web-search.doe.sp.gov.br/v2/advanced-search/publications", [
        param("Terms[0]", "53.943.098 ou bracell sp celulose", "Uma chamada para a raiz do CNPJ e outra para o nome. Vários Terms[i] na mesma chamada seriam combinados com OU."),
        param("FromDate", "2015-01-01", "Início do período. Na prática a API começa em maio de 2023."),
        param("ToDate", "data de hoje", "Fim do período."),
        param("PageNumber", "1", "Só a primeira página."),
        param("PageSize", "100", "Até 100 atos por termo."),
        param("SortField", "Date", "Mais recentes primeiro."),
      ], "Sem token. O ato abre em https://www.doe.sp.gov.br/{slug}."),
    ],
    passos: [
      "Faz duas buscas, pela raiz do CNPJ com máscara e pelo nome da empresa. São até 200 atos.",
      "Para cada ato, tira o HTML do excerpt e recorta 320 caracteres a partir de pouco antes do CNPJ ou do nome. O trecho da ficha é \"{title} — {recorte}\", com até 400 caracteres.",
      "Guarda o contexto (título e excerpt, até 1.200 caracteres em volta do termo) só para a correlação.",
      "Converte date em AAAA-MM-DD, copia title em titulo e hierarchy em orgao, e monta a url com o slug.",
      "Descarta o ato que não cita a empresa (dígitos da raiz ou todas as palavras do nome no título e excerpt) e tira repetidos pelo id.",
      "Classifica o ato, marca no_municipio e ordena: município, tipo de ato, data.",
      "Passa todos os atos para a correlação. Os diretos viram a evidência, com até 8 linhas: data, titulo, orgao, trecho, url, tipo_ato e no_municipio.",
    ],
    correlacao: [
      "Em São Paulo a mesma empresa costuma ter muitos atos em municípios vizinhos: outorgas do DAEE para fazendas, licenças da CETESB de outras unidades, autos de infração. O município no excerpt é o principal sinal; o órgão em hierarchy ajuda a separar licença ambiental de compra pública.",
      "Com mais de 60 atos, só os 60 primeiros na ordem (município da ficha primeiro) são lidos. O resto conta como não avaliado.",
    ],
  },
  "CAPTURA-DOE-BA": {
    formato: DOOL_FORMATO(
      "Diário Oficial da Bahia (DOOL, da EGBA)",
      "Exemplo real (BYD Auto do Brasil, 29/05/2026, página 41): _source.conteudo começa com férias de servidor da SEMA e uma portaria do INEMA sobre fiscal de transferência de animais. O destaque mostra o ato da empresa: \"O INSTITUTO DO MEIO AMBIENTE E RECURSOS HÍDRICOS - INEMA […] Processo nº 2026.001.002146/INEMA/LIC-02146, RESOLVE: Art. 1º - Conceder LICENÇA DE ALTERAÇÃO, válida até 19/07/2030, à BYD AUTO DO BRASIL LTDA, inscrito no CNPJ sob o nº 50.351.104/0001-19\". O endereço e o objeto vêm depois do CNPJ, por isso o contexto da correlação pega o texto que segue o termo.",
    ),
    requisicoes: [
      req("GET", "https://dool.egba.ba.gov.br/busca/busca/buscar/query/{pagina}/di:2015-01-01/df:{hoje}/?1=1&q=\"{termo}\"", [
        param("{pagina}", "0, depois 1", "Página da busca, 10 resultados por página. A página 1 só é pedida se a 0 vier cheia."),
        param("di / df", "2015-01-01 / hoje", "Período no próprio caminho da URL."),
        param("q", "\"50.351.104\" ou \"byd auto brasil\"", "Termo entre aspas, para buscar a frase. Uma busca para a raiz do CNPJ e outra para o nome."),
      ], "Sem token. O servidor não manda o certificado intermediário (GeoTrust TLS RSA CA G1); a cadeia fica em src/enrichment/certs/. O PDF da edição pede login, então o link abre o visualizador."),
    ],
    passos: DOOL_PASSOS("https://dool.egba.ba.gov.br/ver-flip/{diario_id}/#/e:{diario_id}/p:{pagina}?find={termo}, que abre o visualizador na página com o termo marcado."),
    correlacao: [
      "A página do DOOL junta atos de órgãos diferentes. Uma portaria do INEMA tem preâmbulo longo e o CNPJ vem depois; o contexto de 1.200 caracteres em volta do termo pega o ato da empresa, não o começo da página.",
      "Incentivo DESENVOLVE ou PROAUTO, licença do INEMA e contrato de terreno citando Camaçari são os atos que costumam ter correlação direta com uma fábrica na Bahia.",
    ],
  },
  "CAPTURA-DOE-PR": {
    formato: DOOL_FORMATO(
      "Diário Oficial do Paraná (DIOE)",
      "Exemplo real (CMPC Iguaçu Embalagens, raiz 11.308.600): 14 páginas do diário citam a raiz. As três da amostra são portarias de outorga de água do Instituto Água e Terra, no modelo \"Outorgado(s) {empresa} CPF/CNPJ {cnpj}. {corpo d'água}. Coordenadas UTM… Validade… Finalidade… Vazão máxima… Município {município}\".",
      "Duas delas (02/10/2026 e 29/07/2026) são do CNPJ 11.308.600/0001-38, com processo fabril em São José dos Pinhais. A terceira (14/11/2025) é do CNPJ 11.308.600/0009-95, no Rio Piraí, para diluição de efluente industrial, em Piraí do Sul. Só esta última está no município do projeto.",
    ),
    requisicoes: [
      req("GET", "https://www.dioe.pr.gov.br/busca/busca/buscar/query/{pagina}/di:2015-01-01/df:{hoje}/?1=1&q=\"{termo}\"", [
        param("{pagina}", "0, depois 1", "Página da busca, 10 resultados por página."),
        param("di / df", "2015-01-01 / hoje", "Período no caminho da URL."),
        param("q", "\"11.308.600\" ou \"cmpc iguacu embalagens\"", "Termo entre aspas. Uma busca para a raiz do CNPJ e outra para o nome."),
      ], "Mesmo motor do DOE-BA. Sem token. O PDF da página é público."),
    ],
    passos: DOOL_PASSOS("https://www.dioe.pr.gov.br/portal/edicoes/download/{diario_id}/{pagina}, que baixa o PDF só daquela página."),
    correlacao: [
      "Portarias de outorga e súmulas de licença do Paraná escrevem o município, a finalidade e o CNPJ da filial no próprio texto. A correlação compara com Piraí do Sul e com a obra do projeto: a outorga de São José dos Pinhais é da fábrica de embalagens que já existe lá e sai como outro_projeto.",
      "O CNPJ da filial (os 6 dígitos depois da raiz) também ajuda: a busca é pela raiz, então traz todas as filiais.",
    ],
  },
  "SEC-SEMAD": {
    formato: [
      "A SEMAD publica as licenças do Sistema de Licenciamento Ambiental (SLA) na IDE-Sisema, um GeoServer com serviço WFS padrão OGC. A camada é IDE:ide_2101_mg_empreendimentos_licenciados_pto, com uma feição (ponto) por licença.",
      "A resposta em GeoJSON é uma FeatureCollection com type, features, totalFeatures, numberMatched, numberReturned, timeStamp e crs. Na data da amostra, a camada tinha 19.713 licenças.",
      "Cada feição traz type, id (como ide_2101_mg_empreendimentos_licenciados_pto.9271), geometry (ponto com longitude e latitude), geometry_name e properties com 24 atributos.",
      "Os atributos descrevem o processo (n_solicit, n_processo, tipo_solic, status_pro, und_analis), o titular (nome_pf_pj, cpf_cnpj), o local (mun_solic, latitude, longitude), a atividade (listagem, cod_atvpri, des_atvpri, classe, fatloc_res), a licença (modl_licen, fase_licen, data_emiss, data_val, vig_lic_an, vig_lic_me, vig_lic_di) e o link público do processo no SLA.",
      "Exemplo real (Gerdau Açominas, Ouro Preto): processo 2581/2020, \"Solicitação de licença para ampliação de empreendimento\", atividade A-05-02-0 \"Unidade de Tratamento de Minerais - UTM, com tratamento a úmido\", classe 6, LAC1, fase LP, Concluído Deferido, emitida em 27/06/2022 e válida até 24/06/2032.",
      "cpf_cnpj vem como número e com os últimos dígitos zerados em parte das linhas (17227400000000). Por isso a busca é pelo nome, e não pelo CNPJ. As datas vêm como texto DD/MM/AAAA.",
    ],
    requisicoes: [
      req("GET", "https://geoserver.meioambiente.mg.gov.br/ows", [
        param("service / version / request", "WFS / 2.0.0 / GetFeature", "Pedido padrão de feições."),
        param("typeNames", "IDE:ide_2101_mg_empreendimentos_licenciados_pto", "Camada de empreendimentos licenciados."),
        param("outputFormat", "application/json", "GeoJSON."),
        param("CQL_FILTER", "nome_pf_pj ILIKE '%gerdau%acominas%'", "As duas primeiras palavras do nome, com % entre elas. Aspas simples são retiradas do termo para não quebrar o filtro."),
        param("count", "500", "Até 500 licenças."),
      ], "Sem token. Consulta ao vivo a cada ficha, sem cópia local."),
    ],
    passos: [
      "Monta o filtro CQL com as duas primeiras palavras do nome (três letras ou mais), sem S/A, LTDA e afins.",
      "Chama o WFS e lê properties de cada feição.",
      "Mapeia: n_processo vira processo; mun_solic, municipio; nome_pf_pj, titular; tipo_solic, solicitacao; cod_atvpri e des_atvpri, atividade (\"A-05-02-0 — Unidade de Tratamento…\"); classe; modl_licen, modalidade; fase_licen, fase; status_pro, status; link, url.",
      "Converte data_emiss e data_val de DD/MM/AAAA para AAAA-MM-DD (emissao e validade) e copia latitude e longitude.",
      "Marca no_municipio quando mun_solic é igual ao município da ficha, sem acento.",
      "Ordena: município da ficha primeiro, depois a emissão mais recente.",
      "Passa todas as licenças para a correlação. As diretas viram a evidência, com até 8 linhas.",
    ],
    correlacao: [
      "O município é um campo estruturado, então licença de outra cidade já chega marcada como outro_municipio. A atividade decide o resto: no projeto Itabiritos (planta de beneficiamento na mina de Miguel Burnier), uma UTM em Ouro Preto tem correlação direta; uma licença da usina de Ouro Branco ou de outra mina da empresa, não.",
      "Atributos que a ficha não copia (n_solicit, listagem, fatloc_res, und_analis, vig_lic_*) continuam no dicionário acima.",
    ],
  },
  "SEC-IAT": {
    formato: [
      "O Instituto Água e Terra publica as licenças ambientais do Paraná num FeatureServer do ArcGIS: 00_PUBLICACOES/licencas_ambientais_sia_sga, camada 0. Cada feição é uma licença.",
      "A resposta de /query em JSON traz features (cada uma com attributes) e exceededTransferLimit, que diz se há mais páginas.",
      "attributes tem 14 campos: objectid, num_protocolo, nome_razao_social, cod_ibge, nome_municipio, uf, sigla_modalidade, desc_modalidade, desc_grupo_atividade, desc_atividade, dt_emissao, dt_validade, x e y.",
      "As datas vêm em milissegundos desde 1970-01-01 UTC. A camada não tem coluna de CNPJ; a única chave da empresa é a razão social.",
    ],
    requisicoes: [
      req("GET", "https://geopr.iat.pr.gov.br/server/rest/services/00_PUBLICACOES/licencas_ambientais_sia_sga/FeatureServer/0/query", [
        param("where", "1=1", "Todas as licenças."),
        param("outFields", "*", "Os 14 atributos."),
        param("returnGeometry", "false", "Sem a geometria; x e y já vêm nos atributos."),
        param("resultOffset", "0, 2000, 4000…", "Paginação."),
        param("resultRecordCount", "2000", "Tamanho da página."),
        param("f", "json", "Formato da resposta."),
      ], "Diferente das outras sete, esta fonte é baixada inteira na carga das bases (npm run db:load-bases) e gravada em enr_registro. A ficha lê a cópia local."),
    ],
    passos: [
      "Na carga: pagina /query de 2.000 em 2.000 até a página vir menor que 2.000 e sem exceededTransferLimit.",
      "Mapeia cada feição para enr_registro: codigo SEC-IAT, chave num_protocolo (ou objectid), titulo nome_razao_social, uf, municipio nome_municipio e payload com protocolo, modalidade, modalidade_descricao, grupo, atividade, emissao, validade, ibge, x e y.",
      "Apaga a cópia anterior e grava a nova, e registra a carga em base_carga.",
      "Na ficha (só quando a UF da ficha é PR): procura em enr_registro as licenças cujo titular tem as duas primeiras palavras da razão social, com o município da ficha primeiro, até 100 licenças.",
      "Abre o payload na linha e converte emissao e validade de milissegundos para AAAA-MM-DD.",
      "Passa as licenças para a correlação. As diretas viram a evidência.",
    ],
    correlacao: [
      "Até outubro de 2026 esta fonte rodava para fichas de qualquer estado e trouxe licenças do Paraná para projetos de Minas Gerais (Ambev em Sete Lagoas, Gerdau em Ouro Preto). Agora ela só roda quando a ficha é do Paraná, e o corte por UF da correlação descarta o que sobrar.",
      "Com a atividade e a modalidade na linha, a correlação separa a licença da fábrica do projeto de licenças de viveiro, silvicultura ou outra unidade da mesma empresa.",
    ],
  },
  "CAPTURA-SIGPUB": {
    formato: [
      "A plataforma SIGPub (diariomunicipal.com.br) hospeda os diários das associações estaduais de municípios. Não há API; o Radar lê a página HTML de busca, a mesma que uma pessoa usa.",
      "Cada matéria da lista é um <li class=\"materia-card\"> com: título e link em .materia-card__titulo a; quem publicou em .materia-card__entidade (prefeitura, câmara ou consórcio); a secretaria em .materia-card__orgao; o trecho com o termo marcado em <mark> em .materia-card__trecho; e uma lista de definições (dt/dd) em .materia-card__dados com Circulação (DD/MM/AAAA), Edição, Código identificador e o link do PDF da edição.",
      "A busca devolve até 25 matérias por página e combina as palavras com OU. A página completa tem cerca de 140 KB, quase tudo cabeçalho, menu e filtros.",
      "Cobre só municípios que publicam pela associação. Cidades maiores, como Ouro Preto, Sete Lagoas e Camaçari, têm diário próprio e não aparecem aqui.",
    ],
    requisicoes: [
      req("GET", "https://www.diariomunicipal.com.br/{associacao}/pesquisar", [
        param("{associacao}", "amm-mg, amp, apm, bahia, amurc…", "Escolhida pela UF da ficha. Algumas UFs têm duas associações."),
        param("busca_avancada[texto]", "17.227.422/0001-05, 17.227.422 ou gerdau acominas", "Três chamadas: CNPJ completo, raiz e nome."),
        param("busca_avancada[dataInicio] / [dataFim]", "2015-01-01 / hoje", "Período obrigatório."),
        param("busca_avancada[pagina]", "1", "Só a primeira página."),
        param("busca_avancada[Enviar]", "vazio", "Campo do formulário que a página exige."),
      ], "Sem token e sem login."),
    ],
    passos: [
      "Escolhe as associações pela UF da ficha e faz três buscas em cada uma: CNPJ completo com máscara, raiz do CNPJ e nome.",
      "Lê cada li.materia-card com cheerio: titulo, url (o caminho relativo ganha o domínio), entidade, orgao, trecho (até 300 caracteres, sem HTML), data (Circulação em AAAA-MM-DD), edicao e o código identificador.",
      "Tira repetidos pelo código identificador.",
      "Fica só com a matéria que traz a raiz do CNPJ ou todas as palavras do nome no título ou no trecho.",
      "Classifica o ato pelo título, órgão e trecho. Matéria achada só pelo nome fica apenas se for ato_relevante, porque nome de marca aparece em compra de prefeitura (vergalhão Gerdau, refrigerante Ambev).",
      "Marca no_municipio quando a entidade que publicou é do município da ficha e ordena: município, tipo de ato, data.",
      "Passa todas as matérias para a correlação. As diretas viram a evidência, com até 5 linhas.",
    ],
    correlacao: [
      "A entidade que publicou é o sinal de local mais forte: decreto da Prefeitura de Itabirito não é da mina de Ouro Preto. O trecho de 300 caracteres traz o objeto do ato.",
    ],
  },
  "CAPTURA-DOM-METAWAY": {
    formato: [
      "A plataforma Mentor, da Metaway, publica o diário oficial de algumas prefeituras com uma API JSON pública. O Radar mapeia hoje Lençóis Paulista/SP (lencois.mentor.metaway.com.br), com edições desde 26/04/2019.",
      "/recurso/diario/lista devolve uma lista de edições em que o termo aparece, sem trecho. Cada edição tem 11 chaves: codigo, edicao, ano, dataPublicacao, tipo, arquivoPdf, assinado, hash, paginas, arquivoPdfEditor e pdfEditado.",
      "/recurso/diario/editar/{codigo} devolve as mesmas chaves e srcPDF, o caminho do PDF: diarios/diario_{ano}_{edicao}_r_{hash}.pdf. Exemplo: a edição 194, de 17/03/2020, fica em diarios/diario_2_194_r_XIgKBddfLSoSbVO.pdf.",
      "O conteúdo está só no PDF, com o diário inteiro do dia. Uma edição tem dezenas de atos de assuntos diferentes.",
    ],
    requisicoes: [
      req("GET", "https://lencois.mentor.metaway.com.br/recurso/diario/lista", [
        param("texto", "Bracell", "A primeira palavra do nome, que costuma ser a marca. A plataforma trata várias palavras como frase."),
        param("dataInicial / dataFinal", "2015-01-01 / hoje", "Período."),
      ], "Sem token. A prefeitura é escolhida pelo município e pela UF da ficha; sem prefeitura no mapa, a fonte não roda."),
      req("GET", "https://lencois.mentor.metaway.com.br/recurso/diario/editar/{codigo}", [
        param("{codigo}", "209", "Código interno da edição, vindo da lista."),
      ], "Devolve srcPDF."),
      req("GET", "https://lencois.mentor.metaway.com.br/{srcPDF}", [], "Baixa o PDF da edição."),
    ],
    passos: [
      "Busca a marca na lista de edições e ordena da mais recente para a mais antiga.",
      "Para as 6 edições mais recentes, pede o detalhe, baixa o PDF e converte em texto (pdfjs, até 20 páginas por edição).",
      "Recorta 320 caracteres a partir de pouco antes da marca para o trecho da ficha e 1.200 caracteres para o contexto da correlação.",
      "Classifica o ato pelo trecho e marca texto_lido, que diz se o PDF foi lido. Edição com PDF ilegível fica sem trecho.",
      "Marca no_municipio: o diário é da própria prefeitura da ficha.",
      "Passa as edições lidas para a correlação. As diretas viram a evidência: data, edicao, trecho, tipo_ato, url do PDF e texto_lido.",
    ],
    correlacao: [
      "O município já está garantido pela prefeitura. O que a correlação decide é o assunto: decreto de doação de área, alvará ou permissão de uso para a fábrica entram; licitação em que a empresa aparece ou ato sobre outra obra ficam fora.",
    ],
  },
};

// Diários estaduais do registro. Os do motor IONEWS seguem o mesmo formato e os mesmos passos do DOE-BA.
for (const estado of DOE_ESTADOS) {
  EXTRACAO[estado.codigo] = estado.motor === "ionews"
    ? {
      formato: DOOL_FORMATO(estado.nome, estado.exemplo),
      requisicoes: estado.requisicoes,
      passos: DOOL_PASSOS(estado.link),
      correlacao: estado.correlacao,
    }
    : {
      formato: estado.formato,
      requisicoes: estado.requisicoes,
      passos: estado.passos,
      correlacao: estado.correlacao || [],
    };
}

function sourceExtraction(codigo) {
  return EXTRACAO[codigo] || null;
}

module.exports = { EXTRACAO, REGRA_CORRELACAO, sourceExtraction };
