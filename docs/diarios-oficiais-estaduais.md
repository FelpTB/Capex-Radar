# Diários oficiais estaduais no Radar CapEx

Gerado por `npm run docs:doe` em 2026-10-28, a partir do registro dos diários (`src/doe-registry.js`) e dos módulos que montam o hub de fontes. Edite lá, não aqui. Cada seção corresponde à página `/fontes/CAPTURA-DOE-{UF}` do MVP.

## Resumo

As 27 UFs estão conectadas ao fluxo de enriquecimento. A ficha escolhe o diário pela UF do projeto e procura a raiz do CNPJ e o nome da empresa. 23 estados têm busca pública no portal, que o Radar chama ao vivo. PA, PB, RO e RR só publicam o PDF da edição: o Radar baixa as edições, extrai o texto de cada página e consulta o próprio índice.

| UF | Diário | Como o Radar lê | Unidade | Acervo |
| --- | --- | --- | --- | --- |
| AC | Diário Oficial do Estado do Acre | API ou página de busca própria | edição | Anos de 2010 até hoje; um ano por consulta. |
| AL | Diário Oficial do Estado de Alagoas | API ou página de busca própria | página | Índice desde 1960. Em 27/10/2026 o índice ia só até 24/09/2026 (atraso de cerca de um mês). |
| AM | Diário Oficial do Estado do Amazonas | API ou página de busca própria | matéria | Anos desde 1955, com lacuna no índice de 2011 a 2016. |
| AP | Diário Oficial do Estado do Amapá (DIOFE) | API de busca (motor IONEWS) | página | Texto pesquisável desde 1990. |
| BA | Diário Oficial do Estado da Bahia | API de busca (motor IONEWS) | página | Diário Oficial do Estado da Bahia, com busca de texto integral por página desde 2007. |
| CE | Diário Oficial do Estado do Ceará | API ou página de busca própria | página do PDF | Texto pesquisável desde 2000. |
| DF | Diário Oficial do Distrito Federal (DODF) | API ou página de busca própria | matéria | Busca por matéria desde junho de 2020. Antes disso só há busca nos PDFs, sem data nem página. |
| ES | Diário Oficial do Estado do Espírito Santo (DIO-ES) | API de busca (motor IONEWS) | página | Texto pesquisável desde 2003 (índice multidiarios). |
| GO | Diário Oficial do Estado de Goiás | API de busca (motor IONEWS) | página | Texto pesquisável desde 2007, ordem por data decrescente. |
| MA | Diário Oficial do Estado do Maranhão | API ou página de busca própria | página | Texto pesquisável desde 2000. |
| MG | Jornal Minas Gerais | API ou página de busca própria | trecho | Jornal Minas Gerais, diário oficial do estado, com texto pesquisável desde 2011. |
| MS | Diário Oficial do Estado de Mato Grosso do Sul | API ou página de busca própria | página | Texto pesquisável desde janeiro de 2007. |
| MT | Diário Oficial do Estado de Mato Grosso (IOMAT) | API de busca (motor IONEWS) | página | Acervo desde 1967; a busca da ficha começa em 2015. |
| PA | Diário Oficial do Estado do Pará (IOEPA) | Índice de PDFs do Radar | página | Edições em PDF consultáveis por data desde pelo menos 2019 no /Frame; o índice do Radar cobre o período carregado. |
| PB | Diário Oficial do Estado da Paraíba (A União) | Índice de PDFs do Radar | página | Pastas por ano desde 2007 (2020 não aparece); o índice do Radar cobre o período carregado. |
| PE | Diário Oficial do Estado de Pernambuco (CEPE) | API ou página de busca própria | matéria | Texto pesquisável desde janeiro de 2019, só o Poder Executivo. |
| PI | Diário Oficial do Estado do Piauí | API ou página de busca própria | matéria | Notas do sistema novo, de 2022 em diante. |
| PR | Diário Oficial do Estado do Paraná | API de busca (motor IONEWS) | página | Diário Oficial do Estado do Paraná, com busca de texto integral por página. |
| RJ | Diário Oficial do Estado do Rio de Janeiro | API ou página de busca própria | matéria | Texto pesquisável desde 2006, em todas as partes do DO. |
| RN | Diário Oficial do Estado do Rio Grande do Norte | API ou página de busca própria | matéria | Texto pesquisável desde dezembro de 2022, quando o diário passou para a plataforma SDOE. |
| RO | Diário Oficial do Estado de Rondônia (DIOF) | Índice de PDFs do Radar | página | Edições em PDF desde 2012 no WordPress do DIOF; o índice do Radar cobre o período carregado. |
| RR | Diário Oficial do Estado de Roraima | Índice de PDFs do Radar | página | Edições listadas por mês desde 1980; o índice do Radar cobre o período carregado. |
| RS | Diário Oficial do Estado do Rio Grande do Sul e Diário da Indústria e Comércio | API ou página de busca própria | matéria | Matérias desde 2019; páginas do acervo antigo até 1989. |
| SC | Diário Oficial do Estado de Santa Catarina | API ou página de busca própria | matéria | Texto pesquisável desde cerca de 2011. |
| SE | Diário Oficial do Estado de Sergipe (IOSE) | API de busca (motor IONEWS) | página | Texto pesquisável desde dezembro de 2011; o índice estava em dia em 27/10/2026. |
| SP | Diário Oficial do Estado de São Paulo | API ou página de busca própria | ato | Novo portal do Diário Oficial de SP, com busca avançada de atos desde maio de 2023. |
| TO | Diário Oficial do Estado do Tocantins | API ou página de busca própria | página do PDF | Edições de 2015 em diante confirmadas; início do acervo não confirmado. |

## Fluxo comum

1. A ficha do projeto tem UF, município, CNPJ e razão social da empresa. A UF escolhe o diário (`src/enrichment/viability.js`).
2. O conector busca a raiz do CNPJ com máscara (XX.XXX.XXX) e o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI), desde 2015.
3. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
4. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
5. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
6. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Índice de PDFs (PA, PB, RO, RR)

- Tabelas `doe_pdf_edicao` (uma linha por PDF lido) e `doe_pdf_pagina` (texto, texto compacto e raízes de CNPJ de cada página), criadas em `sql/016_doe_pdf_indice.sql`.
- Carga: `npm run doe:pdf-sync -- --dias N [--uf PA,RO]`. O agendador do servidor relê todo dia os últimos 7 dias; cada rodada grava uma linha em `base_carga`, que aparece na página da fonte.
- A ficha consulta o índice por `raizes @> array[raiz]` ou pelo nome colado no texto compacto. O portal só é chamado pelo sincronizador.

### Correlação direta com o projeto

A busca acha registros da empresa, pelo CNPJ ou pelo nome. Isso não basta: a mesma empresa tem outras plantas, minas, filiais e obras. Um registro só vira evidência da ficha quando tem correlação direta com o projeto.

1. Corte por estado, sem modelo. Registro com UF diferente da UF da ficha é descartado como outro_estado. Uma licença do Paraná não comprova uma obra em Minas Gerais, mesmo sendo da mesma empresa.

2. Ordem por município. Os registros que citam o município da ficha vão primeiro para a leitura. Até 60 registros por fonte são lidos; o que passa disso conta como não avaliado e não vira evidência.

3. Leitura do contexto. O modelo recebe o nome, o nicho, o município e a UF do projeto e, para cada registro, o texto em volta do CNPJ ou do nome (até 1.500 caracteres) e os campos estruturados. Ele classifica cada registro como direta, outro_projeto ou incerta. Município, atividade, objeto e empreendimento citados no texto pesam mais que o nome da empresa.

4. Só direta vira evidência. outro_projeto e incerta ficam fora. Na dúvida, fica fora. As contagens da anotação (por exemplo "Foram achados 3 trechos") passam a contar só os registros diretos.

5. Rastro. A evidência guarda em campos_extraidos.correlacao quantos registros foram avaliados e quantos saíram por motivo, e cada linha mantida traz em correlacao a frase que justifica o vínculo.

6. Sem modelo. Se a chave da OpenAI faltar ou a chamada falhar, o filtro cai para o município da ficha: só passa registro com município igual ao do projeto. O método usado fica gravado em correlacao.metodo (contexto ou municipio).

7. Limpeza. Se uma fonte consultada com sucesso não tiver nenhum registro direto, a evidência secundária antiga dessa fonte na ficha é apagada. Erro de rede não apaga nada.

## AC — Acre

**Diário Oficial do Estado do Acre** · código `CAPTURA-DOE-AC`

- **Situação:** conectado. API ou página de busca própria.
- **Órgão:** Secretaria de Estado da Casa Civil do Acre
- **Portal:** <https://diario.ac.gov.br/>
- **Acervo:** Anos de 2010 até hoje; um ano por consulta.
- **O que se acha:** licença do IMAC, contrato e concessão do estado.

### Como o portal funciona e como o dado aparece

- A busca é o formulário da página inicial (POST). A resposta é HTML em ISO-8859-1 com "Quantidade de resultados encontrados: N" e uma tabela com duas linhas por edição.
- Linha tr#trId1_{id}: data DD/MM/AAAA, link do PDF da edição inteira (download.php?arquivo={base64}) com "Diário Oficial N° {numero} - {caderno}" e o tamanho em MB. Linha tr#trId2_{id}: cerca de 200 caracteres em volta da primeira ocorrência do termo, com o termo em <span class="destaque">.
- Um trecho por edição: outras ocorrências na mesma edição não aparecem. Alguns caracteres já chegam perdidos da origem (?).
- Exemplo real (Energisa Acre, 23/10/2026): "…no município de Rio Branco, Estado do Acre. ENERGISA ACRE - DISTRIBUIDORA DE ENERGIA S.A CNPJ: 04.065.033/0001-70 Torna público que re…".

### Campos do dado

A busca é o formulário da página inicial (POST). A resposta é HTML em ISO-8859-1 com "Quantidade de resultados encontrados: N" e uma tabela com duas linhas por edição. Exemplo bruto em amostras/CAPTURA-DOE-AC/

**Campos de cada edição (7)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `Quantidade de resultados encontrados` | texto | Total de edições do ano. A ficha conta as que citam a empresa. |
| `tr trId1_(id)` | linha HTML | O {id} interno vira a chave. |
| `td (1ª)` | data DD/MM/AAAA | Data da edição. Vira data. |
| `a[href]` | endereço URL | download.php?arquivo={base64 do nome do PDF}. PDF da edição inteira, de 7 a 60 MB. Vira url. |
| `a (texto)` | texto | Diário Oficial N° {numero} - {caderno}. Vira titulo. |
| `td.txtright` | texto | Tamanho do PDF. A ficha não copia. |
| `tr trId2_(id) p` | texto com HTML | Cerca de 200 caracteres em volta do termo. Vira trecho e texto. |

### Chamadas feitas pelo Radar

`POST https://diario.ac.gov.br/`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `palavra` | `04.065.033 ou energisa acre distribuidora` | Uma chamada para a raiz do CNPJ com máscara (XX.XXX.XXX) e outra para o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). Codificado em ISO-8859-1; aspas zeram a busca. |
| `ano_palavra` | `ano atual e os 3 anteriores` | Um ano por consulta. |
| `palavraTipo` | `0` | Texto exato. 1 exigiria todas as palavras. |
| `paginaIni` | `0` | Só a primeira página (10 edições). |

Corpo application/x-www-form-urlencoded, resposta em ISO-8859-1. Sem cookie nem token.

### Passo a passo da extração

1. Para cada termo, consulta o ano atual e os três anteriores, só a primeira página (até 10 edições por ano).
2. Lê cada tr#trId1_{id} e a tr#trId2_{id} correspondente com cheerio: data, título, link e trecho.
3. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
4. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
5. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
6. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Limitações

- Só os quatro anos mais recentes e até 10 edições por ano e termo, para não passar de 8 consultas. O link é o PDF da edição inteira, sem página. O trecho é só da primeira ocorrência na edição.
- Só os quatro anos mais recentes e até 10 edições por ano e termo, para não passar de 8 consultas. O link é o PDF da edição inteira, sem página. O trecho é só da primeira ocorrência na edição.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-AC/busca-cnpj-energisa-acre.html`
- `amostras/CAPTURA-DOE-AC/LEIA.txt`

## AL — Alagoas

**Diário Oficial do Estado de Alagoas** · código `CAPTURA-DOE-AL`

- **Situação:** conectado. API ou página de busca própria.
- **Órgão:** Imprensa Oficial Graciliano Ramos (Alagoas)
- **Portal:** <https://diario.imprensaoficial.al.gov.br/>
- **Busca usada na coleta:** `https://diario.imprensaoficial.al.gov.br/apinova/api/editions/searchES`
- **Acervo:** Índice desde 1960. Em 27/10/2026 o índice ia só até 24/09/2026 (atraso de cerca de um mês).
- **O que se acha:** licença e autuação do IMA, incentivo do PRODESIN e contrato do estado.

### Como o portal funciona e como o dado aparece

- O portal Vue chama /apinova/api/editions/searchES por POST com JSON. Cada item é uma página de edição com o destaque do termo.
- O envelope é {status, result: {items, total_rows, aggregations}}. total_rows.relation vira gte acima de 10.000.
- highlight é uma lista de fragmentos de ~100 caracteres com o termo entre <em> e <\/em> (a barra vem escapada). A API não traz o texto da página.
- A mesma página pode voltar repetida com edition_id diferentes; o conector tira a repetição por data, página e trecho.
- Exemplo real (Braskem, 03/09/2026, página 90): ", Povoado Francês, Marechal Deodoro - AL. Protocolo 1111113 A Braskem, CNPJ: 42.150.391/0020-33".

### Campos do dado

O portal Vue chama /apinova/api/editions/searchES por POST com JSON. Cada item é uma página de edição com o destaque do termo. Exemplo bruto em amostras/CAPTURA-DOE-AL/

**Campos de cada página (9)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `id` | inteiro | Identificador da página no índice. A ficha não copia. |
| `edition_id` | inteiro | Identificador da edição. Entra no link do PDF. |
| `edition_number` | inteiro | Número impresso da edição. Entra no titulo. |
| `publication_date` | data AAAA-MM-DD | Dia da edição. Vira data. |
| `page_number` | inteiro | Página. Vira pagina e entra no link. |
| `edition_type_name` | texto | Veículo, como Diário Oficial do Estado de Alagoas. Entra no titulo. |
| `is_suplement` | booleano | Marca de suplemento. A ficha não copia. |
| `highlight` | lista de texto com HTML | Fragmentos com o termo em <em>. Juntados com … viram texto. |
| `path` | texto | Caminho interno do .txt da página, só em parte dos itens. Não é URL; a ficha não copia. |

### Chamadas feitas pelo Radar

`POST https://diario.imprensaoficial.al.gov.br/apinova/api/editions/searchES?page={1-4}`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `keywords` | `42.150.391 ou braskem` | Uma chamada para a raiz do CNPJ com máscara (XX.XXX.XXX) e outra para o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). |
| `searchType` | `frase_exata` | Frase na ordem. toda_palavra faria E; qualquer_palavra, OU. |
| `range` | `["2015-01-01", hoje]` | Período AAAA-MM-DD. |
| `order` | `novo` | Mais recentes primeiro. |
| `edition_number` | `""` | Sem filtro de edição. |

Corpo JSON. Sem token. 15 itens por página, fixo.

### Passo a passo da extração

1. Faz até quatro páginas por termo (60 páginas de diário).
2. Para cada item: junta os fragmentos do highlight, desfaz a barra escapada e tira o HTML; publication_date vira data; page_number, pagina; edition_type_name e edition_number, titulo.
3. Monta a chave data:página:começo do trecho, para tirar as repetições de edition_id.
4. Monta o link: /apinova/api/editions/viewPdf/{edition_id}#page={page_number}.
5. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
6. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
7. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
8. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Limitações

- O índice da busca atrasa cerca de um mês em relação às edições publicadas. Trecho curto (~100 caracteres por fragmento) e sem texto da página.
- O índice da busca atrasa cerca de um mês em relação às edições publicadas. Trecho curto (~100 caracteres por fragmento) e sem texto da página.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-AL/busca-cnpj-braskem.json`
- `amostras/CAPTURA-DOE-AL/LEIA.txt`

## AM — Amazonas

**Diário Oficial do Estado do Amazonas** · código `CAPTURA-DOE-AM`

- **Situação:** conectado. API ou página de busca própria.
- **Órgão:** Imprensa Oficial do Estado do Amazonas
- **Portal:** <https://diario.imprensaoficial.am.gov.br/>
- **Busca usada na coleta:** `https://diario.imprensaoficial.am.gov.br/apibusca/multidiarios/busca`
- **Acervo:** Anos desde 1955, com lacuna no índice de 2011 a 2016.
- **O que se acha:** licença do IPAAM, autorização da ARSEPAM e incentivo da SEDECTI.

### Como o portal funciona e como o dado aparece

- O portal é da família IONEWS, mas a busca usa outra rota: /apibusca/multidiarios/busca. A rota do DOE-BA (/busca/busca/buscar/query) responde 404 aqui.
- A resposta é {data: {resultados, total, years}}. Cada item de resultados é uma matéria, não uma página: título, categoria, edição, página e o destaque com o termo.
- highlight tem de 300 a cerca de 1.200 caracteres. Começa no título da matéria e junta fragmentos com [...]; o termo vem em <strong>.
- Exemplo real (Petrobras, 20/12/2024, página 49): "PORTARIA 171/2024 - GDP/ARSEPAM — DISPÕE SOBRE O DEFERIMENTO DO REGISTRO DE AUTORIZAÇÃO DE COMERCIALIZADOR DE GÁS NATURAL À PETROBRAS (CNPJ sob o N° 33.000.167/0001-01)…".

### Campos do dado

O portal é da família IONEWS, mas a busca usa outra rota: /apibusca/multidiarios/busca. A rota do DOE-BA (/busca/busca/buscar/query) responde 404 aqui. Exemplo bruto em amostras/CAPTURA-DOE-AM/

**Campos de cada matéria (14)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `highlight` | texto com HTML | Título e fragmentos com o termo em <strong>, separados por [...]. Vira texto, de onde sai o trecho. |
| `id` | texto UUID | Identificador da matéria. Vira a chave que tira repetidos. |
| `publicado_em` | data AAAA-MM-DD | Dia da publicação. Vira data. |
| `tipo` | texto | m para matéria. A ficha não copia. |
| `diario_id / diario_slug / diario_nome` | número / texto | Diário do índice (1, diario_am). A ficha não copia. |
| `edicao_id` | inteiro | Identificador da edição. Entra no link do PDF. |
| `edicao_titulo / edicao_numero / edicao_data / edicao_ano` | texto | Título, número, data DD/MM/AAAA e ano de circulação da edição. A ficha não copia. |
| `edicao_pagina` | inteiro | Página da matéria. Vira pagina e entra no link. |
| `edicao_suplemento / edicao_suplemento_nome` | booleano / texto | Marca de suplemento. A ficha não copia. |
| `materia_id` | inteiro | Identificador da matéria no visualizador HTML. A ficha não copia. |
| `materia_titulo` | texto | Título do ato, como PORTARIA 171/2024 - GDP/ARSEPAM. Vira titulo. |
| `materia_categoria` | texto | Hierarquia ;PODER EXECUTIVO;…;PORTARIAS. Vira orgao, com > no lugar de ;. |
| `materia_caderno / materia_parte / materia_anexo` | texto / booleano | Caderno, parte e anexo. A ficha não copia. |
| `data.total` | inteiro | Total de matérias da busca. A ficha conta as que citam a empresa. |

### Chamadas feitas pelo Radar

`GET https://diario.imprensaoficial.am.gov.br/apibusca/multidiarios/busca`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `q` | `33.000.167 ou petroleo brasileiro petrobras` | Uma chamada para a raiz do CNPJ com máscara (XX.XXX.XXX) e outra para o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). |
| `exata` | `1` | Frase exata. Aspas são ignoradas por esta API. |
| `data_init / data_end` | `01-01-2015 / hoje (DD-MM-AAAA)` | Período, no formato com hífen. |
| `page` | `1, 2, 3` | 10 matérias por página; para quando uma página vem incompleta. |

Sem token. TLS válido.

### Passo a passo da extração

