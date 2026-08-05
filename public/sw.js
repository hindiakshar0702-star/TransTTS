/*
 * TransTTS service worker — offline fallback + static runtime caching.
 *
 * Strategy:
 *  - Navigations: network-first; on failure serve the cached /offline.html.
 *  - Immutable static assets (/_next/static, precached shell): cache-first.
 *  - API/auth (/api/*) and non-GET: never intercepted (always live network) so
 *    auth/session and mutations are never served stale.
 */
const CACHE = "transtts-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/manifest.json", "/favicon.svg", "/logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // third-party: leave alone
  if (url.pathname.startsWith("/api/")) return; // auth/data: always network

  // Page navigations → network-first, offline page as the fallback.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Static assets → cache-first, then network (and cache immutable build output).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.ok && (url.pathname.startsWith("/_next/static") || PRECACHE.includes(url.pathname))) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
