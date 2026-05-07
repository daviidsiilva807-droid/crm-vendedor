// Service Worker para gerenciar notificações de reservas
const CACHE_NAME = 'controle-secao-v4';
const urlsCache = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/clientes.html',
  '/style.css',
  '/transitions.js',
  '/auth-db.js',
  '/notifications.js',
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

// Interceptar requisições
self.addEventListener('fetch', (event) => {
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          return response;
        }

        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      }).catch(() => {
        // Fallback para página offline se necessário
        return new Response('Offline', { status: 503 });
      })
    );
  }
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
