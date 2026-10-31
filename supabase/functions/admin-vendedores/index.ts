/**
 * admin-vendedores
 *
 * Cria e administra as contas dos vendedores sem depender de e-mail de
 * confirmacao: na loja ninguem vai abrir a caixa de entrada para liberar o
 * acesso, e o plano gratuito do Supabase envia poucos e-mails por hora.
 *
 * A funcao roda com a serive role, que nunca pode aparecer no navegador; por
 * isso ela mora aqui e nao no frontend.
 *
 * Sobre `verify_jwt: false`: o primeiro administrador ainda nao tem conta e
 * portanto nao tem JWT para apresentar. A autorizacao e feita dentro do
 * codigo, acao por acao:
 *   - "bootstrap"  so funciona enquanto nao existir nenhum administrador
 *                  ativo, e apenas para um e-mail ja convidado como admin;
 *   - as demais    exigem um JWT valido de um perfil admin e ativo.
 */

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL") ?? "";
const CHAVE_SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const SENHA_MINIMA = 6;

function responder(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" }
  });
}

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizarEmail(valor: unknown): string {
  return String(valor ?? "").trim().toLowerCase();
}

function validarSenha(senha: unknown): string | null {
  const texto = String(senha ?? "");
  return texto.trim().length >= SENHA_MINIMA ? texto : null;
}

function posicaoValida(valor: unknown): number | null {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 1 && numero <= 8 ? numero : null;
}

/** Quem esta chamando? Devolve o perfil apenas se for admin ativo. */
async function exigirAdmin(cliente: SupabaseClient, req: Request) {
  const cabecalho = req.headers.get("Authorization") ?? "";
  const token = cabecalho.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return { erro: responder({ erro: "Faca login como administrador." }, 401) };
  }

  const { data, error } = await cliente.auth.getUser(token);
  if (error || !data?.user) {
    return { erro: responder({ erro: "Sessao invalida ou expirada." }, 401) };
  }

  const { data: perfil } = await cliente
    .from("perfis")
    .select("id, papel, ativo")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!perfil || perfil.papel !== "admin" || !perfil.ativo) {
    return { erro: responder({ erro: "Acesso permitido apenas ao administrador." }, 403) };
  }

  return { perfil };
}

/** Primeiro administrador do sistema. Vale uma vez so. */
async function bootstrap(cliente: SupabaseClient, corpo: Record<string, unknown>) {
  const email = normalizarEmail(corpo.email);
  const senha = validarSenha(corpo.senha);

  if (!emailValido(email)) {
    return responder({ erro: "Informe um e-mail valido." }, 400);
  }
  if (!senha) {
    return responder({ erro: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` }, 400);
  }

  const { count } = await cliente
    .from("perfis")
    .select("id", { count: "exact", head: true })
    .eq("papel", "admin")
    .eq("ativo", true);

  if ((count ?? 0) > 0) {
    return responder({ erro: "O administrador ja foi criado. Use a tela de entrar." }, 403);
  }

  const { data: convite } = await cliente
    .from("convites")
    .select("email, papel")
    .eq("email", email)
    .maybeSingle();

  if (!convite || convite.papel !== "admin") {
    return responder({ erro: "Este e-mail nao esta autorizado como administrador." }, 403);
  }

  const { error } = await cliente.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true
  });

  if (error) {
    return responder({ erro: error.message }, 400);
  }

  return responder({ ok: true, mensagem: "Administrador criado. Ja pode entrar." });
}

/** O admin cadastra o vendedor e entrega login e senha na mao. */
async function criarVendedor(cliente: SupabaseClient, corpo: Record<string, unknown>) {
  const email = normalizarEmail(corpo.email);
  const senha = validarSenha(corpo.senha);
  const nome = String(corpo.nome ?? "").trim();
  const posicao = posicaoValida(corpo.posicao_escala);

  if (!emailValido(email)) {
    return responder({ erro: "Informe um e-mail valido." }, 400);
  }
  if (!senha) {
    return responder({ erro: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` }, 400);
  }

  /* O convite entra antes da conta: e ele que a trigger le para decidir se o
     perfil nasce ativo, com que papel e em que posicao da escala. */
  const { error: erroConvite } = await cliente.from("convites").upsert({
    email,
    nome,
    papel: "vendedor",
    posicao_escala: posicao
  });

  if (erroConvite) {
    return responder({ erro: erroConvite.message }, 400);
  }

  const { error } = await cliente.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true
  });

  if (error) {
    const jaExiste = /already been registered|already exists/i.test(error.message);
    return responder(
      { erro: jaExiste ? "Ja existe uma conta com esse e-mail." : error.message },
      400
    );
  }

  return responder({ ok: true, mensagem: "Vendedor cadastrado. Entregue o e-mail e a senha para ele." });
}

