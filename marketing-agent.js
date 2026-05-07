(function () {
  const STORAGE_KEY = 'controleSecao_marketing_draft_v1';
  const AI_CONFIG_STORAGE_KEY = 'controleSecao_marketing_ai_v1';

  function $(id) {
    return document.getElementById(id);
  }

  function lerValor(id) {
    const elemento = $(id);
    return elemento ? elemento.value.trim() : '';
  }

  function formatarData(dataISO) {
    if (!dataISO) {
      return '-';
    }

    return new Date(`${dataISO}T12:00:00`).toLocaleDateString('pt-BR');
  }

  function formatarDiaSemana(dataISO) {
    if (!dataISO) {
      return '';
    }

    return new Date(`${dataISO}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long' });
  }

  function capitalizarTexto(texto) {
    return String(texto || '')
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((palavra) => palavra.charAt(0).toUpperCase() + palavra.slice(1))
      .join(' ');
  }

  function montarHashtags(dados) {
    const sementes = [
      dados.produto,
      dados.categoria,
      dados.objetivo,
      dados.publico,
      dados.canal,
      'marketing',
      'vendas',
      'oferta',
      'novidade'
    ]
      .join(' ')
      .split(/\s+/)
      .map((item) => item.replace(/[^\p{L}\p{N}]+/gu, '').trim())
      .filter(Boolean);

    const unicos = [];
    sementes.forEach((item) => {
      const tag = `#${item.toLowerCase()}`;
      if (!unicos.includes(tag)) {
        unicos.push(tag);
      }
    });

    return unicos.slice(0, 12).join(' ');
  }

  function sugestaoHorarioPorCanal(canal, horaInformada) {
    if (horaInformada) {
      return horaInformada;
    }

    const horarios = {
      instagram: '19:30',
      stories: '08:30',
      reels: '20:00',
      whatsapp: '09:00'
    };

    return horarios[canal] || '18:00';
  }

  function sugestaoDiasPorObjetivo(objetivo) {
    const base = {
      venda: ['terça-feira', 'quinta-feira', 'sábado'],
      lancamento: ['segunda-feira', 'quarta-feira', 'sexta-feira'],
      queima: ['quinta-feira', 'sexta-feira', 'sábado'],
      engajamento: ['quarta-feira', 'sexta-feira', 'domingo'],
      reserva: ['segunda-feira', 'terça-feira', 'sexta-feira']
    };

    return base[objetivo] || ['terça-feira', 'quinta-feira', 'sábado'];
  }

  function tomTexto(tom) {
    const mapa = {
      direto: 'direto, objetivo e persuasivo',
      premium: 'sofisticado, elegante e valorizando o produto',
      urgente: 'forte, urgente e com senso de oportunidade',
      proximidade: 'próximo, caloroso e convidativo'
    };

    return mapa[tom] || 'direto e persuasivo';
  }

  function objetivoTexto(objetivo) {
    const mapa = {
      venda: 'fechar venda agora',
      lancamento: 'apresentar o lançamento',
      queima: 'acelerar a saída do estoque',
      engajamento: 'aumentar alcance e conversa',
      reserva: 'convidar para reserva'
    };

    return mapa[objetivo] || 'vender mais';
  }

  function obterConfiguracaoIA() {
    if (!window.CONTROLE_SECAO_ADMIN) {
      return {
        enabled: false,
        apiKey: '',
        model: 'gpt-4.1-mini'
      };
    }

    const padrao = {
      enabled: false,
      apiKey: '',
      model: 'gpt-4.1-mini'
    };

    try {
      const bruto = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
      if (!bruto) {
        return padrao;
      }

      const dados = JSON.parse(bruto);
      if (!dados || typeof dados !== 'object') {
        return padrao;
      }

      return {
        enabled: Boolean(dados.enabled),
        apiKey: String(dados.apiKey || '').trim(),
        model: String(dados.model || padrao.model).trim() || padrao.model
      };
    } catch (erro) {
      return padrao;
    }
  }

  function salvarConfiguracaoIA() {
    if (!window.CONTROLE_SECAO_ADMIN) {
      return;
    }

    try {
      const dados = {
        enabled: $('marketingUsarChatGPT')?.checked === true,
        apiKey: $('marketingApiKey')?.value.trim() || '',
        model: $('marketingModeloIA')?.value.trim() || 'gpt-4.1-mini',
        atualizadoEm: new Date().toISOString()
      };

      localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(dados));
    } catch (erro) {
      // Configuração opcional.
    }
  }

  function carregarConfiguracaoIA() {
    if (!window.CONTROLE_SECAO_ADMIN) {
      if ($('marketingAiConfig')) {
        $('marketingAiConfig').style.display = 'none';
      }

      if ($('marketingUsarChatGPT')) $('marketingUsarChatGPT').checked = false;
      if ($('marketingApiKey')) $('marketingApiKey').value = '';
      if ($('marketingModeloIA')) $('marketingModeloIA').value = 'gpt-4.1-mini';
      return;
    }

    const dados = obterConfiguracaoIA();

    if ($('marketingUsarChatGPT')) $('marketingUsarChatGPT').checked = Boolean(dados.enabled);
    if ($('marketingApiKey')) $('marketingApiKey').value = dados.apiKey || '';
    if ($('marketingModeloIA')) $('marketingModeloIA').value = dados.model || 'gpt-4.1-mini';
  }

  function configurarIAListeners() {
    if (!window.CONTROLE_SECAO_ADMIN) {
      return;
    }

    ['marketingUsarChatGPT', 'marketingApiKey', 'marketingModeloIA']
      .forEach((id) => {
        const campo = $(id);
        if (!campo) {
          return;
        }

        campo.addEventListener('input', salvarConfiguracaoIA);
        campo.addEventListener('change', salvarConfiguracaoIA);
        campo.addEventListener('blur', salvarConfiguracaoIA);
      });
  }

  function montarPromptChatGPT(dados) {
    return [
      'Você é um assistente de marketing para uma loja de roupas, tênis e acessórios no Brasil.',
      'Responda somente com um JSON válido e sem blocos de código.',
      'A estrutura deve ter exatamente as chaves postPrincipal, legenda e agenda.',
      'Cada valor deve ser uma string em português do Brasil, clara, comercial e pronta para uso.',
      'Use um tom alinhado aos campos informados e não invente dados ausentes.',
      '',
      'Dados da campanha:',
      JSON.stringify(dados, null, 2)
    ].join('\n');
  }

  function extrairTextoRespostaOpenAI(resposta) {
    if (!resposta) {
      return '';
    }

    if (typeof resposta.output_text === 'string' && resposta.output_text.trim()) {
      return resposta.output_text.trim();
    }

    if (typeof resposta.choices?.[0]?.message?.content === 'string') {
      return resposta.choices[0].message.content.trim();
    }

    if (Array.isArray(resposta.output)) {
      const trechos = [];

      resposta.output.forEach((item) => {
        if (Array.isArray(item?.content)) {
          item.content.forEach((bloco) => {
            if (typeof bloco?.text === 'string') {
              trechos.push(bloco.text);
            }
          });
        }
      });

      return trechos.join('\n').trim();
    }

    return '';
  }

  function extrairJsonDoTexto(texto) {
    if (!texto) {
      return null;
    }

    const bruto = String(texto).trim();

    try {
      return JSON.parse(bruto);
    } catch (erro) {
      const inicio = bruto.indexOf('{');
      const fim = bruto.lastIndexOf('}');

      if (inicio >= 0 && fim > inicio) {
        try {
          return JSON.parse(bruto.slice(inicio, fim + 1));
        } catch (erroInterno) {
          return null;
        }
      }

      return null;
    }
  }

  function normalizarResultadoIA(resultado) {
    if (!resultado || typeof resultado !== 'object') {
      return null;
    }

    const postPrincipal = String(resultado.postPrincipal || resultado.post || '').trim();
    const legenda = String(resultado.legenda || resultado.caption || '').trim();
    const agenda = String(resultado.agenda || resultado.calendario || '').trim();

    if (!postPrincipal && !legenda && !agenda) {
      return null;
    }

    return {
      postPrincipal: postPrincipal || 'Sem resposta principal.',
      legenda: legenda || 'Sem legenda.',
      agenda: agenda || 'Sem agenda.'
    };
  }

  async function gerarConteudoComChatGPT(dados) {
    const configuracao = obterConfiguracaoIA();

    if (!configuracao.enabled) {
      return null;
    }

    if (!configuracao.apiKey) {
      throw new Error('Informe a chave da OpenAI para usar o ChatGPT.');
    }

    const resposta = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${configuracao.apiKey}`
      },
      body: JSON.stringify({
        model: configuracao.model || 'gpt-4.1-mini',
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: 'Responda somente com JSON válido contendo as chaves postPrincipal, legenda e agenda.'
          },
          {
            role: 'user',
            content: montarPromptChatGPT(dados)
          }
        ]
      })
    });

    let payload = null;
    try {
      payload = await resposta.json();
    } catch (erro) {
      throw new Error('Nao foi possivel ler a resposta do ChatGPT.');
    }

    if (!resposta.ok) {
      const mensagem = payload?.error?.message || `Falha ao gerar conteúdo (${resposta.status}).`;
      throw new Error(mensagem);
    }

    const texto = extrairTextoRespostaOpenAI(payload);
    const resultado = normalizarResultadoIA(extrairJsonDoTexto(texto));

    if (!resultado) {
      throw new Error('ChatGPT respondeu, mas o formato veio invalido.');
    }

    return resultado;
  }

  function gerarConteudo(dados) {
    const nomeProduto = capitalizarTexto(dados.produto);
    const dias = sugestaoDiasPorObjetivo(dados.objetivo);
    const horario = sugestaoHorarioPorCanal(dados.canal, dados.hora);
    const diaInformado = dados.data ? `${formatarDiaSemana(dados.data)}, ${formatarData(dados.data)}` : 'sem data definida';
    const destaqueExtra = dados.detalhes ? `\nDestaques: ${dados.detalhes}` : '';
    const hashtags = montarHashtags(dados);

    const postPrincipal = [
      'Agente de marketing',
      `Produto: ${nomeProduto || 'sem nome'}`,
      `Categoria: ${dados.categoria}`,
      `Objetivo: ${objetivoTexto(dados.objetivo)}`,
      `Tom: ${tomTexto(dados.tom)}`,
      `Canal: ${dados.canal}`,
      `Sugestao de postagem: ${diaInformado} as ${horario}`,
      destaqueExtra.trim()
    ]
      .filter(Boolean)
      .join('\n');

    const legenda = [
      `🔥 ${nomeProduto || 'Produto em destaque'} chegou para ${objetivoTexto(dados.objetivo)}.`,
      dados.publico ? `Pensado para ${dados.publico}.` : '',
      dados.detalhes ? dados.detalhes : '',
      'Se você quer aproveitar essa oportunidade, chama agora e garante o seu.',
      hashtags || '#novidade #promocao #moda #esporte #loja'
    ]
      .filter(Boolean)
      .join('\n\n');

    const agenda = [
      `Melhor janela sugerida: ${dias.join(', ')}.`,
      `Horario ideal para o canal ${dados.canal}: ${horario}.`,
      `Data planejada: ${diaInformado}.`,
      'Sequencia recomendada: 1 post de impacto, 1 story com prova social e 1 lembrete com CTA.',
      `CTA sugerido: ${dados.objetivo === 'reserva' ? 'reserve agora pelo WhatsApp' : 'chama agora para garantir o seu'}.`
    ].join('\n');

    return { postPrincipal, legenda, agenda, hashtags };
  }

  function mostrarStatus(mensagem, tipo) {
    const status = $('statusMarketing');
    if (!status) {
      return;
    }

    status.textContent = mensagem;
    status.className = `marketing-status ${tipo === 'error' ? 'error' : ''}`.trim();
  }

  function salvarDraft() {
    try {
      const dados = {
        produto: lerValor('marketingProduto'),
        categoria: $('marketingCategoria')?.value || 'tenis',
        objetivo: $('marketingObjetivo')?.value || 'venda',
        canal: $('marketingCanal')?.value || 'instagram',
        publico: lerValor('marketingPublico'),
        tom: $('marketingTom')?.value || 'direto',
        data: $('marketingData')?.value || '',
        hora: $('marketingHora')?.value || '',
        detalhes: lerValor('marketingDetalhes'),
        atualizadoEm: new Date().toISOString()
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
    } catch (erro) {
      // armazenamento opcional
    }
  }

  function carregarDraft() {
    try {
      const bruto = localStorage.getItem(STORAGE_KEY);
      if (!bruto) {
        return;
      }

      const dados = JSON.parse(bruto);
      if (!dados || typeof dados !== 'object') {
        return;
      }

      if ($('marketingProduto')) $('marketingProduto').value = dados.produto || '';
      if ($('marketingCategoria')) $('marketingCategoria').value = dados.categoria || 'tenis';
      if ($('marketingObjetivo')) $('marketingObjetivo').value = dados.objetivo || 'venda';
      if ($('marketingCanal')) $('marketingCanal').value = dados.canal || 'instagram';
      if ($('marketingPublico')) $('marketingPublico').value = dados.publico || '';
      if ($('marketingTom')) $('marketingTom').value = dados.tom || 'direto';
      if ($('marketingData')) $('marketingData').value = dados.data || '';
      if ($('marketingHora')) $('marketingHora').value = dados.hora || '';
      if ($('marketingDetalhes')) $('marketingDetalhes').value = dados.detalhes || '';
    } catch (erro) {
      // armazenamento opcional
    }
  }

  function aplicarResultado(resultado) {
    const post = $('marketingPost');
    const legenda = $('marketingLegenda');
    const agenda = $('marketingAgenda');

    if (post) post.textContent = resultado.postPrincipal;
    if (legenda) legenda.textContent = resultado.legenda;
    if (agenda) agenda.textContent = resultado.agenda;
  }

  async function gerarConteudoMarketing() {
    const dados = {
      produto: lerValor('marketingProduto'),
      categoria: $('marketingCategoria')?.value || 'tenis',
      objetivo: $('marketingObjetivo')?.value || 'venda',
      canal: $('marketingCanal')?.value || 'instagram',
      publico: lerValor('marketingPublico'),
      tom: $('marketingTom')?.value || 'direto',
      data: $('marketingData')?.value || '',
      hora: $('marketingHora')?.value || '',
      detalhes: lerValor('marketingDetalhes')
    };

    if (!dados.produto) {
      mostrarStatus('Informe pelo menos o produto ou a campanha.', 'error');
      return;
    }

    if (!window.CONTROLE_SECAO_ADMIN) {
      const resultado = gerarConteudo(dados);
      aplicarResultado(resultado);
      salvarDraft();
      mostrarStatus('ChatGPT disponível apenas para o administrador. Conteúdo local gerado.', 'error');
      return;
    }

    salvarDraft();

    const configuracaoIA = obterConfiguracaoIA();

    if (configuracaoIA.enabled) {
      if (!configuracaoIA.apiKey) {
        const resultadoLocalSemChave = gerarConteudo(dados);
        aplicarResultado(resultadoLocalSemChave);
        mostrarStatus('ChatGPT está ativado, mas falta a chave da OpenAI. Conteúdo local gerado.', 'error');
        return;
      }

      mostrarStatus('Gerando com ChatGPT...', '');

      try {
        const resultadoChatGPT = await gerarConteudoComChatGPT(dados);
        aplicarResultado(resultadoChatGPT);
        mostrarStatus('Conteúdo gerado com ChatGPT.', 'ok');
        return;
      } catch (erro) {
        console.error('Erro ao gerar com ChatGPT:', erro);
        const resultadoLocal = gerarConteudo(dados);
        aplicarResultado(resultadoLocal);
        mostrarStatus(`ChatGPT indisponível. Conteúdo local gerado. ${erro.message || ''}`.trim(), 'error');
        return;
      }
    }

    const resultado = gerarConteudo(dados);
    aplicarResultado(resultado);
    mostrarStatus('Conteúdo de marketing gerado com sucesso.', 'ok');
  }

  async function copiarConteudoMarketing() {
    const texto = [
      $('marketingPost')?.textContent || '',
      $('marketingLegenda')?.textContent || '',
      $('marketingAgenda')?.textContent || ''
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(texto);
      mostrarStatus('Conteúdo copiado para a área de transferência.', 'ok');
    } catch (erro) {
      mostrarStatus('Não foi possível copiar automaticamente.', 'error');
    }
  }

  function preencherMarketingPadrao() {
    if ($('marketingProduto')) $('marketingProduto').value = 'Tênis Campus 00s';
    if ($('marketingCategoria')) $('marketingCategoria').value = 'tenis';
    if ($('marketingObjetivo')) $('marketingObjetivo').value = 'venda';
    if ($('marketingCanal')) $('marketingCanal').value = 'instagram';
    if ($('marketingPublico')) $('marketingPublico').value = 'jovens e clientes que curtem estilo urbano';
    if ($('marketingTom')) $('marketingTom').value = 'direto';
    if ($('marketingData')) $('marketingData').value = new Date().toISOString().slice(0, 10);
    if ($('marketingHora')) $('marketingHora').value = '19:30';
    if ($('marketingDetalhes')) $('marketingDetalhes').value = 'estoque limitado, destaque nos stories e CTA para chamar no WhatsApp';
    mostrarStatus('Exemplo preenchido. Clique em Gerar conteúdo.', 'ok');
  }

  function configurarAutoSave() {
    ['marketingProduto', 'marketingCategoria', 'marketingObjetivo', 'marketingCanal', 'marketingPublico', 'marketingTom', 'marketingData', 'marketingHora', 'marketingDetalhes']
      .forEach((id) => {
        const campo = $(id);
        if (!campo) {
          return;
        }

        campo.addEventListener('input', salvarDraft);
        campo.addEventListener('change', salvarDraft);
        campo.addEventListener('blur', salvarDraft);
      });
  }

  window.gerarConteudoMarketing = gerarConteudoMarketing;
  window.copiarConteudoMarketing = copiarConteudoMarketing;
  window.preencherMarketingPadrao = preencherMarketingPadrao;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      carregarConfiguracaoIA();
      carregarDraft();
      configurarIAListeners();
      configurarAutoSave();
      if (!$('marketingProduto')?.value) {
        preencherMarketingPadrao();
      } else {
        const dados = {
          produto: lerValor('marketingProduto'),
          categoria: $('marketingCategoria')?.value || 'tenis',
          objetivo: $('marketingObjetivo')?.value || 'venda',
          canal: $('marketingCanal')?.value || 'instagram',
          publico: lerValor('marketingPublico'),
          tom: $('marketingTom')?.value || 'direto',
          data: $('marketingData')?.value || '',
          hora: $('marketingHora')?.value || '',
          detalhes: lerValor('marketingDetalhes')
        };
        aplicarResultado(gerarConteudo(dados));
      }
    });
  } else {
    carregarConfiguracaoIA();
    carregarDraft();
    configurarIAListeners();
    configurarAutoSave();
    if (!$('marketingProduto')?.value) {
      preencherMarketingPadrao();
    } else {
      const dados = {
        produto: lerValor('marketingProduto'),
        categoria: $('marketingCategoria')?.value || 'tenis',
        objetivo: $('marketingObjetivo')?.value || 'venda',
        canal: $('marketingCanal')?.value || 'instagram',
        publico: lerValor('marketingPublico'),
        tom: $('marketingTom')?.value || 'direto',
        data: $('marketingData')?.value || '',
        hora: $('marketingHora')?.value || '',
        detalhes: lerValor('marketingDetalhes')
      };
      aplicarResultado(gerarConteudo(dados));
    }
  }
})();
