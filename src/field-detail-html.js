const LIST_HEAD =
  /(?:Nest[ae]\s+(?:esta\s+)?edi(?:ç|c)[ãa]o\s+há\s+\d+[^:]*:\s*|Nest[ae]\s+(?:esta\s+)?edi(?:ç|c)[ãa]o[^:]{0,120}?(?:textos|valores)\s*:\s*|Mais\s+frequentes:\s*|\d+\s+preenchidos,\s*\d+\s+valores[^:]*:\s*)/i;

function parseEnumItem(part) {
  const trimmed = String(part || "").trim().replace(/\.$/, "");
  if (!trimmed) return null;
  if (/^e\s+mais\s+\d+/i.test(trimmed)) return { kind: "tail", text: trimmed };
  const match = trimmed.match(/^(.+?)\s*\(([\d.,]+)\)$/);
  if (match) {
    return { kind: "item", label: match[1].trim(), count: match[2] };
  }
  return { kind: "item", label: trimmed, count: null };
}

function splitEnumTail(text) {
  const parts = String(text || "").split(/;\s+/);
  const items = [];
  let tail = null;
  for (const part of parts) {
    const parsed = parseEnumItem(part);
    if (!parsed) continue;
    if (parsed.kind === "tail") tail = parsed.text;
    else items.push(parsed);
  }
  return { items, tail };
}

function parseFieldDetail(raw) {
  const text = String(raw || "").trim();
  if (!text) return { blocks: [] };

  const blocks = [];
  let rest = text;

  while (rest) {
    const match = rest.match(LIST_HEAD);
    if (!match || match.index === undefined) {
      if (rest.trim()) blocks.push({ type: "prose", text: rest.trim() });
      break;
    }

    const before = rest.slice(0, match.index).trim();
    if (before) blocks.push({ type: "prose", text: before });

    const label = match[0].trim();
    rest = rest.slice(match.index + match[0].length).trim();

    const nextList = rest.search(LIST_HEAD);
    const nextProse = rest.search(/\.\s+(?=[A-ZÀ-ÚN"«(])/);
    let cut = rest.length;
    if (nextList > 0 && (nextProse < 0 || nextList <= nextProse)) cut = nextList;
    else if (nextProse > 0) cut = nextProse + 1;

    const segment = rest.slice(0, cut).trim().replace(/\.$/, "");
    rest = rest.slice(cut).trim();

    const { items, tail } = splitEnumTail(segment);
    if (items.length >= 2 || (items.length === 1 && items[0].count)) {
      blocks.push({ type: "list", label, items, tail });
    } else {
      blocks.push({ type: "prose", text: `${label} ${segment}`.trim() });
    }
  }

  if (!blocks.length) blocks.push({ type: "prose", text });
  return { blocks };
}

function renderEnumList(items, esc, preview = 12) {
  const li = (item) => {
    const count = item.count
      ? `<span class="field-enum__count">${esc(item.count)}</span>`
      : "";
    return `<li><span class="field-enum__label">${esc(item.label)}</span>${count}</li>`;
  };
  if (items.length <= preview) {
    return `<ul class="field-enum">${items.map(li).join("")}</ul>`;
  }
  const head = items.slice(0, preview);
  const more = items.slice(preview);
  return `
    <ul class="field-enum">${head.map(li).join("")}</ul>
    <details class="field-enum-more">
      <summary>Mais ${esc(String(more.length))} valores</summary>
      <ul class="field-enum">${more.map(li).join("")}</ul>
    </details>`;
}

function fieldDetailHtml(detail, esc) {
  const { blocks } = parseFieldDetail(detail);
  const onlyProse = blocks.length === 1 && blocks[0].type === "prose";
  if (onlyProse && !/\(\d+\)/.test(blocks[0].text)) {
    return `<div class="field-spec__body"><p>${esc(blocks[0].text)}</p></div>`;
  }

  const parts = blocks.map((block) => {
    if (block.type === "prose") {
      return `<p class="field-spec__intro">${esc(block.text)}</p>`;
    }
    const list = renderEnumList(block.items, esc);
    const tail = block.tail
      ? `<p class="field-spec__tail muted">${esc(block.tail)}</p>`
      : "";
    return `
      <p class="field-spec__list-label">${esc(block.label.replace(/:\s*$/, ""))}</p>
      ${list}
      ${tail}`;
  });

  return `<div class="field-spec__body">${parts.join("")}</div>`;
}

function fieldSpecRow(chave, tipo, detalhe, esc) {
  return `
    <article class="field-spec">
      <header class="field-spec__head">
        <code class="field-spec__name">${esc(chave)}</code>
        <span class="field-spec__type">${esc(tipo)}</span>
      </header>
      ${fieldDetailHtml(detalhe, esc)}
    </article>`;
}

module.exports = {
  fieldDetailHtml,
  fieldSpecRow,
  parseFieldDetail,
};
