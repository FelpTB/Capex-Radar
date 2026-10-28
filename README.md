# Radar CapEx — MVP

Aplicação local para prospectar projetos de investimento a partir de notícias e
enriquecê-los com fontes oficiais.

## Estrutura do repositório

| Pasta | Conteúdo |
| --- | --- |
| `src/` | API Express, coleta, enriquecimento, guias e páginas `/fontes` |
| `sql/` | Migrações Postgres (Supabase) |
| `scripts/` | `migrate`, `seed`, sincronismo dados.gov e cargas |
| `amostras/` | Amostras brutas por código de fonte + `LEIA.txt` |
| `docs/` | Processo de identificação e enriquecimento |
| `test/` | Testes (`npm test`) |
| `public/` | Estilos do dashboard |
| `data/` | Cache e bases baixadas localmente (não versionado) |

Regra do projeto para novas fontes: `.cursor/rules/amostra-fonte.mdc`.

## Stack

- Node.js + Express
- Supabase/Postgres
- OpenAI para extração assistida
- Railway (Nixpacks: Node 20+ e Python 3.12 para algumas cargas)

## Deploy no Railway

1. Crie um serviço a partir do repositório [FelpTB/Capex-Radar](https://github.com/FelpTB/Capex-Radar.git) (ou conecte este clone).
2. O build usa `nixpacks.toml`: Node 22 do provider Node e Python 3.12 com um venv em `/opt/venv`, onde `requirements.txt` instala `openpyxl` e `py7zr` (cargas ONS/ARTESP). `PYTHON_BIN` aponta para esse venv.
3. Em **Variables**, configure (mesmo projeto Supabase do local):

   | Variável | Obrigatória | Notas |
   | --- | --- | --- |
   | `SUPABASE_STRING` | sim | URI Postgres; preferir pooler `:6543` |
   | `OPENAI_API_KEY` | sim | Extração e decisão de empresa |
   | `OPENAI_MODEL` | não | Default `gpt-4.1-mini` |
   | `OPENAI_DECISION_MODEL` | não | Opcional |
   | `TOKEN_DADOS_GOV` | não | Catálogo dados.gov.br |
   | `NODE_ENV` | recomendado | `production` |
   | `DISABLE_SCHEDULER` | não | `1` para desligar ciclo semanal |

   Não defina `PORT` no painel — o Railway injeta automaticamente.

4. Cada deploy roda `npm run db:migrate` (`preDeployCommand` em `railway.toml`) e sobe com `npm start`.
5. Rode **uma vez** o seed no Supabase (SQL Editor ou máquina local com `.env`):

   ```bash
   npm run db:seed
   ```

   O índice de PDFs dos diários de PA, PB, RO e RR fica no banco (`doe_pdf_*`). O agendador relê os últimos 7 dias todo dia; para histórico maior, rode a carga uma vez: `npm run doe:pdf-sync -- --dias 90`.

6. Smoke: `GET /health` (200 + `database: ok`), depois `/projetos` e `/fontes`.

O disco do container é efêmero: `data/cache` é recriado quando uma carga baixa arquivos de novo. Bases grandes (CNO nacional) não vão no git — use volume local ou carga sob demanda.

## Executar localmente

1. Copie `.env.example` para `.env` e preencha as credenciais.
2. Aplique e carregue a base:

   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   ```

3. Inicie:

   ```bash
   npm start
   ```

4. Abra:
   - Projetos: <http://localhost:3000/projetos>
   - Fontes: <http://localhost:3000/fontes>
   - Captura: <http://localhost:3000/captura>
   - Saúde: <http://localhost:3000/health>

O desenho completo da identificação (busca, extração, classificação, estruturação, enriquecimento e releitura) e a leitura das fontes atuais estão em [docs/processo-identificacao.md](docs/processo-identificacao.md).

Formato bruto, chamadas, passo a passo da extração e regra de correlação das fontes estaduais e municipais: [docs/fontes-estaduais-municipais.md](docs/fontes-estaduais-municipais.md), gerado por `npm run docs:fontes`.

Os diários oficiais das 27 UFs, um por seção, estão em [docs/diarios-oficiais-estaduais.md](docs/diarios-oficiais-estaduais.md), gerado por `npm run docs:doe`. PA, PB, RO e RR não têm busca no portal: o Radar indexa os PDFs das edições. Carga inicial ou reposição:

```bash
npm run doe:pdf-sync -- --dias 90          # as quatro UFs
npm run doe:pdf-sync -- --dias 30 --uf RO  # uma UF
```

Com o servidor no ar, o agendador relê os últimos 7 dias uma vez por dia.

## Fluxo do piloto

1. Abra **Prospectar** e clique em **Buscar novos projetos**.
2. O scanner visita as fontes fixas de notícia privada (Agência iNFRA, Portal
   BE News, MegaWhat, InfoMoney, Money Times e InvestNews), filtra links de
   CapEx e estrutura os candidatos. As demais fontes ficam no catálogo. A
   varredura automática, no início, repete esse ciclo uma vez por semana,
   sem cota diária. O hub de notícias só registra portal novo.
3. Abra a notícia e marque **Aprovar projeto** ou **Não aprovar**. A aprovação
   grava projeto e evidência primária na mesma transação; ambas as decisões
   permanecem como rótulo de treinamento.
4. Na ficha, adicione evidências secundárias e, quando aplicável, atualize o
   status.

### Identificação da empresa

A notícia passa por duas etapas:

1. regras determinísticas extraem termos próprios que podem representar
   organizações (marcadores como `empresa`, razão social, siglas e sujeito de
   verbos de investimento);
2. um modelo de decisão recebe o texto e essa lista fechada, podendo escolher
   apenas uma das opções ou `null`.

A decisão registra opções, confiança, justificativa, trecho literal e modelo.
Use `OPENAI_DECISION_MODEL` para configurar um modelo diferente do extrator.
A escolha continua sujeita à revisão humana e ainda não confirma CNPJ.

O modelo não confirma CNPJ nem valor oficial. Esses dados só ganham confiança
alta após uma fonte secundária.

Nenhuma notícia prospectada é apagada: aprovações e rejeições ficam no
**Histórico de treino**, com motivo e versão do modelo. O histórico pode ser
exportado como JSONL em `/api/treino/candidatos.jsonl`.

## Segurança

- `.env` não entra no git.
- `SUPABASE_STRING` e `OPENAI_API_KEY` ficam somente no backend.
- As tabelas têm RLS e não possuem policies para acesso direto de
  `anon`/`authenticated`.
- Não exponha a URI do banco no frontend ou em logs.

Requisitos completos: [`requisitos.txt`](requisitos.txt).
