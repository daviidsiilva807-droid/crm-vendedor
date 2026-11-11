/* ==========================================================================
   Atualizar o app
   - Botao "Atualizar app" no menu lateral: apaga o cache, remove o service
     worker antigo e recarrega a pagina com a versao mais nova do site.
   - Aviso automatico "Nova versao disponivel" quando uma atualizacao chega.
   - Confere se ha versao nova toda vez que o app volta para a tela.
   ========================================================================== */

(function () {
  const TEXTO_BOTAO = "Atualizar app";
  let atualizando = false;

  async function limparEAtualizar() {
    if (atualizando) {
      return;
    }
    atualizando = true;

    try {
      if ("serviceWorker" in navigator) {
        const registros = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registros.map((r) => r.unregister().catch(() => false)));
      }
      if ("caches" in window) {
        const nomes = await caches.keys();
        await Promise.all(nomes.map((n) => caches.delete(n)));
      }
    } catch (erro) {
      /* mesmo com falha, recarregar ja ajuda */
    }

    window.location.reload();
  }

  /* ------------------------------ Botao ---------------------------------- */

  function criarBotao() {
    const caixa = document.querySelector(".app-usuario");
    if (!caixa || caixa.querySelector("[data-atualizar-app]")) {
      return;
    }

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "app-sair";
    botao.dataset.atualizarApp = "1";
    botao.textContent = "↻ " + TEXTO_BOTAO;
    botao.title = "Baixa a versão mais nova do app e recarrega a página";
    botao.addEventListener("click", () => {
      botao.disabled = true;
      botao.textContent = "Atualizando...";
      limparEAtualizar();
    });

    /* Fica antes de "Trocar de app" / "Sair da conta". */
    const primeiroAcao = caixa.querySelector(".app-sair");
    if (primeiroAcao) {
      caixa.insertBefore(botao, primeiroAcao);
    } else {
      caixa.appendChild(botao);
    }
  }

  /* --------------------------- Aviso de versao --------------------------- */

  function injetarEstilo() {
    if (document.getElementById("atualizar-estilo")) {
      return;
    }
    const estilo = document.createElement("style");
    estilo.id = "atualizar-estilo";
    estilo.textContent =
      ".atualizar-aviso{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99998;display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 24px);padding:12px 16px;border-radius:14px;background:#17202a;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.35);font-size:14px;font-weight:600}" +
      ".atualizar-aviso button{min-height:38px;padding:6px 14px;border-radius:10px;border:0;font:inherit;font-weight:800;cursor:pointer}" +
      ".atualizar-aviso .ok{background:#f97316;color:#fff}" +
      ".atualizar-aviso .depois{background:transparent;color:#cbd5e1;border:1px solid #475569}";
    document.head.appendChild(estilo);
  }

  function mostrarAviso() {
    if (document.querySelector(".atualizar-aviso")) {
      return;
    }
    injetarEstilo();

    const aviso = document.createElement("div");
    aviso.className = "atualizar-aviso";
    aviso.setAttribute("role", "status");

    const texto = document.createElement("span");
    texto.textContent = "Nova versão do app disponível.";

    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "ok";
    ok.textContent = "Atualizar agora";
    ok.addEventListener("click", () => {
      ok.disabled = true;
      ok.textContent = "Atualizando...";
      limparEAtualizar();
    });

    const depois = document.createElement("button");
    depois.type = "button";
    depois.className = "depois";
    depois.textContent = "Depois";
    depois.addEventListener("click", () => aviso.remove());

    aviso.appendChild(texto);
    aviso.appendChild(ok);
    aviso.appendChild(depois);
    document.body.appendChild(aviso);
  }

  function observarVersaoNova() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    /* So avisa se ja havia um service worker antes: a primeira instalacao nao conta. */
    const jaTinhaControle = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (jaTinhaControle && !atualizando) {
        mostrarAviso();
      }
    });

    function conferir() {
      navigator.serviceWorker.getRegistrations().then((registros) => {
        registros.forEach((r) => r.update().catch(() => {}));
      }).catch(() => {});
    }

    conferir();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        conferir();
      }
    });
  }

  /* ------------------------------- Inicio -------------------------------- */

  function iniciar() {
    /* O menu lateral e montado pelo shell no mesmo carregamento: espera um instante. */
    criarBotao();
    setTimeout(criarBotao, 0);
    observarVersaoNova();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }

  window.AtualizarApp = { atualizar: limparEAtualizar };
})();
