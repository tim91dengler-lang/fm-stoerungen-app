// Minimal Service Worker für FM-Störungen App.
// Strategie: network-first für API, cache-first für statische Assets.
// Bewusst minimal gehalten — keine Vorhersage über Inhalte, kein Push.

const CACHE_VERSION = 'fm-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_TIMEOUT_MS = 6000;

self.addEventListener('install', (event) => {
  // Vorab nur die App-Shell cachen
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll([
        '/',
        '/manifest.webmanifest',
        '/icons/icon-192.svg',
        '/icons/icon-512.svg',
        '/favicon.svg',
      ]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // API: network-first mit Timeout, niemals cachen (sensible Daten)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      Promise.race([
        fetch(req),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), API_TIMEOUT_MS)),
      ]).catch(() => new Response('Offline', { status: 503, statusText: 'Offline' })),
    );
    return;
  }

  // Sonst: cache-first, dann network, dann offline-fallback (index.html bei Navigation)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((resp) => {
          if (resp.ok && (req.destination === 'script' || req.destination === 'style' || req.destination === 'image' || req.destination === 'document')) {
            const respClone = resp.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, respClone));
          }
          return resp;
        })
        .catch(() => {
          if (req.mode === 'navigate') return caches.match('/');
          return new Response('Offline', { status: 503 });
        });
    }),
  );
});