1. Faz até três páginas de busca por termo (30 matérias).
2. Para cada matéria: tira o HTML do highlight e guarda como texto; materia_titulo vira titulo; materia_categoria vira orgao; publicado_em vira data; edicao_pagina vira pagina.
3. Monta o link do PDF da página: /portal/edicoes/download/{edicao_id}/{edicao_pagina}.
4. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
5. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
6. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
7. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Limitações

- O índice tem lacuna de 2011 a 2016. A busca da ficha começa em 2015, então 2015 e 2016 ficam quase sem resultado. Quando o termo casa só no título, o highlight pode não trazer a raiz do CNPJ.
- O índice tem lacuna de 2011 a 2016. A busca da ficha começa em 2015, então 2015 e 2016 ficam quase sem resultado. Quando o termo casa só no título, o highlight pode não trazer a raiz do CNPJ.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-AM/busca-cnpj-petrobras.json`
- `amostras/CAPTURA-DOE-AM/LEIA.txt`

## AP — Amapá

**Diário Oficial do Estado do Amapá (DIOFE)** · código `CAPTURA-DOE-AP`

- **Situação:** conectado. API de busca (motor IONEWS).
- **Órgão:** Imprensa Oficial do Amapá
- **Portal:** <https://diofe.portal.ap.gov.br/>
- **Busca usada na coleta:** `https://diofe.portal.ap.gov.br/busca/busca/buscar/query`
- **Acervo:** Texto pesquisável desde 1990.
- **O que se acha:** licença da SEMA-AP, concessão e contrato do estado.

### Como o portal funciona e como o dado aparece

- O Diário Oficial do Estado do Amapá (DIOFE) não publica uma API documentada. A busca do portal chama um Elasticsearch, e o Radar lê a mesma resposta JSON que a página usa.
- O envelope é o padrão do Elasticsearch: took, timed_out, _shards e hits. Em hits vêm total (quantas páginas do diário têm o termo), max_score e a lista hits.hits.
- Cada item de hits.hits é uma página inteira de uma edição, não um ato. _id junta edição e página (21987_41 é a página 41 da edição 21987). _source.conteudo traz o texto corrido da página toda, já sem quebras, com todos os atos daquela página misturados. _source traz também data (AAAA-MM-DD), pagina, paginas, diario_id, pdf_id, year, month, day e tipo_edicao.
- highlight.conteudo é uma lista de frases da página em HTML, com o termo buscado em <strong>. É a parte que interessa: mostra onde o CNPJ ou o nome aparece.
- Exemplo do teste ao vivo (Petrobras, 16/07/2025): "… Controle dos recursos transferidos pela União, provenientes da cessão onerosa à Petróleo…". A raiz achou 16 páginas desde 2015; uma delas casou com números de tabela, por isso o filtro de citação continua.
- O CNPJ aparece no texto com pontos (50.351.104/0001-10), com espaços ou sem separador, conforme o órgão que publicou. Por isso a busca usa a raiz com máscara e o filtro compara só os dígitos.

### Campos do dado

JSON do Elasticsearch atrás da busca do Diário Oficial do Estado do Amapá (DIOFE), o mesmo motor do DOE-BA. Cada resultado é uma página do diário, com o texto inteiro e o destaque do termo. Exemplo bruto em amostras/CAPTURA-DOE-AP/

**Campos de cada resultado em hits.hits**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `_id` | texto | Diário e página, como 21987_41. Usado para tirar repetidos entre buscas; a ficha não copia. |
| `_score` | número | Relevância da busca. A ficha não copia; ordena por município, tipo de ato e data. |
| `_source.conteudo` | texto | Texto inteiro da página. A ficha só usa quando falta o destaque. |
| `_source.data` | data AAAA-MM-DD | Dia da edição. Vira data. |
| `_source.pagina` | texto numérico | Página da edição. Vira pagina e entra no link. |
| `_source.paginas` | texto numérico | Total de páginas da edição. A ficha não copia. |
| `_source.diario_id` | texto numérico | Identificador da edição. Entra no link. |
| `_source.pdf_id` | texto numérico | Identificador do PDF da edição. A ficha não copia. |
| `_source.year` | texto | Ano da edição. A ficha não copia. |
| `_source.month` | texto | Mês da edição. A ficha não copia. |
| `_source.day` | texto | Dia da edição. A ficha não copia. |
| `_source.tipo_edicao` | texto numérico | 1 para edição regular. A ficha não copia. |
| `highlight.conteudo` | lista de HTML | Frases da página com o termo em strong. A ficha limpa o HTML e junta até 400 caracteres em trecho. |

### Chamadas feitas pelo Radar

`GET https://diofe.portal.ap.gov.br/busca/busca/buscar/query/{pagina}/di:2015-01-01/df:{hoje}/?1=1&q="{termo}"`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `{pagina}` | `0, depois 1` | 10 resultados por página. A página 1 só é pedida se a 0 vier cheia. |
| `di / df` | `2015-01-01 / hoje` | Período no caminho da URL. |
| `q` | `"33.000.167" ou "petroleo brasileiro petrobras"` | Termo entre aspas, para buscar a frase. Uma chamada para a raiz do CNPJ com máscara (XX.XXX.XXX) e outra para o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). |

Sem token nem login. TLS válido com as raízes padrão do Node.

### Passo a passo da extração

1. Monta os termos: a raiz do CNPJ com máscara (XX.XXX.XXX) e o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI), quando tem pelo menos quatro letras. Cada termo vai entre aspas, para buscar a frase.
2. Para cada termo, chama a busca na página 0. Se vierem 10 resultados, chama também a página 1. São no máximo 20 páginas do diário por termo, 40 no total.
3. Para cada resultado, junta as frases de highlight.conteudo com " … " e tira o HTML. Sem destaque, usa _source.conteudo.
4. Recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Em lista corrida, o que vem antes do termo é outro registro, então o recorte começa só 1/5 da janela antes.
5. Guarda também um contexto de 1.200 caracteres em volta do termo. Ele não vai para a ficha; serve só para a correlação ler o ato inteiro.
6. Descarta a página que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (com três letras ou mais), comparadas sem acento.
7. Tira repetidos pelo _id, porque a mesma página volta na busca pelo CNPJ e na busca pelo nome.
8. Classifica o ato pelo trecho: ato_relevante (licença, alvará, decreto, incentivo, outorga, TAC, implantação, ampliação…), compra_publica (licitação, pregão, registro de preço, homologação, dispensa) ou outro.
9. Marca no_municipio quando o trecho cita o município da ficha e ordena: município primeiro, depois ato relevante, outro e compra pública, e por fim a data mais recente.
10. Monta o link: https://diofe.portal.ap.gov.br/portal/edicoes/download/{diario_id}/{pagina}, o PDF só daquela página, público.
11. Passa todos os atos para a correlação. Os diretos viram a evidência, com até 8 linhas: data, pagina, trecho, url, tipo_ato, no_municipio e o motivo da correlação.

### Limitações

- Cada resultado é uma página inteira, com atos de órgãos diferentes. O contexto em volta do termo é que diz qual ato é da empresa. Sem aspas, os termos viram OU; o conector sempre manda aspas. Mesmo com aspas a frase tolera inversão de palavras, então o filtro de citação continua necessário.
- Cada resultado é uma página inteira, com atos de órgãos diferentes. O contexto em volta do termo é que diz qual ato é da empresa. Sem aspas, os termos viram OU; o conector sempre manda aspas. Mesmo com aspas a frase tolera inversão de palavras, então o filtro de citação continua necessário.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-AP/busca-cnpj-petrobras.json`
- `amostras/CAPTURA-DOE-AP/LEIA.txt`

## BA — Bahia

**Diário Oficial do Estado da Bahia** · código `CAPTURA-DOE-BA`

- **Situação:** conectado. API de busca (motor IONEWS).
- **Órgão:** Empresa Gráfica da Bahia (EGBA)
- **Portal:** <https://dool.egba.ba.gov.br/>
- **Busca usada na coleta:** `https://dool.egba.ba.gov.br/busca/busca/buscar/query`

### Como o portal funciona e como o dado aparece

- O Diário Oficial da Bahia (DOOL, da EGBA) não publica uma API documentada. A busca do portal chama um Elasticsearch, e o Radar lê a mesma resposta JSON que a página usa.
- O envelope é o padrão do Elasticsearch: took, timed_out, _shards e hits. Em hits vêm total (quantas páginas do diário têm o termo), max_score e a lista hits.hits.
- Cada item de hits.hits é uma página inteira de uma edição, não um ato. _id junta edição e página (21987_41 é a página 41 da edição 21987). _source.conteudo traz o texto corrido da página toda, já sem quebras, com todos os atos daquela página misturados. _source traz também data (AAAA-MM-DD), pagina, paginas, diario_id, pdf_id, year, month, day e tipo_edicao.
- highlight.conteudo é uma lista de frases da página em HTML, com o termo buscado em <strong>. É a parte que interessa: mostra onde o CNPJ ou o nome aparece.
- Exemplo real (BYD Auto do Brasil, 29/05/2026, página 41): _source.conteudo começa com férias de servidor da SEMA e uma portaria do INEMA sobre fiscal de transferência de animais. O destaque mostra o ato da empresa: "O INSTITUTO DO MEIO AMBIENTE E RECURSOS HÍDRICOS - INEMA […] Processo nº 2026.001.002146/INEMA/LIC-02146, RESOLVE: Art. 1º - Conceder LICENÇA DE ALTERAÇÃO, válida até 19/07/2030, à BYD AUTO DO BRASIL LTDA, inscrito no CNPJ sob o nº 50.351.104/0001-19". O endereço e o objeto vêm depois do CNPJ, por isso o contexto da correlação pega o texto que segue o termo.
- O CNPJ aparece no texto com pontos (50.351.104/0001-10), com espaços ou sem separador, conforme o órgão que publicou. Por isso a busca usa a raiz com máscara e o filtro compara só os dígitos.

### Campos do dado

JSON do Elasticsearch atrás da busca do DOOL da EGBA. Cada resultado é uma página do diário, com o texto inteiro e o destaque do termo. Exemplo bruto em amostras/CAPTURA-DOE-BA/

**Campos de cada resultado em hits.hits**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `_id` | texto | Diário e página, como 21987_41. Usado para tirar repetidos entre buscas; a ficha não copia. |
| `_score` | número | Relevância da busca. A ficha não copia; ordena por município, tipo de ato e data. |
| `_source.conteudo` | texto | Texto inteiro da página. A ficha só usa quando falta o destaque. |
| `_source.data` | data AAAA-MM-DD | Dia da edição. Vira data. |
| `_source.pagina` | texto numérico | Página da edição. Vira pagina e entra no link. |
| `_source.paginas` | texto numérico | Total de páginas da edição. A ficha não copia. |
| `_source.diario_id` | texto numérico | Identificador da edição. Entra no link. |
| `_source.pdf_id` | texto numérico | Identificador do PDF da edição. A ficha não copia. |
| `_source.year` | texto | Ano da edição. A ficha não copia. |
| `_source.month` | texto | Mês da edição. A ficha não copia. |
| `_source.day` | texto | Dia da edição. A ficha não copia. |
| `_source.tipo_edicao` | texto numérico | 1 para edição regular. A ficha não copia. |
| `highlight.conteudo` | lista de HTML | Frases da página com o termo em strong. A ficha limpa o HTML e junta até 400 caracteres em trecho. |

### Chamadas feitas pelo Radar

`GET https://dool.egba.ba.gov.br/busca/busca/buscar/query/{pagina}/di:2015-01-01/df:{hoje}/?1=1&q="{termo}"`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `{pagina}` | `0, depois 1` | Página da busca, 10 resultados por página. A página 1 só é pedida se a 0 vier cheia. |
| `di / df` | `2015-01-01 / hoje` | Período no próprio caminho da URL. |
| `q` | `"50.351.104" ou "byd auto brasil"` | Termo entre aspas, para buscar a frase. Uma busca para a raiz do CNPJ e outra para o nome. |

Sem token. O servidor não manda o certificado intermediário (GeoTrust TLS RSA CA G1); a cadeia fica em src/enrichment/certs/. O PDF da edição pede login, então o link abre o visualizador.

### Passo a passo da extração

1. Monta os termos: a raiz do CNPJ com máscara (XX.XXX.XXX) e o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI), quando tem pelo menos quatro letras. Cada termo vai entre aspas, para buscar a frase.
2. Para cada termo, chama a busca na página 0. Se vierem 10 resultados, chama também a página 1. São no máximo 20 páginas do diário por termo, 40 no total.
3. Para cada resultado, junta as frases de highlight.conteudo com " … " e tira o HTML. Sem destaque, usa _source.conteudo.
4. Recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Em lista corrida, o que vem antes do termo é outro registro, então o recorte começa só 1/5 da janela antes.
5. Guarda também um contexto de 1.200 caracteres em volta do termo. Ele não vai para a ficha; serve só para a correlação ler o ato inteiro.
6. Descarta a página que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (com três letras ou mais), comparadas sem acento.
7. Tira repetidos pelo _id, porque a mesma página volta na busca pelo CNPJ e na busca pelo nome.
8. Classifica o ato pelo trecho: ato_relevante (licença, alvará, decreto, incentivo, outorga, TAC, implantação, ampliação…), compra_publica (licitação, pregão, registro de preço, homologação, dispensa) ou outro.
9. Marca no_municipio quando o trecho cita o município da ficha e ordena: município primeiro, depois ato relevante, outro e compra pública, e por fim a data mais recente.
10. Monta o link: https://dool.egba.ba.gov.br/ver-flip/{diario_id}/#/e:{diario_id}/p:{pagina}?find={termo}, que abre o visualizador na página com o termo marcado.
11. Passa todos os atos para a correlação. Os diretos viram a evidência, com até 8 linhas: data, pagina, trecho, url, tipo_ato, no_municipio e o motivo da correlação.

### Particularidades da correlação

- A página do DOOL junta atos de órgãos diferentes. Uma portaria do INEMA tem preâmbulo longo e o CNPJ vem depois; o contexto de 1.200 caracteres em volta do termo pega o ato da empresa, não o começo da página.
- Incentivo DESENVOLVE ou PROAUTO, licença do INEMA e contrato de terreno citando Camaçari são os atos que costumam ter correlação direta com uma fábrica na Bahia.

### Limitações

- O PDF da edição pede login, então a evidência fica com o trecho e o visualizador. Página com vários atos pode trazer o nome em ato de outra empresa.
- Página com vários atos traz ruído, o PDF pede login e a resolução de incentivo raramente traz valor; a leitura para em duas páginas de resultado por termo.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-BA/busca-cnpj-byd.json`
- `amostras/CAPTURA-DOE-BA/LEIA.txt`

## CE — Ceará

**Diário Oficial do Estado do Ceará** · código `CAPTURA-DOE-CE`

- **Situação:** conectado. API ou página de busca própria.
- **Órgão:** Secretaria do Planejamento e Gestão do Ceará (SEPLAG)
- **Portal:** <http://pesquisa.doe.seplag.ce.gov.br/doepesquisa/>
- **Busca usada na coleta:** `http://pesquisa.doe.seplag.ce.gov.br/doepesquisa/sead.to`
- **Acervo:** Texto pesquisável desde 2000.
- **O que se acha:** licença da SEMACE, incentivo do FDI e contrato do estado.

### Como o portal funciona e como o dado aparece

- A pesquisa textual é um sistema Java legado que só responde em HTTP. Devolve HTML em ISO-8859-1 com uma tabela: data do diário (com o link do PDF do caderno e #page=N), número do diário, caderno e página. Não há trecho nem texto.
- O rodapé diz "N registros encontrados. Página X de Y", com 8 linhas por página, do mais antigo para o mais novo. A paginação fica presa à sessão (cookie JSESSIONID).
- O PDF fica em imagens.seplag.ce.gov.br, que só responde em HTTPS na pasta /PDF/. O conector abre só a página citada.
- Exemplo do teste ao vivo (Petrobras, 09/02/2026, caderno 1, página 31): "… E SOBRE A AUTORIZAÇÃO DE COMERCIALIZADOR DE GÁS CANALIZADO NO ESTADO DO CEARÁ À PETRÓLEO…".

### Campos do dado

A pesquisa textual é um sistema Java legado que só responde em HTTP. Devolve HTML em ISO-8859-1 com uma tabela: data do diário (com o link do PDF do caderno e #page=N), número do diário, caderno e página. Não há trecho nem texto. Exemplo bruto em amostras/CAPTURA-DOE-CE/

**Campos de cada página do PDF (6)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `a[href] (1ª coluna)` | endereço URL e texto | http://imagens.seplag.ce.gov.br/pdf/{AAAAMMDD}/do{AAAAMMDD}p{caderno}.pdf#page={N}, com a data DD-MM-AAAA como texto. Viram data e url (em https, pasta /PDF/). |
| `td (2ª)` | inteiro | Número do diário. Entra no titulo. |
| `td (3ª)` | inteiro | Caderno. Entra no titulo. |
| `td (4ª)` | inteiro | Página do caderno. Vira pagina. |
| `rodapé` | texto | N registros encontrados. Página X de Y. Decide se o conector navega para as últimas páginas. |
| `texto da página do PDF` | texto | Extraído com pdfjs da página indicada. Vira texto. |

### Chamadas feitas pelo Radar

`GET http://pesquisa.doe.seplag.ce.gov.br/doepesquisa/sead.to`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `page / action / cmd / flag` | `pesquisaTextual / PesquisarTextual / 11 / 1` | Valores fixos da pesquisa textual. |
| `RadioGroup1` | `radio3` | Frase exata, lida em pesqEx. |
| `pesqEx` | `33.000.167 ou petroleo brasileiro petrobras` | Uma chamada para a raiz do CNPJ com máscara (XX.XXX.XXX) e outra para o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). Codificado em ISO-8859-1; acentos importam. |
| `dataini / datafim` | `01/01/2015 / hoje` | Obrigatórias; sem elas a resposta é "Registros não encontrados". |

Só HTTP. Guarda o cookie JSESSIONID para navegar.

`GET http://pesquisa.doe.seplag.ce.gov.br/doepesquisa/sead.do?page=pesquisaTextual&cmd=ultimo&action=NavegarBasico&flag=1`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `cmd` | `ultimo, depois anterior` | Vai para as últimas páginas do resultado, as mais recentes. |

Com o cookie da busca.

`GET https://imagens.seplag.ce.gov.br/PDF/{AAAAMMDD}/do{AAAAMMDD}p{caderno}.pdf`

PDF do caderno, cerca de 1 MB.

### Passo a passo da extração

1. Faz a busca por termo e lê as linhas da tabela. Se houver mais de uma página de resultado, navega com o mesmo cookie até a última e a anterior, que têm as publicações mais recentes.
2. Junta as linhas, ordena da mais recente para a mais antiga e fica com 6.
3. Baixa o PDF de cada caderno (uma vez por caderno) e extrai só a página indicada.
4. Cada página vira um ato: data, página, diário e caderno no título, texto da página e link do PDF com #page=.
5. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
6. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
7. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
8. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Limitações

- Sistema legado em HTTP, com respostas de 0,2 a 35 s e paginação presa à sessão. O nome vai sem acento (a ficha normaliza a razão social) e a busca do CE diferencia acentos; o CNPJ é o termo que funciona. Só as 6 páginas mais recentes são lidas.
- Sistema legado em HTTP, com respostas de 0,2 a 35 s e paginação presa à sessão. O nome vai sem acento (a ficha normaliza a razão social) e a busca do CE diferencia acentos; o CNPJ é o termo que funciona. Só as 6 páginas mais recentes são lidas.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-CE/busca-cnpj-petrobras.html`
- `amostras/CAPTURA-DOE-CE/LEIA.txt`

## DF — Distrito Federal

**Diário Oficial do Distrito Federal (DODF)** · código `CAPTURA-DOE-DF`

- **Situação:** conectado. API ou página de busca própria.
- **Órgão:** Casa Civil do Distrito Federal
- **Portal:** <https://dodf.df.gov.br/>
- **Busca usada na coleta:** `https://dodf.df.gov.br/dodf/materia/listar`
- **Acervo:** Busca por matéria desde junho de 2020. Antes disso só há busca nos PDFs, sem data nem página.
- **O que se acha:** licença do IBRAM, contrato, concessão de uso e incentivo do DF.

### Como o portal funciona e como o dado aparece

- O DODF tem uma busca por matéria em JSON, chamada por formulário (POST). Cada item é um ato com título, órgão, tipo, seção, número do DODF e um resumo de cerca de 330 caracteres em volta do termo.
- O envelope traz type, result, flashMsg, filtros, listaMaterias, totalMaterias, totalPaginas e pagina. Erro de validação volta como texto de var_dump do PHP, não JSON.
- Exemplo do teste ao vivo (Petrobras, 24/08/2020): extrato de contrato de doação entre a Secretaria de Saúde do DF e a Petróleo Brasileiro S.A. Pela raiz 33.000.167 vieram 4 matérias desde 2015.
- Algumas matérias são listas coladas sem espaço ("07.342.72233.000.167PETROLEO BRASILEIRO"), como a portaria anual de contribuintes da Fazenda. A correlação descarta esse tipo de lista.

### Campos do dado

O DODF tem uma busca por matéria em JSON, chamada por formulário (POST). Cada item é um ato com título, órgão, tipo, seção, número do DODF e um resumo de cerca de 330 caracteres em volta do termo. Exemplo bruto em amostras/CAPTURA-DOE-DF/

**Campos de cada matéria (11)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `co_materia` | inteiro | Identificador da matéria. Vira a chave e entra no link. |
| `ds_titulo` | texto | Título do ato. Vira titulo. |
| `co_demandante` | inteiro | Identificador do órgão. A ficha não copia. |
| `ds_nome` | texto | Órgão que publicou. Vira orgao. |
| `co_jornal_secao / ds_secao` | inteiro / texto | Seção I, II ou III. ds_secao vira caderno. |
| `co_materia_tipo / ds_materia_tipo` | inteiro / texto | Tipo do ato, como Portaria ou Extrato de contrato. A ficha não copia. |
| `dt_previsao_publicacao` | data e hora ISO | Data de publicação. Vira data. |
| `co_jornal_tipo / co_regra_jornal_tipo / ds_descricao_jornal_tipo` | inteiro / texto | Edição normal, extra, suplemento ou especial. A ficha não copia. |
| `nu_jornal` | inteiro | Número do DODF. A ficha não copia. |
| `tx_resumo` | texto com HTML | Cerca de 330 caracteres em volta do termo, com o termo em <strong>. Vira texto, de onde sai o trecho. |
| `slug` | texto | Slug do ato. Entra no link; sem ele a página não traz o texto. |

### Chamadas feitas pelo Radar

`POST https://dodf.df.gov.br/dodf/materia/listar`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `termo` | `33.000.167 ou petroleo brasileiro petrobras` | Uma chamada para a raiz do CNPJ com máscara (XX.XXX.XXX) e outra para o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). Sem pontos o CNPJ não é achado. |
| `tpBusca` | `exata` | Frase. contexto exigiria todas as palavras em qualquer ordem. |
| `dtInicial / dtFinal` | `2015-01-01 / hoje` | Período. |
| `pagina` | `1, 2, 3` | 10 matérias por página, fixo. |

