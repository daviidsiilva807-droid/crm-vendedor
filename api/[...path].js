const { tratarRequisicao } = require("../server");

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
