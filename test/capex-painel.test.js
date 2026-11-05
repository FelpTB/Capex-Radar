const test = require("node:test");
const assert = require("node:assert/strict");

// O módulo da tela importa db.js, que exige a URI do banco; o pool não conecta sem consulta.
process.env.SUPABASE_STRING ||= "postgres://teste:teste@localhost:5432/teste";
const {
  situacaoNoticia,
  resumoExtracao,
  projetoSchema,
  paginaMonitoramento,
  paginaNoticia,
  paginaProjeto,
} = require("../src/capex-painel");

const GRUPO = { id: "2b1c3d4e-0000-4000-8000-000000000001", nome: "Bracell", nicho: "papel_celulose" };

test("situação da notícia na revisão", () => {
  assert.equal(situacaoNoticia({ triagem: "vinculada" }).rotulo, "vinculada");
  assert.equal(situacaoNoticia({ triagem: "pendente", sugerido_projeto_id: "p1" }).rotulo, "vínculo sugerido");
  assert.equal(situacaoNoticia({ triagem: "novo_projeto" }).rotulo, "possível projeto");
  assert.equal(situacaoNoticia({ triagem: "pendente", extracao: { capex: true } }).rotulo, "a revisar");
  assert.equal(situacaoNoticia({ triagem: "pendente", extracao: null }).rotulo, "sem triagem");
});

test("resumo da leitura da IA numa linha", () => {
  const linha = resumoExtracao({ capex: true, objeto: "nova fábrica", uf: "MS", municipio: "Bataguassu", valor_brl: 25e9, estagio: "licenciamento" });
  assert.match(linha, /nova fábrica · Bataguassu \/ MS · R\$\s?25\.000\.000\.000 · Licenciamento/);
  assert.equal(resumoExtracao({ capex: false, motivo: "resultado financeiro" }), "resultado financeiro");
  assert.equal(resumoExtracao(null), "");
});

test("formulário do projeto: valor com ponto, campos vazios viram null, UF maiúscula", () => {
  const dados = projetoSchema.parse({
    titulo: "Bracell — fábrica MS", matriz_cnpj: "12345678000190", filial_cnpj: "", uf: "ms",
    municipio: "", objeto: "fábrica", valor_estimado_brl: "25.000.000.000", estagio: "anuncio", data_anuncio: "",
  });
  assert.equal(dados.valor_estimado_brl, 25e9);
  assert.equal(dados.filial_cnpj, null);
  assert.equal(dados.uf, "MS");
  assert.equal(dados.data_anuncio, null);
  assert.throws(() => projetoSchema.parse({ ...dados, matriz_cnpj: "123", estagio: "anuncio" }));
});

test("página de monitoramento escapa o título e mostra o botão de triagem", () => {
  const html = paginaMonitoramento({
    grupos: [{ ...GRUPO, total: 3, nao_triadas: 2, revisar: 1, vinculadas: 0, descartadas: 0, projetos: 0, ultima_coleta: null }],
    noticias: [{ id: "n1", titulo: "<b>Bracell</b> investe", veiculo: "Valor", data_original: "2025-02-21T08:00:00Z", triagem: "novo_projeto", grupo: "Bracell", extracao: { capex: true, objeto: "fábrica" } }],
    filtros: { grupo: null, situacao: "revisar" },
    totalProjetos: 0,
    notice: "",
  });
  assert.match(html, /&lt;b&gt;Bracell&lt;\/b&gt; investe/);
  assert.match(html, /Triar com IA/);
  assert.match(html, /possível projeto/);
  assert.match(html, /href="\/monitoramento" class|class="active" href="\/monitoramento"/);
});

test("notícia sem matriz não oferece criar projeto", () => {
  const html = paginaNoticia({
    noticia: { id: "n1", titulo: "Shein abre CD", grupo: "Shein", grupo_id: GRUPO.id, nicho: "ecommerce", triagem: "novo_projeto", extracao: { capex: true, uf: "SP" } },
    vinculos: [], projetos: [], matrizes: [], filiais: [], notice: "",
  });
  assert.match(html, /ainda não tem CNPJ cadastrado/);
  assert.doesNotMatch(html, /action="\/monitoramento\/noticias\/n1\/projeto"/);
});

test("formulário pré-preenche a filial sugerida pela IA", () => {
  const html = paginaNoticia({
    noticia: { id: "n1", titulo: "Bracell amplia fábrica", grupo: "Bracell", grupo_id: GRUPO.id, nicho: "papel_celulose", triagem: "novo_projeto",
      data_original: "2025-02-21T08:00:00Z", extracao: { capex: true, objeto: "ampliação", uf: "SP", filial_sugerida: { cnpj: "11111111000101", uf: "SP", municipio: "LENCOIS PAULISTA", prioridade: "industrial", criterio: "municipio" } } },
    vinculos: [], projetos: [],
    matrizes: [{ cnpj: "11111111000101", razao_social: "BRACELL SP", papel: "principal", uf: "SP" }],
    filiais: [{ cnpj: "11111111000101", uf: "SP", municipio: "LENCOIS PAULISTA", prioridade: "industrial" }],
    notice: "",
  });
  assert.match(html, /<option value="11111111000101" selected>LENCOIS PAULISTA \/ SP/);
  assert.match(html, /name="data_anuncio" type="date" value="2025-02-21"/);
});

test("página do projeto tem exclusão com confirmação", () => {
  const html = paginaProjeto({
    projeto: { id: "p1", titulo: "Fábrica MS", grupo: "Bracell", nicho: "papel_celulose", estagio: "anuncio", flag_validacao: "A_VALIDAR", matriz_razao_social: "BRACELL", matriz_cnpj: "1" },
    timeline: [{ evidencia_id: "n1", titulo: "Bracell anuncia", primaria: true, data_original: null }],
    notice: "",
  });
  assert.match(html, /action="\/monitoramento\/projetos\/p1\/excluir"/);
  assert.match(html, /confirm\('Excluir este projeto e as 1 evidência/);
});
