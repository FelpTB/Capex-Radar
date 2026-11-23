const test = require("node:test");
const assert = require("node:assert/strict");

process.env.SUPABASE_STRING ||= "postgres://teste:teste@localhost:5432/teste";
const diag = require("../src/fontes-diagnostico");

test("categoria da perda pelos motivos gravados", () => {
  const c = (classe, correlacao, motivo) => diag.categoriaDaPerda({ classe, correlacao, motivo });
  assert.equal(c("provavel", "direta", "x"), "aproveitado");
  assert.equal(c("improvavel", "incerta", "x"), "possibilidade");
  assert.equal(c("muito_improvavel", "outro_estado", "UF do registro diferente da UF do projeto."), "outra_uf");
  assert.equal(c("muito_improvavel", "outro_projeto", "Diário sem o município de nenhum projeto da empresa"), "sem_municipio");
  assert.equal(c("muito_improvavel", "outro_projeto", "Pré-triagem: o registro não cita o município do projeto"), "sem_municipio");
  assert.equal(c("muito_improvavel", "outro_projeto", "Pré-triagem: registro de mais de 2 anos antes do anúncio"), "fora_periodo");
  assert.equal(c("muito_improvavel", "outro_projeto", "Lido no julgamento por empresa: sem ligação com este projeto"), "sem_ligacao");
  assert.equal(c(null, "nao_avaliada", "Local: mesmo_municipio"), "nao_avaliado");
  assert.equal(c("muito_improvavel", "outro_projeto", "Capital de giro 2019."), "outro_ato");
});

test("explicações gravadas cobrem as fontes e têm texto", () => {
  const e = diag.lerExplicacoes();
  assert.ok(e.em);
  for (const [codigo, f] of Object.entries(e.fontes)) {
    assert.ok(f.explicacao && f.explicacao.length > 20, codigo);
  }
});

const { semMunicipioMasRelevante, preTriagem } = require("../src/enrichment/correlacao");
const { fontesForaDoSetor } = require("../src/capex-fontes-secundarias");

test("fontes setoriais só para projetos do setor", () => {
  const fabrica = fontesForaDoSetor({ titulo: "Klabin — fábrica de papel", objeto: "nova máquina" });
  assert.ok(fabrica.includes("SEC-ANP-EP") && fabrica.includes("SEC-ANTAQ-INST") && fabrica.includes("SEC-ARTESP"));
  const porto = fontesForaDoSetor({ titulo: "Caramuru — complexo logístico", objeto: "estação de transbordo e terminal portuário" });
  assert.ok(!porto.includes("SEC-ANTAQ-INST"));
});

test("ato estadual sem município vai ao julgamento só com um projeto na UF", () => {
  const texto = "termo de acordo entre a semadesc e a bracell sp celulose ltda";
  assert.equal(semMunicipioMasRelevante("CAPTURA-DOE-MS", texto, 1), true);
  assert.equal(semMunicipioMasRelevante("CAPTURA-DOE-MS", texto, 3), false);
  assert.equal(semMunicipioMasRelevante("CAPTURA-DOE-MS", "licenca florestal fazenda tres topes", 1), false);
  assert.equal(semMunicipioMasRelevante("CAPTURA-REIDI", "bracell sp celulose", 4), true);
  const projeto = { municipio: "Lençóis Paulista", uf: "SP", projetos_na_uf: 2 };
  assert.equal(preTriagem({ razao_social: "BRACELL SP CELULOSE LTDA.", uf: "SP" }, projeto, "CAPTURA-REIDI"), null);
  assert.match(preTriagem({ titulo: "ato qualquer" }, projeto, "CAPTURA-DOE-SP"), /não cita o município/);
});
