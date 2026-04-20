/* ============================================================
 *  RISTOAPP Service Worker
 *  Cache-first per gli asset statici, network-first per tutto
 *  il resto. Aggiornare CACHE_NAME ad ogni rilascio per forzare
 *  il refresh degli utenti.
 * ============================================================ */

const CACHE_NAME = 'ristoapp-v3.0.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/data.js',
  './js/store.js',
  './js/owner.js',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Google Fonts: network-first, cache fallback
  if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, clone));
        return resp;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // Asset same-origin: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, clone));
        return resp;
      }).catch(() => caches.match('./index.html')))
    );
  }
});
