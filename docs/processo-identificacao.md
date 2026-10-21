# Processo de identificação de projetos

Esboço do sistema do Radar CapEx e leitura do catálogo de fontes em 29 de setembro de 2026.

O alvo é um projeto de investimento de empresa privada, em solo brasileiro, com ativo físico (fábrica, planta, mina, terminal, usina, data center ou centro logístico) e porte a partir de R$ 100 milhões quando o valor está explícito. Obra pública, concessão, PPP, projeto no exterior, notícia econômica geral e projeto pequeno ficam fora da fila.

O inventário de cada fonte está em [fontes-resumo.md](../fontes-resumo.md). Formato, erros e limites estão em [fontes-mapeadas.md](../fontes-mapeadas.md). Os requisitos do MVP estão em [requisitos.txt](../requisitos.txt). A contagem do catálogo inicial está na seção 5. As tabelas estão na seção 6.

## 1. Por que o processo é uma cascata

As fontes primárias publicam manchete, não ficha de projeto. Uma capa mistura obra, macro, mercado e pauta internacional. Ler tudo com um modelo generativo funciona no piloto e fica caro quando a varredura passa a ser recorrente e o catálogo cresce.

A cascata gasta o método mais barato primeiro. Cada etapa descarta a maior parte do que recebeu. O modelo generativo entra só no que sobreviveu, e só nos campos que regra e gazetteer não fecharam.

Três decisões ficam separadas, porque misturá-las faz o sistema reler matéria e duplicar projeto:

1. Vale abrir esta página?
2. Esta página descreve um projeto do alvo?
3. Esta matéria é um projeto novo ou uma atualização de um projeto que já existe?

## 2. Esboço do processo

```text
fontes fixas / prova          hub (Google)
        |                          |
        | só URL nova              | só domínio e data
        v                          v
   peneira da manchete  <---  portal promovido
        |
        v
   extração do texto
        |
        v
   classificação (regra, depois Jev)
        |
        +-- reprovado com motivo --> rótulo, fim
        |
        v
   campos (regex, IBGE, nomes no texto)
        |
        v
   casa com projeto existente?
        |
        +-- sim, fase igual --> evidência, sem reescrever
        +-- sim, fase nova  --> proposta de status
        +-- não             --> perfil candidato --> aprovação humana
                                      |
                                      v
                               enriquecimento pontual
                               nas bases secundárias
```

A releitura atravessa o ciclo inteiro. Não é uma sétima etapa no fim.

### 2.1 Busca

Dois percursos, com produtos diferentes.

**Fontes conhecidas.** No início, a rotina percorre os portais em estágio fixa uma vez por semana. Portais em prova entram na mesma rodada, com menos matérias por veículo. Não há teto diário de chamadas ao modelo: a rodada lê as publicações novas que a peneira deixou passar. Entra na fila só URL que a capa, o RSS ou o sitemap do próprio veículo ainda não tinha. Página com o mesmo hash da leitura anterior para aqui.

**Fontes desconhecidas.** Na mesma cadência semanal, o sistema repete buscas de investimento num hub de notícias (Google). O hub agrupa a pauta e revela qual veículo está publicando. Dessa resposta ficam domínio, nome do portal, consulta e data. Manchete, trecho e corpo do hub não entram no banco. A matéria, quando for lida, é baixada no site do veículo.

Portal visto recorrentemente, passa a prova. Na prova, uma cota curta mede o rendimento. Vira fixa caso a recorrência de notícias úteis no portal seja notável. Sem esse rendimento depois de muitas leituras, aposenta. Fonte fixa sem projeto privado por muitos dias, ou com acesso bloqueado, também aposenta. O histórico permanece. Fontes aposentadas podem ser adicionadas novamente como fixas após uma recorrência de aparições nas fontes desconhecidas.

**O que vale explorar** são duas peneiras:


