/* ==========================================================================
   Lembretes diarios do vendedor
   - 09:00  popup + notificacao: boas vendas e frase de motivacao
   - 17:00  popup + notificacao: lembrar de lancar as vendas do dia
   Cada lembrete aparece uma vez por dia. Funciona enquanto o app estiver
   aberto (ou em segundo plano, no celular). Com o app totalmente fechado
   seria preciso Web Push pelo servidor.
   ========================================================================== */

(function () {
  const CHAVE_SESSAO = "controleSecao_sessao_v1";
  const CHAVE_ULTIMO = "controleSecao_lembretes_v1";
  const VERIFICAR_A_CADA_MS = 30 * 1000;

  // "janela" = ate que horas o lembrete ainda faz sentido ser mostrado
  // (quem abre o app as 15h nao precisa de um "bom dia").
  const LEMBRETES = [
    {
      id: "manha",
      hora: 9,
      janelaAte: 12,
      titulo: "Bom dia, boas vendas! ☀️",
      destino: "dashboard.html",
      botao: "Ver o dashboard",
      corpo: function (nome, frase) {
        return (nome ? nome + ", " : "") + frase;
      }
    },
    {
      id: "tarde",
      hora: 17,
      janelaAte: 22,
      titulo: "Hora de lançar as vendas do dia 🧾",
      destino: "pdv-novo-pedido.html",
      botao: "Lançar vendas",
      corpo: function (nome) {
        return (nome ? nome + ", " : "") + "o expediente está acabando. Lance as vendas de hoje para não perder nenhuma.";
      }
    }
  ];

  const FRASES = [
    "Cada cliente atendido hoje é uma venda que pode acontecer. Vamos com tudo!",
    "Sucesso em vendas é a soma de pequenos esforços repetidos todos os dias.",
    "Um sorriso e uma boa conversa vendem mais do que qualquer promoção.",
    "Hoje é um ótimo dia para bater a meta. Comece pelo primeiro cliente!",
    "Quem atende com atenção, fideliza. Capriche em cada cliente.",
    "Não espere a oportunidade chegar: vá até ela e ofereça o melhor.",
    "Um 'não' hoje é só um 'ainda não'. Continue tentando!",
    "Foco, energia e simpatia: a receita de um dia de muitas vendas.",
    "Metas grandes são alcançadas um atendimento de cada vez.",
    "Você faz a diferença na experiência de cada cliente. Boas vendas!",
    "Quem se prepara vende melhor. Confira o estoque e arrase hoje!",
    "Persistência vence talento quando o talento não persiste. Bora vender!"
  ];

  function hoje() {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mes + "-" + dia;
  }

  function lerSessao() {
    try {
      const bruto = localStorage.getItem(CHAVE_SESSAO);
      return bruto ? JSON.parse(bruto) : null;
    } catch (erro) {
      return null;
    }
  }

  function lerRegistro() {
    try {
      const bruto = localStorage.getItem(CHAVE_ULTIMO);
      const dados = bruto ? JSON.parse(bruto) : {};
      return dados && typeof dados === "object" ? dados : {};
    } catch (erro) {
      return {};
    }
  }

  function marcarComoMostrado(id) {
    try {
      const dados = lerRegistro();
      dados[id] = hoje();
      localStorage.setItem(CHAVE_ULTIMO, JSON.stringify(dados));
    } catch (erro) {
      /* sem storage: pode repetir, mas nao quebra */
    }
  }

  function fraseDoDia() {
    const inicio = new Date(new Date().getFullYear(), 0, 0);
    const dia = Math.floor((new Date() - inicio) / 86400000);
    return FRASES[dia % FRASES.length];
  }

  function nomeDoUsuario(sessao) {
    const login = sessao && sessao.login ? String(sessao.login) : "";
    return login.length > 24 ? login.slice(0, 24) : login;
  }

  function devido(lembrete, registro) {
    const agora = new Date();
    const minutos = agora.getHours() * 60 + agora.getMinutes();
    const dentroDaJanela =
      minutos >= lembrete.hora * 60 && minutos < lembrete.janelaAte * 60;
    return dentroDaJanela && registro[lembrete.id] !== hoje();
  }

  /* ------------------------------ Notificacao ---------------------------- */

  async function mostrarNotificacao(lembrete, corpo) {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    const opcoes = {
      body: corpo,
      icon: "img/icon-192.png",
      badge: "img/icon-192.png",
      tag: "lembrete-" + lembrete.id + "-" + hoje(),
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: { tipo: "lembrete", destino: lembrete.destino }
    };

    try {
      // No celular (Android/iOS) so funciona via service worker.
      if ("serviceWorker" in navigator) {
        const registro = await navigator.serviceWorker.ready;
        await registro.showNotification(lembrete.titulo, opcoes);
        return;
      }
      new Notification(lembrete.titulo, opcoes);
    } catch (erro) {
      console.error("Erro ao exibir notificação:", erro);
    }
  }

  function pedirPermissao() {
    if (!("Notification" in window) || Notification.permission !== "default") {
      return Promise.resolve(false);
    }
    return Notification.requestPermission().then(function (p) {
      return p === "granted";
    });
  }

  /* -------------------------------- Popup -------------------------------- */

  function injetarEstilo() {
    if (document.getElementById("lembrete-estilo")) {
      return;
    }
    const estilo = document.createElement("style");
    estilo.id = "lembrete-estilo";
    estilo.textContent =
      ".lembrete-fundo{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:16px;background:rgba(23,32,42,.55);animation:lembrete-fade .2s ease}" +
      ".lembrete-caixa{width:min(100%,400px);background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.35);font-family:inherit;animation:lembrete-sobe .25s ease}" +
      ".lembrete-topo{padding:22px 22px 18px;color:#fff;background:linear-gradient(120deg,#f97316,#ea580c)}" +
      ".lembrete-topo h2{margin:0;font-size:1.3rem;font-weight:800;line-height:1.25}" +
      ".lembrete-corpo{padding:18px 22px 6px;color:#17202a;font-size:1rem;line-height:1.5}" +
      ".lembrete-aviso{margin:10px 22px 0;padding:10px 12px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;color:#c2410c;font-size:.85rem}" +
      ".lembrete-acoes{display:flex;gap:10px;flex-wrap:wrap;padding:18px 22px 22px}" +
      ".lembrete-acoes button{flex:1 1 140px;min-height:44px;border-radius:10px;font:inherit;font-weight:700;cursor:pointer;border:1px solid #f97316}" +
      ".lembrete-ok{background:#f97316;color:#fff}" +
      ".lembrete-fechar{background:#fff;color:#c2410c}" +
      "@keyframes lembrete-fade{from{opacity:0}to{opacity:1}}" +
      "@keyframes lembrete-sobe{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}";
    document.head.appendChild(estilo);
  }

  function mostrarPopup(lembrete, corpo) {
    injetarEstilo();

    const fundo = document.createElement("div");
    fundo.className = "lembrete-fundo";
    fundo.setAttribute("role", "dialog");
    fundo.setAttribute("aria-modal", "true");
    fundo.setAttribute("aria-labelledby", "lembrete-titulo");

    const caixa = document.createElement("div");
    caixa.className = "lembrete-caixa";

    const topo = document.createElement("div");
    topo.className = "lembrete-topo";
    const titulo = document.createElement("h2");
    titulo.id = "lembrete-titulo";
    titulo.textContent = lembrete.titulo;
    topo.appendChild(titulo);

    const texto = document.createElement("div");
    texto.className = "lembrete-corpo";
    texto.textContent = corpo;

    caixa.appendChild(topo);
    caixa.appendChild(texto);

    // Em alguns celulares (iOS) a permissao so pode ser pedida por um toque.
    if ("Notification" in window && Notification.permission === "default") {
      const aviso = document.createElement("div");
      aviso.className = "lembrete-aviso";
      aviso.textContent = "Toque em “Ativar avisos” para receber esses lembretes como notificação no celular.";
      caixa.appendChild(aviso);
    }

    const acoes = document.createElement("div");
    acoes.className = "lembrete-acoes";

    function fechar() {
      document.removeEventListener("keydown", aoTeclar);
      fundo.remove();
    }

    function aoTeclar(evento) {
      if (evento.key === "Escape") {
        fechar();
      }
    }

    const btnFechar = document.createElement("button");
    btnFechar.type = "button";
    btnFechar.className = "lembrete-fechar";
    btnFechar.textContent = "Fechar";
    btnFechar.addEventListener("click", fechar);

    const btnOk = document.createElement("button");
    btnOk.type = "button";
    btnOk.className = "lembrete-ok";
    btnOk.textContent = lembrete.botao;
    btnOk.addEventListener("click", function () {
      fechar();
      if (window.location.pathname.split("/").pop() !== lembrete.destino) {
        window.location.href = lembrete.destino;
      }
    });

    if ("Notification" in window && Notification.permission === "default") {
      const btnAtivar = document.createElement("button");
      btnAtivar.type = "button";
      btnAtivar.className = "lembrete-ok";
      btnAtivar.textContent = "Ativar avisos";
      btnAtivar.addEventListener("click", function () {
        pedirPermissao().then(function (ok) {
          if (ok) {
            mostrarNotificacao(lembrete, corpo);
          }
          btnAtivar.remove();
          const aviso = caixa.querySelector(".lembrete-aviso");
          if (aviso) {
            aviso.remove();
          }
        });
      });
      acoes.appendChild(btnAtivar);
    }

    acoes.appendChild(btnOk);
    acoes.appendChild(btnFechar);
    caixa.appendChild(acoes);
    fundo.appendChild(caixa);

    fundo.addEventListener("click", function (evento) {
      if (evento.target === fundo) {
        fechar();
      }
    });
    document.addEventListener("keydown", aoTeclar);
    document.body.appendChild(fundo);
    btnOk.focus();
  }

  /* ------------------------------- Principal ----------------------------- */

  function verificar() {
    const sessao = lerSessao();
    if (!sessao || !sessao.login) {
      return; // so avisa quem esta logado
    }
    if (document.querySelector(".lembrete-fundo")) {
      return;
    }

    const registro = lerRegistro();
    const lembrete = LEMBRETES.find(function (l) {
      return devido(l, registro);
    });
    if (!lembrete) {
      return;
    }

    const corpo = lembrete.corpo(nomeDoUsuario(sessao), fraseDoDia());
    marcarComoMostrado(lembrete.id);
    mostrarPopup(lembrete, corpo);
    mostrarNotificacao(lembrete, corpo);
  }

  function iniciar() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw-notifications.js").catch(function () {});
    }
    verificar();
    setInterval(verificar, VERIFICAR_A_CADA_MS);
    // Ao voltar para o app (celular destravado / aba reaberta) confere na hora.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        verificar();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