Corpo application/x-www-form-urlencoded. Sem cookie nem token.

### Passo a passo da extração

1. Faz até três páginas por termo (30 matérias).
2. Para cada matéria: tira o HTML de tx_resumo e guarda como texto; ds_titulo vira titulo; ds_nome, orgao; ds_secao, caderno; os 10 primeiros caracteres de dt_previsao_publicacao, data.
3. Monta o link: /dodf/materia/visualizar?co_data={co_materia}&p={slug}.
4. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
5. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
6. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
7. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Limitações

- Só há busca por matéria desde junho de 2020. O acervo antigo fica fora, porque a busca em PDF não traz data nem página e repete resultados. O resumo é curto (cerca de 330 caracteres). O texto integral está na página visualizar, que o conector não abre.
- Só há busca por matéria desde junho de 2020. O acervo antigo fica fora, porque a busca em PDF não traz data nem página e repete resultados. O resumo é curto (cerca de 330 caracteres). O texto integral está na página visualizar, que o conector não abre.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-DF/busca-cnpj-petrobras.json`
- `amostras/CAPTURA-DOE-DF/LEIA.txt`

## ES — Espírito Santo

**Diário Oficial do Estado do Espírito Santo (DIO-ES)** · código `CAPTURA-DOE-ES`

- **Situação:** conectado. API de busca (motor IONEWS).
- **Órgão:** Departamento de Imprensa Oficial do Espírito Santo (DIO-ES)
- **Portal:** <https://ioes.dio.es.gov.br/>
- **Busca usada na coleta:** `https://ioes.dio.es.gov.br/busca/busca/buscar/query`
- **Acervo:** Texto pesquisável desde 2003 (índice multidiarios).
- **O que se acha:** licença do IEMA, incentivo do INVEST-ES e contrato do estado.

### Como o portal funciona e como o dado aparece

- O Diário Oficial do Estado do Espírito Santo (DIO-ES) não publica uma API documentada. A busca do portal chama um Elasticsearch, e o Radar lê a mesma resposta JSON que a página usa.
- O envelope é o padrão do Elasticsearch: took, timed_out, _shards e hits. Em hits vêm total (quantas páginas do diário têm o termo), max_score e a lista hits.hits.
- Cada item de hits.hits é uma página inteira de uma edição, não um ato. _id junta edição e página (21987_41 é a página 41 da edição 21987). _source.conteudo traz o texto corrido da página toda, já sem quebras, com todos os atos daquela página misturados. _source traz também data (AAAA-MM-DD), pagina, paginas, diario_id, pdf_id, year, month, day e tipo_edicao.
- highlight.conteudo é uma lista de frases da página em HTML, com o termo buscado em <strong>. É a parte que interessa: mostra onde o CNPJ ou o nome aparece.
- Exemplo do teste ao vivo (Vale, 24/05/2021): "Protocolo 671812 VALE S/A ESTRADA DE FERRO VITÓRIA-MINAS CNPJ/MF nº 33.592.510/0262-00…". A raiz 33.592.510 achou 40 páginas desde 2015.
- O CNPJ aparece no texto com pontos (50.351.104/0001-10), com espaços ou sem separador, conforme o órgão que publicou. Por isso a busca usa a raiz com máscara e o filtro compara só os dígitos.

### Campos do dado

JSON do Elasticsearch atrás da busca do Diário Oficial do Estado do Espírito Santo (DIO-ES), o mesmo motor do DOE-BA. Cada resultado é uma página do diário, com o texto inteiro e o destaque do termo. Exemplo bruto em amostras/CAPTURA-DOE-ES/

**Campos de cada resultado em hits.hits**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `_id` | texto | Diário e página, como 21987_41. Usado para tirar repetidos entre buscas; a ficha não copia. |
| `_score` | número | Relevância da busca. A ficha não copia; ordena por município, tipo de ato e data. |
| `_source.conteudo` | texto | Texto inteiro da página. A ficha só usa quando falta o destaque. |
| `_source.data` | data AAAA-MM-DD | Dia da edição. Vira data. |
| `_source.pagina` | texto numérico | Página da edição. Vira pagina e entra no link. |
| `_source.paginas` | texto numérico | Total de páginas da edição. A ficha não copia. |
| `_source.diario_id` | texto numérico | Identificador da edição. Entra no link. |
| `_source.pdf_id` | texto numérico | Identificador do PDF da edição. A ficha não copia. |
| `_source.year` | texto | Ano da edição. A ficha não copia. |
| `_source.month` | texto | Mês da edição. A ficha não copia. |
| `_source.day` | texto | Dia da edição. A ficha não copia. |
| `_source.tipo_edicao` | texto numérico | 1 para edição regular. A ficha não copia. |
| `highlight.conteudo` | lista de HTML | Frases da página com o termo em strong. A ficha limpa o HTML e junta até 400 caracteres em trecho. |

### Chamadas feitas pelo Radar

`GET https://ioes.dio.es.gov.br/busca/busca/buscar/query/{pagina}/di:2015-01-01/df:{hoje}/?1=1&q="{termo}"`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `{pagina}` | `0, depois 1` | 10 resultados por página. A página 1 só é pedida se a 0 vier cheia. |
| `di / df` | `2015-01-01 / hoje` | Período no caminho da URL. |
| `q` | `"33.000.167" ou "petroleo brasileiro petrobras"` | Termo entre aspas, para buscar a frase. Uma chamada para a raiz do CNPJ com máscara (XX.XXX.XXX) e outra para o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). |

Sem token nem login. TLS válido com as raízes padrão do Node.

### Passo a passo da extração

1. Monta os termos: a raiz do CNPJ com máscara (XX.XXX.XXX) e o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI), quando tem pelo menos quatro letras. Cada termo vai entre aspas, para buscar a frase.
2. Para cada termo, chama a busca na página 0. Se vierem 10 resultados, chama também a página 1. São no máximo 20 páginas do diário por termo, 40 no total.
3. Para cada resultado, junta as frases de highlight.conteudo com " … " e tira o HTML. Sem destaque, usa _source.conteudo.
4. Recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Em lista corrida, o que vem antes do termo é outro registro, então o recorte começa só 1/5 da janela antes.
5. Guarda também um contexto de 1.200 caracteres em volta do termo. Ele não vai para a ficha; serve só para a correlação ler o ato inteiro.
6. Descarta a página que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (com três letras ou mais), comparadas sem acento.
7. Tira repetidos pelo _id, porque a mesma página volta na busca pelo CNPJ e na busca pelo nome.
8. Classifica o ato pelo trecho: ato_relevante (licença, alvará, decreto, incentivo, outorga, TAC, implantação, ampliação…), compra_publica (licitação, pregão, registro de preço, homologação, dispensa) ou outro.
9. Marca no_municipio quando o trecho cita o município da ficha e ordena: município primeiro, depois ato relevante, outro e compra pública, e por fim a data mais recente.
10. Monta o link: https://ioes.dio.es.gov.br/portal/edicoes/download/{diario_id}/{pagina}, o PDF só daquela página, público.
11. Passa todos os atos para a correlação. Os diretos viram a evidência, com até 8 linhas: data, pagina, trecho, url, tipo_ato, no_municipio e o motivo da correlação.

### Particularidades da correlação

- O índice se chama multidiarios. Nos resultados vistos, todas as páginas eram do Diário Oficial do ES; não foi confirmado se outros diários entram no mesmo índice.

### Limitações

- Cada resultado é uma página inteira, com atos de órgãos diferentes. O contexto em volta do termo é que diz qual ato é da empresa. Sem aspas, os termos viram OU; o conector sempre manda aspas. Mesmo com aspas a frase tolera inversão de palavras, então o filtro de citação continua necessário.
- Cada resultado é uma página inteira, com atos de órgãos diferentes. O contexto em volta do termo é que diz qual ato é da empresa. Sem aspas, os termos viram OU; o conector sempre manda aspas. Mesmo com aspas a frase tolera inversão de palavras, então o filtro de citação continua necessário.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-ES/busca-cnpj-vale.json`
- `amostras/CAPTURA-DOE-ES/LEIA.txt`

## GO — Goiás

**Diário Oficial do Estado de Goiás** · código `CAPTURA-DOE-GO`

- **Situação:** conectado. API de busca (motor IONEWS).
- **Órgão:** Agência Brasil Central (ABC), Goiás
- **Portal:** <https://diariooficial.abc.go.gov.br/>
- **Busca usada na coleta:** `https://diariooficial.abc.go.gov.br/busca/busca/buscar/query`
- **Acervo:** Texto pesquisável desde 2007, ordem por data decrescente.
- **O que se acha:** licença da SEMAD-GO, incentivo do PRODUZIR e FOMENTAR e desapropriação.

### Como o portal funciona e como o dado aparece

- O Diário Oficial do Estado de Goiás não publica uma API documentada. A busca do portal chama um Elasticsearch, e o Radar lê a mesma resposta JSON que a página usa.
- O envelope é o padrão do Elasticsearch: took, timed_out, _shards e hits. Em hits vêm total (quantas páginas do diário têm o termo), max_score e a lista hits.hits.
- Cada item de hits.hits é uma página inteira de uma edição, não um ato. _id junta edição e página (21987_41 é a página 41 da edição 21987). _source.conteudo traz o texto corrido da página toda, já sem quebras, com todos os atos daquela página misturados. _source traz também data (AAAA-MM-DD), pagina, paginas, diario_id, pdf_id, year, month, day e tipo_edicao.
- highlight.conteudo é uma lista de frases da página em HTML, com o termo buscado em <strong>. É a parte que interessa: mostra onde o CNPJ ou o nome aparece.
- Exemplo do teste ao vivo (Petrobras, 03/05/2018): "… Uma área de 5.055,53m², com servidão da PETROLEO BRASILEIRO…", em decreto de desapropriação. A raiz 33.000.167 achou 17 páginas desde 2015.
- O CNPJ aparece no texto com pontos (50.351.104/0001-10), com espaços ou sem separador, conforme o órgão que publicou. Por isso a busca usa a raiz com máscara e o filtro compara só os dígitos.

### Campos do dado

JSON do Elasticsearch atrás da busca do Diário Oficial do Estado de Goiás, o mesmo motor do DOE-BA. Cada resultado é uma página do diário, com o texto inteiro e o destaque do termo. Exemplo bruto em amostras/CAPTURA-DOE-GO/

**Campos de cada resultado em hits.hits**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `_id` | texto | Diário e página, como 21987_41. Usado para tirar repetidos entre buscas; a ficha não copia. |
| `_score` | número | Relevância da busca. A ficha não copia; ordena por município, tipo de ato e data. |
| `_source.conteudo` | texto | Texto inteiro da página. A ficha só usa quando falta o destaque. |
| `_source.data` | data AAAA-MM-DD | Dia da edição. Vira data. |
| `_source.pagina` | texto numérico | Página da edição. Vira pagina e entra no link. |
| `_source.paginas` | texto numérico | Total de páginas da edição. A ficha não copia. |
| `_source.diario_id` | texto numérico | Identificador da edição. Entra no link. |
| `_source.pdf_id` | texto numérico | Identificador do PDF da edição. A ficha não copia. |
| `_source.year` | texto | Ano da edição. A ficha não copia. |
| `_source.month` | texto | Mês da edição. A ficha não copia. |
| `_source.day` | texto | Dia da edição. A ficha não copia. |
| `_source.tipo_edicao` | texto numérico | 1 para edição regular. A ficha não copia. |
| `highlight.conteudo` | lista de HTML | Frases da página com o termo em strong. A ficha limpa o HTML e junta até 400 caracteres em trecho. |

### Chamadas feitas pelo Radar

`GET https://diariooficial.abc.go.gov.br/busca/busca/buscar/query/{pagina}/di:2015-01-01/df:{hoje}/?1=1&q="{termo}"`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `{pagina}` | `0, depois 1` | 10 resultados por página. A página 1 só é pedida se a 0 vier cheia. |
| `di / df` | `2015-01-01 / hoje` | Período no caminho da URL. |
| `q` | `"33.000.167" ou "petroleo brasileiro petrobras"` | Termo entre aspas, para buscar a frase. Uma chamada para a raiz do CNPJ com máscara (XX.XXX.XXX) e outra para o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). |

Sem token nem login. TLS válido com as raízes padrão do Node.

### Passo a passo da extração

1. Monta os termos: a raiz do CNPJ com máscara (XX.XXX.XXX) e o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI), quando tem pelo menos quatro letras. Cada termo vai entre aspas, para buscar a frase.
2. Para cada termo, chama a busca na página 0. Se vierem 10 resultados, chama também a página 1. São no máximo 20 páginas do diário por termo, 40 no total.
3. Para cada resultado, junta as frases de highlight.conteudo com " … " e tira o HTML. Sem destaque, usa _source.conteudo.
4. Recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Em lista corrida, o que vem antes do termo é outro registro, então o recorte começa só 1/5 da janela antes.
5. Guarda também um contexto de 1.200 caracteres em volta do termo. Ele não vai para a ficha; serve só para a correlação ler o ato inteiro.
6. Descarta a página que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (com três letras ou mais), comparadas sem acento.
7. Tira repetidos pelo _id, porque a mesma página volta na busca pelo CNPJ e na busca pelo nome.
8. Classifica o ato pelo trecho: ato_relevante (licença, alvará, decreto, incentivo, outorga, TAC, implantação, ampliação…), compra_publica (licitação, pregão, registro de preço, homologação, dispensa) ou outro.
9. Marca no_municipio quando o trecho cita o município da ficha e ordena: município primeiro, depois ato relevante, outro e compra pública, e por fim a data mais recente.
10. Monta o link: https://diariooficial.abc.go.gov.br/portal/edicoes/download/{diario_id}/{pagina}, o PDF só daquela página, público.
11. Passa todos os atos para a correlação. Os diretos viram a evidência, com até 8 linhas: data, pagina, trecho, url, tipo_ato, no_municipio e o motivo da correlação.

### Limitações

- Cada resultado é uma página inteira, com atos de órgãos diferentes. O contexto em volta do termo é que diz qual ato é da empresa. Sem aspas, os termos viram OU; o conector sempre manda aspas. Mesmo com aspas a frase tolera inversão de palavras, então o filtro de citação continua necessário.
- Cada resultado é uma página inteira, com atos de órgãos diferentes. O contexto em volta do termo é que diz qual ato é da empresa. Sem aspas, os termos viram OU; o conector sempre manda aspas. Mesmo com aspas a frase tolera inversão de palavras, então o filtro de citação continua necessário.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-GO/busca-cnpj-petrobras.json`
- `amostras/CAPTURA-DOE-GO/LEIA.txt`

## MA — Maranhão

**Diário Oficial do Estado do Maranhão** · código `CAPTURA-DOE-MA`

- **Situação:** conectado. API ou página de busca própria.
- **Órgão:** Secretaria de Estado da Casa Civil do Maranhão
- **Portal:** <https://diariooficial.ma.gov.br/>
- **Busca usada na coleta:** `https://diariooficial.ma.gov.br/ajax.busca.php`
- **Acervo:** Texto pesquisável desde 2000.
- **O que se acha:** licença e outorga da SEMA-MA, incentivo do PROMARANHÃO e contrato do estado.

### Como o portal funciona e como o dado aparece

- A busca chama ajax.busca.php e recebe JSON {busca: {erro, scrollId, es_html, total, totalFragmentos, btnLoad, msn}}. Os resultados vêm como HTML pronto em es_html, um cartão por fragmento.
- Cada cartão traz o caderno em <strong> (EXECUTIVO, TERCEIROS…), "Publicado em DD/MM/AAAA" em #dataPub, o trecho com o termo destacado em p.card-text, "Página: N" e um botão setModal('CADERNO', 'Página', 'CODIGO_EDICAO', …).
- CODIGO_EDICAO é o prefixo do caderno mais a data (TE20261014). O trecho tem cerca de 400 caracteres.
- Exemplo real (Vale, 14/10/2026, Terceiros, página 29): "VALE S.A CNPJ Nº 33.592.510/0378-21 A Vale portadora do CNPJ 33.592.510/0378-21 torna público que RECEBEU da Secretaria de Estado de Meio Ambiente e Recursos Naturais – SEMA em 02/10/2026, Outorga de Direito de Uso de Recursos Hídricos…".

### Campos do dado

A busca chama ajax.busca.php e recebe JSON {busca: {erro, scrollId, es_html, total, totalFragmentos, btnLoad, msn}}. Os resultados vêm como HTML pronto em es_html, um cartão por fragmento. Exemplo bruto em amostras/CAPTURA-DOE-MA/

**Campos de cada página (9)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `busca.total` | inteiro | Páginas encontradas. A ficha conta os trechos que citam a empresa. |
| `busca.scrollId` | texto | Cursor do Elasticsearch para a próxima leva. O conector lê só a primeira. |
| `busca.es_html` | HTML | Cartões dos resultados. É de onde tudo sai. |
| `busca.totalFragmentos / btnLoad / msn / erro` | número / booleano / texto | Controle da busca. A ficha não copia. |
| `strong (cartão)` | texto | Caderno. Vira caderno. |
| `dataPub` | texto | Publicado em DD/MM/AAAA. Vira data. |
| `p.card-text` | texto com HTML | Trecho com o termo. Vira texto. |
| `Página N` | texto | Página na edição. Vira pagina. |
| `setModal()` | chamada JavaScript | O terceiro argumento é o código da edição. Entra no link. |

### Chamadas feitas pelo Radar

`GET https://diariooficial.ma.gov.br/ajax.busca.php`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `termo` | `33.592.510 ou vale` | Uma chamada para a raiz do CNPJ com máscara (XX.XXX.XXX) e outra para o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). Várias palavras já viram frase; o CNPJ só é achado com pontos. |
| `datai / dataf` | `2015-01-01 / hoje` | Período. |
| `caderno` | `vazio` | Todos os cadernos. |

