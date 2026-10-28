const { pool, updateProjectReading } = require("../db");
const { articleContext, articleText } = require("../scanner");
const { asIsoDate, chooseStatusDate, periodSentence, periodStart } = require("../status-date");
const { identifyProjectCompany, chooseListedCnpj } = require("../ai");
const { sourcesForProject } = require("./viability");
const {
  annotateAmostra,
  annotateBndes,
  annotateCno,
  annotateCvm,
  annotateIbama,
  annotateRegistro,
  annotateSiga,
} = require("./annotate");
const { interpretProjectStatus, judgeEvidenceContext } = require("../ai");
const { correlateLines, linesOf, rebuildFound } = require("./correlacao");
const { cnoNeedles, matchCno, namesInCno } = require("./cno");
const { queryAna } = require("./ana");
const { onsTokens } = require("./ons");
const { holderTerm, querySigmine } = require("./sigmine");
const { projectTokens } = require("./anp-listas");
const { queryDiario, queryDou } = require("./atos");
const { queryMetaway, querySigpub } = require("./diarios");
const { DOOL, queryDoeSp, queryDool, queryJornalMg, querySemad } = require("./estaduais");
const { DOE_CONECTORES } = require("./doe-estados");
const { DOE_ESTADOS } = require("../doe-registry");
const { convertCompanyDocuments, cvmExcerpt } = require("./cvm-docs");
const { artespTokens, concessionariaAliases } = require("./artesp");
const {
  nameTerm,
  groupByCnpj,
  cadastroMatches,
  onlyDigits,
  ownersFromParticipacao,
  fold,
} = require("./resolve");

const BNDES_URL = "https://dadosabertos.bndes.gov.br/dataset/operacoes-financiamento";
const SIGA_URL = "https://dadosabertos.aneel.gov.br/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel";
const SISLIC_URL = "https://dadosabertos.ibama.gov.br/dataset/licenciamento-ambiental-federal";
const CNO_URL = "https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-de-obras-cno";

const LIVE = {
  "CAPTURA-SIGMINE": "https://dadosabertos.anm.gov.br/SIGMINE/",
  "SEC-ANA-SNIRH": "https://portal1.snirh.gov.br/server/rest/services/Hosted/outorgas_federais_superficial/FeatureServer/0",
  "SEC-ANP-EP": "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/fase-exploracao",
  "CAPTURA-ONS-PAR": "https://www.epe.gov.br/pt/publicacoes-dados-abertos/publicacoes/programa-de-expansao-da-transmissao-pet-plano-de-expansao-de-longo-prazo-pelp-ciclo-2025-2-semestre",
};

const REGISTRO = {
  "SEC-ANTT-INV": {
    url: "https://dados.antt.gov.br/",
    codigos: ["SEC-ANTT-CAD", "SEC-ANTT-AUT", "SEC-ANTT-ENC", "SEC-ANTT-PIP", "SEC-ANTT-CONC"],
  },
  "SEC-ANTAQ-INST": {
    url: "https://www.gov.br/antaq/pt-br/acesso-a-informacao/dados-abertos",
    codigos: ["SEC-ANTAQ-INST"],
    porNome: true,
  },
  "SEC-IAT": {
    url: "https://geopr.iat.pr.gov.br/server/rest/services/00_PUBLICACOES/licencas_ambientais_sia_sga/FeatureServer/0",
    codigos: ["SEC-IAT"],
    porNome: true,
  },
};

async function findNameHits(term) {
  const like = `%${term}%`;
  const [bndes, cvm, siga] = await Promise.all([
    pool.query(
      `select cnpj, cliente as nome, count(*)::int as linhas
       from enr_bndes
       where cliente ilike $1 and cnpj is not null
       group by cnpj, cliente`,
      [like],
    ),
    pool.query(
      `select cnpj, nome, count(*)::int as linhas
       from enr_cvm_ipe
       where nome ilike $1 and cnpj is not null
       group by cnpj, nome`,
      [like],
    ),
    pool.query(
      "select participacao from enr_siga where participacao ilike $1",
      [like],
    ),
  ]);
  const sigaHits = siga.rows
    .flatMap((row) => ownersFromParticipacao(row.participacao))
    .filter((owner) => fold(owner.nome).includes(term))
    .map((owner) => ({ ...owner, base: "SEC-SIGA", linhas: 1 }));
  return [
    ...bndes.rows.map((row) => ({ ...row, base: "SEC-BNDES" })),
    ...cvm.rows.map((row) => ({ ...row, base: "SEC-CVM-IPE" })),
    ...sigaHits,
  ];
}

