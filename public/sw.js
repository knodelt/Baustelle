const CACHE_VERSION = 'bt-v1.1.1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/offline.html',
  '/manifest.webmanifest',
  '/js/config.js',
  '/js/state.js',
  '/js/economy.js',
  '/js/jobs.js',
  '/js/inventory.js',
  '/js/storage.js',
  '/js/api.js',
  '/js/timers.js',
  '/js/ui.js',
  '/js/scene.js',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-256.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-maskable-512.png',
  '/assets/ui/logo-mark.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({
      ok: false,
      error: 'Offline – Cloud-Synchronisierung wird später erneut versucht.'
    }), { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } })));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(async () => (await caches.match('/index.html')) || caches.match('/offline.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
      return response;
    }))
  );
});
