(() => {
  "use strict";

  /**
   * Portfolio-brand wear/coord feed (customer-facing).
   * Brands: C, B, VCA… · Types: ring|bracelet|necklace|earring
   * Live IG API + curated wear-media. No Flickr/museum/watches.
   */

  const CACHE_KEY = "hx.ig.wear.v4";
  const CACHE_TTL_MS = 30 * 60 * 1000;
  const TYPES = new Set(["ring", "bracelet", "necklace", "earring"]);
  const TYPE_KO = {
    ring: "반지",
    bracelet: "팔찌",
    necklace: "목걸이",
    earring: "귀걸이",
  };
  const BRAND_ORDER = ["C", "B", "VCA", "BO", "CM", "C&H", "CL", "G", "H", "P", "F", "T&C", "L", "D"];

  const BLOCK_HOST =
    /flickr\.|staticflickr\.|metmuseum\.|clevelandart\.|artic\.edu|wikimedia\.org|upload\.wikimedia/i;

  const BLOCK_TEXT =
    /\b(watch|wristwatch|horloge|clock|tank watch|museum|flickr|tribal|beadwork)\b/i;

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

  function profileUrl(handle) {
    const h = String(handle || "").replace(/^@/, "").trim();
    return h ? `https://www.instagram.com/${encodeURIComponent(h)}/` : "";
  }

  function relativeTimeKo(iso, salt) {
    let ms = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(ms)) {
      let h = 0;
      const s = String(salt || "x");
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      ms = Date.now() - (6 * 3600 * 1000 + (Math.abs(h) % (72 * 3600 * 1000)));
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

  function cacheGet() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const row = JSON.parse(raw);
      if (!row?.exp || Date.now() > row.exp || !Array.isArray(row.items)) return null;
      return row;
    } catch (_) {
      return null;
    }
  }

  function cacheSet(items) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ exp: Date.now() + CACHE_TTL_MS, at: Date.now(), items })
      );
    } catch (_) {}
  }

  async function loadBrands() {
    try {
      const res = await fetch(`./brand-codes.json?v=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      return data.codes || {};
    } catch (_) {
      return {};
    }
  }

  async function loadCurated() {
    const res = await fetch(`./hx-ig-wear.json?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("ig-wear");
    return res.json();
  }

  async function loadBackend(brands) {
    const base = String(
      window.HX_WEAR_FEED_API || "https://app.0-1.co.kr/api/handmade/v1"
    ).replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/ig-wear`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          brands: Object.keys(brands),
          types: [...TYPES],
          exclude: ["flickr", "museum", "watch"],
          region: "overseas",
          limit: 48,
        }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.items || data.results || [];
    } catch (_) {
      return [];
    }
  }

  function normalize(row, brands) {
    let code = String(row.brandCode || row.brand || "").trim();
    let brand = brands[code];
    if (!brand && (row.source === "instagram" || code === "IG")) {
      brand = { en: "Instagram", ko: "인스타" };
      code = code || "IG";
    }
    if (!brand) return null;
    const type = String(row.type || "").toLowerCase();
    if (!TYPES.has(type)) return null;
    const permalink = String(row.permalink || row.instagram || row.url || "");
    let image = String(row.image || row.image_url || "");
    if (!permalink || !image) return null;
    if (image.startsWith("./") || image.startsWith("wear-media/")) {
      try {
        image = new URL(image.replace(/^\.\//, ""), location.href).href;
      } catch (_) {}
    }
    if (BLOCK_HOST.test(permalink) || BLOCK_HOST.test(image)) return null;
    const blob = `${row.titleKo || ""} ${row.captionKo || ""} ${row.pieceKo || ""} ${type}`;
    if (BLOCK_TEXT.test(blob)) return null;
    if (/flickr/i.test(row.source || "")) return null;

    const handle = String(row.handle || "").replace(/^@/, "");

    return {
      id: row.id || `ig-${code}-${type}-${Math.random().toString(36).slice(2, 7)}`,
      brandCode: code,
      brandEn: brand.en,
      brandKo: brand.ko,
      type,
      typeKo: TYPE_KO[type],
      pieceKo: row.pieceKo || TYPE_KO[type],
      titleKo: row.titleKo || `${TYPE_KO[type]} 착용`,
      captionKo: row.captionKo || "",
      handle,
      profileUrl: profileUrl(handle) || permalink,
      permalink,
      image,
      publishedAt: row.publishedAt || row.indexedOn || "",
    };
  }

  async function buildFeed(force) {
    if (!force) {
      const hit = cacheGet();
      if (hit?.items?.length) return hit.items;
    }

    try {
      ["hx.ig.wear.v1", "hx.ig.wear.v2", "hx.ig.wear.v3"].forEach((k) =>
        localStorage.removeItem(k)
      );
    } catch (_) {}

    const brands = await loadBrands();
    const curated = await loadCurated();
    const backend = await loadBackend(brands);

    const portfolioCodes = new Set();
    try {
      const cat = await window.HxCatalog?.loadCatalog?.();
      (cat?.items || []).forEach((it) => {
        if (it.brandCode && brands[it.brandCode]) portfolioCodes.add(it.brandCode);
      });
    } catch (_) {}
    if (!portfolioCodes.size) Object.keys(brands).forEach((c) => portfolioCodes.add(c));
    portfolioCodes.add("IG");

    const merged = [];
    const seen = new Set();
    [...backend, ...(curated.items || [])].forEach((row) => {
      const item = normalize(row, brands);
      if (!item) return;
      if (!portfolioCodes.has(item.brandCode)) return;
      if (!item.image) return;
      if (seen.has(item.id) || seen.has(item.permalink + item.type)) return;
      seen.add(item.id);
      seen.add(item.permalink + item.type);
      merged.push(item);
    });

    merged.sort((a, b) => {
      const aLive = a.brandCode === "IG" || String(a.id).startsWith("ig-api-") ? 1 : 0;
      const bLive = b.brandCode === "IG" || String(b.id).startsWith("ig-api-") ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;
      const at = Date.parse(a.publishedAt) || 0;
      const bt = Date.parse(b.publishedAt) || 0;
      return bt - at;
    });
    cacheSet(merged);
    return merged;
  }

  function cardNode(item) {
    const a = el("article", "hx-ig__card");
    a.dataset.brand = item.brandCode;
    a.dataset.type = item.type;

    const handle = item.handle || "instagram";
    const profile = item.profileUrl || profileUrl(handle);

    const head = el("button", "hx-ig__head");
    head.type = "button";
    head.setAttribute("aria-label", `@${handle} 프로필`);
    const av = el("div", "hx-ig__avatar hx-ig__avatar--letter");
    av.textContent = handle.slice(0, 1).toUpperCase() || "I";
    const meta = el("div", "hx-ig__meta");
    meta.innerHTML =
      `<strong>@${handle}</strong>` +
      `<span>${item.brandCode !== "IG" ? item.brandCode + " · " : ""}${item.typeKo}</span>`;
    const time = el("time", "hx-ig__time", relativeTimeKo(item.publishedAt, item.id));
    head.append(av, meta, time);
    head.addEventListener("click", () => openPermalink(profile));

    const media = el("button", "hx-ig__media");
    media.type = "button";
    media.setAttribute("aria-label", "게시물 열기");
    if (item.image && !BLOCK_HOST.test(item.image)) {
      media.innerHTML = `<img alt="" loading="lazy" decoding="async" src="${item.image}">`;
      const img = media.querySelector("img");
      if (img) {
        img.addEventListener("error", () => {
          media.classList.add("hx-ig__media--ph");
          media.innerHTML = `<div class="hx-ig__ph"><b>@${handle}</b><em>원문 보기</em></div>`;
        });
      }
    }
    media.addEventListener("click", () => openPermalink(item.permalink));

    const foot = el("div", "hx-ig__foot");
    const cap = el("p", "hx-ig__caption");
    cap.innerHTML =
      `<b>${item.titleKo}</b>` +
      (item.captionKo ? `<span class="hx-ig__seed">${item.captionKo}</span>` : "");

    const by = el("div", "hx-ig__by");
    by.innerHTML = `<span>@${handle}</span>`;
    const linkBtn = el("button", "hx-ig__src");
    linkBtn.type = "button";
    linkBtn.textContent = "원문";
    linkBtn.addEventListener("click", () => openPermalink(item.permalink));
    by.append(linkBtn);

    foot.append(cap, by);
    a.append(head, media, foot);
    return a;
  }

  async function renderWearFeed(root) {
    if (!root) return false;
    root.replaceChildren();

    const chips = el("div", "hx-chips hx-ig-filters");
    let activeBrand = "all";
    const feed = el("div", "hx-ig");
    root.append(chips, feed);

    let items = [];

    function paint() {
      feed.replaceChildren();
      const rows = items.filter((x) => {
        if (activeBrand !== "all" && x.brandCode !== activeBrand) return false;
        return true;
      });
      if (!rows.length) {
        feed.append(el("p", "hx-empty", "표시할 착용컷이 없습니다."));
        return;
      }
      const frag = document.createDocumentFragment();
      rows.forEach((item) => frag.append(cardNode(item)));
      feed.append(frag);
    }

    function syncChipState() {
      chips.querySelectorAll("button").forEach((btn) => {
        btn.classList.toggle("is-on", btn.dataset.id === activeBrand);
      });
    }

    function buildChips() {
      chips.replaceChildren();
      const present = new Set(items.map((x) => x.brandCode).filter((c) => c && c !== "IG"));
      const ordered = BRAND_ORDER.filter((c) => present.has(c));
      present.forEach((c) => {
        if (!ordered.includes(c)) ordered.push(c);
      });

      const mk = (id, label) => {
        const b = el("button", "", label);
        b.type = "button";
        b.dataset.id = id;
        b.addEventListener("click", () => {
          activeBrand = id;
          syncChipState();
          paint();
        });
        return b;
      };
      chips.append(mk("all", "ALL"));
      ordered.forEach((code) => chips.append(mk(code, code)));
      syncChipState();
    }

    try {
      items = await buildFeed(true);
      if (!items.length) {
        feed.append(el("p", "hx-empty", "표시할 착용컷이 없습니다."));
        return false;
      }
      buildChips();
      paint();
      return true;
    } catch (_) {
      feed.append(el("p", "hx-empty", "피드를 불러오지 못했습니다."));
      return false;
    }
  }

  window.HxWearFeed = { renderWearFeed, buildFeed };
})();
