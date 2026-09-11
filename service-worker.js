const CACHE_NAME = 'boo-runner-v12-1';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css?v=120',
  './game.js?v=120',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/boo-game.png',
  './assets/maltese-game.png',
  './assets/boo-run-sheet-v10.png',
  './assets/maltese-run-sheet.png',
  './assets/boo-duck-game.png',
  './assets/maltese-duck-game.png',
  './assets/boo-float-sheet-v8.png',
  './assets/maltese-float-sheet-v8.png',
  './assets/professor-fight-sheet-v10.png',
  './assets/professors-v8.png',
  './assets/sch-villas-v8.png',
  './assets/backgrounds/osan-panorama-v7.png',
  './assets/backgrounds/dongtan-panorama-v7.png',
  './assets/backgrounds/sch-panorama-v8.png',
  './assets/backgrounds/gwangjin-panorama-v7.png',
  './assets/backgrounds/space-panorama-v8.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }))
  );
});
