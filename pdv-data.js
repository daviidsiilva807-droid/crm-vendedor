/* ==========================================================================
   Modulo VENDAS - Camada de dados (localStorage por usuario)
   Clientes, pedidos (produto + pagamento + status) e metricas do dia.
   Depende de app-data.js (CRM) ja estar carregado antes deste script.
   ========================================================================== */

(function () {
  function chave(base) {
    return `crm_pdv${base}_v1_${CRM.loginAtual()}`;
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

  function somenteDigitos(valor) {
    return String(valor === null || valor === undefined ? "" : valor).replace(/\D/g, "");
  }

  /* ------------------------------ Mascaras ------------------------------- */

  function mascararCPF(valor) {
    const d = somenteDigitos(valor).slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  function mascararTelefone(valor) {
    const d = somenteDigitos(valor).slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  /* ------------------------------ Dicionarios ----------------------------- */

  const CATEGORIAS = {
    tenis: "Tênis",
    vestuario: "Vestuário",
    acessorio: "Acessório"
  };

  const FORMAS_PAGAMENTO = {
    cartao: "Cartão",
    pix: "Pix",
    link: "Link de pagamento"
  };

  const STATUS_PEDIDO = {
    finalizado: { rotulo: "Finalizado" },
    entrega: { rotulo: "Para entrega" },
    reserva: { rotulo: "Para reserva" },
    retirada: { rotulo: "Para retirada" }
  };

  /* ------------------------------- Clientes ------------------------------- */

  function listarClientes() {
    const lista = lerJSON(chave("Clientes"), []);
    if (!Array.isArray(lista)) {
      return [];
    }
    return lista.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  }

  function buscarClientePorCpf(cpf) {
    const digitos = somenteDigitos(cpf);
    if (!digitos) {
      return null;
    }
    return listarClientes().find((cliente) => cliente.cpf === digitos) || null;
  }

  function salvarCliente(dados) {
    const nome = String((dados && dados.nome) || "").trim();
    const cpf = somenteDigitos(dados && dados.cpf);
    const telefone = somenteDigitos(dados && dados.telefone);

    if (!nome) {
      return { ok: false, mensagem: "Informe o nome do cliente." };
    }
    if (cpf.length !== 11) {
      return { ok: false, mensagem: "CPF invalido. Informe os 11 digitos." };
    }
    if (telefone.length < 10) {
      return { ok: false, mensagem: "Telefone invalido." };
    }

    const lista = lerJSON(chave("Clientes"), []);
    const listaAtual = Array.isArray(lista) ? lista : [];
    const existenteIndex = listaAtual.findIndex((item) => item.cpf === cpf);

    const cliente = {
      id: existenteIndex >= 0 ? listaAtual[existenteIndex].id : gerarId(),
      nome,
      cpf,
      telefone,
      email: String((dados && dados.email) || "").trim(),
      instagram: String((dados && dados.instagram) || "").trim(),
      criadoEm: existenteIndex >= 0 ? listaAtual[existenteIndex].criadoEm : new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };

    if (existenteIndex >= 0) {
      listaAtual[existenteIndex] = cliente;
    } else {
      listaAtual.push(cliente);
    }

    gravarJSON(chave("Clientes"), listaAtual);
    return { ok: true, cliente };
  }

  /* -------------------------------- Pedidos -------------------------------- */

  function listarPedidos(filtro) {
    const opcoes = filtro || {};
    const lista = lerJSON(chave("Pedidos"), []);
    let resultado = Array.isArray(lista) ? lista.slice() : [];

    if (opcoes.data) {
      resultado = resultado.filter((pedido) => pedido.data === opcoes.data);
    }
    if (opcoes.status) {
      resultado = resultado.filter((pedido) => pedido.status === opcoes.status);
    }

    return resultado.sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : a.criadoEm > b.criadoEm ? -1 : 0));
  }

  function salvarPedido(dados) {
    const clienteId = String((dados && dados.clienteId) || "");
    const categoria = String((dados && dados.categoria) || "");
    const produto = String((dados && dados.produto) || "").trim();
    const valor = Math.max(0, numero(dados && dados.valor));
    const canal = (dados && dados.canal) === "online" ? "online" : "presencial";
    const formaPagamento = String((dados && dados.pagamento && dados.pagamento.forma) || "");
    const status = String((dados && dados.status) || "");

    if (!clienteId) {
      return { ok: false, mensagem: "Cadastre o cliente antes de registrar o pedido." };
    }
    if (!CATEGORIAS[categoria]) {
      return { ok: false, mensagem: "Selecione a categoria do produto." };
    }
    if (!produto) {
      return { ok: false, mensagem: "Descreva o produto desejado." };
    }
    if (valor <= 0) {
      return { ok: false, mensagem: "Informe um valor maior que zero." };
    }
    if (!FORMAS_PAGAMENTO[formaPagamento]) {
      return { ok: false, mensagem: "Selecione a forma de pagamento." };
    }
    if (!STATUS_PEDIDO[status]) {
      return { ok: false, mensagem: "Selecione o status do pedido." };
    }
    if (canal === "online" && !String((dados && dados.endereco) || "").trim()) {
      return { ok: false, mensagem: "Informe o endereco de entrega para venda online." };
    }

    const agora = new Date();
    const lista = lerJSON(chave("Pedidos"), []);
    const listaAtual = Array.isArray(lista) ? lista : [];

    const pedido = {
      id: gerarId(),
      clienteId,
      clienteNome: String((dados && dados.clienteNome) || ""),
      clienteTelefone: somenteDigitos(dados && dados.clienteTelefone),
      canal,
      categoria,
      produto,
      valor,
      pagamento: {
        forma: formaPagamento,
        parcelas: formaPagamento === "cartao" ? Math.max(1, Math.round(numero(dados.pagamento.parcelas)) || 1) : null
      },
      status,
      endereco: canal === "online" ? String((dados && dados.endereco) || "").trim() : "",
      data: CRM.hojeISO(),
      hora: `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`,
      criadoEm: agora.toISOString()
    };

    listaAtual.push(pedido);
    gravarJSON(chave("Pedidos"), listaAtual);
    return { ok: true, pedido };
  }

  function atualizarStatus(id, novoStatus) {
    if (!STATUS_PEDIDO[novoStatus]) {
      return { ok: false, mensagem: "Status invalido." };
    }

    const lista = lerJSON(chave("Pedidos"), []);
    const listaAtual = Array.isArray(lista) ? lista : [];
    const pedido = listaAtual.find((item) => item.id === id);

    if (!pedido) {
      return { ok: false, mensagem: "Pedido nao encontrado." };
    }

    pedido.status = novoStatus;
    gravarJSON(chave("Pedidos"), listaAtual);
    return { ok: true, pedido };
  }

  function removerPedido(id) {
    const lista = lerJSON(chave("Pedidos"), []);
    const listaAtual = Array.isArray(lista) ? lista : [];
    gravarJSON(chave("Pedidos"), listaAtual.filter((item) => item.id !== id));
    return { ok: true, mensagem: "Pedido removido." };
  }

  /* -------------------------- Cadastro combinado --------------------------- */

  function registrarPedido(clienteDados, pedidoDados) {
    const resultadoCliente = salvarCliente(clienteDados);
    if (!resultadoCliente.ok) {
      return resultadoCliente;
    }

    const resultadoPedido = salvarPedido(
      Object.assign({}, pedidoDados, {
        clienteId: resultadoCliente.cliente.id,
        clienteNome: resultadoCliente.cliente.nome,
        clienteTelefone: resultadoCliente.cliente.telefone
      })
    );

    if (!resultadoPedido.ok) {
      return resultadoPedido;
    }

    return { ok: true, mensagem: "Pedido registrado.", cliente: resultadoCliente.cliente, pedido: resultadoPedido.pedido };
  }

  /* --------------------------------- Metricas ------------------------------- */

  function metricasDoDia(dataISO) {
    const data = dataISO || CRM.hojeISO();
    const pedidosDoDia = listarPedidos({ data });

    const porCanal = { online: { quantidade: 0, valor: 0 }, presencial: { quantidade: 0, valor: 0 } };
    const porHora = {};

    pedidosDoDia.forEach((pedido) => {
      porCanal[pedido.canal].quantidade += 1;
      porCanal[pedido.canal].valor += pedido.valor;

      const hora = pedido.hora.slice(0, 2);
      porHora[hora] = numero(porHora[hora]) + pedido.valor;
    });

    const faturamento = porCanal.online.valor + porCanal.presencial.valor;
    const quantidade = pedidosDoDia.length;

    return {
      quantidade,
      faturamento,
      ticketMedio: quantidade > 0 ? faturamento / quantidade : 0,
      porCanal,
      porHora
    };
  }

  window.PDV = {
    CATEGORIAS,
    FORMAS_PAGAMENTO,
    STATUS_PEDIDO,
    mascararCPF,
    mascararTelefone,
    somenteDigitos,
    listarClientes,
    buscarClientePorCpf,
    salvarCliente,
    listarPedidos,
    salvarPedido,
    atualizarStatus,
    removerPedido,
    registrarPedido,
    metricasDoDia
  };
})();
