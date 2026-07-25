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
    reviews:
      '<svg viewBox="0 0 24 24"><path d="M5.5 5.5h13A2 2 0 0 1 20.5 7.5v7A2 2 0 0 1 18.5 16.5H12l-4.2 2.8c-.45.3-1.05-.05-1.05-.6v-2.2H5.5A2 2 0 0 1 3.5 14.5v-7A2 2 0 0 1 5.5 5.5Z" stroke-width="1.7" stroke-linejoin="round"/></svg>',
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
    { go: "portfolio", label: "전체", ico: "portfolio" },
    { go: "shipping", label: "출고", ico: "shipping" },
    { go: "reviews", label: "후기", ico: "reviews" },
    { go: "gold", label: "금시세", ico: "gold" },
    { go: "search", label: "AI검색", ico: "search" },
    { go: "notices", label: "공지", ico: "notices" },
  ];

  const assetUrl = (value) => {
    const path = String(value || "").trim();
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    try {
      return new URL(path.replace(/^\/+/, ""), location.origin + "/").href;
    } catch (_) {
      return "/" + path.replace(/^\/+/, "");
    }
  };

  function goPortfolio(cat, id) {
    const parts = [];
    if (cat && cat !== "ALL") parts.push(`cat=${encodeURIComponent(cat)}`);
    if (id) parts.push(`id=${encodeURIComponent(id)}`);
    const q = parts.length ? `?${parts.join("&")}` : "";
    location.href = `./portfolio.html${q}`;
  }

  function goRoute(key) {
    if (key === "portfolio") return goPortfolio("ALL");
    if (key === "search") return void (location.href = "./search.html");
    if (key === "gold") return void (location.href = "./heritage-gold/");
    if (key === "reviews") return void (location.href = "./landing.html?open=reviews");
    if (key === "shipping") return void (location.href = "./landing.html?open=shipping");
    if (key === "notices") return void (location.href = "./landing.html?open=notices");
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

  function protect(img) {
    if (window.GongbangProtectImage && img) window.GongbangProtectImage(img);
  }

  function cardButton(item, compact) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = compact ? "pwa-peek__card" : "pwa-card";
    const cat = item.category || "";
    const title = String(item.title || "").replace(/^[A-Z&]+\s+/, "");
    if (compact) {
      btn.innerHTML =
        `<span class="pwa-peek__thumb"><img alt="" loading="lazy" decoding="async" src="${assetUrl(
          item.cover || item.image
        )}"></span>` + `<span class="pwa-peek__name">${title || cat || "작품"}</span>`;
    } else {
      btn.innerHTML =
        `<span class="pwa-card__thumb">` +
        (cat ? `<span class="pwa-card__cat">${cat}</span>` : "") +
        `<img alt="" loading="lazy" decoding="async" src="${assetUrl(item.cover || item.image)}">` +
        `</span>` +
        `<span class="pwa-card__brand">${cat || "HERITAGE"}</span>` +
        `<span class="pwa-card__name">${title}</span>`;
    }
    protect(btn.querySelector("img"));
    btn.addEventListener("click", () => goPortfolio(cat || "ALL", item.id));
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
    const imgs = item.images || [];
    const first = imgs[0];
    if (!first) return "";
    if (typeof first === "string") return assetUrl(first);
    return assetUrl(first.path || first.src || first.url || "");
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

    const heroItem = items[0] || null;
    const heroSrc = heroItem
      ? assetUrl(heroItem.cover || heroItem.image)
      : assetUrl(MEDIA.look[0].src);
    const fresh = items.slice(0, 10);
    const gridItems = items.slice(0, 8);
    const reviewItems = reviewsRaw.slice(0, 6);
    const shipItems = shippingRaw.slice(0, 8);
    const notice = noticesRaw[0];

    let activeCat = "ALL";
    host.innerHTML = "";

    // Hero banner — shorter commerce banner
    const hero = document.createElement("button");
    hero.type = "button";
    hero.className = "pwa-hero pwa-hero--banner";
    hero.dataset.go = "portfolio";
    hero.setAttribute("aria-label", "포트폴리오 보기");
    hero.innerHTML =
      `<div class="pwa-hero__media"><img src="${heroSrc}" alt="" decoding="async"><div class="pwa-hero__shade"></div></div>` +
      `<div class="pwa-hero__copy">` +
      `<p class="pwa-hero__kicker">BON HERITAGE</p>` +
      `<h1 class="pwa-hero__title">주문제작 주얼리<br>지금 아카이브</h1>` +
      `<span class="pwa-hero__cta">전체 보기</span>` +
      `</div>`;
    host.append(hero);
    protect(hero.querySelector("img"));

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

    // —— Live pulse (KREAM/Musinsa activity feel) ——
    const pulse = document.createElement("div");
    pulse.className = "pwa-pulse";
    const pulseLines = [];
    shipItems.slice(0, 4).forEach((s) => {
      const t = String(s.title || "").replace(/\s+/g, " ").trim().slice(0, 28);
      if (t) pulseLines.push(`출고 · ${t}`);
    });
    reviewItems.slice(0, 3).forEach((r) => {
      const t = String(r.title || "후기").slice(0, 24);
      pulseLines.push(`후기 · ${t}`);
    });
    if (!pulseLines.length) {
      pulseLines.push("본 헤리티지 · 주문제작 아카이브가 업데이트 중입니다");
    }
    pulse.innerHTML =
      `<span class="pwa-pulse__dot" aria-hidden="true"></span>` +
      `<div class="pwa-pulse__track"><div class="pwa-pulse__move">${pulseLines
        .concat(pulseLines)
        .map((t) => `<span>${t}</span>`)
        .join("")}</div></div>`;
    host.append(pulse);

    // —— Story rings ——
    const stories = document.createElement("section");
    stories.className = "pwa-stories";
    stories.setAttribute("aria-label", "스타일 스토리");
    const storyItems = [
      { src: MEDIA.look[0].src, label: "NEW", go: "portfolio" },
      { src: MEDIA.look[1].src, label: "WEAR", go: "portfolio" },
      { src: MEDIA.look[2].src, label: "GOLD", go: "gold" },
      { src: MEDIA.look[4].src, label: "AI", go: "search" },
      { src: MEDIA.look[5].src, label: "OUT", go: "shipping" },
      { src: MEDIA.look[3].src, label: "REAL", go: "reviews" },
    ];
    storyItems.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pwa-stories__item" + (i === 0 ? " is-new" : "");
      b.dataset.go = s.go;
      b.innerHTML =
        `<span class="pwa-stories__ring"><img src="${assetUrl(s.src)}" alt="" loading="lazy"></span>` +
        `<span class="pwa-stories__lab">${s.label}</span>`;
      protect(b.querySelector("img"));
      stories.append(b);
    });
    host.append(stories);

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

    // Style / wearing (Amonz tone)
    const look = document.createElement("section");
    look.className = "pwa-sec pwa-look";
    look.innerHTML =
      `<div class="pwa-sec__head">` +
      `<div><p class="pwa-sec__eyebrow">STYLE</p><h2>착용 컷</h2></div>` +
      `<button type="button" data-go="portfolio">더보기</button>` +
      `</div>`;
    const lookRail = document.createElement("div");
    lookRail.className = "pwa-look__rail";
    MEDIA.look.forEach((shot) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "pwa-look__card";
      card.dataset.go = "portfolio";
      card.innerHTML =
        `<span class="pwa-look__media"><img src="${assetUrl(shot.src)}" alt="" loading="lazy"></span>` +
        `<span class="pwa-look__tag">${shot.tag}</span>` +
        `<span class="pwa-look__label">${shot.label}</span>`;
      protect(card.querySelector("img"));
      lookRail.append(card);
    });
    look.append(lookRail);
    host.append(look);

    // For you rail
    const secPf = document.createElement("section");
    secPf.className = "pwa-sec";
    secPf.innerHTML =
      `<div class="pwa-sec__head">` +
      `<div><p class="pwa-sec__eyebrow">FOR YOU</p><h2>추천 작품</h2></div>` +
      `<button type="button" data-go="portfolio">전체</button>` +
      `</div>`;
    const rail = document.createElement("div");
    rail.className = "pwa-rail";
    if (!fresh.length) rail.innerHTML = `<p class="pwa-empty">작품을 불러오는 중…</p>`;
    else fresh.forEach((item) => rail.append(cardButton(item, false)));
    secPf.append(rail);
    host.append(secPf);

    // HOT ranking (Musinsa chart vibe)
    const rankSec = document.createElement("section");
    rankSec.className = "pwa-sec";
    rankSec.innerHTML =
      `<div class="pwa-sec__head">` +
      `<div><p class="pwa-sec__eyebrow">CHART</p><h2>지금 핫한 순위</h2></div>` +
      `<button type="button" data-go="portfolio">전체</button>` +
      `</div>`;
    const rankList = document.createElement("div");
    rankList.className = "pwa-rank";
    const ranked = items.slice(0, 5);
    if (!ranked.length) {
      rankList.innerHTML = `<p class="pwa-empty">순위 준비 중</p>`;
    } else {
      ranked.forEach((item, i) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "pwa-rank__row";
        const cat = item.category || "";
        const title = String(item.title || "").replace(/^[A-Z&]+\s+/, "");
        row.innerHTML =
          `<span class="pwa-rank__n">${i + 1}</span>` +
          `<span class="pwa-rank__thumb"><img src="${assetUrl(item.cover || item.image)}" alt="" loading="lazy"></span>` +
          `<span class="pwa-rank__meta"><b>${title || "작품"}</b><i>${cat || "PF"}</i></span>` +
          `<span class="pwa-rank__tag">${i < 2 ? "HOT" : "UP"}</span>`;
        protect(row.querySelector("img"));
        row.addEventListener("click", () => goPortfolio(cat || "ALL", item.id));
        rankList.append(row);
      });
    }
    rankSec.append(rankList);
    host.append(rankSec);

    // 2-col drop (29CM / Musinsa product wall)
    const drop = document.createElement("section");
    drop.className = "pwa-sec";
    drop.innerHTML =
      `<div class="pwa-sec__head">` +
      `<div><p class="pwa-sec__eyebrow">DROP</p><h2>아카이브 드롭</h2></div>` +
      `<button type="button" data-go="portfolio">더보기</button>` +
      `</div>`;
    const grid = document.createElement("div");
    grid.className = "pwa-grid";
    if (!gridItems.length) grid.innerHTML = `<p class="pwa-empty">준비 중</p>`;
    else gridItems.forEach((item) => grid.append(cardButton(item, false)));
    drop.append(grid);
    host.append(drop);

    // Shipping
    const shipSec = document.createElement("section");
    shipSec.className = "pwa-sec";
    shipSec.innerHTML =
      `<div class="pwa-sec__head">` +
      `<div><p class="pwa-sec__eyebrow">OUT</p><h2>최근 출고</h2></div>` +
      `<button type="button" data-go="shipping">출고확인</button>` +
      `</div>`;
    const shipRail = document.createElement("div");
    shipRail.className = "pwa-rail";
    if (!shipItems.length) {
      shipRail.innerHTML = `<p class="pwa-empty">출고 샷 준비 중</p>`;
    } else {
      shipItems.forEach((item) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pwa-card";
        btn.dataset.go = "shipping";
        const title = String(item.title || "").replace(/\s+/g, " ").trim();
        btn.innerHTML =
          `<span class="pwa-card__thumb">` +
          `<span class="pwa-card__cat">${item.category || "OUT"}</span>` +
          `<img alt="" loading="lazy" src="${assetUrl(item.cover || item.image)}">` +
          `</span>` +
          `<span class="pwa-card__brand">${item.category || "OUT"}</span>` +
          `<span class="pwa-card__name">${title}</span>`;
        protect(btn.querySelector("img"));
        shipRail.append(btn);
      });
    }
    shipSec.append(shipRail);
    host.append(shipSec);

    // Reviews
    const secRev = document.createElement("section");
    secRev.className = "pwa-sec";
    secRev.innerHTML =
      `<div class="pwa-sec__head">` +
      `<div><p class="pwa-sec__eyebrow">REVIEW</p><h2>리얼 후기</h2></div>` +
      `<button type="button" data-go="reviews">더보기</button>` +
      `</div>`;
    const revRail = document.createElement("div");
    revRail.className = "pwa-reviews";
    if (!reviewItems.length) {
      revRail.innerHTML =
        `<button type="button" class="pwa-review" data-go="reviews"><strong>실제 제작 후기</strong><p>고객 후기를 확인해 보세요.</p></button>`;
    } else {
      reviewItems.forEach((item) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "pwa-review pwa-review--photo";
        el.dataset.go = "reviews";
        const body = String(item.body || item.content || "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const img = reviewImage(item);
        el.innerHTML =
          (img ? `<span class="pwa-review__media"><img src="${img}" alt="" loading="lazy"></span>` : "") +
          `<span class="pwa-review__body"><strong>${item.title || "후기"}</strong><p>${
            body || "자세한 후기 보기"
          }</p></span>`;
        protect(el.querySelector("img"));
        revRail.append(el);
      });
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