async function confirmCadastro(cnpj) {
  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    headers: { accept: "application/json", "user-agent": "RadarCapEx-MVP/0.1" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Consulta de CNPJ respondeu HTTP ${response.status}`);
  return response.json();
}

async function sourceId(codigo) {
  const { rows } = await pool.query("select id from fonte where codigo = $1", [codigo]);
  return rows[0]?.id || null;
}

async function addEvidenceOnce(projectId, codigo, { url, titulo, trecho, campos }) {
  const fonte = await sourceId(codigo);
  if (!fonte) return false;
  const existing = await pool.query(
    `select trecho, campos_extraidos = $4::jsonb as mesmos_campos
     from evidencia where id_projeto = $1 and url = $2 and id_fonte = $3`,
    [projectId, url, fonte, JSON.stringify(campos || {})],
  );
  if (existing.rows.length) {
    if (existing.rows[0].trecho === trecho && existing.rows[0].mesmos_campos) return false;
    await pool.query(
      `update evidencia
       set titulo_ou_resumo = $1, trecho = $2, campos_extraidos = $3::jsonb
       where id_projeto = $4 and url = $5 and id_fonte = $6`,
      [titulo, trecho, JSON.stringify(campos || {}), projectId, url, fonte],
    );
    return "updated";
  }
  await pool.query(
    `insert into evidencia (
       id_projeto, id_fonte, papel, url, titulo_ou_resumo, trecho, campos_extraidos
     ) values ($1,$2,'secundaria',$3,$4,$5,$6::jsonb)`,
    [projectId, fonte, url, titulo, trecho, JSON.stringify(campos || {})],
  );
  return "created";
}

// Tira a evidência secundária da fonte quando nenhum registro dela tem correlação direta com o projeto.
async function removeSourceEvidence(projectId, codigo) {
  const fonte = await sourceId(codigo);
  if (!fonte) return false;
  const { rowCount } = await pool.query(
    "delete from evidencia where id_projeto = $1 and id_fonte = $2 and papel = 'secundaria'",
    [projectId, fonte],
  );
  return rowCount > 0;
}

function describeSiga(rows) {
  return rows.map((row) => {
    const mw = row.potencia_kw ? `${(Number(row.potencia_kw) / 1000).toFixed(1)} MW` : "potência não informada";
    return `${row.tipo_geracao} ${row.nome} (${row.municipios || row.uf}), ${mw}, fase ${row.fase}`;
  }).join("; ");
}

function describeSislic(rows) {
  const porTipo = new Map();
  for (const row of rows) {
    const key = row.tipo_licenca || "licença";
    porTipo.set(key, (porTipo.get(key) || 0) + 1);
  }
  const resumo = [...porTipo.entries()].map(([tipo, n]) => `${n} ${tipo}`).join(", ");
  const recente = rows[0];
  const data = recente?.data_emissao
    ? new Date(recente.data_emissao).toISOString().slice(0, 10)
    : null;
  return `${resumo}. Mais recente: ${recente?.tipo_licenca || ""} ${recente?.numero_licenca || ""}${data ? ` emitida em ${data}` : ""} para ${recente?.empreendimento || "empreendimento não informado"}.`;
}

async function newsText(project) {
  try {
    const text = await articleText(project.url_noticia_principal, {
      title: project.nome,
      summary: "",
    });
    if (text && text.trim().length >= 40) return text;
  } catch {
    // A ficha segue com o texto da evidência primária.
  }
  const { rows } = await pool.query(
    `select titulo_ou_resumo, trecho
     from evidencia
     where id_projeto = $1 and papel = 'primaria'
     order by coletado_em`,
    [project.id],
  );
  return rows.map((row) => `${row.titulo_ou_resumo || ""}\n${row.trecho || ""}`).join("\n");
}

async function saveCompany(projectId, cadastro) {
  const cnpj = onlyDigits(cadastro.cnpj);
  await pool.query(
    `update projeto
     set empresa_nome = $2, cnpj = $3, updated_at = now()
     where id = $1`,
    [projectId, cadastro.razao_social, cnpj],
  );
  await pool.query(
    `insert into enr_empresa (
       cnpj, razao_social, nome_fantasia, cnae, uf, municipio, situacao, origem
     ) values ($1,$2,$3,$4,$5,$6,$7,'brasilapi')
     on conflict (cnpj) do update set
       razao_social = excluded.razao_social,
       nome_fantasia = excluded.nome_fantasia,
       cnae = excluded.cnae,
       uf = excluded.uf,
       municipio = excluded.municipio,
       situacao = excluded.situacao,
       origem = excluded.origem,
       atualizado_em = now()`,
    [
      cnpj,
      cadastro.razao_social,
      cadastro.nome_fantasia || null,
      cadastro.cnae_fiscal_descricao || null,
      cadastro.uf || null,
      cadastro.municipio || null,
      cadastro.descricao_situacao_cadastral || null,
    ],
  );
  return cnpj;
}

async function completeProfile(project) {
  const noticia = await newsText(project);
  if (!noticia || noticia.trim().length < 40) {
    return { cnpj: null, mensagem: "A notícia não está disponível para montar o perfil da empresa." };
  }

  const decision = await identifyProjectCompany(noticia, project);
  const empresa = decision.selecionada || project.empresa_nome;
  const term = empresa ? nameTerm({ empresa_nome: empresa, nome: "" }) : null;
  const titleTerms = (decision.candidatos || [])
    .map((name) => fold(name))
    .filter((name) => name.length >= 4 && fold(project.nome).includes(name));
  if (!term && !titleTerms.length) {
    return { cnpj: null, mensagem: decision.motivo || "A notícia não indica a empresa do projeto." };
  }

  let groups = term ? groupByCnpj(await findNameHits(term)).slice(0, 12) : [];
  if (!groups.length) {
    const seeds = term ? [term, ...titleTerms] : titleTerms;
    const needles = [...new Set(seeds.flatMap((item) => cnoNeedles(item)))];
    groups = groupByCnpj(await namesInCno(needles)).slice(0, 12);
  }
  const choice = await chooseListedCnpj(noticia, project, groups);
  if (!choice.cnpj) return { cnpj: null, mensagem: choice.motivo };

  const cadastro = await confirmCadastro(choice.cnpj);
  const accepted = [term, ...titleTerms, ...(term ? cnoNeedles(term) : [])].filter(Boolean);
  if (!accepted.some((item) => cadastroMatches(cadastro, item))) {
    return {
      cnpj: null,
      mensagem: `O cadastro de ${choice.cnpj} não confirma a empresa indicada na notícia. A ficha permanece sem CNPJ.`,
    };
  }

  const cnpj = await saveCompany(project.id, cadastro);
  const localDiferente = Boolean(project.uf && cadastro.uf && project.uf !== cadastro.uf);
  const bases = groups.find((group) => group.cnpj === cnpj)?.bases || [];
  await addEvidenceOnce(project.id, "SEC-CNPJ", {
    url: `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
    titulo: cadastro.razao_social,
    trecho: [
      `${cadastro.razao_social} está ${cadastro.descricao_situacao_cadastral || "sem situação"}.`,
      `Fantasia: ${cadastro.nome_fantasia || "não informada"}.`,
      `${cadastro.descricao_identificador_matriz_filial || "Matriz"} em ${cadastro.municipio || "—"}/${cadastro.uf || "—"}.`,
      `Atividade: ${cadastro.cnae_fiscal_descricao || "não informada"}.`,
      bases.length ? `Nome encontrado em ${bases.join(", ")}.` : "Cadastro confirmado a partir da notícia.",
      decision.motivo,
      localDiferente
        ? `O projeto está em ${project.uf}. Nenhuma filial foi escolhida porque a notícia não identifica o estabelecimento.`
        : "O estado do cadastro coincide com o projeto.",
    ].join(" "),
    campos: {
      cnpj,
      fantasia: cadastro.nome_fantasia,
      tipo: cadastro.descricao_identificador_matriz_filial,
      uf: cadastro.uf,
      municipio: cadastro.municipio,
      cnae: cadastro.cnae_fiscal_descricao,
      situacao: cadastro.descricao_situacao_cadastral,
      natureza: cadastro.natureza_juridica,
      capital_social: cadastro.capital_social,
      empresa_na_noticia: decision.selecionada,
      bases_com_nome: bases,
    },
  });

  return {
    cnpj,
    razao: cadastro.razao_social,
    mensagem: `Perfil completo: ${cadastro.razao_social}, CNPJ ${cnpj}.`,
  };
}

