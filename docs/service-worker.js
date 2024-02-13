const CACHE_NAME = "v20240213";
const RESOURCES_TO_PRELOAD = [
  "assets/models/ggml-model-htdemucs-4s-f16.bin",
  "assets/models/ggml-model-htdemucs-6s-f16.bin"
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
  // Check if the request is for a .bin file
  if (event.request.url.endsWith('.bin')) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => response || fetch(event.request))
    );
  } else {
    // For non-.bin files, just fetch from the network
    event.respondWith(fetch(event.request));
  }
});
