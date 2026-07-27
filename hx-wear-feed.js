(() => {
  "use strict";

  /**
   * Portfolio-brand overseas wear/coord feed only.
   * - Brands from brand-codes / portfolio (C, VCA, CL…)
   * - Types: ring | bracelet | necklace | earring only
   * - NO Flickr, NO museum, NO watches
   * - Source: curated IG handles + optional HX_WEAR_FEED_API
   */

  const CACHE_KEY = "hx.ig.wear.v1";
  const CACHE_TTL_MS = 6 * 3600 * 1000;
  const LOGO = "./icons/icon-192.png";
  const BRAND_NAME = "본 헤리티지";
  const TYPES = new Set(["ring", "bracelet", "necklace", "earring"]);
  const TYPE_KO = {
    ring: "반지",
    bracelet: "팔찌",
    necklace: "목걸이",
    earring: "귀걸이",
  };

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
    const base = String(window.HX_WEAR_FEED_API || "").replace(/\/$/, "");
    if (!base) return [];
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
    const code = String(row.brandCode || row.brand || "").trim();
    const brand = brands[code];
    if (!brand) return null;
    const type = String(row.type || "").toLowerCase();
    if (!TYPES.has(type)) return null;
    const permalink = String(row.permalink || row.instagram || row.url || "");
    const image = String(row.image || row.image_url || "");
    if (!permalink) return null;
    if (BLOCK_HOST.test(permalink) || BLOCK_HOST.test(image)) return null;
    const blob = `${row.titleKo || ""} ${row.captionKo || ""} ${row.pieceKo || ""} ${type}`;
    if (BLOCK_TEXT.test(blob)) return null;
    if (/flickr/i.test(row.source || "")) return null;

    return {
      id: row.id || `ig-${code}-${type}-${Math.random().toString(36).slice(2, 7)}`,
      brandCode: code,
      brandEn: brand.en,
      brandKo: brand.ko,
      type,
      typeKo: TYPE_KO[type],
      pieceKo: row.pieceKo || TYPE_KO[type],
      titleKo: row.titleKo || `${brand.ko} ${TYPE_KO[type]} 착용`,
      captionKo: row.captionKo || "해외 인스타 착용·코디 참고",
      handle: String(row.handle || "").replace(/^@/, ""),
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

    // bust old toxic caches
    try {
      [
        "hx.wear.rich.v1",
        "hx.wear.feed.v1",
        "hx.wear.feed.v2",
        "hx.wear.feed.v3",
        "hx.wear.feed.v4",
        "hx.wear.feed.v5",
      ].forEach((k) => localStorage.removeItem(k));
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

    const merged = [];
    const seen = new Set();
    [...backend, ...(curated.items || [])].forEach((row) => {
      const item = normalize(row, brands);
      if (!item) return;
      if (!portfolioCodes.has(item.brandCode)) return;
      if (seen.has(item.id) || seen.has(item.permalink + item.type)) return;
      seen.add(item.id);
      seen.add(item.permalink + item.type);
      merged.push(item);
    });

    // Prefer brands heavily in portfolio first
    merged.sort((a, b) => String(a.brandCode).localeCompare(String(b.brandCode)) || a.type.localeCompare(b.type));
    cacheSet(merged);
    return merged;
  }

  function cardNode(item) {
    const a = el("article", "hx-ig__card");
    a.dataset.brand = item.brandCode;
    a.dataset.type = item.type;

    const head = el("div", "hx-ig__head");
    const av = el("div", "hx-ig__avatar");
    av.innerHTML = `<img alt="본 헤리티지" src="${LOGO}" width="36" height="36" loading="lazy">`;
    const meta = el("div", "hx-ig__meta");
    meta.innerHTML =
      `<strong>${BRAND_NAME}</strong>` +
      `<span>${item.brandKo} · ${item.typeKo}</span>`;
    const time = el("time", "hx-ig__time", relativeTimeKo(item.publishedAt, item.id));
    head.append(av, meta, time);

    const media = el("button", "hx-ig__media");
    media.type = "button";
    media.setAttribute("aria-label", "인스타 원문 열기");
    if (item.image && !BLOCK_HOST.test(item.image)) {
      media.innerHTML = `<img alt="" loading="lazy" decoding="async" src="${item.image}">`;
    } else {
      media.classList.add("hx-ig__media--ph");
      media.innerHTML =
        `<div class="hx-ig__ph"><b>${item.brandEn}</b><span>@${item.handle || "instagram"}</span><em>인스타에서 착용컷 보기</em></div>`;
    }
    media.addEventListener("click", () => openPermalink(item.permalink));

    const foot = el("div", "hx-ig__foot");
    const cap = el("p", "hx-ig__caption");
    cap.innerHTML =
      `<b>${item.titleKo}</b>` +
      `<span class="hx-ig__seed">${item.captionKo}</span>` +
      (item.handle ? `<span class="hx-ig__seed">@${item.handle}</span>` : "");

    const by = el("div", "hx-ig__by");
    by.innerHTML = `<span>BY instagram</span>`;
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
      `<p class="hx-page__eyebrow">INSTAGRAM WEAR</p>` +
      `<h1 class="hx-page__title">브랜드 착용 · 코디</h1>` +
      `<p class="hx-page__lead">포폴 브랜드(C·VCA·CL 등) 해외 인스타 착용샷만. 귀걸이·팔찌·목걸이·반지. 플리커·뮤지엄·시계 없음.</p>`;
    root.append(hero);

    const chips = el("div", "hx-chips hx-ig-filters");
    let activeBrand = "all";
    let activeType = "all";
    const feed = el("div", "hx-ig");
    const note = el("p", "hx-note");
    note.textContent = "인스타 착용 피드 준비 중…";
    root.append(chips, note, feed);

    let items = [];

    function paint() {
      feed.replaceChildren();
      const rows = items.filter((x) => {
        if (activeBrand !== "all" && x.brandCode !== activeBrand) return false;
        if (activeType !== "all" && x.type !== activeType) return false;
        return true;
      });
      if (!rows.length) {
        feed.append(el("p", "hx-empty", "이 필터에 착용컷이 없습니다."));
        return;
      }
      const frag = document.createDocumentFragment();
      rows.forEach((item) => frag.append(cardNode(item)));
      feed.append(frag);
    }

    function syncChipState() {
      chips.querySelectorAll("button[data-group]").forEach((btn) => {
        const g = btn.dataset.group;
        const id = btn.dataset.id;
        const on = g === "brand" ? id === activeBrand : id === activeType;
        btn.classList.toggle("is-on", on);
      });
    }

    function buildChips() {
      chips.replaceChildren();
      const brandSet = [...new Set(items.map((x) => x.brandCode))];
      const mk = (id, label, group) => {
        const b = el("button", "", label);
        b.type = "button";
        b.dataset.group = group;
        b.dataset.id = id;
        b.addEventListener("click", () => {
          if (group === "brand") activeBrand = id;
          else activeType = id;
          syncChipState();
          paint();
        });
        return b;
      };
      chips.append(mk("all", "전체브랜드", "brand"));
      brandSet.forEach((code) => {
        const sample = items.find((x) => x.brandCode === code);
        chips.append(mk(code, `${code} ${sample?.brandKo || ""}`, "brand"));
      });
      chips.append(mk("all", "전체종류", "type"));
      chips.append(mk("bracelet", "팔찌", "type"));
      chips.append(mk("necklace", "목걸이", "type"));
      chips.append(mk("ring", "반지", "type"));
      chips.append(mk("earring", "귀걸이", "type"));
      syncChipState();
    }

    try {
      items = await buildFeed(true);
      if (!items.length) {
        note.textContent = "표시할 브랜드 착용컷이 없습니다. 큐레이션/API를 확인해 주세요.";
        return false;
      }
      note.textContent = `${items.length}장 · 인스타 착용·코디 · 포폴 브랜드만`;
      buildChips();
      paint();
      root.append(
        el(
          "p",
          "hx-disclaimer",
          "인스타 공식 키워드 검색은 Meta API 키가 필요합니다. 지금은 포폴 브랜드 큐레이션(+ window.HX_WEAR_FEED_API)만 송출합니다. 링크는 해외 인스타로 연결됩니다."
        )
      );
      return true;
    } catch (_) {
      note.textContent = "피드를 불러오지 못했습니다.";
      return false;
    }
  }

  window.HxWearFeed = { renderWearFeed, buildFeed };
})();
