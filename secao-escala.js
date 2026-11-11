/* ==========================================================================
   CRM Vendedor - Escala de secoes da loja
   Cada semana um vendedor assume um ambiente da loja (secao 01 a 08).
   O rodizio anda uma posicao por semana a partir de uma semana de referencia.
   ========================================================================== */

(function () {
  const TOTAL_SECOES = 8;
  const MS_DIA = 86400000;

  /* Semana impressa na folha da loja: 17/08/2026 a 23/08/2026.
     Nessa semana o vendedor da posicao 1 da lista estava na secao 01. */
  const ANCORA_PADRAO = "2026-08-17";

  const VENDEDORES_PADRAO = [
    "Lucas",
    "Mychelly",
    "Fernando",
    "Paloma",
    "Fernanda",
    "David",
    "Alice",
    "Halley"
  ];

  const CORES = [
    { forte: "#2563eb", suave: "#eff6ff", borda: "#bfdbfe" },
    { forte: "#dc2626", suave: "#fef2f2", borda: "#fecaca" },
    { forte: "#d97706", suave: "#fffbeb", borda: "#fde68a" },
    { forte: "#0891b2", suave: "#ecfeff", borda: "#a5f3fc" },
    { forte: "#7c3aed", suave: "#f5f3ff", borda: "#ddd6fe" },
    { forte: "#db2777", suave: "#fdf2f8", borda: "#fbcfe8" },
    { forte: "#16a34a", suave: "#f0fdf4", borda: "#bbf7d0" },
    { forte: "#65a30d", suave: "#f7fee7", borda: "#d9f99d" }
  ];

  function loginAtual() {
    if (window.CRM && typeof window.CRM.loginAtual === "function") {
      return window.CRM.loginAtual();
    }
    return "anonimo";
  }

  function chave() {
    return `crm_escala_secoes_v1_${loginAtual()}`;
  }

  function lerConfigBruta() {
    try {
      const bruto = localStorage.getItem(chave());
      return bruto ? JSON.parse(bruto) : null;
    } catch (erro) {
      return null;
    }
  }

  /* Trocas feitas so numa semana: { "<indiceSemana>": [vendedor da secao 1, ..., da secao 8] }.
     So aceita permutacoes validas de 0 a 7; o resto e descartado. */
  function permutacaoValida(lista) {
    if (!Array.isArray(lista) || lista.length !== TOTAL_SECOES) {
      return false;
    }
    const vistos = new Set(lista);
    return vistos.size === TOTAL_SECOES && lista.every((n) => Number.isInteger(n) && n >= 0 && n < TOTAL_SECOES);
  }

  function lerTrocas(bruto) {
    const limpo = {};
    if (bruto && typeof bruto === "object") {
      Object.keys(bruto).forEach((chaveSemana) => {
        if (/^-?\d{1,5}$/.test(chaveSemana) && permutacaoValida(bruto[chaveSemana])) {
          limpo[chaveSemana] = bruto[chaveSemana].slice();
        }
      });
    }
    return limpo;
  }

  /* Config externa (pagina compartilhada): quando definida, substitui a do navegador
     e nada e gravado. */
  let configExterna = null;

  function usarConfig(config) {
    configExterna = config || null;
  }

  /* ---------------------- Link de compartilhamento ---------------------- */
  const LIMITE_LINK = 4000;

  function paraBase64Url(texto) {
    const bytes = new TextEncoder().encode(texto);
    let binario = "";
    bytes.forEach((b) => { binario += String.fromCharCode(b); });
    return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function deBase64Url(texto) {
    const padrao = String(texto).replace(/-/g, "+").replace(/_/g, "/");
    const completo = padrao + "=".repeat((4 - (padrao.length % 4)) % 4);
    const binario = atob(completo);
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  function dataISOValida(texto) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(texto || "")) && Number.isFinite(paraUTC(texto));
  }

  /* Gera o texto que vai depois de "#d=" no link. So nomes, ancora e trocas:
     nada pessoal (como "quem e voce") vai junto. */
  function gerarCompartilhamento(semana) {
    const cfg = obterConfig();
    const dados = {
      v: 1,
      n: cfg.vendedores,
      a: cfg.ancoraISO,
      t: cfg.trocas,
      w: (semana || semanaAtual(cfg)).inicioISO,
      g: hojeISO()
    };
    return paraBase64Url(JSON.stringify(dados));
  }

  /* Le e valida o texto de um link. Devolve null se qualquer coisa estiver errada. */
  function lerCompartilhamento(texto) {
    try {
      const bruto = String(texto || "");
      if (!bruto || bruto.length > LIMITE_LINK || !/^[A-Za-z0-9_-]+$/.test(bruto)) {
        return null;
      }
      const dados = JSON.parse(deBase64Url(bruto));
      if (!dados || dados.v !== 1 || !Array.isArray(dados.n) || dados.n.length !== TOTAL_SECOES) {
        return null;
      }

      const vendedores = dados.n.map((nome) =>
        String(nome === null || nome === undefined ? "" : nome)
          .replace(/[\u0000-\u001f\u007f<>]/g, "")
          .trim()
          .slice(0, 24)
      );
      if (vendedores.some((nome) => !nome) || !dataISOValida(dados.a) || !dataISOValida(dados.w)) {
        return null;
      }

      return {
        config: { vendedores, euIndice: -1, trocas: lerTrocas(dados.t), ancoraISO: dados.a },
        semanaISO: dados.w,
        geradoEm: dataISOValida(dados.g) ? dados.g : ""
      };
    } catch (erro) {
      return null;
    }
  }

  function obterConfig() {
    if (configExterna) {
      return configExterna;
    }
    const salvo = lerConfigBruta() || {};
    const vendedores = VENDEDORES_PADRAO.map((padrao, indice) => {
      const nome = Array.isArray(salvo.vendedores) ? String(salvo.vendedores[indice] || "").trim() : "";
      return nome || padrao;
    });

    const euIndice = Number.isInteger(salvo.euIndice) && salvo.euIndice >= 0 && salvo.euIndice < TOTAL_SECOES
      ? salvo.euIndice
      : -1;

    return {
      vendedores,
      euIndice,
      trocas: lerTrocas(salvo.trocas),
      ancoraISO: /^\d{4}-\d{2}-\d{2}$/.test(salvo.ancoraISO || "") ? salvo.ancoraISO : ANCORA_PADRAO
    };
  }

  function salvarConfig(parcial) {
    if (configExterna) {
      return configExterna; // modo somente leitura (pagina compartilhada)
    }
    const novo = Object.assign({}, obterConfig(), parcial || {});
    localStorage.setItem(chave(), JSON.stringify(novo));
    return novo;
  }

  /* ------------------------------- Datas -------------------------------- */

  function paraUTC(iso) {
    const partes = String(iso || "").split("-").map(Number);
    return Date.UTC(partes[0], (partes[1] || 1) - 1, partes[2] || 1);
  }

  function paraISO(ms) {
    const data = new Date(ms);
    const ano = data.getUTCFullYear();
    const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
    const dia = String(data.getUTCDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  function hojeISO() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, "0");
    const dia = String(agora.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  function formatarBR(iso) {
    const partes = String(iso || "").split("-");
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : "";
  }

  function formatarCurto(iso) {
    const partes = String(iso || "").split("-");
    return partes.length === 3 ? `${partes[2]}/${partes[1]}` : "";
  }

  /* Numero da semana em relacao a ancora. Pode ser negativo (semanas passadas). */
  function indiceSemana(iso, config) {
    const cfg = config || obterConfig();
    const dias = Math.floor((paraUTC(iso) - paraUTC(cfg.ancoraISO)) / MS_DIA);
    return Math.floor(dias / 7);
  }

  function semanaDe(iso, config) {
    const cfg = config || obterConfig();
    const indice = indiceSemana(iso, cfg);
    const inicio = paraUTC(cfg.ancoraISO) + indice * 7 * MS_DIA;
    return {
      indice,
      inicioISO: paraISO(inicio),
      fimISO: paraISO(inicio + 6 * MS_DIA)
    };
  }

  function semanaAtual(config) {
    return semanaDe(hojeISO(), config);
  }

  function deslocarSemana(semana, passos) {
    const cfg = obterConfig();
    const inicio = paraUTC(cfg.ancoraISO) + (semana.indice + passos) * 7 * MS_DIA;
    return {
      indice: semana.indice + passos,
      inicioISO: paraISO(inicio),
      fimISO: paraISO(inicio + 6 * MS_DIA)
    };
  }

  function modulo(valor, divisor) {
    return ((valor % divisor) + divisor) % divisor;
  }

  /* Secao (1 a 8) que o vendedor da posicao `indice` ocupa na semana informada. */
  function secaoDoVendedor(indice, indiceSemanaAlvo) {
    return modulo(indice + indiceSemanaAlvo, TOTAL_SECOES) + 1;
  }

  /* Posicao na lista de vendedores responsavel pela secao informada (rodizio puro). */
  function indiceDaSecao(secao, indiceSemanaAlvo) {
    return modulo(secao - 1 - indiceSemanaAlvo, TOTAL_SECOES);
  }

  /* Quem responde por cada secao na semana: [vendedor da secao 1, ..., da secao 8].
     Usa a troca feita so naquela semana, se existir; senao, o rodizio. */
  function ordemDaSemana(indiceSemanaAlvo, config) {
    const cfg = config || obterConfig();
    const troca = cfg.trocas[String(indiceSemanaAlvo)];
    if (troca) {
      return troca.slice();
    }
    const lista = [];
    for (let secao = 1; secao <= TOTAL_SECOES; secao += 1) {
      lista.push(indiceDaSecao(secao, indiceSemanaAlvo));
    }
    return lista;
  }

  function vendedorDaSecao(secao, indiceSemanaAlvo, config) {
    return ordemDaSemana(indiceSemanaAlvo, config)[secao - 1];
  }

  function secaoNaSemana(indiceVendedor, indiceSemanaAlvo, config) {
    return ordemDaSemana(indiceSemanaAlvo, config).indexOf(indiceVendedor) + 1;
  }

  function semanaTemTroca(indiceSemanaAlvo, config) {
    return Boolean((config || obterConfig()).trocas[String(indiceSemanaAlvo)]);
  }

  function corDaSecao(secao) {
    return CORES[modulo(secao - 1, TOTAL_SECOES)];
  }

  /* Escala completa da semana: uma entrada por secao, da 01 a 08. */
  function escalaDaSemana(semana, config) {
    const cfg = config || obterConfig();
    const alvo = semana || semanaAtual(cfg);

    const lista = [];
    for (let secao = 1; secao <= TOTAL_SECOES; secao += 1) {
      const indice = vendedorDaSecao(secao, alvo.indice, cfg);
      lista.push({
        secao,
        indice,
        nome: cfg.vendedores[indice],
        souEu: cfg.euIndice === indice,
        cor: corDaSecao(secao)
      });
    }
    return lista;
  }

  /* Onde eu estou (ou estarei) na semana informada. Null se ninguem marcou "sou eu". */
  function minhaSecao(semana, config) {
    const cfg = config || obterConfig();
    if (cfg.euIndice < 0) {
      return null;
    }
    const alvo = semana || semanaAtual(cfg);
    const secao = secaoNaSemana(cfg.euIndice, alvo.indice, cfg);
    return {
      secao,
      indice: cfg.euIndice,
      nome: cfg.vendedores[cfg.euIndice],
      souEu: true,
      cor: corDaSecao(secao),
      semana: alvo
    };
  }

  /* Proximas `quantidade` semanas de quem marcou "sou eu". */
  function meuRodizio(quantidade, config) {
    const cfg = config || obterConfig();
    if (cfg.euIndice < 0) {
      return [];
    }

    const total = Math.max(1, quantidade || 4);
    const base = semanaAtual(cfg);
    const lista = [];

    for (let passo = 0; passo < total; passo += 1) {
      const semana = deslocarSemana(base, passo);
      lista.push({
        semana,
        secao: secaoNaSemana(cfg.euIndice, semana.indice, cfg),
        atual: passo === 0
      });
    }
    return lista;
  }

  /* Troca, so nesta semana, quem esta nas secoes A e B. */
  function trocarNaSemana(semana, secaoA, secaoB) {
    if (!Number.isInteger(secaoA) || !Number.isInteger(secaoB) || secaoA === secaoB ||
        secaoA < 1 || secaoB < 1 || secaoA > TOTAL_SECOES || secaoB > TOTAL_SECOES) {
      return null;
    }
    const cfg = obterConfig();
    const ordem = ordemDaSemana(semana.indice, cfg);
    const aux = ordem[secaoA - 1];
    ordem[secaoA - 1] = ordem[secaoB - 1];
    ordem[secaoB - 1] = aux;

    const trocas = Object.assign({}, cfg.trocas);
    const padrao = ordemDaSemana(semana.indice, Object.assign({}, cfg, { trocas: {} }));
    if (ordem.every((v, i) => v === padrao[i])) {
      delete trocas[String(semana.indice)]; // voltou ao normal
    } else {
      trocas[String(semana.indice)] = ordem;
    }
    return salvarConfig({ trocas });
  }

  /* Desfaz a troca feita so nesta semana. */
  function restaurarSemana(semana) {
    const trocas = Object.assign({}, obterConfig().trocas);
    delete trocas[String(semana.indice)];
    return salvarConfig({ trocas });
  }

  /* Troca a ordem do rodizio: quem estava na secao A passa para a B e vice-versa
     nesta semana, e o rodizio continua girando a partir dai (vale para todas as
     semanas sem troca propria). Quem e "voce" acompanha a pessoa. */
  function trocarOrdemRodizio(semana, secaoA, secaoB) {
    if (!Number.isInteger(secaoA) || !Number.isInteger(secaoB) || secaoA === secaoB ||
        secaoA < 1 || secaoB < 1 || secaoA > TOTAL_SECOES || secaoB > TOTAL_SECOES) {
      return null;
    }
    const cfg = obterConfig();
    return trocarPosicoes(
      vendedorDaSecao(secaoA, semana.indice, cfg),
      vendedorDaSecao(secaoB, semana.indice, cfg)
    );
  }

  /* Troca duas posicoes (numeracao) da lista de vendedores. As pessoas trocam de
     lugar no rodizio; trocas de semana e "quem e voce" acompanham cada pessoa. */
  function trocarPosicoes(iA, iB) {
    const posicaoValida = (n) => Number.isInteger(n) && n >= 0 && n < TOTAL_SECOES;
    if (!posicaoValida(iA) || !posicaoValida(iB) || iA === iB) {
      return null;
    }
    const cfg = obterConfig();

    const vendedores = cfg.vendedores.slice();
    vendedores[iA] = cfg.vendedores[iB];
    vendedores[iB] = cfg.vendedores[iA];

    const troca = (n) => (n === iA ? iB : n === iB ? iA : n);
    const trocas = {};
    Object.keys(cfg.trocas).forEach((k) => {
      trocas[k] = cfg.trocas[k].map(troca);
    });

    return salvarConfig({
      vendedores,
      euIndice: cfg.euIndice < 0 ? cfg.euIndice : troca(cfg.euIndice),
      trocas
    });
  }

  /* Dias que faltam para a troca de secao (fim da semana atual). */
  function diasParaTroca(config) {
    const cfg = config || obterConfig();
    const semana = semanaAtual(cfg);
    return Math.round((paraUTC(semana.fimISO) - paraUTC(hojeISO())) / MS_DIA);
  }

  window.Escala = {
    TOTAL_SECOES,
    VENDEDORES_PADRAO,
    CORES,
    obterConfig,
    salvarConfig,
    hojeISO,
    formatarBR,
    formatarCurto,
    semanaAtual,
    semanaDe,
    deslocarSemana,
    escalaDaSemana,
    secaoDoVendedor,
    indiceDaSecao,
    vendedorDaSecao,
    secaoNaSemana,
    semanaTemTroca,
    trocarNaSemana,
    restaurarSemana,
    trocarOrdemRodizio,
    trocarPosicoes,
    usarConfig,
    gerarCompartilhamento,
    lerCompartilhamento,
    corDaSecao,
    minhaSecao,
    meuRodizio,
    diasParaTroca
  };
})();
