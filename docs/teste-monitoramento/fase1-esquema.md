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

## Carga das empresas

Feita em 04/11/2026 com `npm run capex:carga-empresas` ([`scripts/capex-carga-empresas.js`](../../scripts/capex-carga-empresas.js)), que lê o seed da Fase 0 e grava tudo numa transação com o ator `sistema:carga-fase0`. Rodar de novo atualiza os campos e insere o que faltar.

| Nicho | Grupos | Raízes (matrizes) | Estabelecimentos ativos (filiais) |
|---|---|---|---|
| Alimentos e Bebidas | 20 | 26 | 2.394 |
| Datacenters | 5 | 18 | 94 |
| E-commerce | 6 | 7 | 3.280 |
| Papel e Celulose | 7 | 13 | 1.241 |
| **Total** | **38** | **64** | **7.009** |

- **Matrizes:** a do seed entra como `principal`. As 27 relacionadas têm só a raiz no seed; o CNPJ completo vem do estabelecimento matriz no `cnpj_db`. O papel é deduzido da razão social: `holding` (HOLDING, PARTICIPACOES), `spe` (campus de datacenter: ODATA SP/SAMPA/RJ, Equinix Hyperscale, Elea SP1) ou `operacional`.
- **Filiais:** todos os estabelecimentos com situação 02 de cada raiz, inclusive a sede, porque a planta pode ser o próprio estabelecimento matriz (Cenibra em Belo Oriente, Bracell em Lençóis Paulista).
- **Shein:** grupo criado sem matriz, até o CNPJ ser localizado.
- **Código IBGE:** fica vazio. O `cnpj_db` só tem o código de município da Receita, sem tabela de equivalência com o IBGE.
