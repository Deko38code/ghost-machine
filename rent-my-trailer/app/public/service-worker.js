const CACHE_NAME = "rmt-static-v2";

self.addEventListener("install", (event) => {
  const precache = caches.open(CACHE_NAME).then((cache) =>
    cache.addAll([
      "/",
      "/index.html",
      "/manifest.webmanifest",
      "/logo.png",
      "/favicon.ico",
      "/favicon.svg",
    ])
  );
  event.waitUntil(precache);
});

self.addEventListener("activate", (event) => {
  const dropOld = caches.keys().then((keys) => Promise.all(keys.map((key) => {
    if (key !== CACHE_NAME) return caches.delete(key);
    return Promise.resolve();
  })));
  event.waitUntil(dropOld);
});

function isHashedAsset(url) {
  return url.pathname.startsWith("/assets/") || url.pathname.endsWith(".woff2") || url.pathname.endsWith(".woff");
}

function isImageAsset(url) {
  return [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".ico"].some((ext) => url.pathname.endsWith(ext));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Avoid caching cross-origin payloads from this service worker.
  if (url.origin !== self.location.origin) return;

  // Hashed build assets and cached media are the cheap wins.
  if (isHashedAsset(url) || isImageAsset(url)) {
    event.respondWith(caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    }));
    return;
  }

  // HTML navigation: go to the network first so a fresh build wins when online.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    }).catch(() => caches.match(request).then((cached) => cached || caches.match("/index.html"))));
    return;
  }

  // APIs: network first, cache fallback, without silently masking hard failures.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).then((response) => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    }).catch(() => caches.match(request).then((cached) => cached || new Response(JSON.stringify({ error: "offline" }), { status: 503, headers: { "content-type": "application/json" } }))));
    return;
  }

  // Other same-origin GETs: cache first, with a network refresh on misses.
  event.respondWith(caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    }).catch(() => cached);
  }));
});