| Peneira | Decide                     | Método                                                                                                                                                                                                                                                   |
| ------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portal  | Quem entra na varredura    | Estágio: sugerida, prova, fixa, aposentada                                                                                                                                                                                                               |
| Link    | Qual manchete da capa abre | Termos de obra e valor; penalidade para macro, cripto, bolsa e país estrangeiro sem menção ao Brasil (Os temos devem evoluir com o tempo, inciando o experimento com muitos termos gerais, filtrando a lista conforme projetos válidos são encontrados.) |


Link abaixo do corte não é baixado.

### 2.2 Extração

O método muda com o que a fonte entrega. Só roda no link que passou a peneira.


| Origem               | O que se tira                   | Como                                                                                                      |
| -------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Capa, RSS ou sitemap | Título, URL, data, lead         | Seletor do portal, quando o HTML é estável; extrator genérico na prova                                    |
| Artigo HTML          | Título e parágrafos até um teto | Recorte do miolo. `og:description` e JSON-LD de `NewsArticle` vêm antes do corpo, quando o portal publica |
| Base secundária      | Registro pontual                | Consulta por chave, na etapa de enriquecimento. Não é varredura de texto                                  |


O produto é um registro de matéria: URL, hash do texto, título, lead, recorte, fonte e data. Ainda não é projeto.

Portal com captcha ou paywall (CanalEnergia, Valor e o grupo de imprensa econômica) fica no catálogo e fora da extração automática.

### 2.3 Classificação

A pergunta é se a matéria equivale a um projeto do alvo. A resposta grava um motivo e encerra, ou libera a estruturação.

A ordem é regra, depois Jev, depois modelo generativo só na faixa cinzenta.

**Regra**, no título e no lead, elimina o óbvio: cripto, bolsa, dívida, tarifa, resultado trimestral, e país estrangeiro sem Brasil. Isso evita chamar qualquer modelo.

