/* ============================================================
 *  RISTOAPP Service Worker (v5.3)
 *  - App (stesso sito): network-first con la cache come riserva offline.
 *  - Dati OSM (data/tiles, data/places, data/parking): cache separata
 *    con limite di voci (le piu' vecchie vengono eliminate: LRU).
 *  - Aggiornamenti: la nuova versione NON si attiva da sola se c'e'
 *    gia' una versione in uso. La pagina decide quando (nessun modulo
 *    aperto) e invia { type: 'SKIP_WAITING' }; altrimenti mostra
 *    "Aggiornamento disponibile - Aggiorna".
 *  Aggiornare CACHE_NAME ad ogni rilascio.
 * ============================================================ */

const CACHE_NAME = 'ristoapp-v5.3.0';
const DATA_CACHE = 'ristoapp-data-v1';     // sopravvive ai rilasci (dati settimanali)
const DATA_MAX_ENTRIES = 300;
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './css/fonts.css',
  './js/app.js',
  './js/i18n.js',
  './js/i18n-trust.js',
  './js/i18n-legal.js',
  './js/i18n-v53.js',
  './js/data.js',
  './js/store.js',
  './js/trust.js',
  './js/owner.js',
  './fonts/dm-sans-latin-400-normal.woff2',
  './fonts/fraunces-latin-600-normal.woff2',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
      // Primo avvio (nessuna versione attiva): si attiva subito.
      // Aggiornamento: resta in attesa finche' la pagina non lo chiede.
      .then(() => { if (!self.registration.active) return self.skipWaiting(); })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== DATA_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Limita la cache dei dati: le chiavi sono in ordine di inserimento, e ogni
// risposta nuova (o usata dalla cache) viene reinserita in fondo -> LRU.
// Le operazioni sono messe in fila, cosi' il limite vale anche con molte
// richieste in parallelo.
let dataQueue = Promise.resolve();
function queueData(op) {
  dataQueue = dataQueue.then(op).catch(() => {});
  return dataQueue;
}
async function trimDataCache(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - DATA_MAX_ENTRIES; i++) await cache.delete(keys[i]);
}
function putData(request, resp) {
  return queueData(async () => {
    const cache = await caches.open(DATA_CACHE);
    await cache.delete(request, { ignoreSearch: true });
    await cache.put(request, resp);
    await trimDataCache(cache);
  });
}
function touchData(request, hit) {
  return putData(request, hit);   // spostala in fondo (usata di recente)
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // API esterne: rete diretta

  // Dati OSM pre-calcolati: rete prima (aggiornati ogni settimana), cache LRU limitata
  if (/\/data\/(tiles|places|parking)\//.test(url.pathname)) {
    event.respondWith(
      fetch(request).then(resp => {
        if (resp.ok) { const clone = resp.clone(); event.waitUntil(putData(request, clone)); }
        return resp;
      }).catch(() => caches.open(DATA_CACHE).then(c => c.match(request, { ignoreSearch: true })).then(hit => {
        if (hit) { event.waitUntil(touchData(request, hit.clone())); return hit; }
        return Response.error();
      }))
    );
    return;
  }

  // Asset dell'app: network-first (cache: 'no-cache' = chiede sempre al
  // server se il file e' cambiato), con la cache come riserva offline.
  event.respondWith(
    fetch(request, { cache: 'no-cache' }).then(resp => {
      if (resp.ok) {
        const clone = resp.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(c => c.put(request, clone)).catch(() => {}));
      }
      return resp;
    }).catch(() => caches.match(request, { ignoreSearch: true }).then(c => c || (request.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