Sem token. A primeira leva traz cerca de 100 páginas, as mais recentes.

### Passo a passo da extração

1. Faz uma busca por termo e lê os cartões de es_html com cheerio.
2. Para cada cartão: caderno, data, página, trecho e o código da edição tirado de setModal.
3. Monta o link: /download.php?arq={CODIGO_EDICAO}#page={pagina}.
4. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
5. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
6. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
7. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Limitações

- Só a primeira leva do scroll é lida (cerca de 100 páginas). Nome curto vira ruído: "Vale" casa com sobrenomes, como a deputada Iracema Vale. O CNPJ e a correlação cuidam disso.
- Só a primeira leva do scroll é lida (cerca de 100 páginas). Nome curto vira ruído: "Vale" casa com sobrenomes, como a deputada Iracema Vale. O CNPJ e a correlação cuidam disso.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-MA/busca-cnpj-vale.json`
- `amostras/CAPTURA-DOE-MA/LEIA.txt`

## MG — Minas Gerais

**Jornal Minas Gerais** · código `CAPTURA-DOE-MG`

- **Situação:** conectado. API ou página de busca própria.
- **Órgão:** Imprensa Oficial de Minas Gerais
- **Portal:** <https://www.jornalminasgerais.mg.gov.br/>
- **API usada na coleta:** `https://www.jornalminasgerais.mg.gov.br/api/v1/Pesquisa/PesquisarJornaisPaginados`
- **Token anônimo usado na coleta:** `https://www.jornalminasgerais.mg.gov.br/api/v1/Autenticacao/Autenticar`

### Como o portal funciona e como o dado aparece

- O Jornal Minas Gerais tem uma API REST (v1) usada pelo próprio portal. A pesquisa não exige cadastro, mas só responde com um token: chamada sem o cabeçalho Authorization volta HTTP 401. Por isso abrir a URL da pesquisa direto no navegador sempre dá 401.
- O token é anônimo e se pede em POST /api/v1/Autenticacao/Autenticar com corpo {}. A resposta é {"dados": "<JWT>"}. O JWT tem usuário genérico ("Usuário"), emissor e público segov-portal-ui e vale 2 horas. GET nesse endereço responde 405.
- Para testar à mão (bash): T=$(curl -s -X POST -H 'content-type: application/json' -d '{}' https://www.jornalminasgerais.mg.gov.br/api/v1/Autenticacao/Autenticar | sed 's/.*"dados":"\([^"]*\)".*/\1/') e depois curl -H "Authorization: Bearer $T" 'https://www.jornalminasgerais.mg.gov.br/api/v1/Pesquisa/PesquisarJornaisPaginados?DataPublicacaoInicial=2015-01-01&DataPublicacaoFinal=2026-10-27&TextoPesquisa=17.227.422&PaginaAtual=1&TamanhoPagina=3'. Sem a palavra Bearer antes do token a API também responde 401. Teste feito em 27/10/2026: sem token 401; com token 200 e 6 trechos para a raiz 17.227.422 (totalDeRegistros). O conector, somando a busca pela raiz e pelo nome, achou 51 trechos da Gerdau Açominas.
- Coleção Postman com a autenticação automática e os testes de 200, 401 e 405: docs/postman/jornal-minas-gerais.postman_collection.json. Rodada com o Newman em 27/10/2026: 10 de 10 verificações passaram.
- A resposta da pesquisa é um envelope com dados (lista de trechos), paginaAtual, totalDePaginas, totalDeRegistros e erros.
- Cada item de dados é um trecho de uma página, não um ato inteiro: idJornal (o caderno da edição), dataPublicacao (data e hora ISO, sempre meia-noite), tipoCaderno (Diário do Executivo, Diário dos Municípios ou Diário de Terceiros), pagina e textoResultado.
- textoResultado tem cerca de 200 caracteres em volta do termo. O texto sai do PDF sem acento, sem pontuação no CNPJ e com ligaduras quebradas: "fi rmado com Gerdau Acominas S A (CNPJ:17 227 422/0001-05) e fi liais de Barao de Cocais".
- Exemplo real (Gerdau, 17/09/2026, página 11 do Diário do Executivo): "*Gerdau Acominas S A, Vigia, CNPJ N: 17 227 422/0140-76, Corte ou aproveitamento de arvores isoladas nativas vivas, Ouro Preto-MG, Processo N: 2100…". O município e a atividade estão no próprio trecho, que é o que a correlação lê.
- O mesmo trecho pode citar outra unidade da empresa. No exemplo de 29/09/2026, o protocolo de intenções cancelado é das filiais de Barão de Cocais e Divinópolis, não da mina de Miguel Burnier.

### Campos do dado

JSON da API v1 do Jornal Minas Gerais. A pesquisa pede token anônimo e devolve dados com a paginação. Exemplo bruto em amostras/CAPTURA-DOE-MG/

**Campos de cada trecho em dados (5)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `idJornal` | inteiro | Identificador do caderno da edição. Entra no link do visualizador. |
| `dataPublicacao` | data e hora ISO | Dia da edição. Vira data em AAAA-MM-DD. |
| `tipoCaderno` | texto | Diário do Executivo, dos Municípios ou de Terceiros. Vira caderno. |
| `textoResultado` | texto | Trecho com o termo, sem acento e com quebras do PDF. Vira trecho. |
| `pagina` | inteiro | Página do caderno. Vira pagina e entra no link. |

**Envelope da pesquisa**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `paginaAtual` | inteiro | Página da pesquisa devolvida. A ficha não copia. |
| `totalDePaginas` | inteiro | Total de páginas da pesquisa. A ficha não copia. |
| `totalDeRegistros` | inteiro | Total de trechos achados. A ficha não copia. |
| `erros` | lista | Mensagens de erro da API. Veio vazia. A ficha não copia. |

### Chamadas feitas pelo Radar

`POST https://www.jornalminasgerais.mg.gov.br/api/v1/Autenticacao/Autenticar`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `corpo` | `{}` | Sem usuário nem senha. A resposta traz o token JWT em dados. |
| `content-type` | `application/json` | Cabeçalho exigido pela API. |

Tem de ser POST: GET responde 405. Uma vez por consulta da ficha; o token vale 2 horas e não é guardado.

`GET https://www.jornalminasgerais.mg.gov.br/api/v1/Pesquisa/PesquisarJornaisPaginados`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `Authorization` | `Bearer {token}` | Obrigatório. Sem ele, ou sem o prefixo Bearer, a API responde 401. |
| `TextoPesquisa` | `17.227.422 ou gerdau acominas` | Uma chamada para a raiz do CNPJ e outra para o nome. |
| `DataPublicacaoInicial` | `2015-01-01` | Início fixo do período. |
| `DataPublicacaoFinal` | `data de hoje` | Fim do período. |
| `DiarioExecutivo, DiarioMunicipios, DiarioTerceiros, EdicaoExtra` | `true` | Todos os cadernos entram. |
| `PaginaAtual` | `1` | Só a primeira página da pesquisa. |
| `TamanhoPagina` | `40` | Até 40 trechos por termo. |

O servidor não manda o certificado intermediário (Sectigo DV R36). Navegador e curl no Windows buscam o intermediário sozinhos e não percebem; o Node falha com UNABLE_TO_VERIFY_LEAF_SIGNATURE. A cadeia fica em src/enrichment/certs/ e soma-se às raízes do Node; a verificação TLS continua ligada.

### Passo a passo da extração

1. Pede o token anônimo.
2. Faz duas pesquisas: a raiz do CNPJ com máscara (XX.XXX.XXX) e o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). São até 80 trechos.
3. Normaliza cada trecho: junta espaços, corta dataPublicacao em AAAA-MM-DD e guarda caderno, pagina e trecho.
4. Monta a chave idJornal:pagina:primeiros 60 caracteres do trecho para tirar repetidos entre as duas pesquisas.
5. Descarta o trecho que não cita a empresa: precisa ter os dígitos da raiz do CNPJ (o texto vem como 17 227 422, e a comparação é só de dígitos) ou todas as palavras do nome.
6. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
7. Monta o link do visualizador: /edicao-do-dia?dados= seguido do JSON {dataPublicacaoSelecionada, idCadernoEdicaoSelecionado, paginaSelecionada, textoPesquisa} codificado na URL. O link abre a página certa com o termo marcado.
8. Passa todos os trechos para a correlação. O contexto lido é o próprio textoResultado, porque a API não devolve mais texto. Os diretos viram a evidência, com até 8 linhas.

### Particularidades da correlação

- Como o trecho tem só uns 200 caracteres, muitos registros chegam sem local nem objeto e saem como incerta. É uma escolha conservadora: o trecho que não diz onde nem o quê não prova o projeto.
- Para ler mais contexto, o caminho é baixar a página em PDF que a API devolve em base64 e recortar em volta do termo. Ainda não está ligado.

### Limitações

- Empresa com muitas filiais em MG traz atos de outras plantas; o município no trecho separa a unidade da ficha. Várias palavras na busca viram frase exata.
- Empresa com várias plantas traz atos de outras unidades, o texto vem sem acento e a primeira página traz até 40 trechos por termo.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-MG/busca-cnpj-gerdau.json`
- `amostras/CAPTURA-DOE-MG/LEIA.txt`

## MS — Mato Grosso do Sul

**Diário Oficial do Estado de Mato Grosso do Sul** · código `CAPTURA-DOE-MS`

- **Situação:** conectado. API ou página de busca própria.
- **Órgão:** Imprensa Oficial de Mato Grosso do Sul
- **Portal:** <https://www.diariooficial.ms.gov.br/>
- **Busca usada na coleta:** `https://www.diariooficial.ms.gov.br/api/diarios/busca-diarios`
- **Acervo:** Texto pesquisável desde janeiro de 2007.
- **O que se acha:** licença e autuação do IMASUL, incentivo fiscal e contrato do estado.

### Como o portal funciona e como o dado aparece

- O portal novo expõe uma API em /api/diarios/busca-diarios. Cada item é uma página de uma edição (ou suplemento), com o caminho do PDF da edição inteira e os trechos em volta do termo.
- O envelope traz paginaAtual, totalDePaginas, totalDeRegistros e paginasDiario. Busca sem resultado volta HTTP 400 com o corpo "Nenhum resultado encontrado.".
- hiHighlight.texto é uma lista com um trecho por ocorrência na página, de 110 a 145 caracteres, quase todo antes do termo, com o termo em <mark>.
- Exemplo do teste ao vivo (Suzano, 27/10/2026): "… MEIO AMBIENTE DE MATO GROSSO DO SUL, CNPJ nº 02.386.443/0001-98 e a empresa SUZANO S.A., C…". A raiz 16.404.287 achou 163 páginas desde 2015.

### Campos do dado

O portal novo expõe uma API em /api/diarios/busca-diarios. Cada item é uma página de uma edição (ou suplemento), com o caminho do PDF da edição inteira e os trechos em volta do termo. Exemplo bruto em amostras/CAPTURA-DOE-MS/

**Campos de cada página (8)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `numero` | inteiro | Número do diário. A ficha não copia. |
| `descricao` | texto | Nome da edição, como Suplemento I DOE n. 12291 - Imasul. Vira titulo. |
| `pagina` | inteiro | Página da edição. Vira pagina e entra no link. |
| `caminhoArquivo` | endereço URL | PDF da edição inteira, público. O link da ficha é ele com #page={pagina}. |
| `nomeArquivo` | texto | Nome do PDF. Com a página, forma a chave. |
| `dataPublicacao` | data e hora local | AAAA-MM-DDT07:30:00. Vira data. |
| `hiHighlight.texto` | lista de texto com HTML | Um trecho por ocorrência, termo em <mark>. Os trechos são juntados com … e viram texto. |
| `ocorrenciasPorPagina` | inteiro | Quantas vezes o termo aparece na página. A ficha não copia. |

### Chamadas feitas pelo Radar

`GET https://www.diariooficial.ms.gov.br/api/diarios/busca-diarios`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `texto` | `16.404.287 ou suzano` | Uma chamada para a raiz do CNPJ com máscara (XX.XXX.XXX) e outra para o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). Aspas quebram a busca; o CNPJ só é achado com pontos. |
| `tipo` | `1` | Frase. 2 seria ao menos uma palavra. |
| `dataInicial / dataFinal` | `2015-01-01 / hoje` | Período. |
| `pagina / registrosPorPagina` | `1 / 100` | Uma página de até 100 itens por termo. |

Sem token. O cookie de balanceamento é dispensável. HTTP 400 com "Nenhum resultado" conta como zero.

### Passo a passo da extração

1. Faz uma busca por termo com até 100 páginas de diário.
2. Trata HTTP 400 como busca vazia.
3. Para cada item: junta os trechos de hiHighlight.texto com … e tira o HTML; descricao vira titulo; dataPublicacao, data; pagina, pagina.
4. Monta o link: caminhoArquivo#page={pagina}. A chave é nomeArquivo:pagina.
5. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
6. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
7. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
8. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Limitações

- O trecho é curto e quase todo antes do termo; a API não traz o texto da página. Muitas vezes o objeto do ato fica de fora e a correlação marca incerta. O link é o PDF da edição inteira com a página no fragmento #page=.
- O trecho é curto e quase todo antes do termo; a API não traz o texto da página. Muitas vezes o objeto do ato fica de fora e a correlação marca incerta. O link é o PDF da edição inteira com a página no fragmento #page=.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-MS/busca-cnpj-suzano.json`
- `amostras/CAPTURA-DOE-MS/LEIA.txt`

## MT — Mato Grosso

**Diário Oficial do Estado de Mato Grosso (IOMAT)** · código `CAPTURA-DOE-MT`

- **Situação:** conectado. API de busca (motor IONEWS).
- **Órgão:** Imprensa Oficial de Mato Grosso (IOMAT)
- **Portal:** <https://www.iomat.mt.gov.br/>
- **Busca usada na coleta:** `https://www.iomat.mt.gov.br/busca/busca/buscar/query`
- **Acervo:** Acervo desde 1967; a busca da ficha começa em 2015.
- **O que se acha:** licença da SEMA-MT, incentivo do PRODEIC e contrato do estado.

### Como o portal funciona e como o dado aparece

- O Diário Oficial do Estado de Mato Grosso (IOMAT) não publica uma API documentada. A busca do portal chama um Elasticsearch, e o Radar lê a mesma resposta JSON que a página usa.
- O envelope é o padrão do Elasticsearch: took, timed_out, _shards e hits. Em hits vêm total (quantas páginas do diário têm o termo), max_score e a lista hits.hits.
- Cada item de hits.hits é uma página inteira de uma edição, não um ato. _id junta edição e página (21987_41 é a página 41 da edição 21987). _source.conteudo traz o texto corrido da página toda, já sem quebras, com todos os atos daquela página misturados. _source traz também data (AAAA-MM-DD), pagina, paginas, diario_id, pdf_id, year, month, day e tipo_edicao.
- highlight.conteudo é uma lista de frases da página em HTML, com o termo buscado em <strong>. É a parte que interessa: mostra onde o CNPJ ou o nome aparece.
- Exemplo do teste ao vivo (Petrobras, 25/09/2018): "Processo 248435/2015 Responsável Técnico Interessado Petróleo Brasileiro CNPJ ou CPF 33.00…". A raiz achou 32 páginas desde 2015.
- O CNPJ aparece no texto com pontos (50.351.104/0001-10), com espaços ou sem separador, conforme o órgão que publicou. Por isso a busca usa a raiz com máscara e o filtro compara só os dígitos.

### Campos do dado

JSON do Elasticsearch atrás da busca do Diário Oficial do Estado de Mato Grosso (IOMAT), o mesmo motor do DOE-BA. Cada resultado é uma página do diário, com o texto inteiro e o destaque do termo. Exemplo bruto em amostras/CAPTURA-DOE-MT/

**Campos de cada resultado em hits.hits**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `_id` | texto | Diário e página, como 21987_41. Usado para tirar repetidos entre buscas; a ficha não copia. |
| `_score` | número | Relevância da busca. A ficha não copia; ordena por município, tipo de ato e data. |
| `_source.conteudo` | texto | Texto inteiro da página. A ficha só usa quando falta o destaque. |
| `_source.data` | data AAAA-MM-DD | Dia da edição. Vira data. |
| `_source.pagina` | texto numérico | Página da edição. Vira pagina e entra no link. |
| `_source.paginas` | texto numérico | Total de páginas da edição. A ficha não copia. |
| `_source.diario_id` | texto numérico | Identificador da edição. Entra no link. |
| `_source.pdf_id` | texto numérico | Identificador do PDF da edição. A ficha não copia. |
| `_source.year` | texto | Ano da edição. A ficha não copia. |
| `_source.month` | texto | Mês da edição. A ficha não copia. |
| `_source.day` | texto | Dia da edição. A ficha não copia. |
| `_source.tipo_edicao` | texto numérico | 1 para edição regular. A ficha não copia. |
| `highlight.conteudo` | lista de HTML | Frases da página com o termo em strong. A ficha limpa o HTML e junta até 400 caracteres em trecho. |

### Chamadas feitas pelo Radar

`GET https://www.iomat.mt.gov.br/busca/busca/buscar/query/{pagina}/di:2015-01-01/df:{hoje}/?1=1&q="{termo}"`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `{pagina}` | `0, depois 1` | 10 resultados por página. A página 1 só é pedida se a 0 vier cheia. |
| `di / df` | `2015-01-01 / hoje` | Período no caminho da URL. |
| `q` | `"33.000.167" ou "petroleo brasileiro petrobras"` | Termo entre aspas, para buscar a frase. Uma chamada para a raiz do CNPJ com máscara (XX.XXX.XXX) e outra para o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). |

Sem token nem login. TLS válido com as raízes padrão do Node.

### Passo a passo da extração

1. Monta os termos: a raiz do CNPJ com máscara (XX.XXX.XXX) e o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI), quando tem pelo menos quatro letras. Cada termo vai entre aspas, para buscar a frase.
2. Para cada termo, chama a busca na página 0. Se vierem 10 resultados, chama também a página 1. São no máximo 20 páginas do diário por termo, 40 no total.
3. Para cada resultado, junta as frases de highlight.conteudo com " … " e tira o HTML. Sem destaque, usa _source.conteudo.
4. Recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Em lista corrida, o que vem antes do termo é outro registro, então o recorte começa só 1/5 da janela antes.
5. Guarda também um contexto de 1.200 caracteres em volta do termo. Ele não vai para a ficha; serve só para a correlação ler o ato inteiro.
6. Descarta a página que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (com três letras ou mais), comparadas sem acento.
7. Tira repetidos pelo _id, porque a mesma página volta na busca pelo CNPJ e na busca pelo nome.
8. Classifica o ato pelo trecho: ato_relevante (licença, alvará, decreto, incentivo, outorga, TAC, implantação, ampliação…), compra_publica (licitação, pregão, registro de preço, homologação, dispensa) ou outro.
9. Marca no_municipio quando o trecho cita o município da ficha e ordena: município primeiro, depois ato relevante, outro e compra pública, e por fim a data mais recente.
10. Monta o link: https://www.iomat.mt.gov.br/portal/edicoes/download/{diario_id}/{pagina}, o PDF só daquela página, público.
11. Passa todos os atos para a correlação. Os diretos viram a evidência, com até 8 linhas: data, pagina, trecho, url, tipo_ato, no_municipio e o motivo da correlação.

### Particularidades da correlação

- O destaque marca o CNPJ em pedaços (<strong>33</strong>.<strong>000</strong>.<strong>167</strong>). Sem o HTML, o número volta inteiro e o filtro por dígitos funciona.

### Limitações

