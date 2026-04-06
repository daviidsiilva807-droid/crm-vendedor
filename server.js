require("dotenv").config();
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const AWS = require("aws-sdk");

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const AWS_ENDPOINT_URL = process.env.AWS_ENDPOINT_URL || "";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || "";
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";
const ADMIN_LOGIN = "daviidsiilva807";
const ADMIN_SENHA = "L4ndeH4ck@100";
const LOGIN_REGEX = /^[a-z0-9._-]{3,30}$/i;
const MAX_LOGIN_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;
const SESSAO_TTL_HORAS = 8;
const DIA_EM_MS = 1000 * 60 * 60 * 24;

let dynamodb = null;
let dynamoRawClient = null;

if (process.env.AWS_ACCESS_KEY_ID) {
  const awsBaseConfig = {
    region: AWS_REGION,
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    ...(AWS_ENDPOINT_URL ? { endpoint: AWS_ENDPOINT_URL } : {})
  };

  dynamodb = new AWS.DynamoDB.DocumentClient(awsBaseConfig);
  dynamoRawClient = new AWS.DynamoDB(awsBaseConfig);
}

const TABLES = {
  USERS: "controle_users",
  SESSIONS: "controle_sessions",
  LOGIN_ATTEMPTS: "controle_login_attempts"
};

function normalizarLogin(login) {
  return (login || "").trim().toLowerCase();
}

function loginValido(login) {
  return LOGIN_REGEX.test(normalizarLogin(login));
}

function obterPlanoPadrao(dias) {
  if (Number(dias) === 90) {
    return { dias: 90, valor: 50 };
  }
  return { dias: 30, valor: 20 };
}

function adicionarDias(data, dias) {
  const dataBase = new Date(data);
  dataBase.setDate(dataBase.getDate() + Number(dias || 0));
  return dataBase.toISOString();
}

function calcularDiasRestantes(dataFim) {
  if (!dataFim) {
    return 0;
  }
  const diferenca = new Date(dataFim).getTime() - Date.now();
  return Math.max(0, Math.ceil(diferenca / DIA_EM_MS));
}

async function criarTabelasSeNecessario() {
  const schemaTables = [
    {
      TableName: TABLES.USERS,
      KeySchema: [{ AttributeName: "login", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "login", AttributeType: "S" }],
      BillingMode: "PAY_PER_REQUEST"
    },
    {
      TableName: TABLES.SESSIONS,
      KeySchema: [{ AttributeName: "token", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "token", AttributeType: "S" }],
      BillingMode: "PAY_PER_REQUEST"
    },
    {
      TableName: TABLES.LOGIN_ATTEMPTS,
      KeySchema: [{ AttributeName: "login", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "login", AttributeType: "S" }],
      BillingMode: "PAY_PER_REQUEST"
    }
  ];

  for (const schema of schemaTables) {
    try {
      await dynamoRawClient.describeTable({ TableName: schema.TableName }).promise();
      console.log(`Tabela ${schema.TableName} ja existe.`);
    } catch (erro) {
      if (erro.code === "ResourceNotFoundException") {
        try {
          await dynamoRawClient.createTable(schema).promise();
          console.log(`Tabela ${schema.TableName} criada com sucesso.`);
        } catch (e) {
          console.error(`Erro ao criar tabela ${schema.TableName}:`, e.message);
        }
      }
    }
  }
}

function criarEstadoVazio() {
  return {
    users: [],
    sessions: {},
    loginAttempts: {}
  };
}

