(function () {
  const DB_KEY = "controleSecao_usuarios_v1";
  const SESSION_KEY = "controleSecao_sessao_v1";
  const MIGRATION_DONE_KEY = "controleSecao_migracao_api_v1";

  const API_BASE = window.location.protocol === "file:"
    ? "http://localhost:3000/api"
    : `${window.location.origin}/api`;

  function normalizarLogin(login) {
    return (login || "").trim().toLowerCase();
  }

  function montarUrl(path, query) {
    const url = new URL(`${API_BASE}${path}`);
    if (query && typeof query === "object") {
      Object.keys(query).forEach((chave) => {
        const valor = query[chave];
        if (valor !== undefined && valor !== null && String(valor) !== "") {
          url.searchParams.set(chave, String(valor));
        }
      });
    }
    return url.toString();
  }

  function apiRequestSync(method, path, body, query) {
    const xhr = new XMLHttpRequest();
    try {
      xhr.open(method, montarUrl(path, query), false);
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      xhr.send(body ? JSON.stringify(body) : null);
    } catch (erro) {
      return { ok: false, status: 0, error: { message: "Servidor indisponivel." } };
    }

    let data = null;
    try {
      data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
    } catch (erro) {
      data = null;
    }

    return {
      ok: xhr.status >= 200 && xhr.status < 300,
      status: xhr.status,
      data,
      error: data || { message: "Falha na comunicacao com o servidor." }
    };
  }

  function mensagemResposta(resposta, fallback) {
    return resposta?.data?.mensagem || resposta?.error?.mensagem || resposta?.error?.message || fallback;
  }

  function salvarSessao(sessao) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessao));
  }

  function lerSessaoLocal() {
    const bruto = localStorage.getItem(SESSION_KEY);
    if (!bruto) {
      return null;
    }

    try {
      const sessao = JSON.parse(bruto);
      if (!sessao || typeof sessao !== "object") {
        return null;
      }
      return sessao;
    } catch (erro) {
      return null;
    }
  }

  function obterTokenSessao() {
    const sessao = lerSessaoLocal();
    return sessao?.token || "";
  }

  function importarUsuariosLegadosUmaVez() {
    if (localStorage.getItem(MIGRATION_DONE_KEY) === "1") {
      return;
    }

    const bruto = localStorage.getItem(DB_KEY);
    if (!bruto) {
      localStorage.setItem(MIGRATION_DONE_KEY, "1");
      return;
    }

    try {
      const usuarios = JSON.parse(bruto);
      if (!Array.isArray(usuarios) || usuarios.length === 0) {
        localStorage.setItem(MIGRATION_DONE_KEY, "1");
        return;
      }

      apiRequestSync("POST", "/import", { usuarios });
      localStorage.setItem(MIGRATION_DONE_KEY, "1");
    } catch (erro) {
      // Mantem sem migrar para tentar novamente em uma proxima inicializacao.
    }
  }

  function garantirAdminPadrao() {
    const resposta = apiRequestSync("GET", "/bootstrap");
    if (resposta.ok) {
      importarUsuariosLegadosUmaVez();
    }
    return { ok: resposta.ok, mensagem: mensagemResposta(resposta, "Falha ao inicializar base de usuarios.") };
  }

  function autenticar(login, senha) {
    garantirAdminPadrao();

    const resposta = apiRequestSync("POST", "/login", {
      login: normalizarLogin(login),
      senha: String(senha || "")
    });

    if (!resposta.ok || !resposta.data?.ok || !resposta.data?.usuario) {
      return { ok: false, mensagem: mensagemResposta(resposta, "Login ou senha invalidos.") };
    }

    salvarSessao(resposta.data.usuario);
    return { ok: true, usuario: resposta.data.usuario };
  }

  function obterSessao() {
    const token = obterTokenSessao();
    if (!token) {
      return null;
    }

    const resposta = apiRequestSync("GET", "/session", null, { token });
    if (!resposta.ok || !resposta.data?.ok || !resposta.data?.usuario) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    salvarSessao(resposta.data.usuario);
    return resposta.data.usuario;
  }

  function sair() {
    const token = obterTokenSessao();
    if (token) {
      apiRequestSync("POST", "/logout", { token });
    }
    localStorage.removeItem(SESSION_KEY);
  }

  function exigirLogin() {
    const sessao = obterSessao();
    if (!sessao) {
      window.location.href = "index.html";
      return null;
    }

    const status = obterStatusUsuario(sessao.login);
    if (status && !status.ativo) {
      sair();
      window.location.href = "index.html";
      return null;
    }

    return sessao;
  }

  function obterUsuario(login) {
    const resposta = apiRequestSync("GET", "/users/by-login", null, { login: normalizarLogin(login) });
    if (!resposta.ok || !resposta.data?.ok) {
      return null;
    }
    return resposta.data.usuario || null;
  }

  function obterStatusUsuario(login) {
    const resposta = apiRequestSync("GET", "/users/status", null, { login: normalizarLogin(login) });
    if (!resposta.ok || !resposta.data?.ok) {
      return null;
    }
    return resposta.data.status || null;
  }

  function criarUsuarioVendedor(login, senha, criadoPor) {
    const token = obterTokenSessao();
    const resposta = apiRequestSync("POST", "/users/create", {
      token,
      login: normalizarLogin(login),
      senha: String(senha || ""),
      criadoPor: criadoPor || null
    });

    return {
      ok: Boolean(resposta.data?.ok),
      mensagem: mensagemResposta(resposta, "Falha ao cadastrar vendedor.")
    };
  }

  function ativarUsuario(login, diasPlano, ativadoPor) {
    const token = obterTokenSessao();
    const resposta = apiRequestSync("POST", "/users/activate", {
      token,
      login: normalizarLogin(login),
      diasPlano: Number(diasPlano) || 30,
      ativadoPor: ativadoPor || null
    });

    return {
      ok: Boolean(resposta.data?.ok),
      mensagem: mensagemResposta(resposta, "Falha ao ativar usuario.")
    };
  }

  function desativarUsuario(login, motivo, desativadoPor) {
    const token = obterTokenSessao();
    const resposta = apiRequestSync("POST", "/users/deactivate", {
      token,
      login: normalizarLogin(login),
      motivo: motivo || "Usuario desativado por falta de pagamento.",
      desativadoPor: desativadoPor || null
    });

    return {
      ok: Boolean(resposta.data?.ok),
      mensagem: mensagemResposta(resposta, "Falha ao desativar usuario.")
    };
  }

  function excluirUsuario(login, excluidoPor) {
    const token = obterTokenSessao();
    const resposta = apiRequestSync("POST", "/users/delete", {
      token,
      login: normalizarLogin(login),
      excluidoPor: excluidoPor || null
    });

    return {
      ok: Boolean(resposta.data?.ok),
      mensagem: mensagemResposta(resposta, "Falha ao excluir usuario.")
    };
  }

  function listarVendedores() {
    const token = obterTokenSessao();
    const resposta = apiRequestSync("GET", "/users", null, { token });
    if (!resposta.ok || !resposta.data?.ok) {
      return [];
    }
    return Array.isArray(resposta.data.usuarios) ? resposta.data.usuarios : [];
  }

  window.AuthDB = {
    garantirAdminPadrao,
    autenticar,
    obterSessao,
    obterUsuario,
    obterStatusUsuario,
    ativarUsuario,
    desativarUsuario,
    excluirUsuario,
    sair,
    exigirLogin,
    criarUsuarioVendedor,
    listarVendedores
  };
})();
