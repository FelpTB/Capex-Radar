const test = require("node:test");
const assert = require("node:assert/strict");
const { PDFDocument, StandardFonts } = require("pdf-lib");
const { annotateCvm } = require("../src/enrichment/annotate");
const {
  convertCompanyDocuments,
  cvmExcerpt,
  eligibleCvmDocuments,
} = require("../src/enrichment/cvm-docs");
const { documentToMarkdown } = require("../src/documents/to-markdown");

const TODAY = new Date("2026-10-20T15:00:00Z");

function row(protocolo, date, versao = 1) {
  return {
    protocolo,
    versao,
    cnpj: "33000167000101",
    data_entrega: date,
    link: `https://cvm.example/${protocolo}`,
  };
}

test("fica com os cinco documentos mais recentes e deixa de fora o que tem um ano ou mais", () => {
  const chosen = eligibleCvmDocuments([
    row("antigo", "2025-10-20"),
    row("limite", "2025-10-21"),
    row("d1", "2026-10-19"),
    row("d2", "2026-10-18"),
    row("d3", "2026-10-17"),
    row("d4", "2026-10-16"),
    row("d5", "2026-10-15"),
    row("d6", "2026-10-14"),
    row("sem-data", null),
    row("velho", "2024-01-01"),
    { ...row("d1", "2026-01-01", 1), assunto: "primeira" },
    { ...row("d1", "2026-10-19", 3), assunto: "vigente" },
  ], TODAY);
  assert.deepEqual(chosen.map((item) => item.protocolo), ["d1", "d2", "d3", "d4", "d5"]);
  assert.equal(chosen[0].assunto, "vigente");
  assert.equal(chosen[0].versao, 3);
  assert.equal(chosen.some((item) => item.protocolo === "antigo"), false);
  assert.equal(chosen.some((item) => item.protocolo === "limite"), false);
  assert.deepEqual(
    eligibleCvmDocuments([
      row("limite", "2025-10-21"),
      row("antigo", "2025-10-20"),
    ], TODAY).map((item) => item.protocolo),
    ["limite"],
  );
});

test("converte HTML e PDF em markdown e recusa arquivo compactado", async () => {
  const html = await documentToMarkdown(
    Buffer.from("<html><body><h1>Fato</h1><p>Fabrica nova em Cama\u00e7ari.</p></body></html>"),
    { contentType: "text/html" },
  );
  assert.match(html, /^# Fato/);
  assert.match(html, /Cama\u00e7ari/);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("Capex de fabrica nova", { x: 72, y: 720, size: 12, font });
  const text = await documentToMarkdown(Buffer.from(await pdf.save()), { contentType: "application/pdf" });
  assert.match(text, /Capex de fabrica nova/);

  await assert.rejects(
    () => documentToMarkdown(Buffer.from("PK\u0003\u0004resto"), { fileName: "pacote.zip" }),
    /arquivo compactado/,
  );
  await assert.rejects(
    () => documentToMarkdown(Buffer.from("nao e documento")),
    /formato n\u00e3o convertido/,
  );
});

test("baixa so o que ainda nao foi convertido, dentro do limite", async () => {
  const fetched = [];
  const saved = [];
  const ipe = [
    row("P1", "2026-10-01"),
    row("P2", "2026-09-01"),
    row("P3", "2025-10-20"),
    row("P4", "2026-10-19"),
    row("P5", "2026-10-18"),
    row("P6", "2026-10-17"),
    row("P7", "2026-10-16"),
  ];
  const pool = {
    async query(sql, params) {
      if (sql.includes("from enr_cvm_ipe")) {
        assert.match(sql, /interval '1 year'/);
        assert.equal(params[1], "2026-10-20");
        return { rows: ipe };
      }
      if (sql.includes("from enr_cvm_documento")) {
        return {
          rows: [{
            protocolo: "P1",
            versao: 1,
            link: "https://cvm.example/P1",
            markdown: "ja lido",
            status: "ok",
          }],
        };
      }
      saved.push(params);
      return { rows: [] };
    },
  };
  const docs = await convertCompanyDocuments("33.000.167/0001-01", {
    pool,
    now: TODAY,
    fetchDocument: async (url) => {
      fetched.push(url);
      return {
        buffer: Buffer.from("<html><body><p>Investimento aprovado</p></body></html>"),
        contentType: "text/html",
      };
    },
  });
  assert.deepEqual(docs.map((item) => item.protocolo), ["P4", "P5", "P6", "P7", "P1"]);
  assert.deepEqual(fetched, [
    "https://cvm.example/P4",
    "https://cvm.example/P5",
    "https://cvm.example/P6",
    "https://cvm.example/P7",
  ]);
  assert.equal(docs.find((item) => item.protocolo === "P1").markdown, "ja lido");
  assert.equal(saved.length, 4);
  assert.match(saved[0][5], /Investimento aprovado/);
});

test("nao baixa de novo um formato que ja falhou", async () => {
  const fetched = [];
  const pool = {
    async query(sql) {
      if (sql.includes("from enr_cvm_ipe")) return { rows: [row("Z1", "2026-10-02")] };
      if (sql.includes("from enr_cvm_documento")) {
        return {
          rows: [{
            protocolo: "Z1",
            versao: 1,
            link: "https://cvm.example/Z1",
            markdown: null,
            status: "erro",
            erro: "arquivo compactado",
          }],
        };
      }
      throw new Error("nao deveria gravar de novo");
    },
  };
  const docs = await convertCompanyDocuments("33000167000101", {
    pool,
    now: TODAY,
    fetchDocument: async (url) => {
      fetched.push(url);
      return { buffer: Buffer.from("x"), contentType: "text/plain" };
    },
  });
  assert.deepEqual(fetched, []);
  assert.equal(docs[0].erro, "arquivo compactado");
});

test("a anotacao da CVM conta os documentos convertidos", () => {
  const found = [{ assunto: "A", texto: "corpo do fato" }];
  found.total = 4;
  found.noPeriodo = 2;
  found.lidos = 2;
  const note = annotateCvm(found);
  assert.match(note.texto, /2 documentos da CVM/);
  assert.match(note.texto, /2 documentos recentes foram convertidos em Markdown/);
  assert.equal(note.linhas[0].texto, "corpo do fato");
  assert.equal(cvmExcerpt("a".repeat(2005)).endsWith("\u2026"), true);
});