- Cada resultado é uma página inteira, com atos de órgãos diferentes. O contexto em volta do termo é que diz qual ato é da empresa. Sem aspas, os termos viram OU; o conector sempre manda aspas. Mesmo com aspas a frase tolera inversão de palavras, então o filtro de citação continua necessário.
- Cada resultado é uma página inteira, com atos de órgãos diferentes. O contexto em volta do termo é que diz qual ato é da empresa. Sem aspas, os termos viram OU; o conector sempre manda aspas. Mesmo com aspas a frase tolera inversão de palavras, então o filtro de citação continua necessário.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-MT/busca-cnpj-petrobras.json`
- `amostras/CAPTURA-DOE-MT/LEIA.txt`

## PA — Pará

**Diário Oficial do Estado do Pará (IOEPA)** · código `CAPTURA-DOE-PA`

- **Situação:** conectado. Índice de PDFs do Radar.
- **Órgão:** Imprensa Oficial do Estado do Pará (IOEPA)
- **Portal:** <https://www.ioepa.com.br/portal/>
- **Listagem de edições lida pelo sincronizador:** `https://www.ioepa.com.br/Frame/?dts={DD/MM/AAAA}`
- **Acervo:** Edições em PDF consultáveis por data desde pelo menos 2019 no /Frame; o índice do Radar cobre o período carregado.
- **O que se acha:** licença e autorização da SEMAS, incentivo da SEDEME e contrato do estado.

### Como o portal funciona e como o dado aparece

- O IOEPA não tem busca que funcione: /pesquisa/resultado/QueryTexto (que redireciona para /pesquisa/?q=…&di=…&df=…) responde HTTP 500 em toda consulta, testado em 27 e 28/10/2026.
- A página /Frame/?dts=DD/MM/AAAA mostra as edições do dia: para cada uma, um link do Google Drive (uc?id={id}&export=download) e a capa pages/AAAA/AAAA.MM.DD.{DOE|EXTRA}.jpg. Sem edição no dia, mostra a anterior; o campo datepicker diz qual data saiu.
- O PDF vem direto do Google Drive (3,7 MB e 124 páginas em 23/10/2026), assinado digitalmente e com camada de texto. O texto sai com versalete partido ("g ov ERNAD o R", "c NP j"), mas os dígitos do CNPJ ficam inteiros.
- Exemplo real (27/10/2026, página 63): avisos de licença recebida da SEMAS ("…torna público que recebeu da SEMAS a AU nº 5911/2025… MAGAZINE TORRA TORRA LTDA, CNPJ 22.685.030/0088-72…"), com 14 CNPJs na mesma página.
- O Radar não depende de busca do portal: baixa cada edição, extrai o texto de todas as páginas com pdfjs e grava em doe_pdf_edicao e doe_pdf_pagina. Cada página guarda o texto, uma versão compacta e as raízes de CNPJ citadas.

### Campos do dado

O IOEPA não tem busca que funcione: /pesquisa/resultado/QueryTexto (que redireciona para /pesquisa/?q=…&di=…&df=…) responde HTTP 500 em toda consulta, testado em 27 e 28/10/2026. Exemplo bruto em amostras/CAPTURA-DOE-PA/

**Campos de cada página (12)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `datepicker (value)` | data DD/MM/AAAA | Data que o Frame mostrou. A edição só vale se for igual à pedida. |
| `link do Google Drive (a href)` | endereço URL | Link de download do PDF. O id vira a chave e o link vira url. |
| `capa (img src)` | endereço URL | pages/AAAA/AAAA.MM.DD.{tipo}.jpg. O tipo (DOE ou EXTRA) vira titulo. |
| `doe_pdf_edicao.chave` | texto | Identificador da edição no portal (id do arquivo ou caminho do PDF). Com a UF, impede ler a mesma edição duas vezes. |
| `doe_pdf_edicao.data` | data AAAA-MM-DD | Dia da edição, tirado da listagem. Vira data. |
| `doe_pdf_edicao.titulo` | texto | Diário Oficial, suplemento ou extra. Vira titulo. |
| `doe_pdf_edicao.url` | endereço URL | Link público da edição. Com #page={pagina}, vira o link da ficha. |
| `doe_pdf_edicao.paginas / bytes / status / erro` | inteiro / texto | Páginas com texto, tamanho do PDF e resultado da leitura (ok, sem_texto ou erro). A ficha não copia. |
| `doe_pdf_pagina.pagina` | inteiro | Número da página no PDF. Vira pagina. |
| `doe_pdf_pagina.texto` | texto | Texto integral da página, extraído com pdfjs, com quebras de linha. É dele que saem o trecho e o contexto. |
| `doe_pdf_pagina.compacto` | texto | O mesmo texto sem acento, minúsculo e só com letras e dígitos. Casa o nome que o PDF partiu em pedaços. A ficha não copia. |
| `doe_pdf_pagina.raizes` | lista de texto | Raízes de CNPJ (8 dígitos) achadas na página, com ou sem máscara. É a chave da busca por CNPJ. |

### Chamadas feitas pelo Radar

`GET https://www.ioepa.com.br/Frame/?dts={DD/MM/AAAA}`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `dts` | `23/10/2026` | Um dia por chamada; o sincronizador pede quatro dias em paralelo. |

Sem token. Cloudflare na frente; cada chamada leva de 5 a 8 s.

`GET https://drive.google.com/uc?id={id}&export=download`

Download direto do PDF, sem página de confirmação (arquivos de poucos MB).

`SQL doe_pdf_pagina join doe_pdf_edicao (banco do Radar)`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `uf` | `PA` | Só o diário da UF da ficha. |
| `raizes @> array[raiz]` | `33000167` | Raiz do CNPJ, só dígitos. |
| `strpos(compacto, nome)` | `petroleobrasileiro` | Nome colado, sem acento nem espaço. |
| `order by / limit` | `data desc, pagina / 400` | Mais recentes primeiro. |

Consulta feita na hora da ficha. O portal só é chamado pelo sincronizador.

### Passo a passo da extração

1. Para cada dia do período, chama o Frame e fica com as edições se o datepicker for a data pedida (sem isso, o Frame devolve a edição anterior).
2. De cada link do Drive tira o id (chave) e da capa o tipo (Diário Oficial ou extra).
3. Baixa o PDF, confere que começa com %PDF e extrai o texto de cada página (até 2.000). Página sem texto é descartada; edição sem nenhuma página com texto fica com status sem_texto.
4. Grava a edição e as páginas numa transação. Edição já lida não é baixada de novo; a que falhou fica com status erro e volta na rodada seguinte. Cada rodada registra uma linha em base_carga.
5. Na ficha, consulta o índice da UF: páginas cujas raizes contêm a raiz do CNPJ ou cujo compacto contém o nome colado (as até três primeiras palavras da razão social, sem espaço). Lê até 400 candidatas, da mais recente para a mais antiga.
6. Fica com as páginas da raiz e, das achadas pelo nome, só as que têm o nome colado; nome de uma palavra só precisa aparecer como palavra inteira ("vale" não casa com "valor"). Guarda as 40 primeiras.
7. Acha a posição do termo no texto original (mapeando o compacto de volta) e recorta 400 caracteres de trecho e 1.600 de contexto a partir dali. O link é o da edição com #page={pagina}.
8. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
9. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
10. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
11. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Limitações

- O alcance é o do índice: o agendador lê os últimos 7 dias todo dia, e o histórico depende da carga inicial (npm run doe:pdf-sync -- --dias N). Edição fora desse período não é achada. Cada resultado é uma página inteira, com atos de órgãos diferentes. O contexto em volta do termo é que diz qual ato é da empresa. A busca do portal está fora do ar; se voltar, um conector direto alcançaria o acervo antigo sem índice. Versalete partido: o nome da empresa só casa no texto compacto; o trecho exibido pode ter palavras quebradas.
- O alcance é o do índice: o agendador lê os últimos 7 dias todo dia, e o histórico depende da carga inicial (npm run doe:pdf-sync -- --dias N). Edição fora desse período não é achada. Cada resultado é uma página inteira, com atos de órgãos diferentes. O contexto em volta do termo é que diz qual ato é da empresa. A busca do portal está fora do ar; se voltar, um conector direto alcançaria o acervo antigo sem índice. Versalete partido: o nome da empresa só casa no texto compacto; o trecho exibido pode ter palavras quebradas.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-PA/1-edicoes-23-10-2026.html`
- `amostras/CAPTURA-DOE-PA/2-pagina-indexada.json`
- `amostras/CAPTURA-DOE-PA/LEIA.txt`

## PB — Paraíba

**Diário Oficial do Estado da Paraíba (A União)** · código `CAPTURA-DOE-PB`

- **Situação:** conectado. Índice de PDFs do Radar.
- **Órgão:** Empresa Paraibana de Comunicação (EPC), jornal A União
- **Portal:** <https://auniao.pb.gov.br/servicos/doe>
- **Listagem de edições lida pelo sincronizador:** `https://auniao.pb.gov.br/servicos/doe/{pasta do ano}/{mês}`
- **Acervo:** Pastas por ano desde 2007 (2020 não aparece); o índice do Radar cobre o período carregado.
- **O que se acha:** licença da SUDEMA, incentivo do FAIN e contrato do estado.

### Como o portal funciona e como o dado aparece

- O portal Plone guarda os PDFs em pastas /servicos/doe/{ano}/{mês}; o texto deles não é indexado (busca por "petrobras" dá zero). doe.pb.gov.br é o sistema de envio de matérias, com login.
- A pasta do ano nem sempre é o ano (2025 está em 2025-1). Cada mês lista links .../diario-oficial-DD-MM-AAAA-{portal|suplemento-portal|assinantes}.pdf/view, em lotes de 20 (?b_start:int=20).
- O PDF sai trocando /view por /@@download/file (1,3 MB e 36 páginas em 20/10/2026), com camada de texto.
- Exemplo real (28/10/2026, página 28): "…CEHAP-CNPJ/CPF Nº 09.111.618/0001-01, torna público que requereu a SUDEMA – Superintendência de Administração do Meio Ambiente, a LICENÇA DE INSTALAÇÃO… para a construção do conjunto habitacional…". A mesma edição lista RLO e RLI da SUDEMA com o nome das empresas.
- O Radar não depende de busca do portal: baixa cada edição, extrai o texto de todas as páginas com pdfjs e grava em doe_pdf_edicao e doe_pdf_pagina. Cada página guarda o texto, uma versão compacta e as raízes de CNPJ citadas.

### Campos do dado

O portal Plone guarda os PDFs em pastas /servicos/doe/{ano}/{mês}; o texto deles não é indexado (busca por "petrobras" dá zero). doe.pb.gov.br é o sistema de envio de matérias, com login. Exemplo bruto em amostras/CAPTURA-DOE-PB/

**Campos de cada página (12)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `pasta do ano (a href)` | endereço URL | Nome real da pasta de cada ano (2025-1, 2026…). Lido uma vez por rodada. |
| `página da edição (a href .pdf/view)` | endereço URL | Página da edição. O nome do arquivo vira a chave; DD-MM-AAAA do nome vira data; "suplemento" no nome marca o titulo. |
| `listingBar` | HTML | Paginação da pasta, em lotes de 20. |
| `doe_pdf_edicao.chave` | texto | Identificador da edição no portal (id do arquivo ou caminho do PDF). Com a UF, impede ler a mesma edição duas vezes. |
| `doe_pdf_edicao.data` | data AAAA-MM-DD | Dia da edição, tirado da listagem. Vira data. |
| `doe_pdf_edicao.titulo` | texto | Diário Oficial, suplemento ou extra. Vira titulo. |
| `doe_pdf_edicao.url` | endereço URL | Link público da edição. Com #page={pagina}, vira o link da ficha. |
| `doe_pdf_edicao.paginas / bytes / status / erro` | inteiro / texto | Páginas com texto, tamanho do PDF e resultado da leitura (ok, sem_texto ou erro). A ficha não copia. |
| `doe_pdf_pagina.pagina` | inteiro | Número da página no PDF. Vira pagina. |
| `doe_pdf_pagina.texto` | texto | Texto integral da página, extraído com pdfjs, com quebras de linha. É dele que saem o trecho e o contexto. |
| `doe_pdf_pagina.compacto` | texto | O mesmo texto sem acento, minúsculo e só com letras e dígitos. Casa o nome que o PDF partiu em pedaços. A ficha não copia. |
| `doe_pdf_pagina.raizes` | lista de texto | Raízes de CNPJ (8 dígitos) achadas na página, com ou sem máscara. É a chave da busca por CNPJ. |

### Chamadas feitas pelo Radar

`GET https://auniao.pb.gov.br/servicos/doe`

Lista as pastas dos anos.

`GET https://auniao.pb.gov.br/servicos/doe/{pasta}/{mês}`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `{mês}` | `janeiro … dezembro (marco sem cedilha)` | Um mês por chamada. |
| `b_start:int` | `0, 20, 40` | Lote seguinte enquanto vierem 20 links novos. |

Sem token. Cerca de 1 s por chamada.

`GET https://auniao.pb.gov.br/servicos/doe/{pasta}/{mês}/{arquivo}.pdf/@@download/file`

PDF público.

`SQL doe_pdf_pagina join doe_pdf_edicao (banco do Radar)`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `uf` | `PB` | Só o diário da UF da ficha. |
| `raizes @> array[raiz]` | `33000167` | Raiz do CNPJ, só dígitos. |
| `strpos(compacto, nome)` | `petroleobrasileiro` | Nome colado, sem acento nem espaço. |
| `order by / limit` | `data desc, pagina / 400` | Mais recentes primeiro. |

Consulta feita na hora da ficha. O portal só é chamado pelo sincronizador.

### Passo a passo da extração

1. Lê as pastas dos anos e, para cada mês do período, a listagem da pasta, lote a lote.
2. De cada link .pdf/view tira o nome do arquivo (chave), a data DD-MM-AAAA e se é suplemento; o download é o mesmo endereço com /@@download/file.
3. Baixa o PDF, confere que começa com %PDF e extrai o texto de cada página (até 2.000). Página sem texto é descartada; edição sem nenhuma página com texto fica com status sem_texto.
4. Grava a edição e as páginas numa transação. Edição já lida não é baixada de novo; a que falhou fica com status erro e volta na rodada seguinte. Cada rodada registra uma linha em base_carga.
5. Na ficha, consulta o índice da UF: páginas cujas raizes contêm a raiz do CNPJ ou cujo compacto contém o nome colado (as até três primeiras palavras da razão social, sem espaço). Lê até 400 candidatas, da mais recente para a mais antiga.
6. Fica com as páginas da raiz e, das achadas pelo nome, só as que têm o nome colado; nome de uma palavra só precisa aparecer como palavra inteira ("vale" não casa com "valor"). Guarda as 40 primeiras.
7. Acha a posição do termo no texto original (mapeando o compacto de volta) e recorta 400 caracteres de trecho e 1.600 de contexto a partir dali. O link é o da edição com #page={pagina}.
8. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
9. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
10. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
11. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Limitações

- O alcance é o do índice: o agendador lê os últimos 7 dias todo dia, e o histórico depende da carga inicial (npm run doe:pdf-sync -- --dias N). Edição fora desse período não é achada. Cada resultado é uma página inteira, com atos de órgãos diferentes. O contexto em volta do termo é que diz qual ato é da empresa. Se a EPC mudar o padrão do nome do arquivo (sem DD-MM-AAAA), a edição não entra; o sincronizador não adivinha datas.
- O alcance é o do índice: o agendador lê os últimos 7 dias todo dia, e o histórico depende da carga inicial (npm run doe:pdf-sync -- --dias N). Edição fora desse período não é achada. Cada resultado é uma página inteira, com atos de órgãos diferentes. O contexto em volta do termo é que diz qual ato é da empresa. Se a EPC mudar o padrão do nome do arquivo (sem DD-MM-AAAA), a edição não entra; o sincronizador não adivinha datas.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-PB/1-listagem-outubro-2026.html`
- `amostras/CAPTURA-DOE-PB/2-pagina-indexada.json`
- `amostras/CAPTURA-DOE-PB/LEIA.txt`

## PE — Pernambuco

**Diário Oficial do Estado de Pernambuco (CEPE)** · código `CAPTURA-DOE-PE`

- **Situação:** conectado. API ou página de busca própria.
- **Órgão:** Companhia Editora de Pernambuco (CEPE)
- **Portal:** <https://diariooficial.cepe.com.br/diariooficialweb/>
- **Busca usada na coleta:** `https://diariooficial.cepe.com.br/diariooficial/public/search`
- **Acervo:** Texto pesquisável desde janeiro de 2019, só o Poder Executivo.
- **O que se acha:** licença da CPRH, incentivo do PRODEPE e contrato do estado.

### Como o portal funciona e como o dado aparece

- A busca do portal AngularJS chama /diariooficial/public/search por POST com JSON. Cada item é uma matéria com código, órgão, data, um resumo (o começo do ato, até ~400 caracteres) e os fragmentos com o termo.
- O envelope traz list, rowCount (total), pageSize, map, notEmpty e empty. A ordem não é por data.
- texto junta os fragmentos com o termo em <span class="highlight">, separados por linha em branco, de 85 a ~850 caracteres. O texto integral está em /public/buscarMateria, que o conector não chama.
- Exemplo real (Petrobras, 25/10/2025): pauta de julgamento do Tribunal Administrativo Tributário, "CNPJ Nº 33.000.167/1111-08. Adv(s)…". É processo fiscal, não obra; a correlação descarta.

### Campos do dado

A busca do portal AngularJS chama /diariooficial/public/search por POST com JSON. Cada item é uma matéria com código, órgão, data, um resumo (o começo do ato, até ~400 caracteres) e os fragmentos com o termo. Exemplo bruto em amostras/CAPTURA-DOE-PE/

**Campos de cada matéria (6)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `codigo` | inteiro | Identificador da matéria. Vira a chave e, em base64, entra no link. |
| `texto` | texto com HTML | Fragmentos com o termo em <span class="highlight">. Junto com o resumo, vira texto. |
| `resumo` | texto | Começo do ato, até ~400 caracteres, terminando em …. Os primeiros 140 caracteres viram titulo. |
| `nomeCategoria` | texto | Órgão, como Secretarias de Estado > Fazenda. Vira orgao. |
| `dataPublicacao` | data AAAA-MM-DD | Dia da publicação. Vira data. |
| `rowCount` | inteiro | Total de matérias da busca, no envelope. A ficha conta as que citam a empresa. |

### Chamadas feitas pelo Radar

`POST https://diariooficial.cepe.com.br/diariooficial/public/search`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `palavras` | `33.000.167 ou petroleo brasileiro petrobras` | Uma chamada para a raiz do CNPJ com máscara (XX.XXX.XXX) e outra para o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). A busca já é por frase; não há OU. |
| `intervaloAno` | `01/01/2015-{hoje DD/MM/AAAA}` | É o campo que filtra o período. |
| `dataInicial / dataFinal` | `01/01/2015 / hoje` | Enviados como o portal envia. |
| `codigoDiario` | `1` | Poder Executivo. |
| `first / maxResults` | `0 / 200` | Deslocamento e tamanho; 500 também é aceito. |

Corpo JSON. Exige o cabeçalho Referer: https://diariooficial.cepe.com.br/diariooficialweb/; sem ele volta HTTP 403 referer_mismatch.

### Passo a passo da extração

1. Faz uma busca por termo com até 200 matérias.
2. Para cada matéria: texto = resumo … fragmentos, sem HTML; nomeCategoria vira orgao; dataPublicacao, data; o começo do resumo, titulo.
3. Monta o link: /diariooficialweb/#/visualizar-publicacao?publicacao={base64 do codigo}.
4. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
5. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
6. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
7. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Limitações

- Acervo só desde 2019 e só o caderno do Executivo. A resposta não traz página. O link é uma rota do portal (SPA).
- Acervo só desde 2019 e só o caderno do Executivo. A resposta não traz página. O link é uma rota do portal (SPA).
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-PE/busca-cnpj-petrobras.json`
- `amostras/CAPTURA-DOE-PE/LEIA.txt`

## PI — Piauí

**Diário Oficial do Estado do Piauí** · código `CAPTURA-DOE-PI`

- **Situação:** conectado. API ou página de busca própria.
- **Órgão:** Diário Oficial do Estado do Piauí
- **Portal:** <https://www.diario.pi.gov.br/doe/>
- **Busca usada na coleta:** `https://www.diario.pi.gov.br/doe/Api/buscaavancada.json`
- **Acervo:** Notas do sistema novo, de 2022 em diante.
- **O que se acha:** licença da SEMARH, aviso de investimento da INVESTEPIAUI e contrato do estado.

### Como o portal funciona e como o dado aparece

