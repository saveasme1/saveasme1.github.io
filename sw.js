/* Heritage PWA — offline shell + image runtime cache + status events */
const CACHE_VERSION = "hx-pwa-v20260809-gbcal13";
const RUNTIME_CACHE = "hx-pwa-runtime-images-v3";
const OFFLINE_FALLBACK = "./landing.html";
const MAX_RUNTIME_IMAGES = 640;

const PRECACHE = [
  "./",
  "./index.html",
  "./landing.html",
  "./groupbuy.html",
  "./mypage.html",
  "./portfolio.html",
  "./discover.html",
  "./shipping.html",
  "./reviews.html",
  "./opening-event.html",
  "./search.html",
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
  "./search.css",
  "./pwa-app.css",
  "./groupbuy-calendar.css",
  "./groupbuy-calendar.js",
  "./pwa-home.js",
  "./hx-store.js",
  "./hx-catalog.js",
  "./hx-discover.js",
  "./hx-content.js",
  "./hx-today.js",
  "./hx-extras.js",
  "./hx-wear-feed.js",
  "./hx-ig-wear.json",
  "./wear-media/posts/B1zGjVmC8u0.jpg",
  "./wear-media/posts/B393bYVi0Ii.jpg",
  "./wear-media/posts/C2h9nXDs972.jpg",
  "./wear-media/posts/C5Bw6EPOD70.jpg",
  "./wear-media/posts/C8m-0pUgVnY.jpg",
  "./wear-media/posts/CBUUgKTBLgg.jpg",
  "./wear-media/posts/Cd4tyCQLkhz.jpg",
  "./wear-media/posts/CGkjqZel3u3.jpg",
  "./wear-media/posts/CiNz8yhPg8o.jpg",
  "./wear-media/posts/ClmW0EuSzbh.jpg",
  "./wear-media/posts/CSyf-LxAFTl.jpg",
  "./wear-media/posts/CUSmAQTNB1t.jpg",
  "./wear-media/posts/Cv3ZV14pW2o.jpg",
  "./wear-media/posts/Cwp9yQxSQzL.jpg",
  "./wear-media/posts/CxIzX67BUqb.jpg",
  "./wear-media/posts/CyiMtmbMQBx.jpg",
  "./wear-media/posts/DB3yCDYvD-g.jpg",
  "./wear-media/posts/DBa6yn6NWf8.jpg",
  "./wear-media/posts/DBq__HIxzK9.jpg",
  "./wear-media/posts/DCes6ltx8_s.jpg",
  "./wear-media/posts/DFfm1RIKtw1.jpg",
  "./wear-media/posts/DHdHQnjJyYt.jpg",
  "./wear-media/posts/DJHYneyxWak.jpg",
  "./wear-media/posts/DTvXe_OjHFH.jpg",
  "./wear-media/b-serp.png",
  "./wear-media/c-clou-2.jpg",
  "./wear-media/c-clou.jpg",
  "./wear-media/c-love-close.jpg",
  "./wear-media/c-love-stack.jpg",
  "./wear-media/c-love3.jpg",
  "./wear-media/c-monica-love.jpg",
  "./wear-media/c-monica.jpg",
  "./wear-media/cl-brace.jpg",
  "./wear-media/cl-crush.jpg",
  "./wear-media/cl-crush2.jpg",
  "./wear-media/cl-ear.jpg",
  "./wear-media/cl-gracie-li.jpg",
  "./wear-media/cl-gracie1.jpg",
  "./wear-media/cl-gracie2.jpg",
  "./wear-media/cl-gracie3.jpg",
  "./wear-media/cl-neck.png",
  "./wear-media/h-clic.png",
  "./wear-media/tc-lock.jpg",
  "./wear-media/vca-1.jpg",
  "./wear-media/vca-2.jpg",
  "./wear-media/www-love.jpg",
  "./wear-media/www-love2.jpg",
  "./hx-lifestyle.css",
  "./discover.html",
  "./hx-diamond-rules.json",
  "./hx-external-sources.json",
  "./hx-youtube-curated.json",
  "./site-nav.js",
  "./gongbang-auth.js",
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
  "./search.js",
  "./pwa-register.js",
  "./tryon-overlay.js",
  "./shipping-data.json",
  "./portfolio-data.json",
  "./notices-data.json",
  "./reviews-data.json",
  "./home-media/look-1.jpg",
  "./home-media/look-2.jpg",
  "./home-media/look-3.jpg",
  "./home-media/look-4.jpg",
  "./home-media/look-5.jpg",
  "./home-media/look-6.jpg",
  "./home-media/story-1.jpg",
  "./home-media/story-2.jpg",
  "./home-media/gold-bg.jpg",
  "./home-media/atelier.jpg",
  "./heritage-gold/",
];

const CDN_PRECACHE = [
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css",
  "https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/static/woff2/SUIT.css",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js",
];

function broadcast(message) {
  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => client.postMessage(message));
  });
}

