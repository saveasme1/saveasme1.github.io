(() => {
  "use strict";

  function isPwaMode() {
    try {
      if (window.matchMedia("(display-mode: standalone)").matches) return true;
      if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
      if (window.matchMedia("(display-mode: minimal-ui)").matches) return true;
    } catch (_) {}
    if (window.navigator.standalone === true) return true;
    if (/[?&]app=1(?:&|$)/.test(location.search)) return true;
    return false;
  }

  if (!isPwaMode()) return;
  if (!/\/landing\.html$/i.test(location.pathname) && !document.querySelector(".landing")) return;

  document.documentElement.classList.add("is-pwa");
  if (document.body) document.body.classList.add("is-pwa");

  if (!document.getElementById("pwaBrandFont")) {
    const pre = document.createElement("link");
    pre.rel = "preconnect";
    pre.href = "https://fonts.googleapis.com";
    const pre2 = document.createElement("link");
    pre2.rel = "preconnect";
    pre2.href = "https://fonts.gstatic.com";
    pre2.crossOrigin = "anonymous";
    const font = document.createElement("link");
    font.id = "pwaBrandFont";
    font.rel = "stylesheet";
    font.href =
      "https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700&family=Archivo:wght@500;600;700&display=swap";
    document.head.append(pre, pre2, font);
  }

  const MEDIA = {
    look: [
      { src: "./home-media/look-1.jpg", tag: "NECKLACE", label: "데일리 네클리스" },
      { src: "./home-media/look-2.jpg", tag: "LAYER", label: "레이어드 룩" },
      { src: "./home-media/look-3.jpg", tag: "CHAIN", label: "체인 포인트" },
      { src: "./home-media/look-4.jpg", tag: "RING", label: "링 디테일" },
      { src: "./home-media/look-5.jpg", tag: "EAR", label: "이어링" },
      { src: "./home-media/look-6.jpg", tag: "SET", label: "풀 셋" },
    ],
    goldBg: "./home-media/gold-bg.jpg",
  };

  const ICO = {
    portfolio:
      '<svg viewBox="0 0 24 24"><rect x="3.5" y="6.5" width="17" height="13" rx="2.2" stroke-width="1.7"/><path d="M8 6.5V5.4A1.9 1.9 0 0 1 9.9 3.5h4.2A1.9 1.9 0 0 1 16 5.4v1.1M3.5 11h17" stroke-width="1.7"/></svg>',
    reviews: '<svg viewBox="0 0 24 24"><path d="M4.5 8.5h2.2l1.2-2h8.2l1.2 2H19.5A1.5 1.5 0 0 1 21 10v7.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V10a1.5 1.5 0 0 1 1.5-1.5Z" fill="none" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="13.5" r="3.2" fill="none" stroke-width="1.7"/></svg>',
    shipping:
      '<svg viewBox="0 0 24 24"><path d="M3.8 8.2 12 3.8l8.2 4.4v7.6L12 20.2 3.8 15.8V8.2Z" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 12.2 4.2 8M12 12.2l7.8-4.2M12 12.2V20" stroke-width="1.7" stroke-linecap="round"/></svg>',
    notices:
      '<svg viewBox="0 0 24 24"><path d="M6 4.5h12A1.5 1.5 0 0 1 19.5 6v14.2l-3.2-2.1H6A1.5 1.5 0 0 1 4.5 17V6A1.5 1.5 0 0 1 6 4.5Z" stroke-width="1.7" stroke-linejoin="round"/><path d="M8.5 9h7M8.5 12.2h7M8.5 15.3h4.2" stroke-width="1.7" stroke-linecap="round"/></svg>',
    gold:
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.2" stroke-width="1.7"/><path d="M12 8.2v7.6M9.2 10.2c.7-1 1.7-1.5 2.8-1.5 1.6 0 2.8.9 2.8 2.2S13.6 13 12 13s-2.8.8-2.8 2.1c0 1.3 1.3 2.2 3 2.2 1.1 0 2-.4 2.7-1.3" stroke-width="1.7" stroke-linecap="round"/></svg>',
    search:
      '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.2" stroke-width="1.7"/><path d="M16.2 16.2 20 20" stroke-width="1.7" stroke-linecap="round"/></svg>',
  };

  const MENUS = [
    { go: "discover", label: "발견", ico: "portfolio" },
    { go: "portfolio", label: "포트폴리오", ico: "portfolio" },
    { go: "shipping", label: "최종검수", ico: "shipping" },
    { go: "gold", label: "금시세", ico: "gold" },
    { go: "search", label: "AI검색", ico: "search" },
    { go: "reviews", label: "스냅", ico: "reviews" },
  ];

  const RANK_SNAP_KEY = "hx.pwa.hotRank.v2";

  function appQuery() {
    return /[?&]app=1(?:&|$)/.test(location.search) ? "?app=1" : "";
  }

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function pickUnique(pool, used, count) {
    const out = [];
    for (const item of pool) {
      if (!item || !item.id) continue;
      const id = String(item.id);
      if (used.has(id)) continue;
      used.add(id);
      out.push(item);
      if (out.length >= count) break;
    }
    return out;
  }

  function loadRankSnap() {
    try {
      const raw = JSON.parse(localStorage.getItem(RANK_SNAP_KEY) || "null");
      if (!raw || typeof raw !== "object") return { ranks: {}, views: {}, at: 0 };
      if (raw.ranks && typeof raw.ranks === "object") {
        return {
          ranks: raw.ranks,
          views: raw.views && typeof raw.views === "object" ? raw.views : {},
          at: Number(raw.at) || 0,
        };
      }
      // legacy flat map
      return { ranks: raw, views: {}, at: 0 };
    } catch (_) {
      return { ranks: {}, views: {}, at: 0 };
    }
  }

  function saveRankSnap(payload) {
    try {
      localStorage.setItem(
        RANK_SNAP_KEY,
        JSON.stringify({
          ranks: payload.ranks || {},
          views: payload.views || {},
          at: Date.now(),
        })
      );
    } catch (_) {}
  }

  function rankDeltaHtml(prevRank, curRank) {
    const prev = Number(prevRank) || 0;
    const cur = Number(curRank) || 0;
    if (!prev || prev < 1) {
      return `<span class="pwa-rank__delta is-new" aria-label="NEW">NEW</span>`;
    }
    const diff = prev - cur;
    if (diff > 0) return `<span class="pwa-rank__delta is-up" aria-label="${diff} up">▲${diff}</span>`;
    if (diff < 0) return `<span class="pwa-rank__delta is-down" aria-label="${Math.abs(diff)} down">▼${Math.abs(diff)}</span>`;
    return `<span class="pwa-rank__delta is-same" aria-label="same">—</span>`;
  }

  const assetUrl = (value) => {
    const path = String(value || "").trim();
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    // Review/API uploads live on app host, not the static site origin.
    if (/^\/?uploads\//i.test(path)) {
      const origin = (() => {
        try {
          return new URL(window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").origin;
        } catch (_) {
          return "https://app.0-1.co.kr";
        }
      })();
      return `${origin}/${path.replace(/^\/+/, "")}`;
    }
    try {
      return new URL(path.replace(/^\/+/, ""), location.origin + "/").href;
    } catch (_) {
      return "/" + path.replace(/^\/+/, "");
    }
  };

  function goBoardPost(board, id) {
    const parts = [];
    if (
      /[?&]app=1(?:&|$)/.test(location.search) ||
      document.documentElement.classList.contains("is-pwa")
    ) {
      parts.push("app=1");
    }
    if (id) parts.push(`id=${encodeURIComponent(id)}`);
    const q = parts.length ? `?${parts.join("&")}` : "";
    if (board === "shipping") {
      location.href = `./shipping.html${q}`;
      return;
    }
    if (board === "reviews") {
      location.href = `./reviews.html${q}`;
      return;
    }
  }

  function boardPostHref(board, id) {
    const parts = [];
    if (
      /[?&]app=1(?:&|$)/.test(location.search) ||
      document.documentElement.classList.contains("is-pwa")
    ) {
      parts.push("app=1");
    }
    if (id) parts.push(`id=${encodeURIComponent(id)}`);
    const q = parts.length ? `?${parts.join("&")}` : "";
    if (board === "shipping") return `./shipping.html${q}`;
    if (board === "reviews") return `./reviews.html${q}`;
    return "./landing.html" + (parts[0] === "app=1" ? "?app=1" : "");
  }

  function resolveBoardId(item) {
    if (!item || typeof item !== "object") return "";
    return String(item.id || item.externalId || item.sourceExternalId || "").trim();
  }

  function goPortfolio(cat, id) {
    const parts = [];
    if (
      /[?&]app=1(?:&|$)/.test(location.search) ||
      document.documentElement.classList.contains("is-pwa")
    ) {
      parts.push("app=1");
    }
    if (cat && cat !== "ALL") parts.push(`cat=${encodeURIComponent(cat)}`);
    if (id) parts.push(`id=${encodeURIComponent(id)}`);
    const q = parts.length ? `?${parts.join("&")}` : "";
    location.href = `./portfolio.html${q}`;
  }

  function goRoute(key) {
    if (key === "portfolio") return goPortfolio("ALL");
    if (key === "discover") {
      location.href = `./discover.html${appQuery()}`;
      return;
    }
    if (key === "search") return void (location.href = `./search.html${appQuery()}`);
    if (key === "gold") return void (location.href = "./heritage-gold/");
    if (key === "reviews") return void (location.href = `./reviews.html${appQuery()}`);
    if (key === "shipping") return void (location.href = `./shipping.html${appQuery()}`);
    if (key === "event") return void (location.href = `./opening-event.html${appQuery()}`);
    if (key === "notices") {
      const q = /[?&]app=1(?:&|$)/.test(location.search) ? "?open=notices&app=1" : "?open=notices";
      return void (location.href = `./landing.html${q}`);
    }
  }

  function ensureHost() {
    let host = document.getElementById("pwaHome");
    if (host) return host;
    const landing = document.querySelector("main.landing");
    if (!landing) return null;
    host = document.createElement("div");
    host.id = "pwaHome";
    host.setAttribute("aria-label", "앱 홈");
    const hero = landing.querySelector(".hero");
    if (hero) landing.insertBefore(host, hero);
    else landing.prepend(host);
    return host;
  }

  const RECENT_KEY = "hx.pwa.recent";
  const WISH_KEY = "hx.pwa.wish";

  function loadIdList(key) {
    try {
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function saveIdList(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list.slice(0, 40)));
    } catch (_) {}
  }

  function pushRecent(item) {
    if (window.HxStore?.pushRecent) {
      window.HxStore.pushRecent(item);
      return;
    }
    if (!item || !item.id) return;
    const id = String(item.id);
    const next = [{ id, cover: item.cover || item.image || "", title: item.title || "", category: item.category || "" }];
    loadIdList(RECENT_KEY)
      .filter((x) => x && x.id !== id)
      .forEach((x) => next.push(x));
    saveIdList(RECENT_KEY, next);
  }

  function isWished(id) {
    return loadIdList(WISH_KEY).includes(String(id));
  }

  function toggleWish(id, btn) {
    const sid = String(id);
    let list = loadIdList(WISH_KEY).map(String);
    if (list.includes(sid)) list = list.filter((x) => x !== sid);
    else list.unshift(sid);
    saveIdList(WISH_KEY, list);
    if (btn) btn.classList.toggle("is-on", list.includes(sid));
  }

  function protect(img) {
    if (window.GongbangProtectImage && img) window.GongbangProtectImage(img);
  }

  function cardButton(item, compact) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = compact ? "pwa-peek__card" : "pwa-card";
    const cat = item.category || "";
    const title = String(item.title || "").replace(/^[A-Z&]+\s+/, "");
    const id = item.id || "";
    if (compact) {
      btn.innerHTML =
        `<span class="pwa-peek__thumb"><img alt="" loading="lazy" decoding="async" src="${assetUrl(
          item.cover || item.image
        )}"></span>` + `<span class="pwa-peek__name">${title || cat || "작품"}</span>`;
    } else {
      btn.innerHTML =
        `<span class="pwa-card__thumb">` +
        (cat ? `<span class="pwa-card__cat">${cat}</span>` : "") +
        (id
          ? `<span class="pwa-card__wish${isWished(id) ? " is-on" : ""}" data-wish="${id}" aria-label="위시">♥</span>`
          : "") +
        `<img alt="" loading="lazy" decoding="async" src="${assetUrl(item.cover || item.image)}">` +
        `</span>` +
        `<span class="pwa-card__brand">${cat || "HERITAGE"}</span>` +
        `<span class="pwa-card__name">${title}</span>`;
      const wish = btn.querySelector("[data-wish]");
      if (wish) {
        wish.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleWish(id, wish);
        });
      }
    }
    protect(btn.querySelector("img"));
    btn.addEventListener("click", () => {
      pushRecent(item);
      goPortfolio(cat || "ALL", item.id);
    });
    return btn;
  }

  async function loadJson(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(path);
    return res.json();
  }

  function asList(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }

  function won(n) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    return `${Math.round(Number(n)).toLocaleString("ko-KR")}원`;
  }

  const GOLD_CACHE_KEY = "hx.gold.last";
  const GOLD_SERIES_KEY = "hx.gold.series";
  const AI_API = window.JEWELRY_SEARCH_API || "https://app.0-1.co.kr/api/jewelry/v1";

  function readGoldCache() {
    try {
      return JSON.parse(localStorage.getItem(GOLD_CACHE_KEY) || "null");
    } catch (_) {
      return null;
    }
  }

  function writeGoldCache(info) {
    try {
      localStorage.setItem(GOLD_CACHE_KEY, JSON.stringify(info));
      const series = JSON.parse(localStorage.getItem(GOLD_SERIES_KEY) || "[]");
      series.push({ t: Date.now(), don: info.don });
      localStorage.setItem(GOLD_SERIES_KEY, JSON.stringify(series.slice(-18)));
    } catch (_) {}
  }

  function goldSeries() {
    try {
      const s = JSON.parse(localStorage.getItem(GOLD_SERIES_KEY) || "[]");
      if (s.length >= 2) return s.map((x) => Number(x.don)).filter((n) => n > 0);
    } catch (_) {}
    return [];
  }

  function sparkPath(values, w = 120, h = 36) {
    if (!values.length) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1, max - min);
    return values
      .map((v, i) => {
        const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
        const y = h - ((v - min) / span) * (h - 4) - 2;
        return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  async function fetchGoldDon() {
    const fromPerOzKrw = (krwOz, source) => {
      const oz = Number(krwOz);
      if (!(oz > 0)) return null;
      const perG = oz / 31.1035;
      return { don: perG * 3.75, perG, at: new Date().toISOString(), source };
    };

    // 1) XAU→KRW (CORS OK) — troy oz in KRW
    try {
      const res = await fetch("https://latest.currency-api.pages.dev/v1/currencies/xau.json", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const info = fromPerOzKrw(data?.xau?.krw, "live");
        if (info) {
          writeGoldCache(info);
          return info;
        }
      }
    } catch (_) {}

    // 2) Gold USD/oz × USD→KRW
    try {
      const [gRes, fxRes] = await Promise.all([
        fetch("https://api.gold-api.com/price/XAU", { cache: "no-store" }),
        fetch("https://latest.currency-api.pages.dev/v1/currencies/usd.json", { cache: "no-store" }),
      ]);
      if (gRes.ok && fxRes.ok) {
        const g = await gRes.json();
        const fx = await fxRes.json();
        const usdOz = Number(g?.price || 0);
        const usdKrw = Number(fx?.usd?.krw || 0);
        if (usdOz > 0 && usdKrw > 0) {
          const info = fromPerOzKrw(usdOz * usdKrw, "live");
          if (info) {
            writeGoldCache(info);
            return info;
          }
        }
      }
    } catch (_) {}

    // 3) legacy feed (often 403 now)
    try {
      const res = await fetch("https://data-asg.goldprice.org/dbXRates/KRW", { cache: "no-cache" });
      if (res.ok) {
        const data = await res.json();
        const item = Array.isArray(data.items) ? data.items[0] : data;
        const perGram = Number(item?.xauPrice || item?.XAU || 0);
        if (perGram > 0) {
          const perG = perGram > 100000 ? perGram : perGram / 31.1035;
          const info = { don: perG * 3.75, perG, at: new Date().toISOString(), source: "live" };
          writeGoldCache(info);
          return info;
        }
      }
    } catch (_) {}

    const cached = readGoldCache();
    if (cached && cached.don) return { ...cached, source: "cache" };
    return null;
  }

  async function compressImageFile(file, maxSide = 1280, quality = 0.85) {
    if (!file || !file.type || !file.type.startsWith("image/")) return file;
    try {
      const bmp = await createImageBitmap(file);
      const w = bmp.width;
      const h = bmp.height;
      const m = Math.max(w, h);
      if (m <= maxSide && file.size <= 1.2 * 1024 * 1024) {
        bmp.close();
        return file;
      }
      const scale = Math.min(1, maxSide / m);
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      canvas.getContext("2d").drawImage(bmp, 0, 0, cw, ch);
      bmp.close();
      const blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
      if (!blob) return file;
      return new File([blob], "query.jpg", { type: "image/jpeg" });
    } catch (_) {
      return file;
    }
  }

  function reviewImage(item) {
    const direct = item.cover || item.image || item.img;
    if (direct) return assetUrl(direct);
    const imgs = item.images || [];
    const first = imgs[0];
    if (!first) return "";
    if (typeof first === "string") return assetUrl(first);
    return assetUrl(first.url || first.path || first.src || "");
  }

  function boardBodyText(item) {
    return String(item.body || item.content || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function photoBoardCard(item, goKey, fallbackTitle) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "pwa-review pwa-review--photo";
    el.dataset.go = goKey;
    const body = boardBodyText(item);
    const img = reviewImage(item) || assetUrl(item.cover || item.image || "");
    const title = String(item.title || fallbackTitle || "").replace(/\s+/g, " ").trim();
    el.innerHTML =
      (img ? `<span class="pwa-review__media"><img src="${img}" alt="" loading="lazy" decoding="async"></span>` : "") +
      `<span class="pwa-review__body"><strong>${title || fallbackTitle}</strong><p>${
        body || "자세히 보기"
      }</p></span>`;
    protect(el.querySelector("img"));
    return el;
  }


  function wearApiBase() {
    return String(window.HX_WEAR_FEED_API || window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  }

  async function loadDiscoverStories(limit) {
    const takeUnique = (rows) => {
      const sorted = [...(rows || [])].sort((a, b) => {
        const ta = Date.parse(a?.publishedAt || 0) || 0;
        const tb = Date.parse(b?.publishedAt || 0) || 0;
        return tb - ta;
      });
      const seen = new Set();
      const out = [];
      for (const item of sorted) {
        const handle = String(item?.handle || item?.profileUsername || "")
          .replace(/^@/, "")
          .trim()
          .toLowerCase();
        const platform = String(item?.platform || "").toLowerCase();
        const sharedWeb = !handle || /^(ddg|bing|google|web)_wear$/i.test(handle);
        // IG/real users: one ring per account. Web search rows shared *_wear must not collapse.
        let key = "";
        if (!sharedWeb && platform !== "web") {
          key = `u:${handle}`;
        } else {
          key = `p:${item?.externalId || item?.id || item?.permalink || item?.image || handle || Math.random()}`;
        }
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
        if (out.length >= limit) break;
      }
      return out;
    };

    if (window.HxWearFeed && typeof window.HxWearFeed.buildFeed === "function") {
      try {
        const rows = await window.HxWearFeed.buildFeed(true, "all");
        if (Array.isArray(rows) && rows.length) return takeUnique(rows);
      } catch (_) {}
    }
    try {
      const q = new URLSearchParams({
        brand: "all",
        limit: String(Math.max(limit * 8, 80)),
        sort: "latest",
      });
      const res = await fetch(`${wearApiBase()}/discover/feed?${q}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const rows = Array.isArray(data.items) ? data.items : [];
        if (rows.length) return takeUnique(rows);
      }
    } catch (_) {}
    try {
      const res = await fetch(`./hx-ig-wear.json?v=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return [];
      const data = await res.json();
      return takeUnique(data.items || []);
    } catch (_) {
      return [];
    }
  }

  function isScrapedAnonStory(item) {
    const platform = String(item.platform || "").toLowerCase();
    const source = String(item.source || "").toLowerCase();
    if (platform === "web") return true;
    if (/^web_/.test(source) || /web_(ddg|bing|google|search)/i.test(source)) return true;
    const profile = item.profilePictureUrl || item.profileImage || item.avatar || "";
    if ((platform === "pinterest" || platform === "web") && !profile) return true;
    return false;
  }

  function storyAvatarUrl(item) {
    // Never use post/jewelry image as a fake profile photo
    if (isScrapedAnonStory(item)) return "";
    return assetUrl(item.profilePictureUrl || item.profileImage || item.avatar || "");
  }

  function storyLabel(item) {
    const handle = String(item.handle || item.profileUsername || "")
      .replace(/^@/, "")
      .trim();
    if (handle) {
      // Strip hash suffix from web handles (site_a1b2c → site) for display
      const pretty = handle
        .replace(/_[a-f0-9]{4,8}$/i, "")
        .replace(/^(ddg|bing|google|web)_wear$/i, "")
        .trim();
      if (pretty) return `@${pretty.slice(0, 14)}`;
      return `@${handle.slice(0, 14)}`;
    }
    const name = String(item.displayName || item.profileName || "").trim();
    if (name && !/^(Google Images|Bing Images|Web Wear)$/i.test(name)) {
      return `@${name.replace(/\s+/g, "").slice(0, 14)}`;
    }
    return "@wear";
  }

  function openDiscoverPost(postId) {
    const parts = [];
    if (/[?&]app=1(?:&|$)/.test(location.search) || document.documentElement.classList.contains("is-pwa")) {
      parts.push("app=1");
    }
    if (postId) parts.push(`post=${encodeURIComponent(postId)}`);
    const q = parts.length ? `?${parts.join("&")}` : "";
    location.href = `./discover.html${q}`;
  }

  async function boot() {
    const host = ensureHost();
    if (!host) return;

    let portfolio = { items: [], categories: [] };
    let reviewsRaw = [];
    let noticesRaw = [];
    let shippingRaw = [];
    try {
      const [pf, rv, nt, sh] = await Promise.all([
        loadJson("portfolio-data.json").catch(() => portfolio),
        loadJson("reviews-data.json").catch(() => []),
        loadJson("notices-data.json").catch(() => []),
        loadJson("shipping-data.json").catch(() => ({ items: [] })),
      ]);
      portfolio = pf;
      reviewsRaw = asList(rv);
      noticesRaw = asList(nt);
      shippingRaw = asList(sh);
    } catch (_) {}

    const items = Array.isArray(portfolio.items) ? portfolio.items.slice() : [];
    const cats =
      Array.isArray(portfolio.categories) && portfolio.categories.length
        ? portfolio.categories
        : [...new Set(items.map((x) => x.category).filter(Boolean))];

    let viewsMap = {};
    try {
      if (window.GongbangBoardMeta?.fetchViews && items.length) {
        viewsMap = await window.GongbangBoardMeta.fetchViews(
          "portfolio",
          items.map((x) => x.id)
        );
      }
    } catch (_) {
      viewsMap = {};
    }
    // Fallback: direct views API if board-meta missing/empty
    if ((!viewsMap || !Object.keys(viewsMap).length) && items.length) {
      try {
        const base = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
        const ids = items
          .map((x) => String(x.id || "").trim())
          .filter(Boolean)
          .slice(0, 200);
        const params = new URLSearchParams({ board: "portfolio", ids: ids.join(",") });
        const res = await fetch(`${base}/views?${params}`, { credentials: "include", cache: "no-store" });
        const payload = await res.json().catch(() => ({}));
        if (res.ok && payload.views) viewsMap = payload.views;
      } catch (_) {}
    }

    const withViews = items.map((item) => ({
      ...item,
      _views: Number(viewsMap[String(item.id)] || 0),
    }));
    const ranked = withViews
      .slice()
      .sort((a, b) => b._views - a._views || String(a.id).localeCompare(String(b.id)));
    const topRanked = ranked.slice(0, 5);

    // Baseline = catalog order. Session snap (previous view ranks) used when available
    // so revisits show real movement; first paint still shows UP/DOWN vs list order.
    const catalogRanks = {};
    items.forEach((item, i) => {
      if (item?.id) catalogRanks[String(item.id)] = i + 1;
    });
    const viewRanks = {};
    ranked.forEach((item, i) => {
      if (item?.id) viewRanks[String(item.id)] = i + 1;
    });
    const prevSnap = loadRankSnap();
    const hasPrev = prevSnap.ranks && Object.keys(prevSnap.ranks).length > 0;
    const prevRanks = hasPrev ? prevSnap.ranks : catalogRanks;
    const nextViews = {};
    withViews.forEach((item) => {
      if (item?.id) nextViews[String(item.id)] = Number(item._views) || 0;
    });
    setTimeout(() => saveRankSnap({ ranks: viewRanks, views: nextViews }), 800);

    const mostViewed = ranked[0] || items[0] || null;
    const risingFifth = topRanked[4] || topRanked[topRanked.length - 1] || mostViewed;
    const usedIds = new Set();
    if (mostViewed?.id) usedIds.add(String(mostViewed.id));
    if (risingFifth?.id) usedIds.add(String(risingFifth.id));
    const fillers = pickUnique(shuffle(items), usedIds, 3);
    while (fillers.length < 3 && items.length) {
      const fallback = items[fillers.length % items.length];
      if (fallback) fillers.push(fallback);
      else break;
    }

    const fresh = items.slice(0, 10);
    const reviewItems = reviewsRaw.slice(0, 6);
    const shipItems = shippingRaw.slice(0, 8);
    const notice = noticesRaw[0];

    let activeCat = "ALL";
    host.innerHTML = "";

    // —— Hero slider (5 unique covers) ——
    const slides = [
      {
        item: fillers[0] || mostViewed,
        kicker: "BON HERITAGE",
        title: "주문제작 주얼리<br>포트폴리오",
        cta: "포트폴리오 보기",
        mode: "portfolio",
      },
      {
        item: mostViewed,
        kicker: "MOST VIEWED",
        title: "지금, 가장 많이 본<br>포트폴리오",
        cta: "작품 보기",
        mode: "item",
      },
      {
        item: risingFifth,
        kicker: "RISING NOW",
        title: "실시간 인기 급상승<br>포트폴리오",
        cta: "5위 작품 보기",
        mode: "item",
      },
      {
        item: fillers[1] || fillers[0] || mostViewed,
        kicker: "ARCHIVE PICK",
        title: "주문제작 주얼리<br>포트폴리오",
        cta: "포트폴리오 보기",
        mode: "portfolio",
      },
      {
        item: fillers[2] || fillers[0] || mostViewed,
        kicker: "HERITAGE LOOK",
        title: "주문제작 주얼리<br>포트폴리오",
        cta: "포트폴리오 보기",
        mode: "portfolio",
      },
    ].filter((s) => s.item);

    const hero = document.createElement("section");
    hero.className = "pwa-hero pwa-hero--banner pwa-hero-slider";
    hero.setAttribute("aria-label", "메인 배너");
    const track = document.createElement("div");
    track.className = "pwa-hero-slider__track";
    slides.forEach((slide, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `pwa-hero-slider__slide${i === 0 ? " is-on" : ""}`;
      btn.dataset.slide = String(i);
      const src = assetUrl(slide.item.cover || slide.item.image) || assetUrl(MEDIA.look[i % MEDIA.look.length].src);
      btn.innerHTML =
        `<div class="pwa-hero__media"><img src="${src}" alt="" decoding="async"><div class="pwa-hero__shade"></div></div>` +
        `<div class="pwa-hero__copy">` +
        `<p class="pwa-hero__kicker">${slide.kicker}</p>` +
        `<h2 class="pwa-hero__title">${slide.title}</h2>` +
        `<span class="pwa-hero__cta">${slide.cta}</span>` +
        `</div>`;
      protect(btn.querySelector("img"));
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        // Always open the product shown on this slide when available
        if (slide.item?.id) {
          goPortfolio(slide.item.category || "ALL", slide.item.id);
          return;
        }
        goPortfolio("ALL");
      });
      track.append(btn);
    });
    const dots = document.createElement("div");
    dots.className = "pwa-hero-slider__dots";
    dots.setAttribute("aria-hidden", "true");
    slides.forEach((_, i) => {
      const d = document.createElement("button");
      d.type = "button";
      d.className = i === 0 ? "is-on" : "";
      d.dataset.dot = String(i);
      dots.append(d);
    });
    hero.append(track, dots);
    host.append(hero);

    let slideIdx = 0;
    let autoTimer = 0;
    function goSlide(next) {
      if (!slides.length) return;
      slideIdx = ((next % slides.length) + slides.length) % slides.length;
      track.querySelectorAll(".pwa-hero-slider__slide").forEach((el, i) => {
        el.classList.toggle("is-on", i === slideIdx);
      });
      dots.querySelectorAll("button").forEach((el, i) => {
        el.classList.toggle("is-on", i === slideIdx);
      });
    }
    function restartAuto() {
      if (autoTimer) clearInterval(autoTimer);
      if (slides.length <= 1) return;
      autoTimer = setInterval(() => goSlide(slideIdx + 1), 4800);
    }
    dots.addEventListener("click", (event) => {
      const dot = event.target.closest("[data-dot]");
      if (!dot) return;
      event.preventDefault();
      event.stopPropagation();
      goSlide(Number(dot.dataset.dot) || 0);
      restartAuto();
    });

    // Touch / pointer swipe → next / prev slide
    let swipe = { x: 0, y: 0, active: false, locked: false, id: null };
    let suppressClickUntil = 0;
    const SWIPE_MIN = 42;
    function onPointerDown(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      swipe = {
        x: event.clientX,
        y: event.clientY,
        active: true,
        locked: false,
        id: event.pointerId,
      };
    }
    function onPointerMove(event) {
      if (!swipe.active || swipe.id !== event.pointerId) return;
      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;
      if (!swipe.locked && Math.abs(dx) + Math.abs(dy) > 8) {
        swipe.locked = Math.abs(dx) > Math.abs(dy);
      }
    }
    function onPointerUp(event) {
      if (!swipe.active || swipe.id !== event.pointerId) return;
      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;
      const wasSwipe = swipe.locked && Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy);
      swipe.active = false;
      if (!wasSwipe) return;
      // Only suppress the click that immediately follows a real swipe
      suppressClickUntil = Date.now() + 350;
      event.preventDefault();
      event.stopPropagation();
      goSlide(dx < 0 ? slideIdx + 1 : slideIdx - 1);
      restartAuto();
    }
    hero.addEventListener("pointerdown", onPointerDown, { passive: true });
    hero.addEventListener("pointermove", onPointerMove, { passive: true });
    hero.addEventListener("pointerup", onPointerUp);
    hero.addEventListener("pointercancel", () => {
      swipe.active = false;
    });
    // Block only the synthetic click right after a completed swipe
    track.addEventListener(
      "click",
      (event) => {
        if (Date.now() > suppressClickUntil) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClickUntil = 0;
      },
      true
    );
    restartAuto();

    // Category + peek
    const catsWrap = document.createElement("section");
    catsWrap.className = "pwa-index";
    catsWrap.innerHTML =
      `<div class="pwa-index__row">` +
      `<div class="pwa-index__label">카테고리</div>` +
      `<button type="button" class="pwa-index__more" data-cat-more>전체</button>` +
      `</div>`;
    const catsEl = document.createElement("nav");
    catsEl.className = "pwa-cats";
    catsEl.setAttribute("aria-label", "카테고리");
    const peek = document.createElement("div");
    peek.className = "pwa-peek";
    peek.innerHTML =
      `<div class="pwa-peek__hint"><span class="pwa-peek__hint-ico">‹ ›</span> 밀어서 더 보기</div>` +
      `<div class="pwa-peek__rail" id="pwaPeekRail"></div>`;

    function setActiveCatBtn(code) {
      catsEl.querySelectorAll("button").forEach((b) => {
        b.classList.toggle("is-on", b.dataset.cat === code);
      });
    }

    function renderPeek(code, animate) {
      activeCat = code;
      setActiveCatBtn(code);
      const rail = peek.querySelector("#pwaPeekRail");
      if (!rail) return;
      const list =
        code === "ALL" ? items.slice(0, 16) : items.filter((x) => x.category === code).slice(0, 16);
      rail.classList.remove("is-play");
      rail.innerHTML = "";
      if (!list.length) {
        rail.innerHTML = `<p class="pwa-peek__empty">작품 준비 중</p>`;
        return;
      }
      list.forEach((item, i) => {
        const card = cardButton(item, true);
        card.style.setProperty("--i", String(i));
        rail.append(card);
      });
      rail.scrollLeft = 0;
      requestAnimationFrame(() => {
        rail.classList.add("is-play");
        if (!animate) {
          rail.querySelectorAll(".pwa-peek__card").forEach((el) => {
            el.style.animation = "none";
            el.style.opacity = "1";
            el.style.transform = "none";
          });
        }
      });
    }

    function makeCatBtn(code, label) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.cat = code;
      b.innerHTML = `<span>${label}</span>`;
      b.addEventListener("click", () => {
        if (activeCat === code) return goPortfolio(code);
        renderPeek(code, true);
      });
      return b;
    }

    catsEl.append(makeCatBtn("ALL", "ALL"));
    cats.forEach((code) => catsEl.append(makeCatBtn(code, String(code))));
    catsWrap.append(catsEl, peek);
    host.append(catsWrap);
    catsWrap.querySelector("[data-cat-more]")?.addEventListener("click", () => goPortfolio(activeCat));
    renderPeek("ALL", true);

    // Shortcut dock
    const services = document.createElement("nav");
    services.className = "pwa-dock";
    services.setAttribute("aria-label", "바로가기");
    services.innerHTML = MENUS.map(
      (m) =>
        `<button type="button" data-go="${m.go}">` +
        `<span class="pwa-dock__ico">${ICO[m.ico]}</span>` +
        `<span class="pwa-dock__txt">${m.label}</span>` +
        `</button>`
    ).join("");
    host.append(services);

    // Lifestyle teasers (발견/착용코디 · XAU/XAG/XPT · TODAY) — hidden for now
    // if (window.HxDiscover?.mountHomeTeasers) {
    //   window.HxDiscover.mountHomeTeasers(host).catch(() => {});
    // }

    // —— Heritage opening event countdown ——
    const dropBar = document.createElement("section");
    dropBar.className = "pwa-dropbar";
    dropBar.innerHTML =
      `<div class="pwa-dropbar__left">` +
      `<p class="pwa-sec__eyebrow">HERITAGE OPENING EVENT</p>` +
      `<strong>헤리티지 리뉴얼 기념 이벤트 마감까지</strong>` +
      `<p class="pwa-sec__eyebrow" style="margin-top:4px;opacity:.72">~ 2026.08.08 24:00</p>` +
      `</div>` +
      `<div class="pwa-dropbar__clock" id="pwaDropClock" aria-live="polite">` +
      `<span data-h>--</span><i>:</i><span data-m>--</span><i>:</i><span data-s>--</span>` +
      `</div>` +
      `<button type="button" class="pwa-dropbar__go" data-go="event">보기</button>`;
    host.append(dropBar);

    function tickDropClock() {
      const now = new Date();
      // 2026-08-08 24:00 KST == 2026-08-09 00:00 KST
      const end = new Date("2026-08-09T00:00:00+09:00");
      let sec = Math.max(0, Math.floor((end - now) / 1000));
      const h = String(Math.floor(sec / 3600)).padStart(2, "0");
      sec %= 3600;
      const m = String(Math.floor(sec / 60)).padStart(2, "0");
      const s = String(sec % 60).padStart(2, "0");
      const clock = dropBar.querySelector("#pwaDropClock");
      if (!clock) return;
      const spans = clock.querySelectorAll("span");
      if (spans[0]) spans[0].textContent = h;
      if (spans[1]) spans[1].textContent = m;
      if (spans[2]) spans[2].textContent = s;
    }
    tickDropClock();
    setInterval(tickDropClock, 1000);

    // —— Live pulse (KREAM/Musinsa activity feel) ——
    const pulse = document.createElement("div");
    pulse.className = "pwa-pulse";
    const pulseEntries = [];
    shipItems.slice(0, 4).forEach((s) => {
      const t = String(s.title || "").replace(/\s+/g, " ").trim().slice(0, 28);
      const id = resolveBoardId(s);
      if (!t || !id) return;
      pulseEntries.push({
        label: `최종검수 · ${t}`,
        board: "shipping",
        id,
      });
    });
    reviewItems.slice(0, 3).forEach((r) => {
      const t = String(r.title || "스냅").slice(0, 24);
      const id = resolveBoardId(r);
      if (!t || !id) return;
      pulseEntries.push({
        label: `스냅 · ${t}`,
        board: "reviews",
        id,
      });
    });
    if (!pulseEntries.length) {
      pulseEntries.push({
        label: "본 헤리티지 · 주문제작 아카이브가 업데이트 중입니다",
        board: "",
        id: "",
      });
    }
    pulse.innerHTML =
      `<span class="pwa-pulse__dot" aria-hidden="true"></span>` +
      `<span class="pwa-pulse__label">RECENT UPDATE</span>` +
      `<div class="pwa-pulse__track"><div class="pwa-pulse__move"></div></div>`;
    const pulseMove = pulse.querySelector(".pwa-pulse__move");
    const appendPulseEntry = (entry) => {
      if (!entry.id || !entry.board) {
        const span = document.createElement("span");
        span.textContent = entry.label;
        pulseMove.append(span);
        return;
      }
      const link = document.createElement("a");
      link.className = "pwa-pulse__item";
      link.href = boardPostHref(entry.board, entry.id);
      link.textContent = entry.label;
      link.setAttribute("aria-label", entry.label);
      link.addEventListener("click", (event) => {
        event.preventDefault();
        goBoardPost(entry.board, entry.id);
      });
      pulseMove.append(link);
    };
    pulseEntries.concat(pulseEntries).forEach(appendPulseEntry);
    // Pause marquee while pressing/holding so mobile taps land on a stable item
    const pausePulse = () => pulse.classList.add("is-paused");
    const resumePulse = () => pulse.classList.remove("is-paused");
    pulse.addEventListener("pointerdown", pausePulse);
    pulse.addEventListener("pointerup", resumePulse);
    pulse.addEventListener("pointercancel", resumePulse);
    pulse.addEventListener("pointerleave", resumePulse);
    host.append(pulse);

    // —— Story rings (Discover recent wear) ——
    const stories = document.createElement("section");
    stories.className = "pwa-stories";
    stories.setAttribute("aria-label", "NEW WEAR");
    const storyCount = window.matchMedia("(min-width: 1025px)").matches ? 10 : 6;
    // placeholders while loading
    for (let i = 0; i < storyCount; i += 1) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pwa-stories__item" + (i === 0 ? " is-new" : "");
      b.disabled = true;
      b.innerHTML =
        `<span class="pwa-stories__ring"><img src="${assetUrl(MEDIA.look[i % MEDIA.look.length].src)}" alt="" loading="lazy"></span>` +
        `<span class="pwa-stories__lab">${["NEW","WEAR","GOLD","OUT","REAL","LIVE"][i % 6]}</span>`;
      protect(b.querySelector("img"));
      stories.append(b);
    }
    host.append(stories);
    loadDiscoverStories(storyCount).then((rows) => {
      if (!rows.length) return;
      stories.replaceChildren();
      rows.forEach((item, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "pwa-stories__item is-live" + (i === 0 ? " is-new" : "");
        const img = storyAvatarUrl(item);
        const label = storyLabel(item);
        if (img) {
          b.innerHTML =
            `<span class="pwa-stories__ring"><img src="${img}" alt="" loading="lazy"></span>` +
            `<span class="pwa-stories__lab">${label}</span>`;
          protect(b.querySelector("img"));
        } else {
          b.innerHTML =
            `<span class="pwa-stories__ring pwa-stories__ring--blank" aria-hidden="true"></span>` +
            `<span class="pwa-stories__lab">${label}</span>`;
        }
        b.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openDiscoverPost(item.id || "");
        });
        stories.append(b);
      });
    });

    // —— AI Search (refined equal CTAs) ——
    const aiSec = document.createElement("section");
    aiSec.className = "pwa-aiseek";
    aiSec.innerHTML =
      `<div class="pwa-aiseek__panel">` +
      `<div class="pwa-aiseek__head">` +
      `<div><p class="pwa-sec__eyebrow">AI SEARCH · BETA</p><h2>사진으로 찾기</h2></div>` +
      `<a href="./search.html">더보기</a>` +
      `</div>` +
      `<p class="pwa-aiseek__status" id="pwaAiStatus">엔진 확인 중…</p>` +
      `<div class="pwa-aiseek__drop">` +
      `<p>비슷한 주얼리를 찾아드릴게요</p>` +
      `<div class="pwa-aiseek__actions">` +
      `<label class="pwa-aiseek__btn"><input type="file" accept="image/*" hidden id="pwaAiAlbum">` +
      `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="10.2" r="1.4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m7.5 16.5 3.2-3.4 2.4 2.2 3.4-4.1 3 5.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>` +
      `<span>앨범</span></label>` +
      `<label class="pwa-aiseek__btn"><input type="file" accept="image/*" capture="environment" hidden id="pwaAiCam">` +
      `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 8.5h2.2l1.2-2h8.2l1.2 2H19.5A1.5 1.5 0 0 1 21 10v7.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V10a1.5 1.5 0 0 1 1.5-1.5Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="13.5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>` +
      `<span>카메라</span></label>` +
      `<button type="button" class="pwa-aiseek__btn" data-go="search">` +
      `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m16.2 16.2 3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>` +
      `<span>상세</span></button>` +
      `</div></div>` +
      `<div class="pwa-aiseek__rail" id="pwaAiRail" hidden></div>` +
      `<div class="pwa-aiseek__loading" id="pwaAiLoading" hidden><i></i><span>비슷한 작품 찾는 중…</span></div>` +
      `</div>`;
    host.append(aiSec);

    const aiStatus = aiSec.querySelector("#pwaAiStatus");
    const aiRail = aiSec.querySelector("#pwaAiRail");
    const aiLoading = aiSec.querySelector("#pwaAiLoading");

    async function checkAiHealth() {
      try {
        const res = await fetch(`${AI_API}/health`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error("offline");
        if (!data.indexReady) {
          if (aiStatus) aiStatus.textContent = "인덱스 준비 중 · 잠시 후 다시 시도해 주세요";
          return;
        }
        if (aiStatus) aiStatus.textContent = "앨범 또는 카메라로 바로 검색할 수 있어요";
      } catch (_) {
        if (aiStatus) aiStatus.textContent = "상세 검색에서 이용하거나 잠시 후 다시 시도";
      }
    }
    checkAiHealth();

    async function runAiSearch(file) {
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        if (aiStatus) aiStatus.textContent = "이미지는 10MB 이하로 올려 주세요";
        return;
      }
      aiLoading.hidden = false;
      if (aiStatus) aiStatus.textContent = "이미지 분석 중…";
      try {
        const upload = await compressImageFile(file);
        const body = new FormData();
        body.append("file", upload, upload.name || "query.jpg");
        const res = await fetch(`${AI_API}/search/image?limit=12`, { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) throw new Error(data.detail || data.message || "fail");
        const rows = data.results || [];
        aiRail.hidden = false;
        aiRail.innerHTML = "";
        if (!rows.length) {
          aiRail.innerHTML = `<p class="pwa-aiseek__empty">유사한 작품을 못 찾았어요</p>`;
          if (aiStatus) aiStatus.textContent = "검색 결과 없음";
          return;
        }
        rows.slice(0, 10).forEach((row) => {
          const id = row.product_id || row.id;
          const b = document.createElement("button");
          b.type = "button";
          b.className = "pwa-aiseek__card";
          const title = String(row.title || row.product_name || id || "")
            .replace(/\b(Cartier|Bulgari|Bvlgari|Tiffany|Chanel|Hermes|Hermès)\b/gi, "")
            .replace(/\s{2,}/g, " ")
            .trim();
          b.innerHTML =
            `<img alt="" loading="lazy" src="${row.coverUrl || row.image_url || ""}">` +
            `<span>${title || "결과"}</span>` +
            `<em>${row.source_type === "web" ? "WEB" : "PF"}</em>`;
          protect(b.querySelector("img"));
          b.addEventListener("click", () => {
            if (row.product_url) {
              location.href = row.product_url;
              return;
            }
            location.href = `./portfolio.html?id=${encodeURIComponent(id || "")}`;
          });
          aiRail.append(b);
        });
        if (aiStatus) aiStatus.textContent = `${rows.length}건 매칭 · BETA`;
      } catch (_) {
        if (aiStatus) aiStatus.textContent = "검색 실패 · 상세검색을 이용해 주세요";
        aiRail.hidden = true;
      } finally {
        aiLoading.hidden = true;
      }
    }

    aiSec.querySelector("#pwaAiAlbum")?.addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      if (f) runAiSearch(f);
      e.target.value = "";
    });
    aiSec.querySelector("#pwaAiCam")?.addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      if (f) runAiSearch(f);
      e.target.value = "";
    });

    // —— Gold market (KREAM-clean number UI) ——
    const market = document.createElement("section");
    market.className = "pwa-market";
    market.innerHTML =
      `<div class="pwa-market__head">` +
      `<div><p class="pwa-sec__eyebrow">MARKET</p><h2>오늘의 금시세</h2></div>` +
      `<a href="./heritage-gold/">자세히</a>` +
      `</div>` +
      `<div class="pwa-market__card">` +
      `<div class="pwa-market__top">` +
      `<span class="pwa-market__live" id="pwaGoldLive"><i></i>LIVE</span>` +
      `<button type="button" class="pwa-market__refresh" id="pwaGoldRefresh" aria-label="새로고침">↻</button>` +
      `</div>` +
      `<div class="pwa-market__units" id="pwaGoldUnits" role="tablist">` +
      `<button type="button" data-unit="don" class="is-on">1돈</button>` +
      `<button type="button" data-unit="g">1g</button>` +
      `<button type="button" data-unit="k14">14K</button>` +
      `<button type="button" data-unit="k18">18K</button>` +
      `</div>` +
      `<div class="pwa-market__pricewrap">` +
      `<strong class="pwa-market__price" id="pwaGoldPrice">—</strong>` +
      `<span class="pwa-market__won">원</span>` +
      `</div>` +
      `<p class="pwa-market__sub" id="pwaGoldSub">순금 1돈 · 3.75g · 참고용</p>` +
      `<svg class="pwa-market__spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true">` +
      `<path id="pwaGoldSpark" fill="none" stroke="currentColor" stroke-width="1.5"></path>` +
      `</svg>` +
      `<div class="pwa-market__row">` +
      `<span id="pwaGoldMeta">시세 확인 중</span>` +
      `<a href="./heritage-gold/">시세 페이지</a>` +
      `</div>` +
      `</div>`;
    host.append(market);

    let goldInfo = readGoldCache();
    let goldUnit = "don";

    function paintGold(info) {
      const priceEl = document.getElementById("pwaGoldPrice");
      const subEl = document.getElementById("pwaGoldSub");
      const metaEl = document.getElementById("pwaGoldMeta");
      const liveEl = document.getElementById("pwaGoldLive");
      const sparkEl = document.getElementById("pwaGoldSpark");
      if (!priceEl) return;
      if (!info) {
        priceEl.textContent = "—";
        if (subEl) subEl.textContent = "시세를 불러오는 중";
        return;
      }
      const map = {
        don: { v: info.don, label: "순금 1돈 · 3.75g · 참고용" },
        g: { v: info.perG, label: "순금 1g · 참고용" },
        k14: { v: info.don * 0.585, label: "14K 함량 환산 · 1돈 기준" },
        k18: { v: info.don * 0.75, label: "18K 함량 환산 · 1돈 기준" },
      };
      const cur = map[goldUnit] || map.don;
      priceEl.textContent = Math.round(cur.v).toLocaleString("ko-KR");
      if (subEl) subEl.textContent = cur.label;
      if (metaEl) {
        const t = new Date(info.at || Date.now());
        const src = info.source === "cache" ? "캐시" : "LIVE";
        metaEl.textContent = `${src} · ${t.toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        })} 기준`;
      }
      if (liveEl) {
        liveEl.innerHTML = info.source === "cache" ? "<i></i>CACHE" : "<i></i>LIVE";
        liveEl.classList.toggle("is-cache", info.source === "cache");
      }
      if (sparkEl) {
        let series = goldSeries();
        if (series.length < 2) {
          const base = info.don;
          series = Array.from({ length: 10 }, (_, i) => base * (1 + Math.sin(i / 2.2) * 0.004));
        }
        sparkEl.setAttribute("d", sparkPath(series));
      }
    }

    if (goldInfo) paintGold({ ...goldInfo, source: "cache" });

    async function refreshGold() {
      const liveEl = document.getElementById("pwaGoldLive");
      if (liveEl) liveEl.innerHTML = "<i></i>…";
      goldInfo = await fetchGoldDon();
      paintGold(goldInfo);
    }
    refreshGold();

    market.querySelector("#pwaGoldRefresh")?.addEventListener("click", (e) => {
      e.stopPropagation();
      refreshGold();
    });
    market.querySelector("#pwaGoldUnits")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-unit]");
      if (!btn) return;
      e.stopPropagation();
      goldUnit = btn.getAttribute("data-unit") || "don";
      market.querySelectorAll("#pwaGoldUnits button").forEach((b) => b.classList.remove("is-on"));
      btn.classList.add("is-on");
      paintGold(goldInfo);
    });

    // Style / wearing — hidden (발견·착용 코디 정리와 함께)
    // Recent viewed — hidden
    // Wishlist — keep if user has items? User didn't ask to hide wish; leave.
    const wishIds = loadIdList(WISH_KEY).map(String);
    const wishItems = wishIds
      .map((id) => items.find((x) => String(x.id) === id))
      .filter(Boolean)
      .slice(0, 12);
    if (wishItems.length) {
      const wishSec = document.createElement("section");
      wishSec.className = "pwa-sec";
      wishSec.innerHTML =
        `<div class="pwa-sec__head">` +
        `<div><p class="pwa-sec__eyebrow">WISH</p><h2>위시리스트</h2></div>` +
        `<button type="button" data-go="portfolio">전체</button>` +
        `</div>`;
      const wishRail = document.createElement("div");
      wishRail.className = "pwa-rail";
      wishItems.forEach((item) => wishRail.append(cardButton(item, false)));
      wishSec.append(wishRail);
      host.append(wishSec);
    }

    // For you rail — hidden

    // HOT ranking (view-based + UP/DOWN delta)
    const rankSec = document.createElement("section");
    rankSec.className = "pwa-sec";
    rankSec.innerHTML =
      `<div class="pwa-sec__head">` +
      `<div><p class="pwa-sec__eyebrow">CHART</p><h2>지금 핫한 순위</h2></div>` +
      `<button type="button" data-go="portfolio">전체</button>` +
      `</div>`;
    const rankList = document.createElement("div");
    rankList.className = "pwa-rank";
    if (!topRanked.length) {
      rankList.innerHTML = `<p class="pwa-empty">순위 준비 중</p>`;
    } else {
      topRanked.forEach((item, i) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "pwa-rank__row";
        const cat = item.category || "";
        const title = String(item.title || "").replace(/^[A-Z&]+\s+/, "");
        const id = String(item.id || "");
        const curRank = Number(viewRanks[id] || i + 1);
        let prevRank = Number(prevRanks[id] || 0);
        // If stored prev equals current (no session change), fall back to catalog
        // so view-based 가감 still shows.
        if (!prevRank || prevRank === curRank) {
          const catalog = Number(catalogRanks[id] || 0);
          if (catalog && catalog !== curRank) prevRank = catalog;
        }
        // View growth vs last snap → nudge UP when rank flat
        const prevViews = Number(prevSnap.views?.[id] || 0);
        const curViews = Number(item._views || 0);
        let deltaHtml = rankDeltaHtml(prevRank, curRank);
        if (deltaHtml.includes("is-same") && curViews > prevViews && prevViews > 0) {
          const up = Math.max(1, curViews - prevViews);
          deltaHtml = `<span class="pwa-rank__delta is-up" aria-label="${up} up">▲${up}</span>`;
        } else if (deltaHtml.includes("is-same") && prevViews > curViews && curViews >= 0 && prevViews > 0) {
          const down = Math.max(1, prevViews - curViews);
          deltaHtml = `<span class="pwa-rank__delta is-down" aria-label="${down} down">▼${down}</span>`;
        }
        row.innerHTML =
          `<span class="pwa-rank__n">${i + 1}</span>` +
          `<span class="pwa-rank__thumb"><img src="${assetUrl(item.cover || item.image)}" alt="" loading="lazy"></span>` +
          `<span class="pwa-rank__meta"><b>${title || "작품"}</b><i>${cat || "PF"} · 조회 ${curViews.toLocaleString("ko-KR")}</i></span>` +
          deltaHtml;
        protect(row.querySelector("img"));
        row.addEventListener("click", () => goPortfolio(cat || "ALL", item.id));
        rankList.append(row);
      });
    }
    rankSec.append(rankList);
    host.append(rankSec);

    // Archive drop — temporarily hidden

    // Realtime shipping — same photo-card style as reviews
    const shipSec = document.createElement("section");
    shipSec.className = "pwa-sec";
    shipSec.innerHTML =
      `<div class="pwa-sec__head">` +
      `<div><p class="pwa-sec__eyebrow">FINAL CHECK</p><h2>최종검수</h2></div>` +
      `<button type="button" data-go="shipping">더보기</button>` +
      `</div>`;
    const shipRail = document.createElement("div");
    shipRail.className = "pwa-reviews";
    if (!shipItems.length) {
      shipRail.innerHTML =
        `<button type="button" class="pwa-review" data-go="shipping"><strong>최종검수</strong><p>최종검수 샷을 확인해 보세요.</p></button>`;
    } else {
      shipItems.forEach((item) => shipRail.append(photoBoardCard(item, "shipping", "최종검수")));
    }
    shipSec.append(shipRail);
    host.append(shipSec);

    // Reviews
    const secRev = document.createElement("section");
    secRev.className = "pwa-sec";
    secRev.innerHTML =
      `<div class="pwa-sec__head">` +
      `<div><p class="pwa-sec__eyebrow">SNAP</p><h2>스냅</h2></div>` +
      `<button type="button" data-go="reviews">더보기</button>` +
      `</div>`;
    const revRail = document.createElement("div");
    revRail.className = "pwa-reviews";
    if (!reviewItems.length) {
      revRail.innerHTML =
        `<button type="button" class="pwa-review" data-go="reviews"><strong>제작 스냅</strong><p>고객 스냅을 확인해 보세요.</p></button>`;
    } else {
      reviewItems.forEach((item) => revRail.append(photoBoardCard(item, "reviews", "스냅")));
    }
    secRev.append(revRail);
    host.append(secRev);

    // Notice strip
    const noticeBtn = document.createElement("button");
    noticeBtn.type = "button";
    noticeBtn.className = "pwa-notice";
    noticeBtn.dataset.go = "notices";
    noticeBtn.innerHTML =
      `<span class="pwa-notice__tag">공지</span>` +
      `<span class="pwa-notice__text">${
        (notice && (notice.title || notice.subject)) || "본 헤리티지 공지"
      }</span>`;
    host.append(noticeBtn);

    host.addEventListener("click", (event) => {
      const go = event.target.closest("[data-go]");
      if (!go) return;
      goRoute(go.getAttribute("data-go"));
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