- A busca avançada (POST buscaavancada.json) só tem o campo de palavras-chave e devolve todas as notas de uma vez, sem data nem paginação, em 25 a 50 s.
- Cada item traz dadosDiario ("236 de 12/12/2023, em <i>\"AVISOS\"</i>": edição, data e seção), nota (UUID do ato), anexodiario (PDF da edição) e acertos (palavras do termo achadas).
- As palavras se combinam com OU, e o termo é quebrado também em pontos e hífens. Por isso o CNPJ não serve (33.592.510 vira 33, 592 e 510) e o conector busca só pelo nome.
- O texto do ato vem de visualizarnota.json, em HTML com entidades. A resposta da nota traz também nome e CPF de quem publicou; o conector descarta esses campos.
- Exemplo do teste ao vivo (Petrobras, 17/03/2023): "LICENÇA OPERACIONAL POSTO PETROBRAS, Razão Social: PEDRO NERES DE BRITO torna público que…". É um posto com a bandeira, não a empresa; a correlação descarta.

### Campos do dado

A busca avançada (POST buscaavancada.json) só tem o campo de palavras-chave e devolve todas as notas de uma vez, sem data nem paginação, em 25 a 50 s. Exemplo bruto em amostras/CAPTURA-DOE-PI/

**Campos de cada matéria (10)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `dadosDiario` | texto com HTML | NUM de DD/MM/AAAA, em <i>"SECAO"</i>. Vira data e a seção de reserva para titulo. |
| `nota` | texto UUID | Identificador do ato. Vira a chave e é enviado a visualizarnota.json. |
| `anexodiario` | caminho | {uuid}/{arquivo}.pdf do PDF da edição. Vira url em /doe/files/diarios/anexo/. |
| `acertos` | texto | Palavras do termo achadas, separadas por vírgula. A nota só fica se tiver todas as palavras do nome. |
| `palavraschave` | lista de texto | O termo quebrado em palavras, no envelope. A ficha não copia. |
| `nota.dia` | data AAAA-MM-DD | Dia da nota, em visualizarnota.json. Vira data. |
| `nota.titulo_nota.texto` | texto | Seção, como AVISOS. Vira titulo. |
| `nota.orgao / nota.unidade` | objeto ou nulo | Órgão da nota. O nome vira orgao quando existe. |
| `nota.texto` | HTML | Texto integral do ato, com entidades. Decodificado, vira texto. |
| `nota.aprovado / diarios[].cpf / diarios[].responsavel` | texto | CPF e nome de quem publicou. Descartados. |

### Chamadas feitas pelo Radar

`POST https://www.diario.pi.gov.br/doe/Api/buscaavancada.json`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `filter_texto` | `petroleo brasileiro petrobras` | Só o nome da empresa; o CNPJ não funciona nesta busca. |

Corpo application/x-www-form-urlencoded. Exige X-Requested-With: XMLHttpRequest; sem ele a resposta é null. Timeout de 90 s.

`POST https://www.diario.pi.gov.br/doe/Api/visualizarnota.json`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `uuid` | `{nota}` | Uma chamada por nota lida. |

Mesmo cabeçalho X-Requested-With.

### Passo a passo da extração

1. Busca o nome e fica com as notas cujo acertos tem todas as palavras do nome.
2. Lê edição, data e seção de dadosDiario e ordena da mais recente para a mais antiga.
3. Para as 10 primeiras, chama visualizarnota.json e guarda dia, seção, órgão e o texto decodificado. CPF e nome do responsável são descartados.
4. Monta o link do PDF da edição com anexodiario.
5. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
6. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
7. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
8. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Limitações

- Só nome: empresas com nome comum trazem muito ruído, e a busca por CNPJ não existe. Acervo só a partir de 2022. Cada busca leva de 25 a 50 s, e cada nota lida, mais uma chamada. O link é o PDF da edição inteira, sem página.
- Só nome: empresas com nome comum trazem muito ruído, e a busca por CNPJ não existe. Acervo só a partir de 2022. Cada busca leva de 25 a 50 s, e cada nota lida, mais uma chamada. O link é o PDF da edição inteira, sem página.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-PI/busca-nome-petrobras.json`
- `amostras/CAPTURA-DOE-PI/LEIA.txt`
- `amostras/CAPTURA-DOE-PI/nota-145dd154.json`

## PR — Paraná

**Diário Oficial do Estado do Paraná** · código `CAPTURA-DOE-PR`

- **Situação:** conectado. API de busca (motor IONEWS).
- **Órgão:** Departamento de Imprensa Oficial do Estado do Paraná (DIOE)
- **Portal:** <https://www.dioe.pr.gov.br/>
- **Busca usada na coleta:** `https://www.dioe.pr.gov.br/busca/busca/buscar/query`

### Como o portal funciona e como o dado aparece

- O Diário Oficial do Paraná (DIOE) não publica uma API documentada. A busca do portal chama um Elasticsearch, e o Radar lê a mesma resposta JSON que a página usa.
- O envelope é o padrão do Elasticsearch: took, timed_out, _shards e hits. Em hits vêm total (quantas páginas do diário têm o termo), max_score e a lista hits.hits.
- Cada item de hits.hits é uma página inteira de uma edição, não um ato. _id junta edição e página (21987_41 é a página 41 da edição 21987). _source.conteudo traz o texto corrido da página toda, já sem quebras, com todos os atos daquela página misturados. _source traz também data (AAAA-MM-DD), pagina, paginas, diario_id, pdf_id, year, month, day e tipo_edicao.
- highlight.conteudo é uma lista de frases da página em HTML, com o termo buscado em <strong>. É a parte que interessa: mostra onde o CNPJ ou o nome aparece.
- Exemplo real (CMPC Iguaçu Embalagens, raiz 11.308.600): 14 páginas do diário citam a raiz. As três da amostra são portarias de outorga de água do Instituto Água e Terra, no modelo "Outorgado(s) {empresa} CPF/CNPJ {cnpj}. {corpo d'água}. Coordenadas UTM… Validade… Finalidade… Vazão máxima… Município {município}".
- O CNPJ aparece no texto com pontos (50.351.104/0001-10), com espaços ou sem separador, conforme o órgão que publicou. Por isso a busca usa a raiz com máscara e o filtro compara só os dígitos.

### Campos do dado

JSON do Elasticsearch atrás da busca do DIOE-PR, o mesmo motor do DOE-BA. Cada resultado é uma página do diário, com o texto inteiro e o destaque do termo. Exemplo bruto em amostras/CAPTURA-DOE-PR/

**Campos de cada resultado em hits.hits**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `_id` | texto | Diário e página, como 21987_41. Usado para tirar repetidos entre buscas; a ficha não copia. |
| `_score` | número | Relevância da busca. A ficha não copia; ordena por município, tipo de ato e data. |
| `_source.conteudo` | texto | Texto inteiro da página. A ficha só usa quando falta o destaque. |
| `_source.data` | data AAAA-MM-DD | Dia da edição. Vira data. |
| `_source.pagina` | texto numérico | Página da edição. Vira pagina e entra no link. |
| `_source.paginas` | texto numérico | Total de páginas da edição. A ficha não copia. |
| `_source.diario_id` | texto numérico | Identificador da edição. Entra no link. |
| `_source.pdf_id` | texto numérico | Identificador do PDF da edição. A ficha não copia. |
| `_source.year` | texto | Ano da edição. A ficha não copia. |
| `_source.month` | texto | Mês da edição. A ficha não copia. |
| `_source.day` | texto | Dia da edição. A ficha não copia. |
| `_source.tipo_edicao` | texto numérico | 1 para edição regular. A ficha não copia. |
| `highlight.conteudo` | lista de HTML | Frases da página com o termo em strong. A ficha limpa o HTML e junta até 400 caracteres em trecho. |

### Chamadas feitas pelo Radar

`GET https://www.dioe.pr.gov.br/busca/busca/buscar/query/{pagina}/di:2015-01-01/df:{hoje}/?1=1&q="{termo}"`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `{pagina}` | `0, depois 1` | Página da busca, 10 resultados por página. |
| `di / df` | `2015-01-01 / hoje` | Período no caminho da URL. |
| `q` | `"11.308.600" ou "cmpc iguacu embalagens"` | Termo entre aspas. Uma busca para a raiz do CNPJ e outra para o nome. |

Mesmo motor do DOE-BA. Sem token. O PDF da página é público.

### Passo a passo da extração

1. Monta os termos: a raiz do CNPJ com máscara (XX.XXX.XXX) e o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI), quando tem pelo menos quatro letras. Cada termo vai entre aspas, para buscar a frase.
2. Para cada termo, chama a busca na página 0. Se vierem 10 resultados, chama também a página 1. São no máximo 20 páginas do diário por termo, 40 no total.
3. Para cada resultado, junta as frases de highlight.conteudo com " … " e tira o HTML. Sem destaque, usa _source.conteudo.
4. Recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Em lista corrida, o que vem antes do termo é outro registro, então o recorte começa só 1/5 da janela antes.
5. Guarda também um contexto de 1.200 caracteres em volta do termo. Ele não vai para a ficha; serve só para a correlação ler o ato inteiro.
6. Descarta a página que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (com três letras ou mais), comparadas sem acento.
7. Tira repetidos pelo _id, porque a mesma página volta na busca pelo CNPJ e na busca pelo nome.
8. Classifica o ato pelo trecho: ato_relevante (licença, alvará, decreto, incentivo, outorga, TAC, implantação, ampliação…), compra_publica (licitação, pregão, registro de preço, homologação, dispensa) ou outro.
9. Marca no_municipio quando o trecho cita o município da ficha e ordena: município primeiro, depois ato relevante, outro e compra pública, e por fim a data mais recente.
10. Monta o link: https://www.dioe.pr.gov.br/portal/edicoes/download/{diario_id}/{pagina}, que baixa o PDF só daquela página.
11. Passa todos os atos para a correlação. Os diretos viram a evidência, com até 8 linhas: data, pagina, trecho, url, tipo_ato, no_municipio e o motivo da correlação.

### Particularidades da correlação

- Portarias de outorga e súmulas de licença do Paraná escrevem o município, a finalidade e o CNPJ da filial no próprio texto. A correlação compara com Piraí do Sul e com a obra do projeto: a outorga de São José dos Pinhais é da fábrica de embalagens que já existe lá e sai como outro_projeto.
- O CNPJ da filial (os 6 dígitos depois da raiz) também ajuda: a busca é pela raiz, então traz todas as filiais.

### Limitações

- A filial pode ter CNPJ próprio com a mesma raiz e outro município; o trecho mostra qual unidade foi licenciada. O host antigo documentos.dioe.pr.gov.br não é usado.
- Página com vários atos traz ruído e filiais da mesma raiz aparecem com outro município; a leitura para em duas páginas de resultado por termo.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-PR/busca-cnpj-cmpc-iguacu.json`
- `amostras/CAPTURA-DOE-PR/LEIA.txt`

## RJ — Rio de Janeiro

**Diário Oficial do Estado do Rio de Janeiro** · código `CAPTURA-DOE-RJ`

- **Situação:** conectado. API ou página de busca própria.
- **Órgão:** Imprensa Oficial do Estado do Rio de Janeiro (IOERJ)
- **Portal:** <https://www.ioerj.com.br/>
- **Busca usada na coleta:** `https://www.ioerj.com.br/portal/modules/conteudoonline/busca_do.php?acao=busca`
- **Acervo:** Texto pesquisável desde 2006, em todas as partes do DO.
- **O que se acha:** licença e auditoria ambiental do INEA, incentivo fiscal e atos da Parte V (publicações a pedido).

### Como o portal funciona e como o dado aparece

- Não há API. A busca do módulo conteudoonline devolve HTML com a contagem ("<b>N</b> matérias encontradas") e uma tabela de três linhas por matéria.
- Linha 1: o link view_publicacao.php e o texto "DD/MM/AAAA página N - Matéria Id: N". Linha 2: "Jornal:" (parte do DO) e "Tipo:" (tipo do ato). Linha 3: td.style4 com um trecho de 140 a 190 caracteres e o termo em <em>.
- O link leva d, j, p e i em base64 (data, jornal, página, id) e uma assinatura s que só a busca devolve; com s inválido a resposta é "Token inválido".
- O HTML tem uma lista antiga dentro de um comentário <!-- -->, com links que dão 404. O parser ignora comentários.
- Exemplo real (Petrobras, 16/10/2026, página 1, Parte V): "PETRÓLEO BRASILEIRO S/A - PETROBRAS REFINARIA DUQUE DE CAXIAS - REDUC CNPJ: 33.000.167/ 0088-62 AUDITORIA AMBIENTAL…".

### Campos do dado

Não há API. A busca do módulo conteudoonline devolve HTML com a contagem ("<b>N</b> matérias encontradas") e uma tabela de três linhas por matéria. Exemplo bruto em amostras/CAPTURA-DOE-RJ/

**Campos de cada matéria (6)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `contagem` | texto HTML | <b>N</b> matérias encontradas. A ficha conta as que citam a empresa. |
| `a[href] view_publicacao.php` | caminho com parâmetros | d, j, p, i em base64, s (assinatura) e tb (termo). Vira url com o domínio. |
| `span.style2` | texto | DD/MM/AAAA página N - Matéria Id: N. Vira data, pagina e a chave. |
| `Jornal` | texto | Parte do DO, como Parte V (Publicações a Pedido). Vira caderno. |
| `Tipo` | texto | Tipo do ato, como V - Auditoria Ambiental. Vira titulo. |
| `td.style4 span` | texto com HTML | Trecho de 140 a 190 caracteres com o termo em <em>. Vira texto. |

### Chamadas feitas pelo Radar

`POST https://www.ioerj.com.br/portal/modules/conteudoonline/busca_do.php?acao=busca`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `textobusca` | `"33.000.167" ou "petroleo brasileiro petrobras"` | Uma chamada para a raiz do CNPJ com máscara (XX.XXX.XXX) e outra para o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). Várias palavras se combinam com E. |
| `busca[jornal]` | `vazio` | Todas as partes do DO. |
| `datapublicacao[dia/mes/ano]` | `vazios` | Sem filtro: a busca devolve as 100 mais recentes. |
| `tipobusca` | `texto` | Busca normal; textofonetico seria fonética. |
| `buscaordem` | `datapublicacao desc` | Mais recentes primeiro. |
| `buscar` | `Buscar` | Botão do formulário. |

Corpo application/x-www-form-urlencoded. Sem cookie nem sessão.

### Passo a passo da extração

1. Faz uma busca por termo, ordenada por data decrescente, que devolve até 100 matérias.
2. Lê cada link view_publicacao.php com cheerio e sobe para a linha da tabela: data, página e id em span.style2; parte e tipo na linha seguinte; trecho em td.style4 na terceira.
3. Descarta matérias anteriores a 2015.
4. Usa o href da busca como link, porque a assinatura s não pode ser montada.
5. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
6. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
7. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
8. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Limitações

- Teto de 100 matérias por consulta, sem paginação. Empresas com muitas publicações têm só as 100 mais recentes lidas. Trecho curto e sem texto integral. Não foi testado por quanto tempo a assinatura s do link continua valendo. Entram todas as partes do DO, inclusive Judiciário e Municipalidades.
- Teto de 100 matérias por consulta, sem paginação. Empresas com muitas publicações têm só as 100 mais recentes lidas. Trecho curto e sem texto integral. Não foi testado por quanto tempo a assinatura s do link continua valendo. Entram todas as partes do DO, inclusive Judiciário e Municipalidades.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-RJ/busca-cnpj-petrobras.html`
- `amostras/CAPTURA-DOE-RJ/LEIA.txt`

## RN — Rio Grande do Norte

**Diário Oficial do Estado do Rio Grande do Norte** · código `CAPTURA-DOE-RN`

- **Situação:** conectado. API ou página de busca própria.
- **Órgão:** Departamento Estadual de Imprensa (DEI/RN)
- **Portal:** <https://deirn.sdoe.com.br/diariooficialweb/>
- **Busca usada na coleta:** `https://deirn.sdoe.com.br/diariooficial/public/search`
- **Acervo:** Texto pesquisável desde dezembro de 2022, quando o diário passou para a plataforma SDOE.
- **O que se acha:** licença e autorização especial do IDEMA, regime tributário da SET e contrato do estado.

### Como o portal funciona e como o dado aparece

- Desde dezembro de 2022 o DOE-RN é publicado na plataforma SDOE (deirn.sdoe.com.br), a mesma do DOE-PE. O portal antigo (diariooficial.rn.gov.br/dei/dorn3) ainda linka a edição do dia em PDF.
- A busca do portal AngularJS chama /diariooficial/public/search por POST com JSON, com codigoDiario 121 (DEI/RN). Envelope e itens são iguais aos do DOE-PE: list, rowCount, pageSize; cada item é uma matéria com codigo, resumo, texto, nomeCategoria e dataPublicacao.
- texto junta os fragmentos com o termo, separados por linha em branco, até ~850 caracteres; resumo é o começo do ato.
- Exemplo real (Petrobras, 23/10/2026, Publicações Particulares): "COMUNICADO CONCESSÃO DE AUTORIZAÇÃO ESPECIAL A Petróleo Brasileiro S.A. – PETROBRAS, inscrita no CNPJ sob o nº 33.000.167/0577-23, torna público que recebeu do Instituto de Desenvolvimento Sustentável e Meio Ambiente do Rio Grande do Norte (IDEMA)…". A raiz achou 430 matérias.

### Campos do dado

Desde dezembro de 2022 o DOE-RN é publicado na plataforma SDOE (deirn.sdoe.com.br), a mesma do DOE-PE. O portal antigo (diariooficial.rn.gov.br/dei/dorn3) ainda linka a edição do dia em PDF. Exemplo bruto em amostras/CAPTURA-DOE-RN/

**Campos de cada matéria (6)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `codigo` | inteiro | Identificador da matéria. Vira a chave e, em base64, entra no link. |
| `texto` | texto com HTML | Fragmentos com o termo. Junto com o resumo, vira texto. |
| `resumo` | texto | Começo do ato, até ~150 caracteres. Os primeiros 140 caracteres viram titulo. |
| `nomeCategoria` | texto | Órgão ou seção, como Publicações Particulares ou Secretarias de Estado > SECRETARIA DE ESTADO DA FAZENDA. Vira orgao. |
| `dataPublicacao` | data AAAA-MM-DD | Dia da publicação. Vira data. |
| `rowCount` | inteiro | Total de matérias da busca, no envelope. A ficha conta as que citam a empresa. |

### Chamadas feitas pelo Radar

`POST https://deirn.sdoe.com.br/diariooficial/public/search`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `palavras` | `33.000.167 ou petroleo brasileiro petrobras` | Uma chamada para a raiz do CNPJ com máscara (XX.XXX.XXX) e outra para o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). A busca é por frase. |
| `intervaloAno` | `01/01/2015-{hoje DD/MM/AAAA}` | É o campo que filtra o período. |
| `dataInicial / dataFinal` | `01/01/2015 / hoje` | Enviados como o portal envia. |
| `codigoDiario` | `121` | DEI/RN. /diariooficial/public/diarios lista os diários da plataforma (1 é o DOE-PE). |
| `first / maxResults` | `0 / 200` | Deslocamento e tamanho. |

Corpo JSON. Exige o cabeçalho Referer: https://deirn.sdoe.com.br/diariooficialweb/, como o DOE-PE. Sem token.

### Passo a passo da extração

1. Faz uma busca por termo com até 200 matérias, com o mesmo código do DOE-PE (querySdoe), mudando base e codigoDiario.
2. Para cada matéria: texto = resumo … fragmentos, sem HTML; nomeCategoria vira orgao; dataPublicacao, data; o começo do resumo, titulo.
3. Monta o link: /diariooficialweb/#/visualizar-publicacao?publicacao={base64 do codigo}.
4. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
5. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
6. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
7. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Limitações

- Acervo só desde dezembro de 2022. De 2008 a 08/11/2022 havia a busca antiga (dorn3/buscamaterias.aspx), lenta (termos comuns passam de 280 s) e não usada. A resposta não traz página. O link é uma rota do portal (SPA).
- Acervo só desde dezembro de 2022. De 2008 a 08/11/2022 havia a busca antiga (dorn3/buscamaterias.aspx), lenta (termos comuns passam de 280 s) e não usada. A resposta não traz página. O link é uma rota do portal (SPA).
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-RN/busca-cnpj-petrobras.json`
- `amostras/CAPTURA-DOE-RN/LEIA.txt`

## RO — Rondônia

**Diário Oficial do Estado de Rondônia (DIOF)** · código `CAPTURA-DOE-RO`

- **Situação:** conectado. Índice de PDFs do Radar.
- **Órgão:** Superintendência Estadual de Imprensa Oficial de Rondônia (DIOF)
- **Portal:** <https://diof.ro.gov.br/>
- **Listagem de edições lida pelo sincronizador:** `https://diof.ro.gov.br/diarios/?cf_time={DD-MM-AAAA}`
- **Acervo:** Edições em PDF desde 2012 no WordPress do DIOF; o índice do Radar cobre o período carregado.
- **O que se acha:** licença da SEDAM, incentivo do CONDER e contrato do estado.

