(() => {
  "use strict";

  const API_BASE = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  const KAKAO_URL = "http://qr.kakao.com/talk/rOLSrSFZxCmHy7mWrkgwuNMH49w-";
  // Isolated try-on MVP (does not live under production routing logic).
  const TRYON_BASE = "https://saveasme1.github.io/heritage-tryon/studio.html";
  const BUMP_THROTTLE_KEY = "hx.viewBump.v1";
  const BUMP_COOLDOWN_MS = 30 * 60 * 1000; // loose: once per item / 30 min
  const VIEWS_CACHE_KEY = "hx.viewsCache.v1";
  const VIEWS_CACHE_TTL_MS = 10 * 60 * 1000; // loose chart refresh

  function formatViews(count) {
    const n = Math.max(0, Number(count) || 0);
    return `조회 ${n.toLocaleString("ko-KR")}`;
  }

  function readViewsCache(key) {
    try {
      const raw = JSON.parse(sessionStorage.getItem(VIEWS_CACHE_KEY) || "{}");
      const hit = raw[key];
      if (!hit || !hit.at || Date.now() - Number(hit.at) > VIEWS_CACHE_TTL_MS) return null;
      return hit.views && typeof hit.views === "object" ? hit.views : null;
    } catch (_) {
      return null;
    }
  }

  function writeViewsCache(key, views) {
    try {
      const raw = JSON.parse(sessionStorage.getItem(VIEWS_CACHE_KEY) || "{}");
      raw[key] = { at: Date.now(), views: views || {} };
      sessionStorage.setItem(VIEWS_CACHE_KEY, JSON.stringify(raw));
    } catch (_) {}
  }

  async function fetchViews(board, ids, options = {}) {
    const list = [...new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 200);
    if (!board || !list.length) return {};
    const period = String(options.period || "").toLowerCase();
    const cacheKey = `${board}:${period || "all"}:${list.slice().sort().join(",")}`;
    if (!options.force) {
      const cached = readViewsCache(cacheKey);
      if (cached) return cached;
    }
    try {
      const params = new URLSearchParams({ board, ids: list.join(",") });
      if (period) params.set("period", period);
      const response = await fetch(`${API_BASE}/views?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return {};
      const views = payload.views || {};
      writeViewsCache(cacheKey, views);
      return views;
    } catch (_error) {
      return {};
    }
  }

  function canBump(board, itemId) {
    try {
      const raw = JSON.parse(sessionStorage.getItem(BUMP_THROTTLE_KEY) || "{}");
      const key = `${board}:${itemId}`;
      const last = Number(raw[key] || 0);
      if (last && Date.now() - last < BUMP_COOLDOWN_MS) return false;
      raw[key] = Date.now();
      // prune old
      Object.keys(raw).forEach((k) => {
        if (Date.now() - Number(raw[k] || 0) > 24 * 60 * 60 * 1000) delete raw[k];
      });
      sessionStorage.setItem(BUMP_THROTTLE_KEY, JSON.stringify(raw));
      return true;
    } catch (_) {
      return true;
    }
  }

  async function bumpView(board, id) {
    const itemId = String(id || "").trim();
    if (!board || !itemId) return 0;
    if (!canBump(board, itemId)) return 0;
    try {
      const params = new URLSearchParams({ board, id: itemId, inc: "1" });
      const response = await fetch(`${API_BASE}/views?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return Number(payload.viewCount) || 0;
      return Number(payload.viewCount) || 0;
    } catch (_error) {
      return 0;
    }
  }

  const SHARE_ICON_SVG =
    '<svg class="post-meta-share-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/>' +
    "</svg>";

  function keepAppQuery(url) {
    try {
      if (!/[?&]app=1(?:&|$)/.test(location.search)) return url;
      const u = new URL(url, location.origin);
      u.searchParams.set("app", "1");
      return u.toString();
    } catch (_) {
      return url;
    }
  }

  function buildShareUrl(options = {}) {
    const explicit = String(options.shareUrl || "").trim();
    if (explicit) return keepAppQuery(explicit);
    const id = String(options.itemId || options.id || "").trim();
    const board = String(options.board || "").trim();
    const origin = location.origin || "https://hand-made.kr";
    if (id && board === "portfolio") return keepAppQuery(`${origin}/portfolio.html?id=${encodeURIComponent(id)}`);
    if (id && board === "shipping") return keepAppQuery(`${origin}/shipping.html?id=${encodeURIComponent(id)}`);
    if (id && board === "notices") return keepAppQuery(`${origin}/notice-view.html?id=${encodeURIComponent(id)}`);
    if (id && board === "reviews") return keepAppQuery(`${origin}/reviews.html?id=${encodeURIComponent(id)}`);
    if (id && board === "groupbuy") return keepAppQuery(`${origin}/groupbuy.html?id=${encodeURIComponent(id)}`);
    try {
      const u = new URL(location.href);
      u.hash = "";
      return u.toString();
    } catch (_) {
      return location.href;
    }
  }

  async function sharePost(options = {}) {
    const url = buildShareUrl(options);
    const title = String(options.shareTitle || options.title || document.title || "공방171").trim();
    const text = String(options.shareText || title).trim();
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return { ok: true, via: "share" };
      }
    } catch (error) {
      if (error && (error.name === "AbortError" || error.name === "NotAllowedError")) {
        return { ok: false, via: "share", aborted: true };
      }
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        return { ok: true, via: "clipboard" };
      }
    } catch (_) {}
    try {
      const input = document.createElement("input");
      input.value = url;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      return { ok: true, via: "clipboard" };
    } catch (_) {
      return { ok: false, via: "none", url };
    }
  }

  function createShareButton(options = {}) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "post-meta-share";
    btn.setAttribute("aria-label", "공유하기");
    btn.title = "공유하기";
    btn.innerHTML = `${SHARE_ICON_SVG}<span class="post-meta-share-label">공유하기</span>`;
    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const result = await sharePost(options);
      if (result.aborted) return;
      if (result.ok && result.via === "clipboard") {
        const prev = btn.innerHTML;
        btn.classList.add("is-copied");
        btn.innerHTML = `${SHARE_ICON_SVG}<span class="post-meta-share-label">복사됨</span>`;
        setTimeout(() => {
          btn.classList.remove("is-copied");
          btn.innerHTML = prev;
        }, 1400);
      } else if (!result.ok && result.url) {
        window.prompt("아래 링크를 복사해 공유하세요.", result.url);
      }
    });
    return btn;
  }

  function renderMetaRow(target, options = {}) {
    if (!target) return;
    const dateText = String(options.dateText || "").trim();
    const viewsText = formatViews(options.viewCount);
    target.replaceChildren();
    target.classList.add("post-meta-row");
    target.hidden = false;

    const left = document.createElement("div");
    left.className = "post-meta-left";

    if (dateText) {
      const time = document.createElement("time");
      time.className = "post-meta-date";
      time.textContent = dateText;
      left.append(time);
      const sep = document.createElement("span");
      sep.className = "post-meta-sep";
      sep.setAttribute("aria-hidden", "true");
      sep.textContent = "·";
      left.append(sep);
    }

    if (!options.hideViews) {
      const views = document.createElement("span");
      views.className = "post-meta-views";
      views.textContent = viewsText;
      left.append(views);
    }

    const actions = document.createElement("div");
    actions.className = "post-meta-actions";

    actions.append(createShareButton(options));

    const kakao = document.createElement("a");
    kakao.className = "post-meta-kakao";
    kakao.href = KAKAO_URL;
    kakao.target = "_blank";
    kakao.rel = "noopener noreferrer";
    kakao.textContent = "카카오톡 문의하기";
    kakao.addEventListener("click", (event) => event.stopPropagation());
    actions.append(kakao);

    // Portfolio board only — never on shipping/notices/reviews.
    // TEMP: hide 착용해보기 until try-on UX is ready again.
    const TRYON_TEMP_HIDDEN = true;
    if (options.board === "portfolio" && options.tryOn) {
      if (!TRYON_TEMP_HIDDEN) {
        const tryOn = document.createElement("button");
        tryOn.type = "button";
        tryOn.className = "post-meta-tryon";
        tryOn.textContent = "착용해보기";
        tryOn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (typeof window.openHeritageTryOn === "function") {
            window.openHeritageTryOn(options.tryOn);
            return;
          }
          // Fallback: same-tab navigation (never a new window)
          const params = new URLSearchParams();
          params.set("embed", "0");
          if (options.tryOn.id) params.set("id", options.tryOn.id);
          if (options.tryOn.title) params.set("title", options.tryOn.title);
          if (options.tryOn.category) params.set("category", options.tryOn.category);
          const image = options.tryOn.path || options.tryOn.image || "";
          if (image) {
            if (/^https?:\/\//i.test(image)) params.set("image", image);
            else params.set("path", String(image).replace(/^\/+/, ""));
          }
          location.href = `${TRYON_BASE}?${params.toString()}`;
        });
        actions.append(tryOn);
      }

      const priceBtn = document.createElement("button");
      priceBtn.type = "button";
      priceBtn.className = "post-meta-pricetrend";
      priceBtn.textContent = "가격추세";
      priceBtn.setAttribute("aria-expanded", "false");
      priceBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof options.onPriceTrend !== "function") return;
        Promise.resolve(options.onPriceTrend())
          .then((open) => {
            priceBtn.setAttribute("aria-expanded", open ? "true" : "false");
          })
          .catch(() => {
            priceBtn.setAttribute("aria-expanded", "false");
          });
      });
      actions.append(priceBtn);
    }

    target.append(left, actions);
  }

  function syncCarouselHeight(viewport) {
    if (!viewport) return;
    viewport.style.removeProperty("height");
  }


  function setupContentClamp(contentEl) {
    if (!contentEl) return;
    const parent = contentEl.parentElement;
    if (!parent) return;

    let btn = parent.querySelector(".content-more-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "content-more-btn";
      contentEl.insertAdjacentElement("afterend", btn);
    }
    btn.textContent = "\uC790\uC138\uD788\uBCF4\uAE30";
    btn.hidden = true;
    btn.onclick = null;

    contentEl.classList.remove("is-expanded");
    contentEl.classList.remove("is-clamped");

    const apply = () => {
      contentEl.classList.remove("is-expanded");
      contentEl.classList.add("is-clamped");
      // Force layout, then compare full scroll size vs visible box.
      const visible = contentEl.getBoundingClientRect().height;
      const full = contentEl.scrollHeight;
      const needs = full > visible + 4;
      if (needs) {
        btn.hidden = false;
        btn.onclick = () => {
          contentEl.classList.remove("is-clamped");
          contentEl.classList.add("is-expanded");
          btn.hidden = true;
        };
      } else {
        contentEl.classList.remove("is-clamped");
        btn.hidden = true;
      }
    };

    // Wait for images/fonts inside html content.
    const imgs = Array.from(contentEl.querySelectorAll("img"));
    let pending = imgs.filter((img) => !img.complete).length;
    const run = () => requestAnimationFrame(() => requestAnimationFrame(apply));
    if (!pending) run();
    else {
      imgs.forEach((img) => {
        if (img.complete) return;
        const done = () => {
          pending -= 1;
          if (pending <= 0) run();
        };
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
      // safety timeout
      setTimeout(run, 400);
    }
  }

  window.GongbangBoardMeta = {
    KAKAO_URL,
    formatViews,
    fetchViews,
    bumpView,
    buildShareUrl,
    sharePost,
    createShareButton,
    renderMetaRow,
    syncCarouselHeight,
    setupContentClamp,
  };
})();
