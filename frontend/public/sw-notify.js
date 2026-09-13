/* Notificaciones del SO + precache ligero del shell (Fase 5 PWA).
 * No cachea API, Socket.IO ni LiveKit. */
const SHELL_CACHE = 'tacticalptx-shell-v1';
const SHELL_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/brand/tacticalptx.png',
  '/brand/tacticalptx_round.png',
];

function isShellRequest(url) {
  try {
    const u = new URL(url);
    if (u.origin !== self.location.origin) return false;
    const p = u.pathname;
    if (p.startsWith('/api') || p.startsWith('/socket.io') || p.includes('livekit')) return false;
    return true;
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all(
        SHELL_URLS.map(async (url) => {
          try {
            await cache.add(url);
          } catch {
            /* ignore missing asset in some hosts */
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('tacticalptx-shell-') && k !== SHELL_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = req.url;
  if (!isShellRequest(url)) return;

  // Navegación: red primero; si falla, offline shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(SHELL_CACHE);
          cache.put('/index.html', fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (
            (await cache.match('/offline.html')) ||
            (await cache.match('/index.html')) ||
            new Response('Sin red', { status: 503, headers: { 'Content-Type': 'text/plain' } })
          );
        }
      })()
    );
    return;
  }

  // Estáticos conocidos del precache: cache-first.
  const path = new URL(url).pathname;
  if (
    path === '/offline.html' ||
    path === '/manifest.webmanifest' ||
    path.startsWith('/brand/')
  ) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const fresh = await fetch(req);
          cache.put(req, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          return hit || Response.error();
        }
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
      return undefined;
    })
  );
});
