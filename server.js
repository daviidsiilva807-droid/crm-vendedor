const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';

// Middleware
app.use(cors());
app.use(express.json());

// Validação da chave da API
if (!OPENAI_API_KEY) {
  console.error('❌ ERRO: OPENAI_API_KEY não configurada em .env');
  process.exit(1);
}

/**
 * POST /api/openai-proxy
 * 
 * Body esperado:
 * {
 *   "prompt": "string com o prompt",
 *   "model": "string do modelo (opcional, usa padrão do .env)",
 *   "temperature": número (opcional, padrão 0.7)
 * }
 * 
 * Resposta: { success: true, data: { ... } } ou { success: false, error: "mensagem" }
 */
app.post('/api/openai-proxy', async (req, res) => {
  try {
    const { prompt, model, temperature } = req.body;

    // Validações básicas
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Campo "prompt" é obrigatório e deve ser não-vazio.'
      });
    }

    // Construir payload para OpenAI
    const payload = {
      model: model || OPENAI_MODEL,
      temperature: temperature || 0.7,
      messages: [
        {
          role: 'system',
          content: 'Responda somente com JSON válido contendo as chaves postPrincipal, legenda e agenda.'
        },
        {
          role: 'user',
          content: prompt.trim()
        }
      ]
    };

    // Fazer request para OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    // Ler resposta
    let openaiData = null;
    try {
      openaiData = await response.json();
    } catch (parseError) {
      return res.status(502).json({
        success: false,
        error: 'Erro ao processar resposta do OpenAI.'
      });
    }

    // Verificar sucesso
    if (!response.ok) {
      const errorMsg = openaiData?.error?.message || `Erro da OpenAI (${response.status})`;
      return res.status(response.status).json({
        success: false,
        error: errorMsg
      });
    }

    // Retornar resposta
    return res.status(200).json({
      success: true,
      data: openaiData
    });

  } catch (error) {
    console.error('Erro no proxy:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor.'
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada.'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Proxy OpenAI rodando em http://localhost:${PORT}`);
  console.log(`🔑 Usando modelo: ${OPENAI_MODEL}`);
  console.log(`📍 Endpoint: POST http://localhost:${PORT}/api/openai-proxy`);
});
