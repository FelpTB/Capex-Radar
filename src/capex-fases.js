// Fases do módulo de captação de notícias (capex_radar).
//
//   1. Captação      capex-coletor.js    Google News RSS, o máximo possível.
//   2. Filtro 1      capex-coletor.js    regras, manchetes quase iguais e
//                    + capex-ia.js       triagem rápida da manchete (Haiku).
//   3. Filtro 2      capex-filtro.js     definição rígida de CapEx e repetição
//                                        do mesmo fato (Sonnet).
//   4. Enriquecimento capex-enriquecimento.js  acha a matéria original, lê o
//                                        texto e monta o perfil do projeto.
//   5. Filtro 3      capex-filtro-final.js  relê o perfil enriquecido e tira o
//                                        que não faz sentido para o radar.
//   6. Aprovação humana (tela): só chega aqui o que passou por todas as fases.
//
// Cada fase de IA depois da triagem pode ser desligada no .env
// (CAPEX_FILTRO=0, CAPEX_ENRIQUECIMENTO=0, CAPEX_FILTRO_FINAL=0). A fase
// desligada sai da conta: a próxima lê direto o que a anterior manteve.
//
// Este módulo só lê o ambiente e monta condições SQL (alias e de
// capex_radar.evidencias); não depende dos outros, para não criar ciclos.
require("./config"); // carrega o .env

function ligado(nome) {
  return !/^(0|false|no|off)$/i.test(process.env[nome]?.trim() || "");
}

const filtro2Ligado = () => ligado("CAPEX_FILTRO");
const enriquecimentoLigado = () => ligado("CAPEX_ENRIQUECIMENTO");
const filtro3Ligado = () => ligado("CAPEX_FILTRO_FINAL");

// Notícia ainda no funil: triada como possível CapEx e sem decisão final
// (nem vinculada, nem descartada). Era a antiga fila "A revisar".
const NO_FUNIL = `(e.triagem = 'novo_projeto' or (e.triagem = 'pendente' and e.extracao is not null)
             or exists (select 1 from capex_radar.evidencia_projeto s where s.evidencia_id = e.id and s.situacao = 'sugerido'))`;

const PASSOU_FILTRO2 = "(e.filtro->>'decisao' = 'manter')";
const ENRIQUECIDA = "(e.enriquecimento is not null)";
const PASSOU_FILTRO3 = "(e.filtro_final->>'decisao' = 'manter')";

function juntar(partes) {
  return partes.length ? `(${partes.join(" and ")})` : "true";
}

/** Passou pelas fases ligadas até o Filtro 2 (entrada do Enriquecimento). */
function condicaoAposFiltro2() {
  return juntar(filtro2Ligado() ? [PASSOU_FILTRO2] : []);
}

/** Pronta para o Filtro 3: passou pelo Filtro 2 e foi enriquecida (se ligadas). */
function condicaoAposEnriquecimento() {
  return juntar([
    ...(filtro2Ligado() ? [PASSOU_FILTRO2] : []),
    ...(enriquecimentoLigado() ? [ENRIQUECIDA] : []),
  ]);
}

/** Pronta para a aprovação humana: passou por todas as fases ligadas. */
function condicaoPronta() {
  return juntar([
    ...(filtro2Ligado() ? [PASSOU_FILTRO2] : []),
    ...(enriquecimentoLigado() ? [ENRIQUECIDA] : []),
    ...(filtro3Ligado() ? [PASSOU_FILTRO3] : []),
  ]);
}

module.exports = {
  NO_FUNIL,
  filtro2Ligado,
  enriquecimentoLigado,
  filtro3Ligado,
  condicaoAposFiltro2,
  condicaoAposEnriquecimento,
  condicaoPronta,
};
