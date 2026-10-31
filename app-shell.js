/* ==========================================================================
   CRM Vendedor - Shell da aplicacao (menu lateral + topo)
   Basta incluir app-shell.css + app-shell.js em qualquer pagina interna.
   ========================================================================== */

(function () {
  const ADMIN_LOGIN = "daviidsiilva807";

  const ITENS = [
    { grupo: "Principal" },
    { href: "dashboard.html", icone: "&#128202;", texto: "Dashboard", titulo: "Dashboard" },
    { href: "calendario.html", icone: "&#128197;", texto: "Calendario de trabalho", titulo: "Calendario de trabalho" },
    { href: "agent.html", icone: "&#129302;", texto: "Agente de marketing (IA)", titulo: "Agente de marketing com IA" },
    { href: "marketing.html", icone: "&#128226;", texto: "Mensagens prontas", titulo: "Mensagens prontas de marketing" },
    { href: "vendas.html", icone: "&#128176;", texto: "Vendas", titulo: "Vendas e metas" },
    { grupo: "Operacao" },
    { href: "secao.html", icone: "&#128230;", texto: "Secao", titulo: "Secao" },
    { href: "vestuario.html", icone: "&#128085;", texto: "Vestuario", titulo: "Secao - Vestuario", sub: true },
    { href: "tenis.html", icone: "&#128095;", texto: "Tenis", titulo: "Secao - Tenis", sub: true },
    { href: "acessorios.html", icone: "&#128717;", texto: "Acessorios", titulo: "Secao - Acessorios", sub: true },
    { href: "clientes.html", icone: "&#128101;", texto: "Clientes", titulo: "Clientes e reservas" },
    { grupo: "Gestao", somenteAdmin: true },
    { href: "admin.html", icone: "&#128274;", texto: "Painel do administrador", titulo: "Painel do administrador", somenteAdmin: true }
  ];

  function paginaAtual() {
    const caminho = window.location.pathname.split("/").pop();
    return caminho || "dashboard.html";
  }

  function lerSessaoLocal() {
    try {
      const bruto = localStorage.getItem("controleSecao_sessao_v1");
      return bruto ? JSON.parse(bruto) : null;
    } catch (erro) {
      return null;
    }
  }

  function ehAdmin(sessao) {
    return Boolean(
      sessao &&
      sessao.papel === "admin" &&
      String(sessao.login || "").toLowerCase() === ADMIN_LOGIN
    );
  }

  function dataExtenso() {
    return new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  }

  function construir() {
    if (document.querySelector(".app-shell")) {
      return;
    }

    const sessao = lerSessaoLocal();
    const atual = paginaAtual();
    const admin = ehAdmin(sessao);

    const shell = document.createElement("div");
    shell.className = "app-shell";

    /* ------------------------------ Menu -------------------------------- */
    const aside = document.createElement("aside");
    aside.className = "app-sidebar";
    aside.id = "appSidebar";

    const marca = document.createElement("div");
    marca.className = "app-brand";
    marca.innerHTML = `
      <div class="app-brand-logo">CV</div>
      <div class="app-brand-txt">
        <strong>Controle de Secao</strong>
        <span>CRM do vendedor</span>
      </div>
    `;

    const nav = document.createElement("nav");
    nav.className = "app-nav";

    let tituloPagina = "Painel";

    ITENS.forEach((item) => {
      if (item.somenteAdmin && !admin) {
        return;
      }

      if (item.grupo) {
        const titulo = document.createElement("div");
        titulo.className = "app-nav-titulo";
        titulo.textContent = item.grupo;
        nav.appendChild(titulo);
        return;
      }

      const link = document.createElement("a");
      link.href = item.href;
      link.className = item.sub ? "sub" : "";
      link.innerHTML = `<span class="ico">${item.icone}</span><span>${item.texto}</span>`;

      if (item.href === atual) {
        link.classList.add("ativo");
        tituloPagina = item.titulo;
      }

      nav.appendChild(link);
    });

    const boxUsuario = document.createElement("div");
    boxUsuario.className = "app-usuario";
    boxUsuario.innerHTML = `
      <div class="app-usuario-nome">${sessao && sessao.login ? sessao.login : "Visitante"}</div>
      <div class="app-usuario-papel">${admin ? "Administrador" : "Vendedor"}</div>
      <a class="app-sair" style="display:block;text-align:center;text-decoration:none;box-sizing:border-box" href="escolha.html">Trocar de app</a>
      <button class="app-sair" type="button" id="appBtnSair">Sair da conta</button>
    `;

    aside.appendChild(marca);
    aside.appendChild(nav);
    aside.appendChild(boxUsuario);

    /* ------------------------------ Corpo ------------------------------- */
    const corpo = document.createElement("div");
    corpo.className = "app-body";

    const topo = document.createElement("header");
    topo.className = "app-topbar";
    topo.innerHTML = `
      <button class="app-menu-btn" type="button" id="appBtnMenu" aria-label="Abrir menu">&#9776;</button>
      <h2>${tituloPagina}</h2>
      <div class="data-hoje">${dataExtenso()}</div>
    `;

    const conteudo = document.createElement("main");
    conteudo.className = "app-content";
    conteudo.id = "appContent";

    const filhos = Array.prototype.slice.call(document.body.childNodes);
    filhos.forEach((no) => {
      if (no.nodeType === 1 && (no.tagName === "SCRIPT" || no.tagName === "TEMPLATE")) {
        return;
      }
      if (no.nodeType === 8) {
        return;
      }
      conteudo.appendChild(no);
    });

    corpo.appendChild(topo);
    corpo.appendChild(conteudo);

    const overlay = document.createElement("div");
    overlay.className = "app-overlay";
    overlay.id = "appOverlay";

    shell.appendChild(aside);
    shell.appendChild(corpo);

    document.body.insertBefore(shell, document.body.firstChild);
    document.body.appendChild(overlay);

    /* ---------------------------- Interacao ----------------------------- */
    function alternarMenu(forcar) {
      const abrir = forcar === undefined ? !aside.classList.contains("aberto") : forcar;
      aside.classList.toggle("aberto", abrir);
      overlay.classList.toggle("aberto", abrir);
    }

    document.getElementById("appBtnMenu").addEventListener("click", () => alternarMenu());
    overlay.addEventListener("click", () => alternarMenu(false));
    nav.addEventListener("click", (evento) => {
      if (evento.target.closest("a")) {
        alternarMenu(false);
      }
    });

    document.getElementById("appBtnSair").addEventListener("click", () => {
      if (window.AuthDB && typeof window.AuthDB.sair === "function") {
        window.AuthDB.sair();
      }
      window.location.href = "index.html";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", construir);
  } else {
    construir();
  }

  window.AppShell = { construir };
})();