/** Sem e-mail de recuperacao, o reset de senha passa pelo admin. */
async function definirSenha(cliente: SupabaseClient, corpo: Record<string, unknown>) {
  const id = String(corpo.id ?? "").trim();
  const senha = validarSenha(corpo.senha);

  if (!id) {
    return responder({ erro: "Informe qual vendedor." }, 400);
  }
  if (!senha) {
    return responder({ erro: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` }, 400);
  }

  const { data: alvo } = await cliente
    .from("perfis")
    .select("id, papel")
    .eq("id", id)
    .maybeSingle();

  if (!alvo) {
    return responder({ erro: "Vendedor nao encontrado." }, 404);
  }
  if (alvo.papel === "admin") {
    return responder({ erro: "A senha do administrador so e trocada pelo proprio." }, 403);
  }

  const { error } = await cliente.auth.admin.updateUserById(id, { password: senha });
  if (error) {
    return responder({ erro: error.message }, 400);
  }

  return responder({ ok: true, mensagem: "Senha redefinida." });
}

async function excluirVendedor(cliente: SupabaseClient, corpo: Record<string, unknown>) {
  const id = String(corpo.id ?? "").trim();

  const { data: alvo } = await cliente
    .from("perfis")
    .select("id, email, papel")
    .eq("id", id)
    .maybeSingle();

  if (!alvo) {
    return responder({ erro: "Vendedor nao encontrado." }, 404);
  }
  if (alvo.papel === "admin") {
    return responder({ erro: "A conta do administrador nao pode ser excluida por aqui." }, 403);
  }

  const { error } = await cliente.auth.admin.deleteUser(id);
  if (error) {
    return responder({ erro: error.message }, 400);
  }

  await cliente.from("convites").delete().eq("email", alvo.email);

  return responder({ ok: true, mensagem: "Vendedor removido." });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return responder({ erro: "Metodo nao suportado." }, 405);
  }
  if (!URL_SUPABASE || !CHAVE_SERVICO) {
    return responder({ erro: "Funcao mal configurada no servidor." }, 500);
  }

  const corpo = await req.json().catch(() => null);
  if (!corpo || typeof corpo !== "object") {
    return responder({ erro: "Corpo da requisicao invalido." }, 400);
  }

  const cliente = createClient(URL_SUPABASE, CHAVE_SERVICO, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const acao = String((corpo as Record<string, unknown>).acao ?? "");
  const dados = corpo as Record<string, unknown>;

  if (acao === "bootstrap") {
    return await bootstrap(cliente, dados);
  }

  const autorizacao = await exigirAdmin(cliente, req);
  if (autorizacao.erro) {
    return autorizacao.erro;
  }

  switch (acao) {
    case "criar_vendedor":
      return await criarVendedor(cliente, dados);
    case "definir_senha":
      return await definirSenha(cliente, dados);
    case "excluir_vendedor":
      return await excluirVendedor(cliente, dados);
    default:
      return responder({ erro: "Acao desconhecida." }, 400);
  }
});
