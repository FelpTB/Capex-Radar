const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { Client } = require("pg");
const { getConfig } = require("../config");
const { loadExtra } = require("./extra");
const {
  mapBndes,
  mapCvm,
  mapSiga,
  mapSislic,
  parseCsv,
  sigaCnpjIndex,
} = require("./rows");

const execFileAsync = promisify(execFile);
const CACHE = path.join(process.cwd(), "data", "cache");
const INCOMING = path.join(process.cwd(), "data", "incoming");

const AUTOMATIC = [
  {
    codigo: "SEC-BNDES",
    recurso: "https://dadosabertos.bndes.gov.br/dataset/10e21ad1-568e-45e5-a8af-43f2c05ef1a2/resource/6f56b78c-510f-44b6-8274-78a5b7e931f4/download/operacoes-financiamento-operacoes-nao-automaticas.csv",
    file: "bndes-nao-automaticas.csv",
    encoding: "windows-1252",
    table: "enr_bndes",
    columns: [
      "cnpj", "cliente", "descricao", "uf", "municipio", "municipio_codigo",
      "numero_contrato", "data_contratacao", "valor_contratado", "valor_desembolsado",
      "produto", "forma_apoio", "natureza_cliente", "porte_cliente", "situacao_contrato",
    ],
    map: mapBndes,
  },
  {
    codigo: "SEC-SIGA",
    recurso: "https://dadosabertos.aneel.gov.br/dataset/6d90b77c-c5f5-4d81-bdec-7bc619494bb9/resource/2f65a1b0-19b8-4360-8238-b34ab4693d55/download/siga-empreendimentos-geracao-diario.csv",
    file: "siga-diario.csv",
    encoding: "utf-8",
    table: "enr_siga",
    columns: [
      "cod_ceg", "nome", "nucleo_ceg", "uf", "tipo_geracao", "fase",
      "origem_combustivel", "fonte_combustivel", "tipo_outorga", "nome_fonte",
      "potencia_kw", "potencia_fiscalizada_kw", "garantia_fisica_kw",
      "geracao_qualificada", "latitude", "longitude",
      "municipios", "sub_bacia", "cnpjs", "participacao", "cnpj_edicao",
      "entrada_operacao", "inicio_vigencia", "fim_vigencia", "gerado_em",
    ],
    map: mapSiga,
    conflict: "cod_ceg",
    prior: {
      recurso: "https://dadosabertos.aneel.gov.br/dataset/6d90b77c-c5f5-4d81-bdec-7bc619494bb9/resource/11ec447d-698d-4ab8-977f-b424d5deee6a/download/siga-empreendimentos-geracao.csv",
      file: "siga-mensal.csv",
    },
  },
  {
    codigo: "SEC-IBAMA",
    recurso: "https://stibamadadosabertosprd.blob.core.windows.net/dados-abertos/dados/SISLIC/sislic-licencas.csv",
    file: "sislic.csv",
    encoding: "utf-8",
    table: "enr_sislic",
    columns: [
      "tipo_licenca", "numero_licenca", "data_emissao", "data_vencimento",
      "empreendimento", "pessoa", "processo", "tipologia", "pac", "atualizado_em",
    ],
    map: mapSislic,
  },
];

const CVM_YEARS = [2025, 2026];

const MANUAL = [
  {
    codigo: "SEC-CNPJ",
    porque: "O ZIP mensal da Receita tem dezenas de GB. A tabela enr_empresa guarda só o recorte que o Radar precisa.",
    como: "npm run dadosgov:sync só vigia a URL e a data desse recurso (manifest em data/dadosgov/). Para carregar um recorte, baixe o mês em https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-da-pessoa-juridica---cnpj e deixe os ZIPs em data/incoming/cnpj/.",
  },
  {
    codigo: "SEC-CNO",
    porque: "O ZIP diário chega por npm run dadosgov:sync e os cinco CSV são extraídos ao lado. A tabela enr_cno não é preenchida. A ficha lê o cno.csv extraído e completa a amostra com áreas, CNAEs, vínculos e a contagem de cno_totais.csv.",
    como: "Rode npm run dadosgov:sync. A rotina confere Last-Modified e tamanho do ZIP e baixa a versão nova quando a data local está ultrapassada, extraindo em seguida todos os CSV. O dicionário cno-metadados.pdf não é reconferido enquanto o arquivo local existir.",
  },
  {
    codigo: "SEC-DADOSGOV",
    porque: "Serve para achar a URL atual do CNO e do CNPJ. Não traz a linha do projeto.",
    como: "Chave em TOKEN_DADOS_GOV (perfil Consumidor no dados.gov.br). npm run dadosgov:sync usa o catálogo para localizar o recurso e baixa pelo link da Receita.",
  },
];

