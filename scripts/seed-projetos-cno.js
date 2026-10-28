const { pool, createProjectWithEvidence } = require("../src/db");

// Cinco obras das empresas-alvo escolhidas no CNO de 01/10/2026: três ativas e duas encerradas.
// O CNO não traz valor. A evidência primária é a inscrição da obra.
const CNO_URL = "https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-de-obras-cno";

const PROJETOS = [
  {
    nome: "BYD — complexo industrial de veículos em Camaçari",
    nicho: "indústria automotiva — fábrica de veículos",
    uf: "BA",
    municipio: "Camaçari",
    empresa_nome: "BYD AUTO DO BRASIL LTDA",
    cnpj: "50351104000119",
    status: "construcao",
    status_em: "2024-07-22",
    cno: {
      cno: "900225903173",
      situacao: "ativa",
      inicio: "2024-07-22",
      data_situacao: "2024-07-22",
      endereco: "Avenida Henry Ford, S/N, Polo Industrial de Camaçari, BA 527",
      cep: "42816260",
      latitude: -12.68256,
      longitude: -38.29169,
      area_m2: 179158,
      areas: "Acréscimo 179.158 m² sobre 353.785,5 m² existentes, galpão industrial, alvenaria",
      cnaes: ["4120400", "4299599", "4399103", "4399199"],
      qualificacao: "proprietário do imóvel",
      relacionados: ["900276504277", "900286881879", "900237471578"],
    },
  },
  {
    nome: "Gerdau — Projeto Itabiritos na mina de Miguel Burnier",
    nicho: "mineração e siderurgia — planta de beneficiamento de minério",
    uf: "MG",
    municipio: "Ouro Preto",
    empresa_nome: "GERDAU ACOMINAS S/A",
    cnpj: "17227422000105",
    status: "construcao",
    status_em: "2024-08-19",
    cno: {
      cno: "900213905279",
      situacao: "ativa",
      inicio: "2024-08-19",
      data_situacao: "2024-08-19",
      endereco: "Estação Miguel Burnier, s/n, Zona Rural",
      cep: "35414000",
      latitude: -20.45269,
      longitude: -43.78006,
      area_m2: 27000,
      areas: "Obra nova 22.000 m², existente 5.000 m², demolição 5.000 m², galpão industrial, mista",
      cnaes: ["4399199"],
      qualificacao: "dono da obra (filial 17.227.422/0140-76)",
      relacionados: ["900204502870", "900227425778", "900227416475", "900141776176", "900186987273"],
    },
  },
  {
    nome: "CMPC — Early Works PMN em Piraí do Sul",
    nicho: "papel e celulose — obras preliminares de fábrica",
    uf: "PR",
    municipio: "Piraí do Sul",
    empresa_nome: "CMPC IGUACU EMBALAGENS LTDA",
    cnpj: "11308600000138",
    status: "construcao",
    status_em: "2024-10-25",
    cno: {
      cno: "900214877275",
      situacao: "ativa",
      inicio: "2024-10-25",
      data_situacao: "2024-10-25",
      endereco: "Rodovia PR 151 KM 267, S/N, Campo do Piraí",
      cep: "84240000",
      latitude: -24.61294,
      longitude: -49.97156,
      area_m2: 15000,
      areas: "Obra nova 15.000 m², galpão industrial, mista",
      cnaes: ["4120400", "4221902", "4222701", "4299599", "4311801", "4391600", "4399199"],
      qualificacao: "dono da obra",
      relacionados: [],
    },
  },
  {
    nome: "Bracell — fábrica de celulose em Lençóis Paulista",
    nicho: "celulose — fábrica",
    uf: "SP",
    municipio: "Lençóis Paulista",
    empresa_nome: "BRACELL SP CELULOSE LTDA",
    cnpj: "53943098000187",
    status: "operacao",
    status_em: "2024-08-05",
    cno: {
      cno: "512449697570",
      situacao: "encerrada",
      inicio: "2019-03-07",
      data_situacao: "2024-08-05",
      endereco: "Rodovia Juliano Lorenzetti, km 6 + 400 m, S/N, Distrito Empresarial",
      cep: "18685900",
      latitude: -22.56169,
      longitude: -48.81631,
      area_m2: 241214.31,
      areas: "Obra nova 241.214,31 m², galpão industrial, mista",
      cnaes: ["4299599"],
      qualificacao: "proprietário do imóvel",
      relacionados: ["900004832977", "900117346972", "900196299272"],
    },
  },
  {
    nome: "Ambev — filial Novas Minas em Sete Lagoas",
    nicho: "bebidas — fábrica",
    uf: "MG",
    municipio: "Sete Lagoas",
    empresa_nome: "AMBEV S.A.",
    cnpj: "07526557000100",
    status: "operacao",
    status_em: "2019-10-01",
    cno: {
      cno: "512463277273",
      situacao: "encerrada",
      inicio: "2019-01-02",
      data_situacao: "2019-10-01",
      endereco: "Rodovia MG 238, S/N KM 75, Jardim Primavera II",
      cep: "35703106",
      latitude: null,
      longitude: null,
      area_m2: 208063,
      areas: "Obra nova 208.063 m², galpão industrial, alvenaria",
      cnaes: ["4120400"],
      qualificacao: "vínculo da Ambev; responsável Âncora Engenharia (37.859.048/0001-60), construtora",
      relacionados: ["900009675675"],
    },
  },
];

function resumo(projeto) {
  const { cno } = projeto;
  return [
    `CNO ${cno.cno}, obra ${cno.situacao}, início ${cno.inicio}, situação desde ${cno.data_situacao}.`,
    `${cno.endereco}, ${projeto.municipio}/${projeto.uf}, CEP ${cno.cep}.`,
    `${cno.areas}.`,
  ].join(" ");
}

async function main() {
  const { rows } = await pool.query("select id from fonte where codigo = 'SEC-CNO'");
  const idFonte = rows[0]?.id || null;
  for (const projeto of PROJETOS) {
    const created = await createProjectWithEvidence({
      ...projeto,
      status_em_origem: "texto",
      url: CNO_URL,
      id_fonte: idFonte,
      titulo: `Obra ${projeto.cno.cno} no Cadastro Nacional de Obras`,
      trecho: resumo(projeto),
      campos_extraidos: projeto.cno,
    });
    console.log(`${created.id} ${projeto.nome}`);
  }
}

main()
  .catch((error) => {
    console.error(`Falha ao carregar projetos: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
