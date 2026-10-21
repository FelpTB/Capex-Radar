function onlyDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 14 ? digits : null;
}

function cnpjsInText(value) {
  const found = new Set();
  const text = String(value || "");
  const pattern = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;
  for (const match of text.matchAll(pattern)) {
    const digits = onlyDigits(match[0]);
    if (digits) found.add(digits);
  }
  return [...found];
}

function parseDecimal(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "----------" || text === ",00") return null;
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function parseDate(value) {
  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  const day = iso?.[1] || (br ? `${br[3]}-${br[2]}-${br[1]}` : null);
  if (!day) return null;
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : day;
}

function field(record, ...names) {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  for (const [key, value] of Object.entries(record)) {
    if (!wanted.has(String(key).toLowerCase())) continue;
    const text = clean(value);
    if (text) return text;
  }
  return null;
}

function clean(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "----------") return null;
  return text;
}

function csvRows(text, delimiter = ";") {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  function pushField() {
    row.push(field);
    field = "";
  }

  function pushRow() {
    pushField();
    if (row.some((cell) => cell !== "")) rows.push(row);
    row = [];
  }

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      pushField();
    } else if (char === "\n") {
      pushRow();
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length || row.length) pushRow();
  return rows;
}

function parseCsv(text, delimiter = ";") {
  const rows = csvRows(text, delimiter);
  if (!rows.length) return [];

  const start = rows.findIndex((cells) => cells.filter((cell) => cell.trim()).length > 1);
  if (start < 0) return [];
  const header = rows[start].map((name) => name.trim());
  return rows.slice(start + 1).map((cells) => {
    const record = {};
    header.forEach((name, index) => {
      record[name] = cells[index] ?? "";
    });
    return record;
  });
}

function mapBndes(record) {
  return {
    cnpj: onlyDigits(record.cnpj),
    cliente: clean(record.cliente),
    descricao: clean(record.descricao_do_projeto),
    uf: clean(record.uf),
    municipio: clean(record.municipio),
    municipio_codigo: clean(record.municipio_codigo),
    numero_contrato: clean(record.numero_do_contrato),
    data_contratacao: parseDate(record.data_da_contratacao),
    valor_contratado: parseDecimal(record.valor_contratado_reais),
    valor_desembolsado: parseDecimal(record.valor_desembolsado_reais),
    produto: clean(record.produto),
    forma_apoio: clean(record.forma_de_apoio),
    natureza_cliente: clean(record.natureza_do_cliente),
    porte_cliente: clean(record.porte_do_cliente),
    situacao_contrato: clean(record.situacao_do_contrato),
  };
}

function sigaDate(value) {
  const day = parseDate(value);
  if (!day || day <= "1900-12-31") return null;
  return day;
}

function sigaAgentKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\d/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sigaCnpjIndex(records) {
  const byCeg = new Map();
  for (const record of records || []) {
    const ceg = clean(record.CodCEG);
    const cnpjs = cnpjsInText(record.DscPropriRegimePariticipacao);
    if (!ceg || !cnpjs.length) continue;
    byCeg.set(ceg, {
      chave: sigaAgentKey(record.DscPropriRegimePariticipacao),
      cnpjs,
      edicao: parseDate(record.DatGeracaoConjuntoDados),
    });
  }
  return byCeg;
}

function mapSiga(record, prior) {
  const ceg = clean(record.CodCEG);
  if (!ceg) return null;
  const participacao = clean(record.DscPropriRegimePariticipacao);
  let cnpjs = cnpjsInText(participacao);
  let cnpjEdicao = null;
  if (!cnpjs.length && prior && typeof prior.get === "function") {
    const old = prior.get(ceg);
    if (old && old.chave === sigaAgentKey(participacao)) {
      cnpjs = old.cnpjs;
      cnpjEdicao = old.edicao;
    }
  }
  return {
    cod_ceg: ceg,
    nome: clean(record.NomEmpreendimento),
    nucleo_ceg: clean(record.IdeNucleoCEG),
    uf: clean(record.SigUFPrincipal),
    tipo_geracao: clean(record.SigTipoGeracao),
    fase: clean(record.DscFaseUsina),
    origem_combustivel: clean(record.DscOrigemCombustivel),
    fonte_combustivel: clean(record.DscFonteCombustivel),
    tipo_outorga: clean(record.DscTipoOutorga),
    nome_fonte: clean(record.NomFonteCombustivel),
    potencia_kw: parseDecimal(record.MdaPotenciaOutorgadaKw),
    potencia_fiscalizada_kw: parseDecimal(record.MdaPotenciaFiscalizadaKw),
    garantia_fisica_kw: parseDecimal(record.MdaGarantiaFisicaKw),
    geracao_qualificada: clean(record.IdcGeracaoQualificada),
    latitude: parseDecimal(record.NumCoordNEmpreendimento),
    longitude: parseDecimal(record.NumCoordEEmpreendimento),
    municipios: clean(record.DscMuninicpios),
    sub_bacia: clean(record.DscSubBacia),
    cnpjs,
    participacao,
    cnpj_edicao: cnpjEdicao,
    entrada_operacao: sigaDate(record.DatEntradaOperacao),
    inicio_vigencia: sigaDate(record.DatInicioVigencia),
    fim_vigencia: sigaDate(record.DatFimVigencia),
    gerado_em: sigaDate(record.DatGeracaoConjuntoDados),
  };
}

