(function () {
  const STORAGE_KEY = 'controleSecao_marketing_draft_v1';

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

  function gerarConteudoMarketing() {
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

    const resultado = gerarConteudo(dados);
    aplicarResultado(resultado);
    salvarDraft();
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
      carregarDraft();
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
    carregarDraft();
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
