const CACHE_NAME = 'quest-academica-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './perguntas.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});