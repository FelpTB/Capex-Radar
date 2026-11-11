const test = require("node:test");
const assert = require("node:assert/strict");
const perfis = require("../src/capex-perfil");
const sec = require("../src/capex-fontes-secundarias");
const { regraPosLeitura, noticiaAmpla } = require("../src/capex-coletor");
const { correlateLines } = require("../src/enrichment/correlacao");

test("Filtro 1: notícia ampla, sem local nem empresa e valor repetido saem", () => {
  const capex = { capex: true, uf: null, municipio: null, valor_brl: null };
  assert.match(regraPosLeitura({ titulo: "Suzano divulga plano de investimentos de R$ 20 bi", cita_empresa: true }, capex).motivo, /ampla/);
  assert.equal(noticiaAmpla("Suzano investe R$ 2 bi em fábrica no MS", { uf: "MS" }), false);
  assert.match(regraPosLeitura({ titulo: "Gigante investe em nova fábrica", cita_empresa: false }, capex).motivo, /sem local e sem a empresa/);
  assert.equal(regraPosLeitura({ titulo: "Suzano investe em nova fábrica", cita_empresa: true }, capex), null);
  const vivas = [{ id: "a", titulo: "Klabin investe R$ 1,5 bi no PR", data_original: "2025-03-01", valor_brl: 1500000000, uf: "PR" }];
  const repetida = regraPosLeitura(
    { id: "b", titulo: "Klabin anuncia aporte de R$ 1,51 bi", cita_empresa: true, data_original: "2025-03-20" },
    { capex: true, uf: "PR", valor_brl: 1510000000 }, vivas,
  );
  assert.equal(repetida.repete_id, "a");
  assert.equal(regraPosLeitura({ id: "c", titulo: "Klabin", cita_empresa: true, data_original: "2025-09-20" }, { capex: true, uf: "PR", valor_brl: 1500000000 }, vivas), null);
  assert.equal(regraPosLeitura({ titulo: "x" }, { capex: false }), null);
});

test("perfil: inicial pelas manchetes, enriquecido pela matéria, completo pelas fontes", () => {
  const projeto = { objeto: null, uf: "MS", municipio: null, valor_estimado_brl: null, estagio: "anuncio", data_anuncio: null };
  const evidencias = [
    { id: 1, data_original: "2024-03-01", extracao: { objeto: "fábrica de celulose", municipio: "Ribas do Rio Pardo", valor_brl: 19e9 } },
    { id: 2, data_original: "2024-08-01", extracao: { valor_brl: 22e9 }, enriquecimento: { encontrou: true, resumo: "Obra começou.", perfil: { obra: "em_andamento", construtora: "Andritz", uf: "SP" } } },
  ];
  const inicial = perfis.perfilInicial(projeto, evidencias);
  assert.equal(inicial.uf, "MS");
  assert.equal(inicial.origem.uf, "projeto");
  assert.equal(inicial.valor_brl, 22e9);
  assert.equal(inicial.municipio, "Ribas do Rio Pardo");
  assert.equal(inicial.data_anuncio, "2024-03-01");
  const enriquecido = perfis.perfilEnriquecido(inicial, evidencias);
  assert.equal(enriquecido.construtora, "Andritz");
  assert.equal(enriquecido.uf, "MS", "o que veio do projeto não muda");
  assert.equal(enriquecido.resumo, "Obra começou.");
  const completo = perfis.perfilCompleto(enriquecido, {
    registros: [
      { correlacao: "direta", fonte_codigo: "SEC-SISLIC", data_registro: "2024-05-02", registro: { tipo_licenca: "Licença de Instalação", numero_licenca: "123/2024" } },
      { correlacao: "incerta", fonte_codigo: "SEC-SISLIC", registro: { tipo_licenca: "LO" } },
      { correlacao: "direta", fonte_codigo: "SEC-BNDES", registro: { valor_contratado: 1000 } },
    ],
    linhaTempo: { resumo: "Resumo final.", estagio: "mobilizacao" },
  });
  assert.equal(completo.licencas.length, 1);
  assert.equal(completo.licencas[0].numero, "123/2024");
  assert.match(completo.financiamento, /BNDES/);
  assert.equal(completo.estagio, "anuncio", "estágio editado no projeto fica");
  assert.equal(completo.resumo, "Resumo final.");
  assert.equal(completo.fontes.registros_oficiais, 2);
});

test("licença citada na notícia pede evidência do diário oficial", () => {
  const evidencias = [{ id: 9, fonte_codigo: "gnews_rss", titulo: "Fábrica obtém licença de instalação" }];
  assert.deepEqual(perfis.licencaSemDiario(evidencias, []), ["9"]);
  assert.equal(perfis.licencaSemDiario(evidencias, [{ correlacao: "direta", fonte_codigo: "CAPTURA-DOE-SP" }]), null);
  assert.equal(perfis.licencaSemDiario([{ id: 1, fonte_codigo: "gnews_rss", titulo: "Empresa inaugura fábrica" }], []), null);
});

test("cronologia: tira evidência antes do anúncio ou depois da conclusão, nunca todas", () => {
  const projeto = { data_anuncio: "2024-05-10", linha_tempo: { marcos: [{ tipo: "operacao", data: "2025-06" }] } };
  assert.deepEqual(sec.janelaDoProjeto(projeto), { anuncio: "2024-05-10", conclusao: "2025-06-30" });
  const fora = sec.foraDaCronologia(projeto, [
    { id: 1, data_original: "2023-01-01" },
    { id: 2, data_original: "2024-04-20" },
    { id: 3, data_original: "2024-06-01" },
    { id: 4, data_original: "2026-03-01" },
  ]);
  assert.deepEqual(fora.map((f) => f.id), ["1", "4"]);
  assert.deepEqual(sec.foraDaCronologia(projeto, [{ id: 1, data_original: "2020-01-01" }]), []);
  assert.deepEqual(sec.foraDaCronologia({}, [{ id: 1, data_original: "2020-01-01" }]), []);
});

test("Enriquecimento 2 vê todo registro analisado; sem julgamento nada é aceito", async () => {
  const projeto = { uf: "MS", municipio: "Ribas do Rio Pardo" };
  const linhas = [{ uf: "SP", municipio: "Campinas", x: 1 }, { uf: "MS", municipio: "Ribas do Rio Pardo", x: 2 }];
  const vistos = [];
  const r = await correlateLines(projeto, "SEC-X", linhas, { semJulgamento: true, onAnalise: (l, c) => vistos.push([l.x, c]) });
  assert.deepEqual(r.kept, []);
  assert.deepEqual(vistos, [[1, "outro_estado"], [2, "nao_avaliada"]]);
  const vistos2 = [];
  const judge = async (_p, _c, registros) => registros.map((reg) => ({ i: reg.i, correlacao: "direta", motivo: "mesma obra" }));
  const r2 = await correlateLines(projeto, "SEC-X", linhas, { judge, onAnalise: (l, c, m) => vistos2.push([l.x, c, m]) });
  assert.equal(r2.kept.length, 1);
  assert.deepEqual(vistos2[1], [2, "direta", "mesma obra"]);
});