### Como o portal funciona e como o dado aparece

- A busca de conteúdo do DIOF está comentada no HTML, a REST API do WordPress exige login e as páginas /diario/{id} mostram uma lista fixa antiga.
- O campo "Buscar Publicações por data" da home chama /diarios/?cf_time=DD-MM-AAAA, que devolve só linhas <tr> (sem <table>): data, rótulo (a data ou "Suplemento #n"), tamanho e link do PDF em /data/uploads/AAAA/MM/.
- O nome do arquivo não segue padrão (DOE-27-10-26.pdf, DOE-10.03.2025.pdf, Doe-05-01-162.pdf), por isso o link sempre vem da consulta por data.
- O PDF é grande (3,8 MB e 457 páginas em 27/10/2026) e tem camada de texto. Exemplo real (página 456): pedido de publicação da ATEM'S Distribuidora de Petróleo S.A. (CNPJ 03.987.364) junto à SEDAM, com sede em Porto Velho.
- O Radar não depende de busca do portal: baixa cada edição, extrai o texto de todas as páginas com pdfjs e grava em doe_pdf_edicao e doe_pdf_pagina. Cada página guarda o texto, uma versão compacta e as raízes de CNPJ citadas.

### Campos do dado

A busca de conteúdo do DIOF está comentada no HTML, a REST API do WordPress exige login e as páginas /diario/{id} mostram uma lista fixa antiga. Exemplo bruto em amostras/CAPTURA-DOE-RO/

**Campos de cada página (12)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `data e rótulo (1ª e 2ª colunas)` | texto | Data DD-MM-AAAA e rótulo. "Suplemento #n" marca o titulo. |
| `link do PDF (a href)` | endereço URL | PDF da edição. O caminho depois de /data/uploads/ vira a chave; o endereço vira url. |
| `tamanho (3ª coluna)` | texto | Tamanho do arquivo. A ficha não copia. |
| `doe_pdf_edicao.chave` | texto | Identificador da edição no portal (id do arquivo ou caminho do PDF). Com a UF, impede ler a mesma edição duas vezes. |
| `doe_pdf_edicao.data` | data AAAA-MM-DD | Dia da edição, tirado da listagem. Vira data. |
| `doe_pdf_edicao.titulo` | texto | Diário Oficial, suplemento ou extra. Vira titulo. |
| `doe_pdf_edicao.url` | endereço URL | Link público da edição. Com #page={pagina}, vira o link da ficha. |
| `doe_pdf_edicao.paginas / bytes / status / erro` | inteiro / texto | Páginas com texto, tamanho do PDF e resultado da leitura (ok, sem_texto ou erro). A ficha não copia. |
| `doe_pdf_pagina.pagina` | inteiro | Número da página no PDF. Vira pagina. |
| `doe_pdf_pagina.texto` | texto | Texto integral da página, extraído com pdfjs, com quebras de linha. É dele que saem o trecho e o contexto. |
| `doe_pdf_pagina.compacto` | texto | O mesmo texto sem acento, minúsculo e só com letras e dígitos. Casa o nome que o PDF partiu em pedaços. A ficha não copia. |
| `doe_pdf_pagina.raizes` | lista de texto | Raízes de CNPJ (8 dígitos) achadas na página, com ou sem máscara. É a chave da busca por CNPJ. |

### Chamadas feitas pelo Radar

`GET https://diof.ro.gov.br/diarios/?cf_time={DD-MM-AAAA}`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `cf_time` | `27-10-2026` | Um dia por chamada; dias sem edição devolvem lista vazia. |

Sem token. Cerca de 0,5 s por chamada.

`GET https://diof.ro.gov.br/data/uploads/{AAAA}/{MM}/{arquivo}.pdf`

PDF público.

`SQL doe_pdf_pagina join doe_pdf_edicao (banco do Radar)`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `uf` | `RO` | Só o diário da UF da ficha. |
| `raizes @> array[raiz]` | `33000167` | Raiz do CNPJ, só dígitos. |
| `strpos(compacto, nome)` | `petroleobrasileiro` | Nome colado, sem acento nem espaço. |
| `order by / limit` | `data desc, pagina / 400` | Mais recentes primeiro. |

Consulta feita na hora da ficha. O portal só é chamado pelo sincronizador.

### Passo a passo da extração

1. Para cada dia do período, chama /diarios/?cf_time= e envolve a resposta numa <table> para o parser ler as linhas.
2. De cada linha tira o link do PDF (chave = caminho em /data/uploads/) e o rótulo (Diário Oficial ou suplemento).
3. Baixa o PDF, confere que começa com %PDF e extrai o texto de cada página (até 2.000). Página sem texto é descartada; edição sem nenhuma página com texto fica com status sem_texto.
4. Grava a edição e as páginas numa transação. Edição já lida não é baixada de novo; a que falhou fica com status erro e volta na rodada seguinte. Cada rodada registra uma linha em base_carga.
5. Na ficha, consulta o índice da UF: páginas cujas raizes contêm a raiz do CNPJ ou cujo compacto contém o nome colado (as até três primeiras palavras da razão social, sem espaço). Lê até 400 candidatas, da mais recente para a mais antiga.
6. Fica com as páginas da raiz e, das achadas pelo nome, só as que têm o nome colado; nome de uma palavra só precisa aparecer como palavra inteira ("vale" não casa com "valor"). Guarda as 40 primeiras.
7. Acha a posição do termo no texto original (mapeando o compacto de volta) e recorta 400 caracteres de trecho e 1.600 de contexto a partir dali. O link é o da edição com #page={pagina}.
8. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
9. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
10. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
11. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Limitações

- O alcance é o do índice: o agendador lê os últimos 7 dias todo dia, e o histórico depende da carga inicial (npm run doe:pdf-sync -- --dias N). Edição fora desse período não é achada. Cada resultado é uma página inteira, com atos de órgãos diferentes. O contexto em volta do termo é que diz qual ato é da empresa. Edições de 400 a 500 páginas: cada dia de RO ocupa cerca de 3 MB de texto no índice.
- O alcance é o do índice: o agendador lê os últimos 7 dias todo dia, e o histórico depende da carga inicial (npm run doe:pdf-sync -- --dias N). Edição fora desse período não é achada. Cada resultado é uma página inteira, com atos de órgãos diferentes. O contexto em volta do termo é que diz qual ato é da empresa. Edições de 400 a 500 páginas: cada dia de RO ocupa cerca de 3 MB de texto no índice.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-RO/1-edicoes-27-10-2026.html`
- `amostras/CAPTURA-DOE-RO/2-pagina-indexada.json`
- `amostras/CAPTURA-DOE-RO/LEIA.txt`

## RR — Roraima

**Diário Oficial do Estado de Roraima** · código `CAPTURA-DOE-RR`

- **Situação:** conectado. Índice de PDFs do Radar.
- **Órgão:** Imprensa Oficial do Estado de Roraima (Casa Civil)
- **Portal:** <https://www.imprensaoficial.rr.gov.br/>
- **Listagem de edições lida pelo sincronizador:** `https://www.imprensaoficial.rr.gov.br/_visualizar-mes/?ano={AAAA}&mes={MM}`
- **Acervo:** Edições listadas por mês desde 1980; o índice do Radar cobre o período carregado.
- **O que se acha:** licença da FEMARH, incentivo do estado e contrato do estado.

### Como o portal funciona e como o dado aparece

- A busca por palavra-chave do portal é o widget do Google Programmable Search; o servidor ignora o termo.
- A lista do mês (/_visualizar-mes/?ano=&mes=) tem uma linha por edição: tipo, data DD / MM / AAAA, tamanho e um formulário POST para /_visualizar-doe/ com doe (AAAA/MM/doe-AAAAMMDD.pdf), ipconexao, dia, mes e ano.
- O PDF só sai por POST com doe e ipconexao (qualquer valor); sem ipconexao, ou por GET, o servidor redireciona para /_inicial. Por isso o link da ficha é a lista do mês.
- PDF de 2,8 MB e 56 páginas (23/10/2026), com camada de texto. Exemplo real (20/10/2026, página 63): licença assinada pela presidência da FEMARH-RR, com código de verificação em validacao.femarh.rr.gov.br.
- O Radar não depende de busca do portal: baixa cada edição, extrai o texto de todas as páginas com pdfjs e grava em doe_pdf_edicao e doe_pdf_pagina. Cada página guarda o texto, uma versão compacta e as raízes de CNPJ citadas.

### Campos do dado

A busca por palavra-chave do portal é o widget do Google Programmable Search; o servidor ignora o termo. Exemplo bruto em amostras/CAPTURA-DOE-RR/

**Campos de cada página (13)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `doe (input)` | texto | Caminho AAAA/MM/doe-AAAAMMDD.pdf. Vira a chave e vai no POST do download. |
| `1ª coluna` | texto | Tipo, como Diário Oficial. Vira titulo. |
| `2ª coluna` | data DD / MM / AAAA | Dia da edição. Vira data. |
| `ipconexao / dia / mes / ano (input)` | texto | Campos do formulário. Só ipconexao é exigido no POST, com qualquer valor. |
| `doe_pdf_edicao.chave` | texto | Identificador da edição no portal (id do arquivo ou caminho do PDF). Com a UF, impede ler a mesma edição duas vezes. |
| `doe_pdf_edicao.data` | data AAAA-MM-DD | Dia da edição, tirado da listagem. Vira data. |
| `doe_pdf_edicao.titulo` | texto | Diário Oficial, suplemento ou extra. Vira titulo. |
| `doe_pdf_edicao.url` | endereço URL | Link público da edição. Com #page={pagina}, vira o link da ficha. |
| `doe_pdf_edicao.paginas / bytes / status / erro` | inteiro / texto | Páginas com texto, tamanho do PDF e resultado da leitura (ok, sem_texto ou erro). A ficha não copia. |
| `doe_pdf_pagina.pagina` | inteiro | Número da página no PDF. Vira pagina. |
| `doe_pdf_pagina.texto` | texto | Texto integral da página, extraído com pdfjs, com quebras de linha. É dele que saem o trecho e o contexto. |
| `doe_pdf_pagina.compacto` | texto | O mesmo texto sem acento, minúsculo e só com letras e dígitos. Casa o nome que o PDF partiu em pedaços. A ficha não copia. |
| `doe_pdf_pagina.raizes` | lista de texto | Raízes de CNPJ (8 dígitos) achadas na página, com ou sem máscara. É a chave da busca por CNPJ. |

### Chamadas feitas pelo Radar

`GET https://www.imprensaoficial.rr.gov.br/_visualizar-mes/?ano={AAAA}&mes={MM}`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `ano / mes` | `2026 / 10` | Um mês por chamada. |

Sem token. Cerca de 1 s.

`POST https://www.imprensaoficial.rr.gov.br/_visualizar-doe/`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `doe` | `2026/10/doe-20261020.pdf` | Caminho lido na lista. |
| `ipconexao` | `0.0.0.0` | Obrigatório, qualquer valor. |

Corpo application/x-www-form-urlencoded. Resposta application/pdf.

`SQL doe_pdf_pagina join doe_pdf_edicao (banco do Radar)`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `uf` | `RR` | Só o diário da UF da ficha. |
| `raizes @> array[raiz]` | `33000167` | Raiz do CNPJ, só dígitos. |
| `strpos(compacto, nome)` | `petroleobrasileiro` | Nome colado, sem acento nem espaço. |
| `order by / limit` | `data desc, pagina / 400` | Mais recentes primeiro. |

Consulta feita na hora da ficha. O portal só é chamado pelo sincronizador.

### Passo a passo da extração

1. Para cada mês do período, lê a lista do mês e, de cada formulário, o caminho do PDF, o tipo e a data.
2. Baixa cada edição por POST em /_visualizar-doe/ com doe e ipconexao.
3. Baixa o PDF, confere que começa com %PDF e extrai o texto de cada página (até 2.000). Página sem texto é descartada; edição sem nenhuma página com texto fica com status sem_texto.
4. Grava a edição e as páginas numa transação. Edição já lida não é baixada de novo; a que falhou fica com status erro e volta na rodada seguinte. Cada rodada registra uma linha em base_carga.
5. Na ficha, consulta o índice da UF: páginas cujas raizes contêm a raiz do CNPJ ou cujo compacto contém o nome colado (as até três primeiras palavras da razão social, sem espaço). Lê até 400 candidatas, da mais recente para a mais antiga.
6. Fica com as páginas da raiz e, das achadas pelo nome, só as que têm o nome colado; nome de uma palavra só precisa aparecer como palavra inteira ("vale" não casa com "valor"). Guarda as 40 primeiras.
7. Acha a posição do termo no texto original (mapeando o compacto de volta) e recorta 400 caracteres de trecho e 1.600 de contexto a partir dali. O link é o da edição com #page={pagina}.
8. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
9. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
10. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
11. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Limitações

- O alcance é o do índice: o agendador lê os últimos 7 dias todo dia, e o histórico depende da carga inicial (npm run doe:pdf-sync -- --dias N). Edição fora desse período não é achada. Cada resultado é uma página inteira, com atos de órgãos diferentes. O contexto em volta do termo é que diz qual ato é da empresa. O link da ficha abre a lista do mês, não a página: o PDF exige POST.
- O alcance é o do índice: o agendador lê os últimos 7 dias todo dia, e o histórico depende da carga inicial (npm run doe:pdf-sync -- --dias N). Edição fora desse período não é achada. Cada resultado é uma página inteira, com atos de órgãos diferentes. O contexto em volta do termo é que diz qual ato é da empresa. O link da ficha abre a lista do mês, não a página: o PDF exige POST.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-RR/1-edicoes-outubro-2026.html`
- `amostras/CAPTURA-DOE-RR/2-pagina-indexada.json`
- `amostras/CAPTURA-DOE-RR/LEIA.txt`

## RS — Rio Grande do Sul

**Diário Oficial do Estado do Rio Grande do Sul e Diário da Indústria e Comércio** · código `CAPTURA-DOE-RS`

- **Situação:** conectado. API ou página de busca própria.
- **Órgão:** Companhia Rio-grandense de Artes Gráficas (CORAG) e PROCERGS
- **Portal:** <https://www.diariooficial.rs.gov.br/>
- **Busca usada na coleta:** `https://doe-backend.pro.rs.gov.br/public/materias/`
- **Acervo:** Matérias desde 2019; páginas do acervo antigo até 1989.
- **O que se acha:** licença da FEPAM (no DIC), incentivo do FUNDOPEM e contrato do estado.

### Como o portal funciona e como o dado aparece

- O portal Angular chama a API REST doe-backend.pro.rs.gov.br. São duas bases: tipoDiario=doe é o Diário Oficial; qualquer outro valor cai no Diário da Indústria e Comércio (DIC), onde saem as licenças da FEPAM pedidas por empresas.
- O envelope traz collection, collectionSize (trava em 10.000), pageSize (10, fixo) e os filtros por tipo, entidade e assunto.
- Cada item é uma matéria (origem MATERIA, com id) ou uma página do acervo antigo (origem PAGINA, sem id). texto tem de 300 a 520 caracteres em volta do termo, começando em … e com o termo em <mark>.
- Exemplo do teste ao vivo (Braskem, 26/01/2022): "…CONCESSÃO DE RENOVAÇÃO DE LICENÇA A Braskem S.A (CNPJ 42.150.391/0038-62) torna público…". A raiz e o nome acharam 78 matérias desde 2015 nas duas bases.

### Campos do dado

O portal Angular chama a API REST doe-backend.pro.rs.gov.br. São duas bases: tipoDiario=doe é o Diário Oficial; qualquer outro valor cai no Diário da Indústria e Comércio (DIC), onde saem as licenças da FEPAM pedidas por empresas. Exemplo bruto em amostras/CAPTURA-DOE-RS/

**Campos de cada matéria (9)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `id` | inteiro ou nulo | Identificador da matéria; nulo nas páginas do acervo antigo. Entra na chave e no link. |
| `data` | texto DD/MM/AAAA ou DD-MM-AAAA | Data da publicação. Vira data em AAAA-MM-DD. |
| `texto` | texto com HTML | Trecho de 300 a 520 caracteres com o termo em <mark>. Vira texto. |
| `origem` | texto | MATERIA ou PAGINA. A ficha não copia. |
| `nroPagina` | inteiro ou nulo | Página, só no acervo antigo. Vira pagina. |
| `tipoDiario` | texto ou nulo | DOE, DIC ou nulo. A ficha grava caderno pela base consultada. |
| `textoLink` | texto ou nulo | Publicado no dia …, Página N. Reserva para titulo. |
| `dataUrl` | data AAAA-MM-DD ou nulo | Data para o link das páginas antigas. |
| `tipoMateria` | texto ou nulo | Tipo do ato, como Portarias. Vira titulo. |

### Chamadas feitas pelo Radar

`GET https://doe-backend.pro.rs.gov.br/public/materias/`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `queryString` | `42.150.391 ou braskem` | Uma chamada para a raiz do CNPJ com máscara (XX.XXX.XXX) e outra para o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). Nesta API palavras soltas fazem frase e aspas viram OU, então o termo vai sem aspas. |
| `tipoDiario` | `doe, depois dic` | Uma rodada em cada base. |
| `dataIni / dataFim` | `2015-01-01 / hoje` | Período; dataFim é obrigatória. |
| `page` | `1, 2, 3` | 10 por página, fixo. |

Sem token. O texto integral estaria em /public/materias/{id}, que o conector não chama.

### Passo a passo da extração

1. Para cada termo e cada base (DOE e DIC), lê até três páginas (30 matérias).
2. Para cada item: tira o HTML de texto; converte data para AAAA-MM-DD; tipoMateria vira titulo; a base vira caderno (DOE ou DIC).
3. Monta o link: /materia?id={id} para matéria, ou /diario?td={tipoDiario}&dt={dataUrl}&pg={nroPagina} para página antiga.
4. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
5. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
6. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
7. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Limitações

- Teto de 10.000 itens por busca e 10 por página. Sem o DIC as licenças da FEPAM ficariam de fora; o conector consulta as duas bases.
- Teto de 10.000 itens por busca e 10 por página. Sem o DIC as licenças da FEPAM ficariam de fora; o conector consulta as duas bases.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-RS/busca-cnpj-braskem.json`
- `amostras/CAPTURA-DOE-RS/LEIA.txt`

## SC — Santa Catarina

**Diário Oficial do Estado de Santa Catarina** · código `CAPTURA-DOE-SC`

- **Situação:** conectado. API ou página de busca própria.
- **Órgão:** Secretaria de Estado da Administração de Santa Catarina (SEA)
- **Portal:** <https://portal.doe.sea.sc.gov.br/>
- **Busca usada na coleta:** `https://portal.doe.sea.sc.gov.br/apis/busca-materia`
- **Acervo:** Texto pesquisável desde cerca de 2011.
- **O que se acha:** licença do IMA-SC, ata e convocação de empresa, incentivo do PRODEC e contrato do estado.

### Como o portal funciona e como o dado aparece

- O portal Angular chama /apis/busca-materia por POST com JSON. Cada item é uma matéria com número da edição, data, categoria (órgão ou seção), assunto (tipo do ato) e, com resumo:false, o texto integral da matéria.
- O envelope é {total, pagination, resposta, materias}. Sem resultado: {error: true, mensagem}. total trava em 10.000.
- Não há destaque do termo: o conector recorta o trecho do texto integral.
- Exemplo do teste ao vivo (WEG, 30/06/2021): "WEG S.A. Grupo Weg - Companhia Aberta CNPJ sob nº 84.429.695/0001-11 - NIRE 42300012203…". A raiz achou 272 matérias desde 2015, muitas de atas de outras empresas que citam a WEG.

### Campos do dado

O portal Angular chama /apis/busca-materia por POST com JSON. Cada item é uma matéria com número da edição, data, categoria (órgão ou seção), assunto (tipo do ato) e, com resumo:false, o texto integral da matéria. Exemplo bruto em amostras/CAPTURA-DOE-SC/

