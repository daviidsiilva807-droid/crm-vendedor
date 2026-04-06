(function () {
  const DB_KEY = "controleSecao_usuarios_v1";
  const SESSION_KEY = "controleSecao_sessao_v1";
  const ADMIN_LOGIN = "daviidsiilva807";
  const ADMIN_SENHA = "L4ndeH4ck@100";
  const SESSAO_TTL_HORAS = 8;
  const DIA_EM_MS = 1000 * 60 * 60 * 24;

  function normalizarLogin(login) {
    return String(login || "").trim().toLowerCase();
  }

  function gerarToken() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `sessao-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function obterPlanoPadrao(dias) {
    if (Number(dias) === 90) {
      return { dias: 90, valor: 50 };
    }
    return { dias: 30, valor: 20 };
  }

  function adicionarDias(dataISO, dias) {
    const data = new Date(dataISO);
    data.setDate(data.getDate() + Number(dias || 0));
    return data.toISOString();
  }

  function calcularDiasRestantes(dataFimISO) {
    if (!dataFimISO) {
      return 0;
    }
    const diferenca = new Date(dataFimISO).getTime() - Date.now();
    return Math.max(0, Math.ceil(diferenca / DIA_EM_MS));
  }

  function lerUsuarios() {
    try {
      const bruto = localStorage.getItem(DB_KEY);
      const lista = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(lista) ? lista : [];
    } catch (erro) {
      return [];
    }
  }

  function salvarUsuarios(usuarios) {
    localStorage.setItem(DB_KEY, JSON.stringify(usuarios));
  }

  function normalizarUsuario(usuario) {
    const plano = obterPlanoPadrao(Number(usuario?.planoDias) || 30);
    return {
      login: normalizarLogin(usuario?.login),
      senha: String(usuario?.senha || ""),
      papel: usuario?.papel || "vendedor",
      ativo: Boolean(usuario?.ativo),
      vitalicio: Boolean(usuario?.vitalicio),
      planoDias: Number(usuario?.planoDias) || plano.dias,
      planoValor: Number(usuario?.planoValor) || plano.valor,
      assinaturaInicioEm: usuario?.assinaturaInicioEm || null,
      assinaturaFimEm: usuario?.assinaturaFimEm || null,
      criadoEm: usuario?.criadoEm || new Date().toISOString(),
      criadoPor: usuario?.criadoPor || "sistema",
      motivoBloqueio: usuario?.motivoBloqueio || "",
      desativadoEm: usuario?.desativadoEm || null,
      desativadoPor: usuario?.desativadoPor || null,
      ativadoEm: usuario?.ativadoEm || null,
      ativadoPor: usuario?.ativadoPor || null
    };
  }

  function sincronizarVencimentos() {
    const agora = Date.now();
    const usuarios = lerUsuarios().map((usuario) => {
      const atual = normalizarUsuario(usuario);
      if (atual.login === ADMIN_LOGIN) {
        return {
          ...atual,
          senha: ADMIN_SENHA,
          papel: "admin",
          ativo: true,
          vitalicio: true,
          planoDias: null,
          planoValor: null,
          assinaturaInicioEm: atual.assinaturaInicioEm || new Date().toISOString(),
          assinaturaFimEm: null,
          motivoBloqueio: "",
          desativadoEm: null,
          desativadoPor: null
        };
      }

      if (atual.ativo && atual.assinaturaFimEm && new Date(atual.assinaturaFimEm).getTime() < agora) {
        return {
          ...atual,
          ativo: false,
          motivoBloqueio: atual.motivoBloqueio || "Plano vencido por falta de pagamento.",
          desativadoEm: atual.desativadoEm || new Date().toISOString(),
          desativadoPor: atual.desativadoPor || "sistema"
        };
      }

      return atual;
    });

    salvarUsuarios(usuarios);
    return usuarios;
  }

  function obterUsuarioInterno(login) {
    const loginNormalizado = normalizarLogin(login);
    return sincronizarVencimentos().find((u) => u.login === loginNormalizado) || null;
  }

  function salvarSessao(sessao) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessao));
  }

  function lerSessaoLocal() {
    try {
      const bruto = localStorage.getItem(SESSION_KEY);
      if (!bruto) {
        return null;
      }
      const sessao = JSON.parse(bruto);
      return sessao && typeof sessao === "object" ? sessao : null;
    } catch (erro) {
      return null;
    }
  }

  function statusUsuario(usuario) {
    if (!usuario) {
      return null;
    }

    const ativo = Boolean(usuario.ativo);
    const vitalicio = Boolean(usuario.vitalicio);
    const diasRestantes = ativo && !vitalicio ? calcularDiasRestantes(usuario.assinaturaFimEm) : 0;
    const vencido = ativo && !vitalicio && diasRestantes === 0 && usuario.assinaturaFimEm && new Date(usuario.assinaturaFimEm).getTime() < Date.now();

    return {
      login: usuario.login,
      ativo,
      vitalicio,
      vencido,
      status: !ativo ? "desativado" : vitalicio ? "vitalicio" : vencido ? "vencido" : "ativo",
      planoDias: usuario.planoDias,
      planoValor: usuario.planoValor,
      assinaturaInicioEm: usuario.assinaturaInicioEm,
      assinaturaFimEm: usuario.assinaturaFimEm,
      diasRestantes: vitalicio ? null : diasRestantes,
      mensagem: !ativo
        ? (usuario.motivoBloqueio || "Usuario desativado por falta de pagamento.")
        : vitalicio
          ? "Usuario vitalicio. Acesso liberado sem vencimento."
          : vencido
            ? "Plano vencido. Regularize o pagamento para voltar a acessar."
            : `Plano ativo. Faltam ${diasRestantes} dia(s) para vencer.`
    };
  }

  function garantirAdminPadrao() {
    const usuarios = lerUsuarios();
    const idx = usuarios.findIndex((u) => normalizarLogin(u.login) === ADMIN_LOGIN);
    const adminBase = {
      login: ADMIN_LOGIN,
      senha: ADMIN_SENHA,
      papel: "admin",
      ativo: true,
      vitalicio: true,
      planoDias: null,
      planoValor: null,
      assinaturaInicioEm: new Date().toISOString(),
      assinaturaFimEm: null,
      criadoEm: new Date().toISOString(),
      criadoPor: "sistema",
      motivoBloqueio: "",
      desativadoEm: null,
      desativadoPor: null,
      ativadoEm: null,
      ativadoPor: null
    };

    if (idx < 0) {
      usuarios.push(adminBase);
    } else {
      usuarios[idx] = { ...normalizarUsuario(usuarios[idx]), ...adminBase, assinaturaInicioEm: usuarios[idx].assinaturaInicioEm || adminBase.assinaturaInicioEm };
    }

    salvarUsuarios(usuarios);
    sincronizarVencimentos();
    return { ok: true, mensagem: "Base local inicializada." };
  }

  function montarSessao(usuario) {
    const status = statusUsuario(usuario);
    const dataLogin = new Date().toISOString();
    const expiraEm = new Date(Date.now() + (SESSAO_TTL_HORAS * 60 * 60 * 1000)).toISOString();

    return {
      token: gerarToken(),
      login: usuario.login,
      papel: usuario.papel,
      vitalicio: Boolean(usuario.vitalicio),
      planoDias: usuario.vitalicio ? null : (usuario.planoDias || 30),
      planoValor: usuario.vitalicio ? null : (usuario.planoValor || 20),
      assinaturaInicioEm: usuario.assinaturaInicioEm || null,
      assinaturaFimEm: usuario.assinaturaFimEm || null,
      diasRestantes: status ? status.diasRestantes : null,
      dataLogin,
      expiraEm
    };
  }

  function autenticar(login, senha) {
    garantirAdminPadrao();
    const usuario = obterUsuarioInterno(login);
    if (!usuario || usuario.senha !== String(senha || "")) {
      return { ok: false, mensagem: "Login ou senha invalidos." };
    }

    const status = statusUsuario(usuario);
    if (!status || !status.ativo) {
      return { ok: false, mensagem: status?.mensagem || "Usuario desativado." };
    }

    const sessao = montarSessao(usuario);
    salvarSessao(sessao);
    return { ok: true, usuario: sessao };
  }

  function obterSessao() {
    const sessao = lerSessaoLocal();
    if (!sessao || !sessao.token || !sessao.login) {
      return null;
    }

    if (!sessao.expiraEm || new Date(sessao.expiraEm).getTime() < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    const usuario = obterUsuarioInterno(sessao.login);
    const status = statusUsuario(usuario);
    if (!usuario || !status || !status.ativo) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    const sessaoAtualizada = {
      ...sessao,
      papel: usuario.papel,
      vitalicio: Boolean(usuario.vitalicio),
      planoDias: usuario.vitalicio ? null : (usuario.planoDias || 30),
      planoValor: usuario.vitalicio ? null : (usuario.planoValor || 20),
      assinaturaInicioEm: usuario.assinaturaInicioEm || null,
      assinaturaFimEm: usuario.assinaturaFimEm || null,
      diasRestantes: status.diasRestantes
    };
    salvarSessao(sessaoAtualizada);
    return sessaoAtualizada;
  }

  function sair() {
    localStorage.removeItem(SESSION_KEY);
  }

  function exigirLogin() {
    const sessao = obterSessao();
    if (!sessao) {
      window.location.href = "index.html";
      return null;
    }
    return sessao;
  }

  function obterUsuario(login) {
    const usuario = obterUsuarioInterno(login);
    return usuario ? { ...usuario } : null;
  }

  function obterStatusUsuario(login) {
    const usuario = obterUsuarioInterno(login);
    return statusUsuario(usuario);
  }

  function exigirSessaoAdmin() {
    const sessao = obterSessao();
    if (!sessao || sessao.papel !== "admin") {
      return null;
    }
    return sessao;
  }

  function criarUsuarioVendedor(login, senha, criadoPor) {
    const sessao = exigirSessaoAdmin();
    if (!sessao) {
      return { ok: false, mensagem: "Acesso permitido apenas para administrador." };
    }

    const loginNormalizado = normalizarLogin(login);
    const senhaNormalizada = String(senha || "").trim();
    if (!loginNormalizado) {
      return { ok: false, mensagem: "Informe um login." };
    }
    if (senhaNormalizada.length < 4) {
      return { ok: false, mensagem: "A senha precisa ter pelo menos 4 caracteres." };
    }

    const usuarios = sincronizarVencimentos();
    if (usuarios.some((u) => u.login === loginNormalizado)) {
      return { ok: false, mensagem: "Esse login ja existe." };
    }

    usuarios.push({
      login: loginNormalizado,
      senha: senhaNormalizada,
      papel: "vendedor",
      ativo: false,
      vitalicio: false,
      planoDias: 30,
      planoValor: 20,
      assinaturaInicioEm: null,
      assinaturaFimEm: null,
      criadoEm: new Date().toISOString(),
      criadoPor: criadoPor || sessao.login,
      motivoBloqueio: "",
      desativadoEm: null,
      desativadoPor: null,
      ativadoEm: null,
      ativadoPor: null
    });

    salvarUsuarios(usuarios);
    return { ok: true, mensagem: "Vendedor cadastrado com sucesso." };
  }

  function ativarUsuario(login, diasPlano, ativadoPor) {
    const sessao = exigirSessaoAdmin();
    if (!sessao) {
      return { ok: false, mensagem: "Acesso permitido apenas para administrador." };
    }

    const loginNormalizado = normalizarLogin(login);
    if (loginNormalizado === ADMIN_LOGIN) {
      return { ok: false, mensagem: "O usuario administrador e vitalicio e nao pode receber plano." };
    }

    const usuarios = sincronizarVencimentos();
    const index = usuarios.findIndex((u) => u.login === loginNormalizado);
    if (index < 0) {
      return { ok: false, mensagem: "Usuario nao encontrado." };
    }

    const plano = obterPlanoPadrao(Number(diasPlano) || 30);
    const agora = new Date().toISOString();
    usuarios[index] = {
      ...usuarios[index],
      ativo: true,
      vitalicio: false,
      planoDias: plano.dias,
      planoValor: plano.valor,
      assinaturaInicioEm: agora,
      assinaturaFimEm: adicionarDias(agora, plano.dias),
      motivoBloqueio: "",
      desativadoEm: null,
      desativadoPor: null,
      ativadoEm: agora,
      ativadoPor: ativadoPor || sessao.login
    };
    salvarUsuarios(usuarios);
    return { ok: true, mensagem: `Usuario ativado no plano de ${plano.dias} dias.` };
  }

  function desativarUsuario(login, motivo, desativadoPor) {
    const sessao = exigirSessaoAdmin();
    if (!sessao) {
      return { ok: false, mensagem: "Acesso permitido apenas para administrador." };
    }

    const loginNormalizado = normalizarLogin(login);
    if (loginNormalizado === ADMIN_LOGIN) {
      return { ok: false, mensagem: "O usuario administrador e vitalicio e nao pode ser desativado." };
    }

    const usuarios = sincronizarVencimentos();
    const index = usuarios.findIndex((u) => u.login === loginNormalizado);
    if (index < 0) {
      return { ok: false, mensagem: "Usuario nao encontrado." };
    }

    usuarios[index] = {
      ...usuarios[index],
      ativo: false,
      motivoBloqueio: motivo || "Usuario desativado por falta de pagamento.",
      desativadoEm: new Date().toISOString(),
      desativadoPor: desativadoPor || sessao.login
    };
    salvarUsuarios(usuarios);
    return { ok: true, mensagem: "Usuario desativado com sucesso." };
  }

  function excluirUsuario(login, excluidoPor) {
    const sessao = exigirSessaoAdmin();
    if (!sessao) {
      return { ok: false, mensagem: "Acesso permitido apenas para administrador." };
    }

    const loginNormalizado = normalizarLogin(login);
    if (!loginNormalizado) {
      return { ok: false, mensagem: "Informe um login valido." };
    }
    if (loginNormalizado === ADMIN_LOGIN) {
      return { ok: false, mensagem: "O usuario administrador nao pode ser excluido." };
    }

    const usuarios = sincronizarVencimentos();
    const antes = usuarios.length;
    const filtrado = usuarios.filter((u) => u.login !== loginNormalizado);
    if (filtrado.length === antes) {
      return { ok: false, mensagem: "Usuario nao encontrado." };
    }
    salvarUsuarios(filtrado);

    const sessaoAtual = lerSessaoLocal();
    if (sessaoAtual && normalizarLogin(sessaoAtual.login) === loginNormalizado) {
      localStorage.removeItem(SESSION_KEY);
    }

    return { ok: true, mensagem: `Usuario ${loginNormalizado} excluido com sucesso por ${excluidoPor || sessao.login}.` };
  }

  function listarVendedores() {
    const sessao = exigirSessaoAdmin();
    if (!sessao) {
      return [];
    }
    return sincronizarVencimentos()
      .filter((u) => u.papel === "vendedor")
      .map((u) => ({ ...u }));
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
