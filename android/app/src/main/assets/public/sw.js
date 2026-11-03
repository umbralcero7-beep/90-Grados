/**
 * Service Worker - 90 Grados POS PWA
 * Estrategia: Cache-first para assets inmutables, Network-first para navegación y fallback offline.
 * Permite que los terminales de meseros y la estación de caja carguen la interfaz aunque no haya conexión a Internet.
 */

const CACHE_NAME = 'grados-pos-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/assets/aistudio/FullLogo_dd4cd38a.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Precarga parcial de assets en Service Worker:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // No interceptar llamadas a la API local (/api/*) ni llamadas externas HTTP
  if (request.url.includes('/api/') || request.method !== 'GET') {
    return;
  }

  // Para navegación HTML: Network-first con fallback a cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // Para assets estáticos: Cache-first con actualización en background (Stale-While-Revalidate)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // En background actualizar cache si hay red
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      });
    })
  );
});
