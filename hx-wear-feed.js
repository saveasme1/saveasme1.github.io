(() => {
  "use strict";

  /**
   * Wear feed — ONLY keep images whose own title/tags mention the seed brand.
   * Never slap a portfolio product name onto a random necklace photo.
   */

  const CACHE_KEY = "hx.wear.feed.v4";
  const CACHE_TTL_MS = 3 * 3600 * 1000;
  const LOGO = "./icons/icon-192.png";
  const BRAND_NAME = "본 헤리티지";
  const MIN_SCORE = 14;

  const TYPE_EN = {
    ring: "ring",
    bracelet: "bracelet",
    necklace: "necklace",
    earring: "earrings",
    other: "jewelry",
  };

  const TYPE_WORDS = {
    ring: ["ring", "rings", "band", "engagementring", "weddingring"],
    bracelet: ["bracelet", "bracelets", "bangle", "cuff", "love bracelet"],
    necklace: ["necklace", "necklaces", "pendant", "choker"],
    earring: ["earring", "earrings", "stud", "hoop"],
    other: ["jewelry", "jewellery"],
  };

  const WEAR_WORDS = {
    ring: ["finger", "fingers", "hand", "hands", "worn", "wearing", "closeup", "close-up"],
    bracelet: ["wrist", "arm", "hand", "worn", "wearing", "closeup", "close-up", "stacked"],
    necklace: ["neck", "worn", "wearing", "portrait", "closeup", "close-up", "model"],
    earring: ["ear", "earlobe", "ears", "worn", "wearing", "portrait", "closeup"],
    other: ["worn", "wearing", "wrist", "finger", "neck", "hand", "model", "portrait"],
  };

  const BODY_FOR_QUERY = {
    ring: "finger",
    bracelet: "wrist",
    necklace: "neck",
    earring: "ear",
    other: "hand",
  };

  const BRAND_ALIASES = {
    cartier: ["cartier"],
    bulgari: ["bulgari", "bvlgari"],
    "van cleef & arpels": ["van cleef", "vancleef", "vca", "alhambra"],
    boucheron: ["boucheron"],
    chaumet: ["chaumet"],
    "chrome hearts": ["chrome hearts", "chromehearts"],
    chanel: ["chanel"],
    gucci: ["gucci"],
    hermes: ["hermes", "hermès"],
    tiffany: ["tiffany", "tiffany & co", "tiffanyandco"],
    harry: ["harry winston"],
    piaget: ["piaget"],
  };

  const NSFW_RE =
    /\b(nude|nudes|naked|topless|bottomless|lingerie|underwear|panties|thong|bra\b|fetish|bdsm|porn|xxx|erotic|sensual|boudoir|pin[\s-]?up|nsfw|sex\b|sexy|cleavage|nipple|breast|boob|ass\b|butt\b|crotch|genital|bikini|swimsuit|onlyfans|hentai|lewd)\b/i;

  /** Ethnic / craft / museum noise that is NOT luxury brand wear */
  const REJECT_STYLE_RE =
    /\b(tribal|ethnic|indigenous|folk|traditional|maasai|masai|massai|zulu|beadwork|beaded|beads only|african jewelry|native|ceremonial|costume jewelry|handmade beads|macrame|friendship bracelet|rainbow loom|lego|toy|doll|mannequin head|museum artifact|archaeolog|excavation|ancient roman|byzantine|viking|celtic torc|streetparade|protest|building|architecture|skyline|coloring|cartoon|comic|anime|cosplay|christmas decor|xmas)\b/i;

  const LUXURY_CONTEXT_RE =
    /\b(luxury|haute|couture|fashion week|street style|outfit|model|editorial|campaign|lookbook|wrist shot|hand shot|fine jewelry|high jewelry|joaillerie)\b/i;

  const KR_HOST_RE =
    /\.kr\b|naver\.|daum\.|kakao\.|coupang\.|gmarket\.|11st\.|musinsa\.|ssg\.com|oliveyoung\.|kurly\.|tistory\.|blog\.me|wemakeprice\.|auction\.co\.kr|interpark\.|smartstore\.|bunjang\.|zigzag\.|ably\.|brandi\.|hiver\.|ohou\.|yanolja\.|baemin\.|toss\.im|kream\.co/i;

  const STOP_PRODUCT = new Set([
    "the",
    "and",
    "for",
    "with",
    "gold",
    "rose",
    "white",
    "yellow",
    "ring",
    "bracelet",
    "necklace",
    "earring",
    "earrings",
    "pendant",
    "chain",
    "jewelry",
    "jewellery",
  ]);

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
    const w = String(word || "").toLowerCase().trim();
    if (!w) return false;
    if (w.includes(" ")) return blob.includes(w);
    if (w.length <= 4) {
      return new RegExp(`(?:^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9]|$)`, "i").test(blob);
    }
    return blob.includes(w);
  }

  function brandAliases(brandEn) {
    const key = String(brandEn || "").toLowerCase().trim();
    if (!key) return [];
    for (const [name, list] of Object.entries(BRAND_ALIASES)) {
      if (key === name || key.includes(name) || list.some((a) => key.includes(a))) {
        return [...new Set([key, name, ...list])];
      }
    }
    return [key];
  }

  function brandMatched(blob, brandEn) {
    const aliases = brandAliases(brandEn);
    return aliases.some((a) => hasToken(blob, a) || blob.includes(a));
  }

  function productTokens(seed) {
    const raw = String(seed.displayTitle || seed.title || "");
    const latin = raw.match(/[A-Za-z][A-Za-z0-9'&.-]{2,}/g) || [];
    const brandBits = brandAliases(seed.brandEn).flatMap((a) => a.split(/\s+/));
    return latin
      .map((w) => w.toLowerCase())
      .filter((w) => w.length >= 3 && !STOP_PRODUCT.has(w) && !brandBits.includes(w));
  }

  /** Hard gates: brand in source text, luxury-ish, not tribal/NSFW, type+wear. */
  function scoreRelevance(card, seed) {
    const blob = textBlob(card);
    if (!blob.trim()) return -100;
    if (card.mature === true) return -100;
    if (Array.isArray(card.sensitivity) && card.sensitivity.length) return -100;
    if (NSFW_RE.test(blob)) return -100;
    if (REJECT_STYLE_RE.test(blob)) return -100;

    const brand = seed?.brandEn || "";
    if (!brand) return -100;
    // CRITICAL: portfolio label only if brand appears in the SOURCE metadata
    if (!brandMatched(blob, brand)) return -100;

    const type = seed?.type || "other";
    const typeWords = TYPE_WORDS[type] || TYPE_WORDS.other;
    const wearWords = WEAR_WORDS[type] || WEAR_WORDS.other;

    if (!typeWords.some((w) => hasToken(blob, w))) return -80;
    if (!wearWords.some((w) => hasToken(blob, w))) return -80;

    let score = 12; // brand + type + wear already required
    score += 4; // brand bonus already gated

    const tokens = productTokens(seed);
    let productHits = 0;
    tokens.forEach((t) => {
      if (blob.includes(t)) productHits += 1;
    });
    // For named lines (Coco Crush, Juste un Clou, Love…) require ≥1 product token when available
    if (tokens.length >= 1 && productHits === 0) {
      // Allow only if strong luxury editorial context — still risky, so keep strict
      if (!LUXURY_CONTEXT_RE.test(blob)) return -40;
      score -= 3;
    } else {
      score += Math.min(6, productHits * 3);
    }

    if (LUXURY_CONTEXT_RE.test(blob)) score += 2;
    if (/\b(close[\s-]?up|on\s+(my|her|his|the)\s+(wrist|finger|neck|ear))\b/i.test(blob)) score += 2;

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
    const ranked = (window.HxCatalog?.forYou?.(catalog, 60) || items.slice(0, 60)).filter(
      (x) => x.brandEn && x.type && x.type !== "other"
    );
    const rotated = ranked
      .map((item, i) => ({ item, k: (seed + i * 17) % 997 }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.item);
    const seen = new Set();
    const out = [];
    for (const item of rotated) {
      const key = `${item.brandCode}|${item.type}|${(item.displayTitle || "").slice(0, 24)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= n) break;
    }
    return out;
  }

  function buildQueries(item) {
    const type = TYPE_EN[item.type] || "jewelry";
    const body = BODY_FOR_QUERY[item.type] || "hand";
    const brand = item.brandEn || "";
    const tokens = productTokens(item).slice(0, 2);
    const q = [];
    // Brand MUST be in the query string
    if (tokens.length) {
      q.push(`${brand} ${tokens.join(" ")} ${type}`);
      q.push(`${brand} ${tokens[0]} ${type} worn`);
    }
    q.push(`${brand} ${type} on ${body}`);
    q.push(`${brand} ${type} jewelry worn`);
    q.push(`${brand} ${type} street style`);
    return [...new Set(q.filter(Boolean))].slice(0, 4);
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
      brandVerified: !!partial.brandVerified,
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
          mode: "brand_verified_wear_only",
          requireBrandInSource: true,
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
            brandVerified: true,
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
    const seeds = pickSeeds(catalog, 8);
    if (!seeds.length) return { items: [], from: "empty", meta: {} };

    const backend = await fetchBackendFeed(seeds);
    if (backend && backend.length) {
      const scored = backend
        .map((c) => {
          const seed = seeds.find((s) => String(s.id) === String(c.seedId)) || {
            brandEn: c.seedBrand,
            type: c.seedType,
            displayTitle: c.seedTitle,
          };
          const score = scoreRelevance(c, seed);
          return { ...c, score, brandVerified: score >= MIN_SCORE };
        })
        .filter((c) => c.score >= MIN_SCORE)
        .sort((a, b) => b.score - a.score);
      if (scored.length) {
        cacheSet(scored.slice(0, 20), { provider: "HX_WEAR_FEED_API" });
        return { items: scored.slice(0, 20), from: "api", meta: { provider: "HX_WEAR_FEED_API" } };
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
            collected.push({ ...row, score, brandVerified: true });
          }
        } catch (_) {}
        if (collected.length >= 24) break;
      }
      if (collected.length >= 24) break;
    }

    collected.sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
    const items = collected.slice(0, 20);
    const meta = { provider: "openverse", brandVerified: true, seeds: seeds.map((s) => s.id) };
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
    // Never claim unverified product match
    if (!item.brandVerified) return null;

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
    // Caption = source title (truth), seed only as small hint when brand-verified
    const srcTitle = String(item.title || "").trim().slice(0, 80);
    cap.innerHTML =
      `<b>${item.seedBrand || BRAND_NAME}</b> ` +
      `${srcTitle || "브랜드 착용 참고컷"}` +
      (item.seedTitle ? `<span class="hx-ig__seed"> · 시드: ${item.seedTitle}</span>` : "");

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
      `<p class="hx-page__lead">원문 메타에 브랜드명이 확인된 착용컷만 표시합니다. 없으면 비웁니다.</p>`;
    root.append(hero);

    const note = el("p", "hx-note");
    note.textContent = "브랜드 검증 중…";
    root.append(note);

    const feed = el("div", "hx-ig");
    root.append(feed);

    try {
      const { items, from } = await buildWearFeed(opts);
      const nodes = items.map(cardNode).filter(Boolean);
      if (!nodes.length) {
        note.textContent =
          "브랜드가 원문에 확인된 착용컷이 지금은 없습니다. (틀린 매칭보다 빈 화면이 낫습니다)";
        return false;
      }
      note.textContent = `${nodes.length}장 · 브랜드 원문 검증 통과 · ${from}`;
      const frag = document.createDocumentFragment();
      nodes.forEach((n) => frag.append(n));
      feed.append(frag);
      root.append(
        el(
          "p",
          "hx-disclaimer",
          "포폴 제품명과 사진이 1:1로 같다고 보장하지 않습니다. 원문 제목/태그에 브랜드가 있을 때만 노출합니다."
        )
      );
      return true;
    } catch (_) {
      note.textContent = "피드를 불러오지 못했습니다.";
      return false;
    }
  }

  try {
    localStorage.removeItem("hx.wear.feed.v1");
    localStorage.removeItem("hx.wear.feed.v2");
    localStorage.removeItem("hx.wear.feed.v3");
  } catch (_) {}

  window.HxWearFeed = {
    buildWearFeed,
    renderWearFeed,
    scoreRelevance,
    brandMatched,
    isOverseasOk,
  };
})();