function msToIso(value) {
  return typeof value === "number" && value > 0 ? new Date(value).toISOString().slice(0, 10) : value ?? null;
}

// O payload entra na linha para a correlação ler a atividade, a modalidade e as datas do registro.
async function queryRegistro(spec, cnpj, razaoSocial, project = {}) {
  if (spec.porNome) {
    const term = fold(razaoSocial).replace(/[^a-z0-9 ]/g, " ").trim().split(/\s+/).slice(0, 2).join("%");
    const { rows } = await pool.query(
      `select codigo, titulo, uf, municipio, payload
       from enr_registro
       where codigo = any($1::text[])
         and translate(lower(titulo), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like $2
       order by (${folded("coalesce(municipio, '')")} = $3) desc, municipio
       limit 100`,
      [spec.codigos, `%${term}%`, fold(project?.municipio || "")],
    );
    return rows.map(({ payload, ...row }) => ({
      ...row,
      ...(payload || {}),
      ...(payload?.emissao !== undefined ? { emissao: msToIso(payload.emissao) } : {}),
      ...(payload?.validade !== undefined ? { validade: msToIso(payload.validade) } : {}),
    }));
  }
  const { rows } = await pool.query(
    `select codigo, titulo, uf, municipio, valor
     from enr_registro
     where codigo = any($1::text[])
       and (cnpj = $2 or $2 = any(cnpjs))
     limit 30`,
    [spec.codigos, cnpj],
  );
  return rows;
}

async function ensureStatusDate(project) {
  if (asIsoDate(project.status_em)) return project;
  const article = await articleContext(project.url_noticia_principal, {
    title: project.nome,
    summary: "",
  });
  const primary = await pool.query(
    `select trecho from evidencia
     where id_projeto = $1 and papel = 'primaria'
     order by coletado_em limit 1`,
    [project.id],
  );
  const moment = chooseStatusDate({
    text: article.text,
    trecho: primary.rows[0]?.trecho,
    publishedAt: article.publishedAt,
  });
  if (!moment.status_em) return project;
  await pool.query(
    `update projeto
     set status_em = $2, status_em_origem = $3, updated_at = now()
     where id = $1`,
    [project.id, moment.status_em, moment.origem],
  );
  return { ...project, status_em: moment.status_em, status_em_origem: moment.origem };
}

const FOLD_SQL = "translate(lower(%s), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')";

function folded(column) {
  return FOLD_SQL.replace("%s", column);
}

async function queryCounted(where, params, select) {
  const total = await pool.query(`select count(*)::int as n from enr_registro where ${where}`, params);
  const rows = await pool.query(`select ${select} from enr_registro where ${where} limit 12`, params);
  return { total: total.rows[0].n, linhas: rows.rows };
}

