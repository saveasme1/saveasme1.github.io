(() => {
  "use strict";

  const MQ = "(max-width: 1024px)";
  const HOME = "/admin/";

  const ICONS = {
    portfolio: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h3.2c.4 0 .8.2 1 .5l.8 1.1c.2.3.6.5 1 .5h5A2.5 2.5 0 0 1 20 9.6v7.9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10Z" stroke="currentColor" stroke-width="1.7"/><path d="M8 13h8M8 16h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    reviews: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.2 5.7h11.6c.9 0 1.6.7 1.6 1.6v7c0 .9-.7 1.6-1.6 1.6H11l-3.7 2.9c-.4.3-1.1 0-1.1-.6v-2.3H6.2c-.9 0-1.6-.7-1.6-1.6v-7c0-.9.7-1.6 1.6-1.6z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 9.2h6M9 12h4.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    home: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.2 3.1 10.8c-.3.2-.1.7.3.7h1.5V20c0 .6.4 1 1 1h5.1v-6.2c0-.6.4-1 1-1h1.9c.6 0 1 .4 1 1V21h5.1c.6 0 1-.4 1-1v-8.5h1.5c.4 0 .6-.5.3-.7L12 3.2z" fill="currentColor"/></svg>`,
    shipping: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 8.2 12 3.8l8.5 4.4v7.6L12 20.2 3.5 15.8V8.2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 12.1 3.8 7.9M12 12.1l8.2-4.2M12 12.1V20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    notices: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5.5 10.2c0-3.4 2.9-6.2 6.5-6.2s6.5 2.8 6.5 6.2v4.1l1.4 2.1H4.1l1.4-2.1v-4.1z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 19.2a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  };

  const ROUTES = {
    portfolio: "/admin/portfolio/",
    reviews: "/admin/reviews/",
    home: HOME,
    shipping: "/admin/shipping/",
    notices: "/admin/notices/",
  };

  function detectActiveNav() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    if (/\/admin\/portfolio$/i.test(path)) return "portfolio";
    if (/\/admin\/reviews$/i.test(path)) return "reviews";
    if (/\/admin\/shipping$/i.test(path)) return "shipping";
    if (/\/admin\/notices$/i.test(path)) return "notices";
    if (/\/admin$/i.test(path)) return "home";
    return "home";
  }

  function isLoggedInAdminView() {
    const hub = document.getElementById("adminHub");
    const app = document.getElementById("adminApp");
    if (hub && !hub.hidden) return true;
    if (app && !app.hidden) return true;
    return false;
  }

  function setActiveNav(name) {
    const nav = document.querySelector(".gb-admin-bottom-nav");
    if (!nav) return;
    const key = name || "home";
    nav.querySelectorAll("[data-nav]").forEach((button) => {
      button.classList.toggle("is-active", button.getAttribute("data-nav") === key);
    });
  }

  function syncNavVisibility() {
    const nav = document.querySelector(".gb-admin-bottom-nav");
    if (!nav) return;
    const show = window.matchMedia(MQ).matches && isLoggedInAdminView();
    nav.hidden = !show;
    document.body.classList.toggle("has-admin-bottom-nav", show);
    if (show) setActiveNav(detectActiveNav());
  }

  function injectBottomNav() {
    if (document.querySelector(".gb-admin-bottom-nav")) {
      syncNavVisibility();
      return;
    }

    const nav = document.createElement("nav");
    nav.className = "gb-admin-bottom-nav";
    nav.setAttribute("aria-label", "관리자 하단 메뉴");
    nav.hidden = true;
    nav.innerHTML = `
      <ul class="gb-admin-bottom-nav__bar">
        <li><button type="button" class="gb-admin-bottom-nav__item" data-nav="portfolio">${ICONS.portfolio}<span>포트폴리오 관리</span></button></li>
        <li><button type="button" class="gb-admin-bottom-nav__item" data-nav="reviews">${ICONS.reviews}<span>고객후기 관리</span></button></li>
        <li><button type="button" class="gb-admin-bottom-nav__item is-home" data-nav="home">${ICONS.home}<span>홈으로</span></button></li>
        <li><button type="button" class="gb-admin-bottom-nav__item" data-nav="shipping">${ICONS.shipping}<span>출고관리</span></button></li>
        <li><button type="button" class="gb-admin-bottom-nav__item" data-nav="notices">${ICONS.notices}<span>공지사항 관리</span></button></li>
      </ul>`;
    document.body.appendChild(nav);

    nav.querySelectorAll("[data-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.getAttribute("data-nav");
        const href = ROUTES[key] || HOME;
        if (location.pathname.replace(/\/+$/, "") === href.replace(/\/+$/, "")) {
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        location.href = href;
      });
    });

    let scrollTimer = 0;
    window.addEventListener(
      "scroll",
      () => {
        nav.classList.add("is-scrolling");
        window.clearTimeout(scrollTimer);
        scrollTimer = window.setTimeout(() => nav.classList.remove("is-scrolling"), 180);
      },
      { passive: true }
    );

    window.matchMedia(MQ).addEventListener("change", syncNavVisibility);

    const targets = [document.getElementById("adminHub"), document.getElementById("adminApp")].filter(Boolean);
    if (targets.length) {
      const observer = new MutationObserver(syncNavVisibility);
      targets.forEach((node) => observer.observe(node, { attributes: true, attributeFilter: ["hidden"] }));
    }

    syncNavVisibility();
  }

  const EYE_OPEN = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.8" stroke="currentColor" stroke-width="1.7"/></svg>`;
  const EYE_OFF = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3l18 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M10.1 10.2a2.8 2.8 0 0 0 3.8 3.8M6.2 6.7C4.1 8.1 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.4 4.2-1M17.5 14.8c1.7-1.3 2.9-2.8 3.5-3.8 0 0-3.5-6.5-9.5-6.5-.9 0-1.8.1-2.5.3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;

  function enhancePasswordToggle() {
    const input = document.getElementById("passwordInput");
    if (!input || input.dataset.eyeReady === "1") return;
    input.dataset.eyeReady = "1";

    const wrap = document.createElement("span");
    wrap.className = "password-input-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "password-toggle";
    button.setAttribute("aria-label", "비밀번호 표시");
    button.setAttribute("aria-pressed", "false");
    button.title = "비밀번호 표시";
    button.innerHTML = EYE_OPEN;

    const sync = () => {
      const visible = input.type === "text";
      button.innerHTML = visible ? EYE_OFF : EYE_OPEN;
      button.setAttribute("aria-pressed", visible ? "true" : "false");
      button.setAttribute("aria-label", visible ? "비밀번호 숨기기" : "비밀번호 표시");
      button.title = visible ? "비밀번호 숨기기" : "비밀번호 표시";
    };

    button.addEventListener("click", () => {
      input.type = input.type === "password" ? "text" : "password";
      sync();
      input.focus({ preventScroll: true });
    });

    wrap.appendChild(button);
    sync();
  }

  function boot() {
    enhancePasswordToggle();
    injectBottomNav();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.GongbangAdminNav = { syncNavVisibility, setActiveNav, detectActiveNav, enhancePasswordToggle };
})();