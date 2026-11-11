// Julgamento dos registros por empresa (reprocessamento, scripts/capex-reprocessar.js).
//
// Os registros das fontes secundárias vêm do CNPJ e da razão social, então se
// repetem entre os projetos da mesma empresa. Cada registro único é julgado
// uma vez e atribuído ao projeto a que pertence, ou a nenhum.
//
//   registros-empresa  exporta, por empresa, os projetos e os registros únicos
//                      a julgar. Diário oficial que não cita o município de
//                      nenhum projeto da empresa vai para _automaticos.json.
//   julgar             aplica as atribuições [{ chave, projeto_id, correlacao,
//                      motivo }]; o resto do que foi lido fica 'outro_projeto'.
const fs = require("node:fs");
const path = require("node:path");
const sec = require("../src/capex-fontes-secundarias");

// Fontes estruturadas por CNPJ: entram sempre no julgamento.
const ESTRUTURADAS = /^SEC-(BNDES|CNO|CVM|SISLIC|SIGA|ANEEL|REIDI|ANA|ANTT|ANTAQ|IAT|SEMAD|CNPJ|ANP)/;

const dobrar = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function criar({ pool, projetosAtivos, noticiasDoProjeto, dia, ATOR }) {
  async function registrosEmpresa(args) {
    if (!args.saida) throw new Error("Informe --saida <pasta>");
    fs.mkdirSync(args.saida, { recursive: true });
    const projetos = await projetosAtivos(args.projeto);
    const porGrupo = new Map();
    for (const p of projetos) {
      if (args.empresa && p.grupo !== args.empresa) continue;
      if (!porGrupo.has(p.grupo)) porGrupo.set(p.grupo, []);
      porGrupo.get(p.grupo).push(p);
    }
    const resumo = { empresas: 0, unicos: 0, a_julgar: 0, automaticos: 0 };
    const automaticos = [];
    for (const [grupo, lista] of porGrupo) {
      const { rows } = await pool.query(
        `select projeto_id, chave, fonte_codigo, data_registro, registro
           from capex_radar.registros_analisados
          where projeto_id = any($1::uuid[]) and correlacao = 'nao_avaliada'`,
        [lista.map((p) => p.id)],
      );
      const unicos = new Map();
      for (const r of rows) {
        if (!unicos.has(r.chave)) unicos.set(r.chave, { ...r, projetos: [] });
        unicos.get(r.chave).projetos.push(r.projeto_id);
      }
      const municipios = lista.map((p) => dobrar(p.municipio)).filter((m) => m.length >= 4);
      const julgar = [];
      for (const r of unicos.values()) {
        const { contexto, ...campos } = r.registro || {};
        const texto = dobrar(`${contexto || ""} ${JSON.stringify(campos)}`);
        if (ESTRUTURADAS.test(r.fonte_codigo) || municipios.some((m) => texto.includes(m))) {
          julgar.push({
            chave: r.chave, fonte: r.fonte_codigo, data: dia(r.data_registro),
            campos: JSON.stringify(campos).slice(0, 900), contexto: contexto ? String(contexto).slice(0, 900) : null,
          });
        } else {
          for (const pid of r.projetos) automaticos.push({ projeto_id: pid, chave: r.chave });
        }
      }
      resumo.empresas += 1;
      resumo.unicos += unicos.size;
      resumo.a_julgar += julgar.length;
      resumo.automaticos += unicos.size - julgar.length;
      const doc = {
        empresa: grupo,
        cnpj_matriz: lista[0].matriz_cnpj,
        razao_social: lista[0].matriz_razao_social,
        projetos: [],
        registros: julgar.sort((a, b) => a.fonte.localeCompare(b.fonte) || String(a.data).localeCompare(String(b.data))),
      };
      for (const p of lista) {
        doc.projetos.push({
          id: p.id, titulo: p.titulo, objeto: p.objeto, uf: p.uf, municipio: p.municipio,
          data_anuncio: dia(p.data_anuncio), estagio: p.estagio, projeto_pai_id: p.projeto_pai_id, relacao: p.relacao,
          noticias: (await noticiasDoProjeto(p.id)).filter((n) => n.fonte.startsWith("notícia")).map((n) => `${n.data} ${n.titulo}`),
        });
      }
      const nome = dobrar(grupo).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      fs.writeFileSync(path.join(args.saida, `${nome}.json`), JSON.stringify(doc, null, 1));
    }
    fs.writeFileSync(path.join(args.saida, "_automaticos.json"), JSON.stringify(automaticos));
    console.log(JSON.stringify(resumo));
  }

  async function julgar(args) {
    if (!args.arquivo) throw new Error("Informe --arquivo <atribuicoes.json>");
    const dados = JSON.parse(fs.readFileSync(args.arquivo, "utf8"));
    const atribuicoes = Array.isArray(dados) ? dados : dados.atribuicoes || [];
    const resultado = { projetos: 0, copiados: 0, evidencias: 0, atualizados: 0, sem_ligacao: 0, automaticos: 0 };
    const porProjeto = new Map();
    for (const a of atribuicoes) {
      if (!["direta", "incerta"].includes(a.correlacao)) throw new Error(`correlação inválida: ${a.correlacao}`);
      // Registro atribuído a um projeto que não o coletou (ex.: subprojeto novo): copia.
      const r = await pool.query(
        `insert into capex_radar.registros_analisados (projeto_id, fonte_codigo, chave, registro, data_registro, correlacao, motivo, analisado_por)
         select $1, fonte_codigo, chave, registro, data_registro, 'nao_avaliada', 'Atribuído no julgamento por empresa', $3
           from capex_radar.registros_analisados where chave = $2 limit 1
         on conflict (projeto_id, chave) do nothing`,
        [a.projeto_id, a.chave, ATOR],
      );
      resultado.copiados += r.rowCount;
      if (!porProjeto.has(a.projeto_id)) porProjeto.set(a.projeto_id, []);
      porProjeto.get(a.projeto_id).push({ chave: a.chave, correlacao: a.correlacao, motivo: a.motivo });
    }
    resultado.projetos = porProjeto.size;
    for (const [projetoId, vereditos] of porProjeto) {
      const [projeto] = await projetosAtivos(projetoId);
      if (!projeto) continue;
      const r = await sec.aplicarJulgamento(pool, projeto, vereditos, { ator: ATOR });
      resultado.evidencias += r.evidencias;
      resultado.atualizados += r.atualizados;
    }
    if (args.automaticos) {
      for (const a of JSON.parse(fs.readFileSync(args.automaticos, "utf8"))) {
        const r = await pool.query(
          `update capex_radar.registros_analisados
              set correlacao = 'outro_projeto', motivo = 'Diário sem o município de nenhum projeto da empresa',
                  analisado_por = $3, em = now()
            where projeto_id = $1 and chave = $2 and correlacao = 'nao_avaliada'`,
          [a.projeto_id, a.chave, ATOR],
        );
        resultado.automaticos += r.rowCount;
      }
    }
    if (args.empresa) {
      const ids = (await projetosAtivos()).filter((p) => p.grupo === args.empresa).map((p) => p.id);
      const r = await pool.query(
        `update capex_radar.registros_analisados
            set correlacao = 'outro_projeto', motivo = 'Lido no julgamento por empresa: sem ligação com este projeto',
                analisado_por = $2, em = now()
          where projeto_id = any($1::uuid[]) and correlacao = 'nao_avaliada'`,
        [ids, ATOR],
      );
      resultado.sem_ligacao = r.rowCount;
    }
    console.log(JSON.stringify(resultado));
  }

  return { registrosEmpresa, julgar };
}

module.exports = { criar, ESTRUTURADAS };