async function queryReidi(cnpj, razaoSocial) {
  const digits = onlyDigits(cnpj);
  const term = holderTerm(razaoSocial) || "";
  const like = term.length >= 4 ? `%${term.replace(/\s+/g, "%")}%` : "";
  if (!digits && !like) return { total: 0, linhas: [] };
  return queryCounted(
    `codigo = 'CAPTURA-REIDI' and (
       ($1 <> '' and cnpj = $1)
       or ($2 <> '' and ${folded("titulo")} like $2)
     )`,
    [digits || "", like],
    `titulo, uf, valor, payload->>'modal' as modal, payload->>'ano' as ano,
     payload->>'portaria' as portaria, payload->>'contrato' as contrato`,
  );
}

async function queryArtesp(razaoSocial, project) {
  const term = (holderTerm(razaoSocial) || "").replace(/\s+/g, "%");
  const like = term.length >= 4 ? `%${term}%` : "";
  const tokens = artespTokens(project);
  const lotes = concessionariaAliases(razaoSocial);
  if (!like && !tokens.length && !lotes.length) return { total: 0, linhas: [] };
  return queryCounted(
    `codigo = 'SEC-ARTESP' and (
       ($1 <> '' and ${folded("titulo")} like $1)
       or ($1 <> '' and ${folded("coalesce(payload->>'concessionaria', '')")} like $1)
       or payload->>'lote' = any($2::text[])
       or ${folded("coalesce(payload->>'rodovia_nome', '')")} = any($3::text[])
       or ${folded("coalesce(payload->>'detalhamento_servico', '')")} like any($4::text[])
     )`,
    [
      like,
      lotes,
      tokens,
      tokens.map((token) => `%${token}%`),
    ],
    `titulo, payload->>'lote' as lote, payload->>'concessionaria' as concessionaria,
     payload->>'rodovia' as rodovia, payload->>'rodovia_nome' as rodovia_nome,
     payload->>'programa' as programa, payload->>'detalhamento_servico' as detalhamento_servico,
     payload->>'km_inicial' as km_inicial, payload->>'km_final' as km_final,
     payload->>'data_inicial' as data_inicial, payload->>'data_final' as data_final`,
  );
}

async function queryAnpLista(codigo, razaoSocial, project, byField) {
  const term = holderTerm(razaoSocial) || "";
  const like = term.length >= 4 ? `%${term.replace(/\s+/g, "%")}%` : "";
  const tokens = byField ? projectTokens(project?.nome) : [];
  if (!like && !tokens.length) return { total: 0, linhas: [] };
  const found = await queryCounted(
    `codigo = $1 and (
       ($2 <> '' and ${folded("titulo")} like $2)
       or ${folded("coalesce(payload->>'campo', '')")} = any($3::text[])
     )`,
    [codigo, like, tokens],
    "titulo, payload",
  );
  return {
    total: found.total,
    linhas: found.linhas.map((row) => ({ titulo: row.titulo, ...(row.payload || {}) })),
  };
}

async function queryAnp(razaoSocial) {
  const term = fold(razaoSocial).replace(/[^a-z0-9 ]/g, " ").trim().split(/\s+/).slice(0, 2).join("%");
  if (term.length < 4) return [];
  const { rows } = await pool.query(
    `select payload
     from enr_registro
     where codigo = 'SEC-ANP-EP'
       and translate(lower(titulo), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like $1
     limit 20`,
    [`%${term}%`],
  );
  return rows.map((row) => row.payload || {});
}

async function queryOns(project) {
  const tokens = onsTokens(project);
  if (!tokens.length) return [];
  const likes = tokens.map((_, index) => `translate(lower(titulo), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like $${index + 2}`);
  const { rows } = await pool.query(
    `select titulo, uf, valor, payload->>'tipo' as tipo, payload->>'necessidade' as necessidade
     from enr_registro
     where codigo = 'CAPTURA-ONS-PAR'
       and ($1 = '' or uf is null or uf = $1)
       and (${likes.join(" or ")})
     limit 12`,
    [project.uf || "", ...tokens.map((token) => `%${token}%`)],
  );
  return rows;
}

function anttLike(razaoSocial) {
  const words = fold(razaoSocial).replace(/[^a-z0-9 ]/g, " ").trim().split(/\s+/).filter((word) => word.length >= 3).slice(0, 2);
  if (!words.length) return null;
  return `%${words.join("%")}%`;
}

function anttFields(row) {
  return {
    codigo: row.codigo,
    titulo: row.titulo,
    uf: row.uf,
    valor: row.valor,
    ...(row.payload || {}),
  };
}

