

const CACHE_NAME = 'bashar-growth-v6';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install Event: Cache core static shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
          console.warn('Precache warning:', err);
      });
    })
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Stale-While-Revalidate for assets, Network-Only for API
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests (like Google Fonts or Gemini API) for the cache first strategy
  // We can treat them as network-first or cache-first depending on need.
  // Here we only strictly handle same-origin assets for offline support.
  
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Strategy: Stale-While-Revalidate
  // 1. Return cached version immediately if available.
  // 2. Fetch network version in background and update cache.
  // This ensures the app loads instantly offline or on slow networks.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Only cache valid same-origin responses (scripts, css, images)
        // or specific CDNs like Tailwind if desired
        if (
          networkResponse.ok && 
          networkResponse.type === 'basic' // Same origin
        ) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => {
        // Network failed
      });

      return cachedResponse || fetchPromise;
    })
  );
});