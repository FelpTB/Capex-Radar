const test = require("node:test");
const assert = require("node:assert/strict");

// O módulo da tela importa db.js, que exige a URI do banco; o pool não conecta sem consulta.
process.env.SUPABASE_STRING ||= "postgres://teste:teste@localhost:5432/teste";
const {
  situacaoNoticia,
  resumoExtracao,
  cardNoticia,
  explicarJanela,
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

test("página de monitoramento: card com título, ações e botões de triagem", () => {
  const html = paginaMonitoramento({
    grupos: [{ ...GRUPO, total: 4, nao_triadas: 2, processando: 1, revisar: 1, vinculadas: 0, descartadas: 0, projetos: 0, ultima_coleta: null }],
    noticias: [{ id: "n1", titulo: "<b>Bracell</b> investe", veiculo: "Valor", data_original: "2025-02-21T08:00:00Z", triagem: "novo_projeto", grupo: "Bracell", grupo_id: GRUPO.id, extracao: { capex: true, objeto: "fábrica" } }],
    filtros: { grupo: null, situacao: "revisar" },
    totalProjetos: 0,
    notice: "",
  });
  assert.match(html, /&lt;b&gt;Bracell&lt;\/b&gt; investe/);
  assert.match(html, /class="button js-triar" type="button" data-grupo="">Processar 3 no funil/);
  assert.match(html, /data-grupo="2b1c3d4e-0000-4000-8000-000000000001">Processar 3</);
  assert.match(html, /data-stat="processando">1</);
  assert.match(html, /possível projeto/);
  assert.match(html, /action="\/monitoramento\/noticias\/n1\/aprovar"/);
  assert.match(html, /action="\/monitoramento\/noticias\/n1\/descartar"/);
  assert.match(html, /<select name="motivo"/);
  assert.match(html, /id="triagem-progresso"/);
  assert.match(html, /src="\/monitoramento.js"/);
});

test("card descartado mostra o motivo e o desfazer; vínculo sugerido muda o botão", () => {
  const descartado = cardNoticia({ id: "n2", titulo: "x", triagem: "descartada", triagem_motivo: "Revisão: não é CapEx", grupo: "Bracell", grupo_id: GRUPO.id });
  assert.match(descartado, /Revisão: não é CapEx/);
  assert.match(descartado, /\/restaurar"/);
  assert.doesNotMatch(descartado, /\/aprovar"/);
  const sugerido = cardNoticia({ id: "n3", titulo: "y", triagem: "pendente", extracao: { capex: true }, sugerido_projeto_id: "p1", sugerido_projeto: "Fábrica MS", sugerido_confianca: 80, grupo: "Bracell", grupo_id: GRUPO.id });
  assert.match(sugerido, /Aceitar vínculo/);
  assert.match(sugerido, /Mesmo projeto que <strong>Fábrica MS<\/strong> \(80%\)/);
});

test("card mostra o perfil enriquecido, a matéria original e o Filtro 3", () => {
  const html = cardNoticia({
    id: "n4", titulo: "Bracell investe", triagem: "novo_projeto", grupo: "Bracell", grupo_id: GRUPO.id,
    extracao: { capex: true, objeto: "fábrica", uf: "SP" },
    enriquecimento: {
      encontrou: true, url_original: "https://valor.globo.com/x", veiculo_original: "Valor",
      resumo: "A Bracell vai construir uma fábrica de tissue em Lençóis Paulista.",
      perfil: { objeto: "fábrica de tissue", uf: "SP", municipio: "Lençóis Paulista", valor_brl: 1500000000, obra: "por_fazer", construtora: "Método" },
    },
    filtro_final: { decisao: "manter", justificativa: "obra nova do grupo" },
  });
  assert.match(html, /fábrica de tissue · Lençóis Paulista \/ SP/);
  assert.match(html, /href="https:\/\/valor.globo.com\/x"[^>]*>matéria original \(Valor\)/);
  assert.match(html, /obra: por fazer · construtora: Método/);
  assert.match(html, /Filtro 3: obra nova do grupo/);
  const semMateria = cardNoticia({ id: "n5", titulo: "x", triagem: "novo_projeto", grupo: "Bracell", grupo_id: GRUPO.id, extracao: { capex: true }, enriquecimento: { encontrou: false, perfil: {} }, em_processamento: true });
  assert.match(semMateria, /matéria original não encontrada/);
  assert.match(semMateria, /em processamento/);
});

test("explica por que uma janela de busca veio vazia ou com erro", () => {
  assert.match(explicarJanela({ status: "erro", erro: "HTTP 503" }), /recusou o servidor/);
  assert.match(explicarJanela({ status: "ok", itens: 0, novos: 0 }), /não devolveu nenhuma matéria/);
  assert.match(explicarJanela({ status: "ok", itens: 12, novos: 0 }), /já estavam guardadas/);
  assert.match(explicarJanela({ status: "subdividida", itens: 98 }), /teto do RSS/);
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

const { paginaCarteira, filtrosCarteira, filtrarCarteira } = require("../src/capex-painel");

const PROJETOS = [
  { id: "p1", titulo: "Fábrica MS", grupo_id: GRUPO.id, grupo: "Bracell", matriz_razao_social: "BRACELL", nicho: "papel_celulose", uf: "MS", municipio: "Bataguassu", estagio: "licenciamento", status: "ativo", valor_estimado_brl: "25000000000", data_anuncio: "2024-03-01", n_evidencias: 4, ultima_evidencia_em: "2025-01-10T00:00:00Z" },
  { id: "p2", titulo: "CD Cajamar", grupo_id: "2b1c3d4e-0000-4000-8000-000000000002", grupo: "Mercado Livre", matriz_razao_social: "EBAZAR", nicho: "ecommerce", uf: "SP", municipio: "Cajamar", estagio: "anuncio", status: "em_revisao", valor_estimado_brl: null, data_anuncio: null, primeira_evidencia_em: "2025-06-01T00:00:00Z", n_evidencias: 1, ultima_evidencia_em: "2025-06-01T00:00:00Z" },
  { id: "p3", titulo: "Linha nova", grupo_id: GRUPO.id, grupo: "Bracell", matriz_razao_social: "BRACELL", nicho: "papel_celulose", uf: "SP", municipio: "Lençóis Paulista", estagio: "operacao", status: "descartado", valor_estimado_brl: "300000000", data_anuncio: "2023-05-01", n_evidencias: 2, ultima_evidencia_em: "2024-01-01T00:00:00Z" },
];

test("filtros da carteira aceitam só valores conhecidos", () => {
  const f = filtrosCarteira({ grupo: "x", nicho: "ecommerce", uf: "sp", estagio: "nada", status: "todos", valor: "1b", ano: "2024", ordem: "valor" });
  assert.deepEqual(f, { grupo: "", nicho: "ecommerce", uf: "SP", estagio: "", status: "todos", valor: "1b", ano: "2024", ordem: "valor" });
  assert.equal(filtrosCarteira({}).ordem, "recentes");
});

test("filtra a carteira por empresa, UF, valor, ano e situação", () => {
  const ids = (q) => filtrarCarteira([...PROJETOS], filtrosCarteira(q)).map((p) => p.id);
  assert.deepEqual(ids({}), ["p2", "p1"]);
  assert.deepEqual(ids({ status: "todos" }), ["p2", "p1", "p3"]);
  assert.deepEqual(ids({ status: "descartado" }), ["p3"]);
  assert.deepEqual(ids({ grupo: GRUPO.id, status: "todos" }), ["p1", "p3"]);
  assert.deepEqual(ids({ uf: "SP" }), ["p2"]);
  assert.deepEqual(ids({ valor: "1b" }), ["p1"]);
  assert.deepEqual(ids({ valor: "sem" }), ["p2"]);
  assert.deepEqual(ids({ valor: "100m", status: "todos" }), ["p3"]);
  assert.deepEqual(ids({ ano: "2025" }), ["p2"]);
  assert.deepEqual(ids({ ordem: "valor", status: "todos" }), ["p1", "p3", "p2"]);
  assert.deepEqual(ids({ ordem: "evidencias" }), ["p1", "p2"]);
});

test("página da carteira mostra filtros, contagem e vazio do filtro", () => {
  const html = paginaCarteira({ projetos: PROJETOS, filtros: filtrosCarteira({ nicho: "papel_celulose" }) });
  assert.match(html, /class="source-filters js-filtros" method="get" action="\/monitoramento\/carteira"/);
  assert.match(html, /<option value="papel_celulose" selected>/);
  assert.match(html, /1 projeto\(s\) neste filtro · R\$\s?25\.000\.000\.000/);
  assert.match(html, /Carteira \(2\)/);
  assert.match(html, /Limpar filtros/);
  const vazio = paginaCarteira({ projetos: PROJETOS, filtros: filtrosCarteira({ uf: "AM" }) });
  assert.match(vazio, /Nenhum projeto neste filtro/);
  assert.match(paginaCarteira({ projetos: [] }), /Nenhum projeto ainda/);
});

test("local do projeto diz quando é só a sede da matriz", () => {
  const { localProjeto } = require("../src/capex-painel");
  assert.equal(localProjeto({ uf: "MS", municipio: null, local_origem: "projeto" }), "MS");
  assert.equal(localProjeto({ uf: "SC", municipio: "CHAPECO", local_origem: "matriz" }), "Sede: CHAPECO / SC");
  assert.equal(localProjeto({ uf: null, municipio: null }), "—");
  const html = paginaCarteira({ projetos: [{ ...PROJETOS[0], uf: "SC", municipio: "CHAPECO", local_origem: "matriz" }] });
  assert.match(html, /<dd>Sede: CHAPECO \/ SC<\/dd>/);
});
