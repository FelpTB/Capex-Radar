// Classes de correlação de uma evidência com o projeto (sql/031).
//
//   certeira          75-100%  liga à linha do tempo
//   provavel          60-74%   liga à linha do tempo
//   incerta           50-59%   possibilidade no perfil
//   improvavel        30-49%   possibilidade no perfil
//   muito_improvavel   0-29%   descartada (dados brutos no fim da ficha)
//
// Toda classe pode ser trocada por um humano na ficha do projeto.

const CLASSES = {
  certeira: { rotulo: "Certeira", faixa: "75–100%", min: 75, tom: "success", destino: "linha" },
  provavel: { rotulo: "Provável", faixa: "60–74%", min: 60, tom: "info", destino: "linha" },
  incerta: { rotulo: "Incerta", faixa: "50–59%", min: 50, tom: "warning", destino: "possibilidade" },
  improvavel: { rotulo: "Improvável", faixa: "30–49%", min: 30, tom: "neutral", destino: "possibilidade" },
  muito_improvavel: { rotulo: "Muito improvável", faixa: "0–29%", min: 0, tom: "neutral", destino: "descarte" },
};

const ORDEM = ["certeira", "provavel", "incerta", "improvavel", "muito_improvavel"];

// Probabilidade típica de cada classe, quando a classe vem de um humano.
const PROBABILIDADE_DA_CLASSE = { certeira: 90, provavel: 67, incerta: 55, improvavel: 40, muito_improvavel: 10 };

function classeDe(probabilidade) {
  if (probabilidade == null || Number.isNaN(Number(probabilidade))) return null;
  const p = Math.max(0, Math.min(100, Math.round(Number(probabilidade))));
  return ORDEM.find((c) => p >= CLASSES[c].min);
}

const ligaLinhaDoTempo = (classe) => CLASSES[classe]?.destino === "linha";
const ehPossibilidade = (classe) => CLASSES[classe]?.destino === "possibilidade";

// correlacao (coluna antiga) a partir da classe.
function correlacaoDaClasse(classe) {
  if (ligaLinhaDoTempo(classe)) return "direta";
  if (ehPossibilidade(classe)) return "incerta";
  return "outro_projeto";
}

// Probabilidade a partir da correlação antiga (julgamentos anteriores às classes).
function probabilidadeDaCorrelacao(correlacao) {
  return { direta: 85, incerta: 55, outro_projeto: 10, outro_estado: 0 }[correlacao] ?? null;
}

module.exports = {
  CLASSES,
  ORDEM,
  PROBABILIDADE_DA_CLASSE,
  classeDe,
  ligaLinhaDoTempo,
  ehPossibilidade,
  correlacaoDaClasse,
  probabilidadeDaCorrelacao,
};
