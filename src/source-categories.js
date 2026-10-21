const SOURCE_CATEGORIES = {
  api_publica: {
    label: "API Pública",
    description: "API aberta, sem chave ou cadastro, consultada diretamente pelo sistema.",
  },
  api_privada: {
    label: "API Privada",
    description: "API que exige cadastro e credencial de acesso, mantida somente no backend.",
  },
  dataset_download: {
    label: "Dataset para download",
    description: "Arquivo estruturado, como CSV ou ZIP, baixado para processamento em lote.",
  },
  base_consultavel: {
    label: "Base consultável",
    description: "Base extensa acessada por formulário ou pesquisa pontual em um portal.",
  },
  portal_web: {
    label: "Portal Web",
    description: "Páginas, listagens ou notícias lidas por navegação e extração de HTML.",
  },
};

function sourceCategory(key) {
  return SOURCE_CATEGORIES[key] || {
    label: key || "Não classificada",
    description: "Forma de extração ainda não classificada.",
  };
}

module.exports = { SOURCE_CATEGORIES, sourceCategory };
