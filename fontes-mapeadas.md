# Fontes mapeadas — Radar CapEx

Lista das fontes de dado e dos diretórios institucionais, em 28 de setembro de 2026. A descoberta mira projeto privado (fábrica, planta, mina, terminal, data center, concessão de empresa). Portal público permanece para enriquecer. A versão curta, só com nome, link e uma frase, está em [fontes-resumo.md](fontes-resumo.md). Cada ficha abaixo diz o que a fonte publica, como o dado sairia da extração, se isso já roda no sistema, e onde a coleta quebra.

Este arquivo é o catálogo completo: guarda também as fontes cadastradas e sem conexão, como referência. As que estão ligadas ao sistema, em 14 de outubro de 2026, são 28 e estão em [fontes-resumo.md](fontes-resumo.md): 6 primárias lidas pelo scanner (`src/scanner.js`, `src/ai.js`) e 22 secundárias consultadas na coleta da ficha (`src/enrichment/viability.js`, `src/enrichment/run.js`).

O scanner não baixa CSV, não chama API e não preenche formulário. Ele lê HTML de listagem, escolhe links e pede JSON à OpenAI. CNPJ não nasce da notícia. Valor de manchete permanece com confiança baixa até uma evidência secundária.

## Resumo

Só as fontes conectadas.

| Modo | Primárias | Secundárias |
| --- | ---: | ---: |
| API pública | 0 | 3 |
| API com chave | 0 | 1 |
| Dataset para download | 0 | 16 |
| Base consultável | 0 | 1 |
| Portal web | 6 | 1 |
| **Total** | **6** | **22** |

## Cobertura estadual e regional

As redes abaixo existem em todos os estados. O que entra no catálogo é o endereço em que a obra, a licença ou o contrato já aparece com nome, lugar ou valor. Página institucional sem lista, domínio não confirmado e relatório só com total regional ficam de fora.

**Já estava no catálogo, antes desta rodada.** Licenciamento: IAT (PR), CETESB (SP), INEA (RJ) e SEMAD (MG), mais o licenciamento federal do IBAMA. Atração: InvestSP. Financiamento federal: BNDES. Obra federal: Obrasgov. Diários: DOU, a família de diários estaduais e o Querido Diário.

**Entrou agora, com URL de dado confirmada.** Licenciamento: SEMAS (PA), FEPAM (RS) e SEMACE (CE). Obra pública estadual ou sob controle externo: Portal de Obras de Minas Gerais, TCE-PE, GeoObras Cidadão do TCE-GO e o Painel de Obras Paralisadas do TCU. Concessão rodoviária estadual: programação de obras da ARTESP. Diretórios: ABEMA, ABAR e ABDE.

### 1. Órgãos estaduais de meio ambiente

