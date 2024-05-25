const CACHE_NAME = "v20240507";
const RESOURCES_TO_PRELOAD = [
  "https://bucket.freemusicdemixer.com/ggml-model-htdemucs-4s-f16.bin",
];

// Pre-cache resources
const addResourcesToCache = async (resources) => {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(resources);
};

// The install event fires when the Service Worker is initially registered
self.addEventListener("install", (event) => {
  event.waitUntil(addResourcesToCache(RESOURCES_TO_PRELOAD));
  // Force the waiting Service Worker to become the active Service Worker
  self.skipWaiting();
});

// The activate event is fired when the Service Worker starts up
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Check if the request is for a .bin file from the external resource
  if (event.request.url.startsWith("https://bucket.freemusicdemixer.com/") &&
      event.request.url.endsWith('.bin')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(response => {
          if (response) {
            // Return the cached response if found
            return response;
          }
          // Otherwise fetch from the network, cache the response, and return it
          return fetch(event.request).then(networkResponse => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
  } else {
    // For non-.bin files or requests not to the specific domain, just fetch from the network
    event.respondWith(fetch(event.request));
  }
});
