# Passo 3 do reprocessamento: linha do tempo de cada projeto

Você monta a linha do tempo de projetos de CapEx privado no Brasil, para um radar de oportunidades de obra. Cada arquivo `<projeto_id>.json` da sua pasta é um projeto, com:
- `projeto`: os dados atuais (título, objeto, local, valor, estágio, data do anúncio, projeto pai e relação);
- `noticias`: as evidências aceitas, em ordem de data. Itens com `fonte` "notícia: ..." são notícias (com a leitura da manchete e, quando há, a matéria lida em `materia`); itens com `fonte` "registro: ..." são registros oficiais (diário oficial, BNDES, CNO, licença, ANEEL...) com o texto em `texto_registro`;
- `outros_projetos_do_grupo`: os projetos irmãos (para não confundir fatos de outra obra).

Para CADA projeto do lote, monte:

1. **marcos** em ordem cronológica: anúncio, licença (prévia, instalação, operação, outorga, alvará), financiamento, compra de terreno, contratação de construtora/EPC, início e andamento de obra, entrada em operação/inauguração, atraso, suspensão ou cancelamento. Junte num marco só as evidências que contam o mesmo fato. Use só o que as evidências dizem; não invente datas. A data do marco é a do fato quando o texto a traz; senão, a da evidência mais antiga do marco (AAAA-MM-DD, AAAA-MM ou AAAA). Cada marco lista os ids das evidências que o sustentam. Tipos: anuncio, licenca, financiamento, terreno, contratacao, obra, operacao, atraso, cancelamento, outro.
   - Todo projeto tem pelo menos um marco. O primeiro marco de anúncio é a data do anúncio do projeto.
   - Registro oficial que é de outra obra (outra unidade, obra antiga já concluída) NÃO vira marco: deixe-o fora da linha (ele será revisto).
   - Fato da obra antiga quando o projeto é expansão (o pai) não entra: a linha é deste projeto.
2. **resumo**: 3 a 5 frases em português: o que é o projeto, onde, quanto, em que pé está e qual o próximo passo esperado. Diga quando há licença ou financiamento encontrados em fonte oficial.
3. **estagio** atual: um de anuncio, licenciamento, funding, contratacao_epc, mobilizacao, operacao, desaceleracao, cancelado.

## Saída
Escreva na pasta do lote `decisoes.json`: uma lista com um objeto por projeto do lote, TODOS os projetos:

```json
[
  {
    "projeto_id": "...",
    "linha_tempo": {
      "resumo": "...",
      "estagio": "mobilizacao",
      "marcos": [{ "data": "2024-03-10", "marco": "frase curta", "tipo": "anuncio", "evidencias": ["<id>"] }]
    },
    "fora": ["<id de registro oficial que é de outra obra>"]
  }
]
```

`fora` lista só os registros oficiais ("registro: ...") que você deixou fora da linha por serem de outra obra; eles saem do projeto. Notícias nunca vão em `fora`.

Use só ids que aparecem nos arquivos. Não acesse banco, rede nem outros arquivos, e não rode scripts. Ao terminar, responda com um resumo curto: quantos projetos, quantos marcos no total, quantos projetos com licença ou financiamento em fonte oficial, e registros oficiais que você deixou fora da linha por parecerem de outra obra (projeto e id).

## Obras do CNO (novas nesta rodada)
Estes projetos acabaram de ganhar matrículas do Cadastro Nacional de Obras ("registro: SEC-CNO"), já julgadas por um especialista como ligadas ao projeto. No título vem o código da situação depois do nome (`· 02 ·` ativa, `· 15 ·` encerrada, `· 01 ·` nula, `· 03 ·` suspensa, `· 14 ·` paralisada); no texto vêm `inicio`, `area`, `areas` (obra nova, acréscimo, reforma, demolição) e, quando cabe, `data_situacao`.
- Cada matrícula gera o marco "obra iniciada (CNO)" na data de `inicio` (tipo `obra`), dizendo o que é (galpão de X m², subestação, demolição do terreno...). Matrículas que contam a mesma obra podem ir no mesmo marco.
- Matrícula encerrada (15) gera também o marco "obra encerrada no CNO" (tipo `operacao` se não houver notícia de inauguração depois; senão tipo `obra`) na `data_situacao` quando ela aparece; se o texto veio cortado sem a data, use só o marco de início e diga no resumo que a matrícula consta como encerrada.
- Só ponha uma matrícula do CNO em `fora` se for claramente de outra obra (outra unidade, ou concluída anos antes do anúncio sem relação). Na dúvida, mantenha.
- Revise o estágio com o CNO: obra ativa iniciada → pelo menos `mobilizacao`; matrícula encerrada após o anúncio sem notícia de operação → `operacao` só se o porte for o do projeto, senão `mobilizacao`.
