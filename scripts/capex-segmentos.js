// Segmentos novos do Radar (Pontos de Melhora 23/11/2026, item 3): portos,
// telecom, varejo, têxtil, saúde, farmacêutico, química, automotivo,
// siderurgia, materiais de construção, máquinas, eletrônicos, borracha e
// plástico, bioenergia, mineração e madeira e móveis. Só empresas privadas.
//
//   listar   escolhe, em cada nicho de seeds/capex_radar/segmentos.json, as
//            maiores empresas pelo capital social no cnpj_db (matriz ativa,
//            porte "demais", natureza jurídica privada) que ainda não estão
//            no Radar, e propõe o nicho certo para os grupos 'industria' do
//            pré-cadastro do CNO. Escreve <pasta>/segmentos.json. Só lê.
//   aplicar  grava os grupos (ativos, com termos de busca), as matrizes e as
//            filiais ativas, e reclassifica os grupos do pré-cadastro.
//
// Uso:
//   npm run capex:segmentos -- listar --saida <pasta> [--por-nicho 12]
//   npm run capex:segmentos -- aplicar --arquivo <pasta>/segmentos.json [--seco]
//   npm run capex:segmentos -- marcas [--seco]   grava as marcas curtas de segmentos.json como termos de busca
const fs = require("node:fs");
const path = require("node:path");
const { pool } = require("../src/db");
const seg = require("../src/capex-segmentos");

const ATOR = "usuario:claude-code";

function argumentos(argv) {
  const [comando, ...resto] = argv;
  const args = { comando };
  for (let i = 0; i < resto.length; i += 1) {
    const chave = resto[i].replace(/^--/, "");
    args[chave] = resto[i + 1] && !resto[i + 1].startsWith("--") ? resto[++i] : true;
  }
  return args;
}

// Faixas de CNAE com muitas empresas pequenas (telecom, varejo) passam do
// limite padrão de 2 min: a consulta roda numa transação com limite maior.
async function consultaLonga(sql, params) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local statement_timeout = '600s'");
    const r = await client.query(sql, params);
    await client.query("commit");
    return r;
  } finally {
    client.release();
  }
}

async function listar(args) {
  if (!args.saida) throw new Error("Informe --saida <pasta>");
  fs.mkdirSync(args.saida, { recursive: true });
  const config = seg.carregar();
  const porNicho = Number(args["por-nicho"]) || config.por_nicho;
  const { rows: jaNoRadar } = await pool.query("select cnpj_basico from capex_radar.matrizes");
  const raizes = new Set(jaNoRadar.map((r) => r.cnpj_basico));
  // Grupos já curados (não os do pré-cadastro): o mesmo grupo econômico não entra de novo.
  const { rows: curados } = await pool.query("select nome from capex_radar.grupos where origem = 'curadoria'");
  // Nome inteiro, não a primeira palavra: "C.Vale" não pode barrar a Vale.
  const chavesNoRadar = new Set(curados.map((g) => g.nome.toLowerCase()));
  const grandes = (await consultaLonga(seg.SQL_GRANDES, [Number(args.capital) || 50e6])).rows;
  console.log(`${grandes.length} empresas privadas grandes no cnpj_db.`);
  const empresas = [];
  for (const [nicho, def] of Object.entries(config.nichos)) {
    if (!def.cnaes.length) continue;
    const escolhidas = [];
    const nomes = new Set();
    for (const r of grandes) {
      if (escolhidas.length >= porNicho) break;
      if (seg.nichoDoCnae(r.cnae_fiscal, config) !== nicho || raizes.has(r.cnpj_basico) || (config.excluir || []).includes(r.cnpj_basico)) continue;
      const grupo = (config.nomes || {})[r.cnpj_basico] || seg.nomeDoGrupo(r);
      // Uma empresa por grupo econômico (primeira palavra do nome): Atvos,
      // Fleury, Gerdau... ficam só na de maior capital.
      const chave = seg.chaveDoGrupo(grupo);
      if (nomes.has(chave) || chavesNoRadar.has(grupo.toLowerCase())) continue;
      nomes.add(chave);
      raizes.add(r.cnpj_basico);
      escolhidas.push({ nicho, grupo, ...r, capital: Number(r.capital), termos: seg.termosDaEmpresa(r, grupo) });
    }
    console.log(`${def.rotulo}: ${escolhidas.map((e) => e.grupo).join(", ")}`);
    empresas.push(...escolhidas);
  }
  // Grupos do pré-cadastro do CNO no nicho genérico: nicho pelo CNAE da matriz.
  const { rows: preCadastro } = await pool.query(
    `select g.id, g.nome, m.cnae from capex_radar.grupos g join capex_radar.matrizes m on m.grupo_id = g.id
      where g.origem = 'cno_prospeccao' and g.nicho = 'industria'`,
  );
  const reclassificar = preCadastro.map((g) => ({ id: g.id, nome: g.nome, cnae: g.cnae, nicho: seg.nichoDoCnae(g.cnae, config) }))
    .filter((g) => g.nicho !== "industria");
  fs.writeFileSync(path.join(args.saida, "segmentos.json"), JSON.stringify({ empresas, reclassificar }, null, 1));
  console.log(JSON.stringify({ empresas: empresas.length, reclassificar: reclassificar.length }));
}