async function queryAntt(razaoSocial) {
  const like = anttLike(razaoSocial);
  if (!like) return [];
  const { rows: cad } = await pool.query(
    `select codigo, titulo, uf, valor, payload
     from enr_registro
     where codigo = 'SEC-ANTT-CAD'
       and translate(lower(payload->>'concessionaria'), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like $1
     order by payload->>'id_sigicor'
     limit 20`,
    [like],
  );
  const ids = [...new Set(cad.map((row) => row.payload?.id_sigicor).filter(Boolean))];
  let extras = [];
  if (ids.length) {
    const found = await pool.query(
      `select codigo, titulo, uf, valor, payload
       from enr_registro
       where codigo = any($1::text[])
         and payload->>'id_sigicor' = any($2::text[])
       order by codigo, payload->>'id_sigicor'`,
      [["SEC-ANTT-AUT", "SEC-ANTT-ENC"], ids],
    );
    extras = found.rows;
  }
  const names = [...new Set(cad.map((row) => String(row.payload?.concessionaria || "").trim()).filter(Boolean))];
  const compact = names.map((name) => fold(name).replace(/\s+/g, ""));
  let conc = [];
  if (compact.length) {
    const found = await pool.query(
      `select codigo, titulo, valor, payload
       from enr_registro
       where codigo = 'SEC-ANTT-CONC'
         and replace(translate(lower(payload->>'concessionaria'), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), ' ', '') = any($1::text[])
       order by payload->>'ano'`,
      [compact],
    );
    conc = found.rows;
  }
  const { rows: pip } = await pool.query(
    `select codigo, titulo, uf, payload
     from enr_registro
     where codigo = 'SEC-ANTT-PIP'
       and translate(lower(payload->>'concessionaria'), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like $1
     limit 12`,
    [like],
  );
  const autBy = new Map();
  const encBy = new Map();
  for (const row of extras) {
    const id = row.payload?.id_sigicor;
    const bag = row.codigo === "SEC-ANTT-ENC" ? encBy : autBy;
    if (!bag.has(id)) bag.set(id, []);
    bag.get(id).push(anttFields(row));
  }
  const rows = cad.map((row) => ({
    ...anttFields(row),
    autorizacoes: autBy.get(row.payload?.id_sigicor) || [],
    encerramentos: encBy.get(row.payload?.id_sigicor) || [],
  }));
  if (conc.length) {
    rows.push({
      codigo: "SEC-ANTT-CONC",
      titulo: "S\u00e9rie anual de investimento da concession\u00e1ria",
      concessionaria: conc[0].payload?.concessionaria || names[0] || null,
      serie: conc.map((row) => ({
        ano: row.payload?.ano || null,
        valor: row.valor,
        concessionaria: row.payload?.concessionaria || null,
      })),
    });
  }
  for (const row of pip) rows.push(anttFields(row));
  return rows;
}

async function querySource(codigo, cnpj, razaoSocial, since = null, project = {}) {
  if (codigo === "CAPTURA-SIGMINE") return querySigmine(project);
  if (codigo === "SEC-ANA-SNIRH") return queryAna(cnpj);
  if (codigo === "SEC-ANP-EP") return queryAnp(razaoSocial);
  if (codigo === "CAPTURA-REIDI") return queryReidi(cnpj, razaoSocial);
  if (codigo === "SEC-ARTESP") return queryArtesp(razaoSocial, project);
  if (codigo === "SEC-ANP-CAMPO") return queryAnpLista(codigo, razaoSocial, project, true);
  if (codigo === "SEC-ANP-PLAT" || codigo === "SEC-ANP-DUTO") return queryAnpLista(codigo, razaoSocial, project, false);
  if (codigo === "CAPTURA-DOU") return queryDou(razaoSocial);
  if (codigo === "CAPTURA-QD") return queryDiario(project);
  if (codigo === "CAPTURA-SIGPUB") return querySigpub(project, cnpj, razaoSocial);
  if (codigo === "CAPTURA-DOM-METAWAY") return queryMetaway(project, cnpj, razaoSocial);
  if (DOOL[codigo]) return queryDool(codigo, project, cnpj, razaoSocial);
  if (DOE_CONECTORES[codigo]) return DOE_CONECTORES[codigo](project, cnpj, razaoSocial);
  if (codigo === "CAPTURA-DOE-SP") return queryDoeSp(project, cnpj, razaoSocial);
  if (codigo === "CAPTURA-DOE-MG") return queryJornalMg(project, cnpj, razaoSocial);
  if (codigo === "SEC-SEMAD") return querySemad(project, razaoSocial);
  if (codigo === "CAPTURA-ONS-PAR") return queryOns(project);
  if (codigo === "SEC-ANTT-INV") return queryAntt(razaoSocial);
  if (REGISTRO[codigo]) return queryRegistro(REGISTRO[codigo], cnpj, razaoSocial, project);
  if (codigo === "SEC-BNDES") {
    const { rows } = await pool.query(
      `select count(*)::int as n,
              count(*) filter (where situacao_contrato not ilike 'liquidado%')::int as abertos,
              count(*) filter (
                where $2::date is not null and data_contratacao >= $2::date
              )::int as no_periodo
       from enr_bndes where cnpj = $1`,
      [cnpj, since],
    );
    const lines = await pool.query(
      `select numero_contrato, data_contratacao, uf, municipio, descricao,
              situacao_contrato, valor_contratado
       from enr_bndes
       where cnpj = $1
       order by case
         when $2::date is not null and data_contratacao >= $2::date then 0
         else 1
       end, data_contratacao desc nulls last
       limit 100`,
      [cnpj, since],
    );
    return { ...rows[0], linhas: lines.rows };
  }
  if (codigo === "SEC-CVM-IPE") {
    const { rows } = await pool.query(
      `select protocolo, versao, assunto, data_referencia, data_entrega,
              categoria, tipo, especie, tipo_apresentacao, link
       from enr_cvm_ipe where cnpj = $1
       order by case
         when $2::date is not null and data_referencia >= $2::date then 0
         else 1
       end, data_referencia desc nulls last
       limit 12`,
      [cnpj, since],
    );
    const totals = await pool.query(
      `select count(*)::int as n,
              count(*) filter (
                where $2::date is not null and data_referencia >= $2::date
              )::int as no_periodo
       from enr_cvm_ipe where cnpj = $1`,
      [cnpj, since],
    );
    rows.noPeriodo = totals.rows[0].no_periodo;
    rows.total = totals.rows[0].n;
    rows.lidos = 0;
    try {
      const docs = await convertCompanyDocuments(cnpj);
      const byKey = new Map(docs.map((doc) => [`${doc.protocolo}:${Number(doc.versao) || 1}`, doc]));
      const present = new Set();
      for (const row of rows) {
        const key = `${row.protocolo}:${Number(row.versao) || 1}`;
        present.add(key);
        const doc = byKey.get(key);
        if (doc?.status === "ok" && doc.markdown) row.texto = cvmExcerpt(doc.markdown);
      }
      for (const doc of docs) {
        const key = `${doc.protocolo}:${Number(doc.versao) || 1}`;
        if (doc.status !== "ok" || !doc.markdown || present.has(key)) continue;
        rows.unshift({
          protocolo: doc.protocolo,
          versao: doc.versao,
          assunto: doc.assunto,
          data_referencia: doc.data_referencia,
          data_entrega: doc.data_entrega,
          categoria: doc.categoria,
          tipo: doc.tipo,
          especie: doc.especie,
          tipo_apresentacao: doc.tipo_apresentacao,
          link: doc.link,
          texto: cvmExcerpt(doc.markdown),
        });
      }
      rows.lidos = docs.filter((doc) => doc.status === "ok").length;
    } catch {
      rows.lidos = 0;
    }
    return rows;
  }
  if (codigo === "SEC-SIGA") {
    const { rows } = await pool.query(
      `select cod_ceg, nucleo_ceg, nome, uf, tipo_geracao, fase,
              origem_combustivel, fonte_combustivel, nome_fonte, tipo_outorga,
              potencia_kw, potencia_fiscalizada_kw, garantia_fisica_kw, geracao_qualificada,
              latitude, longitude, municipios, sub_bacia, participacao, cnpjs, cnpj_edicao,
              entrada_operacao, inicio_vigencia, fim_vigencia, gerado_em,
              ($2::date is not null and entrada_operacao >= $2::date) as no_periodo
       from enr_siga where $1 = any(cnpjs) order by nome`,
      [cnpj, since],
    );
    return rows;
  }
  if (codigo === "SEC-IBAMA") {
    const razao = `%${fold(razaoSocial).replace(/[^a-z0-9 ]/g, " ").trim().split(/\s+/).slice(0, 2).join("%")}%`;
    const { rows } = await pool.query(
      `select tipo_licenca, numero_licenca, data_emissao, data_vencimento,
              empreendimento, pessoa, processo, tipologia, pac, atualizado_em,
              ($2::date is not null and data_emissao >= $2::date) as no_periodo
       from enr_sislic
       where translate(lower(pessoa), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like $1
       order by data_emissao desc nulls last limit 50`,
      [razao, since],
    );
    return rows;
  }
  return null;
}

