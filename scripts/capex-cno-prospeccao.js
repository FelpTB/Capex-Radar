// Prospecção pelo CNO: obras de galpão industrial com mais de 5.000 m² dos
// últimos 3 anos, de indústria privada, viram projetos em pré-cadastro
// (src/cno-prospeccao.js).
//
//   listar   lê a base local do CNO, confirma CNAE e natureza jurídica pela
//            BrasilAPI (cache em data/cache/cnpj) e escreve
//            <pasta>/candidatos.json. Só lê o banco (para marcar o que já
//            está no Radar).
//   aplicar  cria grupo (se a empresa não está no Radar), matriz, projeto
//            "em revisão" com origem cno_prospeccao e a obra como evidência.
//            Obras da mesma empresa no mesmo município viram um projeto.
//
// Uso:
//   npm run capex:cno-prospeccao -- listar --saida <pasta> [--area 5000] [--anos 3] [--limite N]
//   npm run capex:cno-prospeccao -- aplicar --arquivo <pasta>/candidatos.json [--seco]
const fs = require("node:fs");
const path = require("node:path");
const { pool } = require("../src/db");
const prosp = require("../src/cno-prospeccao");

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

async function listar(args) {
  if (!args.saida) throw new Error("Informe --saida <pasta>");
  fs.mkdirSync(args.saida, { recursive: true });
  const anos = Number(args.anos) || prosp.ANOS;
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - anos);
  const desde = d.toISOString().slice(0, 10);
  console.log(`Lendo o CNO: galpão industrial >= ${Number(args.area) || prosp.AREA_MINIMA} m² desde ${desde}...`);
  let obras = await prosp.obrasCandidatas({ desde, areaMinima: Number(args.area) || prosp.AREA_MINIMA });
  console.log(`${obras.length} obras no porte e no período.`);
  if (args.limite) obras = obras.slice(0, Number(args.limite));

  // O que já está no Radar: obra já analisada para um projeto e empresas já cadastradas.
  const { rows: jaAnalisadas } = await pool.query(
    `select distinct registro->>'cno' as cno from capex_radar.registros_analisados
      where fonte_codigo = 'SEC-CNO' and classe in ('certeira', 'provavel')`,
  );
  const noRadar = new Set(jaAnalisadas.map((r) => String(r.cno).padStart(12, "0")));
  const { rows: matrizes } = await pool.query("select m.cnpj_basico, g.id, g.nome from capex_radar.matrizes m join capex_radar.grupos g on g.id = m.grupo_id");
  const grupoPorRaiz = new Map(matrizes.map((m) => [m.cnpj_basico, { id: m.id, nome: m.nome }]));

  const candidatos = [];
  const resumo = { obras: obras.length, consultas: 0, industriais: 0, ja_no_radar: 0, sem_cnpj_industrial: 0 };
  for (const [i, obra] of obras.entries()) {
    const cadastros = [];
    for (const cnpj of prosp.cnpjsDaObra(obra)) {
      try {
        cadastros.push(await prosp.consultarCnpj(cnpj));
        resumo.consultas += 1;
      } catch (error) {
        console.error(`CNPJ ${cnpj}: ${error.message}`);
      }
      const c = cadastros[cadastros.length - 1];
      if (c && prosp.ehIndustrial(c.cnae) && prosp.ehPrivada(c.natureza_codigo)) break;
    }
    const empresa = prosp.empresaIndustrial(cadastros);
    if ((i + 1) % 200 === 0) console.log(`${i + 1}/${obras.length} obras lidas; ${resumo.industriais} de indústria.`);
    if (!empresa) { resumo.sem_cnpj_industrial += 1; continue; }
    resumo.industriais += 1;
    const ja = noRadar.has(String(obra.cno).padStart(12, "0"));
    if (ja) resumo.ja_no_radar += 1;
    candidatos.push({
      cno: obra.cno, ja_no_radar: ja, grupo_existente: grupoPorRaiz.get(empresa.cnpj.slice(0, 8)) || null,
      empresa, projeto: prosp.projetoDaObra(obra, empresa), obra,
    });
  }
  fs.writeFileSync(path.join(args.saida, "candidatos.json"), JSON.stringify(candidatos, null, 1));
  const porNicho = {};
  for (const c of candidatos) porNicho[c.projeto.nicho] = (porNicho[c.projeto.nicho] || 0) + 1;
  console.log(JSON.stringify({ ...resumo, por_nicho: porNicho, empresas: new Set(candidatos.map((c) => c.empresa.cnpj.slice(0, 8))).size }));
}

/** Grupo da empresa: o que já tem a raiz do CNPJ, ou um novo (origem cno_prospeccao). */
async function grupoDaEmpresa(client, c) {
  const raiz = c.empresa.cnpj.slice(0, 8);
  const { rows: [m] } = await client.query("select cnpj, grupo_id from capex_radar.matrizes where cnpj_basico = $1", [raiz]);
  if (m) return { grupo_id: m.grupo_id, matriz_cnpj: m.cnpj, novo: false };
  let nome = c.projeto.grupo;
  const { rows: [homonimo] } = await client.query("select id from capex_radar.grupos where nome = $1", [nome]);
  if (homonimo) nome = `${nome} (${raiz})`;
  const { rows: [g] } = await client.query(
    `insert into capex_radar.grupos (nome, nicho, origem, subsetor, notas)
     values ($1, $2, 'cno_prospeccao', $3, $4) returning id`,
    [nome, c.projeto.nicho, c.empresa.cnae_descricao || null, `Achada pela obra ${c.cno} no CNO (pré-cadastro, a validar).`],
  );
  const matriz = prosp.cnpjDaMatriz(raiz);
  await client.query(
    `insert into capex_radar.matrizes (cnpj, grupo_id, razao_social, nome_fantasia, natureza_juridica, cnae, uf, municipio)
     values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (cnpj) do nothing`,
    [matriz, g.id, c.empresa.razao_social || nome, c.empresa.nome_fantasia || null, c.empresa.natureza || null, c.empresa.cnae || null, c.empresa.uf || null, c.empresa.municipio || null],
  );
  return { grupo_id: g.id, matriz_cnpj: matriz, novo: true };
}

