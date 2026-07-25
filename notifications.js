// Gerenciador de Notificações para Reservas
class NotificacaoReserva {
  constructor() {
    this.NOTIFICACOES_STORAGE_KEY = 'controleSecao_notificacoes_agendadas_v1';
    this.inicializar();
  }

  // Inicializar serviço de notificações
  inicializar() {
    // Registrar service worker se suportado
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw-notifications.js').catch(err => {
        console.log('Service Worker não foi registrado:', err);
      });
    }

    // Carregar e reagendar notificações agendadas
    this.reagendarNotificacoes();
  }

  // Solicitar permissão de notificações
  solicitarPermissao() {
    return new Promise((resolve) => {
      if (!('Notification' in window)) {
        console.log('Notificações não suportadas neste navegador');
        resolve(false);
        return;
      }

      if (Notification.permission === 'granted') {
        resolve(true);
        return;
      }

      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          resolve(permission === 'granted');
        });
      } else {
        resolve(false);
      }
    });
  }

  // Agendar notificação para uma reserva
  agendar(reserva) {
    if (!reserva.notificacao || !reserva.data) {
      return;
    }

    const dataReserva = new Date(`${reserva.data}T00:00:00`);
    const agora = new Date();

    // Se a data já passou, não agenda
    if (dataReserva <= agora) {
      return;
    }

    const tempoAte = dataReserva.getTime() - agora.getTime();

    // Armazenar informação de notificação agendada
    this.salvarNotificacaoAgendada({
      reservaId: reserva.id,
      nomeCliente: reserva.nomeCliente,
      produto: reserva.produto,
      tamanho: reserva.tamanho,
      data: reserva.data,
      tempoAgendado: new Date().toISOString()
    });

    // Agendar no navegador
    setTimeout(() => {
      this.exibir(reserva);
    }, tempoAte);
  }

  // Exibir notificação
  exibir(reserva) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      console.log('Permissão de notificação não concedida');
      return;
    }

    const titulo = '🔔 Lembrete de Reserva';
    const opcoes = {
      body: `${reserva.nomeCliente}\n${reserva.produto} - Tamanho: ${reserva.tamanho}`,
      icon: 'img/icon-192.png',
      badge: 'img/icon-192.png',
      tag: `reserva-${reserva.id}`,
      requireInteraction: true,
      actions: [
        {
          action: 'ver',
          title: 'Ver Reserva'
        },
        {
          action: 'fechar',
          title: 'Fechar'
        }
      ]
    };

    try {
      const notificacao = new Notification(titulo, opcoes);

      notificacao.onclick = () => {
        window.location.href = 'clientes.html';
        notificacao.close();
      };
    } catch (err) {
      console.error('Erro ao exibir notificação:', err);
    }
  }

  // Salvar notificação agendada no storage
  salvarNotificacaoAgendada(notificacao) {
    try {
      const notificacoes = this.lerNotificacoesAgendadas();
      
      // Verificar se já existe notificação para esta reserva
      const indice = notificacoes.findIndex(n => n.reservaId === notificacao.reservaId);
      if (indice >= 0) {
        notificacoes[indice] = notificacao;
      } else {
        notificacoes.push(notificacao);
      }

      localStorage.setItem(this.NOTIFICACOES_STORAGE_KEY, JSON.stringify(notificacoes));
    } catch (err) {
      console.error('Erro ao salvar notificação agendada:', err);
    }
  }

  // Ler notificações agendadas do storage
  lerNotificacoesAgendadas() {
    try {
      const dados = localStorage.getItem(this.NOTIFICACOES_STORAGE_KEY);
      return dados ? JSON.parse(dados) : [];
    } catch (err) {
      return [];
    }
  }

  // Remover notificação agendada
  removerNotificacaoAgendada(reservaId) {
    try {
      const notificacoes = this.lerNotificacoesAgendadas();
      const filtradas = notificacoes.filter(n => n.reservaId !== reservaId);
      localStorage.setItem(this.NOTIFICACOES_STORAGE_KEY, JSON.stringify(filtradas));
    } catch (err) {
      console.error('Erro ao remover notificação agendada:', err);
    }
  }

  // Reagendar todas as notificações pendentes
  reagendarNotificacoes() {
    // Solicitar permissão primeiro
    this.solicitarPermissao();
  }

  // Limpar notificação de uma reserva
  limpar(reservaId) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.controller?.postMessage({
        tipo: 'limpar-notificacao',
        reservaId: reservaId
      });
    }

    this.removerNotificacaoAgendada(reservaId);

    if ('Notification' in window) {
      Notification.close?.(`reserva-${reservaId}`);
    }
  }
}

// Instanciar gerenciador global
const gerenciadorNotificacoes = new NotificacaoReserva();