function periodNote(count, project) {
  const since = periodStart(project.status_em);
  return periodSentence(count, since, project.status_em);
}

function evidencePayload(project, note, extra = {}) {
  const since = periodStart(project.status_em);
  return {
    trecho: note.texto,
    campos: {
      cnpj: onlyDigits(project.cnpj),
      desde: since,
      linhas: note.linhas,
      ...(project.correlacao ? { correlacao: project.correlacao } : {}),
      ...extra,
    },
  };
}

async function writeSourceEvidence(project, codigo, found) {
  if (codigo === "SEC-BNDES") {
    const note = annotateBndes(found);
    if (!note) return false;
    return addEvidenceOnce(project.id, codigo, {
      url: BNDES_URL,
      titulo: note.texto,
      ...evidencePayload(project, note, { abertos: found.abertos, no_periodo: found.no_periodo }),
    });
  }
  if (codigo === "SEC-CVM-IPE") {
    const note = annotateCvm(found);
    if (!note) return false;
    return addEvidenceOnce(project.id, codigo, {
      url: "https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe",
      titulo: note.texto,
      ...evidencePayload(project, note, { no_periodo: found.noPeriodo }),
    });
  }
  if (codigo === "SEC-SIGA") {
    const note = annotateSiga(found);
    if (!note) return false;
    return addEvidenceOnce(project.id, codigo, {
      url: SIGA_URL,
      titulo: note.texto,
      ...evidencePayload(project, note),
    });
  }
  const amostras = {
    "CAPTURA-REIDI": ["projeto habilitado no REIDI", "projetos habilitados no REIDI", "https://dados.transportes.gov.br/dataset/incentivo-fiscal-reidi"],
    "SEC-ARTESP": ["obra programada na ARTESP", "obras programadas na ARTESP", "https://dadosabertos.artesp.sp.gov.br/dataset/programacao-de-obras"],
    "SEC-ANP-CAMPO": ["campo em produção na ANP", "campos em produção na ANP", "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/arquivos-fase-de-desenvolvimento-e-producao/producao-por-zona"],
    "SEC-ANP-PLAT": ["plataforma em operação na ANP", "plataformas em operação na ANP", "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/arquivos-fase-de-desenvolvimento-e-producao/lpo"],
    "SEC-ANP-DUTO": ["duto na lista da ANP", "dutos na lista da ANP", "https://www.gov.br/anp/pt-br/assuntos/exploracao-e-producao-de-oleo-e-gas/desenvolvimento-e-producao/lista-de-codigos"],
    "CAPTURA-DOU": ["ato no Diário Oficial da União, o mais recente de até cinco guardados", "atos no Diário Oficial da União, os mais recentes da busca, cada um com resumo", found?.linhas?.[0]?.url || "https://www.in.gov.br/consulta/-/buscar/dou"],
    "CAPTURA-QD": ["trecho no diário municipal", "trechos no diário municipal", found?.linhas?.[0]?.url || "https://queridodiario.ok.org.br/"],
    "CAPTURA-SIGPUB": ["matéria no diário dos municípios", "matérias no diário dos municípios", found?.linhas?.[0]?.url || "https://www.diariomunicipal.com.br/"],
    "CAPTURA-DOM-METAWAY": ["edição do diário oficial do município", "edições do diário oficial do município", found?.linhas?.[0]?.url || "https://lencois.mentor.metaway.com.br/diario/"],
    "CAPTURA-DOE-BA": ["página do Diário Oficial da Bahia", "páginas do Diário Oficial da Bahia", found?.linhas?.[0]?.url || "https://dool.egba.ba.gov.br/"],
    "CAPTURA-DOE-PR": ["página do Diário Oficial do Paraná", "páginas do Diário Oficial do Paraná", found?.linhas?.[0]?.url || "https://www.dioe.pr.gov.br/"],
    "CAPTURA-DOE-SP": ["ato do Diário Oficial de São Paulo", "atos do Diário Oficial de São Paulo", found?.linhas?.[0]?.url || "https://www.doe.sp.gov.br/"],
    "CAPTURA-DOE-MG": ["trecho do Jornal Minas Gerais", "trechos do Jornal Minas Gerais", found?.linhas?.[0]?.url || "https://www.jornalminasgerais.mg.gov.br/"],
    "SEC-SEMAD": ["licença ambiental da SEMAD", "licenças ambientais da SEMAD", found?.linhas?.[0]?.url || "https://geoserver.meioambiente.mg.gov.br/ows"],
    ...Object.fromEntries(DOE_ESTADOS.map((estado) => [estado.codigo, [
      `${estado.unidade === "matéria" ? "ato" : estado.unidade} do diário oficial (${estado.uf})`,
      `${estado.unidade === "matéria" ? "atos" : estado.unidade === "edição" ? "edições" : "páginas"} do diário oficial (${estado.uf})`,
      found?.linhas?.[0]?.url || estado.portal,
    ]])),
  };
  if (amostras[codigo]) {
    const [one, many, url] = amostras[codigo];
    const note = annotateAmostra(one, many, found);
    if (!note) return false;
    return addEvidenceOnce(project.id, codigo, {
      url,
      titulo: note.texto,
      ...evidencePayload(project, note),
    });
  }
  if (LIVE[codigo] || REGISTRO[codigo]) {
    const note = annotateRegistro(codigo, found);
    if (!note) return false;
    return addEvidenceOnce(project.id, codigo, {
      url: (REGISTRO[codigo] || {}).url || LIVE[codigo],
      titulo: note.texto,
      ...evidencePayload(project, note),
    });
  }
  if (codigo === "SEC-IBAMA") {
    const note = annotateIbama(found);
    if (!note) return false;
    return addEvidenceOnce(project.id, codigo, {
      url: SISLIC_URL,
      titulo: note.texto,
      ...evidencePayload(project, note),
    });
  }
  return false;
}

