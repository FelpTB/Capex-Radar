const test = require("node:test");
const assert = require("node:assert/strict");
const {
  noticiasDoRss,
  tituloSemVeiculo,
  chaveDedupe,
  janelas,
  janelaSemanal,
  motivoDescarte,
  citaEmpresa,
  coletarGrupo,
  triarGrupo,
} = require("../src/capex-coletor");
const { lerTriagem, lerVinculo } = require("../src/capex-ia");

function item(n, { titulo = `Bracell investe na fábrica ${n}`, veiculo = "Valor Econômico" } = {}) {
  return `<item><title>${titulo} - ${veiculo}</title>
    <link>https://news.google.com/rss/articles/ART${n}?oc=5</link>
    <guid isPermaLink="false">ART${n}</guid>
    <pubDate>Fri, 21 Feb 2025 08:00:00 GMT</pubDate>
    <source url="https://valor.globo.com">${veiculo}</source></item>`;
}

function rss(itens) {
  return `<?xml version="1.0"?><rss><channel>${itens.join("")}</channel></rss>`;
}

const GRUPO = {
  id: "g1",
  nome: "Bracell",
  nicho: "papel_celulose",
  linhas: [{ termo: "Bracell", tipo: "marca" }, { termo: "Prefeitura de Bracell", tipo: "exclusao" }],
  contexto: ["fábrica", "investimento"],
};

