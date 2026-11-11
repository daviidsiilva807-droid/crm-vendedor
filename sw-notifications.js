// Service Worker para gerenciar notificações de reservas
const CACHE_NAME = 'controle-secao-v12';
const urlsCache = [
  '/',
  '/index.html',
  '/escolha.html',
  '/dashboard.html',
  '/vendas.html',
  '/calendario.html',
  '/agent.html',
  '/marketing.html',
  '/secao.html',
  '/clientes.html',
  '/admin.html',
  '/pdv-painel.html',
  '/pdv-novo-pedido.html',
  '/pdv-pedidos.html',
  '/cli-clientes.html',
  '/sec-area.html',
  '/app-shell.css',
  '/app-shell.js',
  '/app-data.js',
  '/pdv-data.js',
  '/pdv-shell.js',
  '/cli-data.js',
  '/cli-shell.js',
  '/sec-data.js',
  '/sec-shell.js',
  '/secao-escala.js',
  '/secao-mapa.js',
  '/secao-compartilhada.html',
  '/style.css',
  '/transitions.js',
  '/auth-db.js',
  '/notifications.js',
  '/lembretes.js',
  '/marketing-agent.js'
];

// Instalar service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cache aberto');
      return cache.addAll(urlsCache).catch(() => {
        console.log('Alguns arquivos não puderam ser cacheados');
      });
    })
  );
  self.skipWaiting();
});

// Ativar service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => {
            console.log('Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
  self.clients.claim();
});

// Interceptar requisicoes: rede primeiro, cache so como reserva.
// Assim uma atualizacao do site aparece na hora, e o app continua
// abrindo offline com a ultima versao que foi baixada.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copia = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        }

        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cacheado) => {
          if (cacheado) {
            return cacheado;
          }

          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }

          return new Response('Offline', { status: 503 });
        })
      )
  );
});

// Receber mensagens do cliente para gerenciar notificações
self.addEventListener('message', (event) => {
  if (event.data.tipo === 'limpar-notificacao') {
    const tag = `reserva-${event.data.reservaId}`;
    self.registration.getNotifications({ tag: tag }).then((notificacoes) => {
      notificacoes.forEach((notificacao) => {
        notificacao.close();
      });
    });
  }
});

// Gerenciar cliques em notificações
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Lembretes diarios (9h e 17h): abre a pagina indicada na notificacao
  const dados = event.notification.data;
  if (dados && dados.tipo === 'lembrete') {
    const destino = new URL(String(dados.destino || 'dashboard.html'), self.registration.scope);
    if (destino.origin !== self.location.origin) {
      return;
    }
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
        for (const client of lista) {
          if ('focus' in client && 'navigate' in client) {
            return client.focus().then(() => client.navigate(destino.href));
          }
        }
        return clients.openWindow ? clients.openWindow(destino.href) : undefined;
      })
    );
    return;
  }

  if (event.action === 'ver' || !event.action) {
    // Abrir a página de clientes
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // Procurar se já existe janela aberta
        for (let client of clientList) {
          if (client.url === '/clientes.html' && 'focus' in client) {
            return client.focus();
          }
        }
        // Se não existir, abrir nova janela
        if (clients.openWindow) {
          return clients.openWindow('/clientes.html');
        }
      })
    );
  }
});

// Fechar notificação
self.addEventListener('notificationclose', (event) => {
  console.log('Notificação fechada:', event.notification.tag);
});
