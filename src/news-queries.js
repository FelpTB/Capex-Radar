const NEWS_QUERIES = [
  {
    id: "fabrica",
    label: "Investimento em fábrica, planta ou data center",
    q: 'investimento (fábrica OR planta OR "data center") (bilhões OR milhões)',
  },
  {
    id: "anuncio",
    label: "Empresa anuncia fábrica, usina ou terminal",
    q: 'empresa anuncia (fábrica OR usina OR terminal) investimento',
  },
  {
    id: "aporte",
    label: "Aporte em indústria, mineração ou data center",
    q: '"aporte" (indústria OR mineração OR "data center")',
  },
];

function googleNewsUrl(query) {
  const params = new URLSearchParams({
    q: query,
    hl: "pt-BR",
    gl: "BR",
    ceid: "BR:pt-419",
  });
  return `https://news.google.com/search?${params}`;
}

function googleNewsRssUrl(query) {
  const params = new URLSearchParams({
    q: query,
    hl: "pt-BR",
    gl: "BR",
    ceid: "BR:pt-419",
  });
  return `https://news.google.com/rss/search?${params}`;
}

module.exports = { NEWS_QUERIES, googleNewsUrl, googleNewsRssUrl };
