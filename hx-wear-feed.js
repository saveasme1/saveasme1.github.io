(() => {
  "use strict";

  const CACHE_KEY = "hx.discover.feed.v1";
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

  function setAvatar(av, handle, primaryUrl, platform) {
    const h = String(handle || "").replace(/^@/, "").trim().toLowerCase();
    const candidates = [
      primaryUrl,
      platform === "instagram" && h ? absUrl(`./wear-media/avatars/ig-real/${h}.jpg`) : "",
      platform === "instagram" && h ? absUrl(`./wear-media/avatars/${h}.jpg`) : "",
      platform === "instagram" && h
        ? `${apiBase()}/ig-avatar?u=${encodeURIComponent(h)}&b=1`
        : "",
    ].filter(Boolean);

    const tryNext = (i) => {
      if (i >= candidates.length) {
        av.classList.add("hx-ig__avatar--letter");
        av.textContent = (h.slice(0, 1) || (PLATFORM_LABEL[platform] || "?").slice(0, 1)).toUpperCase();
        return;
      }
      av.classList.remove("hx-ig__avatar--letter");
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
          map[b.code] = {
            en: b.nameEn,
            ko: b.nameKo,
            ...(map[b.code] || {}),
          };
        });
      }
    } catch (_) {}
    return map;
  }

  async function loadDiscoverApi(params) {
    const q = new URLSearchParams({
      brand: params.brand || "all",
      platform: params.platform || "all",
      media: params.media || "all",
      sort: params.sort || "latest",
      limit: String(params.limit || 80),
    });
    const res = await fetch(`${apiBase()}/discover/feed?${q}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("discover feed");
    return res.json();
  }

  async function loadLegacyFallback() {
    const items = [];
    try {
      const res = await fetch(`./hx-ig-wear.json?v=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        (data.items || []).forEach((row) => {
          items.push({
            id: row.id,
            platform: "instagram",
            brandCode: row.brandCode,
            brandName: row.displayName,
            displayName: row.displayName,
            handle: row.handle,
            caption: row.captionKo || row.titleKo,
            titleKo: row.titleKo,
            captionKo: row.captionKo,
            image: absUrl(row.image),
            thumbnail: absUrl(row.image),
            avatar: absUrl(row.avatar),
            permalink: row.permalink,
            publishedAt: row.publishedAt,
            mediaType: "image",
            type: row.type,
            productType: row.type,
            source: "curated_local",
            styleTags: ["wear"],
            aiTags: row.tags || [],
          });
        });
      }
    } catch (_) {}
    return items;
  }

  function normalizeItem(row) {
    const platform = String(row.platform || "instagram").toLowerCase();
    const permalink = String(row.permalink || "").trim();
    const image = absUrl(row.image || row.thumbnail || "");
    if (!permalink || !image) return null;
    const handle = String(row.handle || row.profileUsername || "").replace(/^@/, "");
    const type = String(row.productType || row.type || "").toLowerCase();
    return {
      id: row.id || `${platform}-${row.externalId || Math.random().toString(36).slice(2)}`,
      platform,
      brandCode: row.brandCode || "",
      brandName: row.brandName || "",
      displayName: row.displayName || row.profileName || row.brandName || handle,
      handle,
      caption: row.caption || row.captionKo || row.titleKo || "",
      titleKo: row.titleKo || row.caption || "",
      captionKo: row.captionKo || row.caption || "",
      image,
      avatar: row.avatar || row.profileImage || "",
      profilePictureUrl: row.profilePictureUrl || row.profileImage || "",
      permalink,
      publishedAt: row.publishedAt || "",
      mediaType: row.mediaType || "image",
      type,
      typeKo: TYPE_KO[type] || "",
      source: row.source || "",
      styleTags: Array.isArray(row.styleTags) ? row.styleTags : [],
      aiTags: Array.isArray(row.aiTags) ? row.aiTags : [],
      isPinned: !!row.isPinned,
      isFeatured: !!row.isFeatured,
      popularity: Number(row.popularity || 0),
    };
  }

  async function buildFeed(force, filters) {
    const cacheKey = `${CACHE_KEY}:${filters.brand}:${filters.platform}:${filters.media}:${filters.sort}`;
    if (!force) {
      const hit = cacheGet(cacheKey);
      if (hit?.items?.length) return hit.items;
    }
    let raw = [];
    try {
      const data = await loadDiscoverApi(filters);
      raw = data.items || [];
    } catch (_) {
      raw = [];
    }
    if (!raw.length && filters.platform === "all" && filters.brand === "all") {
      raw = await loadLegacyFallback();
    }
    const items = raw.map(normalizeItem).filter(Boolean);
    cacheSet(cacheKey, items);
    return items;
  }

  function cardNode(item) {
    const a = el("article", "hx-ig__card");
    a.dataset.brand = item.brandCode || "";
    a.dataset.platform = item.platform;
    a.dataset.media = item.mediaType;

    const handle = String(item.handle || item.platform).replace(/^@/, "");
    const profile = profileUrl(item.platform, handle) || item.permalink;

    const head = el("button", "hx-ig__head");
    head.type = "button";
    const av = el("div", "hx-ig__avatar");
    setAvatar(av, handle, item.profilePictureUrl || item.avatar, item.platform);

    const meta = el("div", "hx-ig__meta");
    const plat = PLATFORM_LABEL[item.platform] || item.platform;
    const dname = String(item.displayName || "").trim();
    meta.innerHTML =
      `<strong>${handle ? `@${handle}` : dname || plat}</strong>` +
      (dname && handle && dname.toLowerCase() !== handle.toLowerCase()
        ? `<em class="hx-ig__name">${dname}</em>`
        : "") +
      `<span><i class="hx-ig__plat hx-ig__plat--${item.platform}">${plat}</i>${
        item.brandCode ? ` · ${item.brandCode}` : ""
      }${item.typeKo ? ` · ${item.typeKo}` : ""}</span>`;
    const timeTxt = relativeTimeKo(item.publishedAt);
    const time = el("time", "hx-ig__time", timeTxt);
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
    media.addEventListener("click", () => openUrl(item.permalink));

    const foot = el("div", "hx-ig__foot");
    const cap = el("p", "hx-ig__caption");
    const body = item.caption || item.titleKo || "";
    cap.innerHTML =
      (item.brandCode ? `<b class="hx-ig__badge">${item.brandCode}</b> ` : "") +
      `<span class="hx-ig__seed">${body}</span>`;
    const by = el("div", "hx-ig__by");
    by.innerHTML = `<span>${plat}</span>`;
    const linkBtn = el("button", "hx-ig__src");
    linkBtn.type = "button";
    linkBtn.textContent = "원문";
    linkBtn.addEventListener("click", () => openUrl(item.permalink));
    by.append(linkBtn);
    foot.append(cap, by);
    a.append(head, media, foot);
    return a;
  }

  function mkChip(label, on, click) {
    const b = el("button", on ? "is-on" : "", label);
    b.type = "button";
    b.addEventListener("click", click);
    return b;
  }

  async function renderWearFeed(root) {
    if (!root) return false;
    root.replaceChildren();

    const hero = el("header", "hx-page__hero");
    hero.innerHTML =
      `<p class="hx-page__eyebrow">DISCOVER</p>` +
      `<h1 class="hx-page__title">발견</h1>` +
      `<p class="hx-page__lead">브랜드 공개 콘텐츠 · Instagram · Pinterest · YouTube · TikTok</p>`;

    const filters = {
      brand: "all",
      platform: "all",
      media: "all",
      sort: "latest",
    };

    const platChips = el("div", "hx-chips hx-ig-filters hx-ig-filters--plat");
    const brandChips = el("div", "hx-chips hx-ig-filters");
    const mediaChips = el("div", "hx-chips hx-ig-filters hx-ig-filters--media");
    const feed = el("div", "hx-ig");
    const status = el("p", "hx-empty", "불러오는 중…");
    root.append(hero, platChips, brandChips, mediaChips, status, feed);

    let brands = {};
    let items = [];

    async function reload() {
      status.textContent = "불러오는 중…";
      status.hidden = false;
      feed.replaceChildren();
      try {
        items = await buildFeed(true, filters);
        paint();
        status.hidden = true;
        if (!items.length) {
          status.hidden = false;
          status.textContent = "표시할 콘텐츠가 없습니다. 잠시 후 다시 열어 주세요.";
        }
      } catch (_) {
        status.hidden = false;
        status.textContent = "피드를 불러오지 못했습니다.";
      }
    }

    function paint() {
      feed.replaceChildren();
      const frag = document.createDocumentFragment();
      items.forEach((item) => frag.append(cardNode(item)));
      feed.append(frag);
    }

    function paintBrandChips() {
      brandChips.replaceChildren();
      const order = [...FALLBACK_BRAND_ORDER];
      Object.keys(brands).forEach((c) => {
        if (!order.includes(c)) order.push(c);
      });
      brandChips.append(
        mkChip("ALL", filters.brand === "all", () => {
          filters.brand = "all";
          paintBrandChips();
          reload();
        })
      );
      order.forEach((code) => {
        if (!brands[code] && !FALLBACK_BRAND_ORDER.includes(code)) return;
        brandChips.append(
          mkChip(code, filters.brand === code, () => {
            filters.brand = code;
            paintBrandChips();
            reload();
          })
        );
      });
    }

    function paintPlatChips() {
      platChips.replaceChildren();
      [
        ["all", "ALL"],
        ["instagram", "Instagram"],
        ["pinterest", "Pinterest"],
        ["youtube", "YouTube"],
        ["tiktok", "TikTok"],
      ].forEach(([id, label]) => {
        platChips.append(
          mkChip(label, filters.platform === id, () => {
            filters.platform = id;
            paintPlatChips();
            reload();
          })
        );
      });
    }

    function paintMediaChips() {
      mediaChips.replaceChildren();
      [
        ["all", "전체"],
        ["latest", "최신순", "sort"],
        ["popular", "인기순", "sort"],
        ["image", "이미지"],
        ["video", "영상"],
        ["wear", "착용샷"],
        ["coord", "코디"],
      ].forEach((row) => {
        const [id, label, kind] = row;
        if (kind === "sort") {
          mediaChips.append(
            mkChip(label, filters.sort === id, () => {
              filters.sort = id;
              paintMediaChips();
              reload();
            })
          );
          return;
        }
        if (id === "all") {
          mediaChips.append(
            mkChip(label, filters.media === "all" && filters.sort === "latest", () => {
              filters.media = "all";
              filters.sort = "latest";
              paintMediaChips();
              reload();
            })
          );
          return;
        }
        mediaChips.append(
          mkChip(label, filters.media === id, () => {
            filters.media = id;
            paintMediaChips();
            reload();
          })
        );
      });
    }

    try {
      brands = await loadBrandMap();
      paintPlatChips();
      paintBrandChips();
      paintMediaChips();
      await reload();
      return true;
    } catch (_) {
      status.textContent = "피드를 불러오지 못했습니다.";
      return false;
    }
  }

  window.HxWearFeed = { renderWearFeed, buildFeed };
})();
