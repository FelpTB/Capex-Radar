# Diagnóstico das fontes secundárias pelo Claude Code

Objetivo: explicar, fonte por fonte, por que ela não gera evidência ou gera pouca, e o que fazer. O resultado aparece em **Hub de fontes › Por que não aproveita** (`/fontes/hub/diagnostico`).

## Como rodar

```bash
npm run capex:diagnostico-fontes -- exportar --saida <pasta>
```

O comando só lê o banco e escreve `<pasta>/_fontes.json`:

- `categorias`: o que cada categoria de perda quer dizer (`aproveitado`, `possibilidade`, `outra_uf`, `sem_municipio`, `fora_periodo`, `sem_ligacao`, `outro_ato`, `nao_avaliado`);
- `fontes`: uma por fonte, com `consultas` (projetos em que a busca rodou), `total` (registros analisados), a contagem por categoria e `amostras`: até 4 registros de cada categoria, com o projeto, a classe, o motivo gravado e o registro bruto resumido.

## Como analisar

Para cada fonte, leia as contagens e as amostras e responda:

1. Onde está a maior perda e se ela é **estrutural** (a fonte não tem como servir a estes projetos: setor diferente, busca pelo CNPJ que traz o país inteiro, ato sem obra) ou **corrigível** (filtro de UF ou de período que poderia ir para a consulta, pré-triagem que descarta registro bom, julgamento errado nas amostras).
2. Se as amostras descartadas estão certas. Aponte qualquer registro que parece do projeto e foi perdido.
3. Fonte consultada sem nenhum retorno: diga se é esperado (os grupos monitorados não atuam no setor da fonte) ou sinal de busca quebrada.

## Saída

Escreva `docs/diagnostico-fontes.json` no repositório:

```json
{
  "em": "2026-11-23",
  "resumo": ["2 a 4 parágrafos curtos com o quadro geral"],
  "fontes": {
    "SEC-ANA-SNIRH": {
      "explicacao": "2 a 4 frases: onde se perde e por quê, com números das contagens.",
      "recomendacao": "1 ou 2 frases: o que fazer (ou 'nada: perda esperada')."
    }
  }
}
```

Uma entrada por fonte do `_fontes.json`. Escreva em português simples, para o analista que não conhece o código.
