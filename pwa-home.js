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
    { go: "portfolio", label: "포트폴리오", ico: "portfolio" },
    { go: "reviews", label: "리얼후기", ico: "reviews" },
    { go: "shipping", label: "출고확인", ico: "shipping" },
    { go: "notices", label: "공지", ico: "notices" },
    { go: "search", label: "AI검색", ico: "search" },
    { go: "gold", label: "금시세", ico: "gold" },
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
        `<span class="pwa-card__name">${title}</span>` +
        `<span class="pwa-card__meta">${cat || "PF"}</span>`;
    }
    if (window.GongbangProtectImage) {
      const img = btn.querySelector("img");
      if (img) window.GongbangProtectImage(img);
    }
    btn.addEventListener("click", () => goPortfolio(cat || "ALL", item.id));
    return btn;
  }

  async function loadJson(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(path);
    return res.json();
  }

  function won(n) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    return `${Math.round(Number(n)).toLocaleString("ko-KR")}원`;
  }

  async function fetchGoldDon() {
    try {
      const res = await fetch("https://data-asg.goldprice.org/dbXRates/KRW", { cache: "no-cache" });
      if (res.ok) {
        const data = await res.json();
        const item = Array.isArray(data.items) ? data.items[0] : data;
        const perGram = Number(item?.xauPrice || item?.XAU || 0);
        if (perGram > 0) {
          const don = perGram > 100000 ? perGram * 3.75 : (perGram / 31.1035) * 3.75;
          return { don, at: new Date().toISOString() };
        }
      }
    } catch (_) {}
    return null;
  }

  async function boot() {
    const host = ensureHost();
    if (!host) return;

    let portfolio = { items: [], categories: [] };
    let reviews = { items: [] };
    let notices = { items: [] };
    try {
      [portfolio, reviews, notices] = await Promise.all([
        loadJson("portfolio-data.json").catch(() => portfolio),
        loadJson("reviews-data.json").catch(() => reviews),
        loadJson("notices-data.json").catch(() => notices),
      ]);
    } catch (_) {}

    const items = Array.isArray(portfolio.items) ? portfolio.items.slice() : [];
    const cats =
      Array.isArray(portfolio.categories) && portfolio.categories.length
        ? portfolio.categories
        : [...new Set(items.map((x) => x.category).filter(Boolean))];

    const heroItem = items[0] || null;
    const heroSrc = heroItem ? assetUrl(heroItem.cover || heroItem.image) : "";
    const fresh = items.slice(0, 12);
    const reviewItems = (Array.isArray(reviews.items) ? reviews.items : []).slice(0, 5);
    const notice = (Array.isArray(notices.items) ? notices.items : [])[0];

    let activeCat = "ALL";
    host.innerHTML = "";

    // Hero — KO + EN mix (Musinsa tone)
    const hero = document.createElement("button");
    hero.type = "button";
    hero.className = "pwa-hero";
    hero.dataset.go = "portfolio";
    hero.setAttribute("aria-label", "포트폴리오 보기");
    hero.innerHTML =
      `<div class="pwa-hero__media">${
        heroSrc ? `<img src="${heroSrc}" alt="" decoding="async">` : ""
      }<div class="pwa-hero__shade"></div></div>` +
      `<div class="pwa-hero__copy">` +
      `<p class="pwa-hero__kicker">BON HERITAGE</p>` +
      `<h1 class="pwa-hero__title">주문제작 주얼리<br><em>아카이브</em></h1>` +
      `<p class="pwa-hero__sub">Made to order · 취향대로 맞춰 드립니다</p>` +
      `<span class="pwa-hero__cta">포트폴리오 보기</span>` +
      `</div>`;
    host.append(hero);
    if (window.GongbangProtectImage) {
      const img = hero.querySelector("img");
      if (img) window.GongbangProtectImage(img);
    }

    // Category + peek rail
    const catsWrap = document.createElement("section");
    catsWrap.className = "pwa-index";
    catsWrap.innerHTML =
      `<div class="pwa-index__row">` +
      `<div class="pwa-index__label">카테고리 <span>CATEGORY</span></div>` +
      `<button type="button" class="pwa-index__more" data-cat-more>전체 보기</button>` +
      `</div>`;

    const catsEl = document.createElement("nav");
    catsEl.className = "pwa-cats";
    catsEl.setAttribute("aria-label", "카테고리");

    const peek = document.createElement("div");
    peek.className = "pwa-peek";
    peek.innerHTML =
      `<div class="pwa-peek__hint"><span class="pwa-peek__hint-ico" aria-hidden="true">‹ ›</span> 좌우로 넘겨 보세요</div>` +
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
        rail.innerHTML = `<p class="pwa-peek__empty">이 카테고리 작품이 아직 없어요</p>`;
        return;
      }
      list.forEach((item, i) => {
        const card = cardButton(item, true);
        card.style.setProperty("--i", String(i));
        rail.append(card);
      });
      rail.scrollLeft = 0;
      if (animate) {
        requestAnimationFrame(() => {
          rail.classList.add("is-play");
        });
      } else {
        rail.classList.add("is-play");
        rail.querySelectorAll(".pwa-peek__card").forEach((el) => {
          el.style.animation = "none";
          el.style.opacity = "1";
          el.style.transform = "none";
        });
      }
    }

    function makeCatBtn(code, label) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.cat = code;
      b.innerHTML = `<span>${label}</span>`;
      b.addEventListener("click", () => {
        if (activeCat === code) {
          // 같은 카테고리 재탭 → 포트폴리오 페이지
          goPortfolio(code);
          return;
        }
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

    // New drop / 지금 뜨는
    const secPf = document.createElement("section");
    secPf.className = "pwa-sec";
    secPf.innerHTML =
      `<div class="pwa-sec__head">` +
      `<div><p class="pwa-sec__eyebrow">NOW</p><h2>지금 뜨는 작품</h2></div>` +
      `<button type="button" data-go="portfolio">더보기</button>` +
      `</div>`;
    const rail = document.createElement("div");
    rail.className = "pwa-rail";
    if (!fresh.length) rail.innerHTML = `<p class="pwa-empty">작품을 불러오는 중…</p>`;
    else fresh.forEach((item) => rail.append(cardButton(item, false)));
    secPf.append(rail);
    host.append(secPf);

    // Gold
    const goldSec = document.createElement("section");
    goldSec.className = "pwa-sec";
    goldSec.innerHTML =
      `<div class="pwa-sec__head">` +
      `<div><p class="pwa-sec__eyebrow">MARKET</p><h2>오늘의 금시세</h2></div>` +
      `<a href="./heritage-gold/">자세히</a>` +
      `</div>` +
      `<button type="button" class="pwa-gold" data-go="gold">` +
      `<div class="pwa-gold__top"><span class="pwa-gold__badge">BETA</span><span class="pwa-gold__unit">1돈 · 3.75g</span></div>` +
      `<strong class="pwa-gold__price" id="pwaGoldPrice">…</strong>` +
      `<div class="pwa-gold__row"><span id="pwaGoldMeta">시세 확인 중</span><span class="pwa-gold__more">바로가기 →</span></div>` +
      `</button>`;
    host.append(goldSec);
    fetchGoldDon().then((info) => {
      const price = document.getElementById("pwaGoldPrice");
      const meta = document.getElementById("pwaGoldMeta");
      if (!price) return;
      if (!info) {
        price.textContent = "준비 중";
        if (meta) meta.textContent = "자세히에서 확인";
        return;
      }
      price.textContent = won(info.don);
      if (meta) {
        const t = new Date(info.at || Date.now());
        meta.textContent = `오늘 ${t.toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        })} 기준`;
      }
    });

    // Reviews
    const secRev = document.createElement("section");
    secRev.className = "pwa-sec";
    secRev.innerHTML =
      `<div class="pwa-sec__head">` +
      `<div><p class="pwa-sec__eyebrow">REAL</p><h2>리얼 후기</h2></div>` +
      `<button type="button" data-go="reviews">더보기</button>` +
      `</div>`;
    const revRail = document.createElement("div");
    revRail.className = "pwa-reviews";
    if (!reviewItems.length) {
      revRail.innerHTML =
        `<button type="button" class="pwa-review" data-go="reviews"><strong>실제 제작 후기</strong><p>고객님이 남겨 주신 리얼 후기를 확인해 보세요.</p></button>`;
    } else {
      reviewItems.forEach((item) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "pwa-review";
        el.dataset.go = "reviews";
        const body = String(item.body || item.content || "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        el.innerHTML = `<strong>${item.title || "후기"}</strong><p>${
          body || "자세한 후기를 확인해 보세요."
        }</p>`;
        revRail.append(el);
      });
    }
    secRev.append(revRail);
    host.append(secRev);

    // Notice + AI
    const noticeBtn = document.createElement("button");
    noticeBtn.type = "button";
    noticeBtn.className = "pwa-notice";
    noticeBtn.dataset.go = "notices";
    noticeBtn.innerHTML =
      `<span class="pwa-notice__tag">공지</span>` +
      `<span class="pwa-notice__text">${
        (notice && (notice.title || notice.subject)) || "본 헤리티지 공지사항"
      }</span>`;
    host.append(noticeBtn);

    const ai = document.createElement("button");
    ai.type = "button";
    ai.className = "pwa-ai";
    ai.dataset.go = "search";
    ai.innerHTML =
      `<span class="pwa-ai__tag">AI SEARCH</span>` +
      `<strong>사진으로 찾아보기</strong>` +
      `<span>BETA · 카메라·앨범으로 비슷한 주얼리 검색</span>`;
    host.append(ai);

    host.addEventListener("click", (event) => {
      const go = event.target.closest("[data-go]");
      if (!go) return;
      goRoute(go.getAttribute("data-go"));
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