function describeCno(hit) {
  const amostra = hit.amostra
    .slice(0, 3)
    .map((row) => `${row.cno} em ${row.municipio || "—"}/${row.uf || "—"} (${row.empresa || "sem nome"})`)
    .join("; ");
  return [
    `${hit.total} obra(s) da mesma raiz de CNPJ no CNO.`,
    `${hit.noUf} no estado do projeto, ${hit.noMunicipio} no município, ${hit.mesmoCnpj} no CNPJ exato.`,
    periodSentence(hit.noPeriodo || 0, hit.desde, hit.statusEm),
    amostra ? `Amostra: ${amostra}.` : "",
    "Inscrição cadastral da Receita. Não é, por si, o CapEx desta ficha.",
  ].filter(Boolean).join(" ");
}

async function writeCnoEvidence(project, hit) {
  const note = annotateCno(hit);
  if (!note) return false;
  return addEvidenceOnce(project.id, "SEC-CNO", {
    url: CNO_URL,
    titulo: note.texto,
    ...evidencePayload(project, note, {
      total_raiz: hit.total,
      no_uf: hit.noUf,
      no_municipio: hit.noMunicipio,
      mesmo_cnpj: hit.mesmoCnpj,
      no_periodo: hit.noPeriodo || 0,
      ...(hit.totais ? { totais: hit.totais } : {}),
    }),
  });
}

const LIMITE_LINHAS = { "CAPTURA-SIGPUB": 5, "CAPTURA-DOU": 5, "SEC-BNDES": 12 };

