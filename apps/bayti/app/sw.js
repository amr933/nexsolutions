/* Bayti — service worker (offline cache for the web/PWA build)
   IMPORTANT: bump VERSION on every release. The PWA on iPhone auto-reloads
   when the version changes, so web and Android stay on the same release. */
const VERSION = "1.0.9";
const CACHE = "bayti-v" + VERSION;
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

let IS_UPGRADE = false;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      IS_UPGRADE = keys.some((k) => k.startsWith("bayti-v") && k !== CACHE);
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE.map((url) => new Request(url, { cache: "reload" }))).catch(() => undefined);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
      // only an actual upgrade reloads open tabs — a first install must not
      if (!IS_UPGRADE) return;
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        try {
          client.postMessage({ type: "BAYTI_UPDATED", version: VERSION });
        } catch {
          /* client may be gone */
        }
      }
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data && event.data.type === "GET_VERSION" && event.source) {
    event.source.postMessage({ type: "BAYTI_VERSION", version: VERSION });
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // never serve the worker or a fresh install page from cache
  if (url.pathname.endsWith("/sw.js")) {
    event.respondWith(fetch(req, { cache: "no-store" }).catch(() => caches.match(req)));
    return;
  }

  // navigation: always try the network first (bypassing the HTTP cache)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy)).catch(() => undefined);
          return res;
        })
        .catch(() =>
          caches.match("./index.html", { ignoreSearch: true }).then(
            (r) =>
              r ||
              caches.match("./") ||
              new Response("<h1 dir=\"rtl\">بيتي غير متاح بدون إنترنت في أول تشغيل</h1>", {
                headers: { "Content-Type": "text/html; charset=utf-8" },
              }),
          ),
        ),
    );
    return;
  }

  // assets: cache-first, refresh in the background (hashed names change per build)
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
