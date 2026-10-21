function plainRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row || {})) {
    if (key === "rank" || value === null || value === undefined) continue;
    out[key] = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  }
  return out;
}

function plainRows(rows, limit = 12) {
  return (rows || []).slice(0, limit).map(plainRow);
}

function pieces(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function annotateBndes(found) {
  if (!found?.n) return null;
  const noPeriodo = found.no_periodo || 0;
  const texto = noPeriodo
    ? `Foram achadas ${pieces(noPeriodo, "operação", "operações")} do BNDES para a empresa nesse período.`
    : `O BNDES tem ${pieces(found.n, "operação", "operações")} da empresa, nenhuma na janela do status.`;
  return { texto, linhas: plainRows(found.linhas) };
}

function annotateCvm(found) {
  const total = found?.total || found?.length || 0;
  if (!total) return null;
  const noPeriodo = found.noPeriodo || 0;
  const base = noPeriodo
    ? `Foram achados ${pieces(noPeriodo, "documento", "documentos")} da CVM para a empresa nesse período.`
    : `A CVM tem ${pieces(total, "documento", "documentos")} da empresa, nenhum na janela do status.`;
  const lidos = Number(found.lidos) || 0;
  const leitura = lidos === 1
    ? " Um documento recente foi convertido em Markdown."
    : lidos > 1
      ? ` ${lidos} documentos recentes foram convertidos em Markdown.`
      : "";
  return { texto: base + leitura, linhas: plainRows(found) };
}

function annotateSiga(rows) {
  if (!rows?.length) return null;
  const noPeriodo = rows.filter((row) => row.no_periodo).length;
  const texto = noPeriodo
    ? `Foram achados ${pieces(noPeriodo, "empreendimento", "empreendimentos")} de geração da empresa no SIGA nesse período.`
    : `O SIGA tem ${pieces(rows.length, "empreendimento", "empreendimentos")} de geração da empresa, nenhum com entrada na janela do status.`;
  return { texto, linhas: plainRows(rows) };
}

function annotateIbama(rows) {
  if (!rows?.length) return null;
  const noPeriodo = rows.filter((row) => row.no_periodo).length;
  const texto = noPeriodo
    ? `Foram achadas ${pieces(noPeriodo, "licença federal", "licenças federais")} da empresa no Ibama nesse período.`
    : `O Ibama tem ${pieces(rows.length, "licença", "licenças")} da empresa, nenhuma na janela do status.`;
  return { texto, linhas: plainRows(rows) };
}

function annotateRegistro(codigo, rows) {
  if (!rows?.length) return null;
  const nomes = {
    "SEC-ANTT-INV": "ANTT",
    "SEC-ANTAQ-INST": "ANTAQ",
    "SEC-OBRASGOV": "ObrasGov",
    "SEC-OBRAS-MG": "obras de Minas Gerais",
    "SEC-IAT": "licenças do Paraná",
    "SEC-ANP-EP": "blocos da ANP",
    "SEC-ANA-SNIRH": "outorgas de água",
    "CAPTURA-SIGMINE": "títulos minerários",
    "CAPTURA-ONS-PAR": "obras planejadas de transmissão",
  };
  const nome = nomes[codigo] || codigo;
  return {
    texto: `Foram achados ${pieces(rows.length, "registro", "registros")} da empresa em ${nome}.`,
    linhas: plainRows(rows),
  };
}

function annotateAmostra(one, many, found) {
  const linhas = found?.linhas || [];
  const total = found?.total || 0;
  if (!total) return null;
  const amostra = total > linhas.length ? ` A comprovação mostra ${linhas.length}.` : "";
  return {
    texto: `Foram achados ${pieces(total, one, many)} da empresa.${amostra}`,
    linhas: plainRows(linhas),
  };
}

function annotateCno(hit) {
  if (!hit?.total) return null;
  const noPeriodo = hit.noPeriodo || 0;
  const texto = hit.desde
    ? (noPeriodo
      ? `Foram achadas ${pieces(noPeriodo, "obra", "obras")} para a empresa no Cadastro Nacional de Obras nesse período.`
      : `O Cadastro Nacional de Obras tem ${pieces(hit.total, "obra", "obras")} da mesma raiz, nenhuma nesse período.`)
    : `Foram achadas ${pieces(hit.noUf || hit.total, "obra", "obras")} para a empresa no Cadastro Nacional de Obras.`;
  return { texto, linhas: plainRows(hit.amostra) };
}

module.exports = {
  annotateAmostra,
  annotateBndes,
  annotateCno,
  annotateCvm,
  annotateIbama,
  annotateRegistro,
  annotateSiga,
  plainRows,
};
