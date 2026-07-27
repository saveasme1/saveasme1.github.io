(() => {
  "use strict";

  /**
   * Discover wear feed — ONLY pre-verified daily JSON.
   * No live Openverse labeling. Empty feed if nothing verified.
   */

  const CACHE_KEY = "hx.wear.feed.v5";
  const LOGO = "./icons/icon-192.png";
  const BRAND_NAME = "본 헤리티지";

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function openPermalink(url) {
    if (!url) return;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (_) {
      location.href = url;
    }
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (_) {
      return "source";
    }
  }

  function sourceLabel(url, fallback) {
    const h = hostOf(url).toLowerCase();
    if (h.includes("flickr")) return "flickr";
    if (h.includes("wikimedia") || h.includes("wikipedia")) return "wikimedia";
    if (h.includes("rawpixel")) return "rawpixel";
    const parts = h.split(".");
    return parts.length >= 2 ? parts[parts.length - 2] : fallback || h || "source";
  }

  function relativeTimeKo(iso, salt) {
    let ms = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(ms)) {
      let h = 0;
      const s = String(salt || "x");
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      ms = Date.now() - (12 * 3600 * 1000 + (Math.abs(h) % (48 * 3600 * 1000)));
    }
    const diff = Math.max(60 * 1000, Date.now() - ms);
    const min = Math.floor(diff / 60000);
    if (min < 60) return `${Math.max(1, min)}분 전`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}시간 전`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}일 전`;
    const mon = Math.floor(day / 30);
    if (mon < 12) return `${mon}개월 전`;
    return `${Math.floor(mon / 12)}년 전`;
  }

  function cacheGet(day) {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const row = JSON.parse(raw);
      if (!row || row.day !== day || !Array.isArray(row.items)) return null;
      return row;
    } catch (_) {
      return null;
    }
  }

  function cacheSet(payload) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch (_) {}
  }

  async function loadDaily(force) {
    const bust = force ? Date.now() : new Date().toISOString().slice(0, 10);
    const res = await fetch(`./hx-wear-daily.json?v=${bust}`, { cache: "no-store" });
    if (!res.ok) throw new Error("daily");
    const data = await res.json();
    if (!force) {
      const hit = cacheGet(data.day);
      if (hit) return hit;
    }
    cacheSet(data);
    return data;
  }

  function cardNode(item) {
    const a = el("article", "hx-ig__card");

    const head = el("div", "hx-ig__head");
    const av = el("div", "hx-ig__avatar");
    av.innerHTML = `<img alt="본 헤리티지" src="${LOGO}" width="36" height="36" loading="lazy">`;
    const meta = el("div", "hx-ig__meta");
    meta.innerHTML = `<strong>${BRAND_NAME}</strong>`;
    const time = el("time", "hx-ig__time", relativeTimeKo(item.indexedOn, item.id));
    head.append(av, meta, time);

    const media = el("button", "hx-ig__media");
    media.type = "button";
    media.setAttribute("aria-label", "원문 열기");
    media.innerHTML = `<img alt="" loading="lazy" decoding="async" src="${item.image}">`;
    media.addEventListener("click", () => openPermalink(item.permalink));

    const foot = el("div", "hx-ig__foot");
    const cap = el("p", "hx-ig__caption");
    // Truthful caption: source title only — never invent portfolio product names
    cap.innerHTML =
      `<b>${item.brandEn || ""}</b> ${String(item.title || "").slice(0, 100)}` +
      `<span class="hx-ig__seed">검증됨 · ${item.verifiedBy || "allowlist"}</span>`;

    const by = el("div", "hx-ig__by");
    by.innerHTML = `<span>BY ${sourceLabel(item.permalink, item.source)}</span>`;
    const linkBtn = el("button", "hx-ig__src");
    linkBtn.type = "button";
    linkBtn.textContent = "링크";
    linkBtn.addEventListener("click", () => openPermalink(item.permalink));
    by.append(linkBtn);

    foot.append(cap, by);
    a.append(head, media, foot);
    return a;
  }

  async function renderWearFeed(root) {
    if (!root) return false;
    root.replaceChildren();

    const hero = el("header", "hx-page__hero");
    hero.innerHTML =
      `<p class="hx-page__eyebrow">STYLE FEED</p>` +
      `<h1 class="hx-page__title">코디 · 착용</h1>` +
      `<p class="hx-page__lead">하루 1회 검증된 해외 원문만 송출합니다. 확실하지 않으면 비웁니다.</p>`;
    root.append(hero);

    const note = el("p", "hx-note");
    note.textContent = "검증 피드 불러오는 중…";
    root.append(note);

    const feed = el("div", "hx-ig");
    root.append(feed);

    try {
      // Clear toxic live-search caches
      try {
        ["hx.wear.feed.v1", "hx.wear.feed.v2", "hx.wear.feed.v3", "hx.wear.feed.v4"].forEach((k) =>
          localStorage.removeItem(k)
        );
      } catch (_) {}

      const data = await loadDaily(true);
      const items = (data.items || []).filter((x) => x && x.image && x.permalink && x.title);

      if (!items.length) {
        note.textContent = `오늘(${data.day || "—"}) 검증 통과 항목 없음 · 오매칭 대신 비움`;
        root.append(
          el(
            "p",
            "hx-disclaimer",
            "자동 플리커 검색으로 포폴 제품명을 붙이지 않습니다. 허용목록·일일 검증을 통과한 원문만 나옵니다."
          )
        );
        return false;
      }

      note.textContent = `${items.length}장 · 일일 검증 ${data.day || ""} · high only`;
      const frag = document.createDocumentFragment();
      items.forEach((item) => frag.append(cardNode(item)));
      feed.append(frag);

      root.append(
        el(
          "p",
          "hx-disclaimer",
          "캡션은 원문 제목입니다. 포폴 SKU와 1:1 동일을 주장하지 않습니다. 하루 1회 자동 갱신(GitHub Action)."
        )
      );
      return true;
    } catch (_) {
      note.textContent = "검증 피드를 불러오지 못했습니다.";
      return false;
    }
  }

  window.HxWearFeed = {
    renderWearFeed,
    loadDaily,
  };
})();
