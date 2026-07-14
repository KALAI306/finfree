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

// Daily summary notification scheduling via message from main thread
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SCHEDULE_SUMMARY") {
    const { title, body, delayMs } = e.data;
    if (delayMs > 0) {
      setTimeout(() => {
        self.registration.showNotification(title, {
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: "daily-summary",
          data: { route: "/" },
        });
      }, delayMs);
    }
  }
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const route = e.notification.data?.route || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(route);
          return;
        }
      }
      return self.clients.openWindow(route);
    })
  );
});
