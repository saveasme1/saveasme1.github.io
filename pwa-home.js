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
  document.body?.classList.add("is-pwa");

  const ICO = {
    reviews:
      '<svg viewBox="0 0 24 24"><path d="M5.5 5.5h13A2 2 0 0 1 20.5 7.5v7A2 2 0 0 1 18.5 16.5H12l-4.2 2.8c-.45.3-1.05-.05-1.05-.6v-2.2H5.5A2 2 0 0 1 3.5 14.5v-7A2 2 0 0 1 5.5 5.5Z" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    shipping:
      '<svg viewBox="0 0 24 24"><path d="M3.8 8.2 12 3.8l8.2 4.4v7.6L12 20.2 3.8 15.8V8.2Z" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 12.2 4.2 8M12 12.2l7.8-4.2M12 12.2V20" stroke-width="1.7" stroke-linecap="round"/></svg>',
    gold:
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.2" stroke-width="1.7"/><path d="M12 8.2v7.6M9.2 10.2c.7-1 1.7-1.5 2.8-1.5 1.6 0 2.8.9 2.8 2.2S13.6 13 12 13s-2.8.8-2.8 2.1c0 1.3 1.3 2.2 3 2.2 1.1 0 2-.4 2.7-1.3" stroke-width="1.7" stroke-linecap="round"/></svg>',
    search:
      '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.2" stroke-width="1.7"/><path d="M16.2 16.2 20 20" stroke-width="1.7" stroke-linecap="round"/></svg>',
  };

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

  function openPortfolio(cat) {
    if (cat && cat !== "ALL") {
      try {
        sessionStorage.setItem("hx.portfolio.cat", cat);
      } catch (_) {}
    }
    if (typeof window.openGongbangPortfolioPanel === "function") {
      window.openGongbangPortfolioPanel();
      // try apply category after panel opens
      setTimeout(() => {
        const btn = document.querySelector(`.pf-cats [data-cat="${cat}"]`);
        if (btn) btn.click();
      }, 350);
      return;
    }
    location.href = "/portfolio.html";
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

  function cardButton(item, brandMap) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pwa-card";
    const cat = item.category || "";
    const brand = brandMap[cat]?.en || cat;
    const title = String(item.title || "").replace(/^[A-Z&]+\s+/, "");
    btn.innerHTML =
      `<span class="pwa-card__thumb">` +
      (cat ? `<span class="pwa-card__cat">${brand || cat}</span>` : "") +
      `<img alt="" loading="lazy" decoding="async" src="${assetUrl(item.cover || item.image)}">` +
      `</span>` +
      `<span class="pwa-card__name">${title}</span>` +
      `<span class="pwa-card__meta">${brand || "HERITAGE"}</span>`;
    if (window.GongbangProtectImage) {
      const img = btn.querySelector("img");
      if (img) window.GongbangProtectImage(img);
    }
    btn.addEventListener("click", () => {
      openPortfolio(cat || "ALL");
      // open detail if possible after short delay
      setTimeout(() => {
        const match = document.querySelector(`[data-id="${item.id}"]`) ||
          [...document.querySelectorAll(".pf-card")].find((el) =>
            (el.textContent || "").includes(String(item.title || "").slice(0, 12))
          );
        if (match) match.click();
      }, 500);
    });
    return btn;
  }

  async function loadJson(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(path);
    return res.json();
  }

  async function boot() {
    const host = ensureHost();
    if (!host) return;

    let portfolio = { items: [], categories: [] };
    let brands = { codes: {} };
    let reviews = { items: [] };
    let notices = { items: [] };
    try {
      [portfolio, brands, reviews, notices] = await Promise.all([
        loadJson("portfolio-data.json").catch(() => portfolio),
        loadJson("brand-codes.json").catch(() => brands),
        loadJson("reviews-data.json").catch(() => reviews),
        loadJson("notices-data.json").catch(() => notices),
      ]);
    } catch (_) {}

    const brandMap = brands.codes || {};
    const items = Array.isArray(portfolio.items) ? portfolio.items.slice() : [];
    const cats = Array.isArray(portfolio.categories) && portfolio.categories.length
      ? portfolio.categories
      : Object.keys(brandMap);

    const heroItem = items[0] || null;
    const heroSrc = heroItem ? assetUrl(heroItem.cover || heroItem.image) : "";
    const fresh = items.slice(0, 12);
    const drop = items.slice(12, 20);
    const reviewItems = (Array.isArray(reviews.items) ? reviews.items : []).slice(0, 6);
    const notice = (Array.isArray(notices.items) ? notices.items : [])[0];

    host.innerHTML = "";

    // Hero
    const hero = document.createElement("section");
    hero.className = "pwa-hero";
    hero.innerHTML =
      `<div class="pwa-hero__media">${
        heroSrc ? `<img src="${heroSrc}" alt="" decoding="async">` : ""
      }<div class="pwa-hero__shade"></div></div>` +
      `<div class="pwa-hero__copy">` +
      `<p class="pwa-hero__kicker">BON HERITAGE</p>` +
      `<h1 class="pwa-hero__title">주문제작 주얼리<br>실사 아카이브</h1>` +
      `<button type="button" class="pwa-hero__cta" data-go="portfolio">포트폴리오 보기</button>` +
      `</div>`;
    host.append(hero);
    if (window.GongbangProtectImage) {
      const img = hero.querySelector("img");
      if (img) window.GongbangProtectImage(img);
    }

    // Categories
    const catsEl = document.createElement("nav");
    catsEl.className = "pwa-cats";
    catsEl.setAttribute("aria-label", "브랜드");
    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.textContent = "전체";
    allBtn.className = "is-on";
    allBtn.addEventListener("click", () => openPortfolio("ALL"));
    catsEl.append(allBtn);
    cats.slice(0, 10).forEach((code) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = brandMap[code]?.en || brandMap[code]?.ko || code;
      b.addEventListener("click", () => openPortfolio(code));
      catsEl.append(b);
    });
    host.append(catsEl);

    // Services
    const services = document.createElement("div");
    services.className = "pwa-services";
    services.innerHTML =
      `<button type="button" data-go="reviews"><span class="pwa-services__ico">${ICO.reviews}</span><span>리얼후기</span></button>` +
      `<button type="button" data-go="shipping"><span class="pwa-services__ico">${ICO.shipping}</span><span>출고확인</span></button>` +
      `<button type="button" data-go="gold"><span class="pwa-services__ico">${ICO.gold}</span><span>금 시세</span></button>` +
      `<button type="button" data-go="search"><span class="pwa-services__ico">${ICO.search}</span><span>사진검색</span></button>`;
    host.append(services);

    // New rail
    const secNew = document.createElement("section");
    secNew.className = "pwa-sec";
    secNew.innerHTML =
      `<div class="pwa-sec__head"><h2>New Arrivals</h2><button type="button" data-go="portfolio">전체보기</button></div>`;
    const rail = document.createElement("div");
    rail.className = "pwa-rail";
    if (!fresh.length) {
      rail.innerHTML = `<p class="pwa-empty">작품을 불러오는 중…</p>`;
    } else {
      fresh.forEach((item) => rail.append(cardButton(item, brandMap)));
    }
    secNew.append(rail);
    host.append(secNew);

    // Drop grid
    if (drop.length) {
      const secDrop = document.createElement("section");
      secDrop.className = "pwa-sec";
      secDrop.innerHTML =
        `<div class="pwa-sec__head"><h2>Selected</h2><button type="button" data-go="portfolio">더보기</button></div>`;
      const grid = document.createElement("div");
      grid.className = "pwa-grid";
      drop.forEach((item) => grid.append(cardButton(item, brandMap)));
      secDrop.append(grid);
      host.append(secDrop);
    }

    // Reviews
    const secRev = document.createElement("section");
    secRev.className = "pwa-sec";
    secRev.innerHTML =
      `<div class="pwa-sec__head"><h2>Real Review</h2><button type="button" data-go="reviews">더보기</button></div>`;
    const revRail = document.createElement("div");
    revRail.className = "pwa-reviews";
    if (!reviewItems.length) {
      revRail.innerHTML = `<div class="pwa-review"><strong>고객 후기</strong><p>실제 제작 후기가 여기에 표시됩니다.</p></div>`;
    } else {
      reviewItems.forEach((item) => {
        const el = document.createElement("article");
        el.className = "pwa-review";
        const body = String(item.body || item.content || "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        el.innerHTML = `<strong>${item.title || "후기"}</strong><p>${body || "자세한 후기를 확인해 보세요."}</p>`;
        el.style.cursor = "pointer";
        el.addEventListener("click", () => {
          if (typeof window.openGongbangReviewsPanel === "function") window.openGongbangReviewsPanel();
        });
        revRail.append(el);
      });
    }
    secRev.append(revRail);
    host.append(secRev);

    // Notice
    const noticeBtn = document.createElement("button");
    noticeBtn.type = "button";
    noticeBtn.className = "pwa-notice";
    noticeBtn.dataset.go = "notices";
    noticeBtn.innerHTML =
      `<span class="pwa-notice__tag">NOTICE</span>` +
      `<span class="pwa-notice__text">${
        (notice && (notice.title || notice.subject)) || "본 헤리티지 공지사항을 확인하세요"
      }</span>`;
    host.append(noticeBtn);

    host.addEventListener("click", (event) => {
      const go = event.target.closest("[data-go]");
      if (!go) return;
      const key = go.getAttribute("data-go");
      if (key === "portfolio") openPortfolio("ALL");
      else if (key === "reviews" && typeof window.openGongbangReviewsPanel === "function") {
        window.openGongbangReviewsPanel();
      } else if (key === "shipping" && typeof window.openGongbangShippingPanel === "function") {
        window.openGongbangShippingPanel();
      } else if (key === "notices" && typeof window.openGongbangBoardPanel === "function") {
        window.openGongbangBoardPanel("notices");
      } else if (key === "notices" && typeof window.openGongbangBoardPanels !== "function") {
        document.getElementById("noticesOpen")?.click();
      } else if (key === "gold") location.href = "./heritage-gold/";
      else if (key === "search") location.href = "./search.html";
      else if (key === "notices") document.getElementById("noticesOpen")?.click();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
