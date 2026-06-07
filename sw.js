/* DugongID service worker — caches the app shell so it runs fully offline.
   User data lives in IndexedDB (not here) and is never uploaded. */
const CACHE = 'dugongid-v2';
const ASSETS = [
  './', './index.html', './css/style.css',
  './js/db.js', './js/matching.js', './js/annotator.js', './js/pdf.js', './js/app.js',
  './vendor/jspdf.umd.min.js', './manifest.webmanifest',
  './icons/favicon.svg', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // network-first for fonts; cache-first for everything else local
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      if (e.request.method === 'GET' && url.origin === location.origin) {
        const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => cached))
  );
});