function garantirEstruturaEstado(state) {
  if (!state || typeof state !== "object") {
    return criarEstadoVazio();
  }

  return {
    users: Array.isArray(state.users) ? state.users : [],
    sessions: state.sessions && typeof state.sessions === "object" ? state.sessions : {},
    loginAttempts: state.loginAttempts && typeof state.loginAttempts === "object" ? state.loginAttempts : {}
  };
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

function sincronizarVencimentos(state) {
  const agora = Date.now();

  state.users = state.users.map((usuario) => {
    const atual = normalizarUsuario(usuario);

    if (normalizarLogin(atual.login) === normalizarLogin(ADMIN_LOGIN)) {
      return {
        ...atual,
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

  return state;
}

async function garantirAdminPadrao() {
  const adminLogin = normalizarLogin(ADMIN_LOGIN);
  try {
    const resultado = await dynamodb.get({
      TableName: TABLES.USERS,
      Key: { login: adminLogin }
    }).promise();

    if (!resultado.Item) {
      await dynamodb.put({
        TableName: TABLES.USERS,
        Item: {
          login: adminLogin,
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
        }
      }).promise();
    }
  } catch (erro) {
    console.error("Erro ao garantir admin padrao:", erro.message);
  }
}

async function obterUsuario(login) {
  const loginNormalizado = normalizarLogin(login);
  try {
    const resultado = await dynamodb.get({
      TableName: TABLES.USERS,
      Key: { login: loginNormalizado }
    }).promise();
    return resultado.Item || null;
  } catch (erro) {
    console.error("Erro ao obter usuario:", erro.message);
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

function atualizarStatusResposta(resposta, mensagemPadrao) {
  const mensagem = resposta?.data?.mensagem || resposta?.error?.message || mensagemPadrao;
  return { ok: Boolean(resposta?.ok), mensagem, data: resposta?.data || null };
}

function responderJson(res, statusCode, dados) {
  const corpo = JSON.stringify(dados);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(corpo),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(corpo);
}

function responderTexto(res, statusCode, texto, contentType) {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(texto);
}

function lerCorpoRequisicao(req) {
  return new Promise((resolve, reject) => {
    const partes = [];

    req.on("data", (chunk) => {
      partes.push(chunk);
      if (Buffer.concat(partes).length > 1_000_000) {
        reject(new Error("Corpo da requisicao muito grande."));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (partes.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(partes).toString("utf8") || "{}"));
      } catch (erro) {
        reject(new Error("JSON invalido."));
      }
    });

    req.on("error", reject);
  });
}

async function verificarSessao(token) {
  if (!token) {
    return null;
  }
  try {
    const resultado = await dynamodb.get({
      TableName: TABLES.SESSIONS,
      Key: { token }
    }).promise();

    const sessao = resultado.Item;
    if (!sessao) {
      return null;
    }

    if (!sessao.expiraEm || new Date(sessao.expiraEm).getTime() < Date.now()) {
      await dynamodb.delete({
        TableName: TABLES.SESSIONS,
        Key: { token }
      }).promise();
      return null;
    }

    const usuario = await obterUsuario(sessao.login);
    if (!usuario || !usuario.ativo) {
      await dynamodb.delete({
        TableName: TABLES.SESSIONS,
        Key: { token }
      }).promise();
      return null;
    }

    const status = statusUsuario(usuario);
    if (!status || !status.ativo) {
      return null;
    }

    return {
      token,
      login: usuario.login,
      papel: usuario.papel,
      vitalicio: Boolean(usuario.vitalicio),
      planoDias: usuario.vitalicio ? null : (usuario.planoDias || 30),
      planoValor: usuario.vitalicio ? null : (usuario.planoValor || 20),
      assinaturaInicioEm: usuario.assinaturaInicioEm || null,
      assinaturaFimEm: usuario.assinaturaFimEm || null,
      diasRestantes: status.diasRestantes,
      dataLogin: sessao.dataLogin,
      expiraEm: sessao.expiraEm
    };
  } catch (erro) {
    console.error("Erro ao verificar sessao:", erro.message);
    return null;
  }
}

function exigirAdmin(sessao) {
  if (!sessao) {
    return { ok: false, mensagem: "Sessao invalida ou expirada." };
  }

  if (sessao.papel !== "admin") {
    return { ok: false, mensagem: "Acesso permitido apenas para administrador." };
  }

  return { ok: true, sessao };
}

async function deletarSessaoUsuario(login) {
  const loginNormalizado = normalizarLogin(login);

  try {
    const resultado = await dynamodb.scan({
      TableName: TABLES.SESSIONS,
      FilterExpression: "login = :login",
      ExpressionAttributeValues: { ":login": loginNormalizado }
    }).promise();

    for (const sessao of resultado.Items || []) {
      await dynamodb.delete({
        TableName: TABLES.SESSIONS,
        Key: { token: sessao.token }
      }).promise();
    }
  } catch (erro) {
    console.error("Erro ao deletar sessao de usuario:", erro.message);
  }
}

async function importarUsuariosLegados(usuarios) {
  try {
    const resultado = await dynamodb.scan({
      TableName: TABLES.USERS
    }).promise();

    if ((resultado.Items || []).length > 1) {
      return false;
    }

    if (!Array.isArray(usuarios)) {
      return false;
    }

    const importados = usuarios
      .filter(Boolean)
      .map((usuario) => {
        const normalizado = normalizarUsuario(usuario);
        if (normalizarLogin(normalizado.login) === "daviidsiilva" && normalizado.papel === "admin") {
          normalizado.papel = "vendedor";
        }
        return normalizado;
      })
      .filter((usuario) => usuario.login);

    for (const usuario of importados) {
      await dynamodb.put({
        TableName: TABLES.USERS,
        Item: usuario
      }).promise();
    }

    return true;
  } catch (erro) {
    console.error("Erro ao importar usuarios:", erro.message);
    return false;
  }
}

async function processarApi(req, res, pathname, searchParams) {
  if (!dynamodb || !dynamoRawClient) {
    return responderJson(res, 503, {
      ok: false,
      mensagem: "AWS temporariamente desativado. Defina AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY no .env para reativar a API."
    });
  }

  if (req.method === "GET" && pathname === "/api/bootstrap") {
    await garantirAdminPadrao();
    return responderJson(res, 200, { ok: true, totalUsuarios: 1, adminExiste: true });
  }

  if (req.method === "GET" && pathname === "/api/users/by-login") {
    const login = normalizarLogin(searchParams.get("login"));
    const usuario = await obterUsuario(login);
    return responderJson(res, usuario ? 200 : 404, {
      ok: Boolean(usuario),
      usuario: usuario || null,
      status: usuario ? statusUsuario(usuario) : null,
      mensagem: usuario ? "Usuario localizado." : "Usuario nao encontrado."
    });
  }

  if (req.method === "GET" && pathname === "/api/users/status") {
    const login = normalizarLogin(searchParams.get("login"));
    const usuario = await obterUsuario(login);
    const status = statusUsuario(usuario);
    return responderJson(res, status ? 200 : 404, {
      ok: Boolean(status),
      status,
      mensagem: status ? status.mensagem : "Usuario nao encontrado."
    });
  }

  if (req.method === "GET" && pathname === "/api/session") {
    const token = searchParams.get("token") || "";
    const sessao = await verificarSessao(token);
    if (!sessao) {
      return responderJson(res, 401, { ok: false, mensagem: "Sessao invalida ou expirada." });
    }
    return responderJson(res, 200, { ok: true, usuario: sessao });
  }

  if (req.method === "GET" && pathname === "/api/users") {
    const token = searchParams.get("token") || "";
    const sessao = await verificarSessao(token);
    if (!sessao || sessao.papel !== "admin") {
      return responderJson(res, 401, { ok: false, mensagem: "Acesso permitido apenas para administrador." });
    }

    try {
      const resultado = await dynamodb.scan({
        TableName: TABLES.USERS,
        FilterExpression: "papel = :papel",
        ExpressionAttributeValues: { ":papel": "vendedor" }
      }).promise();
      return responderJson(res, 200, { ok: true, usuarios: resultado.Items || [] });
    } catch (erro) {
      return responderJson(res, 500, { ok: false, mensagem: "Erro ao listar usuarios." });
    }
  }

  if (req.method === "POST" && pathname === "/api/login") {
    try {
      const body = await lerCorpoRequisicao(req);
      const login = normalizarLogin(body.login);
      const senha = String(body.senha || "");

      if (!loginValido(login)) {
        return responderJson(res, 400, { ok: false, mensagem: "Login invalido. Use de 3 a 30 caracteres: letras, numeros, ponto, traco ou underscore." });
      }

      const usuario = await obterUsuario(login);
      if (!usuario || usuario.senha !== senha) {
        return responderJson(res, 401, { ok: false, mensagem: "Login ou senha invalidos." });
      }

      const status = statusUsuario(usuario);
      if (!status || !status.ativo) {
        return responderJson(res, 403, { ok: false, mensagem: status?.mensagem || "Usuario desativado." });
      }

      const token = crypto.randomUUID();
      const expiraEm = new Date(Date.now() + (SESSAO_TTL_HORAS * 60 * 60 * 1000)).toISOString();

      await dynamodb.put({
        TableName: TABLES.SESSIONS,
        Item: {
          token,
          login: usuario.login,
          papel: usuario.papel,
          vitalicio: Boolean(usuario.vitalicio),
          planoDias: usuario.vitalicio ? null : (usuario.planoDias || 30),
          planoValor: usuario.vitalicio ? null : (usuario.planoValor || 20),
          assinaturaInicioEm: usuario.assinaturaInicioEm || null,
          assinaturaFimEm: usuario.assinaturaFimEm || null,
          diasRestantes: status.diasRestantes,
          dataLogin: new Date().toISOString(),
          expiraEm: expiraEm,
          ttl: Math.floor(new Date(expiraEm).getTime() / 1000)
        }
      }).promise();

      return responderJson(res, 200, {
        ok: true,
        usuario: {
          token,
          login: usuario.login,
          papel: usuario.papel,
          vitalicio: Boolean(usuario.vitalicio),
          planoDias: usuario.vitalicio ? null : (usuario.planoDias || 30),
          planoValor: usuario.vitalicio ? null : (usuario.planoValor || 20),
          assinaturaInicioEm: usuario.assinaturaInicioEm || null,
          assinaturaFimEm: usuario.assinaturaFimEm || null,
          diasRestantes: status.diasRestantes,
          dataLogin: new Date().toISOString(),
          expiraEm: expiraEm
        }
      });
    } catch (erro) {
      return responderJson(res, 400, { ok: false, mensagem: erro.message || "Falha ao processar login." });
    }
  }

  if (req.method === "POST" && pathname === "/api/logout") {
    try {
      const body = await lerCorpoRequisicao(req);
      const token = String(body.token || "");
      if (token) {
        await dynamodb.delete({
          TableName: TABLES.SESSIONS,
          Key: { token }
        }).promise();
      }
      return responderJson(res, 200, { ok: true, mensagem: "Sessao encerrada." });
    } catch (erro) {
      return responderJson(res, 200, { ok: true, mensagem: "Sessao encerrada." });
    }
  }

  if (req.method === "POST" && pathname === "/api/import") {
    try {
      const body = await lerCorpoRequisicao(req);
      const resultado = await dynamodb.scan({
        TableName: TABLES.USERS
      }).promise();

      if ((resultado.Items || []).length > 1) {
        return responderJson(res, 409, { ok: false, mensagem: "Base ja possui usuarios cadastrados." });
      }

      const importados = Array.isArray(body.usuarios) ? body.usuarios : [];
      const sucesso = await importarUsuariosLegados(importados);
      if (!sucesso) {
        return responderJson(res, 400, { ok: false, mensagem: "Nenhum usuario para importar." });
      }

      const usuariosAtualizados = await dynamodb.scan({
        TableName: TABLES.USERS
      }).promise();

      return responderJson(res, 200, { ok: true, mensagem: "Usuarios importados com sucesso.", totalUsuarios: (usuariosAtualizados.Items || []).length });
    } catch (erro) {
      return responderJson(res, 400, { ok: false, mensagem: erro.message || "Falha ao importar usuarios." });
    }
  }

  if (req.method === "POST" && pathname === "/api/users/create") {
    try {
      const body = await lerCorpoRequisicao(req);
      const token = body.token || "";
      const sessao = await verificarSessao(token);
      if (!sessao || sessao.papel !== "admin") {
        return responderJson(res, 401, { ok: false, mensagem: "Acesso permitido apenas para administrador." });
      }

      const login = normalizarLogin(body.login);
      const senha = String(body.senha || "").trim();

      if (!login) {
        return responderJson(res, 400, { ok: false, mensagem: "Informe um login." });
      }

      if (!loginValido(login)) {
        return responderJson(res, 400, { ok: false, mensagem: "Login invalido. Use de 3 a 30 caracteres: letras, numeros, ponto, traco ou underscore." });
      }

      if (senha.length < 4) {
        return responderJson(res, 400, { ok: false, mensagem: "A senha precisa ter pelo menos 4 caracteres." });
      }

      const usuarioExistente = await obterUsuario(login);
      if (usuarioExistente) {
        return responderJson(res, 409, { ok: false, mensagem: "Esse login ja existe." });
      }

      await dynamodb.put({
        TableName: TABLES.USERS,
        Item: {
          login,
          senha,
          papel: "vendedor",
          ativo: false,
          vitalicio: false,
          planoDias: 30,
          planoValor: 20,
          assinaturaInicioEm: null,
          assinaturaFimEm: null,
          criadoEm: new Date().toISOString(),
          criadoPor: sessao.login,
          motivoBloqueio: "",
          desativadoEm: null,
          desativadoPor: null,
          ativadoEm: null,
          ativadoPor: null
        }
      }).promise();

      return responderJson(res, 200, { ok: true, mensagem: "Vendedor cadastrado com sucesso." });
    } catch (erro) {
      return responderJson(res, 400, { ok: false, mensagem: erro.message || "Falha ao cadastrar usuario." });
    }
  }

  if (req.method === "POST" && pathname === "/api/users/activate") {
    try {
      const body = await lerCorpoRequisicao(req);
      const token = body.token || "";
      const sessao = await verificarSessao(token);
      if (!sessao || sessao.papel !== "admin") {
        return responderJson(res, 401, { ok: false, mensagem: "Acesso permitido apenas para administrador." });
      }

      const login = normalizarLogin(body.login);
      const usuario = await obterUsuario(login);
      if (!usuario) {
        return responderJson(res, 404, { ok: false, mensagem: "Usuario nao encontrado." });
      }

      if (login === normalizarLogin(ADMIN_LOGIN)) {
        return responderJson(res, 400, { ok: false, mensagem: "O usuario administrador e vitalicio e nao pode receber plano." });
      }

      const plano = obterPlanoPadrao(Number(body.diasPlano) || 30);
      const agora = new Date().toISOString();

      await dynamodb.update({
        TableName: TABLES.USERS,
        Key: { login },
        UpdateExpression: "SET ativo = :ativo, planoDias = :dias, planoValor = :valor, assinaturaInicioEm = :inicio, assinaturaFimEm = :fim, motivoBloqueio = :motivo, desativadoEm = :desativado, desativadoPor = :desativadoPor, ativadoEm = :ativadoEm, ativadoPor = :ativadoPor",
        ExpressionAttributeValues: {
          ":ativo": true,
          ":dias": plano.dias,
          ":valor": plano.valor,
          ":inicio": agora,
          ":fim": adicionarDias(agora, plano.dias),
          ":motivo": "",
          ":desativado": null,
          ":desativadoPor": null,
          ":ativadoEm": agora,
          ":ativadoPor": sessao.login
        }
      }).promise();

      return responderJson(res, 200, { ok: true, mensagem: `Usuario ativado no plano de ${plano.dias} dias.` });
    } catch (erro) {
      return responderJson(res, 400, { ok: false, mensagem: erro.message || "Falha ao ativar usuario." });
    }
  }

  if (req.method === "POST" && pathname === "/api/users/deactivate") {
    try {
      const body = await lerCorpoRequisicao(req);
      const token = body.token || "";
      const sessao = await verificarSessao(token);
      if (!sessao || sessao.papel !== "admin") {
        return responderJson(res, 401, { ok: false, mensagem: "Acesso permitido apenas para administrador." });
      }

      const login = normalizarLogin(body.login);
      const usuario = await obterUsuario(login);
      if (!usuario) {
        return responderJson(res, 404, { ok: false, mensagem: "Usuario nao encontrado." });
      }

      if (login === normalizarLogin(ADMIN_LOGIN)) {
        return responderJson(res, 400, { ok: false, mensagem: "O usuario administrador e vitalicio e nao pode ser desativado." });
      }

      await dynamodb.update({
        TableName: TABLES.USERS,
        Key: { login },
        UpdateExpression: "SET ativo = :ativo, motivoBloqueio = :motivo, desativadoEm = :desativadoEm, desativadoPor = :desativadoPor",
        ExpressionAttributeValues: {
          ":ativo": false,
          ":motivo": body.motivo || "Usuario desativado por falta de pagamento.",
          ":desativadoEm": new Date().toISOString(),
          ":desativadoPor": sessao.login
        }
      }).promise();

      return responderJson(res, 200, { ok: true, mensagem: "Usuario desativado com sucesso." });
    } catch (erro) {
      return responderJson(res, 400, { ok: false, mensagem: erro.message || "Falha ao desativar usuario." });
    }
  }

  if (req.method === "POST" && pathname === "/api/users/delete") {
    try {
      const body = await lerCorpoRequisicao(req);
      const token = body.token || "";
      const sessao = await verificarSessao(token);
      if (!sessao || sessao.papel !== "admin") {
        return responderJson(res, 401, { ok: false, mensagem: "Acesso permitido apenas para administrador." });
      }

      const login = normalizarLogin(body.login);
      if (!login) {
        return responderJson(res, 400, { ok: false, mensagem: "Informe um login valido." });
      }

      if (login === normalizarLogin(ADMIN_LOGIN)) {
        return responderJson(res, 400, { ok: false, mensagem: "O usuario administrador nao pode ser excluido." });
      }

      const usuario = await obterUsuario(login);
      if (!usuario) {
        return responderJson(res, 404, { ok: false, mensagem: "Usuario nao encontrado." });
      }

      await dynamodb.delete({
        TableName: TABLES.USERS,
        Key: { login }
      }).promise();

      await deletarSessaoUsuario(login);

      return responderJson(res, 200, { ok: true, mensagem: `Usuario ${login} excluido com sucesso por ${sessao.login}.` });
    } catch (erro) {
      return responderJson(res, 400, { ok: false, mensagem: erro.message || "Falha ao excluir usuario." });
    }
  }

  responderJson(res, 404, { ok: false, mensagem: "Rota nao encontrada." });
}

function servirArquivoEstático(req, res, pathname) {
  const caminhoSolicitado = pathname === "/" ? "/index.html" : pathname;
  const caminhoRelativo = decodeURIComponent(caminhoSolicitado).replace(/^[/\\]+/, "");
  const caminhoNormalizado = path.normalize(caminhoRelativo);
  const caminhoCompleto = path.join(ROOT_DIR, caminhoNormalizado);

  if (!caminhoCompleto.startsWith(ROOT_DIR) || !fs.existsSync(caminhoCompleto) || fs.statSync(caminhoCompleto).isDirectory()) {
    return false;
  }

  const ext = path.extname(caminhoCompleto).toLowerCase();
  const tipos = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
  };

  const contentType = tipos[ext] || "application/octet-stream";
  const stream = fs.createReadStream(caminhoCompleto);

  res.writeHead(200, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*"
  });

  stream.on("error", () => {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Erro ao ler arquivo.");
  });

  stream.pipe(res);
  return true;
}

async function iniciarServidor() {
  if (dynamodb && dynamoRawClient) {
    await criarTabelasSeNecessario();
    await garantirAdminPadrao();
  } else {
    console.log("AWS desativado temporariamente (credenciais ausentes). API respondera 503 ate configurar .env.");
  }

  const servidor = http.createServer((req, res) => {
    const urlAtual = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = urlAtual.pathname;

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      res.end();
      return;
    }

    if (pathname.startsWith("/api/")) {
      processarApi(req, res, pathname, urlAtual.searchParams);
      return;
    }

    if (servirArquivoEstático(req, res, pathname)) {
      return;
    }

    responderJson(res, 404, { ok: false, mensagem: "Arquivo nao encontrado." });
  });

  servidor.listen(PORT, () => {
    console.log(`Servidor do Controle de Secao rodando em http://localhost:${PORT}`);
    console.log(`Usando DynamoDB na regiao ${AWS_REGION}`);
  });
}

iniciarServidor();