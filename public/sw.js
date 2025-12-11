// Service Worker for Self PWA
// Version 11 - Simplified, no share-target interception (server handles it)
const CACHE_NAME = 'self-v11';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version 11');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Force immediate activation
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version 11');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch event handler
// DO NOT intercept share-target - let server handle it with waitUntil for background R2 upload
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // DO NOT intercept POST requests - let server handle them
  if (request.method !== 'GET') {
    return;
  }

  // DO NOT intercept API requests
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Skip non-http(s) schemes
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Only handle GET requests for static assets
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
