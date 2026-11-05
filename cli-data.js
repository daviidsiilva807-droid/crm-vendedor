/* ==========================================================================
   Modulo CLIENTES - Camada de dados (localStorage por usuario)
   Usa a mesma base de clientes e pedidos do modulo VENDAS (pdv-data.js),
   entao o cadastro feito aqui aparece la e o ranking usa os pedidos reais.
   Depende de app-data.js (CRM) e pdv-data.js (PDV) carregados antes.
   ========================================================================== */

(function () {
  function chaveClientes() {
    return `crm_pdvClientes_v1_${CRM.loginAtual()}`;
  }

  function lerLista(nomeChave) {
    try {
      const bruto = localStorage.getItem(nomeChave);
      const dados = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(dados) ? dados : [];
    } catch (erro) {
      return [];
    }
  }

  function gravarClientes(lista) {
    localStorage.setItem(chaveClientes(), JSON.stringify(lista));
  }

  function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
  }

  function gerarId() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  function limpar(texto, max) {
    return String(texto === null || texto === undefined ? "" : texto).trim().slice(0, max || 200);
  }

  /* ------------------------- Validacoes e links -------------------------- */

  function cpfValido(valor) {
    const d = PDV.somenteDigitos(valor);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) {
      return false;
    }
    for (let t = 9; t < 11; t += 1) {
      let soma = 0;
      for (let i = 0; i < t; i += 1) {
        soma += Number(d[i]) * (t + 1 - i);
      }
      const digito = ((soma * 10) % 11) % 10;
      if (digito !== Number(d[t])) {
        return false;
      }
    }
    return true;
  }

  function emailValido(valor) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor);
  }

  /** Aceita "@usuario", "usuario" ou o link do perfil. Devolve so o usuario. */
  function lerInstagram(entrada) {
    let texto = limpar(entrada, 300);
    if (!texto) {
      return { vazio: true, ok: true, usuario: "" };
    }

    const link = texto.match(/^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([^/?#\s]+)/i);
    if (link) {
      texto = link[1];
    }
    texto = texto.replace(/^@/, "");

    if (/^[A-Za-z0-9._]{1,30}$/.test(texto)) {
      return { vazio: false, ok: true, usuario: texto };
    }
    return { vazio: false, ok: false, usuario: "" };
  }

  function urlInstagram(usuario) {
    const lido = lerInstagram(usuario);
    return lido.ok && lido.usuario ? `https://www.instagram.com/${lido.usuario}/` : "";
  }

  function urlWhatsapp(telefone) {
    let d = PDV.somenteDigitos(telefone);
    if (d.length === 10 || d.length === 11) {
      d = `55${d}`;
    }
    return d.length >= 12 && d.length <= 13 ? `https://wa.me/${d}` : "";
  }

  /** Foto so e aceita se for uma imagem JPEG gerada pelo proprio app. */
  function fotoSegura(foto) {
    const texto = String(foto || "");
    return /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(texto) && texto.length < 200000 ? texto : "";
  }

  /** Recorta o centro, reduz para 160x160 e devolve um data URL JPEG. */
  function fotoDeArquivo(arquivo) {
    return new Promise((resolver, rejeitar) => {
      if (!arquivo || !/^image\//.test(arquivo.type)) {
        rejeitar(new Error("Escolha um arquivo de imagem."));
        return;
      }
      if (arquivo.size > 8 * 1024 * 1024) {
        rejeitar(new Error("A imagem passa de 8 MB."));
        return;
      }

      const leitor = new FileReader();
      leitor.onerror = () => rejeitar(new Error("Nao foi possivel ler a imagem."));
      leitor.onload = () => {
        const imagem = new Image();
        imagem.onerror = () => rejeitar(new Error("Imagem invalida."));
        imagem.onload = () => {
          const lado = Math.min(imagem.width, imagem.height);
          const canvas = document.createElement("canvas");
          canvas.width = 160;
          canvas.height = 160;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(
            imagem,
            (imagem.width - lado) / 2,
            (imagem.height - lado) / 2,
            lado,
            lado,
            0,
            0,
            160,
            160
          );
          resolver(canvas.toDataURL("image/jpeg", 0.82));
        };
        imagem.src = String(leitor.result);
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  /* ------------------------------- Clientes ------------------------------- */

  function competenciaAtual() {
    const agora = new Date();
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  }

  function diasDesde(iso) {
    if (!iso) {
      return null;
    }
    const data = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(data.getTime())) {
      return null;
    }
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((hoje - data) / 86400000));
  }

  /** Clientes com estatisticas de compra. Se competencia for informada, so conta aquele mes. */
  function listar(competencia) {
    const pedidos = lerLista(`crm_pdvPedidos_v1_${CRM.loginAtual()}`);

    const porCliente = {};
    pedidos.forEach((pedido) => {
      if (competencia && String(pedido.data || "").slice(0, 7) !== competencia) {
        return;
      }
      const alvo = porCliente[pedido.clienteId] || {
        valor: 0,
        pedidos: 0,
        valorOnline: 0,
        pedidosOnline: 0,
        ultimaCompra: ""
      };
      const valor = numero(pedido.valor);
      alvo.valor += valor;
      alvo.pedidos += 1;
      if (pedido.canal === "online") {
        alvo.valorOnline += valor;
        alvo.pedidosOnline += 1;
      }
      if (String(pedido.data || "") > alvo.ultimaCompra) {
        alvo.ultimaCompra = String(pedido.data || "");
      }
      porCliente[pedido.clienteId] = alvo;
    });

    return lerLista(chaveClientes())
      .map((cliente) => {
        const stats = porCliente[cliente.id] || {
          valor: 0,
          pedidos: 0,
          valorOnline: 0,
          pedidosOnline: 0,
          ultimaCompra: ""
        };
        return Object.assign({}, cliente, {
          nome: limpar(cliente.nome, 120),
          favorito: cliente.favorito === true,
          stats
        });
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  function buscar(id) {
    return listar().find((cliente) => cliente.id === id) || null;
  }

  function salvar(dados, idEdicao) {
    const modo = dados && dados.modoNome === "completo" ? "completo" : "separado";
    const primeiro = limpar(dados && dados.nome, 80);
    const sobrenome = modo === "separado" ? limpar(dados && dados.sobrenome, 80) : "";
    const nomeFinal = [primeiro, sobrenome].filter(Boolean).join(" ");
    const cpf = PDV.somenteDigitos(dados && dados.cpf);
    const telefone = PDV.somenteDigitos(dados && dados.telefone);
    const whatsapp = PDV.somenteDigitos(dados && dados.whatsapp);
    const email = limpar(dados && dados.email, 120);
    const endereco = limpar(dados && dados.endereco, 200);
    const instagram = lerInstagram(dados && dados.instagram);

    if (!primeiro) {
      return { ok: false, mensagem: modo === "completo" ? "Informe o nome completo." : "Informe o nome." };
    }
    if (modo === "separado" && !sobrenome) {
      return { ok: false, mensagem: "Informe o sobrenome ou escolha a opção Nome completo." };
    }
    if (telefone.length < 10) {
      return { ok: false, mensagem: "Número de contato inválido. Use DDD + número." };
    }
    if (whatsapp && whatsapp.length < 10) {
      return { ok: false, mensagem: "WhatsApp inválido. Use DDD + número ou deixe em branco." };
    }
    if (!cpfValido(cpf)) {
      return { ok: false, mensagem: "CPF inválido. Confira os 11 dígitos." };
    }
    if (email && !emailValido(email)) {
      return { ok: false, mensagem: "E-mail inválido." };
    }
    if (!instagram.ok) {
      return { ok: false, mensagem: "Instagram inválido. Cole o link do perfil ou digite @usuario." };
    }

    const lista = lerLista(chaveClientes());
    const outro = lista.find((item) => item.cpf === cpf && item.id !== idEdicao);
    if (outro) {
      return { ok: false, mensagem: `Já existe um cliente com esse CPF: ${limpar(outro.nome, 80)}.` };
    }

    const indice = idEdicao ? lista.findIndex((item) => item.id === idEdicao) : -1;
    const anterior = indice >= 0 ? lista[indice] : {};

    const cliente = Object.assign({}, anterior, {
      id: anterior.id || gerarId(),
      nome: nomeFinal,
      primeiroNome: primeiro,
      sobrenome,
      modoNome: modo,
      cpf,
      telefone,
      whatsapp,
      email,
      endereco,
      instagram: instagram.usuario,
      foto: fotoSegura(dados && dados.foto),
      favorito: anterior.favorito === true,
      criadoEm: anterior.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    });

    if (indice >= 0) {
      lista[indice] = cliente;
    } else {
      lista.push(cliente);
    }
    gravarClientes(lista);
    return { ok: true, cliente, novo: indice < 0 };
  }

  function remover(id) {
    gravarClientes(lerLista(chaveClientes()).filter((item) => item.id !== id));
    return { ok: true };
  }

  function alternarFavorito(id) {
    const lista = lerLista(chaveClientes());
    const cliente = lista.find((item) => item.id === id);
    if (!cliente) {
      return { ok: false };
    }
    cliente.favorito = cliente.favorito !== true;
    gravarClientes(lista);
    return { ok: true, favorito: cliente.favorito };
  }

  /* -------------------------------- Rankings ------------------------------- */

  /** Ranking por valor comprado. competencia vazia = todo o periodo. */
  function rankingValor(competencia) {
    return listar(competencia || "")
      .filter((cliente) => cliente.stats.valor > 0)
      .sort((a, b) => b.stats.valor - a.stats.valor || b.stats.pedidos - a.stats.pedidos);
  }

  /** Quem mais compra online (quantidade de pedidos online, desempate por valor). */
  function rankingOnline(competencia) {
    return listar(competencia || "")
      .filter((cliente) => cliente.stats.pedidosOnline > 0)
      .sort(
        (a, b) =>
          b.stats.pedidosOnline - a.stats.pedidosOnline || b.stats.valorOnline - a.stats.valorOnline
      );
  }

  window.CLI = {
    competenciaAtual,
    diasDesde,
    cpfValido,
    lerInstagram,
    urlInstagram,
    urlWhatsapp,
    fotoSegura,
    fotoDeArquivo,
    listar,
    buscar,
    salvar,
    remover,
    alternarFavorito,
    rankingValor,
    rankingOnline
  };
})();
