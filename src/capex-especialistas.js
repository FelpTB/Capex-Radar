// Especialistas por fonte: julgam a probabilidade (0-100) de um registro
// oficial estar ligado a um projeto, com as peculiaridades de cada fonte.
// A classe sai da probabilidade (src/capex-classes.js).
//
// Cada especialista tem: as fontes que cobre, o que a fonte é, os sinais que
// aumentam e os que reduzem a probabilidade, e exemplos de faixa. O mesmo
// texto serve para o julgamento pela API (julgarComEspecialista) e para o
// julgamento pelo Claude Code (instrucoesDoEspecialista, no reprocessamento).

const { z } = require("zod");

const ESCALA = `Escala de probabilidade de o registro ser DESTE projeto:
- 75 a 100 (certeira): o registro trata desta obra — mesmo local e objeto/atividade compatível, ou cita o empreendimento.
- 60 a 74 (provável): forte indício, sem citação explícita (mesmo endereço ou área da planta, data compatível, objeto compatível).
- 50 a 59 (incerta): pode ser deste projeto, mas falta um elemento (local, objeto ou data).
- 30 a 49 (improvável): mais provavelmente de outra unidade, outra fase ou rotina, mas não dá para descartar.
- 0 a 29 (muito improvável): outro local, outra atividade, outra empresa ou ato sem relação com obra.`;

