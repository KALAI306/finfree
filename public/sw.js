const CACHE_NAME = "finfree-cache-v3";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Navigation (HTML pages) → always network, fallback to cache
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Static assets (/assets/) → cache-first
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            cache.put(request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // Everything else → network-first
  e.respondWith(fetch(request).catch(() => caches.match(request)));
});
