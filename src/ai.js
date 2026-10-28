const OpenAI = require("openai");
const { z } = require("zod");
const { getConfig } = require("./config");
const {
  extractCompanyCandidates,
  normalizeName,
} = require("./company-candidates");
const { chooseStatusDate } = require("./status-date");

const config = getConfig();
const client = config.openAiApiKey
  ? new OpenAI({ apiKey: config.openAiApiKey })
  : null;

const extractionSchema = z.object({
  nome: z.string().min(1),
  nicho: z.string().nullable(),
  uf: z.string().length(2).nullable(),
  municipio: z.string().nullable(),
  valor_capex: z.number().nonnegative().nullable(),
  moeda: z.enum(["BRL", "USD", "desconhecida"]),
  status: z.enum([
    "rumor",
    "anunciado",
    "leilao",
    "outorga",
    "lp",
    "li",
    "construcao",
    "operacao",
    "cancelado",
  ]),
  esfera: z.enum(["privada", "publica", "fora"]),
  pais: z.string().length(2).nullable(),
  envolve_orgao_publico: z.boolean(),
  resumo: z.string(),
  trecho: z.string().nullable(),
});

const companyDecisionSchema = z.object({
  empresa_nome: z.string().nullable(),
  confianca: z.enum(["alta", "media", "baixa"]),
  trecho: z.string().nullable(),
  motivo: z.string().min(1),
});

