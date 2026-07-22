/* Heritage PWA service worker — relative paths for GitHub Pages */
const CACHE_VERSION = "hx-pwa-v1";
const PRECACHE = [
  "./",
  "./index.html",
  "./landing.html",
  "./mypage.html",
  "./portfolio.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./landing.css",
  "./portfolio-board.css",
  "./handmade-reviews.css",
  "./site-nav.css",
  "./mypage.css",
  "./boards.css",
  "./site-nav.js",
  "./portfolio-board.js",
  "./shipping-board.js",
  "./landing-boards.js",
  "./handmade-reviews.js",
  "./board-meta.js",
  "./html-editor.js",
  "./time-kr.js",
  "./mypage.js",
  "./pwa-register.js",
  "./shipping-data.json",
  "./portfolio-data.json",
  "./notices-data.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return /app\.0-1\.co\.kr|nager\.at|cdn\.jsdelivr\.net/i.test(url.hostname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    if (isApiRequest(url)) return; // network only for APIs/CDNs
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => {
          const cached =
            (await caches.match(req)) ||
            (await caches.match("./landing.html")) ||
            (await caches.match("./index.html"));
          return cached || new Response("Offline", { status: 503, statusText: "Offline" });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
