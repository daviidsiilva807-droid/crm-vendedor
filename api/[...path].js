/* Publica na Vercel a API do backend opcional de login (server-auth.js). */
const { tratarRequisicao } = require("../server-auth");

module.exports = async (req, res) => {
  try {
    await tratarRequisicao(req, res);
  } catch (erro) {
    console.error("Erro na funcao da Vercel:", erro.message);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, mensagem: "Erro interno do servidor." }));
    }
  }
};