async function aplicar(args) {
  if (!args.arquivo) throw new Error("Informe --arquivo <segmentos.json>");
  const { empresas, reclassificar } = JSON.parse(fs.readFileSync(args.arquivo, "utf8"));
  const contagem = {};
  for (const e of empresas) contagem[e.nicho] = (contagem[e.nicho] || 0) + 1;
  const porNichoRe = {};
  for (const g of reclassificar) porNichoRe[g.nicho] = (porNichoRe[g.nicho] || 0) + 1;
  if (args.seco) {
    console.log(JSON.stringify({ grupos_novos: empresas.length, por_nicho: contagem, reclassificados: reclassificar.length, para: porNichoRe }), "(seco: nada gravado)");
    return;
  }
  const painel = require("../src/capex-painel-db");
  const { gravarTermos } = require("../src/capex-segmentos");
  const resumo = await painel.emTransacao(async (client) => {
    let grupos = 0;
    let termos = 0;
    for (const e of empresas) {
      const { rows: [g] } = await client.query(
        `insert into capex_radar.grupos (nome, nicho, ranking, controle, subsetor, notas, origem, ativo)
         values ($1, $2, $3, 'privada', $4, $5, 'curadoria', true)
         -- Empresa que já entrou pelo pré-cadastro do CNO (inativa) passa a monitorada.
         on conflict (nome) do update set ativo = true, origem = 'curadoria', nicho = excluded.nicho, ranking = excluded.ranking
           where capex_radar.grupos.origem = 'cno_prospeccao'
         returning id`,
        [e.grupo, e.nicho, { fonte: "cnpj_db", metrica: "capital social", valor: e.capital }, e.cnae_descricao || null,
          `Segmento ${e.nicho} (23/11/2026): maior capital social do CNAE no cnpj_db.`],
      );
      if (!g) continue;
      grupos += 1;
      await client.query(
        `insert into capex_radar.matrizes (cnpj, grupo_id, papel, razao_social, nome_fantasia, natureza_juridica, cnae, uf, municipio)
         values ($1, $2, 'principal', $3, $4, $5, $6, $7, $8) on conflict (cnpj) do nothing`,
        [e.cnpj, g.id, e.razao_social, e.nome_fantasia || null, e.natureza_juridica, e.cnae_fiscal, e.uf, e.municipio || null],
      );
      termos += await gravarTermos(client, g.id, e.termos);
    }
    for (const r of reclassificar) {
      await client.query("update capex_radar.grupos set nicho = $2, atualizado_em = now() where id = $1 and nicho = 'industria'", [r.id, r.nicho]);
    }
    // Filiais ativas das matrizes novas (mesma cópia da carga de empresas).
    const filiais = await client.query(seg.SQL_FILIAIS, [empresas.map((e) => e.cnpj_basico)]);
    return { grupos, termos, filiais: filiais.rowCount, reclassificados: reclassificar.length };
  }, ATOR);
  console.log(JSON.stringify(resumo));
}

/**
 * Grava as marcas curtas de segmentos.json ("marcas": {grupo: [termo]}) como
 * termos de busca do tipo marca. Termos que já existem ficam. --seco só conta.
 */
async function marcas(args) {
  const config = seg.carregar();
  const lista = Object.entries(config.marcas || {});
  const painel = require("../src/capex-painel-db");
  const { rows: grupos } = await pool.query("select id, nome from capex_radar.grupos where nome = any($1)", [lista.map(([nome]) => nome)]);
  const porNome = new Map(grupos.map((g) => [g.nome, g.id]));
  const faltam = lista.filter(([nome]) => !porNome.has(nome)).map(([nome]) => nome);
  if (args.seco) {
    console.log(JSON.stringify({ grupos: porNome.size, termos: lista.reduce((t, [, m]) => t + m.length, 0), faltam }), "(seco: nada gravado)");
    return;
  }
  const gravados = await painel.emTransacao(async (client) => {
    let n = 0;
    for (const [nome, termos] of lista) {
      const id = porNome.get(nome);
      if (!id) continue;
      n += await seg.gravarTermos(client, id, { marca: termos });
    }
    return n;
  }, ATOR);
  console.log(JSON.stringify({ grupos: porNome.size, termos_novos: gravados, faltam }));
}

async function main() {
  const args = argumentos(process.argv.slice(2));
  const comandos = { listar, aplicar, marcas };
  if (!comandos[args.comando]) throw new Error(`Comandos: ${Object.keys(comandos).join(", ")}`);
  await comandos[args.comando](args);
}

main()
  .catch((error) => {
    console.error(`Falha: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