async function precacheAll() {
  const cache = await caches.open(CACHE_VERSION);
  let urls = PRECACHE.concat(CDN_PRECACHE);

  // Cover thumbs for offline grid (seed only ??details stay runtime-cached)
  try {
    const seedRes = await fetch("./portfolio-data.json", { cache: "reload" });
    if (seedRes.ok) {
      const data = await seedRes.json();
      const covers = (data.items || [])
        .map((item) => item && item.image)
        .filter((src) => typeof src === "string" && src.length > 0)
        .map((src) => (src.startsWith("http") ? src : "./" + src.replace(/^\.\//, "")));
      // All cover thumbs ??detail shots stay runtime-cached when opened
      urls = urls.concat(covers);
    }
  } catch (_) {}

  let done = 0;
  broadcast({ type: "PWA_STATUS", state: "updating", total: urls.length, done: 0 });

  for (const url of urls) {
    try {
      const req = new Request(url, { cache: "reload", mode: "cors", credentials: "omit" });
      const res = await fetch(req);
      if (res && (res.ok || res.type === "opaque")) {
        await cache.put(url, res.clone());
        try {
          const u = new URL(url, self.location.href);
          if (u.origin === self.location.origin) {
            await cache.put(u.origin + u.pathname, res.clone());
          }
        } catch (_) {}
        if (isImageRequest(req, new URL(url, self.location.href))) {
          await putRuntimeImage(req, res);
        }
      }
    } catch (_) {}
    done += 1;
    if (done % 4 === 0 || done === urls.length) {
      broadcast({ type: "PWA_STATUS", state: "updating", total: urls.length, done });
    }
  }
  broadcast({ type: "PWA_STATUS", state: "ready", total: urls.length, done });
}

self.addEventListener("install", (event) => {
  // Activate immediately so MO/TB PWA stops serving stale HTML/JS shells.
  event.waitUntil(precacheAll().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION && k !== RUNTIME_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() => broadcast({ type: "PWA_STATUS", state: "activated" }))
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") self.skipWaiting();
  if (data.type === "GET_STATUS") {
    event.source &&
      event.source.postMessage({
        type: "PWA_STATUS",
        state: navigator.onLine === false ? "offline" : "ready",
      });
  }
});

function isApiHost(hostname) {
  return /app\.0-1\.co\.kr|nager\.at/i.test(hostname);
}

function isCdnHost(hostname) {
  return /cdn\.jsdelivr\.net/i.test(hostname);
}

function isImageRequest(req, url) {
  if (req.destination === "image") return true;
  return /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(url.pathname);
}

function offlineImageResponse() {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">' +
    '<rect width="640" height="640" fill="#2a2724"/>' +
    '<text x="320" y="300" text-anchor="middle" fill="#c4bdb4" font-family="sans-serif" font-size="28">오프라인</text>' +
    '<text x="320" y="348" text-anchor="middle" fill="#8a837b" font-family="sans-serif" font-size="20">아직 캐시되지 않은 이미지</text>' +
    "</svg>";
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function matchIgnoringSearch(request) {
  const direct = await caches.match(request);
  if (direct) return direct;

  const url = new URL(request.url);
  const bare = url.origin + url.pathname;
  const hitBare = await caches.match(bare);
  if (hitBare) return hitBare;

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

  if (isImageRequest(request, url)) {
    const runtime = await caches.open(RUNTIME_CACHE);
    const rHit = (await runtime.match(request)) || (await runtime.match(bare));
    if (rHit) return rHit;
  }
  return null;
}

async function putRuntimeImage(request, response) {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
    const url = new URL(request.url);
    await cache.put(url.origin + url.pathname, response.clone());
    const keys = await cache.keys();
    if (keys.length > MAX_RUNTIME_IMAGES) {
      await cache.delete(keys[0]);
    }
  } catch (_) {}
}

async function offlineShell() {
  return (
    (await caches.match(OFFLINE_FALLBACK)) ||
    (await caches.match("./landing.html")) ||
    (await caches.match("./offline.html")) ||
    new Response(
      "<!doctype html><meta charset=utf-8><title>오프라인</title><body style='font-family:sans-serif;padding:24px;background:#161513;color:#fff'><h1>오프라인</h1><p>와이파이에서 앱을 다시 열어 데이터를 준비해 주세요.</p></body>",
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
                caches.open(CACHE_VERSION).then((c) => c.put(req, res.clone()));
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
            caches.open(CACHE_VERSION).then((c) => {
              c.put(req, res.clone());
              c.put(url.origin + url.pathname, res.clone());
            });
          }
          return res;
        })
        .catch(() => matchIgnoringSearch(req).then((hit) => hit || offlineShell()))
    );
    return;
  }

  // HTML / JS / CSS must be network-first — stale SW cache was killing 가격추세.
  if (/\.(html?|js|css|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => {
          if (res && res.ok) {
            caches.open(CACHE_VERSION).then((c) => {
              c.put(req, res.clone());
              c.put(url.origin + url.pathname, res.clone());
            });
          }
          return res;
        })
        .catch(() => matchIgnoringSearch(req))
    );
    return;
  }

  // Always network for build manifest ??never serve stale update info
  if (/\/app-build\.json$/i.test(url.pathname)) {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => res)
        .catch(() => matchIgnoringSearch(req))
    );
    return;
  }

  // Portfolio catalog ??prefer fresh JSON, fall back to cache offline
  if (/\/portfolio-data\.json$/i.test(url.pathname)) {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => {
              c.put(url.origin + url.pathname, copy);
            });
          }
          return res;
        })
        .catch(() => matchIgnoringSearch(req))
    );
    return;
  }

  const image = isImageRequest(req, url);

  event.respondWith(
    matchIgnoringSearch(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            if (image) putRuntimeImage(req, res);
            else {
              caches.open(CACHE_VERSION).then((c) => {
                c.put(req, res.clone());
                if (url.search) c.put(url.origin + url.pathname, res.clone());
              });
            }
            return res;
          }
          // Avoid serving HTML/404 as an <img> ???〓컯
          if (image) return cached || offlineImageResponse();
          return res;
        })
        .catch(() => {
          if (cached) return cached;
          if (image) return offlineImageResponse();
          return cached;
        });

      if (cached) {
        network.catch(() => {});
        return cached;
      }
      return network.then((res) => {
        if (res && (res.ok || res.type === "opaque")) return res;
        if (image) return offlineImageResponse();
        return caches.match(OFFLINE_FALLBACK);
      });
    })
  );
});