A licença prévia e a licença de instalação são o sinal de que um empreendimento com impacto territorial passou do papel. O diretório com o órgão de cada estado é a [ABEMA](https://www.abema.org.br/associados). A página traz nome, endereço e e-mail. Ela não traz o sistema de consulta nem o site de cada órgão. A página do SISNAMA no IBAMA explica a estrutura nacional; o rol de associados da ABEMA é o mapa dos órgãos seccionais.

Quatro consultas já estavam mapeadas (PR, SP, RJ, MG). Três consultas públicas foram confirmadas nesta rodada e viraram ficha: SIMLAM da SEMAS-PA, consulta da FEPAM e consulta do cidadão da SEMACE. O INEMA (BA) opera o SEIA em `seia.ba.gov.br`; a página de perguntas do instituto aponta o portal e o atendimento, sem uma lista aberta de licenças revalidada aqui. Os demais estados continuam alcançáveis pela ABEMA, sem URL de consulta inventada. O nome IBRAM no Distrito Federal é o Brasília Ambiental (`presidencia@ibram.df.gov.br` na ABEMA), órgão de meio ambiente, distinto do instituto privado de mineração que usa a mesma sigla.

Licença estadual pequena (posto, loteamento, supressão) é o ruído típico. O corte de R$ 100 milhões não existe nesses formulários.

### 2. Agências de atração de investimento

O protocolo de intenções antecede o anúncio e, em geral, só se torna público na notícia ou no diário oficial, que já estão no catálogo. A InvestSP já está mapeada, e a listagem `/noticias` respondeu 404 na checagem anterior.

Nesta rodada, dois portais foram localizados e não viraram fonte de dado. A [Invest Minas](https://www.mg.gov.br/servico/solicitar-o-apoio-da-invest-minas-na-implantacao-de-novas-empresas-em-minas-gerais) recebe plano de negócio e conduz o protocolo; não publica a carteira. A [ADECE](https://www.adece.ce.gov.br/projetos/) declara uma lista de projetos do Fundo de Desenvolvimento Industrial do Ceará, mas a página vista é o aviso e o canal de e-mail, sem tabela aberta de valor e município. Os outros domínios sugeridos para as 27 unidades não foram confirmados como o site oficial nem como lista de projetos, e ficam de fora até essa confirmação.

### 3. Tribunais de contas e sistemas de obras

Cada tribunal mantém o próprio cadastro. O Instituto Rui Barbosa tem comitê técnico de obras; isso não produz uma base nacional única. O nome GeoObras aparece em vários estados com softwares diferentes. No Espírito Santo, a resolução que obrigava o Geo-Obras foi revogada em 24 de janeiro de 2024 e a base pública parou nessa data. Em Goiás, o módulo interno dependeu de navegador antigo; o módulo cidadão em `geoobras.tce.go.gov.br/cidadao/` continua consultável e entrou no catálogo. A API do LicitaCon Obras do TCE-RS é o canal pelo qual o órgão jurisdicionado envia a obra, com credencial; não é leitura pública.

Entraram como dado confirmado: a API de dados abertos do TCE-PE (entidade `Remessa_Obra`, com valor medido e pago), o GeoObras Cidadão do TCE-GO e o [Painel de Obras Paralisadas do TCU](https://paineis.tcu.gov.br/obrasparalisadas). O painel do TCU reúne obra com recurso federal, atualizado em semestre. Comunicado de julho de 2025 usa dados até abril de 2025: 11.469 obras paralisadas, metade do total, com educação e saúde na maior parte. O recorte grande de CapEx se cruza com o Obrasgov; o ganho é a marca de paralisação. O cadastro do TCE-SP e o SIM-AM do TCE-PR existem como obrigação do jurisdicionado. O painel público baixável de cada um não foi revalidado como arquivo nesta checagem, então não viraram ficha. O portal de dados do TCE-RJ destaca débitos e multas; o SIGFIS é a remessa mensal dos jurisdicionados.

### 4. Bancos e agências de fomento

O diretório do Sistema Nacional de Fomento é a [ABDE](https://abde.org.br/sistema-nacional-de-fomento/). O documento de metodologia ABDE-PNUD enumera 34 instituições: bancos federais (BNDES, Banco do Brasil, BNB, BASA, Caixa), bancos comerciais públicos, bancos de desenvolvimento (BDMG, BRDE, BANDES) e agências de fomento (Desenvolve SP, AgeRio, Desenbahia, Fomento Paraná, Badesc, Badesul, Goiás Fomento, Desenvolve MT, AGN, AFESE/AFEAM, Piauí Fomento e outras), além de Finep, Sebrae e bancos cooperativos.

O BNDES já está no catálogo, com CSV de operação, CNPJ e valor. O BNB publica o relatório anual do FNE (em 2024, R$ 44,8 bilhões contratados e cerca de 1,5 milhão de operações, no Nordeste, no norte de Minas e no norte do Espírito Santo). O BASA faz o equivalente com o FNO na Região Norte. Esses relatórios são totais regionais. Não foi encontrado um CSV de operação comparável ao do BNDES, então BNB, BASA, BRDE e as agências estaduais ficam apontados pela ABDE, sem ficha de extração. Banco do Brasil, Caixa, Sebrae e cooperativas financiam muito crédito miúdo; não são lista de obra.

### 5. Agências reguladoras estaduais

O diretório é a [ABAR](https://abar.org.br/nossas-associadas/), com agências federais, estaduais, municipais e intermunicipais. Em 2026 a associação informou 86 associadas depois de uma leva de filiações municipais. A página lista o nome. Ela não lista, na mesma visão, o plano de investimento da concessionária.

A ficha nova é a programação de obras da ARTESP: as concessionárias paulistas entregam a programação anual de obras contratuais (CapEx), em planilha e GeoJSON. O portal também tem editais e contratos. A página de planos da ARSAE-MG acompanha se o município atualizou o plano de saneamento; não é a obra. O plano de gestão da ARSESP é o plano da própria agência. As outras reguladoras estaduais (AGENERSA, AGETRANSP, AGEPAR, AGERGS, AGERBA, ARCE, ARPE, AGER-MT e as demais da lista da ABAR) ficam atrás do diretório até aparecer cronograma de investimento com valor.

Agência municipal de saneamento fica de fora do catálogo. O porte típico está abaixo do corte, e o número de agências repetiria o problema dos 5.570 portais locais.

### Atalho de descoberta

Consulta em buscador (`site:.gov.br` com licença de instalação, protocolo de intenções ou valor) é um método para achar uma URL nova. O resultado cai em notícia, diário ou página de serviço que já têm ficha, ou em licença pequena. A consulta não é uma fonte e não entra no catálogo.

## API Pública

API aberta, sem chave ou cadastro, consultada diretamente pelo sistema.

### IAT Licenças GIS (PR)

`SEC-IAT` · Secundária · Enriquecimento

- **URL:** https://geopr.iat.pr.gov.br/server/rest/services/00_PUBLICACOES/licencas_ambientais_sia_sga/FeatureServer/0
- **Registro:** licença georreferenciada
- **Formato:** GIS / FeatureServer
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** API Pública

**O que publica.** Protocolo, razão social, IBGE, modalidade, datas e coordenadas.

**Explicação.** ArcGIS REST público; máx. 2000 por página.

**Formato do dado extraído.** JSON do ArcGIS FeatureServer: protocolo, razão social, código IBGE, modalidade, atividade, datas de emissão e validade, e coordenadas. Não há valor de obra.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Consulta paginada (resultOffset), no máximo 2000 feições por página, com where por data ou município. Cada feição vira evidência secundária ligada por CNPJ ou nome, nunca um projeto novo sozinha.

**Erros e problemas comuns.** O serviço corta a página em 2000 e devolve exceededTransferLimit. Sem o offset seguinte, o restante do Paraná some. Campo de razão social vem com grafia instável.

**Limites.** Só licenças do IAT/PR. Não é o processo completo do SGA, que exige login. Sem CapEx. Atualização do serviço não é a mesma cadência do extrato mensal em PDF.

**Erros possíveis na extração.** Timeout do ArcGIS, JSON sem geometry, código IBGE ausente, e licença de atividade pequena misturada com empreendimento grande porque não existe filtro de valor.

### Obrasgov

`SEC-OBRASGOV` · Secundária · Enriquecimento

- **URL:** https://api-publica.obrasgov.gestao.gov.br/obras/docs
- **Registro:** obra com recurso federal
- **Formato:** API JSON
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** API Pública

**O que publica.** Obras com recursos federais, valor, situação, execução e contratos.

**Explicação.** Não cobre obra privada nem exclusivamente estadual.

**Formato do dado extraído.** JSON paginado: projeto de investimento, situação, valor previsto, CNPJs (responsável, executor, tomador), geometria, contratos, empenhos e execução física. A chave estável é id_projeto_investimento.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** GET /projeto-investimento com page e page_size (padrão 50). O valor mínimo não existe na query: o corte de R$ 100 milhões é feito depois, em investimentos_previstos. Contratos e execução física são endpoints separados, cruzados pelo mesmo id.

**Erros e problemas comuns.** A API descreve obra com recurso federal, preenchida pelo gestor. Situação atrasada e valor previsto diferente do pago são normais. Paginação agressiva devolve erro ou página vazia.

**Limites.** Não cobre obra privada nem obra só estadual ou municipal. Um projeto Radar pode ser vários ids. O filtro de valor no cliente exige percorrer páginas, não um único GET.

**Erros possíveis na extração.** total_pages divergente do que foi lido, vl_investimento_previsto nulo, CNPJ de órgão no lugar da empresa, e obra paralisada ainda marcada como em execução.

### PNCP

`SEC-PNCP` · Secundária · Enriquecimento

- **URL:** https://pncp.gov.br/api/consulta/swagger-ui/index.html
- **Registro:** compra ou contrato público
- **Formato:** API JSON
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** API Pública

**O que publica.** Compras e contratos públicos (edital, homologação, contrato, aditivo).

**Explicação.** Consulta sem chave. Valor client-side; modalidades 4 e 5.

**Formato do dado extraído.** JSON de contratação ou contrato: numeroControlePNCP, órgão, fornecedor (CNPJ e razão), valorGlobal ou valorTotalEstimado, modalidade, datas e processo. A unidade é o ato de compra, não a obra.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Consulta pública em /api/consulta, sem chave. Listas por data yyyyMMdd. Contratações pedem modalidade; página máxima 50. Contratos aceitam até 500. O corte de valor é no cliente, priorizando modalidades 4 e 5 (concorrência).

**Erros e problemas comuns.** Uma obra grande vira várias licitações. valorGlobal pode ser o contrato inteiro, não o CapEx do empreendimento. Paginar rápido devolve HTTP 500. Datas no formato errado esvaziam a lista.

**Limites.** Não há status físico da obra. Órgão que não publicou no PNCP não aparece. Integração de escrita exige JWT e está fora do Radar.

**Erros possíveis na extração.** Fornecedor genérico (consórcio sem CNPJ claro), valor homologado nulo na fase de edital, e duplicata entre contratação e contrato do mesmo controle.

### Querido Diário

`CAPTURA-QD` · Primária · Descoberta

- **URL:** https://api.queridodiario.ok.org.br/docs
- **Registro:** diário municipal
- **Formato:** API JSON
- **Acesso:** Público · situação ok
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** API Pública

**O que publica.** Busca por código IBGE e texto, com trecho e edição. Não cobre DOU nem diários estaduais, e não reúne todos os municípios.

**Explicação.** Mapear. É o único conector pronto para decreto e licença municipal. Uso futuro: consulta pontual quando o projeto já tem município.

**Formato do dado extraído.** JSON da busca: município (IBGE), trecho do diário, data da edição e link. Não é ficha de projeto.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Consulta pontual quando o projeto já tem município e um termo (licença, concessão, obra). Não varrer todos os municípios.

**Erros e problemas comuns.** A cobertura municipal é incompleta. DOU e diários estaduais não estão aqui. O trecho é OCR ou texto de gazeta: nome de empresa quebra no meio da linha.

**Limites.** Não substitui Obrasgov nem PNCP. Decreto municipal pequeno gera muito ruído para o corte de R$ 100 milhões.

**Erros possíveis na extração.** IBGE errado, edição atrasada, trecho sem o valor, e falso positivo de 'obra' em texto administrativo.

### TCE-PE Dados Abertos — obras

`SEC-TCE-PE` · Secundária · Enriquecimento

- **URL:** https://sistemas.tcepe.tc.br/DadosAbertos/Exemplo!listar
- **Registro:** obra fiscalizada pelo Tribunal de Contas de Pernambuco
- **Formato:** API JSON
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** API Pública

**O que publica.** Obras e serviços de engenharia remetidos ao TCE-PE, com situação, datas, total medido, total pago e geometria.

**Explicação.** Mapear. É obra estadual e municipal de Pernambuco, fora do Obrasgov quando não há recurso federal. A entidade útil é Remessa_Obra.

**Formato do dado extraído.** JSON da API de dados abertos. A entidade Remessa_Obra devolve identificador da obra, instrumento jurídico, situação, datas de início e conclusão, texto livre, total medido, total pago e tipo de geometria. Entidades vizinhas trazem a empresa contratada e a execução.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Listar o catálogo em `/DadosAbertos/Exemplo!listar` e ler `Remessa_Obra` com filtro de situação ou data. O corte de R$ 100 milhões usa total medido ou total pago no cliente. Cruzar com a entidade de contratação para achar o CNPJ.

**Erros e problemas comuns.** O dado é declarado pelo jurisdicionado. Obra parada pode continuar com situação antiga. Geometria vem vazia, com justificativa em texto. A URL usa `!` no caminho, o que quebra cliente HTTP mal configurado.

**Limites.** Só Pernambuco. Creche, posto e pavimentação curta dominam a contagem. Não cobre CapEx privado. Não substitui o Obrasgov quando o recurso é federal.

**Erros possíveis na extração.** Total pago parcial lido como CapEx, obra concluída antiga ainda na remessa, e contrato de supervisão no lugar da construtora.

## API Privada

API que exige cadastro e credencial de acesso, mantida somente no backend.

### Base dos Dados

`SEC-BD` · Secundária · Consulta pontual

- **URL:** https://basedosdados.org/
- **Registro:** linha tratada de outra fonte
- **Formato:** Formatos mistos
- **Acesso:** Projeto GCP · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** API Privada

**O que publica.** Lake tratado (CNO, BNDES, CNPJ, sanções) para aprofundar projeto conhecido.

**Explicação.** Dados exigem projeto GCP. Metadados GraphQL são públicos. Não varrer o Brasil.

**Formato do dado extraído.** Tabela BigQuery já tratada (CNO, operação BNDES, CNPJ, sanção). Cada conjunto tem colunas próprias. Metadados GraphQL são públicos; a linha exige projeto GCP.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** SQL filtrado por CNPJ, id_cno ou contrato, com billing_project_id. Nunca SELECT sem WHERE. Não duplicar o dump oficial se a origem (BNDES, CNO, CNPJ) já foi lida.

**Erros e problemas comuns.** Snapshot com data_extracao repetida infla a contagem. Sem billing, a query nem começa. Cota gratuita do BigQuery estoura em tabela cheia.

**Limites.** Não é fonte de descoberta diária. Atraso igual à origem mais o ETL. Várias bases do catálogo não têm tabela.

**Erros possíveis na extração.** Linha histórica antiga tratada como atual, CNPJ de matriz no lugar do estabelecimento, e custo de query por esquecer o filtro.

### Contratos do DNIT no Portal da Transparência

Fora do MVP desde 21 de outubro de 2026. É despesa pública federal. O Radar não a consulta. O avanço físico da obra direta do DNIT continua no Portal Cidadão.

### Portal Brasileiro de Dados Abertos

`SEC-DADOSGOV` · Secundária · Índice de fontes

- **URL:** https://dados.gov.br/swagger-ui/index.html
- **Registro:** conjunto de dados
- **Formato:** API JSON
- **Acesso:** Chave de API · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** API Privada

**O que publica.** Catálogo de conjuntos e URLs de recursos; não são linhas de obra.

**Explicação.** Header chave-api-dados-abertos. Índice, não banco de projetos.

**Formato do dado extraído.** JSON de catálogo: id do conjunto, órgão, periodicidade e URL do arquivo. Não vem a linha da obra.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** GET /dados/api/publico/conjuntos-dados com pagina e header chave-api-dados-abertos. Serviria para vigiar se o recurso do CNO, CNPJ ou SIGA mudou de URL.

**Erros e problemas comuns.** Sem a chave, 401. Busca por 'obra' mistura campus, cinema e CNO. O portal cataloga; o arquivo continua no órgão.

**Limites.** Não é banco de projetos. Não monitora canteiro. POST de publicação de órgão está fora.

**Erros possíveis na extração.** Recurso 404 depois que o órgão troca o ZIP, pagina obrigatória omitida, e conjunto certo com arquivo desatualizado no metadado.

### Portal da Transparência (CGU)

Fora do MVP desde 21 de outubro de 2026. A fonte trata de dinheiro público federal. O Radar não a consulta.

## Dataset para download

Arquivo estruturado, como CSV ou ZIP, baixado para processamento em lote.

### ANEEL SIGA

`SEC-SIGA` · Secundária · Enriquecimento

- **URL:** https://dadosabertos.aneel.gov.br/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel
- **Registro:** usina / empreendimento de geração
- **Formato:** CSV ou ZIP
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** Dataset para download

**O que publica.** Usinas, CEG, fase, MW, municípios e coordenadas.

**Explicação.** CSV/CKAN; fase e MW são melhores que notícia.

**Formato do dado extraído.** CSV/XML via CKAN: NomEmpreendimento, CodCEG, fase, tipo de outorga, MW, UF, municípios e coordenadas. Potência é proxy de porte, não reais.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Baixar o recurso CSV do dataset, filtrar fase diferente de operação, e cruzar com a notícia por CEG, nome ou município. Atualização diária ou mensal, conforme o recurso.

**Erros e problemas comuns.** Arquivo grande e encoding. Nome de empreendimento muda entre versões e o CEG permanece. Usina em várias linhas municipais.

**Limites.** Geração, não transmissão. Não traz R$. API Conecta por CEG é OAuth e não é este dump. Fase 'operação' não é pipeline.

**Erros possíveis na extração.** CSV com separador trocado, coordenada zerada, MW em kW lido como MW, e empreendimento revogado ainda na fase antiga.

### ANP Dados de E&P

`SEC-ANP-EP` · Secundária · Enriquecimento

- **URL:** https://www.gov.br/anp/pt-br/assuntos/exploracao-e-producao-de-oleo-e-gas/dados-de-e-p/dados-de-exploracao-e-producao
- **Registro:** bloco, campo ou instalação
- **Formato:** CSV ou ZIP
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** Dataset para download

**O que publica.** Blocos, concessionários, comercialidade, campos, plataformas e dutos.

**Explicação.** CSV/painéis; CDP/APEX com captcha. Sem R$ da FPSO.

**Formato do dado extraído.** CSV e painéis: bloco, concessionário, PEM, declaração de comercialidade, campo, plataforma e duto. Sem o R$ da FPSO.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Baixar o CSV de comercialidade e desenvolvimento. Consulta CDP/APEX fica de fora por causa de captcha. Cruzar com notícia por nome do campo ou operadora.

**Erros e problemas comuns.** Vários arquivos, sem REST única. Contrato oficial não está no CSV. Painel Power BI não é extraível como tabela.

**Limites.** Fase de exploração não é obra. Sem valor. Operadora muda e o bloco continua.

**Erros possíveis na extração.** Campo e bloco com o mesmo nome, CSV de ano diferente misturado, e captcha se alguém apontar o job para a consulta interativa.

### ANTAQ Instalações portuárias

`SEC-ANTAQ-INST` · Secundária · Enriquecimento

- **URL:** https://www.gov.br/antaq/pt-br/acesso-a-informacao/dados-abertos
- **Registro:** instalação portuária
- **Formato:** CSV ou ZIP
- **Acesso:** Público · situação ok
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Dataset para download

**O que publica.** Cadastro de TUP/porto: quem opera e onde.

**Explicação.** CSV trimestral; estatístico aquaviário não é obra.

**Formato do dado extraído.** CSV trimestral de instalação portuária: quem opera, tipo (porto, TUP) e onde. Estatística aquaviária é movimentação, outro arquivo.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Baixar o CSV de instalações e usar como lookup do ativo citado na notícia. Não tratar tonelada movimentada como CapEx.

**Erros e problemas comuns.** Obra nova quase não aparece como linha de investimento. Nome do terminal não bate com a manchete. Atualização trimestral.

**Limites.** Cadastro, não valor e não cronograma de obra.

**Erros possíveis na extração.** Instalação desativada ainda no arquivo, código antigo de arrendamento, e ZIP estatístico lido no lugar do cadastro.

### ANTT Investimentos da concessão

`SEC-ANTT-INV` · Secundária · Enriquecimento

- **URL:** https://dados.antt.gov.br/
- **Registro:** investimento da concessão
- **Formato:** CSV ou ZIP
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** Dataset para download

**O que publica.** Obras da concessionária com valor: duplicação, praça, pátio, ferrovia.

**Explicação.** CKAN público; melhor R$ regulatório deste conjunto.

**Formato do dado extraído.** CSV/JSON no CKAN: investimento da concessão (cadastro, autorização, planejamento, acompanhamento, encerramento). Traz valor, trecho e objeto. É o melhor R$ regulatório deste grupo.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** package_search no dados.antt.gov.br, baixar o recurso de investimentos e filtrar valor e situação. Grupo de ferrovias é outro conjunto.

**Erros e problemas comuns.** Obra da concessionária não é obra do DNIT nem do Obrasgov. Vários registros por trecho (planejado versus executado). CKAN muda o id do recurso.

**Limites.** Só o que está no contrato de concessão. Duplicação em estudo não é canteiro.

**Erros possíveis na extração.** Valor de PIC acumulado lido como uma obra só, trecho sem km, e JSON com lista aninhada que o parser achata errado.

### BNDES Operações de Financiamento

`SEC-BNDES` · Secundária · Enriquecimento

- **URL:** https://dadosabertos.bndes.gov.br/dataset/operacoes-financiamento
- **Registro:** operação de financiamento
- **Formato:** CSV ou ZIP
- **Acesso:** Público · situação ok
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Dataset para download

**O que publica.** CNPJ, descrição do projeto, valor contratado e desembolso.

**Explicação.** Usar operações não automáticas; atualização mensal.

**Formato do dado extraído.** CSV Windows-1252, também datastore CKAN: numero do contrato, cliente, CNPJ, descricao_do_projeto, valor_contratado_reais, desembolso, produto, CNAE, município e situação. Atualização mensal.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Ler só operações não automáticas (cerca de 23,8 mil linhas, ~19 MiB). Filtrar valor >= 100 milhões e setor. datastore_search sem token funciona nesse conjunto.

**Erros e problemas comuns.** O arquivo de indiretas automáticas tem ~1,1 GiB e não deve ser baixado inteiro. Descrição do projeto é texto curto, não o nome de engenharia. Situação do contrato não é a fase da obra.

**Limites.** Financiamento, não a obra. Não substitui Obrasgov. Agregados de desembolso por UF não são lista de projetos. Sobreposição com a Base dos Dados: usar um só.

**Erros possíveis na extração.** Encoding quebrado (R$ e acento), CNPJ sem zeros à esquerda, valor em milhares interpretado como reais, e operação FINAME pequena se o filtro de valor falhar.

### CNO dados abertos (RFB)

`SEC-CNO` · Secundária · Enriquecimento

- **URL:** https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-de-obras-cno
- **Registro:** obra civil
- **Formato:** CSV ou ZIP
- **Acesso:** Público · situação ok
- **Recorrência:** alta
- **Coleta automática:** não
- **Modo:** Dataset para download

**O que publica.** Obra física: coluna CNO, responsável, situação, área e CNAE. Sem valor.

**Explicação.** ZIP/CSV diário. Não usar e-CAC. Sobreposição com FONTE-011.

**Formato do dado extraído.** ZIP diário com cinco CSV de cabeçalho, vírgula e ISO-8859-1: `cno.csv`, `cno_cnaes.csv`, `cno_vinculos.csv`, `cno_areas.csv` e `cno_totais.csv`. A chave é a coluna CNO, de 12 dígitos. Situação sai como código (01 nula, 02 ativa, 03 suspensa, 14 paralisada, 15 encerrada). NI e nome empresarial ficam em branco quando o responsável é pessoa física. Área, categoria e destinação estão em `cno_areas.csv`, com o texto do dicionário (Obra Nova, Galpão industrial), não o número. Sem valor.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo.** `npm run dadosgov:sync` baixa o ZIP quando a data ou o tamanho mudam e extrai os cinco CSV na pasta do conjunto. O PDF do dicionário é baixado uma vez e não entra na conferência seguinte. A ficha lê o `cno.csv` extraído e completa a amostra com áreas, CNAEs, vínculos e a contagem de `cno_totais.csv`. e-CAC não entra: só mostra obra do próprio usuário.

**Erros e problemas comuns.** Arquivo nacional grande. Situação muda e o id permanece. Área grande não prova CapEx de R$ 100 milhões. Mesmo cadastro que br_rf_cno na Base dos Dados.

**Limites.** Obra civil inscrita na Receita, não o contrato e não a usina que não é CNO. Lookup, não descoberta nacional diária no hot path.

**Erros possíveis na extração.** Tratar o CSV como arquivo sem cabeçalho, CNO com menos de 12 dígitos, NI em branco (pessoa física) lido como CNPJ, situação 15 encerrada tratada como ativa, e número do dicionário de área no lugar do texto que o CSV grava.

### CNPJ dados abertos (RFB)

`SEC-CNPJ` · Secundária · Consulta pontual

- **URL:** https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-da-pessoa-juridica---cnpj
- **Registro:** estabelecimento
- **Formato:** CSV ou ZIP
- **Acesso:** Público · situação ok
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Dataset para download

**O que publica.** Razão social, CNAE, endereço, situação, sócios e capital social.

**Explicação.** Dump mensal. Lookup de empresa; não descobre obra.

**Formato do dado extraído.** ZIP mensal, CSV sem cabeçalho, separador ponto e vírgula, ISO-8859-1: Empresas, Estabelecimentos, Sócios, Simples. Razão, CNAE, endereço, situação, porte, capital social.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Não carregar os 70 milhões de estabelecimentos no caminho da busca. Montar lookup só dos CNPJs que o Radar já viu. URL do arquivo muda (dadosabertos.rfb.gov.br e arquivos.receitafederal.gov.br).

**Erros e problemas comuns.** Capital social não é CapEx. Estabelecimento filial tem endereço diferente da matriz. Arquivo sem header: coluna deslocada corrompe tudo. Download de dezenas de GB.

**Limites.** Enriquece empresa. Não descobre obra. Atualização mensal, então situação cadastral atrasa.

**Erros possíveis na extração.** Encoding Latin-1 lido como UTF-8, CNPJ partido entre raiz e ordem, CNAE desatualizado, e URL 404 porque o mês virou.

### CVM dados abertos IPE

`SEC-CVM-IPE` · Secundária · Enriquecimento

- **URL:** https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe
- **Registro:** documento IPE
- **Formato:** CSV ou ZIP
- **Acesso:** Público · situação ok
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Dataset para download

**O que publica.** ZIP semanal de IPE: empresa, categoria, assunto e PDF.

**Explicação.** Bulk complementar à consulta ENETWeb.

**Formato do dado extraído.** ZIP semanal em dados.cvm.gov.br: metadados do documento (código CVM, empresa, categoria, tipo, assunto, data) e, em outro fluxo, o PDF. O texto do CapEx está no PDF, não na linha do índice.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Baixar o ZIP do período, filtrar categoria fato relevante ou comunicado, e só então abrir o PDF da empresa já ligada ao projeto. Complementa o formulário ENETWeb, não o substitui para consulta pontual.

**Erros e problemas comuns.** ZIP grande, PDF escaneado sem texto, assunto genérico ('outros'). Vários documentos no mesmo dia para a mesma empresa.

**Limites.** Companhia aberta. SPE fechada não aparece. Não há campo CapEx estruturado.

**Erros possíveis na extração.** PDF sem camada de texto, assunto que não cita o projeto, e versão retificadora ignorada se só a primeira entrega for lida.

### IBAMA SISLIC

`SEC-IBAMA` · Secundária · Enriquecimento

- **URL:** https://dadosabertos.ibama.gov.br/pt_BR/dataset/licencas-ambientais-de-atividades-e-empreendimentos-licenciados-pelo-ibama
- **Registro:** licença ambiental
- **Formato:** CSV ou ZIP
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** Dataset para download

**O que publica.** Licenças LP/LI/LO, empreendimento, titular, processo e datas.

**Explicação.** Cobertura federal; não substitui órgãos estaduais.

**Formato do dado extraído.** CSV/JSON do CKAN: empreendimento, pessoa, número do processo, tipologia, tipo de licença (LP, LI, LO, ASV) e datas. Atualização perto de diária. Sem valor.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Baixar o recurso, filtrar tipologia de infra, óleo, porto e duto, e cruzar por nome, CNPJ ou processo. Consulta LAF e SEI ficam para o documento, não para este dump.

**Erros e problemas comuns.** Licença federal não cobre a maior parte das obras estaduais. O mesmo empreendimento tem várias licenças. Nome do empreendimento não bate com a manchete.

**Limites.** Ato de licença, não contrato. Processo completo pede vista. PNLA/MMA é agregado incompleto e não substitui este CSV.

**Erros possíveis na extração.** Tipologia genérica demais, data de validade vazia, pessoa física no lugar da SPE, e ASV (supressão) tratada como licença de instalação.

### ONS — Plano de Ampliações e Reforços

`CAPTURA-ONS-PAR` · Secundária · Enriquecimento

- **URL:** https://www.ons.org.br/paginas/energia-no-futuro/transmissao/expansao
- **Registro:** obra de transmissão planejada
- **Formato:** PDF
- **Acesso:** Público · situação ok
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Dataset para download

**O que publica.** A página oficial descreve o PAR/PET e oferece documentos para download. A amostra visível não é uma tabela aberta de obras com valor; o ciclo termina em outorga da ANEEL.

**Explicação.** Mapear. Antecipa reforço e ampliação que o leilão e o SIGA enxergam depois. O conector, quando existir, lê o documento consolidado, não a página institucional inteira.

**Formato do dado extraído.** PDF do Plano de Ampliações e Reforços, não uma tabela aberta de obras com valor. A página HTML só descreve o plano e aponta o arquivo.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Baixar o documento consolidado do ciclo, extrair obra, subestação ou linha, e parar. A outorga definitiva continua na ANEEL. Não raspar a página institucional inteira.

**Erros e problemas comuns.** PDF de planejamento muda de layout a cada ciclo. Obra do PAR pode não virar leilão. Não há R$ confiável na amostra vista.

**Limites.** Transmissão planejada. Não é o SIGA (geração) nem o canteiro. Cadência baixa.

**Erros possíveis na extração.** Tabela do PDF lida como parágrafo, obra de reforço pequeno no meio de linha de transmissão, e versão antiga do PAR ainda no ar.

### Projetos aprovados no REIDI

`CAPTURA-REIDI` · Primária · Descoberta

- **URL:** https://www.gov.br/transportes/pt-br/assuntos/incentivos/reidi
- **Registro:** projeto enquadrado
- **Formato:** CSV ou ZIP
- **Acesso:** Público · situação ok
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Dataset para download

**O que publica.** O Ministério dos Transportes publica a lista e uma planilha de projetos aprovados ou habilitados. Há CSV no dados.transportes.gov.br. A habilitação também sai no DOU. A página de energia do MME indicada não foi confirmada.

**Explicação.** Mapear. O enquadramento fiscal antecede a obra e traz titular e projeto. Começar pelo CSV de transportes; portos e energia seguem por DOU até aparecer planilha equivalente.

**Formato do dado extraído.** Planilha/CSV de projetos aprovados ou habilitados no REIDI de transportes: titular e nome do projeto. A habilitação também sai como ato no DOU. A página de energia do MME não foi confirmada como a mesma planilha.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Começar pelo CSV de dados.transportes.gov.br. Portos e energia, enquanto não houver planilha, entram só quando a portaria aparecer no DOU.

**Erros e problemas comuns.** Enquadramento fiscal não é licença nem ordem de serviço. Lista de habilitados inclui projeto que não sai do papel. CSV e página HTML podem divergir.

**Limites.** Não traz cronograma físico. Não cobre todo setor: energia ainda não tem o mesmo arquivo confirmado.

**Erros possíveis na extração.** Planilha com projeto 'habilitado' lido como 'em obra', titular do pedido diferente da SPE da obra, e CSV de transportes aplicado a um projeto de porto.

### SIGMINE / dados abertos da ANM

`CAPTURA-SIGMINE` · Secundária · Enriquecimento

- **URL:** https://dadosabertos.anm.gov.br/SIGMINE/
- **Registro:** processo minerário
- **Formato:** CSV ou ZIP
- **Acesso:** Público · situação ok
- **Recorrência:** alta
- **Coleta automática:** não
- **Modo:** Dataset para download

**O que publica.** Arquivos atualizados de processos, lavra e áreas, incluindo BRASIL.zip e metadados. Não traz valor de CapEx.

**Explicação.** Mapear. É o mapa dos títulos minerários, diferente da notícia da ANM já catalogada. Uso futuro: localizar o processo quando a notícia já citou a empresa ou o município.

**Formato do dado extraído.** ZIP/CSV e metadados em dadosabertos.anm.gov.br/SIGMINE, inclusive BRASIL.zip: processo, fase, substância, titular e área. Sem CapEx.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Baixar o pacote nacional, indexar número do processo e titular, e consultar quando a notícia já citou empresa ou município. Não varrer polígono como se fosse obra.

**Erros e problemas comuns.** Arquivo nacional pesado. Fase do processo (pesquisa, lavra) não é fase de construção. Título antigo continua no mapa.

**Limites.** Cadastro minerário, distinto da notícia da ANM. Não substitui licença ambiental estadual.

**Erros possíveis na extração.** Processo com vários polígonos virando vários projetos, titular desatualizado após cessão, e substância genérica.

### SINISA

`CAPTURA-SINISA` · Secundária · Enriquecimento

- **URL:** https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa
- **Registro:** indicador de saneamento
- **Formato:** CSV ou ZIP
- **Acesso:** Público · situação ok
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Dataset para download

**O que publica.** Resultados anuais em planilha por módulo (água, esgoto, resíduos, drenagem e gestão). O endereço sinisa.cidades.gov.br é a área do prestador, não um dump de obras.

**Explicação.** Mapear. Substitui o SNIS a partir de 2024, mas entrega indicador e investimento agregado. Não lista ETE ou ETA como projeto.

**Formato do dado extraído.** Planilha anual por módulo (água, esgoto, resíduos, drenagem, gestão): indicador e investimento agregado do prestador ou município. sinisa.cidades.gov.br é área do prestador, não dump.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Baixar a planilha do ano e do módulo. Usar como contexto do operador, não como lista de ETE.

**Erros e problemas comuns.** Investimento agregado não separa a obra. Série muda de questionário. Ano corrente atrasa.

**Limites.** Não lista projeto. Não substitui licitação, BNDES nem notícia. SNIS antigo para em outro endereço.

**Erros possíveis na extração.** Soma municipal lida como CapEx de uma ETE, prestador regional partido por município, e módulo de resíduos misturado com esgoto.

### ARTESP — programação de obras

`SEC-ARTESP` · Secundária · Enriquecimento

- **URL:** https://dadosabertos.artesp.sp.gov.br/dataset/programacao-de-obras
- **Registro:** programação de obra da concessão rodoviária paulista
- **Formato:** XLSX / GeoJSON
- **Acesso:** Público · situação ok
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Dataset para download

**O que publica.** Programação anual das concessionárias de rodovias de São Paulo: conservação de rotina e obras contratuais (CapEx), por rodovia, programa e atividade. O mesmo portal publica editais e contratos das concessões.

**Explicação.** Mapear. É o cronograma obrigatório da concessão estadual, com valor de obra, distinto do tráfego e do acidente que também estão no portal.

**Formato do dado extraído.** Planilha e GeoJSON no padrão da ARTESP (template de obras e template de conservação). A obra contratual traz rodovia, programa, atividade e período. O arquivo `rodovias.xlsx` é o de-para de códigos, não a lista de obras.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Baixar o conjunto `programacao-de-obras`, separar o template de obras contratuais do template de conservação e cruzar o lote com o contrato publicado no conjunto de editais. Conservação de rotina sai do corte de CapEx.

**Erros e problemas comuns.** O portal mistura CapEx, conservação, acidente e tráfego de feriado. A concessionária entrega a programação; atraso de um lote deixa o ano incompleto. Código de rodovia sem o de-para não vira trecho.

**Limites.** Só malha concedida de São Paulo sob a ARTESP. Não cobre rodovia federal (ANTT) nem obra direta do DER sem concessão. Programação não é medição executada.

**Erros possíveis na extração.** Conservação de rotina somada como obra nova, lote com nome de arquivo fora do padrão, e GeoJSON sem coordenada quando o envio ainda está em XLSX.

### Portal de Obras de Minas Gerais

`SEC-OBRAS-MG` · Secundária · Enriquecimento

- **URL:** https://dados.mg.gov.br/dataset/portal_obras
- **Registro:** obra do Poder Executivo de Minas Gerais
- **Formato:** CSV / data package
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** Dataset para download

**O que publica.** Obras do Executivo mineiro, em arquivos anuais: obra, contrato, situação, município, coordenadas, fiscais e trechos. Atualização vista em 10 de junho de 2026.

**Explicação.** Mapear. Cobre obra estadual de Minas que o Obrasgov não vê quando não há recurso federal. O conjunto segue o padrão de data package.

**Formato do dado extraído.** Pacote com recursos separados (obra, contratos, situacao, municipios, coordenadas, fiscais, trechos) e `datapackage.json`. A unidade é a obra do órgão estadual, com contrato e geometria em arquivos ligados.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Baixar o pacote do ano, ligar obra e contrato pela chave do pacote e aplicar o corte de valor no cliente. Coordenada e município servem para cruzar com a licença da SEMAD.

**Erros e problemas comuns.** Arquivo anual: o ano corrente pode estar incompleto. Situação depende do órgão que alimenta o portal. Obra municipal de Minas não está neste conjunto; ela segue para o tribunal de contas.

**Limites.** Só Poder Executivo estadual. Sem CapEx privado. Sobreposição com Obrasgov quando a mesma obra tem convênio federal.

**Erros possíveis na extração.** Contrato de fiscalização no lugar da obra, trecho duplicado por arquivo anual, e valor do contrato lido duas vezes ao juntar os recursos do pacote.

## Base consultável

Base extensa acessada por formulário ou pesquisa pontual em um portal.

### ANA Outorgas SNIRH

`SEC-ANA-SNIRH` · Secundária · Enriquecimento

- **URL:** https://www.snirh.gov.br/
- **Registro:** outorga de uso da água
- **Formato:** GIS / FeatureServer
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** Base consultável

**O que publica.** Outorgas de uso da água, ponto, empreendimento, vazão e datas.

**Explicação.** GIS SNIRH; SNIS/SINISA fica fora (FONTE-007 em estudo).

**Formato do dado extraído.** Camada GIS de outorga: ponto, empreendimento, vazão, finalidade e datas. Não é cadastro de usina (isso é SIGA) nem de ETE (isso não está no SNIS).

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Consulta espacial ou por nome quando o projeto hídrico já existe. FeatureServer com paginação. Não baixar o Brasil inteiro para achar uma captação.

**Erros e problemas comuns.** Outorga pequena de irrigação domina o volume. Nome do empreendimento é fraco. Camada federal e estadual convivem.

**Limites.** Sinal de uso da água. Sem valor de obra. Metas de universalização da ANA não têm URL confirmada e ficam fora.

**Erros possíveis na extração.** Vazão de outorga lida como porte da usina, ponto fora do município do projeto, e outorga vencida ainda na camada.

### ANBIMA Data — debêntures de infraestrutura

`CAPTURA-ANBIMA` · Secundária · Consulta pontual

- **URL:** https://data.anbima.com.br/bussola
- **Registro:** oferta de debênture
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Base consultável

**O que publica.** Ofertas, emissor, segmento e volume. Não descreve a obra nem substitui a portaria de enquadramento.

**Explicação.** Mapear. Confirma que uma SPE captou recurso. Fica atrás de REIDI e DOU, porque a emissão é posterior ao projeto.

**Formato do dado extraído.** Página/listagem de oferta: emissor, segmento e volume da debênture. Não descreve a obra.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Consulta pontual pelo emissor já conhecido. A portaria de enquadramento, anterior, está no DOU; o REIDI e o DOU vêm antes desta fonte.

**Erros e problemas comuns.** Site de mercado muda o HTML. Volume da emissão não é o CapEx total. Emissor pode ser SPE com nome opaco.

**Limites.** Confirma captação, não descobre o canteiro. Sem chave de obra.

**Erros possíveis na extração.** Oferta de empresa do mesmo grupo atribuída ao projeto errado, e volume em milhares.

### ANEEL SIGEL

`SEC-SIGEL` · Secundária · Enriquecimento

- **URL:** https://sigel.aneel.gov.br/portal/home/
- **Registro:** camada de empreendimento
- **Formato:** GIS / FeatureServer
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** Base consultável

**O que publica.** Mapa de empreendimentos de geração e camadas geo.

**Explicação.** Painel/GIS; Conecta Outorgas é OAuth, não dump.

**Formato do dado extraído.** Camadas de mapa (empreendimento de geração) via portal ArcGIS. Não é o CSV do SIGA e não é a API OAuth do Conecta.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Lookup geográfico quando o CEG ou o nome já veio do SIGA. Não raspar o painel como se fosse planilha.

**Erros e problemas comuns.** Camada e popup mudam. Geometria simplificada. Duplica o SIGA com menos atributo de fase.

**Limites.** Mapa, não valor, não contrato. Conecta por CEG exige OAuth e está fora.

**Erros possíveis na extração.** Empreendimento duplicado entre SIGA e SIGEL com nome diferente, coordenada do centróide fora do município.

### CETESB Licenciamento (SP)

`SEC-CETESB` · Secundária · Enriquecimento

- **URL:** https://licenciamento.cetesb.sp.gov.br/
- **Registro:** andamento de licença
- **Formato:** Formulário de consulta
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** Base consultável

**O que publica.** Andamento LP/LI/LO por CNPJ, razão social ou endereço.

**Explicação.** HTML; e-Ambiente exige login e pedido de vista.

**Formato do dado extraído.** HTML de consulta pública: tipo LP/LI/LO, situação e validade, pesquisável por CNPJ, razão ou endereço. PDF do processo só depois de pedido de vista no e-Ambiente, com login.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Lookup pontual, um CNPJ por vez, quando o projeto em SP já existe. Sem dump e sem loop de CNPJ.

**Erros e problemas comuns.** Formulário quebra com razão social parcial. Vários processos para o mesmo CNPJ. Captcha ou sessão podem aparecer.

**Limites.** Só São Paulo e só o andamento público. Não é o estudo completo. Não inventar licença se a consulta voltar vazia.

**Erros possíveis na extração.** Processo de outra unidade da empresa, licença de operação antiga, e HTML de 'nenhum registro' interpretado como falha de rede.

### CVM IPE / Fatos Relevantes

`SEC-CVM` · Secundária · Enriquecimento

- **URL:** https://www.rad.cvm.gov.br/ENETWeb/frmConsultaExternaCVM.aspx
- **Registro:** fato relevante
- **Formato:** Formulário de consulta
- **Acesso:** Público · situação ok
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Base consultável

**O que publica.** Fatos relevantes e comunicados de companhias abertas.

**Explicação.** A raiz RAD é login; consulta pública fica em ENETWeb.

**Formato do dado extraído.** Grade HTML do ENETWeb: código CVM, empresa, categoria, assunto, data e link do documento. A raiz rad.cvm.gov.br é login Gov.br e não é a consulta.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Preencher o formulário público (empresa ou período) e guardar a URL do documento. O ZIP semanal é o caminho de lote; este é o caminho pontual. PDF entra como evidência.

**Erros e problemas comuns.** Viewstate ASP.NET muda e um POST cego falha. Assunto genérico. Vários fatos no mesmo dia.

**Limites.** Companhia aberta. Não estrutura CapEx. Não substitui o ZIP para varredura histórica.

**Erros possíveis na extração.** Post no formulário de login em vez do ENETWeb, documento protocolado sem PDF ainda, e empresa homônima.

### Enquadramento de debêntures incentivadas

`CAPTURA-DEBENTURES` · Secundária · Enriquecimento

- **URL:** https://www.gov.br/pt-br/servicos/solicitar-enquadramento-de-projetos-de-investimento-prioritarios-para-emissao-de-debentures-incentivados-e-de-infraestrutura-no-mt
- **Registro:** pedido de enquadramento
- **Formato:** Formulário de consulta
- **Acesso:** Público · situação ok
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Base consultável

**O que publica.** A página do Ministério dos Transportes recebe o pedido. A aprovação de projeto subnacional sai em portaria no DOU. Não há base aberta de projetos aprovados nesse endereço.

**Explicação.** Já coberto. O canal de protocolo não é a fonte dos projetos. O ato útil continua sendo a portaria no Diário Oficial.

**Formato do dado extraído.** A URL é a página de serviço para protocolar pedido no Ministério dos Transportes. Não há lista aberta de projetos aprovados nesse endereço. O ato útil é a portaria no DOU.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Não extrair esta página como fonte de projetos. Quando a portaria sair, a extração é a do DOU (ato, interessado, objeto).

**Erros e problemas comuns.** Quem ler o formulário de protocolo como se fosse uma base recebe zero projetos ou só texto institucional.

**Limites.** Já coberto pelo DOU. Sem base própria.

**Erros possíveis na extração.** Confundir pedido em análise com projeto aprovado, e gravar a URL do serviço como evidência de uma obra.

### IBAMA Consultas LAF

`SEC-IBAMA-LAF` · Secundária · Enriquecimento

- **URL:** https://www.gov.br/ibama/pt-br/assuntos/laf/consultas
- **Registro:** processo de licenciamento
- **Formato:** Formulário de consulta
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** Base consultável

**O que publica.** Consulta de licenciamento federal, EIA/RIMA e processo.

**Explicação.** URL /licenciamento-ambiental 404. Processo completo via SEI/vista.

**Formato do dado extraído.** Páginas e consultas do LAF: processo, EIA/RIMA e ato, em HTML/PDF. A URL antiga /licenciamento-ambiental responde 404. O processo inteiro continua no SEI, com vista.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Abrir a consulta pelo número que já veio do CSV SISLIC. Guardar a URL do ato ou do RIMA. Não baixar o SEI.

**Erros e problemas comuns.** Portal Plone com 403 em HEAD. Documento público e peça sigilosa no mesmo processo. Nome do arquivo opaco.

**Limites.** Complemento do CSV, não substituto. Sem valor. Sem licença estadual.

**Erros possíveis na extração.** 404 da URL velha, RIMA de outro empreendimento no mesmo processo, e HTML de listagem sem o PDF.

### INEA SELCA (RJ)

`SEC-INEA` · Secundária · Enriquecimento

- **URL:** https://portallicenciamento.inea.rj.gov.br/
- **Registro:** processo ambiental
- **Formato:** Formulário de consulta
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** Base consultável

**O que publica.** Processos e EIA/RIMA do licenciamento estadual do RJ.

**Explicação.** Sem bulk oficial; lookup pontual.

**Formato do dado extraído.** Consulta HTML de processo e, quando publicado, EIA/RIMA. Sem bulk oficial. SELCA é portal do requerente.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Lookup por processo, CNPJ ou nome, um projeto do RJ por vez. Gravar só URL que abriu.

**Erros e problemas comuns.** Mais de um sistema (SELCA, SCUP, SEI-RJ). Resultado vazio não distingue 'não licenciou' de 'formulário errado'.

**Limites.** Só RJ. Documento completo pode não estar público.

**Erros possíveis na extração.** Processo homônimo, EIA de estudo antigo, e timeout do portal.

### SEMAD Consulta de Licenças (MG)

`SEC-SEMAD` · Secundária · Enriquecimento

- **URL:** https://sistemas.meioambiente.mg.gov.br/licenciamento/site/consulta-licenca
- **Registro:** decisão de licença
- **Formato:** Formulário de consulta
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** Base consultável

**O que publica.** Decisões e licenças por órgão e município em Minas Gerais.

**Explicação.** Formulário HTML; SLA autenticado para o processo.

**Formato do dado extraído.** Formulário HTML de decisão/licença por órgão e município. Extrato, não o processo SLA, que é autenticado.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Consulta pontual com município e nome. Sem varredura de todos os municípios de MG.

**Erros e problemas comuns.** Resultado amplo demais se o município vier sozinho. Grafia do empreendimento diverge da notícia.

**Limites.** Só Minas Gerais e só o que a consulta mostra. Sem valor.

**Erros possíveis na extração.** Licença de outro órgão estadual no mesmo município, extrato sem número de processo, e página que exige seleção não preenchida.

### SIMEC — obras de educação

`CAPTURA-SIMEC` · Secundária · Enriquecimento

- **URL:** https://simec.mec.gov.br/
- **Registro:** obra de educação
- **Formato:** Formulário de consulta
- **Acesso:** Chave de API · situação bloqueado
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Base consultável

**O que publica.** Acompanha obras de universidades, institutos e hospitais universitários. Dump público não foi confirmado.

**Explicação.** Adiar. Exige acesso institucional. Só vale um conector se aparecer painel ou arquivo aberto com obra, valor e situação.

**Formato do dado extraído.** Sistema de obras de educação (universidade, instituto, hospital universitário). Dump público não confirmado. Acesso institucional.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Não há extração. Só faria sentido se surgisse painel ou arquivo aberto com obra, valor e situação.

**Erros e problemas comuns.** Login de gestor. Sem arquivo aberto, qualquer scrape quebra na autenticação. Porte típico muitas vezes abaixo de R$ 100 milhões.

**Limites.** Fora do conector enquanto estiver bloqueado. Não usar a capa do MEC como lista de obras.

**Erros possíveis na extração.** Sessão expirada, obra de reforma pequena, e valor de convênio lido como CapEx privado.

### SISMOB e painéis do Fundo Nacional de Saúde

`CAPTURA-SISMOB` · Secundária · Enriquecimento

- **URL:** https://portalfns.saude.gov.br/sistemas/sismob/
- **Registro:** obra de saúde
- **Formato:** Formulário de consulta
- **Acesso:** Chave de API · situação bloqueado
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Base consultável

**O que publica.** O SISMOB cadastra obra de saúde financiada fundo a fundo e pede credencial de gestor. Há painel público no InvestSUS, mas a unidade é obra de saúde, em geral abaixo do corte de grande CapEx.

**Explicação.** Adiar. fns.saude.gov.br não é a fonte de obras. O sistema certo existe, porém o acesso aberto e o porte típico não justificam coleta agora.

**Formato do dado extraído.** Cadastro de obra de saúde fundo a fundo, com credencial de gestor. O painel público citado é o InvestSUS, unidade obra de saúde, em geral abaixo do corte.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Não extrair agora. fns.saude.gov.br não é a lista de obras.

**Erros e problemas comuns.** Credencial, obra pequena, e painel que não expõe contrato. Confundir repasse do fundo com empreendimento privado.

**Limites.** Adiado. Sem corte de grande CapEx confiável.

**Erros possíveis na extração.** Obra de UBS tratada como hospital de grande porte, e acesso 401.

### SNIS — série histórica

`CAPTURA-SNIS` · Secundária · Consulta pontual

- **URL:** https://app4.cidades.gov.br/serieHistorica/
- **Registro:** série histórica do prestador
- **Formato:** Formulário de consulta
- **Acesso:** Público · situação ok
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Base consultável

**O que publica.** Série por prestador e município, inclusive investimentos realizados, com exportação. O conjunto no portal de dados das Cidades estava parado em 2023.

**Explicação.** Mapear. Serve para olhar o passado do operador. snis.gov.br não é a URL canônica atual.

**Formato do dado extraído.** Série histórica por prestador e município, com investimentos realizados, exportável na aplicação. O conjunto no portal de dados das Cidades estava parado em 2023. snis.gov.br não é a URL canônica.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Consulta do prestador já identificado, exportar a série, e usar como contexto. A obra em si não está na linha.

**Erros e problemas comuns.** Série antiga convive com o SINISA novo. Investimento realizado é agregado anual. Prestador muda de código.

**Limites.** Não lista ETE. Não substitui o SINISA para anos recentes.

**Erros possíveis na extração.** Ano de 2023 lido como atual, soma de vários municípios, e URL antiga vazia.

### FEPAM — consulta de processos (RS)

`SEC-FEPAM` · Secundária · Enriquecimento

- **URL:** http://ww3.fepam.rs.gov.br/spogweb/e016/
- **Registro:** processo ou documento de licenciamento no Rio Grande do Sul
- **Formato:** HTML de formulário
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** Base consultável

**O que publica.** Processos administrativos e documentos licenciatórios da FEPAM a partir de 1999: licença, autorização, certificado e decisão de cancelamento ou suspensão. A busca é por processo, CNPJ, razão social, endereço, município ou ramo de atividade.

**Explicação.** Mapear. Consulta pontual quando o projeto já tem empresa ou município no Rio Grande do Sul. O site institucional novo é fepam.rs.gov.br; o formulário confirmado continua no endereço antigo.

**Formato do dado extraído.** HTML da consulta. A busca específica devolve o processo ou o documento de um empreendedor. A busca abrangente devolve o ramo de atividade num município. Não há arquivo único para baixar.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Consultar por CNPJ ou razão social já extraídos da notícia. Guardar número do processo, tipo de documento e município como evidência secundária. Não varrer todos os municípios.

**Erros e problemas comuns.** O formulário é ASP antigo e pode sair do ar sem o site novo cair. Razão social não aceita nome fantasia. Documento de 1999 convive com licença vigente.

**Limites.** Só o que a FEPAM licencia. Licença municipal do RS não está aqui. Sem valor de obra. Atividade pequena (posto, loteamento) aparece junto com planta industrial.

**Erros possíveis na extração.** Homônimo de razão social, licença vencida lida como LI vigente, e município da sede no lugar do município do empreendimento.

### SEMACE — consulta de processos (CE)

`SEC-SEMACE` · Secundária · Enriquecimento

- **URL:** https://www.semace.ce.gov.br/consulta-de-processos/
- **Registro:** processo de licenciamento no Ceará
- **Formato:** HTML de formulário
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** Base consultável

**O que publica.** A página separa acesso do cidadão e acesso do empreendedor. O sistema Natuur (`natuur.semace.ce.gov.br`) é o canal do interessado, com login, para protocolo e declaração.

**Explicação.** Mapear. A consulta do cidadão é o caminho de enriquecimento. Em 2019 a Semace anunciou exportação em planilha; essa exportação não foi reaberta como arquivo nesta checagem.

**Formato do dado extraído.** HTML da consulta pública: processo, interessado, município e tipo. O anúncio antigo citava CNPJ, número da licença e download em Excel ou PDF. O Natuur devolve requerimento do usuário logado, não a carteira do estado.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Abrir o acesso do cidadão e buscar pelo CNPJ ou pelo município já conhecidos. Não autenticar no Natuur para varrer requerimentos.

**Erros e problemas comuns.** Os dois acessos se confundem. Login do empreendedor não lista o estado inteiro. A página de consulta é curta e o formulário pode estar um clique adiante, sujeito a mudança de caminho.

**Limites.** Só competência da SEMACE. Sem CapEx. Licença dispensada pela Lei 15.190/2025 não é obra grande.

**Erros possíveis na extração.** Declaração de dispensa lida como LP, processo de pessoa física, e planilha anunciada em 2019 que não existe mais.

### SEMAS-PA — SIMLAM público

`SEC-SEMAS-PA` · Secundária · Enriquecimento

- **URL:** https://monitoramento.semas.pa.gov.br/simlam/ListarProcessos.aspx
- **Registro:** processo ambiental no Pará
- **Formato:** HTML de formulário
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** Base consultável

**O que publica.** Processos do SIMLAM: interessado, CPF/CNPJ, nome do empreendimento, tipo (licenciamento, outorga, renovação de LI, prorrogação de LP) e situação (em análise, licenciado, suspenso, arquivado).

**Explicação.** Mapear. É a consulta pública de licenciamento do Pará, estado de mineração, porto e energia. O SISLAM (`sislam.pa.gov.br`) é o licenciamento municipal e fica de fora.

**Formato do dado extraído.** HTML da listagem filtrada. Campos úteis: interessado, CNPJ do empreendimento, nome, tipo de processo e situação. Não há valor de obra nem coordenada garantida na lista.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Busca pontual por CNPJ, nome do empreendimento ou interessado já citados na notícia. Filtrar tipo de licenciamento e situação licenciada ou em análise. Outorga, CAR e infração saem do recorte.

**Erros e problemas comuns.** O mesmo portal mistura licença, autuação, CAR e outorga. A listagem é ASP.NET e depende de viewstate. Nome de empreendimento e razão social divergem.

**Limites.** Só o que a SEMAS-PA protocolou no SIMLAM. Sem CapEx. Processo florestal e de infração geram volume muito maior que a planta industrial.

**Erros possíveis na extração.** Autuação lida como licença, empreendimento homônimo em outro município, e situação "licenciado" de uma LO antiga.

### TCE-GO — GeoObras Cidadão

`SEC-TCE-GO` · Secundária · Enriquecimento

- **URL:** https://geoobras.tce.go.gov.br/cidadao/
- **Registro:** obra pública cadastrada no TCE de Goiás
- **Formato:** HTML de formulário
- **Acesso:** Público · situação ok
- **Recorrência:** desconhecida
- **Coleta automática:** não
- **Modo:** Base consultável

**O que publica.** Consulta de obras dos órgãos goianos: órgão, município, empresa, tipo (aeroporto, barragem, escola, drenagem, linha elétrica e outros), situação e valores executados. O painel cidadão visto nesta checagem somava 1.194 obras cadastradas.

**Explicação.** Mapear. O módulo de jurisdicionado e de auditor chegou a depender de navegador antigo depois do fim do Flash. A face pública é este formulário.

**Formato do dado extraído.** HTML filtrado por órgão, município, empresa, tipo e situação. O total executado aparece agregado no painel e, na ficha, por obra. A alimentação é do próprio jurisdicionado.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Consultar por empresa ou município já conhecidos, ou por tipo de obra compatível com CapEx (barragem, aeroporto, linha, obra de arte). Aplicar o corte de valor no resultado. Não baixar o cliente desktop do módulo interno.

**Erros e problemas comuns.** Dado declarado, com atraso. Escola e creche dominam a quantidade. O módulo interno fora do ar não invalida o cidadão, e o contrário também acontece.

**Limites.** Só Goiás. Obra privada não entra. Valor executado não é o CapEx previsto. Não há API confirmada.

**Erros possíveis na extração.** Total do painel lido como uma obra, situação paralisada desatualizada, e empresa de supervisão no lugar da construtora.

### TCU — Painel de Obras Paralisadas

`SEC-TCU-OBRAS` · Secundária · Enriquecimento

- **URL:** https://paineis.tcu.gov.br/obrasparalisadas
- **Registro:** obra com recurso federal paralisada ou inacabada
- **Formato:** Painel
- **Acesso:** Público · situação ok
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Base consultável

**O que publica.** Obras financiadas com recurso federal, com destaque para as paralisadas. Comunicado do TCU de 30 de julho de 2025 diz que o painel foi atualizado com dados até abril de 2025: 11.469 obras paralisadas, 50,7% do total, a maior parte em educação e saúde.

**Explicação.** Mapear. Cruza com o Obrasgov. O dado novo é a paralisação consolidada pelo controle externo, em ritmo semestral, não a descoberta de CapEx privado.

**Formato do dado extraído.** Painel. A unidade é a obra com recurso federal e a situação de paralisação. O comunicado oficial não publica um CSV único; a extração, quando existir, parte do que o painel oferecer para download na data da coleta.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Usar como evidência de paralisação de uma obra que já está no Radar pelo Obrasgov ou pela notícia. Filtrar porte antes de criar candidato. Educação e saúde de pequeno valor saem.

**Erros e problemas comuns.** Atualização semestral: a obra retomada continua parada no painel até a carga seguinte. O mesmo empreendimento pode existir no Obrasgov com situação diferente. Creche e posto inflam a contagem.

**Limites.** Recurso federal. Não cobre obra privada nem obra só estadual. Não substitui execução física do Obrasgov.

**Erros possíveis na extração.** Obra retomada ainda marcada como parada, unidade de saúde contada como CapEx de R$ 100 milhões, e duplicata com o id do Obrasgov sem chave comum.

## Portal Web

Páginas, listagens ou notícias lidas por navegação e extração de HTML.

### AEN Paraná

`NEWS-AENPR` · Primária · Descoberta

- **URL:** https://www.aen.pr.gov.br/
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação indisponível
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Notícias oficiais do Estado do Paraná.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. Listing vazio na vedação eleitoral (Lei 9.504).

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. Na vedação eleitoral a listagem ficou vazia. HTML abre e não há matéria.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Página 200 com zero notícias não é erro HTTP. O scanner registra acesso ok e descobre 0 links, o que parece fonte saudável porém muda.

**Limites.** Agência estadual não cobre o IAT. Silêncio eleitoral não significa ausência de obra.

**Erros possíveis na extração.** Lista vazia, notícia institucional de governo, e UF inferida errada se o texto não disser PR.

### Agência Gov (EBC)

`NEWS-AGENCIA-GOV` · Primária · Descoberta

- **URL:** https://agenciagov.ebc.com.br/noticias
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** alta
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Repete ministérios; CapEx só com filtro de palavras-chave.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. Capa mistura Enem/SUS; filtro obrigatório.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa de propósito. A capa mistura Enem, SUS e Ceasa; CapEx é exceção.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Republica ministérios. A mesma matéria já entrou pela fonte oficial, com outra URL, e furaria a chave única.

**Limites.** Filtro de palavra é obrigatório e o scanner atual ainda deixaria passar muito ruído. Oito links não resolvem a capa genérica.

**Erros possíveis na extração.** Duplicata de notícia ministerial, pauta social com a palavra 'obra', e valor de programa federal.

### Agência iNFRA

`NEWS-INFRA` · Primária · Descoberta

- **URL:** https://agenciainfra.com/blog/
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** alta
- **Coleta automática:** sim, scanner piloto
- **Modo:** Portal Web

**O que publica.** Infraestrutura, concessões, energia, saneamento e regulação.

**Explicação.** No scanner do piloto. Listing em /blog/; /feed/ retorna 404.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Sim, no scanner do piloto. A listagem usada é /blog/. /feed/ responde 404 e não é o caminho.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Corpo pode estar em paywall: a matéria cai no título e no lead. O feed 404 não pode ser tratado como fonte caída se /blog/ abriu.

**Limites.** Oito links por rodada. Não lê o arquivo inteiro do blog. Valor da manchete fica com confiança baixa até uma fonte secundária. Não extrai CNPJ.

**Erros possíveis na extração.** Lead promocional no lugar do dek, matéria de regulação sem obra passando no termo 'concessão', e timeout na matéria longa.

### ANEEL Notícias

`NEWS-ANEEL` · Primária · Descoberta

- **URL:** https://www.gov.br/aneel/pt-br/assuntos/noticias
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação instável
- **Recorrência:** média
- **Coleta automática:** sim, scanner piloto
- **Modo:** Portal Web

**O que publica.** Leilões, lotes, outorgas, MW e entrada em operação.

**Explicação.** No scanner do piloto. Gov.br pode responder 403 a HEAD; acesso no navegador funciona.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Sim, no scanner do piloto, com acesso instável. A listagem Plone abre no GET com User-Agent; HEAD frequentemente volta 403.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** WAF. Se o HTML for a página de bloqueio, zero links e a fonte fica instável. Ruído de tarifa, bandeira e audiência compete com leilão.

**Limites.** Oito links. Notícia oficial não traz CEG estruturado; o CEG continua no SIGA. Categoria TRANSMISSÃO não vira cadastro de linha.

**Erros possíveis na extração.** 403 intermitente, lead institucional sem R$, e 'consulta pública' classificada como projeto por conter MW.

### ANM Notícias

`NEWS-ANM` · Primária · Descoberta

- **URL:** https://www.gov.br/anm/pt-br/assuntos/noticias
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação instável
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Processos minerários, lavra e regularização.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. WAF 403 em HEAD.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. WAF e pouca recorrência. O processo está no SIGMINE.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Regularização e multa parecem projeto porque o título cita lavra.

**Limites.** Sem número de processo estruturado no HTML.

**Erros possíveis na extração.** 403 e título de portaria genérica.

### ANP Notícias

`NEWS-ANP` · Primária · Descoberta

- **URL:** https://www.gov.br/anp/pt-br/assuntos/noticias
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação instável
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Blocos, comercialidade, leilões e unidades de E&P.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. WAF 403 em HEAD.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. WAF. Bloco e plataforma estruturados estão no CSV de E&P.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Leilão de bloco não traz o US$ da unidade.

**Limites.** Não abre o painel de E&P. Oito links se ativada.

**Erros possíveis na extração.** 403, bloco em exploração classificado como FPSO em construção.

### ANTAQ Notícias

`NEWS-ANTAQ` · Primária · Descoberta

- **URL:** https://www.gov.br/antaq/pt-br/assuntos/noticias
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação instável
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Portos, TUPs, arrendamentos e autorizações aquaviárias.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. WAF 403 em HEAD.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. WAF. O cadastro de instalação é o CSV, não a notícia.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Autorização e estatística de movimentação dividem a capa.

**Limites.** Sem código de instalação no HTML. Oito links se ativada.

**Erros possíveis na extração.** 403 e recorde de toneladas lido como obra.

### ANTT Notícias

`NEWS-ANTT` · Primária · Descoberta

- **URL:** https://www.gov.br/antt/pt-br/assuntos/noticias
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação instável
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Concessões rodoviárias e ferroviárias, investimentos e trechos.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. WAF 403 em HEAD.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. WAF 403 em HEAD. O cadastro com valor está no CKAN de investimentos, não nesta listagem.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Multa e tarifa usam o mesmo Plone de concessão.

**Limites.** Não lê o CSV. Oito links se ativada.

**Erros possíveis na extração.** 403, notícia de tarifa com R$, e trecho sem identificador de contrato.

### BNDES Imprensa

`NEWS-BNDES` · Primária · Descoberta

- **URL:** https://www.bndes.gov.br/wps/portal/site/home/imprensa
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Aprovações de crédito, cliente, setor e valor anunciado.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. Path guiadobndes não lista pauta. Ecoa FONTE-009.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. A listagem é /wps/portal/site/home/imprensa. O path antigo guiadobndes não lista pauta.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Portal WCM, HTML pesado, muito link institucional. A mesma aprovação já está, com CNPJ, no CSV de operações.

**Limites.** Notícia não substitui o dataset. Valor anunciado pode ser desembolso, não contratado. Editais de varejo e produto social entram no mesmo HTML.

**Erros possíveis na extração.** URL antiga vazia, valor de linha de crédito inteira, e cliente citado sem ser o dono do projeto.

### Brasil Mineral

`NEWS-BRASILMIN` · Primária · Descoberta

- **URL:** https://www.brasilmineral.com.br/
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** alta
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Lavra, planta, LI e projetos minerários.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. Ruído de cotação de minério.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. Título mais uma linha (Moz, R$, UF). Cotação de minério é ruído.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Onça e Moz passam no score por terem número. O valor de commodity não é CapEx e o modelo pode preenchê-lo mesmo assim se o texto for ambíguo.

**Limites.** Oito links. Sem número de processo ANM. LI citada não vira evidência de licença.

**Erros possíveis na extração.** Preço do minério no campo valor_capex, moz convertido errado, e projeto no exterior.

### CanalEnergia

`NEWS-CANALENERGIA` · Primária · Descoberta

- **URL:** https://www.canalenergia.com.br/
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Captcha ou paywall · situação bloqueado
- **Recorrência:** alta
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Usinas, leilões e geração; CEG implícito.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. Cloudflare; preferir MegaWhat no piloto.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não, e não deve ser ligada assim. Cloudflare bloqueia o GET. O scanner receberia página de desafio, sem matéria. Preferir MegaWhat.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Bloqueio antes do HTML. Não há RSS utilizável sem passar pelo mesmo desafio.

**Limites.** Zero links úteis enquanto o desafio existir. Sem CEG estruturado mesmo se o texto aparecesse.

**Erros possíveis na extração.** HTTP 403 ou 503, HTML de 'checking your browser', e candidato vazio marcado como erro da fonte.

### Diário Oficial da União

`CAPTURA-DOU` · Primária · Descoberta

- **URL:** https://www.in.gov.br/
- **Registro:** ato oficial
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** alta
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Publica leilão, licença, portaria de REIDI e portaria de projeto prioritário. Não há API de projeto.

**Explicação.** Mapear. É a publicação que torna vários sinais fiscais oficiais. A captura útil é busca por ato, não varredura integral do diário.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Não usar o scanner de notícia nesta capa: o diário inteiro não é listagem de projeto.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** O processo certo é busca por termo ou seção (portaria de REIDI, licença, leilão), não os 8 primeiros links da home. O scanner atual faria exatamente o errado.

**Limites.** Ato oficial confirma publicação. Não traz coordenada, CEG nem percentual físico. PDF do DOU é outra etapa.

**Erros possíveis na extração.** Portaria de pessoal, retificação que apaga o ato anterior se só a última linha for lida, e nome do projeto só no anexo.

### Diários oficiais estaduais

`CAPTURA-DOE` · Primária · Descoberta

- **URL:** https://www.imprensaoficial.com.br/
- **Registro:** diário estadual
- **Formato:** HTML / listagem
- **Acesso:** Público · situação instável
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Exemplos citados: Imprensa Oficial de São Paulo, IOERJ e Jornal Minas Gerais. Cada um tem busca e regras próprias.

**Explicação.** Adiar. Não existe conector único. Os três portais não foram revalidados um a um; entram só como família, atrás do DOU e do Querido Diário.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Família de portais (Imprensa Oficial de SP, IOERJ, Jornal Minas Gerais), não uma URL só. Adiada.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Cada diário tem busca, paywall local ou PDF imagem. A URL cadastrada é a de São Paulo e não representa os outros estados.

**Limites.** Sem conector único. Atrás do DOU e do Querido Diário. Três portais não revalidados um a um.

**Erros possíveis na extração.** PDF imagem sem texto, ato estadual de município pequeno, e sessão do site exigindo data.

### DNIT — Portal Cidadão

`CAPTURA-DNIT` · Secundária · Enriquecimento

- **URL:** https://servicos.dnit.gov.br/portalcidadao
- **Registro:** obra rodoviária federal
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Obras de construção rodoviária sob contrato direto do DNIT: empresa, BR, trecho, valores, situação e avanço físico. A COAC é a área interna; a face pública verificada é este portal.

**Explicação.** Mapear. Cobre obra federal executada pelo DNIT, distinta da concessão ANTT e do repasse que já está no Obrasgov.

**Formato do dado extraído.** HTML do Portal Cidadão: empresa, BR, trecho, valores, situação e avanço físico de obra sob contrato direto do DNIT. A COAC é área interna.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Não há conector. O desenho é localizar o contrato pelo trecho ou pela empresa e guardar a URL da ficha. Não varrer o portal como notícia: o parser de <a> pegaria menu.

**Erros e problemas comuns.** Ficha HTML muda. Obra de conservação aparece junto de construção. Valor do contrato inclui vários trechos.

**Limites.** Não é concessão ANTT nem repasse Obrasgov. Sem geometria confiável além do texto do trecho.

**Erros possíveis na extração.** Avanço físico desatualizado, BR sem km inicial e final, e empresa do consórcio só com o nome do líder.

### epbr

`NEWS-EPBR` · Primária · Descoberta

- **URL:** https://epbr.com.br/
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação instável
- **Recorrência:** alta
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Petróleo, gás, eólica offshore, H2 e FID.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. Timeout em listing e /feed/ na checagem 2026-09-22.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. No mapeamento de 22/09/2026 a capa e o /feed/ estouraram timeout.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Se o timeout se repetir, a fonte vai a instável e a rodada não analisa nada dela. Corpo de petróleo é longo e pode passar de 14 mil caracteres, cortando o valor que está no fim.

**Limites.** Oito links. FID e bloco não trazem o contrato da ANP.

**Erros possíveis na extração.** Timeout, feed vazio, e US$ no final da matéria fora do recorte.

### EPE Imprensa

`NEWS-EPE` · Primária · Descoberta

- **URL:** https://www.epe.gov.br/pt/imprensa/noticias
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Cadastramento de leilão, notas técnicas e planejamento energético.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. Planejamento, não canteiro; filtrar boletins.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. Listagem de imprensa abre, mas o conteúdo é planejamento, nota técnica e cadastramento de leilão.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Boletim e evento passam do tamanho mínimo de título. O filtro precisa ser mais duro do que o termo 'leilão' sozinho.

**Limites.** Não é canteiro e não traz CEG. Cadência baixa.

**Erros possíveis na extração.** Nota técnica virar projeto, GW do plano decenal no campo valor, e clipping republicado.

### Fundos da SUDENE e da SUDAM

`CAPTURA-FUNDOS-REGIONAIS` · Secundária · Enriquecimento

- **URL:** https://www.gov.br/sudene/pt-br
- **Registro:** resolução de fundo regional
- **Formato:** PDF
- **Acesso:** Público · situação instável
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** FDNE, FDA e incentivos regionais aparecem em resolução e página de órgão. Não foi encontrada uma base única de plantas aprovadas.

**Explicação.** Adiar. As resoluções relevantes também podem sair no DOU. Os portais institucionais não são, hoje, uma lista de projetos.

**Formato do dado extraído.** Resolução em PDF ou página de FDNE, FDA e incentivo. Não existe uma base única de plantas aprovadas.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Não extrair a home da SUDENE. O ato, quando útil, tende a estar também no DOU, que é o caminho mais estável.

**Erros e problemas comuns.** Página institucional instável, PDF de resolução com layout de diário, e projeto industrial misturado com fundo de custeio.

**Limites.** Adiado como lista. Sem id de obra.

**Erros possíveis na extração.** Resolução de renovação lida como projeto novo, valor do fundo inteiro, e beneficiário diferente da SPE.

### Grandes Construções

`NEWS-GRANDES` · Primária · Descoberta

- **URL:** https://grandesconstrucoes.com.br/
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Terminais, aeroportos e fase de obra pesada.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. Muito artigo/índice misturado a projeto.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. Seção de mercado, data e título; muito índice e artigo.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Título de seção e de ranking passa de 24 caracteres e entra no parser.

**Limites.** Oito links, muitos rejeitados. Fase citada (2028) não vira data estruturada: o JSON não tem campo de ano alvo.

**Erros possíveis na extração.** Índice de construtoras, obra citada como tendência, e ano no meio do título ignorado pelo schema.

### Imprensa econômica (Valor, Estadão, Exame, Pipeline)

`NEWS-ECONOMIA-PAYWALL` · Primária · Descoberta

- **URL:** https://valor.globo.com/
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Captcha ou paywall · situação bloqueado
- **Recorrência:** alta
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Planta, M&A e CapEx em manchete econômica.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. Paywall (Valor, Estadão, Pipeline, Exame, NeoFeed, Capital Reset). Sem scrape.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Bloqueada de propósito. Valor, Estadão, Pipeline, Exame, NeoFeed e Capital Reset. O GET recebe parede de login ou trecho curto.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Paywall. O que passa é a manchete. O scanner não contorna login. Uma URL (Valor) representa vários veículos: não dá para tratá-la como uma listagem só.

**Limites.** Sem corpo, o JSON fica no título. Ecoa CVM e iNFRA, com URL diferente, então não deduplica.

**Erros possíveis na extração.** HTTP 401/403, texto 'assine' extraído como resumo, e CapEx de M&A (compra de empresa) no campo de obra.

### InfraROI

`NEWS-INFRAROI` · Primária · Descoberta

- **URL:** https://infraroi.com.br/
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Infraestrutura e vendors; R$ pontual em obras e concessões.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. Mistura obra e equipamento.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. Mistura obra, vendor e opinião.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Release de equipamento cita R$ e passa no score sem ser CapEx de empreendimento.

**Limites.** Oito links, alta taxa de rejeição humana esperada.

**Erros possíveis na extração.** Valor de contrato de fornecedor, artigo de opinião, e obra citada só como exemplo.

### InvestSP

`NEWS-INVESTSP` · Primária · Descoberta

- **URL:** https://www.investsp.org.br/
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação indisponível
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Captação de investimento em São Paulo.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. /noticias 404; lead de captação, não obra.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. /noticias respondeu 404. A capa que resta é captação, não obra.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** 404 no path de notícias. Texto de 'a empresa vai investir' sem empreendimento nomeado.

**Limites.** Lead de atração não tem licença, CNO nem contrato. Extração, se a URL voltar, produz rumor com confiança baixa.

**Erros possíveis na extração.** 404, valor de intenção de investimento, e município da sede no lugar da planta.

### MegaWhat

`NEWS-MEGAWHAT` · Primária · Descoberta

- **URL:** https://megawhat.energy/
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** alta
- **Coleta automática:** sim, scanner piloto
- **Modo:** Portal Web

**O que publica.** Geração, transmissão, leilões e decisões do setor elétrico.

**Explicação.** No scanner do piloto. Parte do conteúdo pode exigir assinatura.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Sim, no scanner do piloto. Título e duas ou três frases trazem lote, MW e empresa.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Parte da matéria pede assinatura. O texto enviado à OpenAI fica curto e o valor ou a UF somem.

**Limites.** Oito links. MW não vira valor em reais. Empresa do leilão pode não ser a dona do ativo.

**Erros possíveis na extração.** Lote de leilão virar nome de usina, paywall devolvendo só o título, e UF do lote múltiplo reduzida a uma só.

### Ministério das Cidades Notícias

`NEWS-CIDADES` · Primária · Descoberta

- **URL:** https://www.gov.br/cidades/pt-br/assuntos/noticias
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação instável
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Saneamento, mobilidade, PAC e programas com valor.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. WAF 403 em HEAD; ruído de universalização genérica.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. WAF e ruído de programa (universalização, PAC) no lugar de uma ETE.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Valor de programa nacional no lead. O modelo tende a gravar esse total como CapEx de um projeto.

**Limites.** Não é o SINISA nem o SNIS. Oito links, muito descarte esperado.

**Erros possíveis na extração.** 403, R$ do Novo PAC inteiro num município, e 'saneamento' sem obra.

### Ministério dos Transportes Notícias

`NEWS-TRANSPORTES` · Primária · Descoberta

- **URL:** https://www.gov.br/transportes/pt-br/assuntos/noticias
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação instável
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Obras rodoviárias, concessões ferroviárias e trechos BR.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. WAF 403 em HEAD.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. WAF 403 em HEAD; o GET do scanner às vezes passa e às vezes não.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Diretriz e visita ministerial têm título longo. O score sobe com 'obra' e 'BR' sem haver empreendimento.

**Limites.** Não lê o CSV de REIDI, que é outra fonte. Oito links se um dia for ativada.

**Erros possíveis na extração.** 403, notícia de inspeção, e trecho de BR sem km.

### MME Notícias

`NEWS-MME` · Primária · Descoberta

- **URL:** https://www.gov.br/mme/pt-br/assuntos/noticias
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação instável
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Leilões de geração/transmissão, outorgas e MW.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. /noticias 404; usar /assuntos/noticias.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. /noticias é 404; a listagem é /assuntos/noticias.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Agenda ministerial domina a capa. Leilão de transmissão é o sinal útil e vem misturado.

**Limites.** Não extrai o lote estruturado da ANEEL. URL errada devolve 404 e a fonte cai para instável.

**Erros possíveis na extração.** 404 se alguém voltar o path antigo, pauta de reunião classificada como usina, e MW de planejamento lido como obra outorgada.

### Notícias de Mineração Brasil

`NEWS-NMB` · Primária · Descoberta

- **URL:** https://noticiasdemineracao.com/
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** alta
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Projetos de mineração, R$, UF e licenças.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. Dek curto com empresa e valor.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. Dek curto com empresa, R$ e UF: formato favorável ao scanner, quando for ligado.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Dek bom, mas o primeiro <p> pode ser a categoria. Mesmo ruído de preço de commodity da Brasil Mineral.

**Limites.** Oito links. Não liga ao SIGMINE sozinho.

**Erros possíveis na extração.** Preço spot como CapEx, UF de matriz em vez da mina, e título traduzido de projeto fora do Brasil.

### O Empreiteiro

`NEWS-OE` · Primária · Descoberta

- **URL:** https://www.oe.com.br/
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação indisponível
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Construtora, contrato e obra civil.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. Listing retornou 500 na checagem 2026-09-22.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. A listagem respondeu 500 em 22/09/2026. GET com erro marca a fonte instável ou indisponível e não cria candidato.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** 500 não é WAF: não há HTML de matéria para recuperar.

**Limites.** Enquanto o 500 durar, extração zero. Não há CSV alternativo nesta fonte.

**Erros possíveis na extração.** HTTP 500, HTML de erro com título curto demais (descartado), e retry inútil na mesma rodada.

### PetroNotícias

`NEWS-PETRO` · Primária · Descoberta

- **URL:** https://petronoticias.com.br/
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** alta
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** FPSO, sonda, bacia e CapEx em US$ no óleo e gás.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. Títulos em caixa alta; corpo longo.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. Título em caixa alta e corpo longo, com CapEx às vezes em dólar.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Caixa alta não quebra o score, mas nomes de bacia e de sonda competem com o nome do projeto. Corpo longo estoura o recorte de 14 mil caracteres.

**Limites.** Oito links. Dólar precisa virar moeda USD; se o texto disser 'dólares' por extenso, a moeda pode ficar desconhecida e o valor nulo.

**Erros possíveis na extração.** Sonda de perfuração classificada como FPSO, US$ não numérico, e várias empresas no mesmo texto deixando a empresa nula de propósito.

### Portais de RI (padrão IR)

`SEC-RI` · Secundária · Enriquecimento

- **URL:** https://www.vale.com/pt/investidores
- **Registro:** comunicado de companhia
- **Formato:** PDF
- **Acesso:** Público · situação instável
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Fato relevante e comunicado em PDF da companhia já conhecida.

**Explicação.** Não prospecta empresa nova. Vale/Petrobras/CCR etc. no mesmo padrão.

**Formato do dado extraído.** Lista HTML de fato relevante mais PDF. Cada companhia tem um fornecedor de RI (MZ, IR Manager) com HTML diferente. A URL cadastrada é um exemplo (Vale), não um agregador.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Não há varredura. A extração começa da empresa já conhecida: abrir o fato, baixar o PDF, recortar o trecho do projeto. No mapeamento a Vale respondeu 500.

**Erros e problemas comuns.** 500 e HTML diferente por empresa. PDF. Vários comunicados no mesmo dia. Não descobre companhia nova: se a SPE não está na lista, o fato não entra.

**Limites.** Enriquecimento. O mesmo documento pode já estar no ZIP da CVM, com metadado melhor. Não duplicar.

**Erros possíveis na extração.** Comunicado de dividendo, PDF de apresentação com número de mercado, e site de RI no ar enquanto o documento 500.

### Portal BE News

`NEWS-BENEWS` · Primária · Descoberta

- **URL:** https://portalbenews.com.br/
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** alta
- **Coleta automática:** sim, scanner piloto
- **Modo:** Portal Web

**O que publica.** Portos, ferrovias, logística e obras de transporte.

**Explicação.** No scanner do piloto. Manchete e lead geralmente trazem local, empresa e estágio.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Sim, no scanner do piloto. A capa abre e o dek costuma ter empresa, município e estágio.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** O dek é curto e bom para o score, mas o primeiro <p> às vezes é a data ou o autor, não o lead.

**Limites.** Oito links. Notícia de movimentação portuária sem obra pode passar se citar terminal e número. Sem CNPJ.

**Erros possíveis na extração.** Percentual de avanço (84%) lido como valor em reais se o parser de moeda falhar, e duplicata de manchete republicada.

### Portos e Aeroportos Notícias

`NEWS-MPOR` · Primária · Descoberta

- **URL:** https://www.gov.br/portos-e-aeroportos/pt-br/assuntos/noticias
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** média
- **Coleta automática:** sim, scanner piloto
- **Modo:** Portal Web

**O que publica.** Concessões, terminais, aeroportos, TUPs e FMM.

**Explicação.** No scanner do piloto. URL canônica substitui gov.br/mpor.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Sim, no scanner do piloto. A URL que funciona é gov.br/portos-e-aeroportos/.../noticias. gov.br/mpor não é a listagem.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Plone. Recorde de movimentação e aviso de pauta passam perto do filtro se o título for longo e tiver 'porto'.

**Limites.** Oito links. FMM e emprego não são CapEx do terminal. Sem código ANTAQ na notícia.

**Erros possíveis na extração.** URL antiga do MPOR, 403, e notícia de recorde operacional com número grande virando valor de obra.

### Portos e Navios

`NEWS-PORTOSNAV` · Primária · Descoberta

- **URL:** https://www.portosenavios.com.br/
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** alta
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** TUP, estaleiro, dragagem e logística portuária.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. CMS setorial; padrão de dek semelhante a BE News.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. CMS de notícia portuária, dek parecido com o BE News.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Fetch raso no mapeamento. O seletor de lead pode pegar chamada de capa, não o dek.

**Limites.** Oito links se ativada. Sem código ANTAQ.

**Erros possíveis na extração.** Link de seção (TUP, estaleiro) com título longo entrando como matéria.

### PPI / Casa Civil

`NEWS-PPI` · Primária · Descoberta

- **URL:** https://www.gov.br/ppi/pt-br
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação instável
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Concessões, leilões e qualificações de projetos prioritários.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. Listing /noticias pode 403; capa institucional.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Catalogada e inativa no scanner. A capa institucional abre de forma instável; /noticias pode 403.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Qualificação PPI e evento não são canteiro. Ligar o scanner nesta URL hoje pegaria menu e texto de programa.

**Limites.** Mesmo que ligasse, o scanner não entra em PDF de carteira. Carteira em R$ é soma, não um projeto.

**Erros possíveis na extração.** 403, projeto 'qualificado' lido como obra em construção, e valor da carteira inteira no campo CapEx.

### Saneamento Básico

`NEWS-SANEAMENTO` · Primária · Descoberta

- **URL:** https://saneamentobasico.com.br/
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** ETE, PPP e concessões de água e esgoto.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. Capa cheia de operação e vendor.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. WordPress com capa de operação, evento e vendor.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** 'Saneamento' está na lista de termos, então a capa quase inteira pontua. A rejeição humana seria a maior parte.

**Limites.** Oito links não separam ETE de notícia de prestador. Sem código de contrato.

**Erros possíveis na extração.** Release de equipamento, PPP sem valor, e concessão já operando classificada como obra nova.

### Transferegov — módulo de obras

`CAPTURA-TRANSFEREGOV` · Secundária · Índice de fontes

- **URL:** https://www.gov.br/transferegov/pt-br/manuais/transferegov/obras/modulo-de-obras
- **Registro:** manual do módulo de obras
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** O acompanhamento das obras com recurso federal transferido é a API pública do Obrasgov.

**Explicação.** Já coberto. A página é documentação operacional, não uma fonte adicional à Obrasgov.

**Formato do dado extraído.** A URL é manual do módulo de obras. Não há registro de obra nessa página. Os registros estão na API Obrasgov.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Não extrair. Qualquer leitura desta URL produz texto de manual, não projeto. O conector continua sendo SEC-OBRASGOV.

**Erros e problemas comuns.** Quem apontar o scanner de notícia para o manual cria candidatos falsos a partir dos títulos dos capítulos.

**Limites.** Índice, não fonte. Sobreposição total com Obrasgov.

**Erros possíveis na extração.** Capítulo 'como cadastrar valor' interpretado como obra, e URL de manual gravada como evidência.

### Transporte Moderno

`NEWS-TRANSPORTE` · Primária · Descoberta

- **URL:** https://transportemoderno.com.br/
- **Registro:** notícia
- **Formato:** HTML / listagem
- **Acesso:** Público · situação ok
- **Recorrência:** média
- **Coleta automática:** não
- **Modo:** Portal Web

**O que publica.** Logística, frota, BNDES e obras de transporte.

**Explicação.** Ativa no catálogo de captura; coleta automática ainda desligada. Não usar mfrural; mistura caminhão e infra.

**Formato do dado extraído.** Não sai tabela. Sai um candidato JSON: nome do projeto, nicho, UF, município, valor, moeda (BRL, USD ou desconhecida), status verbal (rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado), resumo e, se o texto sustentar, nome da empresa. CNPJ nunca é preenchido nesta etapa.

**Extração funcional.** Não. Inativa. O domínio certo é transportemoderno.com.br, não mfrural.

**Processo.** 1. O servidor faz GET da listagem, com timeout de 15 segundos e User-Agent próprio. HEAD não é usado, porque vários gov.br respondem 403 só no HEAD.

2. O HTML é lido com Cheerio. Entra só link do mesmo domínio, com título entre 24 e 240 caracteres. Saem a raiz do site, tag, autor, login, newsletter e podcast.

3. O score soma 2 por termo de obra (usina, porto, leilão, licença, milhões etc.), 5 se houver R$ ou US$, e 1 se houver dígito. Abaixo de 3, o link é descartado. No máximo 8 links por fonte.

4. Cada URL vira uma linha em candidato_projeto. URL repetida não cria outra linha.

5. A rodada inteira manda no máximo 12 candidatos à OpenAI. O texto da matéria é o H1 mais até 12 parágrafos longos, cortado em 14 mil caracteres. Se a matéria não abre, ficam título e lead da listagem.

6. A primeira chamada devolve JSON: nome, nicho, UF de 2 letras, município, valor numérico, moeda, status e resumo. R$ 1,2 bilhão vira 1200000000. Campo ausente fica nulo. A segunda chamada escolhe a empresa só entre nomes que o texto já continha; trecho que não aparece literalmente no texto é jogado fora.

7. Nada vira projeto sem aprovação humana. Rejeição também fica gravada.

**Erros e problemas comuns.** HTTP diferente de 2xx ou timeout marca a fonte como instável e zera a descoberta daquela fonte na rodada. Página de bloqueio (WAF, Cloudflare, paywall) chega como HTML sem matéria: o score não acha link, ou acha menu. O parágrafo é pego do primeiro <p> do container. Em div genérico, o lead pode ser menu, data ou anúncio. JSON da OpenAI fora do schema marca o candidato como erro. Status e moeda têm apelidos (obra vira construcao, R$ vira BRL); nome vazio cai no título. Empresa citada só como órgão, cidade ou veículo é recusada. Se o modelo escolher um nome fora da lista, a empresa fica nula. O teto de 8 links por fonte e 12 análises por rodada deixa notícia de fora até a próxima execução.

**Peculiaridade desta fonte.** Frota e caminhão financiado pelo BNDES dividem a capa com infra. O score sobe com R$ e 'investimento'.

**Limites.** Não separa frota de obra. Oito links se ativada.

**Erros possíveis na extração.** URL antiga 404, compra de caminhão como projeto de terminal, e valor FINAME.

## Diretórios institucionais

Índice de órgãos. Não há linha de obra para extrair. Servem para achar o portal certo quando um estado ainda não tem ficha.

### ABAR — agências reguladoras

`IDX-ABAR` · Diretório · Índice

- **URL:** https://abar.org.br/nossas-associadas/
- **Registro:** nome da agência associada
- **Formato:** HTML
- **Acesso:** Público · situação ok
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Diretório

**O que publica.** Nomes das agências associadas, separados em federais, estaduais, municipais e intermunicipais. Em maio de 2026 a associação informou 86 associadas.

**Explicação.** Índice. O caminho `agencias-associadas` não é o desta lista. A ficha de dado já aberta neste eixo é a programação de obras da ARTESP.

**Formato do dado extraído.** Lista de nomes. A página vista não traz, no mesmo bloco, o URL do plano de investimento de cada agência.

**Extração funcional.** Não. Diretório, sem conector e sem linha de projeto.

**Processo previsto.** Consultar o nome quando surgir uma concessionária estadual sem fonte. Abrir ficha própria só se o site da agência publicar cronograma com valor.

**Erros e problemas comuns.** Agência municipal no meio da lista estadual. Sigla repetida em estados diferentes. Filiação nova sem página de dados.

**Limites.** Não descreve a obra. Agência municipal de saneamento fica de fora do catálogo de projetos pelo porte.

**Erros possíveis na extração.** Nome de agência virar candidato de projeto, e plano de gestão da própria agência lido como CapEx da concessionária.

### ABDE — Sistema Nacional de Fomento

`IDX-ABDE` · Diretório · Índice

- **URL:** https://abde.org.br/sistema-nacional-de-fomento/
- **Registro:** instituição de fomento
- **Formato:** HTML e boletim agregado
- **Acesso:** Público · situação ok
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Diretório

**O que publica.** A associação reúne o Sistema Nacional de Fomento. O boletim SNF em Números usa estatística de crédito do Banco Central. A metodologia ABDE-PNUD lista 34 instituições, entre elas BNDES, BNB, BASA, BRDE, BDMG, BANDES e as agências de fomento estaduais.

**Explicação.** Índice. O CSV de operação com CNPJ e valor continua sendo o do BNDES, já catalogado. Relatório anual do FNE ou do FNO é total regional.

**Formato do dado extraído.** Página institucional e indicador agregado. Não há tabela de projeto com empresa, município e valor.

**Extração funcional.** Não. Diretório, sem conector e sem linha de projeto.

**Processo previsto.** Usar a lista para saber qual banco estadual procurar quando o projeto já tem UF. Só abrir ficha se aparecer arquivo de operações no padrão do BNDES.

**Erros e problemas comuns.** O caminho `/associados` não é o endereço confirmado desta lista. Indicador de crédito do sistema inteiro parece carteira de obras.

**Limites.** Não financia a descoberta diária. Finep, Sebrae e cooperativas estão no mesmo sistema e não são obra de R$ 100 milhões.

**Erros possíveis na extração.** Total do FNE lido como um projeto, e operação de microcrédito misturada com planta industrial.

### ABEMA — órgãos estaduais de meio ambiente

`IDX-ABEMA` · Diretório · Índice

- **URL:** https://www.abema.org.br/associados
- **Registro:** órgão ou secretaria estadual de meio ambiente
- **Formato:** HTML
- **Acesso:** Público · situação ok
- **Recorrência:** baixa
- **Coleta automática:** não
- **Modo:** Diretório

**O que publica.** Associados: nome do órgão, endereço e e-mail. A página confirma, entre outros, IMAC (AC), IMA (AL), IPAAM (AM), SEMA (AP), INEMA (BA), SEMACE (CE), Brasília Ambiental (DF), IEMA (ES), SEMAD (GO) e SEMA (MA). O restante da lista segue na mesma página.

**Explicação.** Índice. As consultas já fichadas são IAT, CETESB, INEA, SEMAD-MG, SEMAS-PA, FEPAM e SEMACE. A ABEMA não publica o URL do sistema de licença.

**Formato do dado extraído.** Nome, endereço postal e e-mail. Sem protocolo, sem empreendimento e sem coordenada.

**Extração funcional.** Não. Diretório, sem conector e sem linha de projeto.

**Processo previsto.** Localizar o órgão da UF quando a notícia citar licença estadual e o estado ainda não tiver ficha. Confirmar o sistema de consulta antes de catalogar.

**Erros e problemas comuns.** Secretaria e instituto do mesmo estado aparecem juntos; quem licencia é o instituto (INEMA, SEMACE, FEPAM), não a secretaria. A página é longa e a cópia vista nesta checagem cortou antes do fim da lista.

**Limites.** Não substitui a consulta de licença. E-mail de gabinete não é API.

**Erros possíveis na extração.** Domínio adivinhado (`imac.ac.gov.br` e equivalentes) tratado como oficial, e o IBRAM do Distrito Federal confundido com o instituto privado de mineração.

## Ainda fora do catálogo

Estas candidatas foram avaliadas, mas ainda não têm uma URL de dados confirmada para entrar no dashboard.

### Painel de metas de universalização da ANA

`CAPTURA-ANA-METAS`

- **Modo:** Não confirmado
- **Decisão:** nao_confirmada

**O que se espera.** O endereço metas-saneamento.ana.gov.br não foi confirmado como publicação oficial nesta checagem.

**Explicação.** Não entra no mapa até existir uma URL oficial. A outorga hídrica continua na fonte ANA SNIRH já catalogada.

**Formato do dado extraído.** Não há formato confirmado. O endereço metas-saneamento.ana.gov.br não foi validado como publicação oficial.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Não extrair e não inventar colunas. A outorga hídrica segue no SNIRH.

**Erros e problemas comuns.** URL inexistente ou estacionada. Qualquer schema seria chute.

**Limites.** Fora do catálogo até existir URL oficial.

**Erros possíveis na extração.** Página de terceiros no domínio parecido, e meta de atendimento municipal lida como obra.

### Portais de obras e transparência de estados e prefeituras

`FONTE-008`

- **Modo:** Portal, API local ou dataset
- **Decisão:** adiar

**O que se espera.** Cada ente publica de um jeito. MiDES e execução estadual aparecem como recorte na Base dos Dados.

**Explicação.** Obra estadual com arquivo confirmado entrou em ficha própria: Portal de Obras de Minas Gerais, TCE-PE, GeoObras do TCE-GO e o painel do TCU. O que segue adiado é o resto dos estados e o conjunto das prefeituras. Querido Diário e PNCP cobrem partes desse espaço.

**Formato do dado extraído.** Não há um formato. Cada estado e prefeitura publica HTML, API local ou planilha diferente. MiDES e execução estadual existem como recorte na Base dos Dados, com projeto GCP.

**Extração funcional.** Não. Não há conector no código. A coleta automática está desligada. O que segue é o desenho da extração e as falhas já observadas no acesso, não um job em produção.

**Processo previsto.** Não há conector único. PNCP cobre o contrato; Querido Diário cobre parte do ato municipal. Portal de obras entra só quando uma URL de ficha for confirmada, ente por ente.

**Erros e problemas comuns.** 5.570 prefeituras, sessão, captcha e obra pequena. Um crawler genérico produz menu, não CapEx.

**Limites.** Adiado. Sem chave nacional de obra municipal além de CNO e PNCP, que já estão no mapa.

**Erros possíveis na extração.** Contrato de recape, diário oficial sem valor, e painel estadual fora do ar no ano eleitoral.

