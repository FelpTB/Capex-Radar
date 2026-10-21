const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  csvMembers,
  davFolderUrlFor,
  downloadUrlFor,
  extractCsvs,
  filenameFromDisposition,
  isStale,
  parseDavListing,
  pickResource,
  TARGETS,
} = require("../src/enrichment/dadosgov");

test("pasta compartilhada vira endereço WebDAV e a listagem traz datas", () => {
  assert.equal(
    davFolderUrlFor("https://arquivos.receitafederal.gov.br/index.php/s/YggdBLfdninEJX9"),
    "https://arquivos.receitafederal.gov.br/public.php/dav/files/YggdBLfdninEJX9/",
  );
  assert.equal(davFolderUrlFor("https://www.gov.br/x.pdf"), null);
  const xml = `<d:multistatus><d:response><d:href>/public.php/dav/files/Y/</d:href>
    <d:propstat><d:prop><d:getlastmodified>Mon, 14 Sep 2026 15:08:06 GMT</d:getlastmodified></d:prop></d:propstat></d:response>
    <d:response><d:href>/public.php/dav/files/Y/2026-09/</d:href>
    <d:propstat><d:prop><d:getlastmodified>Mon, 14 Sep 2026 15:00:00 GMT</d:getlastmodified></d:prop></d:propstat></d:response></d:multistatus>`;
  assert.deepEqual(parseDavListing(xml), [
    { nome: "Y", lastModified: "Mon, 14 Sep 2026 15:08:06 GMT" },
    { nome: "2026-09", lastModified: "Mon, 14 Sep 2026 15:00:00 GMT" },
  ]);
});

test("link de compartilhamento da Receita ganha /download", () => {
  assert.equal(
    downloadUrlFor("https://arquivos.receitafederal.gov.br/index.php/s/PC6732BXG9B98W3"),
    "https://arquivos.receitafederal.gov.br/index.php/s/PC6732BXG9B98W3/download",
  );
  assert.equal(
    downloadUrlFor("https://arquivos.receitafederal.gov.br/index.php/s/PC6732BXG9B98W3/download"),
    "https://arquivos.receitafederal.gov.br/index.php/s/PC6732BXG9B98W3/download",
  );
  assert.equal(
    downloadUrlFor("https://www.gov.br/receitafederal/dados/cno-metadados.pdf"),
    "https://www.gov.br/receitafederal/dados/cno-metadados.pdf",
  );
});

test("escolhe o recurso de dados ZIP e ignora o PDF", () => {
  const dataset = {
    recursos: [
      { id: "a", tipo: "DICIONARIO_DE_DADOS", formato: "PDF", titulo: "Dicionário" },
      { id: "b", tipo: "DADOS", formato: "ZIP", titulo: "Inscrições no CNO" },
    ],
  };
  assert.equal(pickResource(dataset, { tipo: "DADOS", formato: "ZIP" }).id, "b");
  assert.equal(pickResource(dataset, { tipo: "DICIONARIO_DE_DADOS" }).id, "a");
  assert.equal(pickResource(dataset, { tipo: "DADOS", titulo: /regime/i }), null);
});

test("fica desatualizado quando a origem muda data, tamanho ou URL", () => {
  const remote = {
    link: "https://x/download",
    lastModified: "Thu, 01 Oct 2026 05:18:13 GMT",
    contentLength: 100,
  };
  const current = { arquivo: "cno.zip", ...remote };
  assert.equal(isStale(current, remote), false);
  assert.equal(isStale(null, remote), true);
  assert.equal(isStale({ ...current, lastModified: "Wed, 30 Sep 2026 05:00:00 GMT" }, remote), true);
  assert.equal(isStale({ ...current, contentLength: 99 }, remote), true);
  assert.equal(isStale({ ...current, link: "https://y/download" }, remote), true);
  assert.equal(isStale(current, { ...remote, lastModified: null }), true);
});

test("o dicionário do CNO não entra na conferência e o ZIP lista os cinco CSV", () => {
  const cno = TARGETS.filter((target) => target.conjunto === "cadastro-nacional-de-obras-cno");
  const zip = cno.find((target) => target.arquivo === "cno.zip");
  const pdf = cno.find((target) => target.arquivo === "cno-metadados.pdf");
  assert.deepEqual(zip.extrairCsv, ["cno.csv", "cno_cnaes.csv", "cno_vinculos.csv", "cno_areas.csv", "cno_totais.csv"]);
  assert.equal(pdf.conferir, false);
});

test("extrai só os CSV do ZIP e exige a lista pedida", async () => {
  assert.deepEqual(csvMembers(["cno.csv", "leia.txt", "nested/cno_areas.csv", "vazio/"]), ["cno.csv", "nested/cno_areas.csv"]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cno-zip-"));
  const source = path.join(dir, "origem");
  fs.mkdirSync(source);
  for (const name of ["cno.csv", "cno_cnaes.csv", "cno_vinculos.csv", "cno_areas.csv", "cno_totais.csv"]) {
    fs.writeFileSync(path.join(source, name), `"CNO"\n1\n`);
  }
  fs.writeFileSync(path.join(source, "leia.txt"), "fora");
  const zip = path.join(dir, "cno.zip");
  const packed = spawnSync("tar", ["-a", "-cf", zip, "-C", source, "cno.csv", "cno_cnaes.csv", "cno_vinculos.csv", "cno_areas.csv", "cno_totais.csv", "leia.txt"]);
  assert.equal(packed.status, 0, packed.stderr.toString());
  const out = path.join(dir, "saida");
  const names = await extractCsvs(zip, out, ["cno.csv", "cno_totais.csv"]);
  assert.equal(names.includes("leia.txt"), false);
  assert.equal(fs.existsSync(path.join(out, "cno.csv")), true);
  assert.equal(fs.existsSync(path.join(out, "cno_totais.csv")), true);
  assert.equal(fs.existsSync(path.join(out, "leia.txt")), false);
  await assert.rejects(extractCsvs(zip, out, ["ausente.csv"]));
});

test("nome do arquivo vem do content-disposition", () => {
  assert.equal(
    filenameFromDisposition("attachment; filename*=UTF-8''cno.zip; filename=\"cno.zip\""),
    "cno.zip",
  );
  assert.equal(filenameFromDisposition('attachment; filename="cno-metadados.pdf"'), "cno-metadados.pdf");
  assert.equal(filenameFromDisposition(null), null);
});
