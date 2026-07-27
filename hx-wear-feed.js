(() => {
  "use strict";

  /** Instagram-style wear/coord discovery — portfolio-seeded overseas image posts.
   *  Real Instagram Graph search needs Meta tokens / backend.
   *  Optional: window.HX_WEAR_FEED_API → GET|POST returning { items: WearCard[] }
   *  Fallback: Openverse + Wikimedia Commons (CC), Korea domains excluded.
   */

  const CACHE_KEY = "hx.wear.feed.v1";
  const CACHE_TTL_MS = 6 * 3600 * 1000;
  const UA = "HeritagePWA/1.9.2 (hand-made.kr; wear-feed; openverse+commons)";

  const TYPE_EN = {
    ring: "ring",
    bracelet: "bracelet",
    necklace: "necklace",
    earring: "earrings",
    other: "jewelry",
  };

  const COMMONS_BY_TYPE = {
    ring: "Category:Women_with_rings",
    bracelet: "Category:Women_with_bracelets",
    necklace: "Category:Women_with_necklaces",
    earring: "Category:Women_with_earrings",
    other: "Category:Street_fashion",
  };

  const KR_HOST_RE =
    /\.kr\b|naver\.|daum\.|kakao\.|coupang\.|gmarket\.|11st\.|musinsa\.|ssg\.com|oliveyoung\.|kurly\.|tistory\.|blog\.me|wemakeprice\.|auction\.co\.kr|interpark\.|smartstore\.|bunjang\.|zigzag\.|ably\.|brandi\.|hiver\.|ohou\.|yanolja\.|baemin\.|toss\.im|kream\.co|musinsa/i;

  const KR_TEXT_RE = /대한민국|서울특별시|korean\s*fashion\s*blog|한국\s*패션|국내배송|무료배송\s*한국/i;

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
        JSON.stringify({
          exp: Date.now() + CACHE_TTL_MS,
          at: Date.now(),
          items,
          meta: meta || {},
        })
      );
    } catch (_) {}
  }

  async function fetchJson(url, opts) {
    const res = await fetch(url, {
      cache: "no-store",
      ...opts,
      headers: {
        Accept: "application/json",
        "User-Agent": UA,
        ...(opts && opts.headers),
      },
    });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch (_) {
      return "";
    }
  }

  function isOverseasOk(card) {
    const land = String(card.permalink || card.sourceUrl || "");
    const img = String(card.image || "");
    const blob = `${card.title || ""} ${card.caption || ""} ${card.creator || ""} ${land} ${img}`;
    if (KR_HOST_RE.test(land) || KR_HOST_RE.test(img) || KR_HOST_RE.test(hostOf(land))) return false;
    if (KR_TEXT_RE.test(blob)) return false;
    if (!card.image || !card.permalink) return false;
    return true;
  }

  function daySeed() {
    const d = new Date();
    return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  }

  function pickSeeds(catalog, n) {
    const items = (catalog && catalog.items) || [];
    if (!items.length) return [];
    const seed = daySeed();
    const ranked = window.HxCatalog?.forYou?.(catalog, 40) || items.slice(0, 40);
    const rotated = ranked
      .map((item, i) => ({ item, k: (seed + i * 17) % 997 }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.item);
    const seen = new Set();
    const out = [];
    for (const item of rotated) {
      const key = `${item.brandCode}|${item.type}`;
      if (seen.has(key) && out.length >= Math.min(3, n)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= n) break;
    }
    return out;
  }

  function englishBits(item) {
    const title = String(item.displayTitle || item.title || "");
    const latin = (title.match(/[A-Za-z][A-Za-z0-9'&.-]*/g) || []).join(" ").trim();
    const type = TYPE_EN[item.type] || "jewelry";
    const brand = item.brandEn || "";
    return { brand, type, latin };
  }

  function buildQueries(item) {
    const { brand, type, latin } = englishBits(item);
    const q = [];
    // Broad wear/coord queries first (Openverse is sparse for luxury brand+street)
    q.push(`woman wearing ${type} fashion`);
    q.push(`${type} jewelry street fashion`);
    q.push(`gold ${type} outfit fashion`);
    if (brand && type) {
      q.push(`${brand} ${type} fashion`);
      q.push(`${brand} ${type} jewelry`);
    }
    if (latin && latin.length > 3) q.push(`${latin} jewelry fashion`);
    return [...new Set(q)].slice(0, 4);
  }

  function normalizeCard(partial) {
    return {
      id: partial.id || `wear-${Math.random().toString(36).slice(2, 9)}`,
      image: partial.image || "",
      thumb: partial.thumb || partial.image || "",
      permalink: partial.permalink || partial.sourceUrl || "",
      title: partial.title || "",
      caption: partial.caption || partial.title || "",
      creator: partial.creator || "",
      source: partial.source || "open",
      license: partial.license || "",
      seedId: partial.seedId || "",
      seedTitle: partial.seedTitle || "",
      seedBrand: partial.seedBrand || "",
      seedCover: partial.seedCover || "",
      attribution: partial.attribution || "",
    };
  }

  async function searchOpenverse(query, seed) {
    const url =
      "https://api.openverse.org/v1/images/?" +
      new URLSearchParams({
        q: query,
        page_size: "12",
        mature: "false",
        source: "flickr,wikimedia,wordpress,rawpixel,thingiverse",
      }).toString();
    const data = await fetchJson(url);
    return (data.results || []).map((row, i) =>
      normalizeCard({
        id: `ov-${row.id || i}-${seed.id}`,
        image: row.url || row.thumbnail || "",
        thumb: row.thumbnail || row.url || "",
        permalink: row.foreign_landing_url || row.detail_url || "",
        title: row.title || query,
        caption: `${seed.brandEn || ""} · ${query}`,
        creator: row.creator || row.source || "",
        source: row.source || "openverse",
        license: row.license || "",
        seedId: seed.id,
        seedTitle: seed.displayTitle || seed.title,
        seedBrand: seed.brandEn || seed.brandKo || "",
        seedCover: seed.coverUrl || "",
        attribution: `Openverse · ${row.source || "CC"}`,
      })
    );
  }

  async function commonsCategory(type, seed, limit) {
    const cat = COMMONS_BY_TYPE[type] || COMMONS_BY_TYPE.other;
    const list = await fetchJson(
      "https://commons.wikimedia.org/w/api.php?" +
        new URLSearchParams({
          action: "query",
          list: "categorymembers",
          cmtitle: cat,
          cmtype: "file",
          cmlimit: String(Math.max(8, (limit || 8) * 2)),
          format: "json",
          origin: "*",
        }).toString()
    );
    const members = (list.query && list.query.categorymembers) || [];
    if (!members.length) return [];
    // rotate by day
    const offset = daySeed() % Math.max(1, members.length - 1);
    const pick = members.slice(offset).concat(members.slice(0, offset)).slice(0, limit || 8);
    const titles = pick.map((m) => m.title).join("|");
    const info = await fetchJson(
      "https://commons.wikimedia.org/w/api.php?" +
        new URLSearchParams({
          action: "query",
          titles,
          prop: "imageinfo",
          iiprop: "url|extmetadata|mime",
          iiurlwidth: "900",
          format: "json",
          origin: "*",
        }).toString()
    );
    const pages = Object.values((info.query && info.query.pages) || {});
    return pages
      .map((p) => {
        const ii = p.imageinfo && p.imageinfo[0];
        if (!ii || !ii.url) return null;
        if (ii.mime && !String(ii.mime).startsWith("image/")) return null;
        const meta = ii.extmetadata || {};
        return normalizeCard({
          id: `commons-${p.pageid}`,
          image: ii.thumburl || ii.url,
          thumb: ii.thumburl || ii.url,
          permalink: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
          title: String(p.title || "").replace(/^File:/, ""),
          caption: `${seed.brandEn || "Heritage"} · wear / style reference`,
          creator: meta.Artist?.value?.replace(/<[^>]+>/g, "") || "Wikimedia Commons",
          source: "wikimedia",
          license: meta.LicenseShortName?.value || "Commons",
          seedId: seed.id,
          seedTitle: seed.displayTitle || seed.title,
          seedBrand: seed.brandEn || seed.brandKo || "",
          seedCover: seed.coverUrl || "",
          attribution: "Wikimedia Commons",
        });
      })
      .filter(Boolean);
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
          seeds: seeds.map((s) => ({
            id: s.id,
            brand: s.brandEn,
            type: s.type,
            title: s.displayTitle || s.title,
            image: s.coverUrl,
          })),
          limit: 36,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const items = (data.items || data.results || []).map((row) =>
        normalizeCard({
          ...row,
          permalink: row.permalink || row.post_url || row.sourceUrl || row.product_url,
          image: row.image || row.image_url || row.coverUrl,
        })
      );
      return items.filter(isOverseasOk);
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
    const seeds = pickSeeds(catalog, 6);
    if (!seeds.length) return { items: [], from: "empty", meta: {} };

    const backend = await fetchBackendFeed(seeds);
    if (backend && backend.length) {
      cacheSet(backend, { provider: "HX_WEAR_FEED_API" });
      return { items: backend, from: "api", meta: { provider: "HX_WEAR_FEED_API" } };
    }

    const collected = [];
    const seenImg = new Set();

    for (const seed of seeds) {
      const queries = buildQueries(seed);
      for (const q of queries.slice(0, 3)) {
        try {
          const rows = await searchOpenverse(q, seed);
          for (const row of rows) {
            if (!isOverseasOk(row)) continue;
            const key = row.image.split("?")[0];
            if (seenImg.has(key)) continue;
            seenImg.add(key);
            collected.push(row);
          }
        } catch (_) {}
        if (collected.length >= 28) break;
      }
      try {
        const extras = await commonsCategory(seed.type || "other", seed, 6);
        for (const row of extras) {
          if (!isOverseasOk(row)) continue;
          const key = row.image.split("?")[0];
          if (seenImg.has(key)) continue;
          seenImg.add(key);
          collected.push(row);
        }
      } catch (_) {}
      if (collected.length >= 32) break;
    }

    // light shuffle stable by day
    const seedN = daySeed();
    collected.sort((a, b) => {
      const ha = (a.id + seedN).length + a.id.charCodeAt(0);
      const hb = (b.id + seedN).length + b.id.charCodeAt(0);
      return (ha % 97) - (hb % 97);
    });

    const items = collected.slice(0, 36);
    const meta = {
      provider: "openverse+commons",
      seeds: seeds.map((s) => s.id),
      note: "Instagram Graph 검색은 API 키 필요 · 현재 해외 오픈라이선스 착용/코디 이미지",
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
    if (item.seedCover) {
      av.innerHTML = `<img alt="" src="${item.seedCover}" loading="lazy">`;
    } else {
      av.textContent = (item.seedBrand || "H").slice(0, 1);
    }
    const meta = el("div", "hx-ig__meta");
    meta.innerHTML =
      `<strong>${item.seedBrand || item.creator || "STYLE"}</strong>` +
      `<span>${item.source || "overseas"} · ${item.license || "open"}</span>`;
    head.append(av, meta);

    const media = el("button", "hx-ig__media");
    media.type = "button";
    media.setAttribute("aria-label", "원문 게시물 열기");
    media.innerHTML = `<img alt="" loading="lazy" decoding="async" src="${item.thumb || item.image}">`;
    media.addEventListener("click", () => openPermalink(item.permalink));

    const foot = el("div", "hx-ig__foot");
    const cap = el("p", "hx-ig__caption");
    cap.innerHTML = `<b>${item.seedTitle || item.title || ""}</b> ${(item.caption || "").slice(0, 90)}`;
    const go = el("button", "hx-ig__link");
    go.type = "button";
    go.textContent = "원문 보기";
    go.addEventListener("click", () => openPermalink(item.permalink));
    const pf = el("button", "hx-ig__pf");
    pf.type = "button";
    pf.textContent = "포폴";
    pf.addEventListener("click", () => {
      if (!item.seedId) return;
      const app = /[?&]app=1(?:&|$)/.test(location.search) ? "&app=1" : "";
      location.href = `./portfolio.html?id=${encodeURIComponent(item.seedId)}${app}`;
    });
    const actions = el("div", "hx-ig__actions");
    actions.append(go, pf);
    foot.append(cap, actions);

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
      `<p class="hx-page__lead">포트폴리오 피스를 시드로, 해외 착용·코디 이미지를 인스타형으로 모읍니다. 탭하면 원문 글로 이동합니다. (한국 도메인 제외)</p>`;
    root.append(hero);

    const note = el("p", "hx-note");
    note.textContent = "불러오는 중…";
    root.append(note);

    const feed = el("div", "hx-ig");
    root.append(feed);

    try {
      const { items, from, meta } = await buildWearFeed(opts);
      if (!items.length) {
        note.textContent = "표시할 해외 착용 이미지를 찾지 못했습니다. 잠시 후 새로고침 해 주세요.";
        return false;
      }
      note.textContent =
        `${items.length}장 · ${from}` +
        (meta?.provider ? ` · ${meta.provider}` : "") +
        " · 이미지만 표시 · 원문 링크 유지";
      const frag = document.createDocumentFragment();
      items.forEach((item) => frag.append(cardNode(item)));
      feed.append(frag);

      if (meta?.note) {
        root.append(el("p", "hx-disclaimer", meta.note));
      } else if (!window.HX_WEAR_FEED_API) {
        root.append(
          el(
            "p",
            "hx-disclaimer",
            "Instagram 공식 해시태그/키워드 검색은 Meta API 키가 필요합니다. 지금은 Openverse·Wikimedia 등 해외 오픈 소스로 유사 피드를 구성합니다. 백엔드 연결 시 window.HX_WEAR_FEED_API 를 설정하세요."
          )
        );
      }
      return true;
    } catch (_) {
      note.textContent = "피드를 불러오지 못했습니다.";
      return false;
    }
  }

  window.HxWearFeed = {
    buildWearFeed,
    renderWearFeed,
    isOverseasOk,
  };
})();
