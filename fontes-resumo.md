# Fontes — resumo

Lista curta das fontes conectadas ao sistema, em 14 de outubro de 2026. O alvo da descoberta é projeto privado. A fonte secundária enriquece um projeto já achado. Cada linha traz o nome, o link e o que a fonte publica. O catálogo completo, com as fontes cadastradas e sem conexão, fica em [fontes-mapeadas.md](fontes-mapeadas.md).

São 28 fontes conectadas: 6 primárias, lidas pelo scanner, e 22 secundárias, consultadas no enriquecimento da ficha.

## Primárias

Portal de notícia privada no estágio fixa. O scanner lê a capa uma vez por semana, escolhe os links e manda a matéria à extração.

| Fonte | Link | O que publica |
| --- | --- | --- |
| Agência iNFRA | [Blog](https://agenciainfra.com/blog/) | Infraestrutura, concessões, energia, saneamento e regulação. |
| Portal BE News | [portalbenews.com.br](https://portalbenews.com.br/) | Portos, ferrovias, logística e obras de transporte. |
| MegaWhat | [megawhat.energy](https://megawhat.energy/) | Geração, transmissão, leilões e decisões do setor elétrico. |
| InfoMoney | [Negócios](https://www.infomoney.com.br/business/) | Investimento de empresa: fábrica, planta e aporte. |
| Money Times | [moneytimes.com.br](https://www.moneytimes.com.br/) | Empresa, fábrica, aporte e expansão. |
| InvestNews | [investnews.com.br](https://investnews.com.br/) | Investimento privado, inclusive fábrica e data center. |

## Secundárias

Consultadas pelo CNPJ ou pela razão social da ficha. A cópia local é renovada por `npm run db:load-bases`; as fontes sem cópia são lidas ao vivo na coleta.

### API pública

API aberta, sem chave.

| Fonte | Link | O que publica |
| --- | --- | --- |
| IAT Licenças GIS (PR) | [FeatureServer](https://geopr.iat.pr.gov.br/server/rest/services/00_PUBLICACOES/licencas_ambientais_sia_sga/FeatureServer/0) | Licenças ambientais do Paraná, com empresa, município e coordenadas. |
| Obrasgov | [Documentação](https://api-publica.obrasgov.gestao.gov.br/obras/docs) | Projetos com recurso federal: valor previsto, situação, executor e tomador. |
| Querido Diário | [API](https://api.queridodiario.ok.org.br/docs) | Trechos de diários oficiais municipais, por cidade e texto. |

### Dataset para download

Arquivo publicado (CSV, ZIP ou planilha) que a carga baixa e transforma em tabela.

| Fonte | Link | O que publica |
| --- | --- | --- |
| BNDES Operações de Financiamento | [Dataset](https://dadosabertos.bndes.gov.br/dataset/operacoes-financiamento) | Financiamentos: CNPJ, descrição, valor contratado e desembolso. |
| CVM dados abertos IPE | [Dataset](https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe) | Fatos relevantes e comunicados de companhias abertas, com link para o PDF. |
| ANEEL SIGA | [Dataset](https://dadosabertos.aneel.gov.br/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel) | Usinas: código CEG, fase, potência, municípios e participação societária. |
| IBAMA SISLIC | [Dataset](https://dadosabertos.ibama.gov.br/pt_BR/dataset/licencas-ambientais-de-atividades-e-empreendimentos-licenciados-pelo-ibama) | Licenças federais (LP, LI e LO): empreendimento, titular e datas. |
| CNO dados abertos (RFB) | [Conjunto](https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-de-obras-cno) | Obras civis: responsável, situação, área e localização. Sem valor. |
| ANTT Investimentos da concessão | [dados.antt.gov.br](https://dados.antt.gov.br/) | Investimentos das concessionárias federais, com valor e local. |
| ANTAQ Instalações portuárias | [Dados abertos](https://www.gov.br/antaq/pt-br/acesso-a-informacao/dados-abertos) | Terminais de uso privado: quem opera e onde. |
| ARTESP — programação de obras | [Dataset](https://dadosabertos.artesp.sp.gov.br/dataset/programacao-de-obras) | Programação de obras das concessões rodoviárias de São Paulo. |
| Portal de Obras de Minas Gerais | [Dataset](https://dados.mg.gov.br/dataset/portal_obras) | Obras do Executivo mineiro: contrato, situação e município. |
| ANP Dados de E&P | [Exploração e produção](https://www.gov.br/anp/pt-br/assuntos/exploracao-e-producao-de-oleo-e-gas/dados-de-e-p/dados-de-exploracao-e-producao) | Blocos em exploração, com operador, bacia e ambiente. |
| ANP Campos em produção | [Produção por zona](https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/arquivos-fase-de-desenvolvimento-e-producao/producao-por-zona) | Campos que produziram no mês mais recente, com bacia e ambiente. |
| ANP Plataformas em operação | [Lista](https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/arquivos-fase-de-desenvolvimento-e-producao/lpo) | Plataformas em operação, com operador, campos e ano de início. |
| ANP Dutos | [Lista de códigos](https://www.gov.br/anp/pt-br/assuntos/exploracao-e-producao-de-oleo-e-gas/desenvolvimento-e-producao/lista-de-codigos) | Dutos de exploração e produção, com operador, campo e situação. |
| SIGMINE / dados abertos da ANM | [SIGMINE](https://dadosabertos.anm.gov.br/SIGMINE/) | Processos minerários: fase, substância e área. Sem valor de obra. |
| ONS — Plano de Ampliações e Reforços | [Expansão](https://www.ons.org.br/paginas/energia-no-futuro/transmissao/expansao) | Obras de transmissão planejadas, com ano de necessidade e investimento estimado. |
| Projetos aprovados no REIDI | [Dataset](https://dados.transportes.gov.br/dataset/incentivo-fiscal-reidi) | Projetos de transporte habilitados ao incentivo: titular, modal, investimento e portaria. |

### Base consultável

| Fonte | Link | O que publica |
| --- | --- | --- |
| ANA Outorgas SNIRH | [snirh.gov.br](https://www.snirh.gov.br/) | Outorgas de captação e lançamento de água, com titular e município. |

### Portal web

| Fonte | Link | O que publica |
| --- | --- | --- |
| Diário Oficial da União | [Busca](https://www.in.gov.br/consulta/-/buscar/dou) | Atos oficiais: portaria, licença, outorga e projeto prioritário. |
