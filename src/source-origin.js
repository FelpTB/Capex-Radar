const { DOE_ESTADOS } = require("./doe-registry");
// Origem e links de acesso das fontes secundárias conectadas.
// fixa: true significa que o endereço do arquivo ou da API está escrito no código.
// fixa: false significa que o código só sabe onde perguntar; o endereço do arquivo sai dessa consulta.
const SOURCE_ORIGINS = {
  "SEC-BNDES": {
    orgao: "BNDES",
    publicacao: "Conjunto Operações de Financiamento, no portal de dados abertos do banco.",
    acesso: "A carga baixa o CSV com um HTTP GET, sem login e sem perguntar ao catálogo qual é o arquivo da vez.",
    links: [
      {
        papel: "Página da publicação",
        url: "https://dadosabertos.bndes.gov.br/dataset/operacoes-financiamento",
        fixa: false,
        nota: "Esta página é só a ficha do conjunto. A carga não a abre para achar o arquivo.",
      },
      {
        papel: "CSV baixado",
        url: "https://dadosabertos.bndes.gov.br/dataset/10e21ad1-568e-45e5-a8af-43f2c05ef1a2/resource/6f56b78c-510f-44b6-8274-78a5b7e931f4/download/operacoes-financiamento-operacoes-nao-automaticas.csv",
        fixa: true,
        nota: "URL fixa em src/enrichment/load.js. É o recurso de operações não automáticas. Se o BNDES trocar o identificador do recurso, o código precisa ser atualizado.",
      },
    ],
  },
  "SEC-CVM-IPE": {
    orgao: "CVM",
    publicacao: "Diretório público de documentos IPE de companhias abertas.",
    acesso: "A carga monta um ZIP por ano e baixa cada um com HTTP GET, sem autenticação. Os anos estão escritos no código: 2025 e 2026.",
    links: [
      {
        papel: "Página da publicação",
        url: "https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe",
        fixa: false,
        nota: "Ficha do conjunto. A carga não consulta essa página.",
      },
      {
        papel: "ZIP de 2025",
        url: "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS/ipe_cia_aberta_2025.zip",
        fixa: true,
        nota: "URL fixa em src/enrichment/load.js. O padrão é ipe_cia_aberta_ANO.zip e a lista de anos é fixa.",
      },
      {
        papel: "ZIP de 2026",
        url: "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS/ipe_cia_aberta_2026.zip",
        fixa: true,
        nota: "URL fixa em src/enrichment/load.js, no mesmo padrão do ano anterior.",
      },
    ],
  },
  "SEC-SIGA": {
    orgao: "ANEEL",
    publicacao: "Conjunto SIGA, empreendimentos de geração, no CKAN da ANEEL.",
    acesso: "A carga baixa o CSV diário e o CSV mensal com HTTP GET, sem chave e sem procurar o recurso no catálogo. O mensal só devolve o CNPJ quando a edição diária tirou o número e o nome do agente continua o mesmo.",
    links: [
      {
        papel: "Página da publicação",
        url: "https://dadosabertos.aneel.gov.br/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel",
        fixa: false,
        nota: "Ficha do conjunto. A carga não a abre.",
      },
      {
        papel: "CSV diário baixado",
        url: "https://dadosabertos.aneel.gov.br/dataset/6d90b77c-c5f5-4d81-bdec-7bc619494bb9/resource/2f65a1b0-19b8-4360-8238-b34ab4693d55/download/siga-empreendimentos-geracao-diario.csv",
        fixa: true,
        nota: "URL fixa em src/enrichment/load.js, com o identificador do recurso diário. Se a ANEEL publicar outro resource id, o código precisa ser atualizado.",
      },
      {
        papel: "CSV mensal, usado para o CNPJ",
        url: "https://dadosabertos.aneel.gov.br/dataset/6d90b77c-c5f5-4d81-bdec-7bc619494bb9/resource/11ec447d-698d-4ab8-977f-b424d5deee6a/download/siga-empreendimentos-geracao.csv",
        fixa: true,
        nota: "Mesmas 23 colunas. A edição gerada em 01/10/2026 ainda traz o CNPJ no texto de participação. O dicionário em PDF está no mesmo conjunto, recurso dm-siga.",
      },
    ],
  },
  "SEC-IBAMA": {
    orgao: "Ibama",
    publicacao: "Conjunto de licenças ambientais de atividades e empreendimentos licenciados pelo Ibama. O arquivo em si fica no armazenamento Azure de dados abertos do órgão.",
    acesso: "A carga baixa o CSV com HTTP GET, sem login. O catálogo do Ibama não é consultado para descobrir o endereço.",
    links: [
      {
        papel: "Página da publicação",
        url: "https://dadosabertos.ibama.gov.br/pt_BR/dataset/licencas-ambientais-de-atividades-e-empreendimentos-licenciados-pelo-ibama",
        fixa: false,
        nota: "Ficha do conjunto. O texto dela lista oito atributos e não cita PAC nem a geração do extrato. A carga não abre a ficha para achar o arquivo.",
      },
      {
        papel: "CSV baixado",
        url: "https://stibamadadosabertosprd.blob.core.windows.net/dados-abertos/dados/SISLIC/sislic-licencas.csv",
        fixa: true,
        nota: "URL fixa em src/enrichment/load.js. O CSV é republicado nesse endereço. HTML, XML e JSON do mesmo conjunto não são baixados. A cópia local só muda quando a carga roda de novo.",
      },
    ],
  },
  "SEC-ANTT-INV": {
    orgao: "ANTT",
    publicacao: "Cinco conjuntos de investimentos de concessão no CKAN da ANTT. Cadastro, autorização e encerramento saem do SIGICOR e se cruzam por id_sigicor.",
    acesso: "A carga baixa os cinco CSVs com HTTP GET, sem chave. Cada endereço está escrito no código. JSON, PDF e o dashboard não são baixados.",
    links: [
      {
        papel: "Página do portal",
        url: "https://dados.antt.gov.br/",
        fixa: false,
        nota: "Portal. A carga não pesquisa nele.",
      },
      {
        papel: "Cadastro de investimentos",
        url: "https://dados.antt.gov.br/dataset/6a42582f-5481-458d-bf21-247d91a60af5/resource/48ca5a9b-65c2-46af-9123-cad23e6f8a8d/download/cadastros-de-investimentos-dos-contratos-de-concessao.csv",
        fixa: true,
        nota: "URL fixa em src/enrichment/extra.js.",
      },
      {
        papel: "Autorização de investimento",
        url: "https://dados.antt.gov.br/dataset/967e6b74-bbcd-4212-a93f-4119611143f8/resource/cec76fd2-8fa0-45f5-bb87-566de09fa715/download/autorizacao-investimento.csv",
        fixa: true,
        nota: "URL fixa em src/enrichment/extra.js. O recurso anterior 6acbae66 deixou de responder em 21/10/2026.",
      },
      {
        papel: "Encerramento de investimento",
        url: "https://dados.antt.gov.br/dataset/09020405-776b-4bbc-946e-410a37ab2a70/resource/37527602-5b8b-4b2d-aef7-f7ed59a2f473/download/encerramento-investimentos.csv",
        fixa: true,
        nota: "URL fixa em src/enrichment/extra.js.",
      },
      {
        papel: "Investimentos autorizados PIP",
        url: "https://dados.antt.gov.br/dataset/7c6bc8ab-69fb-4955-9cf3-7481cfa089f9/resource/64a0f446-f67c-412d-8b87-17587a8e9f78/download/investimentos_autorizados_gpfer_pip.csv",
        fixa: true,
        nota: "URL fixa em src/enrichment/extra.js.",
      },
      {
        papel: "Concessionárias",
        url: "https://dados.antt.gov.br/dataset/a133da64-1e03-4832-909d-e1eb835eec2e/resource/a08292ac-41a6-4220-bfe2-35c7b3abfbf0/download/investimentos.csv",
        fixa: true,
        nota: "URL fixa em src/enrichment/extra.js.",
      },
    ],
  },
  "SEC-ANTAQ-INST": {
    orgao: "ANTAQ, espelhado no portal do Ministério dos Transportes",
    publicacao: "Conjunto Instalações portuárias privadas. O arquivo de 2026 citado no catálogo do dados.gov.br não responde. A carga usa o último CSV que ainda baixa.",
    acesso: "A carga baixa esse CSV com HTTP GET, sem chave e sem consultar o catálogo na hora.",
    links: [
      {
        papel: "Página da publicação",
        url: "https://www.gov.br/antaq/pt-br/acesso-a-informacao/dados-abertos",
        fixa: false,
        nota: "Página institucional. A carga não a abre.",
      },
      {
        papel: "CSV baixado",
        url: "https://dados.transportes.gov.br/dataset/5cb74314-b2d8-4bcb-8330-f7acda1ad060/resource/4cb7551c-176c-46b0-bba5-8e326d6fda6e/download/out_2022.csv",
        fixa: true,
        nota: "URL fixa em src/enrichment/extra.js. É o CSV de outubro de 2022. Um arquivo mais novo exige trocar esse endereço no código.",
      },
    ],
  },
  "SEC-IAT": {
    orgao: "Instituto Água e Terra do Paraná",
    publicacao: "Camada pública de licenças ambientais do SIA/SGA.",
    acesso: "A carga consulta o serviço de mapa página a página, com HTTP GET e sem login. Cada página pede 2.000 feições.",
    links: [
      {
        papel: "Camada consultada",
        url: "https://geopr.iat.pr.gov.br/server/rest/services/00_PUBLICACOES/licencas_ambientais_sia_sga/FeatureServer/0",
        fixa: true,
        nota: "URL fixa em src/enrichment/extra.js. A consulta acrescenta /query, com resultOffset para a página seguinte.",
      },
    ],
  },
  "SEC-CNO": {
    orgao: "Receita Federal, catalogado no dados.gov.br",
    publicacao: "Conjunto Cadastro Nacional de Obras, com dois recursos: o ZIP diário das inscrições e o PDF do dicionário. O catálogo guarda o endereço atual de cada um.",
    acesso: "O comando npm run dadosgov:sync pergunta ao catálogo, com a chave TOKEN_DADOS_GOV, qual é o recurso do tipo dados em ZIP. O link devolvido ganha /download. Se a data ou o tamanho mudaram, o ZIP é baixado e todos os CSV de dentro são extraídos na mesma pasta. O dicionário só é baixado se o PDF local ainda não existe.",
    links: [
      {
        papel: "Ficha do conjunto no catálogo",
        url: "https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-de-obras-cno",
        fixa: true,
        nota: "O nome do conjunto, cadastro-nacional-de-obras-cno, é fixo em src/enrichment/dadosgov.js. A página em si não é aberta.",
      },
      {
        papel: "API do catálogo",
        url: "https://dados.gov.br/dados/api/publico/conjuntos-dados",
        fixa: true,
        nota: "URL fixa da busca. O endereço do ZIP não é fixo: sai do recurso marcado como dados em formato ZIP e pode mudar quando a Receita troca o compartilhamento.",
      },
    ],
  },
  "SEC-ANP-EP": {
    orgao: "ANP",
    publicacao: "Página de dados abertos da fase de exploração.",
    acesso: "A carga abre essa página, lê os links do HTML e fica com o CSV mais novo cujo caminho contém blocos-sob-contrato. O arquivo escolhido é baixado com HTTP GET, sem chave.",
    links: [
      {
        papel: "Página lida para achar o CSV",
        url: "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/fase-exploracao",
        fixa: true,
        nota: "URL fixa em src/enrichment/extra.js. O endereço do CSV não está no código: é o href mais recente dessa página cujo caminho contém /bsc/ANO/blocos-sob-contrato e um mês no nome do arquivo.",
      },
    ],
  },
  "SEC-ANA-SNIRH": {
    orgao: "ANA, Sistema Nacional de Informações sobre Recursos Hídricos",
    publicacao: "Camadas públicas de outorgas superficiais, federal e estadual.",
    acesso: "Na coleta da ficha, o Radar consulta as duas camadas ao vivo, com HTTP GET e sem cópia nacional. O filtro é a raiz do CNPJ. Cada camada devolve até 6 outorgas, as de maior volume anual.",
    links: [
      {
        papel: "Outorgas federais",
        url: "https://portal1.snirh.gov.br/server/rest/services/Hosted/outorgas_federais_superficial/FeatureServer/0/query",
        fixa: true,
        nota: "URL fixa em src/enrichment/ana.js.",
      },
      {
        papel: "Outorgas estaduais",
        url: "https://portal1.snirh.gov.br/arcgis/rest/services/DADOSABERTOS/outorgas_estaduais_superficial/FeatureServer/0/query",
        fixa: true,
        nota: "URL fixa em src/enrichment/ana.js.",
      },
    ],
  },
  "CAPTURA-SIGMINE": {
    orgao: "Agência Nacional de Mineração",
    publicacao: "Pasta SIGMINE de processos minerários, um ZIP por estado.",
    acesso: "Na coleta, o Radar monta o endereço com a UF da ficha e baixa só o ZIP daquele estado. Não há varredura do país.",
    links: [
      {
        papel: "Pasta publicada",
        url: "https://dadosabertos.anm.gov.br/SIGMINE/",
        fixa: false,
        nota: "Índice da pasta. A coleta não lista esse índice para escolher o arquivo.",
      },
      {
        papel: "ZIP do estado da ficha",
        url: "https://dadosabertos.anm.gov.br/SIGMINE/PROCESSOS_MINERARIOS/",
        fixa: true,
        nota: "O prefixo é fixo em src/enrichment/sigmine.js. O arquivo é PROCESSOS_MINERARIOS/UF.zip, com a sigla do estado da ficha.",
      },
    ],
  },
  "CAPTURA-ONS-PAR": {
    orgao: "EPE, Empresa de Pesquisa Energética",
    publicacao: "Documentos de apoio do PET e do PELP, ciclo 2025, 2º semestre. O plano descreve obras da rede do ONS, mas o arquivo usado não está no site do ONS.",
    acesso: "A carga baixa o pacote 7z com HTTP GET, extrai o Excel e lê as abas Empreendimentos_PET e Empreendimentos_PELP. A página da publicação não é aberta.",
    links: [
      {
        papel: "Página da publicação",
        url: "https://www.epe.gov.br/pt/publicacoes-dados-abertos/publicacoes/programa-de-expansao-da-transmissao-pet-plano-de-expansao-de-longo-prazo-pelp-ciclo-2025-2-semestre",
        fixa: false,
        nota: "Página para uma pessoa abrir. A carga não lê o HTML dessa página para achar o anexo.",
      },
      {
        papel: "Pacote 7z baixado",
        url: "https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/PublicacoesArquivos/publicacao-943/02.Documentos%20de%20Apoio%20do%20PET-PELP%202o%20Sem%202025.7z",
        fixa: true,
        nota: "URL fixa em src/enrichment/ons.js. O ciclo seguinte, em outro endereço, não entra até essa linha ser trocada.",
      },
    ],
  },
  "CAPTURA-REIDI": {
    orgao: "Ministério dos Transportes",
    publicacao: "Conjunto Incentivo fiscal REIDI, no CKAN dados.transportes.gov.br.",
    acesso: "A carga abre a ficha do conjunto nessa API, escolhe o CSV mais novo que não seja dicionário e baixa esse arquivo. O endereço do CSV muda quando o ministério publica outro semestre.",
    links: [
      {
        papel: "Página da publicação",
        url: "https://dados.transportes.gov.br/dataset/incentivo-fiscal-reidi",
        fixa: false,
        nota: "Ficha humana do conjunto. A carga usa a API abaixo, não esta página.",
      },
      {
        papel: "API que aponta o CSV",
        url: "https://dados.transportes.gov.br/api/3/action/package_show?id=incentivo-fiscal-reidi",
        fixa: true,
        nota: "URL fixa em src/enrichment/reidi.js. O link do CSV em si não é fixo: é o recurso CSV mais recente da resposta.",
      },
    ],
  },
  "SEC-ANP-CAMPO": {
    orgao: "ANP",
    publicacao: "Produção de petróleo e gás por zona produtora, um CSV por mês.",
    acesso: "A carga monta o endereço dos oito meses anteriores e fica com o primeiro CSV que é de fato a tabela de produção. Plataformas, dutos e instalações só entram para ligar o campo ao operador.",
    links: [
      {
        papel: "Pasta da publicação",
        url: "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/arquivos-fase-de-desenvolvimento-e-producao/producao-por-zona",
        fixa: false,
        nota: "Pasta dos arquivos. A carga não lista essa página.",
      },
      {
        papel: "Prefixo do CSV mensal",
        url: "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/arquivos-fase-de-desenvolvimento-e-producao/producao-por-zona/producao_zona_",
        fixa: true,
        nota: "Prefixo fixo em src/enrichment/anp-listas.js. O arquivo é producao_zona_MM-AAAA.csv. O mês não está fixo: o código testa do mais recente para trás.",
      },
    ],
  },
  "SEC-ANP-PLAT": {
    orgao: "ANP",
    publicacao: "Lista de plataformas em operação.",
    acesso: "A carga baixa o CSV com HTTP GET, sem chave e sem abrir a página da pasta.",
    links: [
      {
        papel: "Pasta da publicação",
        url: "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/arquivos-fase-de-desenvolvimento-e-producao/lpo",
        fixa: false,
        nota: "Pasta. A carga não a abre.",
      },
      {
        papel: "CSV baixado",
        url: "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/arquivos-fase-de-desenvolvimento-e-producao/lpo/dados-abertos-plataformas-operacao.csv",
        fixa: true,
        nota: "URL fixa em src/enrichment/anp-listas.js.",
      },
    ],
  },
  "SEC-ANP-DUTO": {
    orgao: "ANP",
    publicacao: "Lista de códigos de dutos de exploração e produção.",
    acesso: "A carga baixa o CSV de dutos com HTTP GET, sem chave. O CSV de instalações é baixado no mesmo passo só para associar operador e campo.",
    links: [
      {
        papel: "Página da lista de códigos",
        url: "https://www.gov.br/anp/pt-br/assuntos/exploracao-e-producao-de-oleo-e-gas/desenvolvimento-e-producao/lista-de-codigos",
        fixa: false,
        nota: "Página da publicação. A carga não a abre.",
      },
      {
        papel: "CSV de dutos",
        url: "https://www.gov.br/anp/pt-br/assuntos/exploracao-e-producao-de-oleo-e-gas/desenvolvimento-e-producao/arquivos-lista-de-codigos/codigo-dutos.csv",
        fixa: true,
        nota: "URL fixa em src/enrichment/anp-listas.js.",
      },
      {
        papel: "CSV de instalações, só para o operador",
        url: "https://www.gov.br/anp/pt-br/assuntos/exploracao-e-producao-de-oleo-e-gas/desenvolvimento-e-producao/arquivos-lista-de-codigos/codigo-instalacoes.csv",
        fixa: true,
        nota: "URL fixa em src/enrichment/anp-listas.js. Não vira uma fonte separada.",
      },
    ],
  },
  "CAPTURA-QD": {
    orgao: "Open Knowledge Brasil, Querido Diário",
    publicacao: "API de trechos de diários oficiais municipais.",
    acesso: "Na coleta, o Radar resolve o município da ficha na API de localidades do IBGE e consulta a API do Querido Diário pelo nome da empresa. Não há arquivo local.",
    links: [
      {
        papel: "Site",
        url: "https://queridodiario.ok.org.br/",
        fixa: false,
        nota: "Site do projeto. A coleta não abre essa página.",
      },
      {
        papel: "API de trechos",
        url: "https://api.queridodiario.org.br/gazettes",
        fixa: true,
        nota: "URL fixa em src/enrichment/atos.js. O endereço antigo queridodiario.ok.org.br/api redireciona para este.",
      },
      {
        papel: "API do IBGE, para o código do município",
        url: "https://servicodados.ibge.gov.br/api/v1/localidades/estados/",
        fixa: true,
        nota: "Prefixo fixo em src/enrichment/atos.js. O caminho continua com a UF da ficha e /municipios.",
      },
    ],
  },
  "CAPTURA-SIGPUB": {
    orgao: "Associações estaduais de municípios, na plataforma SIGPub",
    publicacao: "Diários oficiais eletrônicos das associações, com prefeituras, câmaras e consórcios associados.",
    acesso: "Na coleta, o Radar escolhe as associações da UF da ficha e abre a busca pública de cada uma com o CNPJ, a raiz do CNPJ e o nome da empresa, de 2015 até a data da coleta. Não há chave nem login.",
    links: [
      {
        papel: "Portal da plataforma",
        url: "https://www.diariomunicipal.com.br/",
        fixa: true,
        nota: "Domínio fixo em src/enrichment/diarios.js. A lista de associações por UF fica em SIGPUB_UF.",
      },
      {
        papel: "Busca de uma associação (exemplo: AMM-MG)",
        url: "https://www.diariomunicipal.com.br/amm-mg/pesquisar",
        fixa: false,
        nota: "O caminho troca amm-mg pela associação da UF e recebe busca_avancada[texto], dataInicio, dataFim e pagina.",
      },
    ],
  },
  "CAPTURA-DOM-METAWAY": {
    orgao: "Prefeituras na plataforma Mentor (Metaway)",
    publicacao: "Diário oficial eletrônico de cada prefeitura, com busca por texto e PDF da edição.",
    acesso: "Na coleta, o Radar acha a prefeitura da ficha no mapa do conector, lista as edições com a marca da empresa e lê o PDF das seis mais recentes. Não há chave nem login.",
    links: [
      {
        papel: "Diário de Lençóis Paulista",
        url: "https://lencois.mentor.metaway.com.br/diario/",
        fixa: false,
        nota: "Página pública do diário. A coleta não abre essa página.",
      },
      {
        papel: "Lista de edições usada na coleta",
        url: "https://lencois.mentor.metaway.com.br/recurso/diario/lista",
        fixa: true,
        nota: "Domínio fixo em METAWAY_MUNICIPIOS, em src/enrichment/diarios.js. Recebe texto, dataInicial e dataFinal.",
      },
    ],
  },
  "CAPTURA-DOE-BA": {
    orgao: "Empresa Gráfica da Bahia (EGBA)",
    publicacao: "Diário Oficial do Estado da Bahia, com busca de texto integral por página desde 2007.",
    acesso: "Na coleta, o Radar chama a busca JSON do DOOL com a raiz do CNPJ e o nome entre aspas, desde 2015. O servidor omite o certificado intermediário, que vai embutido no conector. Não há chave.",
    links: [
      {
        papel: "Portal do diário",
        url: "https://dool.egba.ba.gov.br/",
        fixa: false,
        nota: "Página pública. O visualizador ver-flip é o link de cada evidência.",
      },
      {
        papel: "Busca usada na coleta",
        url: "https://dool.egba.ba.gov.br/busca/busca/buscar/query",
        fixa: true,
        nota: "URL fixa em src/enrichment/estaduais.js. O caminho continua com a página, di, df e o parâmetro q.",
      },
    ],
  },
  "CAPTURA-DOE-PR": {
    orgao: "Departamento de Imprensa Oficial do Estado do Paraná (DIOE)",
    publicacao: "Diário Oficial do Estado do Paraná, com busca de texto integral por página.",
    acesso: "Na coleta, o Radar chama a busca JSON do DIOE com a raiz do CNPJ e o nome entre aspas, desde 2015. Não há chave.",
    links: [
      {
        papel: "Portal do diário",
        url: "https://www.dioe.pr.gov.br/",
        fixa: false,
        nota: "Página pública. O PDF da página é o link de cada evidência.",
      },
      {
        papel: "Busca usada na coleta",
        url: "https://www.dioe.pr.gov.br/busca/busca/buscar/query",
        fixa: true,
        nota: "URL fixa em src/enrichment/estaduais.js. Mesmo motor do DOE-BA.",
      },
    ],
  },
  "CAPTURA-DOE-SP": {
    orgao: "Imprensa Oficial do Estado de São Paulo",
    publicacao: "Novo portal do Diário Oficial de SP, com busca avançada de atos desde maio de 2023.",
    acesso: "Na coleta, o Radar chama a API JSON de busca avançada com a raiz do CNPJ e depois com o nome, desde 2015, e lê até 100 atos por termo. Não há chave.",
    links: [
      {
        papel: "Portal do diário",
        url: "https://www.doe.sp.gov.br/",
        fixa: true,
        nota: "Domínio fixo em src/enrichment/estaduais.js. Cada ato fica nesse domínio seguido do slug.",
      },
      {
        papel: "API de busca usada na coleta",
        url: "https://do-api-web-search.doe.sp.gov.br/v2/advanced-search/publications",
        fixa: true,
        nota: "URL fixa em src/enrichment/estaduais.js. Recebe Terms[0], FromDate, ToDate, PageNumber, PageSize e SortField.",
      },
    ],
  },
  "CAPTURA-DOE-MG": {
    orgao: "Imprensa Oficial de Minas Gerais",
    publicacao: "Jornal Minas Gerais, diário oficial do estado, com texto pesquisável desde 2011.",
    acesso: "Na coleta, o Radar pede um token anônimo (POST /api/v1/Autenticacao/Autenticar com corpo {}, válido por 2 horas) e chama a pesquisa paginada com o cabeçalho Authorization: Bearer {token}, com a raiz do CNPJ e depois com o nome, desde 2015. Sem o token a pesquisa responde 401, inclusive aberta no navegador. O servidor omite o certificado intermediário, que vai embutido no conector.",
    links: [
      {
        papel: "Portal do jornal",
        url: "https://www.jornalminasgerais.mg.gov.br/",
        fixa: true,
        nota: "O visualizador edicao-do-dia, com os dados da página, é o link de cada evidência.",
      },
      {
        papel: "API usada na coleta",
        url: "https://www.jornalminasgerais.mg.gov.br/api/v1/Pesquisa/PesquisarJornaisPaginados",
        fixa: true,
        nota: "URL fixa em src/enrichment/estaduais.js. Exige Authorization: Bearer {token}; sem ele responde 401.",
      },
      {
        papel: "Token anônimo usado na coleta",
        url: "https://www.jornalminasgerais.mg.gov.br/api/v1/Autenticacao/Autenticar",
        fixa: true,
        nota: "POST com corpo {} e content-type application/json. Devolve o JWT em dados, válido por 2 horas. GET responde 405.",
      },
    ],
  },
  "SEC-SEMAD": {
    orgao: "Secretaria de Estado de Meio Ambiente e Desenvolvimento Sustentável de Minas Gerais",
    publicacao: "Camada pública de empreendimentos licenciados no SLA, na IDE-Sisema.",
    acesso: "Na coleta, o Radar chama o WFS do GeoServer da SEMAD com filtro CQL pelo nome do titular e lê até 500 licenças em GeoJSON. Não há chave.",
    links: [
      {
        papel: "WFS usado na coleta",
        url: "https://geoserver.meioambiente.mg.gov.br/ows",
        fixa: true,
        nota: "URL fixa em src/enrichment/estaduais.js, com a camada ide_2101_mg_empreendimentos_licenciados_pto.",
      },
      {
        papel: "Processo no SLA",
        url: "https://ecosistemas.meioambiente.mg.gov.br/sla/",
        fixa: false,
        nota: "Cada licença traz o link de visitante do próprio processo.",
      },
    ],
  },
  "CAPTURA-DOU": {
    orgao: "Imprensa Nacional",
    publicacao: "Busca pública do Diário Oficial da União.",
    acesso: "Na coleta, o Radar abre a busca com o nome da empresa entre aspas e lê o bloco de resultados que a página já traz. Dos atos devolvidos, guarda os cinco mais recentes e abre a página de cada um para escrever o resumo. Não percorre a edição do dia e não há chave. O limite de cinco atos mais recentes por consulta é uma escolha inicial e pode ser revisado.",
    links: [
      {
        papel: "Busca usada na coleta",
        url: "https://www.in.gov.br/consulta/-/buscar/dou",
        fixa: true,
        nota: "URL fixa em src/enrichment/atos.js. A consulta acrescenta q, delta=8 e sortType=0. Cada ato é lido em https://www.in.gov.br/web/dou/-/ seguido do slug urlTitle.",
      },
    ],
  },
  "SEC-ARTESP": {
    orgao: "ARTESP, São Paulo",
    publicacao: "Conjunto Programação de obras, no CKAN dadosabertos.artesp.sp.gov.br.",
    acesso: "A carga abre a ficha do conjunto pela API e escolhe o GeoJSON de obras que não seja de conservação nem de exemplo. Em 21/10/2026 esse arquivo preenchido não existe: a carga usa o template XLSX e marca exemplo=true. O nome das rodovias sai de um recurso separado, com identificador fixo.",
    links: [
      {
        papel: "Página da publicação",
        url: "https://dadosabertos.artesp.sp.gov.br/dataset/programacao-de-obras",
        fixa: false,
        nota: "Ficha humana. A carga usa a API abaixo.",
      },
      {
        papel: "API que aponta o arquivo de obras",
        url: "https://dadosabertos.artesp.sp.gov.br/api/3/action/package_show?id=programacao-de-obras",
        fixa: true,
        nota: "URL fixa em src/enrichment/artesp.js. O endereço do GeoJSON ou da planilha não é fixo: é o recurso de obras que essa resposta indicar.",
      },
      {
        papel: "Tabela de rodovias",
        url: "https://dadosabertos.artesp.sp.gov.br/api/3/action/datastore_search?resource_id=256427be-db00-49cc-9c85-feb3348ac9c0&limit=5000",
        fixa: true,
        nota: "URL e identificador do recurso fixos em src/enrichment/artesp.js. Serve para traduzir o código da rodovia.",
      },
    ],
  },
};