async function aplicar(args) {
  if (!args.arquivo) throw new Error("Informe --arquivo <candidatos.json>");
  const seco = Boolean(args.seco);
  const painel = require("../src/capex-painel-db");
  const sec = require("../src/capex-fontes-secundarias");
  const perfis = require("../src/capex-perfil");
  // O projeto é refeito da obra e da empresa: a regra de nome e título pode ter mudado depois da listagem.
  const candidatos = JSON.parse(fs.readFileSync(args.arquivo, "utf8")).filter((c) => !c.ja_no_radar)
    .map((c) => ({ ...c, projeto: prosp.projetoDaObra(c.obra, c.empresa) }));
  // Um projeto por empresa e município; a obra mais antiga dá a data.
  const porProjeto = new Map();
  for (const c of candidatos) {
    const k = `${c.empresa.cnpj.slice(0, 8)}|${c.projeto.uf}|${c.projeto.municipio}`;
    if (!porProjeto.has(k)) porProjeto.set(k, []);
    porProjeto.get(k).push(c);
  }
  const resumo = { projetos: 0, obras: 0, grupos_novos: 0, ja_existentes: 0 };
  if (seco) {
    resumo.projetos = porProjeto.size;
    resumo.obras = candidatos.length;
    resumo.grupos_novos = new Set(candidatos.filter((c) => !c.grupo_existente).map((c) => c.empresa.cnpj.slice(0, 8))).size;
    console.log(`${JSON.stringify(resumo)} (seco: nada gravado)`);
    return;
  }
  const fontes = await sec.nomesDasFontes(pool);
  for (const obras of porProjeto.values()) {
    obras.sort((a, b) => String(a.obra.inicio).localeCompare(String(b.obra.inicio)));
    const c = obras[0];
    const projeto = await painel.emTransacao(async (client) => {
      const g = await grupoDaEmpresa(client, c);
      if (g.novo) resumo.grupos_novos += 1;
      // Pré-cadastro já criado antes para a mesma empresa e município: reaproveita.
      const { rows: [existente] } = await client.query(
        `select id, titulo, grupo_id from capex_radar.projetos
          where grupo_id = $1 and origem = 'cno_prospeccao' and uf = $2 and municipio = $3 and status <> 'descartado'`,
        [g.grupo_id, c.projeto.uf, c.projeto.municipio],
      );
      if (existente) { resumo.ja_existentes += 1; return existente; }
      const area = obras.reduce((t, o) => t + o.obra.area_obra, 0);
      const titulo = obras.length > 1 ? c.projeto.titulo.replace(/de [\d.,]+ (mil|milhão) m²/, `(${obras.length} obras, ${Math.round(area / 1000).toLocaleString("pt-BR")} mil m²)`) : c.projeto.titulo;
      const { rows: [p] } = await client.query(
        `insert into capex_radar.projetos
           (titulo, grupo_id, matriz_cnpj, uf, municipio, objeto, estagio, status, flag_validacao, data_anuncio, data_anuncio_origem, origem)
         values ($1, $2, $3, $4, $5, $6, $7, 'em_revisao', 'A_VALIDAR', $8, 'cno', 'cno_prospeccao')
         returning id, titulo, grupo_id`,
        [`${c.projeto.grupo} — ${titulo}`.slice(0, 300), g.grupo_id, g.matriz_cnpj, c.projeto.uf, c.projeto.municipio, c.projeto.objeto, c.projeto.estagio, c.projeto.data_anuncio],
      );
      resumo.projetos += 1;
      return p;
    }, ATOR);
    for (const o of obras) {
      const linha = { ...o.obra, origem_cno: "raiz" };
      await sec.gravarRegistros(projeto, "SEC-CNO", [{ ...linha, correlacao: "Pré-cadastro: obra da própria empresa no CNO." }], fontes.get("SEC-CNO"), "claude-code");
      await sec.gravarAnalisados(pool, projeto.id, [{
        codigo: "SEC-CNO", linha, correlacao: "direta", probabilidade: 90,
        motivo: `Pré-cadastro: obra de galpão industrial de ${Math.round(o.obra.area_obra).toLocaleString("pt-BR")} m² em nome da própria empresa (${o.empresa.cnae_descricao || "indústria"}).`,
      }], ATOR);
      resumo.obras += 1;
    }
    await painel.emTransacao((client) => perfis.montarPerfil(client, projeto.id), ATOR).catch(() => null);
  }
  console.log(JSON.stringify(resumo));
}

async function main() {
  const args = argumentos(process.argv.slice(2));
  const comandos = { listar, aplicar };
  if (!comandos[args.comando]) throw new Error(`Comandos: ${Object.keys(comandos).join(", ")}`);
  await comandos[args.comando](args);
}

main()
  .catch((error) => {
    console.error(`Falha: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