async function download(url, destination) {
  const response = await fetch(url, {
    headers: { "user-agent": "RadarCapEx-MVP/0.1 (research; contact via project owner)" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} em ${url}`);
  }
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  const buffer = Buffer.from(await response.arrayBuffer());
  await fsp.writeFile(destination, buffer);
  return buffer.length;
}

function decodeFile(file, encoding) {
  const bytes = fs.readFileSync(file);
  return new TextDecoder(encoding).decode(bytes);
}

function detectDelimiter(text) {
  const line = text.split(/\r?\n/, 1)[0] || "";
  const semicolons = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  return semicolons >= commas ? ";" : ",";
}

async function insertRows(client, table, columns, rows, conflict) {
  const conflictColumns = conflict
    ? conflict.split(",").map((column) => column.trim())
    : [];
  const chunkSize = 200;
  for (let start = 0; start < rows.length; start += chunkSize) {
    const slice = rows.slice(start, start + chunkSize);
    const values = [];
    const groups = slice.map((row, rowIndex) => {
      const cells = columns.map((column, columnIndex) => {
        values.push(row[column]);
        return `$${rowIndex * columns.length + columnIndex + 1}`;
      });
      return `(${cells.join(", ")})`;
    });
    const updates = columns
      .filter((column) => !conflictColumns.includes(column))
      .map((column) => `${column} = excluded.${column}`);
    const conflictSql = conflict
      ? ` on conflict (${conflict}) do update set ${updates.join(", ")}`
      : "";
    await client.query(
      `insert into ${table} (${columns.join(", ")}) values ${groups.join(", ")}${conflictSql}`,
      values,
    );
  }
}

async function replaceTable(client, base, rows) {
  await client.query("begin");
  try {
    await client.query(`truncate ${base.table}`);
    await insertRows(client, base.table, base.columns, rows, base.conflict);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function recordLoad(client, entry) {
  await client.query(
    `insert into base_carga (codigo, recurso, status, linhas, bytes, erro)
     values ($1, $2, $3, $4, $5, $6)`,
    [entry.codigo, entry.recurso, entry.status, entry.linhas ?? null, entry.bytes ?? null, entry.erro ?? null],
  );
}

async function loadCsvBase(client, base) {
  const destination = path.join(CACHE, base.file);
  const bytes = await download(base.recurso, destination);
  const text = decodeFile(destination, base.encoding);
  let prior = null;
  if (base.prior) {
    const priorPath = path.join(CACHE, base.prior.file);
    await download(base.prior.recurso, priorPath);
    const priorText = decodeFile(priorPath, base.encoding);
    prior = sigaCnpjIndex(parseCsv(priorText, detectDelimiter(priorText)));
  }
  const mapped = parseCsv(text, detectDelimiter(text))
    .map((record) => base.map(record, prior))
    .filter(Boolean);
  const records = base.conflict && !base.conflict.includes(",")
    ? [...new Map(mapped.map((row) => [row[base.conflict], row])).values()]
    : mapped;
  await replaceTable(client, base, records);
  await recordLoad(client, {
    codigo: base.codigo,
    recurso: base.recurso,
    status: "ok",
    linhas: records.length,
    bytes,
  });
  return { codigo: base.codigo, linhas: records.length, bytes };
}

async function loadCvmYear(client, year) {
  const url = `https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS/ipe_cia_aberta_${year}.zip`;
  const zipPath = path.join(CACHE, `ipe-${year}.zip`);
  const extractDir = path.join(CACHE, `ipe-${year}`);
  const bytes = await download(url, zipPath);
  await fsp.rm(extractDir, { recursive: true, force: true });
  await fsp.mkdir(extractDir, { recursive: true });
  await execFileAsync("tar", ["-xf", zipPath, "-C", extractDir]);
  const files = await fsp.readdir(extractDir);
  const csvName = files.find((file) => file.toLowerCase().endsWith(".csv"));
  if (!csvName) throw new Error(`ZIP ${year} sem CSV`);
  const text = decodeFile(path.join(extractDir, csvName), "latin1");
  const records = parseCsv(text, detectDelimiter(text))
    .map((record) => mapCvm(record, year))
    .filter(Boolean);
  const unique = new Map(records.map((row) => [`${row.protocolo}:${row.versao}`, row]));
  const rows = [...unique.values()];
  await client.query("begin");
  try {
    await client.query("delete from enr_cvm_ipe where ano = $1", [year]);
    await insertRows(client, "enr_cvm_ipe", [
      "protocolo", "versao", "cnpj", "codigo_cvm", "nome", "categoria",
      "tipo", "especie", "assunto", "tipo_apresentacao",
      "data_entrega", "data_referencia", "link", "ano",
    ], rows, "protocolo, versao");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
  await recordLoad(client, {
    codigo: "SEC-CVM-IPE",
    recurso: url,
    status: "ok",
    linhas: rows.length,
    bytes,
  });
  return { codigo: `SEC-CVM-IPE ${year}`, linhas: rows.length, bytes };
}

async function loadBases(only = []) {
  const config = getConfig();
  const client = new Client({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
  });
  await client.connect();
  const results = [];
  const selected = (codigo) => !only.length || only.includes(codigo);
  try {
    for (const base of AUTOMATIC) {
      if (!selected(base.codigo)) continue;
      try {
        results.push(await loadCsvBase(client, base));
      } catch (error) {
        await recordLoad(client, {
          codigo: base.codigo,
          recurso: base.recurso,
          status: "erro",
          erro: error.message,
        });
        results.push({ codigo: base.codigo, erro: error.message });
      }
    }
    results.push(...await loadExtra(client, selected));
    if (selected("SEC-CVM-IPE")) {
      for (const year of CVM_YEARS) {
        try {
          results.push(await loadCvmYear(client, year));
        } catch (error) {
          await recordLoad(client, {
            codigo: "SEC-CVM-IPE",
            recurso: String(year),
            status: "erro",
            erro: error.message,
          });
          results.push({ codigo: `SEC-CVM-IPE ${year}`, erro: error.message });
        }
      }
    }
    for (const item of MANUAL) {
      if (!selected(item.codigo) && only.length) continue;
      await recordLoad(client, {
        codigo: item.codigo,
        recurso: item.como,
        status: "manual",
        erro: item.porque,
      });
    }
  } finally {
    await client.end();
  }
  return { results, manual: MANUAL };
}

module.exports = {
  AUTOMATIC,
  CVM_YEARS,
  MANUAL,
  loadBases,
};