**Jev** ([TypeSafe](https://docs.typesafe.ai/introduction)) é um modelo de decisão, não de texto. Uma chamada manda o estado (título e lead) e várias perguntas atômicas, avaliadas em paralelo. Cada uma devolve valor tipado, probabilidade e confiança. O código combina. O Jev não escreve nome, município, valor numérico nem resumo.


| Pergunta                                                                              | Tipo Jev | Porta                                                       |
| ------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------- |
| Descreve ativo físico novo ou ampliação                                               | noul     | Separa de macro, M&A, dívida e resultado                    |
| O ativo fica no Brasil                                                                | noul     | Corta obra no exterior                                      |
| A dona é empresa privada e nenhum órgão público investe, financia, concede ou é sócio | noul     | Corta obra pública, concessão e PPP                         |
| Nicho                                                                                 | choice   | Fábrica, mina, terminal, usina, data center, outro, nenhum  |
| Há valor explícito de pelo menos R$ 100 milhões                                       | noul     | Porte. Valor ausente é outra resposta, e segue para revisão |


Confiança alta e reprovação grava o motivo: não é projeto, projeto público, projeto internacional ou projeto pequeno. Confiança alta e aprovação segue. Faixa cinzenta vai ao modelo generativo, ou à fila humana enquanto o limiar não estiver calibrado.

O Jev entra em produção para descartar sozinho depois de uma sombra: ele classifica, a decisão vigente (regra, modelo generativo e pessoa) continua valendo, e os rótulos de aprovação e rejeição ajustam o limiar. Os rótulos já ficam no histórico de treino e no JSONL `/api/treino/candidatos.jsonl`.

### 2.4 Estruturação

Três atos, nesta ordem. O casamento com projeto existente acontece antes de criar ficha nova.

**Identificar os campos.** Cada campo usa o método mais preciso que der conta.


| Campo               | Método                                           | Quando o modelo generativo entra                                                           |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Valor e moeda       | Regex (`R$ 1,2 bilhão` = 1200000000)             | Há dois números e não fica claro qual é o CapEx. A resposta traz o trecho literal          |
| UF e município      | Gazetteer do IBGE                                | O texto cita a obra sem lugar                                                              |
| Empresa             | Nomes que já estão no texto. CNPJ não se inventa | Há várias empresas e nenhuma é claramente a dona. Se continuar ambíguo, o campo fica vazio |
| CNPJ                | Resolução por nome: base própria de empresas já vistas, depois API de consulta por razão social, com UF e CNAE como desempate | Nunca. O número vem de cadastro, não de texto |
| Fase                | Âncoras: anuncia, licença, em obras, operando    | As âncoras conflitam. Aí um `choice` do Jev                                                |
| Nome curto e resumo | Modelo generativo                                | Sempre que a classificação já passou, e sem reextrair campo que a regra fechou             |


Valor ausente não vira zero e não reprova por porte. Valor explícito abaixo de R$ 100 milhões (dólar convertido de forma conservadora) sai como projeto pequeno.

**Identificar duplicata.** Há duas chaves.

- Matéria repetida: a URL. Já registrada, não relê.
- Projeto repetido: empresa normalizada + município + nicho, e em seguida similaridade com fichas abertas. Acima do limiar, a matéria vira evidência do projeto existente. Abaixo, nasce candidato. No meio, o Jev responde se os dois textos curtos são o mesmo ativo.

**Resolver o CNPJ.** Projeto de R$ 100 milhões costuma ter dona conhecida. Com o nome da empresa e a UF, a estruturação monta um perfil prévio (nome normalizado, grupo, setor provável) e procura o CNPJ em duas camadas: a base própria de empresas que o Radar já viu, e uma API de consulta por razão social ou nome fantasia. A resposta só entra quando um único cadastro casa com nome, UF e atividade compatível. Grupo com várias SPEs fica com a holding marcada e a SPE em aberto para a secundária apontar. Sem casamento único, `cnpj` fica vazio e a ficha vai à aprovação assim mesmo. O texto da notícia nunca é a origem do número.

**Criar o perfil e mandar para aprovação.** O candidato leva nome, nicho, UF, município, empresa, CNPJ resolvido, valor, moeda, fase, URL e a confiança de cada campo. Aprovar grava projeto e evidência primária na mesma transação. Rejeitar guarda o rótulo e o motivo. Aprovação automática fica para quando confiança e completude passarem de um piso medido nesses rótulos.

**Atualizar status.** Só com casamento firme e matéria mais recente. Âncora clara (“iniciou as obras”, “obteve a LI”) propõe a fase nova. Fase contraditória espera a pessoa e não sobrescreve a ficha.

### 2.5 Enriquecimento

Roda sobre projeto aprovado, não sobre notícia solta. A ficha chega com o CNPJ já resolvido na estruturação. O que a notícia não traz é o código de usina, o processo de licença, o contrato e o valor oficial. A base secundária traz, porque a chave é o CNPJ.

A chave de entrada é o CNPJ. UF, município e nicho escolhem a base e desempatam. Quando a resolução não fechou um CNPJ único, o enriquecimento roda com empresa e UF, em modo de menor confiança, e a primeira secundária que devolver o número (BNDES, licença, CNO) fecha a ficha. Consultar Obrasgov ou SIGA só com a manchete devolve registro errado.

A base é escolhida pelo nicho, em código: energia no SIGA, crédito no BNDES, licença no Ibama, obra com recurso federal no Obrasgov, óleo e gás na ANP, porto na ANTAQ, mina no SIGMINE. O Jev só sugere o nicho quando ele veio vazio. A consulta é determinística.

Cadência: uma vez ao aprovar, e de novo quando uma matéria nova mudar a fase. O resultado é evidência secundária com URL, ou a tentativa registrada com o erro de acesso. Dado sem link não entra na ficha. Valor oficial só ganha confiança alta depois dessa evidência. O CNPJ, já resolvido antes, é confirmado quando a secundária devolve o mesmo número.

### 2.6 Releitura

Cada camada evita um custo diferente. A última linha é o caso em que reler é o objetivo.


| Já visto                                                            | O que não se repete               |
| ------------------------------------------------------------------- | --------------------------------- |
| URL igual                                                           | Download e tudo depois            |
| Hash do texto igual                                                 | Classificação e estruturação      |
| Rótulo “não é projeto” com confiança alta                           | Nova chamada de modelo            |
| Projeto casado e fase igual à ficha                                 | Reescrita do perfil               |
| Matéria nova do mesmo projeto, com âncora de fase ou data mais nova | Segue, só para atualizar o status |


Sem palavra de fase e sem data mais nova, a matéria de um projeto conhecido para na classificação.

No início não há cota diária. Uma execução por semana cobre o ritmo em que projeto novo aparece. O intervalo pode ser de alguns dias ou de mais de uma semana, sem mudar as etapas. Várias passagens no mesmo dia ficam para o caso em que a operação precisar de atualização mais curta. O botão manual continua disponível e não espera o relógio.

## 3. O que cada instrumento faz


| Instrumento       | Faz                                                         | Não faz                          |
| ----------------- | ----------------------------------------------------------- | -------------------------------- |
| Regra e regex     | Corta o óbvio e lê valor                                    | Não julga texto ambíguo          |
| Gazetteer (IBGE)  | UF e município citados                                      | Não inventa lugar                |
| Jev               | Portas sim/não, nicho, fase em conflito, “é o mesmo ativo?” | Não redige ficha nem extrai CNPJ |
| Modelo generativo | Nome, resumo e campo que ficou vazio na faixa cinzenta      | Não é a primeira leitura da capa |
| Pessoa            | Aprova, rejeita, desempata fase                             | Não relê URL já rotulada         |
| Resolução de CNPJ | Nome da empresa vira CNPJ, por base própria e API de razão social | Não decide se é projeto      |
| Base secundária   | Confirma licença, contrato, valor oficial pela chave CNPJ   | Não descobre o projeto           |


## 4. As fontes de hoje e por que este modelo cabe nelas

O catálogo mistura cinco jeitos de entregar dado. O processo usa cada jeito no lugar em que ele é forte. Tratar todos como “página para o modelo ler” desperdiça o que já vem estruturado e paga caro pelo que é só manchete.

### 4.1 Notícia privada em HTML é descoberta, e por isso a cascata existe

A descoberta mora em portal web. A unidade é a notícia. Não há API de “projetos privados acima de R$ 100 milhões”.

No scanner hoje (estágio fixa): Agência iNFRA, Portal BE News, MegaWhat, InfoMoney, Money Times e InvestNews.

Isso combina com o esboço por quatro motivos.

**A capa é lista, o artigo é texto.** Dá para peneirar o título antes de baixar o corpo, e extrair o miolo com seletor. iNFRA, BE News e MegaWhat repetem o HTML. InfoMoney, Money Times e InvestNews também. O extrator genérico segura a prova; o seletor próprio entra quando o portal vira fixa.

**A maior parte da capa não é obra.** Money Times, InfoMoney, InvestNews, CNN, Forbes e Bloomberg publicam bolsa, macro e pauta fora do Brasil no mesmo fluxo em que anunciam fábrica. A peneira da manchete e o Jev existem por causa dessa mistura. Numa varredura só de iNFRA ou MegaWhat o desperdício seria menor. No conjunto real, ler toda manchete com modelo generativo não se sustenta.

**O mesmo ativo sai em vários veículos.** Uma fábrica anunciada na iNFRA reaparece no BE News ou no MegaWhat. A URL muda e o projeto é o mesmo. A chave empresa + município + nicho é o que impede a fila de encher de fichas repetidas. Sem essa etapa, cada portal fixo duplica o objeto.

**O valor e o lugar estão na frase, não num campo.** “R$ 330 milhões em Itajaí” é regex e gazetteer. O modelo generativo fica para o resumo e para o caso com dois números. Isso é o formato real dessas matérias.

CanalEnergia e a imprensa econômica (Valor, Estadão, Exame, Pipeline) confirmam o limite: sem acesso automático, não há extração. Ficam como fonte conhecida que uma pessoa abre, e o perfil continua passando pela aprovação.

### 4.2 Notícia de órgão é o contraexemplo que a classificação precisa reconhecer

ANEEL, ANP, ANM, ANTT, ANTAQ, MME, Transportes, Cidades, Portos e Aeroportos, EPE, PPI, BNDES Imprensa, Agência Gov, AEN Paraná e InvestSP também são HTML de notícia. O extrator de capa funcionaria. O alvo não.

Esses portais anunciam leilão, outorga, concessão, programa e obra de governo. De vez em quando uma empresa privada aparece, em geral como concessionária ou como beneficiária de ato público. A pergunta do Jev sobre órgão público no investimento é o que impede essa família de voltar ao scanner só porque a página abre. Eles permanecem no catálogo como pista de enriquecimento (o ato, o lote, a outorga), depois que o projeto privado já existe.

InvestSP é o caso intermediário: é órgão, e o conteúdo é anúncio de investimento privado em São Paulo. Pode alimentar a prova, com a mesma porta de “quem é a dona”. Não entra como fixa só por ser notícia.

### 4.3 Base secundária já é registro, então enriquecimento é consulta e não leitura de texto

O restante do catálogo não descreve o projeto em parágrafos. Descreve um registro com chave. Por isso o enriquecimento é outra etapa, e só com empresa e UF já identificados. A ficha de cada fonte secundária — escopo, acesso, campos, configuração e como a linha se amarra na ficha da notícia — está em [enriquecimento-fontes-secundarias.md](enriquecimento-fontes-secundarias.md).


| Família            | Exemplos                                                                                                                                           | O que a notícia não trouxe                        | Por que não varre como fonte primária                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| API pública        | Obrasgov, IAT/PR, Querido Diário                                                                                                                   | Valor previsto, licença com coordenada, ato municipal | O resultado é obra pública ou ato oficial. Serve para cruzar um projeto já nomeado                                         |
| API com credencial | dados.gov.br                                                                                                                                       | URL atual do CNO e do CNPJ                        | Exige chave. A consulta é pontual                                                                                              |
| Dataset            | ANEEL SIGA, BNDES, Ibama SISLIC, ANTT investimentos, ANTAQ instalações, ANP (blocos, campos, plataformas e dutos), CNO, CVM IPE, SIGMINE, ONS PAR, REIDI, ARTESP, Portal de Obras de MG | CEG, CNPJ, fase da usina, licença, desembolso     | O arquivo lista o universo. Procurar “fábrica nova” dentro dele é o caminho inverso: a notícia acha o nome, o arquivo confirma |
| Consulta em tela   | ANA SNIRH                                                                                                                                          | Outorga de água                                   | Não há lista para baixar. A chave (empresa, município) é o que torna a consulta possível                                       |
| Diário oficial     | DOU                                                                                                                                                | Portaria de REIDI, licença, projeto prioritário   | O ato confirma. Não é a forma de descobrir a intenção de investir                                                              |


O BNDES é o exemplo nítido. A notícia diz “a empresa vai construir”. A resolução de CNPJ diz quem é a empresa. O dataset de operações, consultado por esse CNPJ, diz a descrição e o valor contratado. Sem o CNPJ, o CSV inteiro depende de nome parecido. Com o CNPJ, uma consulta fecha o valor com confiança alta.

O SIGA faz o mesmo para usina: a matéria do MegaWhat traz o anúncio; o dataset traz CEG, potência, município e fase. A ANTAQ e a ANTT fazem o mesmo para terminal e concessão rodoviária, quando o projeto já tem nome e lugar.

CNO e CNPJ não descobrem CapEx. CNO não tem valor. CNPJ não tem obra. O cadastro da Receita é a base por trás da resolução de CNPJ na estruturação e, no enriquecimento, completa razão social, CNAE e estabelecimento. O CNO entra com o CNPJ resolvido para localizar o canteiro. Isso é o motivo de a estruturação proibir CNPJ inventado pelo modelo: o número certo mora no cadastro, não na manchete.

### 4.4 O hub não substitui o portal

Google Notícias junta, num dia, iNFRA, InfoMoney, portal regional, macro e pauta internacional. A primeira descoberta automática trouxe 139 domínios novos. Eles entram no catálogo inicial como portal privado sugerido. Ainda não estão na leitura contínua: a capa só passa a ser varrida quando o domínio se repete e rende projeto na prova.

O esboço usa o hub só para renovar a lista de portais. O veículo que se repete e rende projeto privado vira fonte fixa, e daí em diante é lido na capa dele, com seletor e URL estável. Ler o hub como se fosse fonte primária gravaria matéria de terceiros, misturaria macro com obra e perderia a URL canônica do veículo.

## 5. Natureza do catálogo inicial

O catálogo inicial, em 29 de setembro de 2026, tem 226 fontes. Entram as 87 já descritas no inventário e as 139 portais privados que a primeira busca no hub observou. Essas 139 são o começo da descoberta: imprensa ainda sem ficha longa, com página aberta, estágio sugerida e esfera privada. As partes abaixo usam uma casa decimal.

### 5.1 Como o dado chega


| Forma de extração     | Fontes | Parte do catálogo |
| --------------------- | ------ | ----------------- |
| Portal web            | 185    | 81,9%             |
| Base consultável      | 17     | 7,5%              |
| Dataset para download | 15     | 6,6%              |
| API pública           | 5      | 2,2%              |
| API privada           | 4      | 1,8%              |
| Total                 | 226    | 100%              |


O catálogo inicial é portal. Dataset, consulta e API somam 41 fontes, 18,1%. A cascata continua necessária: a maior parte do acervo é manchete, e o bloco estruturado só confirma o projeto depois que a manchete deu empresa e lugar.

### 5.2 Notícia pública e notícia privada

Dos 185 portais, 176 são notícia. Os outros 9 são página institucional, sem esfera de notícia: DOU, diários estaduais, portais de RI, DNIT Cidadão, Transferegov, fundos da SUDENE e da SUDAM, e os diretórios ABEMA, ABAR e ABDE.


| Grupo                     | Fontes | Parte do catálogo |
| ------------------------- | ------ | ----------------- |
| Portal de notícia privada | 161    | 71,3%             |
| Portal de notícia pública | 15     | 6,6%              |
| Portal que não é notícia  | 9      | 4,0%              |
| Dataset, consulta ou API  | 41     | 18,1%             |
| Total                     | 226    | 100%              |


Entre as 176 notícias, 91,5% são privadas e 8,5% são públicas. O alvo do projeto, portal privado, é a maior família do catálogo inicial.

As 161 privadas se dividem pela maturidade da leitura:


| Situação do portal privado                          | Fontes | Parte dos privados |
| --------------------------------------------------- | ------ | ------------------ |
| Sugerida, vista no hub e ainda sem leitura contínua | 139    | 86,4%              |
| No inventário, página aberta, fora do scanner       | 14     | 8,7%               |
| No inventário, com captcha ou paywall               | 2      | 1,2%               |
| Fixa, na leitura contínua                           | 6      | 3,7%               |
| Total                                               | 161    | 100%               |


As seis fixas são Agência iNFRA, Portal BE News, MegaWhat, InfoMoney, Money Times e InvestNews. Nenhum dos 15 portais públicos entra nessa leitura. Os dois com barreira são CanalEnergia e a imprensa econômica.

Incluir as 139 muda a leitura do acervo. No inventário fechado, a imprensa privada era um quarto do catálogo e quase empatava com o órgão (22 contra 15). Com o hub, a imprensa privada passa a 71,3% de tudo e a onze vezes o bloco público. O órgão continua grande o bastante para poluir a fila se a classificação não separar a esfera, e pequeno demais para ser o centro da descoberta.

### 5.3 Papel no processo


| Papel                      | Fontes | Parte |
| -------------------------- | ------ | ----- |
| Primária, descoberta       | 180    | 79,6% |
| Secundária, enriquecimento | 37     | 16,4% |
| Índice de órgãos           | 5      | 2,2%  |
| Consulta pontual           | 4      | 1,8%  |
| Total                      | 226    | 100%  |


A descoberta domina porque cada portal sugerido já nasce como fonte primária. O enriquecimento permanece nas 37 bases secundárias do inventário. A rotina frequente tem muitas capas para peneirar. A rotina lenta, disparada pela ficha, continua pequena e estruturada. Índice não entra em nenhuma das duas.

### 5.4 Barreira de acesso


| Acesso                  | Fontes | Parte |
| ----------------------- | ------ | ----- |
| Público, sem credencial | 218    | 96,5% |
| Chave de API            | 5      | 2,2%  |
| Captcha ou paywall      | 2      | 0,9%  |
| Projeto em nuvem (GCP)  | 1      | 0,4%  |
| Total                   | 226    | 100%  |


As 139 sugeridas abrem sem senha. Quase todo o catálogo inicial pode ser lido. O limite é o volume de HTML e a falta de campo na notícia, não a credencial. Chave, paywall e GCP continuam fora da varredura.

### 5.5 Leitura

O catálogo inicial é um funil largo na boca e estreito na leitura contínua.

- 226 fontes, das quais 185 são portal e 161 são notícia privada.
- 139 dessas privadas chegaram no primeiro dia de hub e compõem o catálogo desde já, no estágio sugerida.
- 6 privadas estão na leitura contínua. As 15 públicas ficam fora dela.
- 41 fontes já nascem como tabela, API ou formulário e não passam pelo Jev.

A descoberta possível é larga: 161 capas privadas. A descoberta que já roda sozinha é estreita: 6 capas. O meio do funil, a prova, existe para subir sugerida sem mandar as 139 inteiras ao modelo generativo. A confirmação continua no bloco de 41 fontes estruturadas, com a chave que a notícia entregou.

## 6. Tabelas

O banco é Postgres. As tabelas ficam no schema `public`, com RLS ativo e sem policy para os papéis anônimo e autenticado. O processo local lê e grava pela connection string. As definições estão em `sql/001` a `sql/007`.

Sete tabelas cobrem o ciclo. A matéria repetida para na URL única de `candidato_projeto`. O projeto aprovado mora em `projeto`, e cada link que o sustenta mora em `evidencia`.

```text
fonte ────┬── candidato_projeto
          ├── evidencia ──── projeto
          ├── acesso_log
          └── (domínio) fonte_aparicao

ciclo_estado   uma linha só, o relógio da rotina
```

### 6.1 fonte

Cadastro de cada origem: portal, dataset, API ou consulta. Uma linha por veículo ou base.

| Coluna | Função |
| --- | --- |
| `codigo`, `nome`, `url_base` | Identidade e endereço de partida |
| `tipo` | `primaria` (descoberta) ou `secundaria` (enriquecimento) |
| `categoria` | Como o dado chega: `portal_web`, `dataset_download`, `base_consultavel`, `api_publica`, `api_privada` |
| `esfera_noticia` | `privada`, `publica` ou vazio quando não é notícia |
| `estagio`, `estagio_desde` | `sugerida`, `prova`, `fixa`, `aposentada`. Vazio fora do ciclo de notícia |
| `participa_scanner` | Liga a capa na varredura. No início, só as fixas |
| `papel_captura` | `descoberta`, `enriquecimento`, `lookup`, `indice` |
| `formato_dado` | `html`, `json_api`, `csv_zip`, `gis`, `formulario`, `pdf`, `misto` |
| `auth_acesso` | `nenhuma`, `chave`, `oauth`, `gcp`, `captcha_paywall` |
| `unidade_registro` | O que uma página ou linha representa (notícia, licença, usina) |
| `conteudo`, `peculiaridade` | O que a fonte publica e o cuidado operacional |
| `frequencia_projetos` | `baixa`, `media`, `alta`, `desconhecida` |
| `status_acesso`, `ultimo_erro`, `ultimo_acesso_em` | Saúde da última tentativa |
| `ativo` | Fora do catálogo operacional quando falso |

### 6.2 fonte_aparicao

Portal visto numa busca do hub. Não guarda manchete, link nem corpo.

| Coluna | Função |
| --- | --- |
| `dominio` | Host do veículo, sem `www` |
| `nome_portal` | Nome publicado pelo hub |
| `consulta` | Qual busca viu o domínio (`fabrica`, `anuncio`, `aporte`) |
| `visto_em` | Quando a observação ocorreu |

Três dias diferentes em quatorze, no mesmo domínio, autorizam a passagem de `sugerida` para `prova`.

### 6.3 candidato_projeto

Fila da matéria. A URL é única: a releitura não cria outra linha.

| Coluna | Função |
| --- | --- |
| `id_fonte`, `url`, `titulo`, `resumo` | De onde veio e o que a capa mostrou |
| `publicado_em` | Data da matéria, quando conhecida |
| `relevancia` | Pontuação da peneira de manchete |
| `dados_extraidos` | JSON da estruturação: nome, nicho, UF, município, empresa, valor, moeda, fase, esfera, país, resumo |
| `status` | `novo`, `analisado`, `aprovado`, `rejeitado`, `erro` |
| `erro` | Falha de leitura ou de modelo |
| `encontrado_em`, `analisado_em` | Quando entrou na fila e quando o modelo rodou |
| `rotulo_projeto` | `true` se a pessoa aprovou, `false` se rejeitou. É o rótulo de treino |
| `motivo_decisao`, `decidido_em` | Por que saiu da fila, e quando |
| `modelo_extracao` | Qual modelo estruturou |

Aprovar cria `projeto` e a `evidencia` primária na mesma transação. Rejeitar permanece nesta tabela.

### 6.4 projeto

Ficha do investimento, depois da aprovação. Nasce com a URL da notícia principal.

| Coluna | Função |
| --- | --- |
| `nome`, `nicho` | Título curto e setor |
| `uf`, `municipio` | Onde o ativo fica |
| `empresa_nome`, `cnpj` | Dona do investimento. CNPJ vem da resolução por nome (base própria ou API de cadastro) e é confirmado pela secundária. O modelo de texto nunca o preenche |
| `valor_capex`, `moeda` | Valor numérico e `BRL`, `USD` ou ausência |
| `valor_confianca` | `baixa` enquanto só a notícia sustenta o número. `alta` depois de base secundária |
| `status` | `rumor`, `anunciado`, `leilao`, `outorga`, `lp`, `li`, `construcao`, `operacao`, `cancelado` |
| `url_noticia_principal` | Link obrigatório da matéria que abriu a ficha |
| `id_fonte_principal` | Portal dessa matéria |

O casamento de duas matérias no mesmo projeto (empresa + município + nicho) usa estes campos. Ainda não há tabela separada de “proposta de fase”: a atualização de status, quando existir, grava aqui e deixa a matéria nova em `evidencia`.

### 6.5 evidencia

Cada link que sustenta o projeto. Notícia e base secundária convivem na mesma tabela, separadas por `papel`.

| Coluna | Função |
| --- | --- |
| `id_projeto`, `id_fonte` | Qual ficha e qual origem |
| `papel` | `primaria` (a notícia) ou `secundaria` (licença, contrato, financiamento) |
| `url` | Endereço obrigatório. Sem URL, a linha não existe |
| `titulo_ou_resumo`, `trecho` | O que a página disse |
| `campos_extraidos` | JSON do que aquela fonte acrescentou |
| `coletado_em` | Quando a evidência entrou |

### 6.6 acesso_log

Tentativa de leitura de uma fonte, inclusive a que falhou.

| Coluna | Função |
| --- | --- |
| `id_fonte`, `url` | O que se tentou abrir |
| `http_status`, `erro` | Resposta ou a falha (tempo esgotado, rede, bloqueio) |
| `em` | Quando |

Alimenta `fonte.status_acesso`. Fonte bloqueada por tempo demais sai do scanner e fica `aposentada`.

### 6.7 ciclo_estado

Uma linha só (`id = 1`). É o relógio da rotina semanal.

| Coluna | Função |
| --- | --- |
| `ultimo_scan_em` | Última varredura das capas fixas e da prova |
| `ultima_descoberta_em` | Última busca de portais no hub |
| `ultima_aposentadoria_em` | Última revisão de quem sai do scanner |
| `ultimo_resumo` | Frase curta do que a rodada fez |

Não há coluna de hash do corpo da página. A releitura por texto idêntico está no processo e ainda não tem campo. O que já impede repetir a matéria é a URL única em `candidato_projeto`.
