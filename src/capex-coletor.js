// Coletor de notícias por empresa do teste de monitoramento (capex_radar, Fase 3).
//
// Para cada grupo:
//   1. fatia a janela em trimestres e lê o Google News RSS de cada fatia;
//      a fatia que chega ao teto do RSS (~100 itens) é refeita mês a mês;
//   2. grava cada notícia em capex_radar.evidencias (título, veículo, data e
//      link; o corpo da matéria não entra). chave_dedupe = gnews:<guid>;
//   3. Filtro 1 (triagem): regras sem custo (exclusão no título), manchete
//      quase igual a outra do grupo em poucos dias e depois a IA rápida, que
//      diz se a manchete fala de ativo físico do grupo;
//   4. vínculo: a IA escolhe um projeto do grupo numa lista fechada ou marca
//      a notícia como novo_projeto. Projeto só nasce na revisão humana.
//
// O cliente pg e a IA entram como parâmetro, para os testes rodarem sem banco.
const cheerio = require("cheerio");
const { buscaDoGrupo, separarTermos } = require("./capex-busca");
const seedTermos = require("../seeds/capex_radar/termos-busca.json");

const FONTE = "gnews_rss";
const TETO_RSS = 90;
const LOTE_IA = 20;
const DIAS_SEMANA = 14;
const ATOR_COLETOR = "sistema:coletor";
const ATOR_TRIAGEM = "ia:triagem";
const ATOR_VINCULO = "ia:vinculo";

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function limparTexto(texto) {
  return String(texto || "").replace(/\s+/g, " ").trim();
}

// O Google acrescenta " - Veículo" ao título.
function tituloSemVeiculo(titulo, veiculo) {
  const t = limparTexto(titulo);
  const v = limparTexto(veiculo);
  if (v && t.endsWith(` - ${v}`)) return t.slice(0, -(v.length + 3)).trim();
  return t;
}

function noticiasDoRss(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const noticias = [];
  $("item").each((_index, element) => {
    const item = $(element);
    const guid = limparTexto(item.find("guid").text());
    const link = limparTexto(item.find("link").text());
    if (!guid || !/^https?:\/\//.test(link)) return;
    const veiculo = limparTexto(item.find("source").text()) || null;
    const publicado = new Date(limparTexto(item.find("pubDate").text()));
    noticias.push({
      guid,
      titulo: tituloSemVeiculo(item.find("title").text(), veiculo),
      url: link,
      veiculo,
      veiculo_url: item.find("source").attr("url") || null,
      publicado_em: Number.isNaN(publicado.getTime()) ? null : publicado.toISOString(),
    });
  });
  return noticias;
}

function chaveDedupe(noticia) {
  return `gnews:${noticia.guid}`;
}

function dia(data) {
  return (data instanceof Date ? data : new Date(`${data}T00:00:00Z`)).toISOString().slice(0, 10);
}

function somarMeses(data, meses) {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + meses);
  return dia(d);
}

