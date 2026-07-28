(() => {
  "use strict";

  const CACHE_KEY = "hx.discover.feed.v3";
  const CACHE_TTL_MS = 12 * 60 * 1000;
  const TYPE_KO = {
    ring: "반지",
    bracelet: "브레이슬릿",
    necklace: "목걸이",
    earring: "귀걸이",
  };
  const PLATFORM_LABEL = {
    instagram: "IG",
    pinterest: "Pin",
    youtube: "YT",
    tiktok: "TT",
  };
  const FALLBACK_BRAND_ORDER = [
    "C", "VCA", "B", "CM", "T&C", "H", "HW", "BO", "PG", "GF", "CHP", "MK", "PO", "DB", "MS", "D", "RS", "F", "CL", "G", "L", "P", "C&H",
  ];
  const BRAND_AVATAR = {
    C: "cartier",
    VCA: "vancleefarpels",
    B: "bvlgari",
    CM: "chaumetofficial",
    "T&C": "tiffanyandco",
    H: "hermes",
    HW: "harrywinston",
    BO: "boucheron",
    PG: "piaget",
    GF: "graff",
    CHP: "chopard",
    MK: "mikimoto",
    PO: "pomellato",
    DB: "debeers",
    MS: "messika",
    D: "damianiofficial",
    RS: "repossi",
    F: "fredjewelry",
    CL: "chanelofficial",
    G: "gucci",
    L: "louisvuitton",
    P: "prada",
    "C&H": "chromeheartsofficial",
  };

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function apiBase() {
    return String(window.HX_WEAR_FEED_API || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  }

  function absUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    try {
      return new URL(String(path).replace(/^\.\//, ""), location.href).href;
    } catch (_) {
      return path;
    }
  }

  function profileUrl(platform, handle) {
    const h = String(handle || "").replace(/^@/, "").trim();
    if (!h) return "";
    if (platform === "youtube") return `https://www.youtube.com/@${encodeURIComponent(h)}`;
    if (platform === "pinterest") return `https://www.pinterest.com/${encodeURIComponent(h)}/`;
    if (platform === "tiktok") return `https://www.tiktok.com/@${encodeURIComponent(h)}`;
    return `https://www.instagram.com/${encodeURIComponent(h)}/`;
  }

  function relativeTimeKo(iso) {
    const ms = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(ms)) return "";
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

  function cacheGet(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const row = JSON.parse(raw);
      if (!row?.exp || Date.now() > row.exp || !Array.isArray(row.items)) return null;
      return row;
    } catch (_) {
      return null;
    }
  }

  function cacheSet(key, items) {
    try {
      localStorage.setItem(key, JSON.stringify({ exp: Date.now() + CACHE_TTL_MS, items }));
    } catch (_) {}
  }

  function setAvatar(av, handle, primaryUrl, platform, brandCode) {
    const h = String(handle || "").replace(/^@/, "").trim().toLowerCase();
    const brandHandle = String(BRAND_AVATAR[brandCode] || "").toLowerCase();
    const handles = [...new Set([h, brandHandle].filter(Boolean))];
    const candidates = [];
    if (primaryUrl) candidates.push(primaryUrl);
    handles.forEach((name) => {
      candidates.push(absUrl(`./wear-media/avatars/ig-real/${name}.jpg`));
      candidates.push(absUrl(`./wear-media/avatars/${name}.jpg`));
      candidates.push(absUrl(`./wear-media/avatars/ig-real/${name}.png`));
      candidates.push(absUrl(`./wear-media/avatars/${name}.png`));
      candidates.push(`${apiBase()}/ig-avatar?u=${encodeURIComponent(name)}&b=1`);
    });
    // brand code fallback files already covered via BRAND_AVATAR

    const tryNext = (i) => {
      if (i >= candidates.length) {
        av.classList.add("hx-ig__avatar--letter");
        av.textContent = (
          (brandCode && String(brandCode).replace(/[^A-Za-z]/g, "").slice(0, 1)) ||
          h.slice(0, 1) ||
          (PLATFORM_LABEL[platform] || "?").slice(0, 1)
        ).toUpperCase();
        return;
      }
      av.classList.remove("hx-ig__avatar--letter");
      av.textContent = "";
      av.innerHTML = `<img alt="" width="36" height="36" loading="lazy" decoding="async" src="${candidates[i]}">`;
      const img = av.querySelector("img");
      if (!img) return tryNext(i + 1);
      img.addEventListener("error", () => tryNext(i + 1), { once: true });
    };
    tryNext(0);
  }

  function openUrl(url) {
    if (!url) return;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (_) {
      location.href = url;
    }
  }

  function youtubeId(permalink) {
    const u = String(permalink || "");
    let m = u.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/i);
    if (m) return m[1];
    m = u.match(/[?&]v=([A-Za-z0-9_-]{6,})/i);
    if (m) return m[1];
    m = u.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/i);
    return m ? m[1] : "";
  }

  function tiktokEmbed(permalink) {
    const u = String(permalink || "").split("?")[0];
    if (!/tiktok\.com\//i.test(u)) return "";
    return `https://www.tiktok.com/embed/v2/${(u.match(/\/video\/(\d+)/) || [])[1] || ""}`;
  }

  async function loadBrandMap() {
    const map = {};
    try {
      const res = await fetch(`./brand-codes.json?v=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      Object.assign(map, data.codes || {});
    } catch (_) {}
    try {
      const res = await fetch(`${apiBase()}/discover/brands`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        (data.brands || []).forEach((b) => {
          map[b.code] = { en: b.nameEn, ko: b.nameKo, ...(map[b.code] || {}) };
        });
      }
    } catch (_) {}
    return map;
  }

  async function loadDiscoverApi(brand) {
    const q = new URLSearchParams({
      brand: brand || "all",
      limit: "80",
      sort: "latest",
    });
    const res = await fetch(`${apiBase()}/discover/feed?${q}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      mode: "cors",
      credentials: "omit",
    });
    if (!res.ok) throw new Error(`discover feed ${res.status}`);
    return res.json();
  }

  async function loadLegacyFallback() {
    const items = [];
    try {
      const res = await fetch(`./hx-ig-wear.json?v=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return items;
      const data = await res.json();
      (data.items || []).forEach((row) => {
        items.push({
          id: row.id,
          platform: "instagram",
          brandCode: row.brandCode,
          displayName: row.displayName,
          handle: row.handle,
          caption: row.captionKo || row.titleKo,
          image: absUrl(row.image),
          avatar: absUrl(row.avatar),
          permalink: row.permalink,
          publishedAt: row.publishedAt,
          mediaType: "image",
          type: row.type,
          productType: row.type,
        });
      });
    } catch (_) {}
    return items;
  }

  function normalizeItem(row) {
    const platform = String(row.platform || "instagram").toLowerCase();
    const permalink = String(row.permalink || "").trim();
    const image = absUrl(row.image || row.thumbnail || "");
    if (!permalink || !image) return null;
    const type = String(row.productType || row.type || "").toLowerCase();
    const handle = String(row.handle || row.profileUsername || "").replace(/^@/, "");
    // Prefer known jewelry types; keep unclassified jewelry if server already filtered
    if (type && !TYPE_KO[type] && type !== "jewelry") return null;
    return {
      id: row.id || `${platform}-${row.externalId || Math.random().toString(36).slice(2)}`,
      platform,
      brandCode: row.brandCode || "",
      displayName: row.displayName || row.profileName || row.brandName || handle,
      handle,
      caption: row.caption || row.captionKo || row.titleKo || "",
      image,
      avatar: row.avatar || row.profileImage || "",
      profilePictureUrl: row.profilePictureUrl || row.profileImage || "",
      permalink,
      publishedAt: row.publishedAt || "",
      mediaType: row.mediaType || "image",
      type,
      typeKo: TYPE_KO[type] || "",
      externalId: row.externalId || youtubeId(permalink),
    };
  }

  async function buildFeed(force, brand) {
    const cacheKey = `${CACHE_KEY}:${brand || "all"}`;
    if (!force) {
      const hit = cacheGet(cacheKey);
      if (hit?.items?.length) return hit.items;
    }
    let raw = [];
    try {
      const data = await loadDiscoverApi(brand || "all");
      raw = data.items || [];
    } catch (_) {
      raw = [];
    }
    if (!raw.length && (!brand || brand === "all")) {
      raw = await loadLegacyFallback();
    }
    const items = raw.map(normalizeItem).filter(Boolean);
    cacheSet(cacheKey, items);
    return items;
  }

  function targetPostId() {
    try {
      const q = new URLSearchParams(location.search).get("post");
      if (q) return q;
      const m = String(location.hash || "").match(/^#(?:post-|hx-post-)?(.+)$/);
      return m ? decodeURIComponent(m[1]) : "";
    } catch (_) {
      return "";
    }
  }

  function scrollToPost(feedRoot) {
    const postId = targetPostId();
    if (!postId || !feedRoot) return;
    const safe = postId.replace(/[^a-zA-Z0-9_-]/g, "_");
    let node = document.getElementById("hx-post-" + safe);
    if (!node) {
      node = Array.from(feedRoot.querySelectorAll("[data-post-id]")).find(
        (el) => el.getAttribute("data-post-id") === postId
      );
    }
    if (!node) return;
    const run = () => {
      const topOffset =
        (Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gb-top-h")) || 48) +
        72;
      const y = node.getBoundingClientRect().top + window.scrollY - topOffset;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      node.classList.add("is-target");
      setTimeout(() => node.classList.remove("is-target"), 2200);
    };
    requestAnimationFrame(() => setTimeout(run, 120));
  }

  function playInline(mediaEl, item) {
    const isVideo = /video|reel|short/i.test(item.mediaType);
    if (!isVideo) {
      openUrl(item.permalink);
      return;
    }
    if (mediaEl.dataset.playing === "1") return;
    mediaEl.dataset.playing = "1";
    mediaEl.classList.add("hx-ig__media--playing");

    if (item.platform === "youtube") {
      const vid = youtubeId(item.permalink) || item.externalId;
      if (!vid) {
        openUrl(item.permalink);
        return;
      }
      mediaEl.innerHTML = `<iframe class="hx-ig__embed" title="youtube" src="https://www.youtube.com/embed/${encodeURIComponent(
        vid
      )}?autoplay=1&playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
      return;
    }

    if (item.platform === "tiktok") {
      const id = (String(item.permalink).match(/\/video\/(\d+)/) || [])[1];
      if (!id) {
        openUrl(item.permalink);
        return;
      }
      mediaEl.innerHTML = `<iframe class="hx-ig__embed" title="tiktok" src="https://www.tiktok.com/embed/v2/${id}" allow="autoplay; encrypted-media" allowfullscreen loading="lazy"></iframe>`;
      return;
    }

    // IG reels / other: keep in-tab poster + open source only via 원문 button
    mediaEl.innerHTML =
      `<img alt="" src="${item.image}"><span class="hx-ig__play" aria-hidden="true"></span>` +
      `<div class="hx-ig__inline-note">탭에서 미리보기 · 원문으로 재생</div>`;
    mediaEl.addEventListener(
      "click",
      () => {
        openUrl(item.permalink);
      },
      { once: true }
    );
  }

  function cardNode(item) {
    const a = el("article", "hx-ig__card");
    const postId = String(item.id || "");
    a.dataset.brand = item.brandCode || "";
    a.dataset.platform = item.platform;
    a.dataset.media = item.mediaType;
    if (postId) {
      a.dataset.postId = postId;
      a.id = "hx-post-" + postId.replace(/[^a-zA-Z0-9_-]/g, "_");
    }

    const handle = String(item.handle || item.platform).replace(/^@/, "");
    const profile = profileUrl(item.platform, handle) || item.permalink;
    const plat = PLATFORM_LABEL[item.platform] || item.platform;

    const head = el("button", "hx-ig__head");
    head.type = "button";
    const av = el("div", "hx-ig__avatar");
    setAvatar(av, handle, item.profilePictureUrl || item.avatar, item.platform, item.brandCode);

    const meta = el("div", "hx-ig__meta");
    const dname = String(item.displayName || "").trim();
    meta.innerHTML =
      `<strong>${handle ? `@${handle}` : dname || plat}</strong>` +
      (dname && handle && dname.toLowerCase() !== handle.toLowerCase()
        ? `<em class="hx-ig__name">${dname}</em>`
        : "") +
      `<span>${item.brandCode || ""}${item.typeKo ? ` · ${item.typeKo}` : ""}</span>`;
    const time = el("time", "hx-ig__time", relativeTimeKo(item.publishedAt));
    head.append(av, meta, time);
    head.addEventListener("click", () => openUrl(profile));

    const media = el("button", "hx-ig__media");
    media.type = "button";
    const isVideo = /video|reel|short/i.test(item.mediaType);
    media.innerHTML =
      `<img alt="" loading="lazy" decoding="async" src="${item.image}">` +
      (isVideo ? `<span class="hx-ig__play" aria-hidden="true"></span>` : "");
    media.querySelector("img")?.addEventListener("error", () => {
      media.classList.add("hx-ig__media--ph");
      media.innerHTML = `<div class="hx-ig__ph"><b>${handle || plat}</b><em>원문 보기</em></div>`;
    });
    media.addEventListener("click", () => playInline(media, item));

    const foot = el("div", "hx-ig__foot");
    const cap = el("p", "hx-ig__caption");
    const body = String(item.caption || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    cap.innerHTML =
      (item.brandCode ? `<b class="hx-ig__badge">${item.brandCode}</b> ` : "") +
      `<span class="hx-ig__seed">${body}</span>`;
    const by = el("div", "hx-ig__by");
    by.innerHTML = `<span></span>`;
    const linkBtn = el("button", "hx-ig__src");
    linkBtn.type = "button";
    linkBtn.textContent = "원문";
    linkBtn.addEventListener("click", () => openUrl(item.permalink));
    by.append(linkBtn);
    foot.append(cap, by);
    a.append(head, media, foot);
    return a;
  }

  async function renderWearFeed(root) {
    if (!root) return false;
    root.replaceChildren();

    let activeBrand = "all";
    const chips = el("div", "hx-chips hx-ig-filters");
    const feed = el("div", "hx-ig");
    const status = el("p", "hx-empty", "불러오는 중…");
    root.append(chips, status, feed);

    let brands = {};
    let items = [];

    function paint() {
      feed.replaceChildren();
      const frag = document.createDocumentFragment();
      items.forEach((item) => {
        try {
          frag.append(cardNode(item));
        } catch (_) {
          /* skip bad card */
        }
      });
      feed.append(frag);
      try {
        scrollToPost(feed);
      } catch (_) {}
    }

    function syncChipState() {
      chips.querySelectorAll("button").forEach((btn) => {
        btn.classList.toggle("is-on", btn.dataset.id === activeBrand);
      });
    }

    function buildChips() {
      chips.replaceChildren();
      const mk = (id, label) => {
        const b = el("button", "", label);
        b.type = "button";
        b.dataset.id = id;
        b.addEventListener("click", () => {
          activeBrand = id;
          syncChipState();
          reload();
        });
        return b;
      };
      chips.append(mk("all", "ALL"));
      const order = [...FALLBACK_BRAND_ORDER];
      Object.keys(brands).forEach((c) => {
        if (!order.includes(c)) order.push(c);
      });
      order.forEach((code) => {
        if (brands[code] || FALLBACK_BRAND_ORDER.includes(code)) chips.append(mk(code, code));
      });
      syncChipState();
    }

    async function reload() {
      status.textContent = "불러오는 중…";
      status.hidden = false;
      feed.replaceChildren();
      try {
        items = await buildFeed(true, activeBrand);
      } catch (_) {
        items = await loadLegacyFallback().then((rows) => rows.map(normalizeItem).filter(Boolean));
      }
      paint();
      if (!items.length) {
        status.hidden = false;
        status.textContent = "표시할 착용컷이 없습니다.";
      } else {
        status.hidden = true;
      }
    }

    brands = await loadBrandMap().catch(() => ({}));
    buildChips();
    await reload();
    return true;
  }

  window.HxWearFeed = { renderWearFeed, buildFeed };
})();