const ESPECIALISTAS = {
  cno: {
    nome: "Cadastro Nacional de Obras (CNO)",
    fontes: /^SEC-CNO$/,
    contexto: "Matrícula da obra na Receita Federal. Toda obra de construção civil com responsável PJ é matriculada: o CNO é a prova mais objetiva de que a obra existe, onde é, quando começou e se foi encerrada (situação 15 = encerrada, que indica a obra concluída). Uma obra grande costuma gerar várias matrículas (galpão, caldeira, ETE, subestação), às vezes em nome da construtora ou de outra empresa do grupo.",
    sobe: [
      "mesmo município do projeto (ou município vizinho, para campus que atravessa a divisa)",
      "início da obra perto do anúncio ou durante a obra noticiada",
      "categoria obra nova ou acréscimo, destinação galpão industrial, área compatível com o porte do projeto",
      "nome da obra cita a empresa, a marca, a unidade ou o empreendimento (ex.: 'AMBEV FÁBRICA DE VIDROS', 'Projeto Phoenix')",
      "responsável é a empresa, outra empresa do grupo, ou construtora com o nome do cliente na obra",
      "situação ativa durante a obra, ou encerrada depois dela (conclusão)",
    ],
    desce: [
      "obra pequena (reforma, guarita, casa) ou muito antes do anúncio (obra anterior já concluída)",
      "categoria demolição ou reforma sem relação com a ampliação",
      "nome ou responsável de outra empresa sem ligação com o grupo",
      "situação nula",
    ],
    exemplos: "Obra nova de 36 mil m² em nome da construtora, chamada 'AMBEV FÁBRICA DE V...', no município e no período da fábrica: 90. Galpão de 2 mil m² da empresa no município, iniciado 1 ano antes do anúncio: 62. Reforma de 200 m² cinco anos antes: 15.",
  },
  licenca: {
    nome: "Licenças e atos em diários oficiais",
    fontes: /^(CAPTURA-(DOE|DOU|SIGPUB|QD|DOM)|SEC-(IAT|SEMAD|IBAMA))/,
    contexto: "Atos publicados por órgãos ambientais, prefeituras e governos: licença prévia (LP), de instalação (LI), de operação (LO), de ampliação, autorizações, audiências de EIA/RIMA, alvarás, desapropriações e convênios. A LP e a LI costumam sair antes ou no começo da obra; a LO no fim. O diário cita a empresa pelo CNPJ da filial ou pelo nome; o local aparece no endereço ou no município.",
    sobe: [
      "município ou endereço da planta do projeto",
      "tipo de ato de obra: LP/LI/LO de ampliação, EIA/RIMA, desapropriação para acesso, alvará de construção",
      "atividade compatível com o objeto do projeto (ex.: fabricação de papel para uma fábrica de papel)",
      "data compatível (licença prévia até alguns anos antes do anúncio; LO perto da conclusão)",
      "CNPJ da filial do município",
    ],
    desce: [
      "renovação rotineira de licença de unidade já em operação, sem ampliação",
      "outro município ou outra unidade da empresa",
      "atividade diferente do objeto (ex.: armazém de agrotóxicos para um projeto de armazenagem de grãos)",
      "ato administrativo sem obra: multa, débito, pregão, contrato de serviço, patrocínio, registro na Junta",
    ],
    exemplos: "LI de ampliação no endereço da fábrica, 3 meses depois do anúncio: 88. LO renovada da mesma unidade, sem citar ampliação, durante a obra: 45. Auto de infração da empresa em outro município: 5.",
  },
  outorga: {
    nome: "Outorgas de água (ANA, DAEE, SP Águas, IAT, IGAM)",
    fontes: /^SEC-ANA/,
    contexto: "Direito de uso de recursos hídricos: captação e lançamento de efluentes. Plantas novas ou ampliadas precisam de outorga nova ou maior; plantas em operação renovam periodicamente.",
    sobe: [
      "mesmo município e coordenadas ou bacia da planta",
      "uso industrial/processo fabril, vazão nova ou maior, outorga emitida perto do anúncio ou durante a obra",
    ],
    desce: [
      "renovação da mesma vazão de uma planta antiga",
      "uso só sanitário/limpeza, irrigação, fazenda, outro município",
      "outorga antiga, vencida antes do anúncio",
    ],
    exemplos: "Outorga nova de lançamento de efluente industrial no município, 1 ano depois do anúncio: 72. Renovação de captação sanitária da mesma unidade: 35. Irrigação em fazenda de outro município: 5.",
  },
  financiamento: {
    nome: "Financiamentos e incentivos (BNDES, REIDI, incentivos fiscais estaduais)",
    fontes: /^(SEC-BNDES|CAPTURA-REIDI)/,
    contexto: "Crédito e incentivos raramente citam o projeto pelo nome. A ligação é INDIRETA: a empresa toma crédito ou incentivo no período da obra, no mesmo estado, para objeto compatível (implantação, ampliação, máquinas). Não exija citação explícita; pese o contexto.",
    sobe: [
      "mesmo estado do projeto e data dentro da janela (perto do anúncio ou durante a obra)",
      "descrição compatível: implantação, ampliação, expansão de capacidade, máquinas e equipamentos para a planta",
      "município do projeto na descrição",
      "a empresa não tem outro projeto ativo no mesmo estado que possa ser o destino",
      "valor compatível com o porte do projeto",
    ],
    desce: [
      "contrato liquidado antes do anúncio (obra anterior)",
      "outra unidade citada na descrição",
      "linha genérica de capital de giro ou cartão BNDES",
      "a empresa tem vários projetos ativos no estado (o destino é ambíguo)",
    ],
    exemplos: "BNDES de 2025 para 'implantação de queijaria em São Jorge d'Oeste' no projeto dessa queijaria: 92. Crédito para máquinas na mesma UF, 6 meses depois do anúncio, empresa sem outro projeto no estado: 62. Crédito de 2012 liquidado, outra planta: 8.",
  },
  energia: {
    nome: "Energia (ANEEL SIGA, autorizações de acesso, subestações)",
    fontes: /^(SEC-SIGA|SEC-ANEEL)/,
    contexto: "Cadastro de geração (usinas, geradores) e autorizações de acesso à rede. Uma planta grande ou data center costuma pedir subestação e acesso à Rede Básica; geradores a diesel de backup são rotina de unidades em operação.",
    sobe: ["subestação ou acesso à rede no município do projeto, no período da obra", "usina de cogeração ligada à planta nova"],
    desce: ["gerador a diesel antigo de unidade em operação", "usina em outro município"],
    exemplos: "Autorização de acesso à Rede Básica para subestação no município do data center: 85. Geradores a diesel registrados 7 anos antes: 10.",
  },
  cvm: {
    nome: "CVM (fatos relevantes e comunicados)",
    fontes: /^SEC-CVM/,
    contexto: "Documentos da companhia aberta. Fato relevante sobre investimento pode tratar do projeto sem citar município; comunicados de governança, resultados e debêntures genéricas não tratam da obra.",
    sobe: ["fato relevante sobre o investimento, a unidade ou o empreendimento do projeto", "data perto do anúncio"],
    desce: ["assembleia, dividendos, troca de auditor, resultado trimestral, debênture sem destino de obra"],
    exemplos: "Fato relevante anunciando a fábrica do projeto: 90. Aprovação de investimento sem dizer onde, uma semana antes do anúncio: 58. Troca de auditor: 3.",
  },
  geral: {
    nome: "Registro oficial (geral)",
    fontes: /.*/,
    contexto: "Registro de fonte oficial achado pelo CNPJ ou pelo nome da empresa.",
    sobe: ["mesmo local e objeto compatível", "data compatível"],
    desce: ["outro local, outra atividade, ato sem obra"],
    exemplos: "",
  },
};

