// Carrega as empresas do teste de monitoramento no esquema capex_radar.
//
// Lê seeds/capex_radar/empresas-teste.json e, numa transação só:
//   1. grava um grupo por empresa (Shein entra sem matriz);
//   2. grava a matriz principal e as entidades relacionadas, resolvendo o
//      CNPJ completo da matriz de cada raiz no cnpj_db;
//   3. copia do cnpj_db todos os estabelecimentos ativos (situação 02) de
//      cada raiz para capex_radar.filiais, inclusive a sede, porque a planta
//      pode ser o próprio estabelecimento matriz (Cenibra, Bracell);
//   4. grava os termos de busca de cada grupo (seeds/capex_radar/termos-busca.json)
//      em capex_radar.grupo_termos. Termos criados à mão no banco não são apagados.
//
// A prioridade de cada filial pelo CNAE fica na view capex_radar.vw_filiais
// (tabela capex_radar.nicho_cnae, migração 019).
//
// É idempotente: rodar de novo atualiza os campos e insere o que faltar.
// Uso: npm run capex:carga-empresas
const fs = require("node:fs/promises");
const path = require("node:path");
const { Client } = require("pg");
const { getConfig } = require("../src/config");

const { linhasDoSeed } = require("../src/capex-busca");

const SEED = path.join(__dirname, "..", "seeds", "capex_radar", "empresas-teste.json");
const SEED_TERMOS = path.join(__dirname, "..", "seeds", "capex_radar", "termos-busca.json");
const ATOR = "sistema:carga-empresas";

async function gravarTermos(client, grupoId, entrada) {
  let gravados = 0;
  for (const linha of linhasDoSeed(entrada)) {
    const notas = linha.tipo === "marca" ? entrada.notas || null : null;
    const r = await client.query(
      `insert into capex_radar.grupo_termos (grupo_id, termo, tipo, notas)
       values ($1, $2, $3, $4)
       on conflict (grupo_id, termo) do update set tipo = excluded.tipo, notas = excluded.notas
       where (capex_radar.grupo_termos.tipo, capex_radar.grupo_termos.notas)
             is distinct from (excluded.tipo, excluded.notas)`,
      [grupoId, linha.termo, linha.tipo, notas],
    );
    gravados += r.rowCount;
  }
  return gravados;
}

// Papel das raízes relacionadas. A matriz do seed é sempre "principal".
function papelRelacionada(empresa, razaoSocial) {
  const nome = razaoSocial.toUpperCase();
  if (/HOLDING|PARTICIPACOES/.test(nome)) return "holding";
  if (empresa.nicho === "datacenter" && /\b(SP|RJ|SAMPA)\s*\d|HYPERSCALE|SP1\b/.test(nome)) return "spe";
  return "operacional";
}

async function resolverMatriz(client, cnpjBasico) {
  const { rows } = await client.query(
    `select e.cnpj_basico || e.cnpj_ordem || e.cnpj_dv as cnpj, e.uf, m.descricao as municipio, e.cnae_fiscal as cnae, e.nome_fantasia,
            emp.razao_social, emp.natureza_juridica
       from cnpj_db.estabelecimento e
       left join cnpj_db.empresas emp on emp.cnpj_basico = e.cnpj_basico
       left join cnpj_db.municipio m on m.codigo = e.municipio
      where e.cnpj_basico = $1 and e.matriz_filial = '1'
      order by (e.situacao_cadastral = '02') desc
      limit 1`,
    [cnpjBasico],
  );
  return rows[0] || null;
}

async function upsertMatriz(client, grupoId, papel, dados) {
  await client.query(
    `insert into capex_radar.matrizes
       (cnpj, grupo_id, papel, razao_social, nome_fantasia, natureza_juridica, cnae, uf, municipio, notas)
     values ($1, $2, $3, $4, nullif($5, ''), $6, $7, $8, $9, $10)
     on conflict (cnpj) do update set
       grupo_id = excluded.grupo_id, papel = excluded.papel,
       razao_social = excluded.razao_social, nome_fantasia = excluded.nome_fantasia,
       natureza_juridica = coalesce(excluded.natureza_juridica, capex_radar.matrizes.natureza_juridica),
       cnae = excluded.cnae, uf = excluded.uf, municipio = excluded.municipio, notas = excluded.notas`,
    [dados.cnpj, grupoId, papel, dados.razao_social.trim(), dados.nome_fantasia, dados.natureza_juridica,
     dados.cnae, dados.uf, dados.municipio, dados.notas || null],
  );
}

