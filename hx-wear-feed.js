(() => {
  "use strict";

  /**
   * Discover Style Feed — abundant overseas jewelry images + KO captions + source links.
   * Does NOT claim portfolio SKU identity. Caption = what the source actually is.
   */

  const CACHE_KEY = "hx.wear.rich.v1";
  const CACHE_TTL_MS = 4 * 3600 * 1000;
  const TR_CACHE = "hx.wear.tr.v1";
  const LOGO = "./icons/icon-192.png";
  const BRAND_NAME = "본 헤리티지";

  const OPENVERSE_QUERIES = [
    "gold bracelet on wrist fashion",
    "diamond ring on finger jewelry",
    "gold necklace worn woman jewelry",
    "pearl earrings worn jewelry portrait",
    "woman wearing jewelry closeup",
    "luxury jewelry wrist shot",
    "engagement ring hand jewelry",
    "stacked gold bracelets fashion",
  ];

  const NSFW_RE =
    /\b(nude|nudes|naked|topless|lingerie|underwear|panties|fetish|bdsm|porn|xxx|erotic|sexy|nipple|breast|boob|ass\b|butt\b|genital|onlyfans|hentai|lewd|nsfw)\b/i;

  const NOISE_RE =
    /\b(building|architecture|skyline|streetparade|protest|christmas decor|xmas decor|aquarium|bokehlicious|coloring book|cartoon|comic|anime|cosplay|remote control|golem|billboard)\b/i;

  const JEWELRY_RE =
    /\b(jewelry|jewellery|jewel|gold|silver|diamond|pearl|platinum|bracelet|ring|necklace|earring|pendant|bangle|brooch|tiara|gem|sapphire|ruby|emerald|Cartier|Tiffany|Chanel|Bulgari|Bvlgari)\b/i;

  const WEAR_RE =
    /\b(worn|wearing|wrist|finger|hand|neck|ear|earlobe|portrait|model|close[\s-]?up|outfit|street\s*style|on\s+(my|her|his|the)\s+(wrist|finger|hand|neck))\b/i;

  const KR_HOST_RE =
    /\.kr\b|naver\.|daum\.|kakao\.|coupang\.|musinsa\.|gmarket\.|11st\.|smartstore\./i;

  const GLOSSARY = [
    [/jewellery/gi, "주얼리"],
    [/jewelry/gi, "주얼리"],
    [/bracelet/gi, "팔찌"],
    [/necklace/gi, "목걸이"],
    [/earrings?/gi, "귀걸이"],
    [/pendant/gi, "펜던트"],
    [/diamond/gi, "다이아몬드"],
    [/pearl/gi, "진주"],
    [/gold/gi, "골드"],
    [/silver/gi, "실버"],
    [/platinum/gi, "플래티넘"],
    [/ring/gi, "반지"],
    [/worn/gi, "착용"],
    [/wearing/gi, "착용"],
    [/wrist/gi, "손목"],
    [/finger/gi, "손가락"],
    [/hand/gi, "손"],
    [/fashion/gi, "패션"],
    [/portrait/gi, "포트레이트"],
    [/close[\s-]?up/gi, "클로즈업"],
    [/engagement/gi, "약혼"],
    [/wedding/gi, "웨딩"],
    [/collection/gi, "컬렉션"],
    [/museum/gi, "뮤지엄"],
    [/century/gi, "세기"],
  ];

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
      return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch (_) {
      return "";
    }
  }

  function sourceLabel(url, fallback) {
    const h = hostOf(url);
    if (h.includes("flickr")) return "flickr";
    if (h.includes("metmuseum")) return "the met";
    if (h.includes("clevelandart")) return "cleveland";
    if (h.includes("artic.edu")) return "art institute";
    if (h.includes("wikimedia") || h.includes("wikipedia")) return "wikimedia";
    if (h.includes("rawpixel")) return "rawpixel";
    const parts = h.split(".");
    return parts.length >= 2 ? parts[parts.length - 2] : fallback || "source";
  }

  function relativeTimeKo(iso, salt) {
    let ms = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(ms)) {
      let h = 0;
      const s = String(salt || "x");
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      ms = Date.now() - (8 * 3600 * 1000 + (Math.abs(h) % (96 * 3600 * 1000)));
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

  function cacheSet(items, meta) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ exp: Date.now() + CACHE_TTL_MS, at: Date.now(), items, meta: meta || {} })
      );
    } catch (_) {}
  }

  function trCacheGet(key) {
    try {
      const all = JSON.parse(localStorage.getItem(TR_CACHE) || "{}");
      return all[key] || "";
    } catch (_) {
      return "";
    }
  }

  function trCacheSet(key, val) {
    try {
      const all = JSON.parse(localStorage.getItem(TR_CACHE) || "{}");
      all[key] = val;
      const keys = Object.keys(all);
      if (keys.length > 200) keys.slice(0, keys.length - 160).forEach((k) => delete all[k]);
      localStorage.setItem(TR_CACHE, JSON.stringify(all));
    } catch (_) {}
  }

  function glossaryKo(text) {
    let out = String(text || "");
    GLOSSARY.forEach(([re, ko]) => {
      out = out.replace(re, ko);
    });
    return out.replace(/\s{2,}/g, " ").trim();
  }

  async function translateKo(text) {
    const src = String(text || "").trim().slice(0, 180);
    if (!src) return "";
    if (/[가-힣]/.test(src) && !/[A-Za-z]{4,}/.test(src)) return src;
    const hit = trCacheGet(src);
    if (hit) return hit;
    const gloss = glossaryKo(src);
    try {
      const url =
        "https://api.mymemory.translated.net/get?" +
        new URLSearchParams({ q: src, langpair: "en|ko" }).toString();
      const res = await fetch(url);
      const data = await res.json();
      const tr = String(data?.responseData?.translatedText || "").trim();
      if (tr && !/INVALID|QUERY LENGTH|MYMEMORY WARNING/i.test(tr)) {
        trCacheSet(src, tr);
        return tr;
      }
    } catch (_) {}
    trCacheSet(src, gloss || src);
    return gloss || src;
  }

  function tagsBlob(tags) {
    if (!Array.isArray(tags)) return "";
    return tags.map((t) => (typeof t === "string" ? t : t?.name || "")).join(" ");
  }

  function textBlob(item) {
    return `${item.title || ""} ${item.summary || ""} ${tagsBlob(item.tags)}`.toLowerCase();
  }

  function passesContent(item) {
    const blob = textBlob(item);
    const land = item.permalink || "";
    if (!item.image || !item.permalink) return false;
    if (KR_HOST_RE.test(land) || KR_HOST_RE.test(item.image) || KR_HOST_RE.test(hostOf(land))) return false;
    if (NSFW_RE.test(blob)) return false;
    if (NOISE_RE.test(blob) && !JEWELRY_RE.test(blob)) return false;
    if (item.kind === "museum") return true;
    if (!JEWELRY_RE.test(blob)) return false;
    return true;
  }

  function kindOf(item) {
    if (item.kind) return item.kind;
    if (item.verified) return "brand";
    if (/met|cleveland|artic|museum|wikimedia/i.test(item.source || "")) return "museum";
    if (WEAR_RE.test(textBlob(item))) return "wear";
    return "archive";
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  async function fetchOpenverse(query, limit) {
    const url =
      "https://api.openverse.org/v1/images/?" +
      new URLSearchParams({
        q: query,
        page_size: String(limit || 16),
        mature: "false",
        source: "flickr,rawpixel,wikimedia",
      }).toString();
    const data = await fetchJson(url);
    return (data.results || []).map((row) => ({
      id: `ov-${row.id}`,
      title: row.title || query,
      image: row.url || row.thumbnail || "",
      thumb: row.thumbnail || row.url || "",
      permalink: row.foreign_landing_url || row.detail_url || "",
      source: row.source || "openverse",
      license: row.license || "",
      tags: row.tags || [],
      indexedOn: row.indexed_on || "",
      kind: WEAR_RE.test(`${row.title} ${tagsBlob(row.tags)}`) ? "wear" : "archive",
      institution: row.creator || row.source || "",
    }));
  }

  async function fetchMuseumCards() {
    const out = [];
    if (window.HxContent?.fetchMetJewelry) {
      try {
        const rows = await window.HxContent.fetchMetJewelry(12);
        rows.forEach((c) => {
          out.push({
            id: c.id || `met-${c.sourceUrl}`,
            title: c.title,
            image: c.image || c.thumbnail,
            thumb: c.thumbnail || c.image,
            permalink: c.sourceUrl,
            source: "met",
            license: c.rights || "Public Domain",
            tags: c.tags || ["jewelry"],
            indexedOn: "",
            kind: "museum",
            institution: c.institution || "The Met",
            summary: c.summaryKo || c.objectDate || "",
          });
        });
      } catch (_) {}
    }
    if (window.HxContent?.fetchCmaJewelry) {
      try {
        const rows = await window.HxContent.fetchCmaJewelry(10);
        rows.forEach((c) => {
          out.push({
            id: c.id || `cma-${c.sourceUrl}`,
            title: c.title,
            image: c.image || c.thumbnail,
            thumb: c.thumbnail || c.image,
            permalink: c.sourceUrl,
            source: "cleveland",
            license: c.rights || "CC0",
            tags: ["jewelry"],
            kind: "museum",
            institution: "Cleveland Museum of Art",
            summary: c.summaryKo || "",
          });
        });
      } catch (_) {}
    }
    if (window.HxContent?.fetchAicJewelry) {
      try {
        const rows = await window.HxContent.fetchAicJewelry(10);
        rows.forEach((c) => {
          out.push({
            id: c.id || `aic-${c.sourceUrl}`,
            title: c.title,
            image: c.image || c.thumbnail,
            thumb: c.thumbnail || c.image,
            permalink: c.sourceUrl,
            source: "aic",
            license: c.rights || "Public Domain",
            tags: ["jewelry"],
            kind: "museum",
            institution: "Art Institute of Chicago",
            summary: c.summaryKo || "",
          });
        });
      } catch (_) {}
    }
    // Fallback direct Met if HxContent missing helpers
    if (!out.length) {
      try {
        const search = await fetchJson(
          "https://collectionapi.metmuseum.org/public/collection/v1/search?q=jewelry&hasImages=true&isPublicDomain=true"
        );
        const ids = (search.objectIDs || []).slice(0, 16);
        for (const id of ids) {
          try {
            const obj = await fetchJson(
              `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`
            );
            if (!obj?.primaryImageSmall) continue;
            out.push({
              id: `met-${obj.objectID}`,
              title: obj.title || "Jewelry",
              image: obj.primaryImageSmall || obj.primaryImage,
              thumb: obj.primaryImageSmall,
              permalink: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
              source: "met",
              license: "Public Domain",
              tags: ["jewelry"],
              kind: "museum",
              institution: "The Met",
              summary: [obj.artistDisplayName, obj.objectDate, obj.medium].filter(Boolean).join(" · "),
            });
          } catch (_) {}
          if (out.length >= 12) break;
        }
      } catch (_) {}
    }
    return out;
  }

  async function fetchVerifiedDaily() {
    try {
      const data = await fetchJson(`./hx-wear-daily.json?v=${Date.now()}`);
      return (data.items || []).map((row) => ({
        id: row.id,
        title: row.title,
        image: row.image,
        thumb: row.image,
        permalink: row.permalink,
        source: row.source,
        license: row.license,
        tags: row.productHints || [],
        indexedOn: row.indexedOn,
        kind: "brand",
        verified: true,
        institution: row.brandEn || "",
        summary: (row.reasons || []).slice(0, 2).join(" · "),
      }));
    } catch (_) {
      return [];
    }
  }

  async function buildRichFeed(force) {
    if (!force) {
      const hit = cacheGet();
      if (hit?.items?.length) return hit;
    }

    const querySlice = OPENVERSE_QUERIES.slice(0, 6);
    const [verified, museum, ...ovChunks] = await Promise.all([
      fetchVerifiedDaily(),
      fetchMuseumCards(),
      ...querySlice.map((q) => fetchOpenverse(q, 14).catch(() => [])),
    ]);

    const openverse = ovChunks.flat();
    const merged = [];
    const seen = new Set();

    function push(item) {
      if (!passesContent(item)) return;
      const key = String(item.image || "").split("?")[0];
      if (!key || seen.has(key)) return;
      seen.add(key);
      item.kind = kindOf(item);
      merged.push(item);
    }

    verified.forEach(push);
    // Prefer wear shots early for richness
    openverse.filter((x) => x.kind === "wear").forEach(push);
    museum.forEach(push);
    openverse.filter((x) => x.kind !== "wear").forEach(push);

    // Translate captions (batch limited)
    const toTr = merged.slice(0, 48);
    for (const item of toTr) {
      const base = item.summary || item.title || "";
      item.titleKo = await translateKo(base);
      if (item.title && item.title !== base) {
        item.titleKoAlt = await translateKo(item.title);
      }
      if (!item.titleKo) item.titleKo = glossaryKo(item.title);
    }
    merged.slice(48).forEach((item) => {
      item.titleKo = glossaryKo(item.title || item.summary || "");
    });

    const payload = {
      items: merged.slice(0, 72),
      meta: {
        wear: merged.filter((x) => x.kind === "wear").length,
        museum: merged.filter((x) => x.kind === "museum").length,
        brand: merged.filter((x) => x.kind === "brand").length,
      },
    };
    cacheSet(payload.items, payload.meta);
    return payload;
  }

  function cardNode(item) {
    const a = el("article", "hx-ig__card");
    a.dataset.kind = item.kind || "archive";

    const head = el("div", "hx-ig__head");
    const av = el("div", "hx-ig__avatar");
    av.innerHTML = `<img alt="본 헤리티지" src="${LOGO}" width="36" height="36" loading="lazy">`;
    const meta = el("div", "hx-ig__meta");
    const badge =
      item.kind === "wear" ? "착용" : item.kind === "museum" ? "뮤지엄" : item.kind === "brand" ? "브랜드확인" : "아카이브";
    meta.innerHTML = `<strong>${BRAND_NAME}</strong><span>${badge}</span>`;
    const time = el("time", "hx-ig__time", relativeTimeKo(item.indexedOn, item.id));
    head.append(av, meta, time);

    const media = el("button", "hx-ig__media");
    media.type = "button";
    media.setAttribute("aria-label", "원문 열기");
    media.innerHTML = `<img alt="" loading="lazy" decoding="async" src="${item.thumb || item.image}">`;
    media.addEventListener("click", () => openPermalink(item.permalink));

    const foot = el("div", "hx-ig__foot");
    const cap = el("p", "hx-ig__caption");
    const ko = item.titleKo || glossaryKo(item.title) || "해외 주얼리 자료";
    const en = String(item.title || "").slice(0, 90);
    cap.innerHTML =
      `<b>${ko}</b>` +
      (en ? `<span class="hx-ig__seed">원제 · ${en}</span>` : "") +
      (item.institution ? `<span class="hx-ig__seed">${item.institution}${item.license ? " · " + item.license : ""}</span>` : "");

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
      `<p class="hx-page__eyebrow">OVERSEAS JEWELRY</p>` +
      `<h1 class="hx-page__title">해외 주얼리 피드</h1>` +
      `<p class="hx-page__lead">해외 착용컷·뮤지엄·아카이브를 모아 한글로 풀어 보여 드립니다. 탭하면 원문으로 이동합니다. (포폴 제품과 1:1 동일을 주장하지 않습니다)</p>`;
    root.append(hero);

    const chips = el("div", "hx-chips hx-ig-filters");
    const filters = [
      ["all", "전체"],
      ["wear", "착용"],
      ["museum", "뮤지엄"],
      ["brand", "브랜드확인"],
    ];
    let active = "all";
    filters.forEach(([id, label], i) => {
      const b = el("button", i === 0 ? "is-on" : "", label);
      b.type = "button";
      b.dataset.id = id;
      b.addEventListener("click", () => {
        active = id;
        chips.querySelectorAll("button").forEach((x) => x.classList.remove("is-on"));
        b.classList.add("is-on");
        paint();
      });
      chips.append(b);
    });
    root.append(chips);

    const note = el("p", "hx-note");
    note.textContent = "해외 자료를 모으고 한글 요약을 준비하는 중…";
    root.append(note);

    const feed = el("div", "hx-ig");
    root.append(feed);

    let items = [];
    function paint() {
      feed.replaceChildren();
      const rows = active === "all" ? items : items.filter((x) => x.kind === active);
      if (!rows.length) {
        feed.append(el("p", "hx-empty", "이 필터에 표시할 항목이 없습니다."));
        return;
      }
      const frag = document.createDocumentFragment();
      rows.forEach((item) => frag.append(cardNode(item)));
      feed.append(frag);
    }

    try {
      try {
        ["hx.wear.feed.v1", "hx.wear.feed.v2", "hx.wear.feed.v3", "hx.wear.feed.v4", "hx.wear.feed.v5"].forEach((k) =>
          localStorage.removeItem(k)
        );
      } catch (_) {}

      const data = await buildRichFeed(false);
      items = data.items || [];
      if (!items.length) {
        note.textContent = "지금은 표시할 해외 주얼리 자료가 없습니다.";
        return false;
      }
      const m = data.meta || {};
      note.textContent = `${items.length}장 · 착용 ${m.wear || 0} · 뮤지엄 ${m.museum || 0} · 브랜드확인 ${m.brand || 0}`;
      paint();
      root.append(
        el(
          "p",
          "hx-disclaimer",
          "출처: Openverse(Flickr 등) · The Met · Cleveland · Art Institute of Chicago 등. 한글은 원문 제목/설명 번역·용어 치환입니다."
        )
      );
      return true;
    } catch (_) {
      note.textContent = "피드를 불러오지 못했습니다.";
      return false;
    }
  }

  window.HxWearFeed = {
    renderWearFeed,
    buildRichFeed,
  };
})();