const ORDEM = ["cno", "licenca", "outorga", "financiamento", "energia", "cvm", "geral"];

function especialistaDe(codigo) {
  const chave = ORDEM.find((k) => ESPECIALISTAS[k].fontes.test(String(codigo || "")));
  return { chave, ...ESPECIALISTAS[chave] };
}

/** Texto das instruções de um especialista (API e Claude Code). */
function instrucoesDoEspecialista(codigo) {
  const e = especialistaDe(codigo);
  return [
    `Você é o especialista em ${e.nome} de um radar de projetos de CapEx privado no Brasil.`,
    e.contexto,
    `Sinais que AUMENTAM a probabilidade: ${e.sobe.join("; ")}.`,
    `Sinais que REDUZEM: ${e.desce.join("; ")}.`,
    ESCALA,
    e.exemplos ? `Exemplos: ${e.exemplos}` : "",
    "Use só o que está no registro e na ficha do projeto. O motivo cita o que liga (ou não) o registro à obra.",
  ].filter(Boolean).join("\n\n");
}

const avaliacaoSchema = z.object({
  avaliacoes: z.array(z.object({
    i: z.number().int().nonnegative(),
    probabilidade: z.number().min(0).max(100).transform((n) => Math.round(n)),
    motivo: z.string().trim().min(1).max(500),
  })),
});

/**
 * Juiz pela API: mesma assinatura do juiz antigo (correlacao.js), devolve
 * [{ i, probabilidade, motivo }] para cada registro do lote.
 */
function criarJuizEspecialista({ client, modelo }) {
  const { pedirJson } = require("./claude");
  return async function julgar(project, codigo, registros) {
    const raw = await pedirJson(client, {
      etapa: `especialista:${especialistaDe(codigo).chave}`,
      model: modelo,
      system: `${instrucoesDoEspecialista(codigo)}\n\nRetorne somente JSON {"avaliacoes":[{"i":número,"probabilidade":0-100,"motivo":"frase curta"}]}, um item por registro.`,
      user: JSON.stringify({
        projeto: {
          nome: project.nome, nicho: project.nicho, uf: project.uf, municipio: project.municipio,
          empresa: project.empresa_nome, estagio: project.status, anuncio: project.data_anuncio || project.status_em || null,
          objeto: project.leitura || null,
        },
        fonte: codigo,
        registros,
      }),
      maxTokens: 4000,
    });
    if (!raw) throw new Error("O especialista não retornou conteúdo");
    return avaliacaoSchema.parse(JSON.parse(raw)).avaliacoes;
  };
}

function juizEspecialistaPadrao() {
  const { getConfig } = require("./config");
  const { criarCliente } = require("./claude");
  const config = getConfig();
  const client = criarCliente(config.claudeApiKey);
  return client ? criarJuizEspecialista({ client, modelo: config.claudeDecisionModel }) : null;
}

module.exports = { ESPECIALISTAS, ESCALA, especialistaDe, instrucoesDoEspecialista, criarJuizEspecialista, juizEspecialistaPadrao };