**Campos de cada matéria (12)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `id / cdMateria` | inteiro | Identificador da matéria. Vira a chave e entra no link. |
| `nrJornal` | texto | Número da edição. A ficha não copia. |
| `cdJornal` | inteiro | Identificador da edição. A ficha não copia. |
| `publicacao` | data e hora ISO | Data da publicação. Vira data. |
| `cdCategoria / categoria` | inteiro / texto | Órgão ou seção, como Publicações Diversas. categoria vira orgao. |
| `cdAssunto / assunto` | inteiro / texto | Tipo do ato, como ATA. assunto vira titulo. |
| `cancelada / aprovadaTriagem / pronta / publicada` | booleano | Situação da matéria. A ficha não copia. |
| `altura / preco` | número | Tamanho em cm e preço da publicação paga. A ficha não copia. |
| `extrato` | endereço URL | Rota da matéria no portal. Fica como link reserva. |
| `preview` | endereço URL | HTML da matéria terminando em _final.html. Sem o sufixo _final vira o link da ficha. |
| `resumo` | texto | Texto integral da matéria (com resumo:false). Vira texto, de onde sai o trecho. |
| `score` | texto | Relevância. A ficha não copia. |

### Chamadas feitas pelo Radar

`POST https://portal.doe.sea.sc.gov.br/apis/busca-materia`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `busca` | `84.429.695 ou weg equipamentos eletricos` | Uma chamada para a raiz do CNPJ com máscara (XX.XXX.XXX) e outra para o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). Aspas não mudam nada. |
| `tipoBusca` | `2` | Exata (frase, ordem por data). 1 faria OU, com contagem instável. |
| `dtIni / dtFim` | `2015-01-01 / hoje` | Período. |
| `pagination` | `{from: 0, size: 200}` | Deslocamento e tamanho. |
| `resumo` | `false` | Traz o texto integral no campo resumo. |

Corpo JSON. Sem token.

### Passo a passo da extração

1. Faz uma busca por termo com até 200 matérias.
2. Para cada matéria: o texto integral de resumo vira texto; assunto, titulo; categoria, orgao; publicacao, data.
3. Monta o link: o preview sem o sufixo _final (/repositorio/{AAAA}/{AAAAMMDD}/Materias/{id}/{id}.html).
4. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
5. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
6. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
7. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Limitações

- Sem destaque: o trecho e o contexto são recortados do texto integral em volta do CNPJ ou do nome. Publicações a pedido (atas, balanços) de outras empresas citam a empresa como acionista ou parte; a correlação descarta.
- Sem destaque: o trecho e o contexto são recortados do texto integral em volta do CNPJ ou do nome. Publicações a pedido (atas, balanços) de outras empresas citam a empresa como acionista ou parte; a correlação descarta.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-SC/busca-cnpj-weg.json`
- `amostras/CAPTURA-DOE-SC/LEIA.txt`

## SE — Sergipe

**Diário Oficial do Estado de Sergipe (IOSE)** · código `CAPTURA-DOE-SE`

- **Situação:** conectado. API de busca (motor IONEWS).
- **Órgão:** Imprensa Oficial de Sergipe (IOSE/SEGRASE)
- **Portal:** <https://iose.se.gov.br/>
- **Busca usada na coleta:** `https://iose.se.gov.br/busca/busca/buscar/query`
- **Acervo:** Texto pesquisável desde dezembro de 2011; o índice estava em dia em 27/10/2026.
- **O que se acha:** licença ambiental da ADEMA, incentivo do PSDI e contrato do estado.

### Como o portal funciona e como o dado aparece

- O Diário Oficial do Estado de Sergipe (IOSE) não publica uma API documentada. A busca do portal chama um Elasticsearch, e o Radar lê a mesma resposta JSON que a página usa.
- O envelope é o padrão do Elasticsearch: took, timed_out, _shards e hits. Em hits vêm total (quantas páginas do diário têm o termo), max_score e a lista hits.hits.
- Cada item de hits.hits é uma página inteira de uma edição, não um ato. _id junta edição e página (21987_41 é a página 41 da edição 21987). _source.conteudo traz o texto corrido da página toda, já sem quebras, com todos os atos daquela página misturados. _source traz também data (AAAA-MM-DD), pagina, paginas, diario_id, pdf_id, year, month, day e tipo_edicao.
- highlight.conteudo é uma lista de frases da página em HTML, com o termo buscado em <strong>. É a parte que interessa: mostra onde o CNPJ ou o nome aparece.
- Exemplo do teste ao vivo (Petrobras, 07/12/2022): "PETRÓLEO BRASILEIRO S/A LICENÇA DE OPERAÇÃO - RLO Torna público que recebeu da Administração Estadual do Meio Ambiente…". A raiz 33.000.167 achou 36 páginas desde 2015.
- O CNPJ aparece no texto com pontos (50.351.104/0001-10), com espaços ou sem separador, conforme o órgão que publicou. Por isso a busca usa a raiz com máscara e o filtro compara só os dígitos.

### Campos do dado

JSON do Elasticsearch atrás da busca do Diário Oficial do Estado de Sergipe (IOSE), o mesmo motor do DOE-BA. Cada resultado é uma página do diário, com o texto inteiro e o destaque do termo. Exemplo bruto em amostras/CAPTURA-DOE-SE/

**Campos de cada resultado em hits.hits**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `_id` | texto | Diário e página, como 21987_41. Usado para tirar repetidos entre buscas; a ficha não copia. |
| `_score` | número | Relevância da busca. A ficha não copia; ordena por município, tipo de ato e data. |
| `_source.conteudo` | texto | Texto inteiro da página. A ficha só usa quando falta o destaque. |
| `_source.data` | data AAAA-MM-DD | Dia da edição. Vira data. |
| `_source.pagina` | texto numérico | Página da edição. Vira pagina e entra no link. |
| `_source.paginas` | texto numérico | Total de páginas da edição. A ficha não copia. |
| `_source.diario_id` | texto numérico | Identificador da edição. Entra no link. |
| `_source.pdf_id` | texto numérico | Identificador do PDF da edição. A ficha não copia. |
| `_source.year` | texto | Ano da edição. A ficha não copia. |
| `_source.month` | texto | Mês da edição. A ficha não copia. |
| `_source.day` | texto | Dia da edição. A ficha não copia. |
| `_source.tipo_edicao` | texto numérico | 1 para edição regular. A ficha não copia. |
| `highlight.conteudo` | lista de HTML | Frases da página com o termo em strong. A ficha limpa o HTML e junta até 400 caracteres em trecho. |

### Chamadas feitas pelo Radar

`GET https://iose.se.gov.br/busca/busca/buscar/query/{pagina}/di:2015-01-01/df:{hoje}/?1=1&q="{termo}"`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `{pagina}` | `0, depois 1` | 10 resultados por página. A página 1 só é pedida se a 0 vier cheia. |
| `di / df` | `2015-01-01 / hoje` | Período no caminho da URL. |
| `q` | `"33.000.167" ou "petroleo brasileiro petrobras"` | Termo entre aspas, para buscar a frase. Uma chamada para a raiz do CNPJ com máscara (XX.XXX.XXX) e outra para o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). |

Sem token nem login. TLS válido com as raízes padrão do Node.

### Passo a passo da extração

1. Monta os termos: a raiz do CNPJ com máscara (XX.XXX.XXX) e o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI), quando tem pelo menos quatro letras. Cada termo vai entre aspas, para buscar a frase.
2. Para cada termo, chama a busca na página 0. Se vierem 10 resultados, chama também a página 1. São no máximo 20 páginas do diário por termo, 40 no total.
3. Para cada resultado, junta as frases de highlight.conteudo com " … " e tira o HTML. Sem destaque, usa _source.conteudo.
4. Recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Em lista corrida, o que vem antes do termo é outro registro, então o recorte começa só 1/5 da janela antes.
5. Guarda também um contexto de 1.200 caracteres em volta do termo. Ele não vai para a ficha; serve só para a correlação ler o ato inteiro.
6. Descarta a página que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (com três letras ou mais), comparadas sem acento.
7. Tira repetidos pelo _id, porque a mesma página volta na busca pelo CNPJ e na busca pelo nome.
8. Classifica o ato pelo trecho: ato_relevante (licença, alvará, decreto, incentivo, outorga, TAC, implantação, ampliação…), compra_publica (licitação, pregão, registro de preço, homologação, dispensa) ou outro.
9. Marca no_municipio quando o trecho cita o município da ficha e ordena: município primeiro, depois ato relevante, outro e compra pública, e por fim a data mais recente.
10. Monta o link: https://iose.se.gov.br/ver-flip/{diario_id}/#/e:{diario_id}/p:{pagina}?find={termo}. O PDF da página redireciona para /login, então o link abre o visualizador.
11. Passa todos os atos para a correlação. Os diretos viram a evidência, com até 8 linhas: data, pagina, trecho, url, tipo_ato, no_municipio e o motivo da correlação.

### Limitações

- Cada resultado é uma página inteira, com atos de órgãos diferentes. O contexto em volta do termo é que diz qual ato é da empresa. Sem aspas, os termos viram OU; o conector sempre manda aspas. Mesmo com aspas a frase tolera inversão de palavras, então o filtro de citação continua necessário.
- Cada resultado é uma página inteira, com atos de órgãos diferentes. O contexto em volta do termo é que diz qual ato é da empresa. Sem aspas, os termos viram OU; o conector sempre manda aspas. Mesmo com aspas a frase tolera inversão de palavras, então o filtro de citação continua necessário.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-SE/busca-cnpj-petrobras.json`
- `amostras/CAPTURA-DOE-SE/LEIA.txt`

## SP — São Paulo

**Diário Oficial do Estado de São Paulo** · código `CAPTURA-DOE-SP`

- **Situação:** conectado. API ou página de busca própria.
- **Órgão:** Imprensa Oficial do Estado de São Paulo
- **Portal:** <https://www.doe.sp.gov.br/>
- **API de busca usada na coleta:** `https://do-api-web-search.doe.sp.gov.br/v2/advanced-search/publications`

### Como o portal funciona e como o dado aparece

- O novo Diário Oficial de São Paulo publica uma API de busca (v2/advanced-search/publications) usada pelo portal doe.sp.gov.br. Não pede token.
- A resposta é um envelope com items, currentPage, totalPages, totalItems, pageSize, hasPreviousPage e hasNextPage.
- Cada item é um ato: id (UUID), isLegacy, publicationTypeId, secondLevelSectionId, thirdLevelSectionId, date (data e hora ISO), title, slug, excerpt, hierarchy, totalTermsFound e termsFound.
- excerpt é o texto do ato em volta do termo, já sem HTML na maior parte dos casos. hierarchy diz o caderno, a seção e o órgão separados por " > ", como "Executivo > Atos Normativos > Secretaria de Meio Ambiente, Infraestrutura e Logística > Departamento de Águas e Energia Elétrica".
- Exemplo real (Bracell, 10/07/2023): "PORTARIA DA SUPERINTENDENTE DO DAEE DE 07/07/2023" com o trecho "Fica outorgada, em nome de BRACELL SP CELULOSE LTDA., CPF/CNPJ 53.943.098/0001-87, a autorização administrativa para o(s) uso(s) em recursos hídricos superficiais, para fins de irrigação, no município de Itatinga". É da mesma empresa, mas em Itatinga e para irrigação de floresta. Não é a fábrica de Lençóis Paulista, então a correlação marca outro_projeto.
- As listas mensais de licenças da CETESB saem como um ato só, com centenas de empresas. O excerpt pode começar em outra empresa; por isso o recorte é feito em volta do CNPJ ou do nome.
- A API só indexa atos a partir de maio de 2023. O acervo antigo fica fora.

### Campos do dado

JSON da API v2/advanced-search/publications do novo Diário Oficial de São Paulo. O envelope traz items e a paginação. Exemplo bruto em amostras/CAPTURA-DOE-SP/

**Campos de cada ato em items (12)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `id` | texto UUID | Identificador do ato. Usado para tirar repetidos entre buscas; a ficha não copia. |
| `isLegacy` | booleano | true quando o ato vem do acervo antigo. Veio false em todos os atos vistos. A ficha não copia. |
| `publicationTypeId` | texto UUID | Tipo de publicação. A ficha não copia. |
| `secondLevelSectionId` | texto UUID | Seção de segundo nível. A ficha não copia. |
| `thirdLevelSectionId` | texto UUID | Seção de terceiro nível. A ficha não copia. |
| `date` | data e hora ISO | Data da publicação. Vira data em AAAA-MM-DD. |
| `title` | texto | Título do ato. Vira titulo e abre o trecho. |
| `slug` | texto | Caminho do ato. O link é https://www.doe.sp.gov.br/ seguido do slug. Vira url. |
| `excerpt` | texto | Trecho do ato com o termo. A ficha recorta em volta do CNPJ ou do nome. |
| `hierarchy` | texto | Caderno, seção e órgão separados por >. Vira orgao. |
| `totalTermsFound` | inteiro | Quantos termos da busca o ato tem. A ficha não copia. |
| `termsFound` | lista de texto | Termos da busca achados no ato. A ficha não copia. |

### Chamadas feitas pelo Radar

`GET https://do-api-web-search.doe.sp.gov.br/v2/advanced-search/publications`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `Terms[0]` | `53.943.098 ou bracell sp celulose` | Uma chamada para a raiz do CNPJ e outra para o nome. Vários Terms[i] na mesma chamada seriam combinados com OU. |
| `FromDate` | `2015-01-01` | Início do período. Na prática a API começa em maio de 2023. |
| `ToDate` | `data de hoje` | Fim do período. |
| `PageNumber` | `1` | Só a primeira página. |
| `PageSize` | `100` | Até 100 atos por termo. |
| `SortField` | `Date` | Mais recentes primeiro. |

Sem token. O ato abre em https://www.doe.sp.gov.br/{slug}.

### Passo a passo da extração

1. Faz duas buscas, pela raiz do CNPJ com máscara e pelo nome da empresa. São até 200 atos.
2. Para cada ato, tira o HTML do excerpt e recorta 320 caracteres a partir de pouco antes do CNPJ ou do nome. O trecho da ficha é "{title} — {recorte}", com até 400 caracteres.
3. Guarda o contexto (título e excerpt, até 1.200 caracteres em volta do termo) só para a correlação.
4. Converte date em AAAA-MM-DD, copia title em titulo e hierarchy em orgao, e monta a url com o slug.
5. Descarta o ato que não cita a empresa (dígitos da raiz ou todas as palavras do nome no título e excerpt) e tira repetidos pelo id.
6. Classifica o ato, marca no_municipio e ordena: município, tipo de ato, data.
7. Passa todos os atos para a correlação. Os diretos viram a evidência, com até 8 linhas: data, titulo, orgao, trecho, url, tipo_ato e no_municipio.

### Particularidades da correlação

- Em São Paulo a mesma empresa costuma ter muitos atos em municípios vizinhos: outorgas do DAEE para fazendas, licenças da CETESB de outras unidades, autos de infração. O município no excerpt é o principal sinal; o órgão em hierarchy ajuda a separar licença ambiental de compra pública.
- Com mais de 60 atos, só os 60 primeiros na ordem (município da ficha primeiro) são lidos. O resto conta como não avaliado.

### Limitações

- Obra concluída antes de 2023 aparece só pelos atos posteriores, como LO e renovação. As listas da CETESB são longas, e o recorte pode cortar parte da linha da empresa.
- Só indexa desde maio de 2023, as listas da CETESB são longas e a primeira página traz até 100 atos por termo.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-SP/busca-cnpj-bracell.json`
- `amostras/CAPTURA-DOE-SP/LEIA.txt`

## TO — Tocantins

**Diário Oficial do Estado do Tocantins** · código `CAPTURA-DOE-TO`

- **Situação:** conectado. API ou página de busca própria.
- **Órgão:** Casa Civil do Estado do Tocantins
- **Portal:** <https://diariooficial.to.gov.br/>
- **Busca usada na coleta:** `https://diariooficial.to.gov.br/busca`
- **Acervo:** Edições de 2015 em diante confirmadas; início do acervo não confirmado.
- **O que se acha:** licença do NATURATINS, regime especial de ICMS e contrato do estado.

### Como o portal funciona e como o dado aparece

- A busca roda no servidor e procura a frase exata no texto das edições, mas só devolve quais edições citam o termo: uma linha por edição com número, data, quantidade de páginas, tamanho, downloads e o link do PDF.
- A resposta é HTML (vem em gzip mesmo sem pedir). Não há trecho nem página. O teto é de 100 edições, sem paginação.
- Por isso o conector baixa o PDF das edições mais recentes e procura o CNPJ ou o nome página por página.
- Exemplo do teste ao vivo (Petrobras, edição 4451 de 03/09/2015, página 188 de 214): "… a revogação do Termo de Acordo de Regime Especial nº 1.061/2000 da empresa PETRÓLEO…".

### Campos do dado

A busca roda no servidor e procura a frase exata no texto das edições, mas só devolve quais edições citam o termo: uma linha por edição com número, data, quantidade de páginas, tamanho, downloads e o link do PDF. Exemplo bruto em amostras/CAPTURA-DOE-TO/

**Campos de cada página do PDF (6)**

| Campo | Tipo | O que é e o que a ficha faz |
| --- | --- | --- |
| `td (1ª)` | texto | Nº {numero} da edição. Entra no titulo. |
| `td (2ª)` | data DD/MM/AAAA | Data da edição. Vira data. |
| `td (3ª)` | texto | {n} pág. A ficha não copia. |
| `td (4ª e 5ª)` | texto | Tamanho e downloads. A ficha não copia. |
| `a[href]` | endereço URL | https://doe.to.gov.br/diario/{id}/download, o PDF da edição. Com #page={pagina} vira url. |
| `texto da página do PDF` | texto | Extraído com pdfjs da página que cita a empresa. Vira texto. |

### Chamadas feitas pelo Radar

`GET https://diariooficial.to.gov.br/busca`

| Parâmetro | Valor | Para quê |
| --- | --- | --- |
| `por` | `texto` | Busca no texto das edições. |
| `texto` | `33.000.167 ou petroleo brasileiro petrobras` | Uma chamada para a raiz do CNPJ com máscara (XX.XXX.XXX) e outra para o nome da empresa (até três primeiras palavras da razão social, sem S/A, LTDA, ME, EPP ou EIRELI). É texto exato; aspas zeram. |
| `data-inicial / data-final` | `2015-01-01 / hoje` | Período. |

Sem token. Consultas longas levaram até 32 s.

`GET https://doe.to.gov.br/diario/{id}/download`

PDF da edição, de 1,5 a 3,6 MB nos testes.

### Passo a passo da extração

1. Busca as edições com cada termo e junta as listas.
2. Ordena da mais recente para a mais antiga e baixa o PDF das 3 primeiras.
3. Lê todas as páginas de cada PDF (até 600) e guarda as que citam a raiz do CNPJ ou todas as palavras do nome, até 3 por edição.
4. Cada página guardada vira um ato: data e número da edição, página, texto da página e link do PDF com #page=.
5. Descarta o ato que não cita a empresa: precisa ter os dígitos da raiz do CNPJ ou todas as palavras do nome (três letras ou mais), comparadas sem acento.
6. Tira repetidos pela chave do ato e recorta o trecho de 400 caracteres a partir de pouco antes do CNPJ ou do nome. Guarda também 1.200 caracteres de contexto, que só a correlação lê.
7. Classifica o ato pelo trecho (ato_relevante, compra_publica ou outro), marca no_municipio quando o trecho cita o município da ficha e ordena: município, tipo de ato, data.
8. Passa todos os atos para a correlação com o projeto. Os diretos viram a evidência, com até 8 linhas.

### Limitações

- Lento: busca e PDFs somam cerca de 70 s por ficha. Só as 3 edições mais recentes são lidas, e a busca para em 100 edições.
- Lento: busca e PDFs somam cerca de 70 s por ficha. Só as 3 edições mais recentes são lidas, e a busca para em 100 edições.
- A evidência desta fonte não substitui as demais: valor, fase e localização só sobem na ficha quando o registro for mais específico e mais recente do que o que a notícia ou outra secundária já trouxe.

### Amostra bruta

- `amostras/CAPTURA-DOE-TO/busca-cnpj-petrobras.html`
- `amostras/CAPTURA-DOE-TO/LEIA.txt`