async function main() {
  const seed = JSON.parse(await fs.readFile(SEED, "utf8"));
  const seedTermos = JSON.parse(await fs.readFile(SEED_TERMOS, "utf8"));
  let termosGravados = 0;
  const { databaseUrl } = getConfig();
  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  const avisos = [];
  try {
    await client.query("begin");
    await client.query("select set_config('capex_radar.ator', $1, true)", [ATOR]);

    for (const empresa of seed.empresas) {
      const { rows } = await client.query(
        `insert into capex_radar.grupos (nome, nicho, ordem_ranking, ranking, controle, subsetor, notas)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (nome) do update set
           nicho = excluded.nicho, ordem_ranking = excluded.ordem_ranking, ranking = excluded.ranking,
           controle = excluded.controle, subsetor = excluded.subsetor, notas = excluded.notas
         returning id`,
        [empresa.grupo, empresa.nicho, empresa.ordem, empresa.ranking || {}, empresa.controle || null,
         empresa.subsetor || null, [empresa.notas, empresa.pendencia].filter(Boolean).join(" ") || null],
      );
      const grupoId = rows[0].id;

      const entradaTermos = seedTermos.grupos[empresa.grupo];
      if (entradaTermos) termosGravados += await gravarTermos(client, grupoId, entradaTermos);
      else avisos.push(`${empresa.grupo}: sem termos de busca no seed.`);

      if (!empresa.matriz) {
        avisos.push(`${empresa.grupo}: sem matriz no seed (${empresa.pendencia || "pendente"}).`);
        continue;
      }

      const principal = await resolverMatriz(client, empresa.matriz.cnpj.slice(0, 8));
      if (!principal || principal.cnpj !== empresa.matriz.cnpj) {
        avisos.push(`${empresa.grupo}: matriz ${empresa.matriz.cnpj} difere do cnpj_db (${principal?.cnpj || "ausente"}); mantido o do seed.`);
      }
      await upsertMatriz(client, grupoId, "principal", {
        ...empresa.matriz,
        nome_fantasia: principal?.nome_fantasia,
        natureza_juridica: principal?.natureza_juridica,
      });

      for (const rel of empresa.relacionadas || []) {
        const dados = await resolverMatriz(client, rel.cnpj_basico);
        if (!dados) {
          avisos.push(`${empresa.grupo}: raiz ${rel.cnpj_basico} (${rel.razao_social}) sem matriz no cnpj_db; ignorada.`);
          continue;
        }
        await upsertMatriz(client, grupoId, papelRelacionada(empresa, dados.razao_social || rel.razao_social), {
          ...dados,
          razao_social: dados.razao_social || rel.razao_social,
          notas: rel.papel || null,
        });
      }
    }

    // Estabelecimentos ativos de todas as raízes carregadas. A data do cnpj_db
    // vem como texto AAAAMMDD; o CEP, com 8 dígitos.
    const filiais = await client.query(`
      insert into capex_radar.filiais
        (cnpj, matriz_cnpj, nome_fantasia, situacao_cadastral, data_inicio_atividades, cnae,
         cnaes_secundarios, logradouro, numero, bairro, cep, uf, municipio)
      select e.cnpj_basico || e.cnpj_ordem || e.cnpj_dv, m.cnpj, nullif(e.nome_fantasia, ''), e.situacao_cadastral,
             case when e.data_inicio_atividades ~ '^[0-9]{8}$' then to_date(e.data_inicio_atividades, 'YYYYMMDD') end,
             e.cnae_fiscal,
             case when coalesce(e.cnae_fiscal_secundaria, '') <> '' then string_to_array(e.cnae_fiscal_secundaria, ',') end,
             nullif(trim(concat_ws(' ', e.tipo_logradouro, e.logradouro)), ''), e.numero, e.bairro,
             case when e.cep ~ '^[0-9]{8}$' then e.cep end, e.uf, mun.descricao
        from capex_radar.matrizes m
        join cnpj_db.estabelecimento e on e.cnpj_basico = m.cnpj_basico and e.situacao_cadastral = '02'
        left join cnpj_db.municipio mun on mun.codigo = e.municipio
       where e.cnpj_basico || e.cnpj_ordem || e.cnpj_dv ~ '^[0-9]{14}$'
      on conflict (cnpj) do update set
        situacao_cadastral = excluded.situacao_cadastral, nome_fantasia = excluded.nome_fantasia,
        cnae = excluded.cnae, cnaes_secundarios = excluded.cnaes_secundarios,
        logradouro = excluded.logradouro, numero = excluded.numero, bairro = excluded.bairro,
        cep = excluded.cep, uf = excluded.uf, municipio = excluded.municipio
      where (capex_radar.filiais.situacao_cadastral, capex_radar.filiais.nome_fantasia, capex_radar.filiais.cnae,
             capex_radar.filiais.cnaes_secundarios, capex_radar.filiais.logradouro, capex_radar.filiais.numero,
             capex_radar.filiais.bairro, capex_radar.filiais.cep, capex_radar.filiais.uf, capex_radar.filiais.municipio)
            is distinct from
            (excluded.situacao_cadastral, excluded.nome_fantasia, excluded.cnae, excluded.cnaes_secundarios,
             excluded.logradouro, excluded.numero, excluded.bairro, excluded.cep, excluded.uf, excluded.municipio)`);

    await client.query("commit");

    const resumo = await client.query(`
      select g.nicho, count(distinct g.id)::int as grupos,
             (select count(*)::int from capex_radar.matrizes m join capex_radar.grupos g2 on g2.id = m.grupo_id
               where g2.nicho = g.nicho) as matrizes,
             (select count(*)::int from capex_radar.vw_filiais f where f.nicho = g.nicho) as filiais,
             (select count(*)::int from capex_radar.vw_filiais f where f.nicho = g.nicho and f.prioritaria) as prioritarias,
             (select count(*)::int from capex_radar.grupo_termos t join capex_radar.grupos g2 on g2.id = t.grupo_id
               where g2.nicho = g.nicho and t.ativo) as termos
        from capex_radar.grupos g
       group by g.nicho order by g.nicho`);
    console.table(resumo.rows);
    console.log(`Filiais inseridas ou atualizadas nesta execução: ${filiais.rowCount}`);
    console.log(`Termos de busca inseridos ou atualizados nesta execução: ${termosGravados}`);
    for (const aviso of avisos) console.warn(`Aviso: ${aviso}`);
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Falha na carga: ${error.message}`);
  process.exitCode = 1;
});
