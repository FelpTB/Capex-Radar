function decodeField(bytes) {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (!utf8.includes("\uFFFD")) return utf8.trim();
  return new TextDecoder("latin1").decode(bytes).trim();
}

function parseDbf(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (buf.length < 32 || buf[0] !== 0x03) {
    throw new Error("DBF inválido.");
  }
  const records = buf.readUInt32LE(4);
  const recordSize = buf.readUInt16LE(10);
  const fields = [];
  let offset = 32;
  while (offset + 32 <= buf.length && buf[offset] !== 0x0d) {
    const name = buf.subarray(offset, offset + 11).toString("latin1").replace(/\0.*/, "").trim();
    fields.push({
      name,
      length: buf[offset + 16],
    });
    offset += 32;
  }
  const header = offset + 1;
  const rows = [];
  for (let index = 0; index < records; index += 1) {
    const start = header + index * recordSize;
    if (start + recordSize > buf.length) break;
    if (buf[start] === 0x2a) continue;
    let cursor = start + 1;
    const row = {};
    for (const field of fields) {
      row[field.name] = decodeField(buf.subarray(cursor, cursor + field.length));
      cursor += field.length;
    }
    rows.push(row);
  }
  return rows;
}

module.exports = { parseDbf, decodeField };
