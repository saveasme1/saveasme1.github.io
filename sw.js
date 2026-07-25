/* 본 헤리티지 PWA service worker — offline-first shell */
const CACHE_VERSION = "hx-pwa-v20260725-offline2";
const OFFLINE_FALLBACK = "./landing.html";

const PRECACHE = [
  "./",
  "./index.html",
  "./landing.html",
  "./mypage.html",
  "./portfolio.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./sw.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./landing.css",
  "./portfolio-board.css",
  "./handmade-reviews.css",
  "./site-nav.css",
  "./mypage.css",
  "./boards.css",
  "./tryon-overlay.css",
  "./price-trend-panel.css",
  "./site-nav.js",
  "./brand-codes.js",
  "./brand-codes.json",
  "./portfolio-board.js",
  "./price-trend-panel.js",
  "./shipping-board.js",
  "./landing-boards.js",
  "./handmade-reviews.js",
  "./board-meta.js",
  "./html-editor.js",
  "./time-kr.js",
  "./mypage.js",
  "./pwa-register.js",
  "./tryon-overlay.js",
  "./shipping-data.json",
  "./portfolio-data.json",
  "./notices-data.json",
  "./reviews-data.json",
];

const CDN_PRECACHE = [
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css",
  "https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/static/woff2/SUIT.css",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js",
];

async function precacheAll() {
  const cache = await caches.open(CACHE_VERSION);
  const urls = PRECACHE.concat(CDN_PRECACHE);
  await Promise.all(
    urls.map(async (url) => {
      try {
        const req = new Request(url, { cache: "reload", mode: "cors", credentials: "omit" });
        const res = await fetch(req);
        if (res && (res.ok || res.type === "opaque")) {
          await cache.put(url, res);
        }
      } catch (_) {
        /* one miss must not abort the whole install */
      }
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAll().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isApiHost(hostname) {
  return /app\.0-1\.co\.kr|nager\.at/i.test(hostname);
}

function isCdnHost(hostname) {
  return /cdn\.jsdelivr\.net/i.test(hostname);
}

async function matchIgnoringSearch(request) {
  const direct = await caches.match(request);
  if (direct) return direct;

  const url = new URL(request.url);
  if (url.search) {
    const bare = url.origin + url.pathname;
    const hit = await caches.match(bare);
    if (hit) return hit;
  }

  const cache = await caches.open(CACHE_VERSION);
  const keys = await cache.keys();
  const path = url.pathname.replace(/\/+$/, "") || "/";
  for (const key of keys) {
    try {
      const k = new URL(key.url);
      const kp = k.pathname.replace(/\/+$/, "") || "/";
      if (kp === path || kp === url.pathname) {
        const hit = await cache.match(key);
        if (hit) return hit;
      }
    } catch (_) {}
  }
  return null;
}

async function offlineShell() {
  return (
    (await caches.match(OFFLINE_FALLBACK)) ||
    (await caches.match("./landing.html")) ||
    (await caches.match("./offline.html")) ||
    (await caches.match("./index.html")) ||
    new Response(
      "<!doctype html><meta charset=utf-8><title>오프라인</title><body style='font-family:sans-serif;padding:24px'><h1>오프라인</h1><p>네트워크 연결 후 앱을 한 번 열어 주세요.</p></body>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    )
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    if (isApiHost(url.hostname)) return;
    if (isCdnHost(url.hostname)) {
      event.respondWith(
        matchIgnoringSearch(req).then((cached) => {
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
    }
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => {
              c.put(req, copy);
              try {
                const u = new URL(req.url);
                c.put(u.origin + u.pathname, res.clone());
              } catch (_) {}
            });
          }
          return res;
        })
        .catch(() => matchIgnoringSearch(req).then((hit) => hit || offlineShell()))
    );
    return;
  }

  event.respondWith(
    matchIgnoringSearch(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => {
              c.put(req, copy);
              try {
                const u = new URL(req.url);
                if (u.search) c.put(u.origin + u.pathname, res.clone());
              } catch (_) {}
            });
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
