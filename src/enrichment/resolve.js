function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function fold(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function nameTerm(project) {
  const raw = String(project.empresa_nome || project.nome || "").trim();
  const folded = fold(raw).replace(/[%_]/g, "");
  if (folded.length < 3) return null;
  return folded;
}

function groupByCnpj(hits) {
  const groups = new Map();
  for (const hit of hits) {
    const cnpj = onlyDigits(hit.cnpj);
    if (cnpj.length !== 14) continue;
    const current = groups.get(cnpj) || {
      cnpj,
      nomes: new Set(),
      bases: new Set(),
      linhas: 0,
    };
    if (hit.nome) current.nomes.add(String(hit.nome).trim());
    if (hit.base) current.bases.add(hit.base);
    current.linhas += Number(hit.linhas || 1);
    groups.set(cnpj, current);
  }
  return [...groups.values()].map((group) => ({
    cnpj: group.cnpj,
    nomes: [...group.nomes],
    bases: [...group.bases],
    linhas: group.linhas,
  }));
}

function chooseCompany(groups) {
  if (groups.length === 1) {
    return {
      cnpj: groups[0].cnpj,
      motivo: "Um único CNPJ apareceu nas bases carregadas para esse nome.",
    };
  }
  return {
    cnpj: null,
    motivo: groups.length
      ? "Mais de um CNPJ usa esse nome. A ficha fica sem número até uma fonte desempatar."
      : "Nenhuma base carregada devolveu esse nome.",
  };
}

function sameRoot(left, right) {
  return onlyDigits(left).slice(0, 8) === onlyDigits(right).slice(0, 8);
}

function cadastroMatches(cadastro, term) {
  const haystack = fold(`${cadastro.razao_social || ""} ${cadastro.nome_fantasia || ""}`);
  return haystack.includes(term);
}

const OWNER_PATTERN = /para\s+(.+?)\s+-\s+(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/g;

function ownersFromParticipacao(participacao) {
  const owners = [];
  for (const match of String(participacao || "").matchAll(OWNER_PATTERN)) {
    owners.push({ nome: match[1].trim(), cnpj: onlyDigits(match[2]) });
  }
  return owners;
}

module.exports = {
  onlyDigits,
  fold,
  nameTerm,
  groupByCnpj,
  chooseCompany,
  sameRoot,
  cadastroMatches,
  ownersFromParticipacao,
};
