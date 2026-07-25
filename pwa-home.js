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
    { go: "notices", label: "공지사항", ico: "notices" },
    { go: "search", label: "AI 검색", ico: "search" },
    { go: "gold", label: "금 시세", ico: "gold" },
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

  function goPortfolio(cat) {
    const q = cat && cat !== "ALL" ? `?cat=${encodeURIComponent(cat)}` : "";
    location.href = `./portfolio.html${q}`;
  }

  function goRoute(key) {
    if (key === "portfolio") {
      goPortfolio("ALL");
      return;
    }
    if (key === "search") {
      location.href = "./search.html";
      return;
    }
    if (key === "gold") {
      location.href = "./heritage-gold/";
      return;
    }
    if (key === "reviews") {
      location.href = "./landing.html?open=reviews";
      return;
    }
    if (key === "shipping") {
      location.href = "./landing.html?open=shipping";
      return;
    }
    if (key === "notices") {
      location.href = "./landing.html?open=notices";
      return;
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

  function cardButton(item) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pwa-card";
    const cat = item.category || "";
    const title = String(item.title || "").replace(/^[A-Z&]+\s+/, "");
    btn.innerHTML =
      `<span class="pwa-card__thumb">` +
      (cat ? `<span class="pwa-card__cat">${cat}</span>` : "") +
      `<img alt="" loading="lazy" decoding="async" src="${assetUrl(item.cover || item.image)}">` +
      `</span>` +
      `<span class="pwa-card__name">${title}</span>` +
      `<span class="pwa-card__meta">${cat || "PORTFOLIO"}</span>`;
    if (window.GongbangProtectImage) {
      const img = btn.querySelector("img");
      if (img) window.GongbangProtectImage(img);
    }
    btn.addEventListener("click", () => {
      const id = item.id ? `&id=${encodeURIComponent(item.id)}` : "";
      location.href = `./portfolio.html?cat=${encodeURIComponent(cat || "ALL")}${id}`;
    });
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
    // 1돈 = 3.75g. Prefer KRW gold feed, fallback USD*FX.
    try {
      const res = await fetch("https://data-asg.goldprice.org/dbXRates/KRW", {
        cache: "no-cache",
      });
      if (res.ok) {
        const data = await res.json();
        const item = Array.isArray(data.items) ? data.items[0] : data;
        const perGram = Number(item?.xauPrice || item?.XAU || 0);
        if (perGram > 0) {
          // feed often returns KRW per gram or per oz — detect by magnitude
          const don = perGram > 100000 ? perGram * 3.75 : (perGram / 31.1035) * 3.75;
          return { don, source: "goldprice", at: new Date().toISOString() };
        }
      }
    } catch (_) {}

    try {
      const res = await fetch(
        (window.JEWELRY_PRICE_API || "https://app.0-1.co.kr/api/jewelry-price/v1").replace(/\/$/, "") +
          "/health",
        { cache: "no-cache" }
      );
      if (res.ok) {
        const data = await res.json();
        const usdKrw = Number(data?.fx?.rates?.USD || 0);
        // approximate XAU USD/oz
        let xauUsd = 0;
        try {
          const g = await fetch("https://api.gold-api.com/price/XAU", { cache: "no-cache" });
          if (g.ok) {
            const gj = await g.json();
            xauUsd = Number(gj.price || gj.price_usd || 0);
          }
        } catch (_) {}
        if (usdKrw > 0 && xauUsd > 0) {
          const don = (xauUsd / 31.1035) * 3.75 * usdKrw;
          return { don, source: "fx+spot", at: new Date().toISOString() };
        }
      }
    } catch (_) {}

    return null;
  }

  function mountGoldSection(host) {
    const sec = document.createElement("section");
    sec.className = "pwa-sec pwa-sec--gold";
    sec.innerHTML =
      `<div class="pwa-sec__head"><h2>금 시세</h2><a href="./heritage-gold/">더보기</a></div>` +
      `<button type="button" class="pwa-gold" data-go="gold" aria-label="금 시세 자세히">` +
      `<div class="pwa-gold__top"><span class="pwa-gold__badge">BETA</span><span class="pwa-gold__unit">1돈 (3.75g) · 참고용</span></div>` +
      `<strong class="pwa-gold__price" id="pwaGoldPrice">불러오는 중…</strong>` +
      `<div class="pwa-gold__row"><span id="pwaGoldMeta">시세 확인 중</span><span class="pwa-gold__more">상세 보기 →</span></div>` +
      `</button>`;
    host.append(sec);

    fetchGoldDon().then((info) => {
      const price = document.getElementById("pwaGoldPrice");
      const meta = document.getElementById("pwaGoldMeta");
      if (!price) return;
      if (!info) {
        price.textContent = "시세 준비 중";
        if (meta) meta.textContent = "더보기에서 확인하세요";
        return;
      }
      price.textContent = won(info.don);
      if (meta) {
        const t = info.at ? new Date(info.at) : new Date();
        meta.textContent = `오늘 ${t.toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        })} 기준`;
      }
    });
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
    const reviewItems = (Array.isArray(reviews.items) ? reviews.items : []).slice(0, 6);
    const notice = (Array.isArray(notices.items) ? notices.items : [])[0];

    host.innerHTML = "";

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

    const catsEl = document.createElement("nav");
    catsEl.className = "pwa-cats";
    catsEl.setAttribute("aria-label", "카테고리");
    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.textContent = "ALL";
    allBtn.className = "is-on";
    allBtn.addEventListener("click", () => goPortfolio("ALL"));
    catsEl.append(allBtn);
    cats.forEach((code) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = String(code);
      b.addEventListener("click", () => goPortfolio(code));
      catsEl.append(b);
    });
    host.append(catsEl);

    const services = document.createElement("div");
    services.className = "pwa-services pwa-services--6";
    services.innerHTML = MENUS.map(
      (m) =>
        `<button type="button" data-go="${m.go}"><span class="pwa-services__ico">${ICO[m.ico]}</span><span>${m.label}</span></button>`
    ).join("");
    host.append(services);

    const secPf = document.createElement("section");
    secPf.className = "pwa-sec";
    secPf.innerHTML =
      `<div class="pwa-sec__head"><h2>Portfolio</h2><button type="button" data-go="portfolio">전체보기</button></div>`;
    const rail = document.createElement("div");
    rail.className = "pwa-rail";
    if (!fresh.length) rail.innerHTML = `<p class="pwa-empty">작품을 불러오는 중…</p>`;
    else fresh.forEach((item) => rail.append(cardButton(item)));
    secPf.append(rail);
    host.append(secPf);

    mountGoldSection(host);

    const secRev = document.createElement("section");
    secRev.className = "pwa-sec";
    secRev.innerHTML =
      `<div class="pwa-sec__head"><h2>Real Review</h2><button type="button" data-go="reviews">더보기</button></div>`;
    const revRail = document.createElement("div");
    revRail.className = "pwa-reviews";
    if (!reviewItems.length) {
      revRail.innerHTML =
        `<button type="button" class="pwa-review" data-go="reviews"><strong>고객 후기</strong><p>실제 제작 후기를 확인해 보세요.</p></button>`;
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

    // AI search promo strip
    const ai = document.createElement("button");
    ai.type = "button";
    ai.className = "pwa-ai";
    ai.dataset.go = "search";
    ai.innerHTML =
      `<span class="pwa-ai__tag">AI SEARCH</span>` +
      `<strong>사진으로 비슷한 주얼리 찾기</strong>` +
      `<span>BETA · 카메라·앨범으로 검색</span>`;
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