function mapSislic(record) {
  const stamp = String(field(record, "ultima_atualizacao_relatorio") || "");
  const clock = stamp.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  const atualizadoEm = clock
    ? `${clock[3]}-${clock[2]}-${clock[1]}${clock[4] ? `T${clock[4]}:${clock[5]}:00` : ""}`
    : null;
  return {
    tipo_licenca: field(record, "des_tipolicenca"),
    numero_licenca: field(record, "num_licenca"),
    data_emissao: parseDate(field(record, "dat_emissao")),
    data_vencimento: parseDate(field(record, "dat_vencimento")),
    empreendimento: field(record, "nom_empreendimento"),
    pessoa: field(record, "nom_pessoa"),
    processo: field(record, "num_processo_ibama"),
    tipologia: field(record, "des_tipologia", "desc_tipologia"),
    pac: field(record, "pac"),
    atualizado_em: atualizadoEm,
  };
}

function filledPayload(record) {
  const payload = {};
  for (const [key, value] of Object.entries(record || {})) {
    const name = String(key).replace(/^\uFEFF/, "").trim();
    if (!name) continue;
    const text = clean(value);
    if (text) payload[name] = text;
  }
  return payload;
}

function mapAnp(record) {
  const operador = field(record, "OPERADOR");
  const bloco = field(record, "BLOCO");
  if (!operador && !bloco) return null;
  const contratados = field(record, "CONTRATADOS");
  return {
    chave: null,
    cnpj: null,
    cnpjs: cnpjsInText(`${operador || ""} ${contratados || ""}`),
    titulo: [operador, contratados].filter(Boolean).join(" "),
    uf: null,
    municipio: null,
    valor: null,
    payload: {
      ...filledPayload(record),
      bloco,
      contrato: field(record, "CONTRATO"),
      operador,
      contratados,
      bacia: field(record, "BACIA"),
      ambiente: field(record, "AMBIENTE"),
      periodo: field(record, "PERÍODO", "PERIODO"),
      rodada: field(record, "RODADA"),
      regime: field(record, "REGIME CONTRATUAL"),
    },
  };
}

function parseAnttCsv(text) {
  const source = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = source.split("\n").filter((line) => line.length);
  if (!lines.length) return [];
  const header = lines[0].split(";").map((name) => name.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(";");
    const record = {};
    header.forEach((name, index) => {
      record[name] = cells[index] ?? "";
    });
    return record;
  });
}

function ufFromRodovia(value) {
  const match = String(value || "").trim().match(/\/([A-Za-z]{2})$/);
  return match ? match[1].toUpperCase() : null;
}

function mapAntt(record) {
  const payload = {};
  for (const [key, value] of Object.entries(record || {})) {
    const text = clean(value);
    if (text) payload[key] = text;
  }
  if (!Object.keys(payload).length) return null;
  const concessionaria = field(record, "concessionaria");
  const descricao = field(record, "Descricao", "titulo", "tipo_de_Obra", "tipo_de_obra");
  const rodovia = field(record, "Rodovia", "rodovia");
  return {
    chave: null,
    cnpj: null,
    cnpjs: [],
    titulo: descricao || [concessionaria, field(record, "ano")].filter(Boolean).join(" "),
    uf: field(record, "estado") || ufFromRodovia(rodovia),
    municipio: null,
    valor: parseDecimal(field(record, "Valor_Contratual", "Valor")),
    payload,
  };
}

function mapLoose(record) {
  const entries = Object.entries(record).filter(([, value]) => clean(value));
  if (!entries.length) return null;
  const cnpjs = cnpjsInText(entries.map(([, value]) => value).join(" "));
  const read = (pattern) => {
    const found = entries.find(([key]) => pattern.test(key));
    return found ? clean(found[1]) : null;
  };
  const valorEntry = entries.find(([key]) => /valor|investimento|^vl_/i.test(key));
  return {
    chave: null,
    cnpj: cnpjs[0] || null,
    cnpjs,
    titulo: read(/nome|empreendimento|objeto|descri|projeto|concession/i),
    uf: read(/(^|_)uf($|_)|sigla_uf|^estado$/i),
    municipio: read(/municip/i),
    valor: valorEntry ? parseDecimal(valorEntry[1]) : null,
    payload: Object.fromEntries(entries),
  };
}