// Diários estaduais do registro: portal público e endereço exato que a coleta chama.
for (const estado of DOE_ESTADOS) {
  const indice = estado.motor === "indice_pdf";
  const arquivo = estado.motor === "ionews"
    ? "src/enrichment/estaduais.js (mapa DOOL)"
    : indice ? "src/enrichment/doe-pdf.js" : "src/enrichment/doe-estados.js";
  SOURCE_ORIGINS[estado.codigo] = {
    orgao: estado.orgao,
    publicacao: `${estado.nome}. ${estado.acervo}`,
    acesso: indice
      ? "O portal não tem busca de texto. O sincronizador do Radar lista as edições, baixa cada PDF e grava o texto de cada página em doe_pdf_pagina; na coleta, a ficha consulta esse índice com a raiz do CNPJ e o nome da empresa. Não há chave nem login."
      : `Na coleta, o Radar consulta ao vivo a busca do diário (${estado.modo}) com a raiz do CNPJ e o nome da empresa, desde 2015. Não há chave nem login.`,
    links: [
      {
        papel: "Portal do diário",
        url: estado.portal,
        fixa: false,
        nota: `Página pública do diário oficial do estado.${estado.aviso ? ` ${estado.aviso}` : ""}`,
      },
      {
        papel: indice ? "Listagem de edições lida pelo sincronizador" : "Busca usada na coleta",
        url: estado.busca,
        fixa: true,
        nota: `URL fixa em ${arquivo}.${estado.aviso ? ` ${estado.aviso}` : ""}`,
      },
    ],
  };
}

function sourceOrigin(codigo) {
  return SOURCE_ORIGINS[codigo] || null;
}

module.exports = { SOURCE_ORIGINS, sourceOrigin };
