# Teste de monitoramento — Fase 1: esquema `capex_radar`

Aplicado no Supabase em 04/11/2026 pelas migrações [`sql/017_capex_radar.sql`](../../sql/017_capex_radar.sql) e [`sql/018_capex_radar_fontes.sql`](../../sql/018_capex_radar_fontes.sql). As duas são idempotentes, porque o deploy reaplica todos os arquivos.

## Tabelas

```
grupos ──< matrizes ──< filiais
  │           │            │
  └──< projetos >──────────┘   (matriz obrigatória, filial opcional)
          │
   evidencia_projeto  (IA sugere; revisão aceita ou rejeita)
          │
      evidencias >── fontes
```

| Tabela | Papel |
|---|---|
| `grupos` | Empresa observada (ex.: JBS), com nicho e ranking de origem. |
| `matrizes` | Raiz de CNPJ do grupo, com papel `principal`, `operacional`, `holding` ou `spe`. Um grupo pode ter várias (JBS + Seara, ODATA + SPEs). |
| `filiais` | Estabelecimentos da matriz, com endereço, código IBGE e coordenadas. |
| `projetos` | Fica na matriz até uma evidência apontar a filial. Estágio, tendência e `flag_validacao` seguem o esquema `radar`. `status` é a situação da ficha no radar: `ativo`, `em_revisao` ou `descartado`. |
| `evidencias` | Evidência bruta. `data_original` ordena a linha do tempo, `chave_dedupe` evita repetição e `conteudo_bruto` guarda o item original. `triagem`: `pendente`, `vinculada`, `novo_projeto` ou `descartada`. |
| `evidencia_projeto` | Vínculo com `origem` (`ia`, `manual`, `regra`), `situacao` (`sugerido`, `aceito`, `rejeitado`), confiança e modelo. |
| `fontes` | Fontes migradas, com `documentacao` (formato bruto + extração passo a passo). |
| `fonte_equivalencia` | Códigos antigos que viraram a mesma fonte (`cno` → `SEC-CNO`, `cetesb_sp` → `SEC-CETESB`, `cvm_ipe` → `SEC-CVM-IPE`). |
| `log_acao` | Auditoria automática de grupos, matrizes, projetos e vínculos. |

## Views

- `vw_projeto_timeline`: evidências aceitas de cada projeto, com fonte e marca de primária.
- `vw_carteira`: projeto com grupo, nicho, local (projeto → filial → matriz), valor, estágio e datas da primeira e da última evidência. É a base dos filtros da interface.
- `vw_fila_revisao`: vínculos sugeridos pendentes e evidências sem destino.

## Autoria

Toda escrita define o ator na transação, e o log registra quem fez o quê:

```sql
begin;
set local capex_radar.ator = 'agente:claude';   -- ou usuario:<nome>, ia:vinculo, sistema:coletor
update capex_radar.projetos set estagio = 'licenciamento' where id = '...';
commit;
```

Sem o ator, o log grava `sistema:desconhecido`.

## Fontes migradas

São 356 no total:

| Origem | Quantidade | Status |
|---|---|---|
| `public.fonte` (MVP) | 327 | 213 ativas, 95 pendentes (portais sugeridos), 12 desativadas, 7 quebradas |
| `radar.fontes` | 27 | Só as que ainda não existiam no MVP |
| `radar2.fontes` | 2 | Só as que ainda não existiam no MVP |

Cada linha guarda a original em `legado`, sob a chave do esquema de origem. Projetos e evidências antigos não foram migrados.