function mapObrasgov(item) {
  const cnpjs = new Set();
  const add = (value) => {
    const digits = onlyDigits(value);
    if (digits) cnpjs.add(digits);
  };
  add(item.cnpj_organizacao_resp);
  for (const row of item.executores || []) add(row.cnpj_executor);
  for (const row of item.tomadores || []) add(row.cnpj_tomador);
  for (const row of item.repassadores || []) add(row.cnpj_repassador || row.cnpj);
  const valor = (item.investimentos_previstos || [])
    .map((row) => Number(row.vl_investimento_previsto))
    .filter((number) => Number.isFinite(number))
    .reduce((sum, number) => sum + number, 0);
  const list = [...cnpjs];
  const chave = clean(item.id_projeto_investimento);
  if (!chave) return null;
  return {
    chave,
    cnpj: list[0] || null,
    cnpjs: list,
    titulo: clean(item.desc_nome),
    uf: clean(item.uf_principal),
    municipio: null,
    valor: valor || null,
    payload: {
      situacao: item.situacao || null,
      endereco: item.desc_endereco || null,
      projeto: item.desc_projeto || null,
      natureza: item.natureza_intervencao || null,
      especie: item.especie_intervencao || null,
      inicio_previsto: item.dt_inicial_prevista || null,
      fim_previsto: item.dt_final_prevista || null,
      organizacao: item.organizacao_resp || null,
      investimentos: item.investimentos_previstos || [],
      executores: item.executores || [],
      tomadores: item.tomadores || [],
      repassadores: item.repassadores || [],
    },
  };
}

function mapIat(attributes) {
  if (!attributes) return null;
  const chave = clean(attributes.num_protocolo) || clean(attributes.objectid);
  if (!chave) return null;
  return {
    chave,
    cnpj: null,
    cnpjs: [],
    titulo: clean(attributes.nome_razao_social),
    uf: clean(attributes.uf) || "PR",
    municipio: clean(attributes.nome_municipio),
    valor: null,
    payload: {
      objectid: attributes.objectid ?? null,
      protocolo: clean(attributes.num_protocolo),
      modalidade: attributes.sigla_modalidade || null,
      modalidade_descricao: attributes.desc_modalidade || null,
      grupo: attributes.desc_grupo_atividade || null,
      atividade: attributes.desc_atividade || null,
      emissao: attributes.dt_emissao || null,
      validade: attributes.dt_validade || null,
      ibge: attributes.cod_ibge || null,
      x: attributes.x ?? null,
      y: attributes.y ?? null,
    },
  };
}

function foldKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function foldedField(record, ...names) {
  const wanted = new Set(names);
  for (const [key, value] of Object.entries(record)) {
    if (!wanted.has(foldKey(key))) continue;
    const text = clean(value);
    if (text) return text.replace(/\s+/g, " ");
  }
  return null;
}

function mapAntaq(record) {
  const empresa = foldedField(record, "empresa autorizada");
  if (!empresa) return null;
  const uf = foldedField(record, "uf");
  const municipio = foldedField(record, "municipio");
  return {
    chave: null,
    cnpj: null,
    cnpjs: cnpjsInText(empresa),
    titulo: empresa,
    uf: uf ? uf.toUpperCase() : null,
    municipio,
    valor: null,
    payload: {
      numero: foldedField(record, "no", "n"),
      empresa,
      municipio,
      uf,
      regiao: foldedField(record, "regiao"),
      tipo: foldedField(record, "tipo instalacao"),
      perfil: foldedField(record, "perfil de carga"),
      carga: foldedField(record, "tipo de carga"),
      outorga: foldedField(record, "instrumento de outorga"),
    },
  };
}

const CVM_CATEGORIES = new Set([
  "fato relevante",
  "comunicado ao mercado",
]);

function mapCvm(record, ano) {
  const categoria = clean(record.Categoria);
  if (!categoria || !CVM_CATEGORIES.has(categoria.toLowerCase())) return null;
  const protocolo = clean(record.Protocolo_Entrega);
  if (!protocolo) return null;
  return {
    protocolo,
    versao: Number(record.Versao) || 1,
    cnpj: onlyDigits(record.CNPJ_Companhia),
    codigo_cvm: clean(record.Codigo_CVM),
    nome: clean(record.Nome_Companhia),
    categoria,
    tipo: clean(record.Tipo),
    especie: clean(record.Especie),
    assunto: clean(record.Assunto),
    tipo_apresentacao: clean(record.Tipo_Apresentacao),
    data_entrega: parseDate(record.Data_Entrega),
    data_referencia: parseDate(record.Data_Referencia),
    link: clean(record.Link_Download),
    ano,
  };
}

module.exports = {
  CVM_CATEGORIES,
  clean,
  cnpjsInText,
  csvRows,
  filledPayload,
  mapAnp,
  mapAntaq,
  mapBndes,
  mapCvm,
  mapAntt,
  mapIat,
  mapLoose,
  parseAnttCsv,
  ufFromRodovia,
  mapObrasgov,
  mapSiga,
  sigaCnpjIndex,
  mapSislic,
  onlyDigits,
  parseCsv,
  parseDate,
  parseDecimal,
};
