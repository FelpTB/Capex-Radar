const ACCESS_ORDER = {
  bloqueado: 0,
  indisponivel: 1,
  instavel: 2,
  ok: 3,
};

const ROLE_ORDER = {
  primaria: 0,
  secundaria: 1,
};

const FREQUENCY_ORDER = {
  alta: 0,
  media: 1,
  baixa: 2,
  desconhecida: 3,
};

function filterAndSortSources(sources, query = {}) {
  const acesso = query.acesso || "";
  const papel = query.papel || "";
  const recorrencia = query.recorrencia || "";
  const extracao = query.extracao || "";
  const noticia = query.noticia || "";
  const estagio = query.estagio || "";
  const abrangencia = query.abrangencia || "";
  const ordenar = query.ordenar || "nome";

  const filtered = sources.filter((source) => {
    if (acesso && source.status_acesso !== acesso) return false;
    if (papel && source.tipo !== papel) return false;
    if (recorrencia && source.frequencia_projetos !== recorrencia) return false;
    if (extracao && source.categoria !== extracao) return false;
    if (noticia && source.esfera_noticia !== noticia) return false;
    if (estagio && source.estagio !== estagio) return false;
    if (abrangencia && source.abrangencia !== abrangencia) return false;
    return true;
  });

  return [...filtered].sort((left, right) => {
    let comparison = 0;
    if (ordenar === "acesso") {
      comparison = (ACCESS_ORDER[left.status_acesso] ?? 9)
        - (ACCESS_ORDER[right.status_acesso] ?? 9);
    } else if (ordenar === "papel") {
      comparison = (ROLE_ORDER[left.tipo] ?? 9) - (ROLE_ORDER[right.tipo] ?? 9);
    } else if (ordenar === "recorrencia") {
      comparison = (FREQUENCY_ORDER[left.frequencia_projetos] ?? 9)
        - (FREQUENCY_ORDER[right.frequencia_projetos] ?? 9);
    }
    if (comparison !== 0) return comparison;
    return String(left.nome).localeCompare(String(right.nome), "pt-BR");
  });
}

module.exports = { filterAndSortSources };