// Só fica o registro com correlação direta com o projeto: mesmo estado e contexto que aponta para esta obra.
async function correlateFound(project, codigo, found, options = {}) {
  const lines = linesOf(found);
  if (!found || !lines.length) return { found, resumo: null, vazio: true };
  const judge = options.judge === undefined ? judgeEvidenceContext : options.judge;
  const { kept, resumo } = await correlateLines(project, codigo, lines, { judge });
  return {
    found: rebuildFound(codigo, found, kept, {
      since: periodStart(project.status_em),
      limite: LIMITE_LINHAS[codigo] || 8,
    }),
    resumo,
    vazio: kept.length === 0,
  };
}

async function consultViableSources(project, options = {}) {
  const sources = sourcesForProject(project)
    .filter((source) => source.codigo !== "SEC-CNO" || !options.skipCno);
  const gravadas = [];
  const vazias = [];
  const removidas = [];
  const relatorio = [];
  for (const source of sources.filter((item) => item.codigo !== "SEC-CNO")) {
    let found = null;
    try {
      found = await querySource(
        source.codigo,
        onlyDigits(project.cnpj),
        project.empresa_nome,
        periodStart(project.status_em),
        project,
      );
    } catch {
      vazias.push(source.codigo);
      continue;
    }
    const correlated = await correlateFound(project, source.codigo, found, options);
    relatorio.push({ codigo: source.codigo, correlacao: correlated.resumo, linhas: linesOf(correlated.found) });
    if (options.dryRun) continue;
    if (correlated.vazio) {
      if (await removeSourceEvidence(project.id, source.codigo)) removidas.push(source.codigo);
      vazias.push(source.codigo);
      continue;
    }
    const wrote = await writeSourceEvidence({ ...project, correlacao: correlated.resumo }, source.codigo, correlated.found);
    if (wrote === "created" || wrote === "updated") gravadas.push(source.codigo);
  }
  return { sources, gravadas, vazias, removidas, relatorio };
}

function correlatedCnoHit(project, hit, kept) {
  const since = periodStart(project.status_em);
  const city = fold(project.municipio || "");
  return {
    ...hit,
    total: kept.length,
    noUf: kept.filter((row) => row.uf === project.uf).length,
    noMunicipio: kept.filter((row) => city && fold(row.municipio || "").includes(city)).length,
    mesmoCnpj: kept.filter((row) => row.ni === onlyDigits(project.cnpj).padStart(14, "0")).length,
    noPeriodo: kept.filter((row) => since && row.inicio && row.inicio >= since).length,
    amostra: kept,
  };
}

async function enrichProject(project, options = {}) {
  project = await ensureStatusDate(project);
  let perfil = null;
  if (!onlyDigits(project.cnpj)) {
    perfil = await completeProfile(project);
    if (!perfil.cnpj) return { fase: "perfil", mensagem: perfil.mensagem };
    project = { ...project, cnpj: perfil.cnpj, empresa_nome: perfil.razao };
  }

  const consulta = await consultViableSources(project, options);
  if (!options.skipCno) {
    const hits = await matchCno([project]);
    const hit = hits.get(project.id);
    const judge = options.judge === undefined ? judgeEvidenceContext : options.judge;
    const { kept, resumo } = await correlateLines(project, "SEC-CNO", hit?.amostra || [], { judge });
    consulta.relatorio.push({ codigo: "SEC-CNO", correlacao: resumo, linhas: kept });
    if (!options.dryRun) {
      if (!kept.length) {
        if (await removeSourceEvidence(project.id, "SEC-CNO")) consulta.removidas.push("SEC-CNO");
      } else {
        const wrote = await writeCnoEvidence({ ...project, correlacao: resumo }, correlatedCnoHit(project, hit, kept));
        if (wrote) consulta.gravadas.push("SEC-CNO");
      }
    }
  }
  const nomes = consulta.sources.map((source) => source.codigo.replace("SEC-", "")).join(", ");
  const mensagem = [
    perfil?.mensagem || `Perfil já completo, CNPJ ${onlyDigits(project.cnpj)}.`,
    `Fontes percorridas: ${nomes}.`,
    consulta.gravadas.length
      ? `Evidências anotadas: ${consulta.gravadas.join(", ")}.`
      : "Nenhuma evidência nova nessas fontes.",
    consulta.removidas.length
      ? `Sem correlação direta com o projeto, saíram: ${consulta.removidas.join(", ")}.`
      : "",
  ].filter(Boolean).join(" ");
  return { fase: "coleta", mensagem, consulta };
}

async function updateProjectFromEvidence(project) {
  const { rows } = await pool.query(
    `select f.codigo, e.trecho, e.campos_extraidos
     from evidencia e
     join fonte f on f.id = e.id_fonte
     where e.id_projeto = $1
       and e.papel = 'secundaria'
       and jsonb_exists(e.campos_extraidos, 'linhas')
     order by f.codigo`,
    [project.id],
  );
  if (!rows.length) {
    return { fase: "status", mensagem: "Não há evidências anotadas para atualizar o status." };
  }
  const decision = await interpretProjectStatus(project, rows);
  await updateProjectReading(project.id, {
    status: decision.status,
    leitura: decision.descricao,
  });
  return {
    fase: "status",
    status: decision.status,
    mensagem: decision.descricao,
  };
}

module.exports = {
  correlateFound,
  enrichProject,
  ensureStatusDate,
  matchCno,
  updateProjectFromEvidence,
  writeCnoEvidence,
};
