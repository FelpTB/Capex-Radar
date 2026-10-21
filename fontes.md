# Radar CapEx — Inventário de Fontes

Catálogo vivo das fontes usadas para descobrir e monitorar projetos de investimento (foco: obras / CapEx ≥ R$ 100 mi).

> Preencha novas fontes conforme a pesquisa avançar. Documentação profunda de cada fonte fica no Notion (Document Hub).

## Como usar este arquivo

| Campo | Significado |
| --- | --- |
| ID | Código estável da fonte no Radar |
| Nome | Nome oficial / comercial |
| Tipo | `api` · `portal` · `dataset` · `noticias` · `outro` |
| Status | `em_estudo` · `mapeada` · `piloto` · `produção` · `descartada` |
| Notion | Link da página de documentação profunda |
| CapEx | Relevância para filtro ≥ R$ 100 mi |
| Linkagem | Chaves candidatas para vincular ao projeto Radar |

---

## Fontes catalogadas

### FONTE-001 — API pública Obrasgov.br

| Campo | Valor |
| --- | --- |
| **Nome** | API de dados abertos do Obrasgov |
| **Órgão** | Governo Federal (plataforma Obrasgov.br / Transferegov) |
| **Tipo** | `api` |
| **Status** | `mapeada` |
| **URL docs** | https://api-publica.obrasgov.gestao.gov.br/obras/docs |
| **OpenAPI** | https://api-publica.obrasgov.gestao.gov.br/obras/openapi.json |
| **Base URL** | `https://api-publica.obrasgov.gestao.gov.br/obras` |
| **Auth** | Nenhuma (dados abertos públicos) |
| **Atualização** | Endpoint `GET /data-atualizacao` (ex.: 2026-09-22) |
| **Volume (amostra)** | ~144.386 projetos em `GET /projeto-investimento` |
| **Modelo local** | `modelo_dados_api_obrasgov/` (SchemaSpy, gerado 2026-06-22) + zip `modelo_dados_api_obrasgov.zip` |
| **Notion** | [Hub Fontes](https://www.notion.so/3e3dca3eb7d8815186eada36f380ea87) · [FONTE-001 detalhada](https://www.notion.so/3e3dca3eb7d881648ad5eebb610ee621) |
| **CapEx ≥ 100 mi** | Via `investimentos_previstos[].vl_investimento_previsto` (filtro **client-side**; API não tem query de valor mínimo) |
| **Empresas / CNPJ** | `cnpj_organizacao_resp`, `cnpj_executor`, `cnpj_tomador`, `cnpj_repassador`, `cnpj_fornecedor_contrato` |
| **Linkagem candidata** | `id_projeto_investimento` (chave principal); CNPJs; coordenadas `pins`; UF/município/IBGE; nº contrato / licitação |

**Descrição da fonte**

- **Origem:** cadastro operacional Obrasgov/Transferegov, preenchido pelos gestores da obra (recurso federal). A API replica esse cadastro — não é scrape nem estatística derivada.
- **O que representa:** cada registro é uma **obra / projeto de investimento** (identidade, situação, valor previsto, atores com CNPJ, geo, contratos/empenhos/físico nos satélites). É a unidade mais próxima de “Projeto” no Radar.
- **Usabilidade:** **identificar** obras públicas federais ≥ R$ 100 mi; **monitorar** situação, % físico, novos contratos/empenhos e paralisações. Não cobre CapEx privado nem obra só estadual/municipal. Papel: **âncora do projeto** quando há recurso da União.

**Endpoints principais**

1. `GET /data-atualizacao`
2. `GET /projeto-investimento` (hub do projeto + embutidos)
3. `GET /empenho`
4. `GET /execucao-fisica`
5. `GET /contrato`
6. `GET /geometria`
7. `GET /historico-situacao-cancelada-paralisada`
8. `GET /estudo-viabilidade`

**Paginação real da API:** `data`, `total_pages`, `total_items`, `page_number`, `page_size` (defaults: página 1, tamanho 50).

---

### FONTE-002 — Portal da Transparência (CGU)

Fora do MVP desde 21 de outubro de 2026. A fonte trata de dinheiro público federal. O Radar não a consulta.

---

### FONTE-003 — PNCP (Portal Nacional de Contratações Públicas)

| Campo | Valor |
| --- | --- |
| **Nome** | Portal Nacional de Contratações Públicas |
| **Órgão** | Comitê Gestor da Rede Nacional de Contratações Públicas (Lei 14.133/2021) |
| **Tipo** | `api` |
| **Status** | `mapeada` |
| **URL portal** | https://www.gov.br/pncp/pt-br · app https://pncp.gov.br |
| **URL docs** | https://pncp.gov.br/api/consulta/swagger-ui/index.html |
| **OpenAPI consulta** | https://pncp.gov.br/api/consulta/v3/api-docs |
| **Base consulta** | `https://pncp.gov.br/api/consulta` |
| **OpenAPI integração** | https://pncp.gov.br/pncp-api/v3/api-docs (base `/api/pncp`, 119 paths; GET detalhe público) |
| **Manual** | https://pncp.gov.br/manual/pt-br/latest/ (v. 2.6) |
| **Auth** | Consulta: nenhuma. Integração escrita: JWT. GET itens/arquivos/domínios: público |
| **Atualização** | Listas por `dataInicial`/`dataFinal` (`yyyyMMdd`) ou `/atualizacao` |
| **Volume (amostra)** | 122.682 contratos publicados em 01–22/09/2026 |
| **Notion** | [Hub Fontes](https://www.notion.so/3e3dca3eb7d8815186eada36f380ea87) · [FONTE-003 detalhada](https://www.notion.so/3e3dca3eb7d88101ae85fcab18018ca7) |
| **CapEx ≥ 100 mi** | `valorGlobal` (contrato) / `valorTotalEstimado`·`valorTotalHomologado` (compra) — **client-side**; priorizar modalidades 4 e 5 (concorrência) |
| **Empresas / CNPJ** | `niFornecedor`, `nomeRazaoSocialFornecedor`; órgão `orgaoEntidade.cnpj`; vencedor nos itens da integração |
| **Linkagem candidata** | `numeroControlePNCP`; `numeroControlePncpCompra`; nº contrato/empenho; processo; CNPJ; IBGE/UF |

**Descrição da fonte**

- **Origem:** órgãos de todas as esferas **enviam** compras/contratos ao PNCP (Lei 14.133); a API de consulta lê o repositório publicado. Qualidade depende do sistema de origem.
- **O que representa:** **atos de contratação** (PCA, edital, ata, contrato, NFe) — não o empreendimento físico. Uma obra grande pode virar várias licitações.
- **Usabilidade:** **identificar** CapEx público estadual/municipal (e federal) com corte de valor + modalidades 4/5. **Monitorar** a linha edital → homologação → contrato → aditivo. Fraco em status físico da obra. Papel: **âncora** quando não há Obrasgov; **edital precoce** no federal.

**Endpoints consulta (12 GET)**

1. `GET /v1/contratacoes/publicacao` (exige modalidade)
2. `GET /v1/contratacoes/atualizacao`
3. `GET /v1/contratacoes/proposta`
4. `GET /v1/orgaos/{cnpj}/compras/{ano}/{sequencial}`
5. `GET /v1/contratos` / `/v1/contratos/atualizacao`
6. `GET /v1/atas` / `/v1/atas/atualizacao`
7. `GET /v1/pca/` / `/atualizacao` / `/usuario`
8. `GET /v1/instrumentoscobranca/inclusao`

**Paginação:** `data`, `totalRegistros`, `totalPaginas`, `numeroPagina`. Contratos: `tamanhoPagina` máx. 500 (default 500). Contratações: máx. 50. Página começa em 1. Backoff — 500 se paginar agressivo.

**ID PNCP:** `{cnpj}-{tipo}-{sequencial}/{ano}` — tipo 1 contratação, tipo 2 contrato.

---

### FONTE-004 — CNO dados abertos (RFB)

| Campo | Valor |
| --- | --- |
| **Nome** | Cadastro Nacional de Obras — dados abertos |
| **Órgão** | Receita Federal (RFB) |
| **Tipo** | `dataset` (ZIP/CSV) |
| **Status** | `mapeada` |
| **Portal dados.gov** | https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-de-obras-cno |
| **Orientação / e-CAC** | https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/cadastros/cno |
| **Layout** | Dicionário de dados do conjunto, PDF `cno-metadados.pdf`. Link atual: https://arquivos.receitafederal.gov.br/index.php/s/XEa8aE7wJdMGzkE (29/01/2026). Não é reconferido a cada sincronismo |
| **Auth** | Nenhuma no dump; e-CAC exige gov.br (só obras do próprio usuário — **não** usar no Radar) |
| **API** | **Não existe** (RFB no dados.gov) |
| **Atualização** | Diária (afirmado pela RFB; metadados do portal atrasam) |
| **Arquivos** | Dentro do ZIP, em minúsculas: `cno.csv`, `cno_cnaes.csv`, `cno_vinculos.csv`, `cno_areas.csv`, `cno_totais.csv` |
| **Formato** | CSV com cabeçalho, separador vírgula, texto entre aspas, ISO-8859-1. Datas `AAAA-MM-DD`. O PDF é o dicionário dos códigos; o nome da coluna é o do cabeçalho |
| **Sobreposição** | Mesmo cadastro que `br_rf_cno` na FONTE-011 (BD trata este dump). Não ingestir os dois. |
| **Notion** | [Hub Fontes](https://www.notion.so/3e3dca3eb7d8815186eada36f380ea87) · [FONTE-004 detalhada](https://www.notion.so/3e3dca3eb7d881579dace47d00788799) |
| **CapEx ≥ 100 mi** | **Não há valor.** Proxy fraco: metragem + CNAE + destinação industrial |
| **Empresas / CNPJ** | Coluna `NI do responsável` em `cno.csv` e em `cno_vinculos.csv` (14 dígitos; em branco quando é CPF). `Nome empresarial` também fica em branco para pessoa física |
| **Linkagem candidata** | Coluna `CNO` (12 dígitos); NI do responsável; código TOM do município; sigla na coluna `Estado`; CNAE em `cno_cnaes.csv` |

**Descrição da fonte**

- **Origem:** inscrição tributária de obra de construção civil na RFB (obrigação do responsável). O dump é o cadastro público bruto, sem tratamento.
- **O que representa:** a **obra física** (canteiro), não o contrato nem o CapEx. Em `cno.csv` a situação é o código 01 nula, 02 ativa, 03 suspensa, 14 paralisada ou 15 encerrada. Em `cno_areas.csv` a categoria e a destinação saem como texto (Obra Nova, Acréscimo, Reforma, Demolição, Existente; galpão industrial, residencial e as demais do manual), não como o número do PDF.
- **Usabilidade:** **identificar** obras públicas **e privadas** que Obrasgov/PNCP não veem. **Monitorar** mudança de situação / novo vínculo. **Aprofundar** projeto já conhecido (CNPJ ou município → lista de CNO). Não descobre sozinho o limiar de R$ 100 mi.

**Uso Radar (junto com CNPJ — FONTE-012)**

1. Índice local pela coluna `CNO` + NI do responsável + município + situação (carga periódica do ZIP).
2. Lookup: dado um CNPJ de contrato/notícia, listar obras ativas.
3. Delta: obras novas ou que mudaram de situação desde o ZIP anterior.
4. Heurística (não CapEx): área grande + destinação industrial/comercial + CNAE construção.

---

### FONTE-012 — CNPJ dados abertos (RFB)

| Campo | Valor |
| --- | --- |
| **Nome** | Cadastro Nacional da Pessoa Jurídica — dados abertos |
| **Órgão** | Receita Federal (RFB) |
| **Tipo** | `dataset` (ZIP/CSV) |
| **Status** | `mapeada` |
| **Portal dados.gov** | https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-da-pessoa-juridica---cnpj |
| **Layout** | https://arquivos.receitafederal.gov.br/dados/cnpj/LAYOUT_DADOS_ABERTOS_CNPJ.pdf |
| **Repositório arquivos** | historicamente `dadosabertos.rfb.gov.br/CNPJ/`; 2026 também `arquivos.receitafederal.gov.br/dados/cnpj/` (URLs mudam — validar no piloto) |
| **Auth** | Nenhuma |
| **API oficial** | **Não.** Dump mensal completo. (APIs de terceiros = outro produto, não esta fonte) |
| **Atualização** | **Mensal** (snapshot do cadastro inteiro) |
| **Formato** | CSV **sem cabeçalho**, `;`, ISO-8859-1; ZIPs `Empresas0–9`, `Estabelecimentos0–9`, `Socios0–9`, `Simples`, tabelas de domínio |
| **Sobreposição** | Mesmo cadastro que `br_rf_cnpj` na FONTE-011. |
| **Notion** | [Hub Fontes](https://www.notion.so/3e3dca3eb7d8815186eada36f380ea87) · [FONTE-012 detalhada](https://www.notion.so/3e3dca3eb7d8816ab87eda0b96aee572) |
| **CapEx ≥ 100 mi** | Não. `capital_social` ≠ CapEx da obra. |
| **Empresas / CNPJ** | O próprio cadastro (raiz + estabelecimento + sócios) |
| **Linkagem candidata** | CNPJ 14 dígitos; CNAE; município RFB; sócios (fuzzy) |

**Descrição da fonte**

- **Origem:** base cadastral da RFB de todas as PJ do país. Publicação mensal em arquivos partidos.
- **O que representa:** a **empresa/estabelecimento**, não o projeto. Razão social, CNAE, endereço, situação cadastral, porte, capital social, quadro societário, Simples/MEI.
- **Usabilidade:** **enriquecer** CNPJs que já saíram de Obrasgov, PNCP, CNO, BNDES, notícia. **Não** é fonte de descoberta de obra. Monitoramento = mudança cadastral da empresa (situação, CNAE, novo estabelecimento), não da obra.

**Uso Radar**

1. Tabela local de lookup só dos CNPJs que o Radar já viu (não carregar 70+ mi de estabelecimentos no hot path).
2. Preencher nome, CNAE (construção/energia/saneamento), município, contato (qualidade irregular), sócios.
3. Cruzar CNO `id_responsavel` → razão social / CNAE.
4. Compliance: situação baixada vs. CEIS/CNEP (FONTE-002 / `br_cgu_sancoes`).

---

### FONTE-011 — Base dos Dados (datalake)

| Campo | Valor |
| --- | --- |
| **Nome** | Base dos Dados |
| **Órgão** | Organização Base dos Dados (datalake público; origens = RFB, BNDES, CGU, MGI, TCEs, etc.) |
| **Tipo** | `dataset` (BigQuery) + metadados GraphQL/search |
| **Maturidade** | **Avançada** — não é fonte de descoberta em lote; exige processo de acesso (GCP) e consultas pontuais |
| **Papel no Radar** | **Aprofundamento** de projetos já identificados (CNPJ, CNO, contrato BNDES, município) para puxar mais sinais |
| **Status** | `mapeada` (catálogo ok; uso operacional só após projeto GCP + consultas filtradas) |
| **URL portal** | https://basedosdados.org/ |
| **Docs Python** | https://basedosdados.org/docs/api_reference_python |
| **Docs BigQuery** | https://basedosdados.org/docs/access_data_bq |
| **Metadados** | GraphQL `https://backend.basedosdados.org/graphql` · busca `https://backend.basedosdados.org/search` |
| **Projeto BQ** | `basedosdados` (tabelas `basedosdados.<dataset_id>.<table_id>`) |
| **Auth metadados** | Nenhuma (`get_datasets` / `search` / GraphQL) |
| **Auth dados** | Projeto GCP próprio (`billing_project_id`); ~1 TB/mês grátis no sandbox BQ |
| **Pacote** | `pip install basedosdados` → `bd.read_sql` / `bd.read_table` / `bd.search` |
| **Volume catálogo** | **1.276** conjuntos no GraphQL (2026-09-22); maioria irrelevante para CapEx |
| **Notion** | [Hub Fontes](https://www.notion.so/3e3dca3eb7d8815186eada36f380ea87) · [FONTE-011 detalhada](https://www.notion.so/3e3dca3eb7d881d6a036fbf24ae36953) |
| **CapEx ≥ 100 mi** | Depende da **tabela**: BNDES `valor_operacao`; compras/contratos `valor*`; CNO **não tem valor** |
| **Empresas / CNPJ** | CNO `id_responsavel`; BNDES `cnpj_cliente`; `br_rf_cnpj`; sanções CGU; fornecedores MGI |
| **Linkagem candidata** | `id_cno`; CNPJ; IBGE `id_municipio`; nº contrato BNDES/`id_contrato`; chaves PNCP/MGI |

**Descrição da fonte**

- **Origem:** a BD **não produz** os dados. Tratam, padronizam (IBGE, CNPJ, datas) e publicam no BigQuery bases de dezenas de órgãos. Qualidade e atraso = fonte original + ETL da BD. Várias tabelas são **snapshot histórico** (`data_extracao`) — milhões de linhas repetidas.
- **O que representa:** **catálogo heterogêneo**. Cada conjunto tem unidade diferente (obra CNO, operação BNDES, contrato PNCP, empenho municipal, estabelecimento CNPJ). Não existe “projeto CapEx” nativo no lake.
- **Usabilidade:** fonte **mais avançada**. Acesso exige projeto GCP, SQL e recorte (não é GET público como Obrasgov/PNCP). Entrega **informações específicas** (CNO da obra, operação BNDES, quadro societário, sanção) que servem para **buscar mais sobre um projeto já conhecido** — não para varrer o Brasil todo dia. Monitoramento contínuo continua nas APIs 001–003.

**Bases úteis (estudo 2026-09-22)**

| Prioridade | Conjunto BD (`dataset_id`) | Por quê |
| --- | --- | --- |
| **P1 usar** | `br_rf_cno` | Obras civis + responsável CNPJ + UF/IBGE + situação (`id_cno`). Sem valor. |
| **P1 usar** | `br_bndes_operacoes_contratadas` | Financiamento com `descricao_projeto`, CNPJ, `valor_operacao` filtrável ≥ 100 mi. Aberto. |
| **P1 usar** | `br_rf_cnpj` | Empresas/sócios/estabelecimentos (último `data_extracao`). Enrichment. |
| **P1 usar** | `br_cgu_sancoes` | CEIS/CNEP/CEPIM/leniência — compliance. |
| **P1 join** | `br_bd_diretorios_brasil` | Município/UF/códigos. |
| **P2 warehouse** | `br_mgi_pncp` | Mesmo domínio da FONTE-003; preferir API para delta. |
| **P2 warehouse** | `br_cgu_licitacao_contrato` | Recorte de contrato federal em BQ. Fora do recorte do Radar. |
| **P2 warehouse** | `br_mgi_compras_publicas` | Compras.gov Lei 8.666 + 14.133 (histórico). |
| **P2 warehouse** | `world_wb_mides` | Licitação/empenho **municipal** (TCEs). Volume enorme. |
| **P2 warehouse** | `br_bd_execucao_estadual` | Contrato/licitação/despesa **estadual**. |
| **P3 contexto** | `br_mdr_snis`, `atlas_esgotos`, `reservatorios`, CAGED, emendas, DOU | Agregados ou sinal fraco — não são o projeto. |
| **Não via BD** | ANEEL GD, SISLIC/IBAMA, SACI, SIGA | No catálogo **sem tabela** ou só metadado. Ir à fonte oficial (placeholders 005–007). |

**Extração (Python)**

```python
import basedosdados as bd
bd.search("cno", page_size=5)
# Dados exigem billing_project_id (projeto GCP do escritório — não commitar)
bd.read_sql("""
  SELECT * FROM `basedosdados.br_bndes_operacoes_contratadas.operacoes_nao_automaticas`
  WHERE valor_operacao >= 100000000
""", billing_project_id="SEU_PROJETO_GCP")
```

---

### FONTE-013 — Portal Brasileiro de Dados Abertos (dados.gov.br)

| Campo | Valor |
| --- | --- |
| **Nome** | Portal Brasileiro de Dados Abertos |
| **Órgão** | CGU (catálogo nacional; os dados continuam de cada órgão) |
| **Tipo** | `portal` + `api` de **catálogo** (não é API das linhas CNO/CNPJ/obras) |
| **Maturidade** | **Catálogo / descoberta** — chave de API para metadados; cada conjunto depois é ZIP/CSV no órgão |
| **Papel no Radar** | Achar e versionar **quais bases existem**; não é entidade Projeto |
| **Status** | `mapeada` |
| **URL** | https://dados.gov.br/home |
| **Swagger** | https://dados.gov.br/swagger-ui/index.html · spec `https://dados.gov.br/v3/api-docs` |
| **OpenAPI** | 3.1.0 · “API REST do Portal de Dados Abertos” v1.0 |
| **Base** | `https://dados.gov.br` |
| **Auth** | Header `chave-api-dados-abertos` (gov.br, perfil Consumidor em Minha Conta). Sem chave → **401** (confirmado 2026-09-22) |
| **Notion** | [Hub Fontes](https://www.notion.so/3e3dca3eb7d8815186eada36f380ea87) · [FONTE-013 detalhada](https://www.notion.so/3e3dca3eb7d88137a0e9fe0543167e34) |
| **O que a API devolve** | Lista/detalhe de **conjuntos**, organizações, tags, formatos, reúsos — e URLs dos **recursos** (arquivos) |
| **Sobreposição** | CNO e CNPJ **já** estão neste portal (FONTES 004/012). BD (011) é outro catálogo tratado. SIGA ANEEL catalogado aqui → FONTE-006 |
| **CapEx ≥ 100 mi** | Não na API. Só se o arquivo do órgão tiver valor |
| **Linkagem** | `id` do conjunto + URL do recurso; depois as chaves de cada dump |

**Descrição da fonte**

- **Origem:** Decreto 8.777 — órgãos federais (e outros aderentes) **catalogam** dados abertos. A CGU opera o portal. A API **não produz** obras; aponta para arquivos da RFB, ANEEL, DNIT, etc.
- **O que representa:** ficha de dataset (nome, órgão, periodicidade, formatos, links). Buscar “obra” mistura usina, campus de IF, cinema ANCINE e CNO.
- **Usabilidade:** **descobrir** fontes novas (SIGA, licenças, BNDES se publicado). **Monitorar** se um conjunto que já usamos teve recurso atualizado. **Não** monitorar o canteiro. Papel: **índice oficial** para a fase exploratória e para jobs de download.

**API (catálogo)**

```
GET /dados/api/publico/conjuntos-dados?pagina=1
GET /dados/api/publico/conjuntos-dados/{id}
GET /dados/api/publico/organizacao
GET /dados/api/temas
GET /dados/api/tags
```

Filtros da lista: `nomeConjuntoDados`, `dadosAbertos`, `idOrganizacao`, `pagina` (obrigatório). Header: `chave-api-dados-abertos`. POST/PUT/DELETE = publicação de órgão — fora do Radar.

**O que desenvolver**

1. Busca assistida: `nomeConjuntoDados=obra|licen|energia|saneamento|bndes` + filtro por organização (ANEEL, IBAMA, RFB, DNIT).
2. Watch: hash/URL do recurso das FONTES 004/012 (CNO/CNPJ) e SIGA.
3. Fila de avaliação: conjunto novo → virar FONTE-00X ou descartar (ex. obras do IFB).
4. **Não** tratar a API como banco de projetos.

**Conjuntos úteis já vistos neste portal (amostra)**

| Conjunto | Uso Radar | Status inventário |
| --- | --- | --- |
| CNO | Obra física | FONTE-004 |
| CNPJ | Empresa | FONTE-012 |
| SIGA ANEEL | Usinas / geração (todas as fases) | FONTE-006 |
| Transferegov/SICONV (repositório) | Convênios/obras federais | Sobreposição Obrasgov 001 |
| IBAMA / eólica offshore etc. | Licença | FONTE-005 |
| “Acompanhamento das obras” IFB | Ruído (um campus) | Descartar |

---

### FONTE-005 — Licenciamento ambiental (IBAMA + estaduais)

| Campo | Valor |
| --- | --- |
| **Nome** | Órgãos de licenciamento ambiental (SISNAMA) |
| **Órgão** | IBAMA (federal) + CETESB/SP, INEA/RJ, SEMAD/MG, IAT/PR |
| **Tipo** | `portal` + `dataset` (IBAMA/IAT) · consulta HTML nos demais |
| **Status** | `mapeada` (disponibilidade; ingestão = scrape/GIS/CSV, sem API unificada) |
| **Papel no Radar** | Sinal **precoce e de avanço físico**: LP (projeto existe), LI (pode construir), LO (opera). Sem CapEx. |
| **Sobreposição** | BD `sistema_de_licenciamento_ambiental_sislic` **sem tabelas**. PNLA (MMA) agrega de forma incompleta. |
| **CapEx ≥ 100 mi** | Não. Cruza com PNCP/Obrasgov/BNDES/notícia. |
| **Linkagem** | Nome do empreendimento, razão social/CNPJ, município/IBGE, nº processo SEI, tipologia |
| **Notion** | [Hub Fontes](https://www.notion.so/3e3dca3eb7d8815186eada36f380ea87) · [FONTE-005 detalhada](https://www.notion.so/3e3dca3eb7d88171a833e05731869cec) |

**Descrição da fonte**

- **Origem:** competência LC 140 — IBAMA (interestadual, petróleo/gás plataforma, grandes infra) vs. órgão estadual (maioria das obras no estado).
- **O que representa:** **ato de licença** e, quando público, o **estudo** (EIA/RIMA). Não é o contrato nem o valor da obra.
- **Usabilidade:** **identificar** empreendimento grande antes ou fora do PNCP; **monitorar** LP→LI→LO. Documentos completos (PDFs do processo) em geral exigem **pedido de vista**, não dump.

**Disponibilidade por órgão (2026-09-22)**

| Órgão | O que há | Documentos (EIA, parecer, licença PDF) | Bulk / API |
| --- | --- | --- | --- |
| **IBAMA** | Melhor cobertura. Consultas LAF; painel; EIA/RIMA; SEI; dados abertos SISLIC (CSV/JSON de licenças LP/LI/LO/ASV…); GIS. Amostra 2026: gasoduto, porto, petróleo — campos empreendimento, pessoa, processo, tipologia, datas. Atualização do CSV ~diária (`ultima_atualizacao_relatorio`). URL útil: [Consultas LAF](https://www.gov.br/ibama/pt-br/assuntos/laf/consultas) (a URL `/licenciamento-ambiental` 404). | EIA/RIMA e atos no portal/SEI (públicos). Processo completo: SEI / vista. | **Sim:** CSV/JSON [dadosabertos.ibama.gov.br](https://dadosabertos.ibama.gov.br/pt_BR/dataset/licencas-ambientais-de-atividades-e-empreendimentos-licenciados-pelo-ibama) + FeatureServer pamgia |
| **CETESB (SP)** | Consulta pública de **andamento** por CNPJ/razão/endereço (`licenciamento.cetesb.sp.gov.br` / `consultaLicenciamento/public`). Tipo LP/LI/LO, situação, validade. **e-Ambiente** = atendimento do interessado + **pedido de vista** (login), não catálogo aberto. | Licença/autenticidade. PDFs do processo só após vista deferida. | **Não** (HTML). e-Ambiente não é API de dump |
| **INEA (RJ)** | [Portal SELCA](https://portallicenciamento.inea.rj.gov.br/) para requerente; consulta unificada processos + EIA/RIMA no site INEA; SCUP / SEI-RJ. | EIA/RIMA quando publicados; processo via consulta. | **Não** bulk oficial |
| **SEMAD (MG)** | [Consulta de decisões/licenças](https://sistemas.meioambiente.mg.gov.br/licenciamento/site/consulta-licenca) (órgão + município). SLA/EcoSistemas = requerimento com cadastro. | Extrato de decisão/licença na consulta. Processo SLA autenticado. | **Não** (formulário HTML) |
| **IAT (PR)** | Extratos **mensais** no site + GIS [FeatureServer licenças](https://geopr.iat.pr.gov.br/server/rest/services/00_PUBLICACOES/licencas_ambientais_sia_sga/FeatureServer/0): protocolo, razão social, IBGE, modalidade, atividade, emissão/validade, xy. SGA para requerente. | Extratos; geo da licença. Processo no SGA (login). | **Parcial:** ArcGIS REST (máx. 2000/página) |

**Uso Radar:** job IBAMA CSV (tipologias infra/óleo/porto/duto) + IAT GIS para PR; SP/RJ/MG como **lookup por CNPJ** quando o projeto já existe. Não scrape agressivo dos HTML (ToS/captcha).

---

### FONTE-006 — Agências reguladoras setoriais

| Campo | Valor |
| --- | --- |
| **Nome** | ANEEL, ANTT, ANTAQ, ANP, ANA (outorgas / concessões / cadastros de ativo) |
| **Órgão** | Agências reguladoras federais (um nicho cada) |
| **Tipo** | `dataset` + `portal` (painéis); CKAN em ANEEL/ANTT |
| **Status** | `mapeada` (disponibilidade; ingestão por agência, sem API unificada) |
| **Papel no Radar** | **Prospecção por nicho** + enriquecimento: o ativo existe, em que fase está, quem opera. CapEx em R$ só de forma irregular (melhor na ANTT). |
| **Sobreposição** | SIGA também no dados.gov (FONTE-013). BD sem tabelas ANEEL. Ibama (005) licencia o mesmo ativo. SNIS/Cidades ≠ ANA (ficar no placeholder 007). |
| **CapEx ≥ 100 mi** | ANTT: valores de investimento da concessão. ANEEL: MW (proxy). ANP: fase/PEM, não R$ da FPSO. ANTAQ/ANA: cadastro, não valor. |
| **Linkagem** | CEG (ANEEL), trecho/contrato ANTT, instalação/porto ANTAQ, bloco/campo/operadora ANP, nº outorga ANA + município/CNPJ/nome |
| **Notion** | [Hub Fontes](https://www.notion.so/3e3dca3eb7d8815186eada36f380ea87) · [FONTE-006 detalhada](https://www.notion.so/3e3dca3eb7d881589250d4636f42ccf5) |

**Descrição da fonte**

- **Origem:** cada agência regula um mercado (energia, rodovia/ferrovia, porto, óleo e gás, água/saneamento federal). Outorga/concessão/autorização = o Estado reconheceu o ativo.
- **O que representa:** **cadastro nacional do ativo daquele nicho** (usina, trecho, terminal, bloco, captação), não o contrato PNCP nem a obra Obrasgov.
- **Usabilidade:** **prospectar** pipeline (fase pré-operação / obra / outorga nova) e **compor ficha** (operador, geo, potência, contrato). Filtrar por nicho do cliente comercial.

**Disponibilidade por agência (2026-09-22)**

| Agência | O que há | Útil para CapEx? | Bulk / API |
| --- | --- | --- | --- |
| **ANEEL** | **SIGA** CSV/XML/CKAN datastore: todas as fases (pré-outorga → revogação). Campos: `NomEmpreendimento`, `CodCEG`, `DscFaseUsina`, `DscTipoOutorga`, MW (`MdaPotenciaOutorgadaKw`), UF, municípios, coordenadas, regime de participação. **SIGEL** ArcGIS (mapa de empreendimentos). API Conecta “Outorgas de Geração” = OAuth, detalhe por CEG — não é dump. Painel SIGA. | Sim: usinas **não operando** = pipeline geração. MW ≈ porte (não R$). | **Sim:** [dadosabertos.aneel.gov.br SIGA](https://dadosabertos.aneel.gov.br/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel) (atualiz. diária/mensal; CSV ~set/2026) + SIGEL REST |
| **ANTT** | CKAN [dados.antt.gov.br](https://dados.antt.gov.br): trechos concedidos; **investimentos** da concessão (cadastro, autorização, planejamento, acompanhamento, encerramento, inexecução, PIC). CSV/JSON. Grupo ferrovias separado. | **Sim, com valor:** obras da concessionária (duplicação, praça, pátio). Melhor R$ deste conjunto. | **Sim:** CKAN `package_search` público |
| **ANTAQ** | CSV **Instalações portuárias** (ex-Base Outorgas, trimestral, dados.gov). Estatístico Aquaviário = movimentação, não obra. Painéis / SDP = operação. | Cadastro TUP/porto = **quem** e **onde**. Obra nova raramente listada como CapEx. | **Parcial:** CSV instalações; estatística ZIP anual |
| **ANP** | [Dados E&P](https://www.gov.br/anp/pt-br/assuntos/exploracao-e-producao-de-oleo-e-gas/dados-de-e-p/dados-de-exploracao-e-producao): blocos, concessionários, PEM, declaração de comercialidade, campos em desenvolvimento/produção, plataformas, dutos. Painéis + CSV. Consultas CDP/APEX com captcha. Contrato = fonte oficial. | Pipeline óleo/gás (exploração → comercialidade → desenvolvimento). Sem R$ da unidade. | **Parcial:** CSV/painéis; sem REST limpa |
| **ANA** | SNIRH GIS: **outorgas de uso da água** (federal + camada estadual), ponto, empreendimento, vazão, datas. Saneamento regulado pela ANA, mas **SNIS/SINISA** é Ministério das Cidades (indicador, não obra) → placeholder 007. | Sinal de uso hídrico (hidro, indústria, irrigação). Não é o cadastro da usina (isso é SIGA) nem da ETE. | **Parcial:** ArcGIS FeatureServer SNIRH |

**Uso Radar:** job **SIGA** (fase ≠ operação) + job **ANTT investimentos**; ANP CSV de comercialidade/desenvolvimento no nicho óleo; ANTAQ/ANA como lookup do ativo. Cruzar com Ibama (005) e PNCP/Obrasgov. Não scrape de painel Power BI.

---

### FONTE-009 — BNDES Dados Abertos

| Campo | Valor |
| --- | --- |
| **Nome** | Portal de Dados Abertos do BNDES |
| **Órgão** | Banco Nacional de Desenvolvimento Econômico e Social |
| **Tipo** | `dataset` (CKAN + CSV) |
| **Status** | `mapeada` |
| **Papel no Radar** | **Financiamento do CapEx**: operação contratada (direta / indireta) com valor, CNPJ, descrição do projeto |
| **Sobreposição** | Mesmas linhas que `br_bndes_operacoes_contratadas` (FONTE-011). Preferir **este portal** para frescor; BD só se já houver GCP. Não ingestir os dois. |
| **CapEx ≥ 100 mi** | `valor_contratado_reais` (e desembolso). Filtro client-side / datastore. Recorte: **não automáticas** (~23,8k; 19 MiB). Automáticas = 1,1 GiB (FINAME/pequeno) — só se filtrar valor. |
| **Empresas / CNPJ** | `cnpj` do cliente; agente financeiro nas indiretas |
| **Linkagem** | `numero_do_contrato`; CNPJ; IBGE `municipio_codigo`; `descricao_do_projeto` (fuzzy com Obrasgov/SIGA/Ibama) |
| **Notion** | [Hub Fontes](https://www.notion.so/3e3dca3eb7d8815186eada36f380ea87) · [FONTE-009 detalhada](https://www.notion.so/3e3dca3eb7d881d3bc6beab984d0ce23) |

**Descrição da fonte**

- **Origem:** sistema de crédito do BNDES. CKAN público, CSV Windows-1252, atualização **mensal** automática (conjunto visto 21/09/2026).
- **O que representa:** uma **operação de financiamento**, não a obra. “Cliente contratado” é campo da operação (`cliente` + `cnpj`), não um dataset separado de pessoas.
- **Usabilidade:** **identificar** CapEx privado/estadual/municipal financiado pelo BNDES (≥ 100 mi, produto FINEM etc.); **monitorar** `situacao_do_contrato` e `valor_desembolsado_reais`. Não substitui Obrasgov (obra federal) nem PNCP (compra).

**Disponibilidade (2026-09-22)**

| Recurso | Conteúdo | Bulk |
| --- | --- | --- |
| [operacoes-financiamento](https://dadosabertos.bndes.gov.br/dataset/operacoes-financiamento) **não automáticas** | Diretas + indiretas analisadas (critério principal = valor). Campos: `descricao_do_projeto`, `valor_contratado_reais`, `forma_de_apoio` DIRETA, produto, CNAE, porte, situação. Datastore: **23.815** linhas; GET sem token OK. | CSV ~19 MiB + `datastore_search` |
| Mesmo conjunto **indiretas automáticas** | Análise no agente; sem PF e sem Cartão BNDES. Volume enorme. | CSV **1,1 GiB** — evitar dump cheio |
| `consultas` / `aprovacoes` / `desembolsos` | Estatística agregada (porte, UF, produto), **não** projeto. | CSV |
| `renda-variavel` | Participações societárias do BNDES. | CSV |
| API | CKAN 3: `package_list`, `datastore_search`. Exemplos: [github.com/bndes/dados-abertos-exemplos](https://github.com/bndes/dados-abertos-exemplos). Consultas públicas; token só se o snippet pedir. | Sim |

**Uso Radar:** job mensal das **não automáticas** com `valor_contratado_reais >= 1e8`, setor infra/indústria/energia; cruzar CNPJ com 001/003/005/006. Não usar agregados de desembolso como lista de obras.

---

### FONTE-010 — Notícias (lista inicial de portais)

| Campo | Valor |
| --- | --- |
| **Nome** | Portais oficiais, imprensa setorial, CVM/RI, economia, agências estaduais |
| **Tipo** | `noticias` |
| **Status** | `mapeada` (acesso + formato; ingestão = poll + filtro, não API única) |
| **Papel no Radar** | **Descoberta inicial** do projeto. Sem id estável. CapEx na manchete = estimado (confiança baixa). |
| **Notion** | [Hub](https://www.notion.so/3e3dca3eb7d8815186eada36f380ea87) · [FONTE-010](https://www.notion.so/3e3dca3eb7d881868a61da14d92aebbf) |
| **Canvas** | `canvases/radar-noticias-modelo-projeto.canvas.tsx` |

**Acesso (2026-09-22)** — URLs corrigidas: MPOR → `gov.br/portos-e-aeroportos/pt-br/assuntos/noticias`; BNDES → `/wps/portal/site/home/imprensa`; iNFRA → `/blog/` (`/feed/` 404); Transporte Moderno → `transportemoderno.com.br`; CVM consulta → `rad.cvm.gov.br/ENETWeb/frmConsultaExternaCVM.aspx` + ZIP IPE `dados.cvm.gov.br`. Muitos `gov.br` dão **403** a HEAD (WAF). `oe.com.br` 500. InvestSP `/noticias` 404. AEN-PR listing vazio (**vedação eleitoral**). CanalEnergia = Cloudflare. Agência Gov mistura Enem/SUS.

**Formato usual:** governo Plone (categoria + título + data + lead); setorial (manchete + dek com R$/empresa/UF); CVM grid + PDF; RI lista de fatos + PDF.

**Campos extraíveis da notícia:** nome, empresa (sem CNPJ), UF/município, valor mencionado, fase verbal, setor. **Não** extrair CNPJ inventado.

**Modelo de persistência:** tabela `sinal` (1 URL) + tabela `projeto` (entidade) + `ator_projeto`. Ver canvas e página Notion.

---

## Fontes em pesquisa (placeholders)

| ID | Nome / pista | Tipo | Status | Notas |
| --- | --- | --- | --- | --- |
| FONTE-007 | Saneamento (SINISA, SNIS histórico, metas ANA) | portal / planilha | em_estudo | SINISA e série histórica do SNIS mapeados em 2026-09-28. Painel da ANA não confirmado. Não é lista de obra. |
| FONTE-008 | Prefeituras / Estados / União (portais de obras e transparência) | portal | em_estudo | MiDES + execução estadual na FONTE-011. Segue adiado. |

Avaliação das candidatas recebidas em 2026-09-28 está na página `/captura`. Resumo: mapear Portal Cidadão do DNIT, DOU, Querido Diário, REIDI de transportes, ANBIMA Data, SIGMINE e PAR/ONS. Já cobertos: Transferegov/Obrasgov e portaria de debêntures. Fora de escopo: contratos e despesas públicas do Portal da Transparência. Adiar: diários estaduais, SIMEC, SISMOB e fundos SUDENE/SUDAM.

---

## Changelog

| Data | Mudança |
| --- | --- |
| 2026-09-22 | Criação do inventário; FONTE-001 Obrasgov mapeada (docs + OpenAPI + SchemaSpy + smoke test API) |
| 2026-09-22 | FONTE-002 Portal da Transparência mapeada (OpenAPI 106 endpoints, auth, CSV); placeholders CNO+ renumerados 003–009 |
| 2026-09-22 | FONTE-003 PNCP mapeada (consulta 12 GET + integração GET público; 122k contratos em 3 semanas); placeholders CNO+ → 004–010 |
| 2026-09-22 | Seção “Descrição da fonte” (origem, o que representa, usabilidade identificação/monitoramento) nas três páginas e no `fontes.md` |
| 2026-09-22 | FONTE-011 Base dos Dados: estudo do catálogo (1.276 conjuntos); P1 CNO/BNDES/CNPJ/sanções |
| 2026-09-22 | FONTE-011 marcada como **avançada**: processo GCP + dados específicos para aprofundar projetos |
| 2026-09-22 | CNO oficial: sem API; dados abertos CSV/ZIP (dados.gov); e-CAC autenticado; cobertura via FONTE-011 |
| 2026-09-22 | FONTE-004 CNO dump RFB e FONTE-012 CNPJ dump RFB mapeados (sobreposição com FONTE-011; dumps = origem bruta) |
| 2026-09-22 | FONTE-013 Portal dados.gov mapeada (API de catálogo + chave; não é API das linhas) |
| 2026-09-22 | FONTE-005 licenciamento ambiental: IBAMA dados abertos + CETESB/INEA/SEMAD/IAT (consulta; IAT GIS) |
| 2026-09-22 | FONTE-006 agências reguladoras: ANEEL SIGA/SIGEL, ANTT investimentos, ANTAQ instalações, ANP E&P, ANA outorgas |
| 2026-09-22 | FONTE-009 BNDES: CKAN operações não automáticas (23,8k) com valor/CNPJ; overlap FONTE-011 |
| 2026-09-22 | FONTE-010 notícias: listagens acessadas; URLs corrigidas; modelo sinal+projeto |
| 2026-09-23 | Guia MVP em `requisitos.txt` (primária/secundária, 5 projetos, 2 dashboards) |
| 2026-09-24 | Seed do dashboard: todas as fontes mapeadas (exceto 007/008 em estudo); novas primárias inativas no scanner |
| 2026-09-28 | Catálogo operacional inteiro ativo. Captura mapeia formato, acesso e unidade; scanner segue só no piloto. Fontes possíveis: 007, 008, DOU e DNIT |
| 2026-09-28 | Avaliação das candidatas de saneamento, DNIT, diários, REIDI, debêntures, repasses, SIGMINE, PAR e fundos regionais |
| 2026-09-28 | Fontes avaliadas com URL entram no dashboard, com explicação e sem coleta automática |
| 2026-10-21 | FONTE-002 Portal da Transparência fora do MVP: dinheiro público não é o recorte do Radar |
