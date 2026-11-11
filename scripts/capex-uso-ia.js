// Tokens e custo estimado das chamadas ao Claude, por dia (UTC), etapa e modelo.
//
// Uso:
//   npm run capex:uso-ia              últimos 7 dias
//   npm run capex:uso-ia -- --dias 30
//
// Lê capex_radar.vw_ia_uso_dia (sql/029). O custo usa os preços de tabela e
// é uma estimativa; o valor cobrado está no Console da Anthropic.
const { pool } = require("../src/db");

async function main() {
  const i = process.argv.indexOf("--dias");
  const dias = i > 0 ? Number(process.argv[i + 1]) : 7;
  if (!Number.isInteger(dias) || dias < 1) throw new Error("--dias precisa ser um número inteiro positivo");
  const { rows } = await pool.query(
    `select dia, etapa, modelo, chamadas, tokens_entrada, tokens_saida, buscas, custo_usd
       from capex_radar.vw_ia_uso_dia
      where dia > (now() at time zone 'UTC')::date - $1::int
      order by dia, custo_usd desc`,
    [dias],
  );
  if (!rows.length) {
    console.log("Nenhuma chamada registrada no período.");
    return;
  }
  const n = (v) => Number(v).toLocaleString("pt-BR");
  console.table(rows.map((r) => ({
    dia: r.dia.toISOString().slice(0, 10), etapa: r.etapa || "—", modelo: r.modelo,
    chamadas: n(r.chamadas), entrada: n(r.tokens_entrada), saida: n(r.tokens_saida), buscas: n(r.buscas), "US$": Number(r.custo_usd).toFixed(2),
  })));
  const total = rows.reduce((t, r) => t + Number(r.custo_usd), 0);
  console.log(`Total estimado: US$ ${total.toFixed(2)} em ${dias} dia(s).`);
}

main()
  .catch((error) => {
    console.error(`Falha: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
