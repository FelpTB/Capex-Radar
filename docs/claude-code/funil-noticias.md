# Funil de notícias pelo Claude Code

Você faz, de uma vez, o trabalho das fases de IA do funil do Radar CapEx: leitura da manchete (Filtro 1), definição rígida de CapEx e fato repetido (Filtro 2), leitura da matéria (Enriquecimento), veredito final (Filtro 3) e a decisão do agente (criar projeto, vincular ou descartar). O radar acompanha OBRAS de empresas privadas no Brasil (fábricas, ampliações, linhas, centros de distribuição, galpões, data centers) para achar oportunidades de fornecimento.

## Arquivos da pasta

- `_criterios.md`: os prompts que as fases automáticas usam (definição de CapEx, o que é repetição, motivos válidos, estágios). **Leia antes de começar** e siga esses critérios.
- `_indice.json`: as empresas exportadas e quantas notícias cada uma tem.
- `<empresa>.json`, um por empresa:
  - `empresa`, `nicho`, `matriz`, `termos`: quem é o grupo;
  - `projetos`: os projetos já cadastrados (id, título, objeto, local, estágio, valor, data do anúncio e até 3 manchetes);
  - `noticias`: as notícias a decidir (id, data, título, veículo, link do Google News, `leitura_previa` da triagem automática quando houver, `sugestoes` de vínculo);
  - `manchetes_proximas`: notícias do grupo já decididas em ±120 dias, com a situação (projeto, descartada). Servem para achar repetições e o projeto certo.

## Como decidir cada notícia

1. Leia a manchete com os critérios. Descarte direto o que claramente não é obra (resultado, ação, produto, marketing, executivo, outra empresa, fora do Brasil, plano geral de investimentos sem ativo e local).
2. Repetição: se a mesma obra e o mesmo fato já estão numa manchete mantida (`manchetes_proximas` com situação "projeto: ..." ou outra notícia deste lote que você manteve), descarte com `repetida` e `repete_id`, **a não ser** que traga fato novo (licença, financiamento, início de obra, inauguração, atraso) — fato novo do mesmo projeto é `vincular`.
3. Para o que parece obra, leia a matéria quando houver dúvida ou para completar local, valor e estágio: busque a manchete na web e abra a matéria original (o link do Google News em geral não abre). Uma busca e uma leitura por notícia bastam; sem matéria, decida pela manchete e deixe `materia` com `encontrou: false`.
4. Decida:
   - `vincular` quando for o mesmo ativo de um projeto da lista (mesmo objeto e local, ou referência clara). Use `projeto_id` do arquivo, ou `ref:<x>` de um projeto que você criou neste mesmo lote.
   - `criar_projeto` quando for uma obra nova ou expansão com obra que ainda não está na lista. Dê `projeto` (título curto sem o nome da empresa, objeto, UF, município, valor, estágio, data do fato) e um `ref` se outras notícias do lote forem dele. Projeto filho (expansão, subprojeto, localidade) leva `projeto_pai_id` e `relacao`.
   - `descartar` com um motivo válido.
5. Na dúvida entre manter e descartar, descarte — cada notícia mantida vira trabalho de um analista. Projetos criados nascem "em revisão" e são confirmados no painel.

## Saída

Escreva `decisoes.json` na pasta: uma lista com UM objeto por notícia exportada, de todas as empresas.

```json
[
  {
    "evidencia_id": "<id da notícia>",
    "decisao": "criar_projeto | vincular | descartar",
    "motivo": "<código válido: obra_nova, expansao, mesmo_projeto, ou um motivo de descarte de _criterios.md>",
    "justificativa": "frase curta e concreta",
    "confianca": 80,
    "repete_id": "<id da notícia repetida, só com motivo repetida>",
    "fato": "rótulo curto do fato (ex.: anúncio da fábrica de Ituiutaba)",
    "leitura": { "objeto": "...", "uf": "MG", "municipio": "...", "valor_brl": 1000000000, "estagio": "anuncio", "data_fato": "2026-10-24", "ampla": false },
    "materia": {
      "encontrou": true,
      "url_original": "https://...",
      "veiculo_original": "...",
      "resumo": "3 a 5 frases do que a matéria diz",
      "perfil": { "objeto": "...", "uf": "MG", "municipio": "...", "valor_brl": 1000000000, "estagio": "anuncio", "empregos": 200, "capacidade": "...", "construtora": null, "inicio_obra": null, "previsao_operacao": "2028" },
      "trechos": ["até 3 trechos copiados da matéria"]
    },
    "projeto_id": "<só em vincular>",
    "ref": "<só em criar_projeto, se outras notícias forem vinculadas a ele>",
    "projeto": { "titulo": "fábrica de fórmulas infantis em Ituiutaba", "objeto": "...", "uf": "MG", "municipio": "Ituiutaba", "valor_brl": 1000000000, "estagio": "anuncio", "data_fato": "2026-10-24", "projeto_pai_id": null, "relacao": null }
  }
]
```

- `materia` é opcional; sem leitura, omita.
- Valores em reais por extenso (R$ 1,2 bilhão = 1200000000); UF em sigla; estágio entre os de `_criterios.md`.
- Use só ids dos arquivos. Não rode scripts do projeto nem acesse o banco.

## Depois

Quem coordena roda `npm run capex:funil -- aplicar --arquivo <pasta>/decisoes.json --seco` (valida tudo, não grava) e, sem erros, sem `--seco`. Os projetos tocados ganham marcos provisórios; a linha do tempo definitiva é feita com `docs/claude-code/linha-do-tempo.md`.
