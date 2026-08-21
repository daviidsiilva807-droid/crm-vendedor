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

  function obterConfig() {
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
      ancoraISO: /^\d{4}-\d{2}-\d{2}$/.test(salvo.ancoraISO || "") ? salvo.ancoraISO : ANCORA_PADRAO
    };
  }

  function salvarConfig(parcial) {
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

  /* Posicao na lista de vendedores responsavel pela secao informada. */
  function indiceDaSecao(secao, indiceSemanaAlvo) {
    return modulo(secao - 1 - indiceSemanaAlvo, TOTAL_SECOES);
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
      const indice = indiceDaSecao(secao, alvo.indice);
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
    const secao = secaoDoVendedor(cfg.euIndice, alvo.indice);
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
        secao: secaoDoVendedor(cfg.euIndice, semana.indice),
        atual: passo === 0
      });
    }
    return lista;
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
    corDaSecao,
    minhaSecao,
    meuRodizio,
    diasParaTroca
  };
})();