// Cliente pg falso: guarda o que foi gravado e responde às consultas do coletor.
function clienteFalso({ pendentes = [], filiais = [], projetos = [] } = {}) {
  const chaves = new Set();
  const estado = { evidencias: [], janelas: [], updates: [], vinculos: [], atores: [] };
  return {
    estado,
    async query(sql, params = []) {
      if (/^(begin|commit|rollback)/.test(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes("set_config('capex_radar.ator'")) { estado.atores.push(params[0]); return { rows: [] }; }
      if (sql.includes("from capex_radar.coleta_janela")) return { rows: [] };
      if (sql.includes("insert into capex_radar.coleta_janela")) {
        estado.janelas.push({ desde: params[2], ate: params[3], itens: params[5], novos: params[6], status: params[7] });
        return { rowCount: 1 };
      }
      if (sql.includes("insert into capex_radar.evidencias")) {
        if (chaves.has(params[1])) return { rowCount: 0 };
        chaves.add(params[1]);
        estado.evidencias.push({ chave: params[1], titulo: params[2], veiculo: params[4] });
        return { rowCount: 1 };
      }
      if (sql.includes("from capex_radar.evidencias")) return { rows: pendentes };
      if (sql.includes("from capex_radar.vw_filiais")) return { rows: filiais.filter((f) => f.uf === params[1]) };
      if (sql.includes("from capex_radar.projetos")) return { rows: projetos };
      if (sql.includes("update capex_radar.evidencias")) { estado.updates.push({ sql, params }); return { rowCount: 1 }; }
      if (sql.includes("insert into capex_radar.evidencia_projeto")) { estado.vinculos.push(params); return { rowCount: 1 }; }
      throw new Error(`consulta inesperada: ${sql.slice(0, 80)}`);
    },
  };
}

test("lê o RSS do Google News e tira o veículo do título", () => {
  const [noticia] = noticiasDoRss(rss([item(1)]));
  assert.equal(noticia.titulo, "Bracell investe na fábrica 1");
  assert.equal(noticia.veiculo, "Valor Econômico");
  assert.equal(noticia.veiculo_url, "https://valor.globo.com");
  assert.equal(noticia.publicado_em, "2025-02-21T08:00:00.000Z");
  assert.equal(chaveDedupe(noticia), "gnews:ART1");
});

test("título sem o sufixo do veículo fica como está", () => {
  assert.equal(tituloSemVeiculo("Klabin amplia Puma", "Valor"), "Klabin amplia Puma");
});

test("fatia a janela em trimestres com fim exclusivo", () => {
  assert.deepEqual(janelas("2023-01-01", "2023-08-15", 3), [
    { desde: "2023-01-01", ate: "2023-04-01" },
    { desde: "2023-04-01", ate: "2023-07-01" },
    { desde: "2023-07-01", ate: "2023-08-15" },
  ]);
});

test("janela semanal cobre os últimos 14 dias até amanhã", () => {
  assert.deepEqual(janelaSemanal(new Date("2026-11-05T12:00:00Z")), { desde: "2026-10-22", ate: "2026-11-06" });
});

test("regras descartam só exclusão; título sem a empresa segue marcado, ignorando acento e caixa", () => {
  const termos = { termos: ["Três Corações"], exclusoes: ["Prefeitura de Três Corações"] };
  assert.equal(motivoDescarte("TRES CORACOES inaugura fábrica", termos), null);
  assert.match(motivoDescarte("Prefeitura de Três Corações abre obra", termos), /Exclusão/);
  assert.equal(motivoDescarte("Gigante do café investe R$ 1 bi em fábrica", termos), null);
  assert.equal(citaEmpresa("TRES CORACOES inaugura fábrica", termos), true);
  assert.equal(citaEmpresa("Gigante do café investe R$ 1 bi em fábrica", termos), false);
});

test("coleta grava cada notícia uma vez e registra a janela", async () => {
  const client = clienteFalso();
  const feed = async () => rss([item(1), item(2), item(1)]);
  const resumo = await coletarGrupo({ client, grupo: GRUPO, desde: "2025-01-01", ate: "2025-04-01", fetchFeed: feed, pausaMs: 0 });
  assert.equal(resumo.itens, 3);
  assert.equal(resumo.novos, 2);
  assert.deepEqual(client.estado.janelas, [{ desde: "2025-01-01", ate: "2025-04-01", itens: 3, novos: 2, status: "ok" }]);
  assert.ok(client.estado.atores.every((ator) => ator === "sistema:coletor"));
});

test("trimestre no teto do RSS é refeito mês a mês", async () => {
  const client = clienteFalso();
  const urls = [];
  const feed = async (url) => {
    urls.push(url);
    const cheio = urls.length === 1;
    return rss(Array.from({ length: cheio ? 95 : 2 }, (_v, i) => item(`${urls.length}-${i}`)));
  };
  const resumo = await coletarGrupo({ client, grupo: GRUPO, desde: "2025-01-01", ate: "2025-04-01", fetchFeed: feed, pausaMs: 0 });
  assert.equal(urls.length, 4);
  assert.deepEqual(client.estado.janelas.map((j) => j.status), ["subdividida", "ok", "ok", "ok"]);
  assert.equal(resumo.novos, 6);
  assert.match(new URL(urls[1]).searchParams.get("q"), /after:2025-01-01 before:2025-02-01/);
});

test("erro numa janela não interrompe as outras", async () => {
  const client = clienteFalso();
  let n = 0;
  const feed = async () => { n += 1; if (n === 1) throw new Error("HTTP 503"); return rss([item(n)]); };
  const resumo = await coletarGrupo({ client, grupo: GRUPO, desde: "2025-01-01", ate: "2025-07-01", fetchFeed: feed, pausaMs: 0 });
  assert.equal(resumo.erros, 1);
  assert.deepEqual(client.estado.janelas.map((j) => j.status), ["erro", "ok"]);
});

test("triagem: regras, IA, filial sugerida e vínculo com projeto existente", async () => {
  const pendentes = [
    { id: "e1", titulo: "Bracell anuncia fábrica em Lençóis Paulista", veiculo: "Valor" },
    { id: "e2", titulo: "Bracell tem lucro recorde", veiculo: "InfoMoney" },
    { id: "e3", titulo: "Prefeitura de Bracell abre concurso", veiculo: "Exame" },
    { id: "e4", titulo: "Bracell amplia viveiro em Bahia", veiculo: "A Tarde" },
  ];
  const filiais = [
    { cnpj: "11111111000101", municipio: "LENCOIS PAULISTA", uf: "SP", prioridade: "industrial" },
    { cnpj: "11111111000202", municipio: "ITAPETININGA", uf: "SP", prioridade: "insumo" },
  ];
  const projetos = [{ id: "p1", titulo: "Fábrica Bahia", uf: "BA" }];
  const client = clienteFalso({ pendentes, filiais, projetos });
  const lotes = [];
  const ia = {
    modelo: "teste",
    async triar(_grupo, lote) {
      lotes.push(lote.map((n) => n.id));
      return new Map([
        ["e1", { capex: true, motivo: "fábrica", uf: "SP", municipio: "Lençóis Paulista" }],
        ["e2", { capex: false, motivo: "resultado financeiro" }],
        ["e4", { capex: true, motivo: "viveiro", uf: "BA", municipio: null }],
      ]);
    },
    async vincular(_grupo, noticia) {
      return noticia.id === "e4"
        ? { projeto_id: "p1", confianca: 80, motivo: "mesmo ativo" }
        : { projeto_id: null, confianca: 30, motivo: "outro ativo" };
    },
  };
  const resumo = await triarGrupo({ client, grupo: GRUPO, ia });

  assert.deepEqual(lotes, [["e1", "e2", "e4"]]);
  assert.equal(resumo.regras, 1);
  assert.equal(resumo.ia_descartadas, 1);
  assert.equal(resumo.capex, 2);
  assert.equal(resumo.novos_projetos, 1);
  assert.equal(resumo.sugeridos, 1);

  const e1 = client.estado.updates.find((u) => u.params[0] === "e1");
  const extracao = JSON.parse(e1.params[1]);
  assert.equal(extracao.filial_sugerida.cnpj, "11111111000101");
  assert.equal(extracao.filial_sugerida.criterio, "municipio");
  assert.equal(e1.params[5], false); // sem vínculo: novo_projeto
  assert.deepEqual(client.estado.vinculos, [["e4", "p1", 80, "mesmo ativo", "teste"]]);
});

test("sem IA só as regras rodam", async () => {
  const client = clienteFalso({ pendentes: [{ id: "e1", titulo: "Bracell amplia fábrica" }, { id: "e2", titulo: "Prefeitura de Bracell" }] });
  const resumo = await triarGrupo({ client, grupo: GRUPO, ia: null });
  assert.equal(resumo.regras, 1);
  assert.equal(client.estado.updates.length, 1);
});

test("lote com erro da IA fica pendente", async () => {
  const client = clienteFalso({ pendentes: [{ id: "e1", titulo: "Bracell amplia fábrica" }] });
  const ia = { modelo: "teste", triar: async () => { throw new Error("JSON inválido"); } };
  const resumo = await triarGrupo({ client, grupo: GRUPO, ia });
  assert.equal(resumo.erros_ia, 1);
  assert.equal(client.estado.updates.length, 0);
});

test("lê a resposta da triagem pelo índice do lote", () => {
  const lote = [{ id: "a" }, { id: "b" }];
  const raw = JSON.stringify({ itens: [
    { i: 1, capex: true, motivo: "fábrica", uf: "ms", valor_brl: 1000, estagio: "anuncio", data_fato: "2025-02" },
    { i: 0, capex: false, motivo: "bolsa" },
    { i: 9, capex: true, motivo: "fora do lote" },
  ] });
  const decisoes = lerTriagem(raw, lote);
  assert.equal(decisoes.size, 2);
  assert.equal(decisoes.get("b").uf, "MS");
  assert.equal(decisoes.get("a").municipio, null);
  assert.throws(() => lerTriagem(JSON.stringify({ itens: [{ i: 0, capex: true, motivo: "x", estagio: "obra" }] }), lote));
});

test("vínculo fora da lista de projetos vira null", () => {
  const projetos = [{ id: "p1" }];
  assert.equal(lerVinculo(JSON.stringify({ projeto_id: "p1", confianca: 90, motivo: "ok" }), projetos).projeto_id, "p1");
  assert.equal(lerVinculo(JSON.stringify({ projeto_id: "p9", confianca: 90, motivo: "ok" }), projetos).projeto_id, null);
});
