// Fluxo do capex_radar (sql/030, docs em src/capex-perfil.js).
//
//   1. Captação          capex-coletor.js    Google News RSS: título, veículo,
//                                            data e link de cada notícia.
//   2. Filtro 1          capex-coletor.js    regras (exclusões, manchete quase
//                        + capex-ia.js       igual, valor e local repetidos,
//                        + capex-filtro.js   sem local nem empresa, notícia
//                                            ampla), leitura da manchete
//                                            (Haiku) e definição de CapEx e
//                                            repetição do fato (Sonnet).
//   3. Perfil inicial    capex-agente.js     aloca cada notícia num projeto:
//                        + capex-perfil.js   cria (em revisão) ou vincula, e
//                                            monta o perfil inicial.
//   4. Enriquecimento    capex-enriquecimento.js  acha e lê a matéria original
//                                            (fontes primárias).
//   5. Perfil enriquecido capex-perfil.js    o texto das matérias completa o
//                                            perfil.
//   6. Filtro 2          capex-filtro-final.js  relê o perfil enriquecido e
//                                            tira o que não faz sentido.
//   7. Enriquecimento 2  capex-fontes-secundarias.js  fontes secundárias
//                                            (registros brutos, diários para
//                                            licenças), cronologia e linha do
//                                            tempo; repetido de tempos em tempos.
//   8. Perfil completo   capex-perfil.js     perfil final com as fontes
//                                            secundárias.
//
// Cada fase de IA pode ser desligada no .env (CAPEX_FILTRO=0,
// CAPEX_ENRIQUECIMENTO=0, CAPEX_FILTRO_FINAL=0). CAPEX_FLUXO=v1 volta à ordem
// antiga (Enriquecimento e Filtro 3 antes do agente).
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
const fluxoV2 = () => (process.env.CAPEX_FLUXO?.trim() || "v2") !== "v1";

// Notícia ainda no funil: triada como possível CapEx e sem decisão final
// (nem vinculada, nem descartada). Era a antiga fila "A revisar".
const NO_FUNIL = `(e.triagem = 'novo_projeto' or (e.triagem = 'pendente' and e.extracao is not null)
             or exists (select 1 from capex_radar.evidencia_projeto s where s.evidencia_id = e.id and s.situacao = 'sugerido'))`;

const PASSOU_FILTRO2 = "(e.filtro->>'decisao' = 'manter')";
const ENRIQUECIDA = "(e.enriquecimento is not null)";
const PASSOU_FILTRO3 = "(e.filtro_final->>'decisao' = 'manter')";

// Notícia já alocada num projeto vivo pelo Perfil inicial (fluxo v2): segue
// para o Enriquecimento e o Filtro 2 mesmo fora do funil.
const LIGADA_A_PROJETO = `(exists (select 1 from capex_radar.evidencia_projeto lp
                               join capex_radar.projetos pp on pp.id = lp.projeto_id
                              where lp.evidencia_id = e.id and lp.situacao = 'aceito' and pp.status <> 'descartado'))`;

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

/** Entrada do Perfil inicial (agente): no fluxo v2, logo depois do Filtro 1. */
function condicaoPerfilInicial() {
  return fluxoV2() ? condicaoAposFiltro2() : condicaoPronta();
}

/** Onde o Enriquecimento e o Filtro 2 procuram notícias: funil e, no v2, notícias já alocadas. */
function universoPosFiltro(funil) {
  return fluxoV2() ? `(${funil} or ${LIGADA_A_PROJETO})` : funil;
}

module.exports = {
  LIGADA_A_PROJETO,
  fluxoV2,
  condicaoPerfilInicial,
  universoPosFiltro,
  NO_FUNIL,
  filtro2Ligado,
  enriquecimentoLigado,
  filtro3Ligado,
  condicaoAposFiltro2,
  condicaoAposEnriquecimento,
  condicaoPronta,
};