function normalizeExtraction(value, sourceText) {
  const normalizedStatus = String(value.status || "anunciado")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const statusAliases = {
    licitacao: "leilao",
    obra: "construcao",
    construction: "construcao",
    operating: "operacao",
  };
  const allowedStatuses = [
    "rumor", "anunciado", "leilao", "outorga", "lp",
    "li", "construcao", "operacao", "cancelado",
  ];
  const inferredStatus =
    (normalizedStatus.includes("leil") && "leilao") ||
    (normalizedStatus.includes("outorg") && "outorga") ||
    (normalizedStatus.includes("constru") && "construcao") ||
    (normalizedStatus.includes("opera") && "operacao") ||
    (normalizedStatus.includes("cancel") && "cancelado") ||
    "anunciado";
  const currency = String(value.moeda || "").toUpperCase();
  const sphere = String(value.esfera || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const country = String(value.pais || "").trim().toUpperCase();
  const countryAliases = { BRA: "BR", BRASIL: "BR", BRAZIL: "BR" };
  const publicFlag = value.envolve_orgao_publico;

  return {
    ...value,
    nome: value.nome || sourceText.split("\n")[0].slice(0, 240),
    nicho: value.nicho || null,
    municipio: value.municipio || null,
    valor_capex: value.valor_capex !== null &&
      value.valor_capex !== undefined &&
      Number.isFinite(Number(value.valor_capex))
      ? Number(value.valor_capex)
      : null,
    resumo: value.resumo || sourceText.slice(0, 500),
    trecho: evidenceFromSource(value.trecho, sourceText),
    uf: /^[A-Z]{2}$/.test(String(value.uf || "").toUpperCase())
      ? String(value.uf).toUpperCase()
      : null,
    moeda: currency === "R$" || currency === "REAL" || currency === "REAIS"
      ? "BRL"
      : currency === "US$" || currency === "DOLAR" || currency === "DÓLAR"
        ? "USD"
        : ["BRL", "USD"].includes(currency) ? currency : "desconhecida",
    status: statusAliases[normalizedStatus] ||
      (allowedStatuses.includes(normalizedStatus) ? normalizedStatus : inferredStatus),
    esfera: sphere === "privada" || sphere === "privado"
      ? "privada"
      : sphere === "publica" || sphere === "publico"
        ? "publica"
        : "fora",
    pais: countryAliases[country]
      || (/^[A-Z]{2}$/.test(country) ? country : null),
    envolve_orgao_publico: publicFlag === true
      || String(publicFlag).toLowerCase() === "true"
      || String(publicFlag).toLowerCase() === "sim",
  };
}

function evidenceFromSource(value, sourceText) {
  const evidence = String(value || "").replace(/\s+/g, " ").trim().slice(0, 400);
  if (!evidence) return null;
  const normalizedSource = String(sourceText).replace(/\s+/g, " ");
  return normalizedSource.includes(evidence) ? evidence : null;
}

async function identifyProjectCompany(text, project = null) {
  if (!client) {
    throw new Error("OPENAI_API_KEY não configurada");
  }
  const candidates = extractCompanyCandidates(text);
  const emptyDecision = {
    candidatos: candidates,
    selecionada: null,
    confianca: "baixa",
    trecho: null,
    motivo: candidates.length
      ? "Nenhuma empresa pôde ser vinculada ao projeto com segurança."
      : "Nenhum termo próprio candidato foi encontrado no texto.",
    modelo: config.openAiDecisionModel,
  };
  if (!candidates.length) return emptyDecision;

  const completion = await client.chat.completions.create({
    model: config.openAiDecisionModel,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Você decide qual opção é a empresa diretamente ligada ao projeto CapEx. " +
          "Escolha somente uma string exata da lista de opções ou null. Priorize dona, " +
          "investidora, concessionária, contratante ou operadora do ativo. Não escolha " +
          "local, projeto, pessoa, veículo, órgão regulador, controladora citada só de passagem ou governo. " +
          (project
            ? "O objeto descreve um projeto. Escolha a empresa desse projeto, mesmo que a matéria descreva outro empreendimento. "
            : "Se houver mais de uma empresa sem uma responsável principal clara, retorne null. ") +
          "O trecho deve ser uma cópia literal curta do contexto que sustenta a decisão. " +
          "Retorne somente JSON com empresa_nome, confianca (alta, media ou baixa), trecho e motivo.",
      },
      {
        role: "user",
        content: JSON.stringify({
          projeto: project ? {
            nome: project.nome,
            nicho: project.nicho,
            uf: project.uf,
            municipio: project.municipio,
          } : undefined,
          opcoes: candidates,
          noticia: text.slice(0, 14_000),
        }),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("O modelo de decisão não retornou conteúdo");
  const decision = companyDecisionSchema.parse(JSON.parse(raw));
  if (!decision.empresa_nome) {
    return {
      ...emptyDecision,
      confianca: decision.confianca,
      trecho: evidenceFromSource(decision.trecho, text),
      motivo: decision.motivo,
    };
  }

  const selected = candidates.find(
    (candidate) => normalizeName(candidate) === normalizeName(decision.empresa_nome),
  );
  if (!selected) {
    return {
      ...emptyDecision,
      candidatos: candidates,
      motivo: "O modelo tentou selecionar um nome fora da lista de opções.",
    };
  }

  return {
    candidatos: candidates,
    selecionada: selected,
    confianca: decision.confianca,
    trecho: evidenceFromSource(decision.trecho, text),
    motivo: decision.motivo,
    modelo: config.openAiDecisionModel,
  };
}

async function chooseListedCnpj(text, project, groups) {
  if (!groups.length) {
    return { cnpj: null, motivo: "Nenhuma base carregada devolveu a empresa da notícia." };
  }
  if (groups.length === 1) {
    return {
      cnpj: groups[0].cnpj,
      motivo: "Um único CNPJ apareceu nas bases para a empresa indicada na notícia.",
    };
  }
  if (!client) throw new Error("OPENAI_API_KEY não configurada");

  const completion = await client.chat.completions.create({
    model: config.openAiDecisionModel,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Escolha o CNPJ da empresa deste projeto. Use a notícia inteira: atividade, local, " +
          "quem investe e o que está sendo construído. Somente um número da lista ou null. " +
          "Não invente CNPJ. Retorne somente JSON com cnpj e motivo.",
      },
      {
        role: "user",
        content: JSON.stringify({
          projeto: {
            nome: project.nome,
            nicho: project.nicho,
            uf: project.uf,
            municipio: project.municipio,
          },
          opcoes: groups.map((group) => ({
            cnpj: group.cnpj,
            nomes: group.nomes,
            bases: group.bases,
          })),
          noticia: String(text || "").slice(0, 14_000),
        }),
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("O modelo de decisão não retornou conteúdo");
  const decision = z.object({
    cnpj: z.string().nullable(),
    motivo: z.string().min(1),
  }).parse(JSON.parse(raw));
  const digits = String(decision.cnpj || "").replace(/\D/g, "");
  const chosen = groups.find((group) => group.cnpj === digits);
  if (!chosen) {
    return { cnpj: null, motivo: "O modelo não escolheu um CNPJ da lista encontrada nas bases." };
  }
  return { cnpj: chosen.cnpj, motivo: decision.motivo };
}

function projectContext(sourceText, quote) {
  const normalized = String(sourceText || "").replace(/\s+/g, " ").trim();
  const evidence = String(quote || "").replace(/\s+/g, " ").trim();
  const at = evidence ? normalized.indexOf(evidence) : -1;
  if (at < 0) return normalized.slice(0, 4_000);
  const start = Math.max(0, at - 800);
  const end = Math.min(normalized.length, at + evidence.length + 800);
  return normalized.slice(start, end);
}

function dedupeProjects(projects) {
  const seen = new Set();
  const unique = [];
  for (const project of projects) {
    const key = normalizeName(project.nome);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(project);
  }
  return unique;
}

async function extractProjects(text, options = {}) {
  if (!client) {
    throw new Error("OPENAI_API_KEY não configurada");
  }
  if (!text || text.trim().length < 40) {
    throw new Error("Cole ao menos o título e o lead da notícia");
  }

  const completion = await client.chat.completions.create({
    model: config.openAiModel,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Uma notícia pode descrever mais de um projeto CapEx. " +
          "Retorne um item para cada ativo físico distinto, inclusive concessão, aeroporto, pátio, " +
          "fábrica, planta, mina, terminal, usina, data center ou centro logístico. " +
          "Se o texto descreve dois ativos, a lista tem dois. Não omita um porque o outro parece mais privado " +
          "nem porque o valor não aparece. " +
          "Não junte dois ativos no mesmo item. Não separe fases, lotes ou posições do mesmo ativo. " +
          "Não crie item para empresa só citada como cliente, vizinha, regulador ou operadora de voo. " +
          "esfera=privada quando a empresa privada é dona e investidora do ativo. " +
          "esfera=publica quando governo, autarquia, estatal, tribunal, banco público ou fundo público " +
          "investe, contrata, financia, licita, concede ou é sócio do ativo. " +
          "esfera=fora quando o trecho é economia geral, mercado financeiro, resultado, fusão, dívida " +
          "ou opinião, sem obra física. " +
          "pais é o código ISO de 2 letras do país do ativo (BR para Brasil); null se não houver ativo. " +
          "envolve_orgao_publico=true quando um órgão público investe, financia, licita, concede ou é sócio, " +
          "inclusive concessão e PPP. Consulta operacional a um órgão não basta. " +
          "trecho é uma cópia literal do texto, com a frase que distingue esse ativo. " +
          "Nunca invente CNPJ, local ou valor. A empresa será decidida separadamente. Valor numérico " +
          "na unidade da moeda (R$ 1,2 bilhão = 1200000000). Se ausente, null. " +
          "UF com 2 letras e só para ativo no Brasil. " +
          "Retorne somente JSON { projetos: [ { nome, nicho, uf, municipio, valor_capex, moeda, status, " +
          "esfera, pais, envolve_orgao_publico, resumo, trecho } ] }.",
      },
      { role: "user", content: text.slice(0, 14_000) },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("A OpenAI não retornou conteúdo");
  const parsed = z.object({
    projetos: z.array(z.record(z.string(), z.unknown())).min(1).max(6),
  }).parse(JSON.parse(raw));
  const grounded = dedupeProjects(
    parsed.projetos
      .map((item) => extractionSchema.parse(normalizeExtraction(item, text)))
      .filter((item) => item.trecho),
  );
  if (!grounded.length) {
    throw new Error("Nenhum projeto ficou sustentado por um trecho literal da notícia");
  }

  const projetos = [];
  for (const project of grounded) {
    const company = await identifyProjectCompany(projectContext(text, project.trecho));
    const moment = chooseStatusDate({
      text,
      trecho: project.trecho,
      publishedAt: options.publishedAt,
    });
    projetos.push({
      ...project,
      status_em: moment.status_em,
      status_em_origem: moment.origem,
      empresa_nome: company.selecionada,
      empresa_identificacao: company,
    });
  }
  return { projetos };
}

async function extractProject(text) {
  const { projetos } = await extractProjects(text);
  return { ...projetos[0], projetos };
}

const PROJECT_STATUSES = [
  "rumor", "anunciado", "leilao", "outorga", "lp",
  "li", "construcao", "operacao", "cancelado",
];

const statusReadingSchema = z.object({
  status: z.string(),
  descricao: z.string().min(1),
});

async function interpretProjectStatus(project, evidencias) {
  if (!client) throw new Error("OPENAI_API_KEY não configurada");
  const completion = await client.chat.completions.create({
    model: config.openAiDecisionModel,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Você atualiza o status de um projeto CapEx somente com as evidências já anotadas. " +
          "Não invente obra, data, valor ou quantidade. Use só os números que estão nas anotações. " +
          "Status permitidos: rumor, anunciado, leilao, outorga, lp, li, construcao, operacao, cancelado. " +
          "Obra do CNO no município e no período sustenta construcao. " +
          "Obra antiga, de outro município ou só da mesma raiz de CNPJ não muda o status. " +
          "Contrato do BNDES liquidado é histórico. Contrato em aberto no período indica financiamento, não a fase da obra. " +
          "Licença LP, LI ou LO no período e no local pode sustentar lp, li ou operacao. " +
          "Se a evidência não basta, repita o status atual. " +
          "descricao é um parágrafo curto sobre o que se sabe agora. " +
          "Retorne somente JSON com status e descricao.",
      },
      {
        role: "user",
        content: JSON.stringify({
          projeto: {
            nome: project.nome,
            status_atual: project.status,
            status_em: project.status_em,
            uf: project.uf,
            municipio: project.municipio,
            empresa_nome: project.empresa_nome,
            nicho: project.nicho,
          },
          evidencias: evidencias.map((item) => ({
            fonte: item.codigo,
            anotacao: item.trecho,
            linhas: item.campos_extraidos?.linhas || item.campos_extraidos?.amostra || null,
          })),
        }),
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("O modelo de status não retornou conteúdo");
  const decision = statusReadingSchema.parse(JSON.parse(raw));
  const status = PROJECT_STATUSES.includes(decision.status) ? decision.status : project.status;
  return {
    status,
    descricao: decision.descricao.trim(),
    modelo: config.openAiDecisionModel,
  };
}

const summarySchema = z.object({ resumo: z.string().min(1) });

async function summarizeOfficialAct({ titulo, orgao, data, texto, empresa }) {
  if (!client) return null;
  const completion = await client.chat.completions.create({
    model: config.openAiDecisionModel,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Resuma um ato do Diário Oficial da União em uma ou duas frases curtas, em português. " +
          "Diga o que o ato faz com a empresa indicada e, quando houver, o valor, o prazo, o objeto ou o número do processo que envolve essa empresa. " +
          "Quando o ato lista muitas partes, descreva só a parte que cita a empresa e diga em uma palavra o tipo do ato. " +
          "Use só o que está no texto. Não invente. Retorne somente JSON com resumo.",
      },
      {
        role: "user",
        content: JSON.stringify({ empresa, titulo, orgao, data, texto: String(texto || "").slice(0, 12000) }),
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;
  const parsed = summarySchema.parse(JSON.parse(raw));
  return parsed.resumo.replace(/\s+/g, " ").trim().slice(0, 400);
}

const contextJudgmentSchema = z.object({
  avaliacoes: z.array(z.object({
    i: z.number().int(),
    correlacao: z.enum(["direta", "outro_projeto", "incerta"]),
    motivo: z.string(),
  })),
});

// Lê o contexto de cada registro achado pela empresa e diz se ele é deste projeto.
// Só "direta" vira evidência; registro de outra planta, mina ou estado da mesma empresa fica fora.
async function judgeEvidenceContext(project, fonte, registros) {
  if (!client) throw new Error("OPENAI_API_KEY não configurada");
  const completion = await client.chat.completions.create({
    model: config.openAiDecisionModel,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Você decide se cada registro de uma fonte oficial tem correlação direta com um projeto CapEx específico. " +
          "Os registros foram achados pelo CNPJ ou pelo nome da empresa, então muitos são de outros projetos da mesma empresa. " +
          "direta: o registro trata desta obra, planta, mina, terreno ou empreendimento, no mesmo local do projeto, ou de licença, incentivo, terreno, outorga ou contrato que só faz sentido para ele. " +
          "outro_projeto: o registro é de outra unidade, outro município ou estado, outra atividade ou outro empreendimento da empresa, ou é compra pública, multa de trânsito, processo trabalhista ou ato administrativo sem relação com a obra. " +
          "incerta: o texto não traz local, objeto ou atividade suficiente para ligar ao projeto. " +
          "Município ou estado diferente do projeto é outro_projeto, salvo quando o texto diz que a obra abrange esse local. " +
          "Na dúvida, use incerta. Use só o que está no registro. " +
          "Retorne somente JSON {\"avaliacoes\":[{\"i\":número,\"correlacao\":\"direta|outro_projeto|incerta\",\"motivo\":\"frase curta\"}]}, um item por registro.",
      },
      {
        role: "user",
        content: JSON.stringify({
          projeto: {
            nome: project.nome,
            nicho: project.nicho,
            uf: project.uf,
            municipio: project.municipio,
            empresa: project.empresa_nome,
            status: project.status,
            leitura: project.leitura || null,
          },
          fonte,
          registros,
        }),
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("O modelo de correlação não retornou conteúdo");
  return contextJudgmentSchema.parse(JSON.parse(raw)).avaliacoes;
}

module.exports = {
  judgeEvidenceContext,
  extractProject,
  extractProjects,
  identifyProjectCompany,
  chooseListedCnpj,
  interpretProjectStatus,
  projectContext,
  dedupeProjects,
  summarizeOfficialAct,
};