function somarDias(data, dias) {
  const d = new Date(`${dia(data)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return dia(d);
}

// Fatias [desde, ate) de `meses` meses. `ate` é exclusivo, como o before: do Google.
function janelas(desde, ate, meses = 3) {
  const inicio = dia(desde);
  const fim = dia(ate);
  const fatias = [];
  let atual = inicio;
  while (atual < fim) {
    const proxima = somarMeses(atual, meses);
    fatias.push({ desde: atual, ate: proxima < fim ? proxima : fim });
    atual = proxima;
  }
  return fatias;
}

function chaveJanela({ desde, ate }) {
  return `${desde}|${ate}`;
}

// Primeira porta, sem custo: título com uma exclusão sai. Título que não cita
// a empresa fica, porque o Google casa o termo no corpo da matéria ("Gigante
// da celulose investe US$ 4,5 bi no MS"); a IA recebe essa marca e decide.
function motivoDescarte(titulo, { exclusoes }) {
  const t = normalizar(titulo);
  const exclusao = (exclusoes || []).find((e) => t.includes(normalizar(e)));
  return exclusao ? `Exclusão no título: ${exclusao}` : null;
}

// Manchete quase igual: mesmas palavras (sem acento, pontuação e palavras
// curtas), com sobreposição de pelo menos 80% e no mínimo 4 palavras.
// Pega a mesma matéria republicada ou com o título trocado por um detalhe.
const SIMILARIDADE_MANCHETE = 0.8;
const DIAS_MANCHETE = 15;

function palavrasManchete(titulo) {
  return new Set(normalizar(titulo).replace(/[^a-z0-9 ]+/g, " ").split(" ").filter((p) => p.length > 2));
}

function manchetesIguais(a, b) {
  const pa = palavrasManchete(a);
  const pb = palavrasManchete(b);
  if (pa.size < 4 || pb.size < 4) return normalizar(a) === normalizar(b);
  let comuns = 0;
  for (const p of pa) if (pb.has(p)) comuns += 1;
  return comuns / (pa.size + pb.size - comuns) >= SIMILARIDADE_MANCHETE;
}

function pertoNoTempo(a, b, dias = DIAS_MANCHETE) {
  if (!a || !b) return true;
  return Math.abs(new Date(a) - new Date(b)) <= dias * 86_400_000;
}

/**
 * Separa as manchetes quase iguais a uma anterior do grupo. `vivas` são as
 * notícias já guardadas que não foram descartadas; a primeira da rodada
 * também passa a valer como referência. Devolve { unicas, repetidas }, com a
 * manchete de referência em cada repetida.
 */
function separarRepetidas(noticias, vivas = []) {
  const referencias = vivas.map((v) => ({ id: v.id, titulo: v.titulo, data_original: v.data_original }));
  const ids = new Set(noticias.map((n) => n.id));
  const base = referencias.filter((r) => !ids.has(r.id));
  const unicas = [];
  const repetidas = [];
  for (const noticia of noticias) {
    const igual = base.find((r) => pertoNoTempo(r.data_original, noticia.data_original) && manchetesIguais(r.titulo, noticia.titulo));
    if (igual) { repetidas.push({ noticia, igual }); continue; }
    unicas.push(noticia);
    base.push(noticia);
  }
  return { unicas, repetidas };
}

async function manchetesVivas(client, grupoId, noticias) {
  const datas = noticias.map((n) => n.data_original).filter(Boolean).map((d) => new Date(d).getTime());
  const desde = datas.length ? new Date(Math.min(...datas) - DIAS_MANCHETE * 86_400_000) : null;
  const ate = datas.length ? new Date(Math.max(...datas) + DIAS_MANCHETE * 86_400_000) : null;
  const { rows } = await client.query(
    `select id, titulo, data_original
       from capex_radar.evidencias
      where grupo_id = $1 and triagem <> 'descartada' and extracao is not null
        and ($2::timestamptz is null or data_original between $2 and $3)
      order by data_original nulls last
      limit 3000`,
    [grupoId, desde, ate],
  );
  return rows;
}

function citaEmpresa(titulo, { termos }) {
  const t = normalizar(titulo);
  return (termos || []).some((termo) => t.includes(normalizar(termo)));
}

async function emTransacao(client, ator, trabalho) {
  await client.query("begin");
  try {
    await client.query("select set_config('capex_radar.ator', $1, true)", [ator]);
    const resultado = await trabalho();
    await client.query("commit");
    return resultado;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  }
}

async function carregarGrupos(client, { nome } = {}) {
  const { rows } = await client.query(
    `select g.id, g.nome, g.nicho,
            coalesce(json_agg(json_build_object('termo', t.termo, 'tipo', t.tipo))
                     filter (where t.id is not null), '[]') as linhas
       from capex_radar.grupos g
       left join capex_radar.grupo_termos t on t.grupo_id = g.id and t.ativo
      where g.ativo and ($1::text is null or g.nome ilike $1)
      group by g.id
      order by g.nicho, g.ordem_ranking nulls last, g.nome`,
    [nome || null],
  );
  return rows
    .filter((grupo) => grupo.linhas.length)
    .map((grupo) => ({ ...grupo, contexto: seedTermos.contexto_por_nicho[grupo.nicho] || [] }));
}

async function janelasFeitas(client, grupoId) {
  const { rows } = await client.query(
    `select to_char(desde, 'YYYY-MM-DD') as desde, to_char(ate, 'YYYY-MM-DD') as ate
       from capex_radar.coleta_janela
      where grupo_id = $1 and fonte_codigo = $2 and status in ('ok', 'subdividida')`,
    [grupoId, FONTE],
  );
  return new Set(rows.map(chaveJanela));
}

async function registrarJanela(client, grupoId, janela, dados) {
  await client.query(
    `insert into capex_radar.coleta_janela
       (grupo_id, fonte_codigo, desde, ate, consulta, itens, novos, status, erro)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (grupo_id, fonte_codigo, desde, ate) do update set
       consulta = excluded.consulta, itens = excluded.itens, novos = excluded.novos,
       status = excluded.status, erro = excluded.erro, coletado_em = now()`,
    [grupoId, FONTE, janela.desde, janela.ate, dados.consulta, dados.itens || 0,
      dados.novos || 0, dados.status, dados.erro || null],
  );
}

async function gravarNoticias(client, grupo, consulta, noticias) {
  let novos = 0;
  for (const noticia of noticias) {
    const r = await client.query(
      `insert into capex_radar.evidencias
         (fonte_codigo, chave_dedupe, titulo, url, veiculo, data_original, data_precisao,
          grupo_id, consulta, conteudo_bruto)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       on conflict (chave_dedupe) do nothing`,
      [FONTE, chaveDedupe(noticia), noticia.titulo, noticia.url, noticia.veiculo,
        noticia.publicado_em, noticia.publicado_em ? "dia" : "desconhecida",
        grupo.id, consulta, JSON.stringify(noticia)],
    );
    novos += r.rowCount;
  }
  return novos;
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function lerRss(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: {
      "user-agent": "RadarCapEx-MVP/0.1 (research; contact via project owner)",
      accept: "application/rss+xml, application/xml, text/xml",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

/**
 * Lê o RSS de um grupo na janela [desde, ate) e grava as notícias novas.
 * Janelas já lidas (status ok) são puladas, o que deixa a carga retomável.
 */
async function coletarGrupo({ client, grupo, desde, ate, fetchFeed = lerRss, pausaMs = 1500, refazer = false }) {
  const feitas = refazer ? new Set() : await janelasFeitas(client, grupo.id);
  const fila = janelas(desde, ate, 3);
  const resumo = { grupo: grupo.nome, janelas: 0, itens: 0, novos: 0, erros: 0 };

  while (fila.length) {
    const janela = fila.shift();
    if (feitas.has(chaveJanela(janela))) continue;
    const { consulta, url } = buscaDoGrupo({
      linhas: grupo.linhas,
      contexto: grupo.contexto,
      desde: janela.desde,
      ate: janela.ate,
    });
    resumo.janelas += 1;
    try {
      const noticias = noticiasDoRss(await fetchFeed(url));
      const mensal = janelas(janela.desde, janela.ate, 1);
      if (noticias.length >= TETO_RSS && mensal.length > 1) {
        await registrarJanela(client, grupo.id, janela, { consulta, itens: noticias.length, status: "subdividida" });
        fila.unshift(...mensal);
      } else {
        const novos = await emTransacao(client, ATOR_COLETOR, async () => {
          const n = await gravarNoticias(client, grupo, consulta, noticias);
          await registrarJanela(client, grupo.id, janela, { consulta, itens: noticias.length, novos: n, status: "ok" });
          return n;
        });
        resumo.itens += noticias.length;
        resumo.novos += novos;
      }
    } catch (error) {
      resumo.erros += 1;
      await registrarJanela(client, grupo.id, janela, {
        consulta,
        status: "erro",
        erro: String(error.message).slice(0, 500),
      }).catch(() => {});
    }
    if (fila.length && pausaMs) await esperar(pausaMs);
  }
  return resumo;
}

// Filial sugerida: prioritária do grupo no mesmo município (ou a única
// prioritária da UF). Sem município casado, a sugestão fica vazia.
async function sugerirFilial(client, grupoId, { uf, municipio } = {}) {
  if (!uf) return null;
  const { rows } = await client.query(
    `select cnpj, municipio, uf, prioridade
       from capex_radar.vw_filiais
      where grupo_id = $1 and prioritaria and uf = $2
      order by prioridade, cnpj`,
    [grupoId, String(uf).toUpperCase()],
  );
  const alvo = normalizar(municipio);
  const mesmas = alvo ? rows.filter((f) => normalizar(f.municipio) === alvo) : [];
  const escolhida = mesmas[0] || (rows.length === 1 ? rows[0] : null);
  if (!escolhida) return null;
  return {
    cnpj: escolhida.cnpj,
    municipio: escolhida.municipio,
    uf: escolhida.uf,
    prioridade: escolhida.prioridade,
    criterio: mesmas.length ? "municipio" : "unica_na_uf",
    alternativas: Math.max(mesmas.length - 1, 0),
  };
}

async function projetosDoGrupo(client, grupoId) {
  const { rows } = await client.query(
    `select id, titulo, uf, municipio, objeto, estagio
       from capex_radar.projetos
      where grupo_id = $1 and status <> 'descartado'
      order by atualizado_em desc
      limit 60`,
    [grupoId],
  );
  return rows;
}

/**
 * Tria as notícias ainda sem triagem de um grupo: regras e depois a IA.
 * Sem IA (chave ausente ou --sem-ia), só as regras rodam e o resto espera.
 * onProgresso(feitas, total) é chamado depois das regras e de cada lote da IA.
 */
async function triarGrupo({ client, grupo, ia, limite = 400, onProgresso = () => {} }) {
  const { rows: pendentes } = await client.query(
    `select id, titulo, veiculo, data_original
       from capex_radar.evidencias
      where grupo_id = $1 and fonte_codigo = $2 and triagem = 'pendente' and extracao is null
      order by data_original nulls last
      limit $3`,
    [grupo.id, FONTE, limite],
  );
  const resumo = { grupo: grupo.nome, lidas: pendentes.length, regras: 0, repetidas: 0, ia_descartadas: 0, capex: 0, sugeridos: 0, novos_projetos: 0, erros_ia: 0 };
  const termos = separarTermos(grupo.linhas);
  let restantes = [];

  await emTransacao(client, ATOR_TRIAGEM, async () => {
    for (const noticia of pendentes) {
      const motivo = motivoDescarte(noticia.titulo, termos);
      if (!motivo) { restantes.push({ ...noticia, cita_empresa: citaEmpresa(noticia.titulo, termos) }); continue; }
      await client.query(
        `update capex_radar.evidencias
            set triagem = 'descartada', triagem_motivo = $2, extracao = $3::jsonb
          where id = $1`,
        [noticia.id, motivo, JSON.stringify({ capex: false, motivo, etapa: "regras" })],
      );
      resumo.regras += 1;
    }
  });
  // Manchete quase igual a outra do grupo em poucos dias: sai antes da IA.
  if (restantes.length) {
    const { unicas, repetidas } = separarRepetidas(restantes, await manchetesVivas(client, grupo.id, restantes));
    if (repetidas.length) {
      await emTransacao(client, ATOR_TRIAGEM, async () => {
        for (const { noticia, igual } of repetidas) {
          const motivo = `Filtro 1: manchete quase igual a “${String(igual.titulo).slice(0, 140)}”`;
          await client.query(
            `update capex_radar.evidencias
                set triagem = 'descartada', triagem_motivo = $2, extracao = $3::jsonb
              where id = $1`,
            [noticia.id, motivo, JSON.stringify({ capex: false, motivo, etapa: "regras", repete_id: igual.id })],
          );
        }
      });
      resumo.repetidas = repetidas.length;
      restantes = unicas;
    }
  }
  onProgresso(resumo.regras + resumo.repetidas, pendentes.length);
  if (!ia || !restantes.length) return resumo;

  const projetos = await projetosDoGrupo(client, grupo.id);
  for (let i = 0; i < restantes.length; i += LOTE_IA) {
    const lote = restantes.slice(i, i + LOTE_IA);
    let decisoes;
    try {
      decisoes = await ia.triar(grupo, lote);
    } catch {
      resumo.erros_ia += 1; // o lote continua pendente e volta na próxima rodada
      onProgresso(resumo.regras + resumo.repetidas + i + lote.length, pendentes.length);
      continue;
    }
    for (const noticia of lote) {
      const decisao = decisoes.get(noticia.id);
      if (!decisao) continue; // sem resposta: fica para a próxima rodada
      if (!decisao.capex) {
        await emTransacao(client, ATOR_TRIAGEM, () => client.query(
          `update capex_radar.evidencias
              set triagem = 'descartada', triagem_motivo = $2, extracao = $3::jsonb, modelo_triagem = $4
            where id = $1`,
          [noticia.id, decisao.motivo, JSON.stringify({ ...decisao, etapa: "ia" }), ia.modelo],
        ));
        resumo.ia_descartadas += 1;
        continue;
      }
      resumo.capex += 1;
      const extracao = {
        ...decisao,
        etapa: "ia",
        cita_empresa: noticia.cita_empresa,
        filial_sugerida: await sugerirFilial(client, grupo.id, decisao),
      };
      const vinculo = projetos.length
        ? await ia.vincular(grupo, { ...noticia, extracao }, projetos).catch(() => null)
        : null;
      await emTransacao(client, vinculo?.projeto_id ? ATOR_VINCULO : ATOR_TRIAGEM, async () => {
        await client.query(
          `update capex_radar.evidencias
              set extracao = $2::jsonb, modelo_triagem = $3, uf = coalesce(uf, $4), municipio = coalesce(municipio, $5),
                  triagem = case when $6 then 'pendente' else 'novo_projeto' end,
                  triagem_motivo = $7
            where id = $1`,
          [noticia.id, JSON.stringify(extracao), ia.modelo, decisao.uf, decisao.municipio,
            Boolean(vinculo?.projeto_id), vinculo?.motivo || decisao.motivo],
        );
        if (vinculo?.projeto_id) {
          await client.query(
            `insert into capex_radar.evidencia_projeto
               (evidencia_id, projeto_id, origem, situacao, confianca, motivo, modelo)
             values ($1, $2, 'ia', 'sugerido', $3, $4, $5)
             on conflict (evidencia_id, projeto_id) do nothing`,
            [noticia.id, vinculo.projeto_id, vinculo.confianca, vinculo.motivo, ia.modelo],
          );
        }
      });
      if (vinculo?.projeto_id) resumo.sugeridos += 1;
      else resumo.novos_projetos += 1;
    }
    onProgresso(resumo.regras + resumo.repetidas + i + lote.length, pendentes.length);
  }
  return resumo;
}

async function marcarFonte(client, erro = null) {
  await client.query(
    `update capex_radar.fontes
        set ultimo_ok_em = case when $2::text is null then now() else ultimo_ok_em end,
            ultimo_erro_em = case when $2::text is null then ultimo_erro_em else now() end,
            msg_erro = $2
      where codigo = $1`,
    [FONTE, erro],
  );
}

// Grupos seguidos sem nenhuma janela lida: o RSS está recusando o servidor e
// insistir só prolonga o bloqueio. Os que sobraram voltam na próxima rodada.
const LIMITE_FALHAS_SEGUIDAS = 3;

/** Coleta e tria uma lista de grupos na mesma janela. */
async function coletarGrupos({ client, grupos, desde, ate, fetchFeed, ia, pausaMs, refazer, log = () => {} }) {
  const coleta = [];
  const triagem = [];
  let falhasSeguidas = 0;
  for (const grupo of grupos) {
    const c = await coletarGrupo({ client, grupo, desde, ate, fetchFeed, pausaMs, refazer });
    coleta.push(c);
    log(`${grupo.nome}: ${c.janelas} janelas, ${c.itens} itens, ${c.novos} novos${c.erros ? `, ${c.erros} erros` : ""}`);
    const t = await triarGrupo({ client, grupo, ia });
    triagem.push(t);
    falhasSeguidas = c.erros && c.janelas === c.erros ? falhasSeguidas + 1 : 0;
    if (falhasSeguidas >= LIMITE_FALHAS_SEGUIDAS) {
      log(`RSS recusou ${falhasSeguidas} grupos seguidos; parando. ${grupos.length - coleta.length} grupos ficam para a próxima rodada.`);
      break;
    }
  }
  const erros = coleta.reduce((total, c) => total + c.erros, 0);
  await marcarFonte(client, erros ? `${erros} janelas com erro na última coleta` : null);
  return { coleta, triagem };
}

// Atualização semanal: últimos 14 dias de todos os grupos. A sobreposição
// com a semana anterior é barata, porque a chave_dedupe barra repetição.
// A última rodada conta mesmo com erro, para o agendador não repetir a cada minuto.
function janelaSemanal(hoje = new Date()) {
  return { desde: somarDias(hoje, -DIAS_SEMANA), ate: somarDias(hoje, 1) };
}

// Grupos sem janela semanal ok nos últimos 7 dias. A conta é por grupo para a
// rodada interrompida (deploy, reinício) continuar de onde parou. Janela com
// erro (o Google devolve 503 quando recusa o servidor) segura o grupo por 6 h
// e depois ele volta para a fila, em vez de esperar a semana seguinte.
async function gruposVencidos(client, grupos) {
  const { rows } = await client.query(
    `select distinct grupo_id from capex_radar.coleta_janela
      where fonte_codigo = $1 and ate - desde <= $2
        and ((status = 'ok' and coletado_em > now() - interval '7 days')
          or (status = 'erro' and coletado_em > now() - interval '6 hours'))`,
    [FONTE, DIAS_SEMANA + 1],
  );
  const recentes = new Set(rows.map((row) => row.grupo_id));
  return grupos.filter((grupo) => !recentes.has(grupo.id));
}

function resumoTexto({ coleta, triagem, agente = null }) {
  const soma = (lista, campo) => lista.reduce((total, item) => total + (item[campo] || 0), 0);
  return [
    `${coleta.length} empresas`,
    `${soma(coleta, "itens")} notícias lidas, ${soma(coleta, "novos")} novas`,
    `${soma(triagem, "capex")} de CapEx (${soma(triagem, "sugeridos")} vínculos sugeridos, ${soma(triagem, "novos_projetos")} possíveis projetos novos)`,
    soma(coleta, "erros") ? `${soma(coleta, "erros")} janelas com erro` : null,
    soma(triagem, "erros_ia") ? `${soma(triagem, "erros_ia")} lotes da IA com erro` : null,
    agente ? `agente: ${soma(agente, "projetos_criados")} projetos criados, ${soma(agente, "vinculadas")} vinculadas, ${soma(agente, "descartadas")} descartadas, ${soma(agente, "revisao_humana")} para revisão` : null,
  ].filter(Boolean).join(" · ");
}

module.exports = {
  FONTE,
  TETO_RSS,
  lerRss,
  normalizar,
  tituloSemVeiculo,
  noticiasDoRss,
  chaveDedupe,
  janelas,
  janelaSemanal,
  motivoDescarte,
  manchetesIguais,
  separarRepetidas,
  citaEmpresa,
  carregarGrupos,
  coletarGrupo,
  triarGrupo,
  sugerirFilial,
  coletarGrupos,
  gruposVencidos,
  resumoTexto,
};
