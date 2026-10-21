const MAX_CANDIDATES = 30;

const PROPER_WORD =
  String.raw`(?:\p{Lu}[\p{L}\p{M}\d&'’/-]*|[A-ZÀ-Ý][A-ZÀ-Ý\d]{1,}(?:[.-][A-ZÀ-Ý\d]+)*)`;
const CONNECTOR = String.raw`(?:da|das|de|do|dos|e|em|para)`;
const PROPER_NAME =
  String.raw`${PROPER_WORD}(?:\s+(?:${CONNECTOR}\s+)?${PROPER_WORD}){0,6}`;

const PREFIX_PATTERN = new RegExp(
  String.raw`\b(?:[Ee]mpresa|[Cc]ompanhia|[Gg]rupo|[Cc]onsórcio|[Cc]onsorcio|[Cc]oncessionária|[Cc]oncessionaria|[Oo]peradora|[Ff]abricante|[Mm]ineradora|[Hh]olding)\s+(${PROPER_NAME})`,
  "gu",
);
const LEGAL_NAME_PATTERN = new RegExp(
  String.raw`\b(${PROPER_NAME}\s+(?:S\.?\s?A\.?|Ltda\.?|Limitada|EIRELI|SPE))\b`,
  "gu",
);
const VERB_SUBJECT_PATTERN = new RegExp(
  String.raw`\b(${PROPER_NAME})\s+(?:anunciou|anuncia|estima|estimou|planeja|planejou|prevê|previu|investirá|investe|vai\s+investir|construirá|constrói|assinou|assina|venceu|vence|adquiriu|contratou|entrou|conclui|concluiu)\b`,
  "gu",
);
const SUBJECT_PATTERN = new RegExp(
  String.raw`(?:^|[.!?]\s+)(?:A|As|O|Os)?\s*(${PROPER_NAME})\s+(?:anunciou|anuncia|estima|estimou|planeja|planejou|prevê|previu|investirá|investe|vai\s+investir|construirá|constrói|assinou|assina|venceu|vence|adquiriu|contratou)\b`,
  "gmu",
);
const MULTIWORD_PATTERN = new RegExp(
  String.raw`\b(${PROPER_WORD}(?:\s+(?:${CONNECTOR}\s+)?${PROPER_WORD}){1,5})\b`,
  "gu",
);
const ACRONYM_PATTERN = /\b[A-ZÀ-Ý][A-ZÀ-Ý\d&.-]{2,14}\b/gu;

const IGNORED = new Set([
  "agência nacional",
  "assembleia legislativa",
  "câmara municipal",
  "casa civil",
  "diário oficial",
  "governo federal",
  "governo do estado",
  "ministério público",
  "prefeitura municipal",
  "rio de janeiro",
  "s a",
  "são paulo",
  "eireli",
  "ltda",
  "spe",
]);
const IGNORED_FIRST_WORDS = new Set([
  "A", "As", "Em", "Entre", "Governo", "Leilão", "Ministério", "Nova",
  "Novo", "O", "Os", "Projeto", "Segundo", "Uma", "Um",
]);

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\d]+/gu, " ")
    .trim()
    .toLowerCase();
}

function cleanCandidate(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[\s"'“”‘’([{]+|[\s"'“”‘’)\]},;:]+$/g, "")
    .trim();
}

function extractCompanyCandidates(text) {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  if (!source) return [];

  const candidates = new Map();
  const add = (raw, priority) => {
    const name = cleanCandidate(raw);
    const normalized = normalizeName(name);
    const firstWord = name.split(/\s+/)[0];
    if (
      name.length < 3 ||
      name.length > 120 ||
      IGNORED.has(normalized) ||
      (priority >= 3 && IGNORED_FIRST_WORDS.has(firstWord))
    ) return;

    const previous = candidates.get(normalized);
    if (!previous || priority < previous.priority) {
      candidates.set(normalized, { name, priority });
    }
  };

  for (const match of source.matchAll(PREFIX_PATTERN)) add(match[1], 0);
  for (const match of source.matchAll(LEGAL_NAME_PATTERN)) add(match[1], 0);
  for (const match of source.matchAll(SUBJECT_PATTERN)) add(match[1], 1);
  for (const match of source.matchAll(VERB_SUBJECT_PATTERN)) add(match[1], 1);
  for (const match of source.matchAll(ACRONYM_PATTERN)) add(match[0], 2);
  for (const match of source.matchAll(MULTIWORD_PATTERN)) add(match[1], 3);

  const ranked = [...candidates.values()]
    .sort((a, b) => a.priority - b.priority || b.name.length - a.name.length);
  return ranked
    .filter((candidate) => !ranked.some((other) => (
      other !== candidate &&
      other.priority <= candidate.priority &&
      normalizeName(other.name).startsWith(`${normalizeName(candidate.name)} `)
    )))
    .slice(0, MAX_CANDIDATES)
    .map(({ name }) => name);
}

module.exports = { extractCompanyCandidates, normalizeName };
