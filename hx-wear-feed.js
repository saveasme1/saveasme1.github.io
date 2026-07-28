(() => {
  "use strict";

  const CACHE_KEY = "hx.ig.wear.v10";
  const CACHE_TTL_MS = 20 * 60 * 1000;
  const TYPES = new Set(["ring", "bracelet", "necklace", "earring"]);
  const TYPE_KO = {
    ring: "반지",
    bracelet: "브레이슬릿",
    necklace: "목걸이",
    earring: "귀걸이",
  };
  const BRAND_ORDER = ["C", "B", "VCA", "BO", "CM", "C&H", "CL", "G", "H", "P", "F", "T&C", "L", "D"];
  const BRAND_HANDLE = {
    C: "cartier",
    B: "bulgari",
    VCA: "vancleefarpels",
    BO: "boucheron",
    CM: "chaumetofficial",
    "C&H": "chromeheartsofficial",
    CL: "chanel",
    G: "gucci",
    H: "hermes",
    P: "prada",
    F: "fred",
    "T&C": "tiffanyandco",
    L: "louisvuitton",
    D: "damianiofficial",
  };

  const BLOCK_HOST =
    /flickr\.|staticflickr\.|metmuseum\.|clevelandart\.|artic\.edu|wikimedia\.org|upload\.wikimedia/i;
  const WATCH_RE = /시계|워치|\bwatch\b/i;
  const IG_POST_PATH = /\/(p|reel|tv)\/([A-Za-z0-9_-]+)/i;

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /** Only /p/, /reel/, /tv/ — profile roots like instagram.com/cartier/ are rejected. */
  function isIgPostPermalink(url) {
    try {
      const u = new URL(String(url || "").trim());
      if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return false;
      return IG_POST_PATH.test(u.pathname);
    } catch (_) {
      return false;
    }
  }

  function normalizeIgPostUrl(url) {
    try {
      const u = new URL(String(url || "").trim());
      const m = u.pathname.match(IG_POST_PATH);
      if (!m) return "";
      return `https://www.instagram.com/${m[1].toLowerCase()}/${m[2]}/`;
    } catch (_) {
      return "";
    }
  }

  function openPermalink(url) {
    const post = normalizeIgPostUrl(url);
    const target = post || url;
    if (!target) return;
    try {
      window.open(target, "_blank", "noopener,noreferrer");
    } catch (_) {
      location.href = target;
    }
  }

  function profileUrl(handle) {
    const h = String(handle || "").replace(/^@/, "").trim();
    return h ? `https://www.instagram.com/${encodeURIComponent(h)}/` : "";
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

  function avatarFor(handle, profilePictureUrl, localAvatar) {
    const h = String(handle || "")
      .replace(/^@/, "")
      .trim()
      .toLowerCase();
    if (!h && !localAvatar && !profilePictureUrl) return "";
    const apiBase = String(
      window.HX_WEAR_FEED_API || "https://app.0-1.co.kr/api/handmade/v1"
    ).replace(/\/$/, "");
    // Prefer MakerBridge proxy (real IG profile cache). Local brand mark as soft fallback.
    if (h) return `${apiBase}/ig-avatar?u=${encodeURIComponent(h)}&b=1`;
    if (localAvatar) return absUrl(localAvatar);
    if (profilePictureUrl) return profilePictureUrl;
    return "";
  }

  function setAvatar(av, handle, primaryUrl) {
    const h = String(handle || "").replace(/^@/, "").trim().toLowerCase();
    const candidates = [
      primaryUrl,
      absUrl(`./wear-media/avatars/${h}.jpg`),
      absUrl(`./wear-media/avatars/${h}.png`),
    ].filter(Boolean);

    const tryNext = (i) => {
      if (i >= candidates.length) {
        av.classList.add("hx-ig__avatar--letter");
        av.textContent = (h.slice(0, 1) || "?").toUpperCase();
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

  function inferTypeFromTitle(title) {
    const t = String(title || "");
    if (WATCH_RE.test(t)) return "";
    if (/브레이슬릿|팔찌|뱅글|bangle|bracelet/i.test(t)) return "bracelet";
    if (/목걸이|네클리스|펜던트|초커|necklace|pendant/i.test(t)) return "necklace";
    if (/귀걸이|이어링|earring/i.test(t)) return "earring";
    if (/반지|링\b|ring/i.test(t)) return "ring";
    return "";
  }

  function parseBrandFromTitle(title, brands) {
    const t = String(title || "").trim();
    const keys = Object.keys(brands).sort((a, b) => b.length - a.length);
    for (const code of keys) {
      if (t === code || t.startsWith(code + " ") || t.startsWith(code + "\t")) return code;
    }
    return "";
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

  async function loadBackend() {
    const base = String(
      window.HX_WEAR_FEED_API || "https://app.0-1.co.kr/api/handmade/v1"
    ).replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/ig-wear`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });
      if (!res.ok) return { items: [], profilePictureUrl: "", username: "", name: "", profiles: {} };
      const data = await res.json();
      return {
        items: data.items || [],
        profilePictureUrl: data.profilePictureUrl || "",
        username: data.username || "",
        name: data.name || "",
        profiles: data.profiles || {},
      };
    } catch (_) {
      return { items: [], profilePictureUrl: "", username: "", name: "", profiles: {} };
    }
  }

  async function loadPortfolioWear(brands) {
    // Discover wear feed must NOT show portfolio SKUs — Instagram / curated wear only.
    return [];
  }

  function normalize(row, brands, liveProfile) {
    let code = String(row.brandCode || row.brand || "").trim();
    let brand = brands[code];
    if (!brand && (row.source === "instagram" || code === "IG")) {
      brand = { en: "Instagram", ko: "인스타" };
      code = code || "IG";
    }
    if (!brand) return null;
    const type = String(row.type || "").toLowerCase();
    if (!TYPES.has(type)) return null;
    const rawPermalink = String(row.permalink || row.instagram || row.url || "");
    const permalink = normalizeIgPostUrl(rawPermalink);
    let image = String(row.image || row.image_url || "");
    // Media must open a specific IG post — never a profile homepage.
    if (!permalink || !isIgPostPermalink(permalink) || !image) return null;
    image = absUrl(image);
    if (BLOCK_HOST.test(permalink) || BLOCK_HOST.test(image)) return null;

    let handle = String(row.handle || "").replace(/^@/, "").trim();
    if (!handle && code !== "IG") handle = BRAND_HANDLE[code] || "";
    if (!handle && liveProfile?.username) handle = liveProfile.username;

    let profilePictureUrl = String(row.profilePictureUrl || row.profile_picture_url || "");
    if (
      !profilePictureUrl &&
      liveProfile?.profilePictureUrl &&
      handle &&
      liveProfile.username &&
      handle.toLowerCase() === String(liveProfile.username).toLowerCase()
    ) {
      profilePictureUrl = liveProfile.profilePictureUrl;
    }

    const displayName =
      String(row.displayName || row.name || "").trim() ||
      (liveProfile?.name && handle === liveProfile.username ? liveProfile.name : "") ||
      handle;

    return {
      id: row.id || `ig-${code}-${type}-${Math.random().toString(36).slice(2, 7)}`,
      brandCode: code,
      type,
      typeKo: TYPE_KO[type],
      pieceKo: row.pieceKo === "팔찌" ? "브레이슬릿" : row.pieceKo || TYPE_KO[type],
      titleKo: row.titleKo || TYPE_KO[type],
      captionKo: row.captionKo || "",
      handle,
      displayName,
      profileUrl: profileUrl(handle) || permalink,
      permalink,
      image,
      avatar: row.avatar ? absUrl(row.avatar) : "",
      profilePictureUrl,
      publishedAt: row.publishedAt || row.indexedOn || "",
      source: row.source || "",
      tags: Array.isArray(row.tags) ? row.tags : [],
    };
  }

  function applyProfileMeta(row, profiles) {
    const h = String(row.handle || "")
      .replace(/^@/, "")
      .trim()
      .toLowerCase();
    const p = profiles && h ? profiles[h] : null;
    if (!p) return row;
    return {
      ...row,
      handle: p.username || row.handle,
      displayName: p.name || row.displayName || p.username || row.handle,
      profilePictureUrl:
        row.profilePictureUrl ||
        `https://app.0-1.co.kr/api/handmade/v1/ig-avatar?u=${encodeURIComponent(h)}`,
    };
  }

  function isRelevantWear(row) {
    const blob = `${row.titleKo || ""} ${row.captionKo || ""} ${row.pieceKo || ""} ${row.type || ""}`.toLowerCase();
    if (/시계|워치|\bwatch\b|museum|flickr|tribal/.test(blob)) return false;
    // jewelry wear / coord relevance
    return /bracelet|브레이슬릿|팔찌|necklace|목걸이|earring|귀걸이|ring|반지|착용|코디|alhambra|알함브라|crush|크러쉬|love|러브|serpenti|세르펜티|앙끌로|clou|스택|wear|jewel/.test(
      blob
    );
  }

  async function buildFeed(force) {
    if (!force) {
      const hit = cacheGet();
      if (hit?.items?.length) return hit.items;
    }
    try {
      [
        "hx.ig.wear.v1",
        "hx.ig.wear.v2",
        "hx.ig.wear.v3",
        "hx.ig.wear.v4",
        "hx.ig.wear.v5",
        "hx.ig.wear.v6",
        "hx.ig.wear.v7",
        "hx.ig.wear.v8",
        "hx.ig.wear.v9",
      ].forEach((k) => localStorage.removeItem(k));
    } catch (_) {}

    const brands = await loadBrands();
    const curated = await loadCurated();
    const backend = await loadBackend();
    const liveProfile = {
      username: backend.username || "",
      name: backend.name || "",
      profilePictureUrl: backend.profilePictureUrl || "",
    };
    const profiles = backend.profiles || {};

    const allowedCodes = new Set(BRAND_ORDER.filter((c) => brands[c]));
    Object.keys(brands).forEach((c) => allowedCodes.add(c));
    allowedCodes.add("IG");

    const merged = [];
    const seen = new Set();
    const curatedRows = (curated.items || [])
      .filter(isRelevantWear)
      .map((row) => applyProfileMeta(row, profiles));

    [...backend.items.map((row) => applyProfileMeta(row, profiles)), ...curatedRows].forEach((row) => {
      const item = normalize(row, brands, liveProfile);
      if (!item) return;
      if (!allowedCodes.has(item.brandCode)) return;
      if (item.source === "portfolio" || String(item.id).startsWith("pf-")) return;
      if (seen.has(item.id) || seen.has(item.permalink + item.image)) return;
      seen.add(item.id);
      seen.add(item.permalink + item.image);
      merged.push(item);
    });

    merged.sort((a, b) => {
      const aLive = a.source === "instagram" || String(a.id).startsWith("ig-api-") ? 1 : 0;
      const bLive = b.source === "instagram" || String(b.id).startsWith("ig-api-") ? 1 : 0;
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

    const handle = String(item.handle || "instagram").replace(/^@/, "");
    const profile = item.profileUrl || profileUrl(handle);
    const avatarSrc = avatarFor(handle, item.profilePictureUrl, item.avatar);

    const head = el("button", "hx-ig__head");
    head.type = "button";
    head.setAttribute("aria-label", `@${handle} 프로필`);
    const av = el("div", "hx-ig__avatar");
    setAvatar(av, handle, avatarSrc);

    const meta = el("div", "hx-ig__meta");
    const uname = handle;
    const dname = String(item.displayName || "").trim();
    meta.innerHTML =
      `<strong>@${uname}</strong>` +
      (dname && dname.toLowerCase() !== uname.toLowerCase()
        ? `<em class="hx-ig__name">${dname}</em>`
        : "") +
      `<span>${item.brandCode !== "IG" ? item.brandCode + " · " : ""}${item.typeKo}</span>`;
    const time = el("time", "hx-ig__time", relativeTimeKo(item.publishedAt, item.id));
    head.append(av, meta, time);
    head.addEventListener("click", () => {
      // Profile row → IG profile. Media/원문 → specific post.
      if (!profile) return;
      try {
        window.open(profile, "_blank", "noopener,noreferrer");
      } catch (_) {
        location.href = profile;
      }
    });

    const media = el("button", "hx-ig__media");
    media.type = "button";
    media.innerHTML = `<img alt="" loading="lazy" decoding="async" src="${item.image}">`;
    media.querySelector("img")?.addEventListener("error", () => {
      media.classList.add("hx-ig__media--ph");
      media.innerHTML = `<div class="hx-ig__ph"><b>${handle}</b><em>원문 보기</em></div>`;
    });
    media.addEventListener("click", () => {
      if (!isIgPostPermalink(item.permalink)) return;
      openPermalink(item.permalink);
    });

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
    linkBtn.addEventListener("click", () => {
      if (!isIgPostPermalink(item.permalink)) return;
      openPermalink(item.permalink);
    });
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
    let brands = {};

    function paint() {
      feed.replaceChildren();
      const rows = items.filter((x) => activeBrand === "all" || x.brandCode === activeBrand);
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
      // 포폴 brand-codes 전체 나열 (자료 유무와 무관)
      BRAND_ORDER.forEach((code) => {
        if (brands[code]) chips.append(mk(code, code));
      });
      Object.keys(brands).forEach((code) => {
        if (!BRAND_ORDER.includes(code)) chips.append(mk(code, code));
      });
      syncChipState();
    }

    try {
      brands = await loadBrands();
      items = await buildFeed(true);
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
