(() => {
  "use strict";

  const API_BASE = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  const KAKAO_URL = "http://qr.kakao.com/talk/rOLSrSFZxCmHy7mWrkgwuNMH49w-";
  // Isolated try-on MVP (does not live under production routing logic).
  const TRYON_BASE = "https://saveasme1.github.io/heritage-tryon/studio.html";

  function formatViews(count) {
    const n = Math.max(0, Number(count) || 0);
    return `조회 ${n.toLocaleString("ko-KR")}`;
  }

  async function fetchViews(board, ids) {
    const list = [...new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 200);
    if (!board || !list.length) return {};
    try {
      const params = new URLSearchParams({ board, ids: list.join(",") });
      const response = await fetch(`${API_BASE}/views?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return {};
      return payload.views || {};
    } catch (_error) {
      return {};
    }
  }

  async function bumpView(board, id) {
    const itemId = String(id || "").trim();
    if (!board || !itemId) return 0;
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

    const views = document.createElement("span");
    views.className = "post-meta-views";
    views.textContent = viewsText;
    left.append(views);

    const actions = document.createElement("div");
    actions.className = "post-meta-actions";

    const kakao = document.createElement("a");
    kakao.className = "post-meta-kakao";
    kakao.href = KAKAO_URL;
    kakao.target = "_blank";
    kakao.rel = "noopener noreferrer";
    kakao.textContent = "카카오톡 문의하기";
    kakao.addEventListener("click", (event) => event.stopPropagation());
    actions.append(kakao);

    // Portfolio board only — never on shipping/notices/reviews.
    if (options.board === "portfolio" && options.tryOn) {
      const tryOn = document.createElement("a");
      tryOn.className = "post-meta-tryon";
      tryOn.textContent = "Try It On";
      tryOn.target = "_blank";
      tryOn.rel = "noopener noreferrer";
      const params = new URLSearchParams();
      if (options.tryOn.id) params.set("id", options.tryOn.id);
      if (options.tryOn.image) params.set("image", options.tryOn.image);
      if (options.tryOn.title) params.set("title", options.tryOn.title);
      if (options.tryOn.category) params.set("category", options.tryOn.category);
      tryOn.href = `${TRYON_BASE}?${params.toString()}`;
      tryOn.addEventListener("click", (event) => event.stopPropagation());
      actions.append(tryOn);
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
    renderMetaRow,
    syncCarouselHeight,
    setupContentClamp,
  };
})();
