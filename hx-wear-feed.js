(() => {
  "use strict";

  /** Instagram-style jewelry WEAR feed only.
   *  Strict relevance + NSFW/noise filters. Korea hosts excluded.
   *  Optional backend: window.HX_WEAR_FEED_API
   */

  const CACHE_KEY = "hx.wear.feed.v3";
  const CACHE_TTL_MS = 4 * 3600 * 1000;
  const LOGO = "./icons/icon-192.png";
  const BRAND_NAME = "본 헤리티지";
  const MIN_SCORE = 9;

  const TYPE_EN = {
    ring: "ring",
    bracelet: "bracelet",
    necklace: "necklace",
    earring: "earrings",
    other: "jewelry",
  };

  const TYPE_WORDS = {
    ring: ["ring", "rings", "band", "engagementring", "weddingring", "반지"],
    bracelet: ["bracelet", "bracelets", "bangle", "cuff", "wristband", "팔찌", "브레이슬릿"],
    necklace: ["necklace", "necklaces", "pendant", "choker", "chain", "목걸", "펜던"],
    earring: ["earring", "earrings", "earring", "stud", "hoop", "귀걸", "이어링"],
    other: ["jewelry", "jewellery", "jewel", "주얼"],
  };

  const WEAR_WORDS = {
    ring: ["finger", "fingers", "hand", "hands", "worn", "wearing", "on finger", "closeup", "close-up"],
    bracelet: ["wrist", "arm", "hand", "worn", "wearing", "on wrist", "closeup", "close-up", "stacked"],
    necklace: ["neck", "worn", "wearing", "portrait", "collar", "décollet", "decollet", "closeup"],
    earring: ["ear", "earlobe", "ears", "worn", "wearing", "portrait", "closeup"],
    other: ["worn", "wearing", "wrist", "finger", "neck", "ear", "hand", "model", "portrait"],
  };

  const BODY_FOR_QUERY = {
    ring: "finger",
    bracelet: "wrist",
    necklace: "neck",
    earring: "ear",
    other: "hand",
  };

  const NSFW_RE =
    /\b(nude|nudes|naked|topless|bottomless|lingerie|underwear|panties|thong|bra\b|fetish|bdsm|porn|xxx|erotic|sensual|boudoir|pin[\s-]?up|nsfw|sex\b|sexy|cleavage|nipple|breast|boob|ass\b|butt\b|crotch|genital|bikini|swimsuit|lingerie|onlyfans|hentai|lewd)\b/i;

  const NOISE_RE =
    /\b(building|architecture|skyline|streetparade|protest|rally|mosaic|painting|sculpture|statue|museum hall|remote|golem|coloring|cartoon|comic|anime|cosplay|christmas decor|xmas decor|lighting|billboard|storefront|window display only|ruins|excavation|archeolog|archaeolog|tribal dance|political|election|covid|mask mandate)\b/i;

  const JEWELRY_RE =
    /\b(jewelry|jewellery|jewel|gold|silver|diamond|pearl|platinum|bracelet|ring|necklace|earring|pendant|bangle|tiffany|cartier|bulgari|bvlgari|chanel|hermes|van\s*cleef)\b/i;

  const KR_HOST_RE =
    /\.kr\b|naver\.|daum\.|kakao\.|coupang\.|gmarket\.|11st\.|musinsa\.|ssg\.com|oliveyoung\.|kurly\.|tistory\.|blog\.me|wemakeprice\.|auction\.co\.kr|interpark\.|smartstore\.|bunjang\.|zigzag\.|ably\.|brandi\.|hiver\.|ohou\.|yanolja\.|baemin\.|toss\.im|kream\.co/i;

  function cacheGet() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const row = JSON.parse(raw);
      if (!row || !row.exp || Date.now() > row.exp || !Array.isArray(row.items)) return null;
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

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
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
    if (!h) return fallback || "source";
    if (h.includes("flickr")) return "flickr";
    if (h.includes("wikimedia") || h.includes("wikipedia")) return "wikimedia";
    if (h.includes("rawpixel")) return "rawpixel";
    const parts = h.split(".");
    return parts.length >= 2 ? parts[parts.length - 2] : h;
  }

  function daySeed() {
    const d = new Date();
    return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  }

  function tagsBlob(tags) {
    if (!Array.isArray(tags)) return "";
    return tags
      .map((t) => (typeof t === "string" ? t : t && t.name) || "")
      .join(" ")
      .toLowerCase();
  }

  function textBlob(card) {
    return `${card.title || ""} ${card.caption || ""} ${card.creator || ""} ${tagsBlob(card.tags)}`.toLowerCase();
  }

  function hasToken(blob, word) {
    const w = String(word || "").toLowerCase();
    if (!w) return false;
    if (w.length <= 4) return new RegExp(`(?:^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9]|$)`, "i").test(blob);
    return blob.includes(w);
  }

  /** Strict: jewelry + matching type + wear context; reject NSFW/noise. */
  function scoreRelevance(card, seed) {
    const blob = textBlob(card);
    if (!blob.trim()) return -100;
    if (card.mature === true) return -100;
    if (Array.isArray(card.sensitivity) && card.sensitivity.length) return -100;
    if (NSFW_RE.test(blob)) return -100;
    if (NOISE_RE.test(blob) && !JEWELRY_RE.test(blob)) return -100;
    if (NSFW_RE.test(String(card.permalink || ""))) return -100;

    // Reject museum catalog-only product shots without a person/body cue
    if (/\b(one of a pair|pair of earrings|600s|bc\b|century)\b/i.test(blob) && !/\b(worn|wearing|woman|girl|model|portrait|hand|wrist|finger|neck)\b/i.test(blob)) {
      return -70;
    }

    const type = seed?.type || "other";
    const typeWords = TYPE_WORDS[type] || TYPE_WORDS.other;
    const wearWords = WEAR_WORDS[type] || WEAR_WORDS.other;

    let score = 0;
    if (JEWELRY_RE.test(blob)) score += 3;
    else return -80;

    const typeHit = typeWords.some((w) => hasToken(blob, w));
    if (!typeHit) return -60;
    score += 5;

    const wearHit = wearWords.some((w) => hasToken(blob, w));
    if (!wearHit) return -50;
    score += 5;

    if (/\b(close[\s-]?up|worn|wearing|on\s+(my|her|his|the)\s+(wrist|finger|neck|ear))\b/i.test(blob)) {
      score += 2;
    }

    const brand = String(seed?.brandEn || "").toLowerCase();
    if (brand && blob.includes(brand)) score += 3;

    const latin = String(seed?.displayTitle || seed?.title || "").match(/[A-Za-z][A-Za-z0-9'&.-]{2,}/g);
    if (latin) {
      let hits = 0;
      latin.slice(0, 4).forEach((w) => {
        if (blob.includes(w.toLowerCase())) hits += 1;
      });
      score += Math.min(3, hits);
    }

    if (/\b(product shot|white background|packshot|still life only)\b/i.test(blob)) score -= 2;

    return score;
  }

  function isOverseasOk(card) {
    const land = String(card.permalink || "");
    const img = String(card.image || "");
    if (!card.image || !card.permalink) return false;
    if (KR_HOST_RE.test(land) || KR_HOST_RE.test(img) || KR_HOST_RE.test(hostOf(land))) return false;
    return true;
  }

  function relativeTimeKo(iso, salt) {
    let ms = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(ms)) {
      // Stable faux recency when source has no date (still IG-like)
      const n = Math.abs(hashStr(String(salt || "x"))) % (72 * 3600 * 1000);
      ms = Date.now() - (6 * 3600 * 1000 + n);
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

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  function pickSeeds(catalog, n) {
    const items = (catalog && catalog.items) || [];
    if (!items.length) return [];
    const seed = daySeed();
    const ranked = window.HxCatalog?.forYou?.(catalog, 48) || items.slice(0, 48);
    const rotated = ranked
      .map((item, i) => ({ item, k: (seed + i * 17) % 997 }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.item)
      .filter((x) => x.type && x.type !== "other");
    const seen = new Set();
    const out = [];
    for (const item of rotated) {
      const key = `${item.brandCode}|${item.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= n) break;
    }
    return out.length ? out : ranked.slice(0, n);
  }

  function buildQueries(item) {
    const type = TYPE_EN[item.type] || "jewelry";
    const body = BODY_FOR_QUERY[item.type] || "hand";
    const brand = item.brandEn || "";
    const q = [
      `closeup ${type} on ${body} jewelry`,
      `wearing ${type} jewelry ${body}`,
      `gold ${type} on ${body} jewelry hand`,
    ];
    if (brand) {
      q.push(`${brand} ${type} on ${body}`);
      q.push(`${brand} ${type} jewelry worn`);
    }
    return [...new Set(q)].slice(0, 4);
  }

  function normalizeCard(partial) {
    return {
      id: partial.id || `wear-${Math.random().toString(36).slice(2, 9)}`,
      image: partial.image || "",
      thumb: partial.thumb || partial.image || "",
      permalink: partial.permalink || "",
      title: partial.title || "",
      caption: partial.caption || "",
      creator: partial.creator || "",
      source: partial.source || "open",
      license: partial.license || "",
      tags: partial.tags || [],
      mature: partial.mature === true,
      sensitivity: partial.sensitivity || [],
      indexedOn: partial.indexedOn || partial.indexed_on || "",
      seedId: partial.seedId || "",
      seedTitle: partial.seedTitle || "",
      seedBrand: partial.seedBrand || "",
      seedType: partial.seedType || "",
      score: partial.score || 0,
    };
  }

  async function searchOpenverse(query, seed) {
    const url =
      "https://api.openverse.org/v1/images/?" +
      new URLSearchParams({
        q: query,
        page_size: "20",
        mature: "false",
        source: "flickr,rawpixel",
      }).toString();
    const data = await fetchJson(url);
    return (data.results || []).map((row, i) =>
      normalizeCard({
        id: `ov-${row.id || i}`,
        image: row.url || row.thumbnail || "",
        thumb: row.thumbnail || row.url || "",
        permalink: row.foreign_landing_url || row.detail_url || "",
        title: row.title || query,
        caption: "",
        creator: row.creator || row.source || "",
        source: row.source || "openverse",
        license: row.license || "",
        tags: row.tags || [],
        mature: row.mature === true,
        sensitivity: row.unstable__sensitivity || [],
        indexedOn: row.indexed_on || "",
        seedId: seed.id,
        seedTitle: seed.displayTitle || seed.title,
        seedBrand: seed.brandEn || seed.brandKo || "",
        seedType: seed.type,
      })
    );
  }

  async function fetchBackendFeed(seeds) {
    const base = String(window.HX_WEAR_FEED_API || "").replace(/\/$/, "");
    if (!base) return null;
    try {
      const res = await fetch(`${base}/wear-feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          region: "overseas",
          excludeCountries: ["KR"],
          mode: "jewelry_wear_only",
          seeds: seeds.map((s) => ({
            id: s.id,
            brand: s.brandEn,
            type: s.type,
            title: s.displayTitle || s.title,
            image: s.coverUrl,
          })),
          limit: 24,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.items || data.results || [])
        .map((row) =>
          normalizeCard({
            ...row,
            permalink: row.permalink || row.post_url || row.sourceUrl,
            image: row.image || row.image_url || row.coverUrl,
            indexedOn: row.indexedOn || row.created_at || row.published_at || "",
          })
        )
        .filter(isOverseasOk);
    } catch (_) {
      return null;
    }
  }

  async function buildWearFeed(opts) {
    const force = !!(opts && opts.force);
    if (!force) {
      const hit = cacheGet();
      if (hit?.items?.length) return { items: hit.items, from: "cache", meta: hit.meta };
    }

    const catalog = await window.HxCatalog.loadCatalog();
    const seeds = pickSeeds(catalog, 5);
    if (!seeds.length) return { items: [], from: "empty", meta: {} };

    const backend = await fetchBackendFeed(seeds);
    if (backend && backend.length) {
      const scored = backend
        .map((c) => {
          const seed = seeds.find((s) => String(s.id) === String(c.seedId)) || seeds[0];
          const score = scoreRelevance(c, seed);
          return { ...c, score };
        })
        .filter((c) => c.score >= MIN_SCORE)
        .sort((a, b) => b.score - a.score);
      if (scored.length) {
        cacheSet(scored, { provider: "HX_WEAR_FEED_API" });
        return { items: scored.slice(0, 24), from: "api", meta: { provider: "HX_WEAR_FEED_API" } };
      }
    }

    const collected = [];
    const seenImg = new Set();

    for (const seed of seeds) {
      for (const q of buildQueries(seed)) {
        try {
          const rows = await searchOpenverse(q, seed);
          for (const row of rows) {
            if (!isOverseasOk(row)) continue;
            const score = scoreRelevance(row, seed);
            if (score < MIN_SCORE) continue;
            const key = String(row.image).split("?")[0];
            if (seenImg.has(key)) continue;
            seenImg.add(key);
            collected.push({ ...row, score });
          }
        } catch (_) {}
        if (collected.length >= 28) break;
      }
      if (collected.length >= 28) break;
    }

    collected.sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
    const items = collected.slice(0, 24);
    const meta = {
      provider: "openverse",
      seeds: seeds.map((s) => s.id),
      filtered: true,
    };
    cacheSet(items, meta);
    return { items, from: "live", meta };
  }

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

  function cardNode(item) {
    const a = el("article", "hx-ig__card");

    const head = el("div", "hx-ig__head");
    const av = el("div", "hx-ig__avatar");
    av.innerHTML = `<img alt="본 헤리티지" src="${LOGO}" width="36" height="36" loading="lazy">`;
    const meta = el("div", "hx-ig__meta");
    meta.innerHTML = `<strong>${BRAND_NAME}</strong>`;
    const time = el("time", "hx-ig__time", relativeTimeKo(item.indexedOn, item.id));
    time.dateTime = item.indexedOn || "";
    head.append(av, meta, time);

    const media = el("button", "hx-ig__media");
    media.type = "button";
    media.setAttribute("aria-label", "원문 열기");
    media.innerHTML = `<img alt="" loading="lazy" decoding="async" src="${item.thumb || item.image}">`;
    media.addEventListener("click", () => openPermalink(item.permalink));

    const foot = el("div", "hx-ig__foot");
    const cap = el("p", "hx-ig__caption");
    const seedLine = item.seedTitle
      ? `<b>${item.seedBrand ? item.seedBrand + " · " : ""}${item.seedTitle}</b> 착용·코디 참고`
      : `<b>${BRAND_NAME}</b> 주얼리 착용컷`;
    cap.innerHTML = seedLine;

    const by = el("div", "hx-ig__by");
    const srcName = sourceLabel(item.permalink, item.source);
    by.innerHTML = `<span>BY ${srcName}</span>`;
    const linkBtn = el("button", "hx-ig__src");
    linkBtn.type = "button";
    linkBtn.textContent = "링크";
    linkBtn.addEventListener("click", () => openPermalink(item.permalink));
    by.append(linkBtn);

    foot.append(cap, by);
    a.append(head, media, foot);
    return a;
  }

  async function renderWearFeed(root, opts) {
    if (!root) return false;
    root.replaceChildren();

    const hero = el("header", "hx-page__hero");
    hero.innerHTML =
      `<p class="hx-page__eyebrow">STYLE FEED</p>` +
      `<h1 class="hx-page__title">코디 · 착용</h1>` +
      `<p class="hx-page__lead">주얼리 착용컷만 모았습니다. 이미지·링크를 누르면 원문으로 이동합니다.</p>`;
    root.append(hero);

    const note = el("p", "hx-note");
    note.textContent = "착용컷 검증 중…";
    root.append(note);

    const feed = el("div", "hx-ig");
    root.append(feed);

    try {
      // Bust previous loose results after filter upgrade
      try {
        localStorage.removeItem("hx.wear.feed.v1");
        localStorage.removeItem("hx.wear.feed.v2");
        localStorage.removeItem("hx.wear.feed.v3");
      } catch (_) {}
      const { items, from, meta } = await buildWearFeed({ force: true });
      if (!items.length) {
        note.textContent = "검증을 통과한 착용컷이 없습니다. 잠시 후 다시 시도해 주세요.";
        return false;
      }
      note.textContent = `${items.length}장 · 주얼리 착용컷만 · ${from}`;
      const frag = document.createDocumentFragment();
      items.forEach((item) => frag.append(cardNode(item)));
      feed.append(frag);
      if (!window.HX_WEAR_FEED_API) {
        root.append(
          el(
            "p",
            "hx-disclaimer",
            "해외 오픈 이미지(Flickr 등)에서 착용 맥락·주얼리 키워드로 필터링합니다. 성인·무관 이미지는 제외합니다."
          )
        );
      }
      return true;
    } catch (_) {
      note.textContent = "피드를 불러오지 못했습니다.";
      return false;
    }
  }

  // Bust stale loose cache from older versions
  try {
    localStorage.removeItem("hx.wear.feed.v1");
    localStorage.removeItem("hx.wear.feed.v2");
  } catch (_) {}

  window.HxWearFeed = {
    buildWearFeed,
    renderWearFeed,
    scoreRelevance,
    isOverseasOk,
  };
})();
