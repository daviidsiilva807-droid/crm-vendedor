/* ==========================================================================
   CRM Vendedor - Camada de dados (localStorage por usuario)
   Metas, lancamentos de venda, comissao, calendario e campanhas.
   ========================================================================== */

(function () {
  const SESSION_KEY = "controleSecao_sessao_v1";

  const PADRAO_CONFIG = {
    metaEstabelecida: 84000,
    metaPessoal: 96000,
    percentualBonus: 0.6,
    valorMedioVenda: 0,
    ajusteInicial: 0
  };

  /* Tabela oficial de comissao por faixa de faturamento. */
  const FAIXAS_COMISSAO = [
    { valor: 40000, percentual: 0.5 },
    { valor: 46000, percentual: 1.0 },
    { valor: 50000, percentual: 1.2 },
    { valor: 56000, percentual: 1.5 },
    { valor: 64000, percentual: 2.0 },
    { valor: 72000, percentual: 2.25 },
    { valor: 80000, percentual: 2.5 },
    { valor: 88000, percentual: 2.6 },
    { valor: 96000, percentual: 2.7 },
    { valor: 104000, percentual: 2.8 },
    { valor: 112000, percentual: 2.9 }
  ];

  function loginAtual() {
    try {
      const bruto = localStorage.getItem(SESSION_KEY);
      if (!bruto) {
        return "anonimo";
      }
      const sessao = JSON.parse(bruto);
      return (sessao && sessao.login) || "anonimo";
    } catch (erro) {
      return "anonimo";
    }
  }

  function chave(base) {
    return `crm_${base}_v1_${loginAtual()}`;
  }

  function lerJSON(nomeChave, padrao) {
    try {
      const bruto = localStorage.getItem(nomeChave);
      if (!bruto) {
        return padrao;
      }
      const dados = JSON.parse(bruto);
      return dados === null || dados === undefined ? padrao : dados;
    } catch (erro) {
      return padrao;
    }
  }

  function gravarJSON(nomeChave, valor) {
    localStorage.setItem(nomeChave, JSON.stringify(valor));
  }

  function numero(valor) {
    const convertido = Number(valor);
    return Number.isFinite(convertido) ? convertido : 0;
  }

  function gerarId() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  /* ------------------------------ Datas --------------------------------- */

  function hojeISO() {
    return paraISO(new Date());
  }

  function paraISO(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  function deISO(iso) {
    const partes = String(iso || "").split("-");
    if (partes.length !== 3) {
      return new Date();
    }
    return new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
  }

  function competenciaDe(iso) {
    return String(iso || "").slice(0, 7);
  }

  function competenciaAtual() {
    return hojeISO().slice(0, 7);
  }

  function diasNoMes(competencia) {
    const [ano, mes] = competencia.split("-").map(Number);
    return new Date(ano, mes, 0).getDate();
  }

  function formatarDataCurta(iso) {
    const data = deISO(iso);
    return `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")}`;
  }

  function formatarDataBR(iso) {
    if (!iso) {
      return "-";
    }
    const data = deISO(iso);
    return data.toLocaleDateString("pt-BR");
  }

  function nomeDiaSemana(iso) {
    const nomes = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    return nomes[deISO(iso).getDay()];
  }

  /* ---------------------------- Formatacao ------------------------------ */

  function moeda(valor) {
    return numero(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function moedaCurta(valor) {
    const n = numero(valor);
    if (Math.abs(n) >= 1000) {
      return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
    }
    return moeda(n);
  }

  function numeroBR(valor, casas) {
    const decimais = casas === undefined ? 2 : casas;
    return numero(valor).toLocaleString("pt-BR", {
      minimumFractionDigits: decimais,
      maximumFractionDigits: decimais
    });
  }

  function percentual(valor) {
    return `${numeroBR(valor, 1)}%`;
  }

  function moedaParaNumero(texto) {
    const digitos = String(texto === null || texto === undefined ? "" : texto).replace(/\D/g, "");
    if (!digitos) {
      return 0;
    }
    return Number(digitos) / 100;
  }

  /* ------------------------------ Config -------------------------------- */

  function obterConfig() {
    const salvo = lerJSON(chave("config"), {});
    const config = Object.assign({}, PADRAO_CONFIG, salvo && typeof salvo === "object" ? salvo : {});

    /* Compatibilidade com a versao que gravava percentualComissao. */
    if (config.percentualBonus === undefined && config.percentualComissao !== undefined) {
      config.percentualBonus = config.percentualComissao;
    }

    config.metaEstabelecida = Math.max(0, numero(config.metaEstabelecida));
    config.metaPessoal = Math.max(0, numero(config.metaPessoal));
    config.percentualBonus = Math.max(0, numero(config.percentualBonus));
    config.valorMedioVenda = Math.max(0, numero(config.valorMedioVenda));
    config.ajusteInicial = Math.max(0, numero(config.ajusteInicial));

    return config;
  }

  function salvarConfig(parcial) {
    const atual = obterConfig();
    const novo = Object.assign({}, atual, parcial || {}, { atualizadoEm: new Date().toISOString() });
    gravarJSON(chave("config"), novo);
    return obterConfig();
  }

  /* -------------------------- Lancamentos ------------------------------- */

  function listarLancamentos() {
    const lista = lerJSON(chave("lancamentos"), []);
    if (!Array.isArray(lista)) {
      return [];
    }

    return lista
      .filter((item) => item && item.data)
      .map((item) => ({
        id: item.id || gerarId(),
        data: String(item.data).slice(0, 10),
        valor: Math.max(0, numero(item.valor)),
        pecas: Math.max(0, Math.round(numero(item.pecas))),
        obs: String(item.obs || "")
      }))
      .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  }

  function listarLancamentosDoMes(competencia) {
    const alvo = competencia || competenciaAtual();
    return listarLancamentos().filter((item) => competenciaDe(item.data) === alvo);
  }

  function adicionarLancamento(dados) {
    const valor = Math.max(0, numero(dados && dados.valor));
    const data = (dados && dados.data ? String(dados.data) : hojeISO()).slice(0, 10);

    if (valor <= 0) {
      return { ok: false, mensagem: "Informe um valor de venda maior que zero." };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return { ok: false, mensagem: "Data invalida." };
    }

    const lista = listarLancamentos();
    lista.push({
      id: gerarId(),
      data,
      valor,
      pecas: Math.max(0, Math.round(numero(dados && dados.pecas))),
      obs: String((dados && dados.obs) || "").slice(0, 120),
      criadoEm: new Date().toISOString()
    });

    gravarJSON(chave("lancamentos"), lista);
    return { ok: true, mensagem: `Venda de ${moeda(valor)} registrada em ${formatarDataBR(data)}.` };
  }

  function removerLancamento(id) {
    const lista = listarLancamentos().filter((item) => item.id !== id);
    gravarJSON(chave("lancamentos"), lista);
    return { ok: true, mensagem: "Lancamento removido." };
  }

  function totalPorDia(competencia) {
    const mapa = {};
    listarLancamentosDoMes(competencia).forEach((item) => {
      mapa[item.data] = numero(mapa[item.data]) + item.valor;
    });
    return mapa;
  }

  /* ---------------------------- Comissao -------------------------------- */

  function faixaDe(faturamento) {
    const total = Math.max(0, numero(faturamento));
    let faixa = null;

    FAIXAS_COMISSAO.forEach((item) => {
      if (total >= item.valor) {
        faixa = item;
      }
    });

    return faixa;
  }

  function proximaFaixa(faturamento) {
    const total = Math.max(0, numero(faturamento));
    return FAIXAS_COMISSAO.find((item) => total < item.valor) || null;
  }

  /*
    Comissao = percentual da faixa atingida sobre o faturamento
             + bonificacao (padrao 0,6%) quando a meta estabelecida e batida.
  */
  function calcularComissaoDetalhada(faturamento, config) {
    const cfg = config || obterConfig();
    const total = Math.max(0, numero(faturamento));
    const faixa = faixaDe(total);
    const percentualFaixa = faixa ? faixa.percentual : 0;
    const valorFaixa = total * (percentualFaixa / 100);

    const bonusAtivo = cfg.metaEstabelecida > 0 && total >= cfg.metaEstabelecida;
    const percentualBonus = Math.max(0, numero(cfg.percentualBonus));
    const valorBonus = bonusAtivo ? total * (percentualBonus / 100) : 0;

    return {
      faturamento: total,
      faixa,
      faixaValor: faixa ? faixa.valor : 0,
      percentualFaixa,
      valorFaixa,
      bonusAtivo,
      percentualBonus,
      valorBonus,
      percentualTotal: percentualFaixa + (bonusAtivo ? percentualBonus : 0),
      valorTotal: valorFaixa + valorBonus
    };
  }

  function calcularMeta(faturamento, meta, config) {
    const cfg = config || obterConfig();
    const total = Math.max(0, numero(faturamento));
    const alvo = Math.max(0, numero(meta));
    const atingiu = alvo > 0 && total >= alvo;

    /* Quanto a comissao seria caso o faturamento fechasse exatamente na meta. */
    const simulacao = calcularComissaoDetalhada(alvo, cfg);

    return {
      meta: alvo,
      atingiu,
      falta: Math.max(0, alvo - total),
      progresso: alvo > 0 ? Math.min(100, (total / alvo) * 100) : 0,
      simulacao,
      previsaoSeAtingir: simulacao.valorTotal
    };
  }

  /* ------------------------------ Resumo -------------------------------- */

  function resumo(competencia) {
    const alvoMes = competencia || competenciaAtual();
    const config = obterConfig();
    const lancamentos = listarLancamentosDoMes(alvoMes);
    const porDia = totalPorDia(alvoMes);
    const mesCorrente = alvoMes === competenciaAtual();

    const vendasLancadas = lancamentos.reduce((soma, item) => soma + item.valor, 0);
    const ajuste = mesCorrente ? config.ajusteInicial : 0;
    const faturamento = vendasLancadas + ajuste;
    const pecas = lancamentos.reduce((soma, item) => soma + item.pecas, 0);

    const totalDias = diasNoMes(alvoMes);
    const hoje = new Date();
    const diaAtual = mesCorrente ? hoje.getDate() : totalDias;
    const diasRestantes = Math.max(1, totalDias - diaAtual + 1);
    const diasCorridos = Math.max(1, diaAtual);

    const comissao = calcularComissaoDetalhada(faturamento, config);
    const estabelecida = calcularMeta(faturamento, config.metaEstabelecida, config);
    const pessoal = calcularMeta(faturamento, config.metaPessoal, config);

    const ultimos3 = [];
    for (let i = 2; i >= 0; i -= 1) {
      const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i);
      const iso = paraISO(dia);
      ultimos3.push({
        data: iso,
        rotulo: formatarDataCurta(iso),
        diaSemana: nomeDiaSemana(iso),
        valor: numero(porDia[iso])
      });
    }

    const serie = [];
    let acumulado = ajuste;
    for (let dia = 1; dia <= totalDias; dia += 1) {
      const iso = `${alvoMes}-${String(dia).padStart(2, "0")}`;
      const doDia = numero(porDia[iso]);
      acumulado += doDia;
      serie.push({
        dia,
        data: iso,
        valorDia: doDia,
        acumulado,
        futuro: mesCorrente && dia > diaAtual
      });
    }

    const mediaDiaria = faturamento / diasCorridos;
    const projecao = mediaDiaria * totalDias;

    return {
      competencia: alvoMes,
      config,
      lancamentos,
      porDia,
      serie,
      faturamento,
      vendasLancadas,
      ajuste,
      pecas,
      ticketMedio: lancamentos.length > 0 ? vendasLancadas / lancamentos.length : 0,
      totalDias,
      diaAtual,
      diasCorridos,
      diasRestantes,
      mediaDiaria,
      projecao,
      ultimos3,
      totalUltimos3: ultimos3.reduce((soma, item) => soma + item.valor, 0),
      estabelecida,
      pessoal,
      comissao,
      faixaAtual: comissao.faixa,
      proximaFaixa: proximaFaixa(faturamento),
      faltaProximaFaixa: proximaFaixa(faturamento) ? Math.max(0, proximaFaixa(faturamento).valor - faturamento) : 0,
      comissaoAtual: comissao.valorTotal,
      necessarioPorDiaEstabelecida: estabelecida.falta / diasRestantes,
      necessarioPorDiaPessoal: pessoal.falta / diasRestantes
    };
  }

  /* ---------------------------- Calendario ------------------------------ */

  const TIPOS_DIA = {
    trabalho: { rotulo: "Trabalho", cor: "#f97316" },
    folga: { rotulo: "Folga", cor: "#64748b" },
    ferias: { rotulo: "Ferias", cor: "#0ea5e9" },
    evento: { rotulo: "Evento / campanha", cor: "#7c3aed" },
    falta: { rotulo: "Falta / atestado", cor: "#dc2626" }
  };

  function obterAgenda() {
    const dados = lerJSON(chave("agenda"), {});
    return dados && typeof dados === "object" && !Array.isArray(dados) ? dados : {};
  }

  function obterDiaAgenda(iso) {
    return obterAgenda()[iso] || null;
  }

  function salvarDiaAgenda(iso, dados) {
    const agenda = obterAgenda();

    if (!dados || !dados.tipo) {
      delete agenda[iso];
    } else {
      agenda[iso] = {
        tipo: dados.tipo,
        turno: dados.turno || "integral",
        nota: String(dados.nota || "").slice(0, 160)
      };
    }

    gravarJSON(chave("agenda"), agenda);
    return agenda;
  }

  function resumoAgenda(competencia) {
    const alvo = competencia || competenciaAtual();
    const agenda = obterAgenda();
    const contagem = { trabalho: 0, folga: 0, ferias: 0, evento: 0, falta: 0 };

    Object.keys(agenda).forEach((iso) => {
      if (competenciaDe(iso) === alvo && contagem[agenda[iso].tipo] !== undefined) {
        contagem[agenda[iso].tipo] += 1;
      }
    });

    const proximos = Object.keys(agenda)
      .filter((iso) => iso >= hojeISO())
      .sort()
      .slice(0, 5)
      .map((iso) => Object.assign({ data: iso }, agenda[iso]));

    return { contagem, proximos };
  }

  /* ---------------------------- Marketing ------------------------------- */

  function listarCampanhas() {
    const lista = lerJSON(chave("campanhas"), []);
    return Array.isArray(lista) ? lista : [];
  }

  function salvarCampanha(campanha) {
    const lista = listarCampanhas();
    lista.unshift(Object.assign({ id: gerarId(), criadoEm: new Date().toISOString() }, campanha));
    gravarJSON(chave("campanhas"), lista.slice(0, 60));
    return { ok: true, mensagem: "Mensagem salva na biblioteca." };
  }

  function removerCampanha(id) {
    gravarJSON(chave("campanhas"), listarCampanhas().filter((item) => item.id !== id));
    return { ok: true, mensagem: "Mensagem removida." };
  }

  /* ---------------------------- Motivacao ------------------------------- */

  const FRASES = [
    { texto: "Disciplina e escolher entre o que voce quer agora e o que voce quer mais.", autor: "Augusto Cury" },
    { texto: "Grandes resultados exigem grandes ambicoes.", autor: "Heraclito" },
    { texto: "O sucesso e a soma de pequenos esforcos repetidos todos os dias.", autor: "Robert Collier" },
    { texto: "Nao conte os dias, faca os dias contarem.", autor: "Muhammad Ali" },
    { texto: "Vender e ajudar alguem a resolver um problema. Faca isso melhor que ontem.", autor: "Zig Ziglar" },
    { texto: "A meta so parece grande ate voce dividir ela por dia.", autor: "Time comercial" },
    { texto: "Quem quer vencer um obstaculo deve dar o primeiro passo hoje.", autor: "Provérbio" },
    { texto: "Cada atendimento e uma nova chance de bater a meta.", autor: "Time comercial" },
    { texto: "Foco no processo: as vendas sao consequencia.", autor: "Time comercial" },
    { texto: "O melhor vendedor nao e o que fala mais, e o que escuta melhor.", autor: "Brian Tracy" },
    { texto: "Persistencia realiza o impossivel.", autor: "Proverbio chines" },
    { texto: "Voce esta mais perto da meta do que estava ontem. Continue.", autor: "Time comercial" }
  ];

  function fraseDoDia() {
    const hoje = new Date();
    const indice = (hoje.getFullYear() + hoje.getMonth() * 31 + hoje.getDate()) % FRASES.length;
    return FRASES[indice];
  }

  /* ---------------------------- Migracao -------------------------------- */

  /* Vendas e folgas lancadas nas telas antigas (dashboard/vendas da versao 2.x). */
  function migrarVendasAntigas() {
    const bruto = lerJSON(`controleSecao_vendas_db_v1_${loginAtual()}`, null);
    if (!Array.isArray(bruto) || bruto.length === 0) {
      return 0;
    }

    const atuais = listarLancamentos();
    const existentes = new Set(atuais.map((item) => `${item.data}|${item.valor}`));
    let importados = 0;

    bruto.forEach((venda) => {
      const data = String(venda && venda.data ? venda.data : "").slice(0, 10);
      const valor = Math.max(0, numero(venda && venda.valor));

      if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || valor <= 0) {
        return;
      }

      if (existentes.has(`${data}|${valor}`)) {
        return;
      }

      atuais.push({ id: gerarId(), data, valor, pecas: 0, obs: "importado da versao anterior" });
      existentes.add(`${data}|${valor}`);
      importados += 1;
    });

    if (importados > 0) {
      gravarJSON(chave("lancamentos"), atuais);
    }

    return importados;
  }

  function migrarFolgasAntigas() {
    const prefixo = `controleSecao_folgas_v1_${loginAtual()}_`;
    const agenda = obterAgenda();
    let importados = 0;

    Object.keys(localStorage).forEach((chaveStorage) => {
      if (chaveStorage.indexOf(prefixo) !== 0) {
        return;
      }

      const competencia = chaveStorage.slice(prefixo.length);
      const dias = lerJSON(chaveStorage, []);

      if (!/^\d{4}-\d{2}$/.test(competencia) || !Array.isArray(dias)) {
        return;
      }

      dias.forEach((dia) => {
        const iso = `${competencia}-${String(dia).padStart(2, "0")}`;
        if (!agenda[iso]) {
          agenda[iso] = { tipo: "folga", turno: "integral", nota: "" };
          importados += 1;
        }
      });
    });

    if (importados > 0) {
      gravarJSON(chave("agenda"), agenda);
    }

    return importados;
  }

  /* Historico mensal digitado a mao, compartilhado com a versao anterior. */
  function obterHistoricoManual() {
    const dados = lerJSON(`controleSecao_historico_manual_v1_${loginAtual()}`, {});
    return dados && typeof dados === "object" && !Array.isArray(dados) ? dados : {};
  }

  function salvarHistoricoManual(competencia, valor) {
    const historico = obterHistoricoManual();
    const total = Math.max(0, numero(valor));

    if (!/^\d{4}-\d{2}$/.test(String(competencia || ""))) {
      return { ok: false, mensagem: "Informe um mes valido." };
    }

    if (total <= 0) {
      delete historico[competencia];
    } else {
      historico[competencia] = total;
    }

    gravarJSON(`controleSecao_historico_manual_v1_${loginAtual()}`, historico);
    return { ok: true, mensagem: total > 0 ? "Historico salvo." : "Valor manual removido." };
  }

  function historicoMensal() {
    const manual = obterHistoricoManual();
    const porMes = {};

    listarLancamentos().forEach((item) => {
      const competencia = competenciaDe(item.data);
      porMes[competencia] = numero(porMes[competencia]) + item.valor;
    });

    const meses = new Set(Object.keys(porMes).concat(Object.keys(manual)));
    const config = obterConfig();

    return Array.from(meses)
      .sort()
      .reverse()
      .map((competencia) => {
        const lancado = numero(porMes[competencia]);
        const valorManual = numero(manual[competencia]);
        const total = valorManual > 0 ? valorManual : lancado;
        const comissao = calcularComissaoDetalhada(total, config);

        return {
          competencia,
          lancado,
          manual: valorManual,
          total,
          comissao,
          atingiuMeta: config.metaEstabelecida > 0 && total >= config.metaEstabelecida
        };
      });
  }

  function migrarDadosAntigos() {
    migrarVendasAntigas();
    migrarFolgasAntigas();

    const marca = chave("migracao");
    if (localStorage.getItem(marca) === "1") {
      return;
    }

    try {
      const legado = lerJSON(`controleSecao_vendas_form_v1_${loginAtual()}`, null);
      if (legado && typeof legado === "object") {
        const atual = obterConfig();
        const parcial = {};

        if (numero(legado.faturamentoAtual) > 0 && atual.ajusteInicial === 0 && listarLancamentos().length === 0) {
          parcial.ajusteInicial = numero(legado.faturamentoAtual);
        }

        if (numero(legado.valorMedioVenda) > 0 && atual.valorMedioVenda === 0) {
          parcial.valorMedioVenda = numero(legado.valorMedioVenda);
        }

        if (Object.keys(parcial).length > 0) {
          salvarConfig(parcial);
        }
      }
    } catch (erro) {
      /* migracao e opcional */
    }

    localStorage.setItem(marca, "1");
  }

  window.CRM = {
    PADRAO_CONFIG,
    FAIXAS_COMISSAO,
    TIPOS_DIA,
    loginAtual,
    hojeISO,
    paraISO,
    deISO,
    competenciaAtual,
    competenciaDe,
    diasNoMes,
    formatarDataBR,
    formatarDataCurta,
    nomeDiaSemana,
    moeda,
    moedaCurta,
    numeroBR,
    percentual,
    moedaParaNumero,
    obterConfig,
    salvarConfig,
    listarLancamentos,
    listarLancamentosDoMes,
    adicionarLancamento,
    removerLancamento,
    totalPorDia,
    faixaDe,
    proximaFaixa,
    calcularComissaoDetalhada,
    calcularMeta,
    resumo,
    obterAgenda,
    obterDiaAgenda,
    salvarDiaAgenda,
    resumoAgenda,
    listarCampanhas,
    salvarCampanha,
    removerCampanha,
    fraseDoDia,
    obterHistoricoManual,
    salvarHistoricoManual,
    historicoMensal,
    migrarDadosAntigos
  };
})();
