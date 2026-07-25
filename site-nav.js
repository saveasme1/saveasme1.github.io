(() => {
  "use strict";
  const HOME = "/landing.html";
  const MYPAGE = "/mypage.html";
  const MQ = "(max-width: 1024px)";

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
  if (isPwaMode()) {
    document.documentElement.classList.add("is-pwa");
    if (document.body) document.body.classList.add("is-pwa");
  }
  const ICONS = {
    portfolio: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="6.5" width="17" height="13" rx="2.2" stroke="currentColor" stroke-width="1.7"/><path d="M8 6.5V5.4A1.9 1.9 0 0 1 9.9 3.5h4.2A1.9 1.9 0 0 1 16 5.4v1.1" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 11h17" stroke="currentColor" stroke-width="1.7"/></svg>`,
    reviews: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5.5 5.5h13A2 2 0 0 1 20.5 7.5v7A2 2 0 0 1 18.5 16.5H12l-4.2 2.8c-.45.3-1.05-.05-1.05-.6v-2.2H5.5A2 2 0 0 1 3.5 14.5v-7A2 2 0 0 1 5.5 5.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 9.5h8M8 12.5h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    home: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 10.2 12 4.2l7.5 6V19a1.8 1.8 0 0 1-1.8 1.8h-3.9v-5.2a1.3 1.3 0 0 0-1.3-1.3h-2a1.3 1.3 0 0 0-1.3 1.3V20.8H6.3A1.8 1.8 0 0 1 4.5 19v-8.8Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
    shipping: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.8 8.2 12 3.8l8.2 4.4v7.6L12 20.2 3.8 15.8V8.2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 12.2 4.2 8M12 12.2l7.8-4.2M12 12.2V20" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    mypage: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8.2" r="3.1" stroke="currentColor" stroke-width="1.7"/><path d="M5.4 19.2c1.4-3.1 3.7-4.7 6.6-4.7s5.2 1.6 6.6 4.7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    authRegister: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9.2" cy="8.2" r="3.1" stroke="currentColor" stroke-width="1.6"/><path d="M3.6 19c1.3-2.9 3.4-4.4 5.6-4.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M16.2 8.2v6.2M13.1 11.3h6.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    authLogin: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8.2" r="3.3" stroke="currentColor" stroke-width="1.6"/><path d="M5.2 19.2c1.5-3.3 3.9-5 6.8-5s5.3 1.7 6.8 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    authLogout: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 4.5H7.5A2.5 2.5 0 0 0 5 7v10a2.5 2.5 0 0 0 2.5 2.5H10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M13.5 12H20M17.2 8.8 20.4 12l-3.2 3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };

  function navItem(key, label, icon, home) {
    if (home) {
      return (
        `<li><button type="button" class="gb-bottom-nav__item is-home" data-nav="${key}">` +
        `<span class="gb-bottom-nav__fab" aria-hidden="true"><span class="gb-bottom-nav__ico">${icon}</span></span>` +
        `<span class="gb-bottom-nav__label">${label}</span>` +
        `</button></li>`
      );
    }
    return (
      `<li><button type="button" class="gb-bottom-nav__item" data-nav="${key}">` +
      `<span class="gb-bottom-nav__ico" aria-hidden="true">${icon}</span>` +
      `<span class="gb-bottom-nav__label">${label}</span>` +
      `</button></li>`
    );
  }
  function ensureStylesheet() {
    if (document.querySelector('link[href*="site-nav.css"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `/site-nav.css?v=20260722-mp24`;
    document.head.appendChild(link);
  }
  function bindBrandHome() {
    if (isStandalonePublicHome()) return;
    document.querySelectorAll(".brand, .board-brand, .brand-link").forEach((node) => {
      if (node.dataset.homeBound === "1") return;
      node.dataset.homeBound = "1";
      const text = (node.textContent || "").trim();
      if (!/GONGBANG\s*171/i.test(text) && !/HERITAGE/i.test(text) && !node.classList.contains("brand-link")) return;
      if (node.tagName === "A") {
        node.href = HOME;
        return;
      }
      const link = document.createElement("a");
      link.className = `${node.className} brand-link`.trim();
      link.href = HOME;
      link.textContent = text || "HERITAGE";
      node.replaceWith(link);
    });
  }
  function isLandingPage() {
    return /\/landing\.html$/i.test(location.pathname);
  }
  function isMyPage() {
    return /\/mypage\.html$/i.test(location.pathname);
  }
  function isPortfolioPage() {
    return /\/portfolio\.html$/i.test(location.pathname);
  }
  function isDiscoverPage() {
    return /\/discover\.html$/i.test(location.pathname);
  }
  function isStandalonePublicHome() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    return path === "/" || /\/index\.html$/i.test(path);
  }
  function syncChromeTheme(name) {
    const key = name || detectActivePanel();
    const paper = key === "portfolio" || key === "shipping";
    document.body.classList.toggle("gb-chrome-paper", paper);
    if (!paper) {
      document.querySelectorAll(".pf-rail.is-scrolling").forEach((el) => {
        el.classList.remove("is-scrolling");
      });
    }
  }
  function setChromeScrolling(on) {
    document.querySelector(".gb-top-brand")?.classList.toggle("is-scrolling", on);
    document.querySelector(".gb-bottom-nav")?.classList.toggle("is-scrolling", on);
    if (document.body.classList.contains("gb-chrome-paper")) {
      document.querySelectorAll(".pf-rail").forEach((el) => {
        el.classList.toggle("is-scrolling", on);
      });
    }
  }
  let chromeScrollTimer = 0;
  function bindChromeScroll() {
    if (bindChromeScroll.bound) return;
    bindChromeScroll.bound = true;
    window.addEventListener(
      "scroll",
      () => {
        setChromeScrolling(true);
        window.clearTimeout(chromeScrollTimer);
        chromeScrollTimer = window.setTimeout(() => setChromeScrolling(false), 170);
      },
      { passive: true }
    );
  }
  function setActiveNav(name) {
    const key = name || "home";
    const nav = document.querySelector(".gb-bottom-nav");
    if (nav) {
      nav.querySelectorAll("[data-nav]").forEach((button) => {
        button.classList.toggle("is-active", button.getAttribute("data-nav") === key);
      });
    }
    syncChromeTheme(key);
  }
  function detectActivePanel() {
    if (isMyPage()) return "mypage";
    if (isPortfolioPage()) return "portfolio";
    if (isDiscoverPage()) return "discover";
    const portfolio = document.getElementById("portfolioPanel");
    const reviews = document.getElementById("reviews");
    const shipping = document.getElementById("shippingPanel");
    const notices = document.getElementById("noticesPanel");
    if (portfolio && !portfolio.hidden) return "portfolio";
    if (reviews && !reviews.hidden) return "reviews";
    if (shipping && !shipping.hidden) return "shipping";
    if (notices && !notices.hidden) return "home";
    const open = new URLSearchParams(location.search).get("open");
    if (open === "portfolio" || open === "reviews" || open === "shipping" || open === "discover") return open;
    return "home";
  }
  function keepAppParam(url) {
    try {
      const next = new URL(url, location.href);
      if (/[?&]app=1(?:&|$)/.test(location.search) || document.documentElement.classList.contains("is-pwa")) {
        if (!next.searchParams.has("app") && /[?&]app=1(?:&|$)/.test(location.search)) {
          next.searchParams.set("app", "1");
        }
      }
      return next.pathname + next.search + next.hash;
    } catch (_) {
      return url;
    }
  }

  function goHome() {
    if (isLandingPage()) {
      if (typeof window.closeGongbangPortfolioPanel === "function") {
        window.closeGongbangPortfolioPanel({ skipNav: true });
      }
      if (typeof window.closeGongbangShippingPanel === "function") {
        window.closeGongbangShippingPanel({ skipNav: true });
      }
      if (typeof window.closeGongbangBoardPanels === "function") {
        window.closeGongbangBoardPanels({ skipNav: true });
      }
      if (typeof window.closeGongbangReviewsPanel === "function") {
        window.closeGongbangReviewsPanel({ skipNav: true });
      }
      setActiveNav("home");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    location.href = keepAppParam(HOME);
  }
  function openMyPage() {
    setActiveNav("mypage");
    if (isMyPage()) return;
    const known = typeof window.getGongbangMember === "function" ? window.getGongbangMember() : null;
    if (known || document.body.dataset.authState === "in") {
      location.href = MYPAGE;
      return;
    }
    const API_BASE = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
    const TOKEN_KEY = "gongbang171.adminToken";
    fetch(`${API_BASE}/auth/me`, {
      credentials: "include",
      headers: sessionStorage.getItem(TOKEN_KEY)
        ? { Authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY)}` }
        : {},
    })
      .then((response) => response.json().catch(() => ({})))
      .then((payload) => {
        if (payload?.member) {
          document.body.dataset.authState = "in";
          location.href = MYPAGE;
          return;
        }
        if (typeof window.openGongbangAuth === "function") {
          window.openGongbangAuth("login", { redirect: MYPAGE });
        } else {
          location.href = `${HOME}?open=mypage`;
        }
      })
      .catch(() => {
        if (typeof window.openGongbangAuth === "function") {
          window.openGongbangAuth("login", { redirect: MYPAGE });
        } else {
          location.href = `${HOME}?open=mypage`;
        }
      });
  }
  function openPanel(name) {
    setActiveNav(name === "portfolio" ? "portfolio" : name);
    if (name === "mypage") {
      openMyPage();
      return;
    }

    // PWA / app shell: page switch like Musinsa·KREAM (no overlay "new window")
    if (isPwaMode() || document.documentElement.classList.contains("is-pwa")) {
      if (name === "discover") {
        if (isDiscoverPage()) {
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        location.href = keepAppParam("/discover.html");
        return;
      }
      if (name === "portfolio") {
        if (isPortfolioPage()) {
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        location.href = keepAppParam("/portfolio.html");
        return;
      }
      if (name === "reviews") {
        location.href = keepAppParam(`${HOME}?open=reviews`);
        return;
      }
      if (name === "shipping") {
        location.href = keepAppParam(`${HOME}?open=shipping`);
        return;
      }
      location.href = keepAppParam(HOME);
      return;
    }

    if (isLandingPage()) {
      if (name === "portfolio" && typeof window.openGongbangPortfolioPanel === "function") {
        window.openGongbangPortfolioPanel();
        return;
      }
      if (name === "reviews" && typeof window.openGongbangReviewsPanel === "function") {
        window.openGongbangReviewsPanel();
        return;
      }
      if (name === "shipping") {
        if (typeof window.openGongbangShippingPanel === "function") {
          window.openGongbangShippingPanel();
        } else if (typeof window.openGongbangBoardPanel === "function") {
          window.openGongbangBoardPanel(name);
        }
        return;
      }
    }
    if (name === "portfolio") {
      if (isPortfolioPage()) {
        setActiveNav("portfolio");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      location.href = `${HOME}?open=portfolio`;
    } else if (name === "reviews") location.href = `${HOME}?open=reviews`;
    else if (name === "shipping") location.href = `${HOME}?open=shipping`;
    else location.href = HOME;
  }
  const API_BASE = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  const TOKEN_KEY = "gongbang171.adminToken";
  let topAuthMember = null;
  function authHeaders() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  async function fetchMember() {
    try {
      const known = typeof window.getGongbangMember === "function" ? window.getGongbangMember() : null;
      if (known) return known;
      const response = await fetch(`${API_BASE}/auth/me`, {
        credentials: "include",
        headers: authHeaders(),
      });
      const payload = await response.json().catch(() => ({}));
      return payload.member || null;
    } catch (_) {
      return null;
    }
  }
  function openAuth(mode) {
    if (typeof window.openGongbangAuth === "function") {
      window.openGongbangAuth(mode || "login", { redirect: mode === "login" ? "" : "" });
      return;
    }
    location.href = `${HOME}?open=mypage`;
  }
  async function logoutFromTop() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: "{}",
      });
    } catch (_) {}
    sessionStorage.removeItem(TOKEN_KEY);
    topAuthMember = null;
    document.body.dataset.authState = "out";
    window.dispatchEvent(new CustomEvent("gongbang:auth-changed", { detail: { member: null } }));
    renderTopAuth();
    if (isMyPage()) location.href = HOME;
  }
  function makeTopAuthButton(label, className, iconHtml, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML =
      `<span class="gb-top-auth-btn__icon" aria-hidden="true">${iconHtml}</span>` +
      `<span class="gb-top-auth-btn__label">${label}</span>`;
    button.addEventListener("click", onClick);
    return button;
  }

  function syncBottomMyPage() {
    // Bottom nav always shows all 5 items (including mypage).
  }

  function renderTopAuth() {
    const host = document.querySelector(".gb-top-brand__auth");
    if (!host) return;
    host.replaceChildren();
    if (topAuthMember || document.body.dataset.authState === "in") {
      host.append(
        makeTopAuthButton("로그아웃", "gb-top-auth-btn", ICONS.authLogout, logoutFromTop),
        makeTopAuthButton("마이페이지", "gb-top-auth-btn is-accent", ICONS.mypage, openMyPage)
      );
      syncBottomMyPage();
      return;
    }
    host.append(
      makeTopAuthButton("회원가입", "gb-top-auth-btn", ICONS.authRegister, () => openAuth("register")),
      makeTopAuthButton("로그인", "gb-top-auth-btn", ICONS.authLogin, () => openAuth("login"))
    );
    syncBottomMyPage();
  }
  function injectTopBrand() {
    if (isStandalonePublicHome()) return;
    if (document.querySelector(".gb-top-brand")) return;
    const header = document.createElement("header");
    header.className = "gb-top-brand";
    header.innerHTML = `
      <span class="gb-top-brand__spacer" aria-hidden="true"></span>
      <a class="gb-top-brand__link" href="${HOME}" aria-label="HERITAGE 홈으로">
        <span class="gb-top-brand__glow" aria-hidden="true"></span>
        <span class="gb-top-brand__text">HERITAGE</span>
        <span class="gb-top-brand__rule" aria-hidden="true"></span>
      </a>
      <div class="gb-top-brand__auth" aria-label="계정 메뉴"></div>`;
    document.body.prepend(header);
    document.body.classList.add("has-gb-top-brand");
    header.querySelector(".gb-top-brand__link").addEventListener("click", (event) => {
      if (!isLandingPage()) return;
      event.preventDefault();
      goHome();
    });
    renderTopAuth();
    fetchMember().then((member) => {
      topAuthMember = member;
      document.body.dataset.authState = member ? "in" : "out";
      renderTopAuth();
    });
    const syncTopHeight = () => {
      const compact = window.scrollY > 8;
      header.classList.toggle("is-compact", compact);
      document.body.classList.toggle("has-gb-top-compact", compact);
      document.documentElement.style.setProperty("--gb-top-h", compact ? "44px" : "48px");
    };
    window.addEventListener(
      "scroll",
      () => {
        syncTopHeight();
      },
      { passive: true }
    );
    syncTopHeight();
    bindChromeScroll();
  }
  function injectBottomNav() {
    if (isStandalonePublicHome()) return;
    if (document.querySelector(".gb-bottom-nav")) return;
    const pwa = document.documentElement.classList.contains("is-pwa") || isPwaMode();
    if (!pwa && !window.matchMedia(MQ).matches) return;
    const nav = document.createElement("nav");
    nav.className = "gb-bottom-nav";
    nav.setAttribute("aria-label", "하단 메뉴");
    nav.innerHTML =
      `<ul class="gb-bottom-nav__bar">` +
      navItem("portfolio", "포트폴리오", ICONS.portfolio) +
      navItem("discover", "발견", ICONS.reviews) +
      navItem("home", "홈", ICONS.home, true) +
      navItem("shipping", "출고확인", ICONS.shipping) +
      navItem("mypage", "마이", ICONS.mypage) +
      `</ul>`;
    document.body.appendChild(nav);
    document.body.classList.add("has-gb-bottom-nav");
    setActiveNav(detectActivePanel());
    nav.querySelectorAll("[data-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.getAttribute("data-nav");
        if (key === "home") goHome();
        else openPanel(key);
      });
    });
    bindChromeScroll();
  }
  function boot() {
    ensureStylesheet();
    injectTopBrand();
    bindBrandHome();
    injectBottomNav();
    bindChromeScroll();
    setActiveNav(detectActivePanel());
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  window.addEventListener("gongbang:auth-changed", (event) => {
    topAuthMember = event.detail?.member || null;
    document.body.dataset.authState = topAuthMember ? "in" : "out";
    renderTopAuth();
  });
  function quickScrollToY(top) {
    const start = window.scrollY || window.pageYOffset || 0;
    const end = Math.max(0, top);
    const delta = end - start;
    if (Math.abs(delta) < 4) return;
    const duration = Math.min(480, Math.max(260, Math.abs(delta) * 0.32));
    const t0 = performance.now();
    const easeOutCubic = (t) => 1 - (1 - t) ** 3;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      window.scrollTo(0, start + delta * easeOutCubic(p));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function scrollToElement(el, pad = 12) {
    if (!el) return;
    const go = () => {
      const topBrand = document.querySelector(".gb-top-brand");
      const topH = topBrand ? topBrand.getBoundingClientRect().height : 0;
      const y = el.getBoundingClientRect().top + (window.scrollY || 0) - topH - pad;
      quickScrollToY(y);
    };
    requestAnimationFrame(() => requestAnimationFrame(go));
  }
  window.GongbangScrollToElement = scrollToElement;
  window.GongbangSiteNav = { bindBrandHome, goHome, openPanel, openMyPage, setActiveNav, detectActivePanel, scrollToElement };
})();
