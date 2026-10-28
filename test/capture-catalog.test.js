const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CAPTURE_PROFILES,
  DASHBOARD_PROFILES,
  POSSIBLE_SOURCES,
  captureProfile,
  esferaNoticia,
  sourcesForSeed,
} = require("../src/capture-catalog");

test("mapeia todas as fontes operacionais sem ligar a coleta geral", () => {
  const profiles = Object.values(CAPTURE_PROFILES);
  assert.equal(Object.keys(CAPTURE_PROFILES).length, 73);
  assert.equal(profiles.filter((profile) => profile.participa_scanner).length, 6);
  assert.equal(captureProfile("NEWS-INFRA").participa_scanner, true);
  assert.equal(captureProfile("NEWS-INVESTNEWS").participa_scanner, true);
  assert.equal(captureProfile("NEWS-ANEEL").participa_scanner, false);
  assert.equal(esferaNoticia("NEWS-ANEEL"), "publica");
  assert.equal(esferaNoticia("NEWS-INFOMONEY"), "privada");
  assert.equal(esferaNoticia("SEC-OBRASGOV"), null);
  assert.equal(captureProfile("NEWS-PETRO").participa_scanner, false);
  assert.equal(captureProfile("SEC-OBRASGOV").formato_dado, "json_api");
  assert.equal(captureProfile("SEC-PDT"), null);
  assert.equal(captureProfile("NEWS-ECONOMIA-PAYWALL").auth_acesso, "captcha_paywall");
  assert.equal(Object.keys(DASHBOARD_PROFILES).length, 44);
  assert.equal(captureProfile("CAPTURA-SINISA").participa_scanner, false);
  const seeded = sourcesForSeed();
  assert.equal(seeded.length, 44);
  assert.ok(seeded.every((source) => source.peculiaridade && source.conteudo && source.url));
  assert.equal(seeded.some((source) => source.codigo === "CAPTURA-ANA-METAS"), false);
});

test("avalia candidatas sem tratá-las como fonte operacional", () => {
  const byCode = Object.fromEntries(
    POSSIBLE_SOURCES.map((source) => [source.codigo, source]),
  );
  assert.equal(byCode["CAPTURA-REIDI"].decisao, "mapear");
  assert.equal(byCode["CAPTURA-DNIT"].decisao, "mapear");
  assert.equal(byCode["CAPTURA-QD"].decisao, "mapear");
  assert.equal(byCode["CAPTURA-SIGMINE"].decisao, "mapear");
  assert.equal(byCode["CAPTURA-DNIT-PDT"], undefined);
  assert.equal(byCode["CAPTURA-TRANSFEREGOV"].decisao, "sobreposicao");
  assert.equal(byCode["CAPTURA-DEBENTURES"].decisao, "sobreposicao");
  assert.equal(byCode["CAPTURA-ANA-METAS"].decisao, "nao_confirmada");
  assert.match(byCode["CAPTURA-SIGMINE"].url, /SIGMINE/);
  for (const source of POSSIBLE_SOURCES) {
    assert.ok(source.familia);
    assert.ok(source.disponibilidade);
    assert.equal(CAPTURE_PROFILES[source.codigo], undefined);
    assert.equal(String(source.url).includes("utm_source=gemini"), false);
    assert.equal(String(source.url).includes("google.com/search"), false);
  }
});
