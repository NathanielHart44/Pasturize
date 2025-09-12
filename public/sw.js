/* Simple offline-first service worker for Pasturize */
const CACHE_NAME = 'pasturize-cache-v1';
const ASSET_CACHE = [
  '/',
  '/favicon.svg',
  '/site.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSET_CACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Cache-first for same-origin GET requests (except for navigation to Next routes which will be handled and then cached)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // only same-origin

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          // Cache a clone of successful responses
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const respClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

