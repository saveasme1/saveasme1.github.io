(() => {
  "use strict";

  const CACHE_PREFIX = "hx.content.cache.";
  const DAY_KEY = "hx.content.day.";
  const FOLLOW_KEY = "hx.life.topics";

  const GEMS = [
    {
      id: "diamond",
      name: "Diamond",
      nameKo: "다이아몬드",
      formula: "C",
      hardness: "10",
      color: "무색~다양한 팬시 컬러",
      care: "초음파는 세팅·균열 상태에 따라 주의. 고온·급격한 온도 변화 주의.",
      wiki: "Diamond",
      myth: "다이아몬드는 절대 깨지지 않는다",
      mythVerdict: "거짓에 가깝다",
      mythWhy: "경도는 최고지만 벽개(쪼개짐) 방향이 있어 강한 충격에 깨질 수 있습니다.",
    },
    {
      id: "ruby",
      name: "Ruby",
      nameKo: "루비",
      formula: "Al₂O₃ (Corundum)",
      hardness: "9",
      color: "적색",
      care: "열·급격한 온도 변화·초음파는 처리석에 특히 주의.",
      wiki: "Ruby",
      myth: "모든 빨간 보석은 루비다",
      mythVerdict: "거짓",
      mythWhy: "스피넬, 가넷 등 유사 색 보석이 많습니다. 감정 없이 단정하지 마세요.",
    },
    {
      id: "emerald",
      name: "Emerald",
      nameKo: "에메랄드",
      formula: "Be₃Al₂(SiO₃)₆",
      hardness: "7.5–8",
      color: "녹색",
      care: "오일/수지 처리가 흔함. 초음파·스팀·강한 세제는 피하세요.",
      wiki: "Emerald",
      myth: "에메랄드는 초음파 세척해도 안전하다",
      mythVerdict: "위험한 편",
      mythWhy: "내포·균열·처리가 많아 초음파/스팀에 손상 위험이 큽니다.",
    },
    {
      id: "sapphire",
      name: "Sapphire",
      nameKo: "사파이어",
      formula: "Al₂O₃ (Corundum)",
      hardness: "9",
      color: "청색 외 다색",
      care: "내구성 좋지만 열처리석·코팅석은 별도 주의.",
      wiki: "Sapphire",
      myth: "사파이어는 파란색뿐이다",
      mythVerdict: "거짓",
      mythWhy: "핑크·옐로우·패드파라차 등 다양한 컬러 사파이어가 있습니다.",
    },
    {
      id: "pearl",
      name: "Pearl",
      nameKo: "진주",
      formula: "주로 CaCO₃ + 유기질",
      hardness: "2.5–4.5",
      color: "백색·크림·흑색 등",
      care: "산·향수·초음파 금지. 착용 후 부드러운 천으로 닦기.",
      wiki: "Pearl",
      myth: "진주는 물에 오래 담가 보관하면 좋다",
      mythVerdict: "대체로 거짓",
      mythWhy: "과도한 습윤·화학 성분은 표면을 손상시킬 수 있습니다.",
    },
    {
      id: "opal",
      name: "Opal",
      nameKo: "오팔",
      formula: "SiO₂·nH₂O",
      hardness: "5–6.5",
      color: "유색효과(play-of-color)",
      care: "건조·급격한 온도·초음파·화학물질에 취약.",
      wiki: "Opal",
      myth: "오팔은 다이아처럼 튼튼하다",
      mythVerdict: "거짓",
      mythWhy: "수분·충격·열에 민감한 보석입니다.",
    },
    {
      id: "aquamarine",
      name: "Aquamarine",
      nameKo: "아쿠아마린",
      formula: "Be₃Al₂Si₆O₁₈",
      hardness: "7.5–8",
      color: "청록~하늘색",
      care: "비교적 견고하나 열·급격한 온도 변화는 피하세요.",
      wiki: "Aquamarine",
      myth: "아쿠아마린은 무조건 천연 무처리다",
      mythVerdict: "과장",
      mythWhy: "열처리로 색을 개선하는 경우가 흔합니다.",
    },
  ];

  const CARE_RULES = {
    ultrasonic: {
      diamond: "주의",
      ruby: "주의",
      sapphire: "주의",
      emerald: "비권장",
      pearl: "금지",
      opal: "금지",
      aquamarine: "주의",
    },
    steam: {
      diamond: "주의",
      ruby: "주의",
      sapphire: "주의",
      emerald: "비권장",
      pearl: "금지",
      opal: "금지",
      aquamarine: "주의",
    },
    water: {
      diamond: "대체로 가능",
      ruby: "대체로 가능",
      sapphire: "대체로 가능",
      emerald: "짧은 시간만",
      pearl: "비권장",
      opal: "비권장",
      aquamarine: "대체로 가능",
    },
  };

  function dayIndex(n) {
    const d = new Date();
    const key = `${d.getUTCFullYear()}${d.getUTCMonth()}${d.getUTCDate()}`;
    let h = 0;
    for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return n ? h % n : h;
  }

  function todayStamp() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function cacheGet(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const row = JSON.parse(raw);
      if (!row || !row.exp || Date.now() > row.exp) return null;
      return row.data;
    } catch (_) {
      return null;
    }
  }

  function cacheSet(key, data, ttlHours) {
    try {
      localStorage.setItem(
        CACHE_PREFIX + key,
        JSON.stringify({ exp: Date.now() + (ttlHours || 24) * 3600 * 1000, data, at: Date.now() })
      );
    } catch (_) {}
  }

  function normalizeCard(partial) {
    return {
      id: partial.id || `tmp-${Date.now()}`,
      source: partial.source || "unknown",
      type: partial.type || "article",
      title: partial.title || "",
      titleKo: partial.titleKo || "",
      summaryKo: partial.summaryKo || "",
      image: partial.image || "",
      thumbnail: partial.thumbnail || partial.image || "",
      videoId: partial.videoId || null,
      creator: partial.creator || "",
      institution: partial.institution || "",
      publishedAt: partial.publishedAt || null,
      objectDate: partial.objectDate || "",
      rights: partial.rights || "",
      licenseUrl: partial.licenseUrl || "",
      sourceUrl: partial.sourceUrl || "",
      tags: partial.tags || [],
      attribution: partial.attribution || "",
      topic: partial.topic || "history",
      offline: Boolean(partial.offline),
    };
  }

  async function fetchJson(url, opts) {
    const res = await fetch(url, { cache: "no-store", ...(opts || {}) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function loadRegistry() {
    const cached = cacheGet("registry");
    if (cached) return cached;
    const data = await fetchJson(`./hx-external-sources.json?v=${Date.now()}`);
    cacheSet("registry", data, 168);
    return data;
  }

  async function viaBackend(path) {
    const base = (window.HX_CONTENT_API || "").replace(/\/$/, "");
    if (!base) return null;
    try {
      return await fetchJson(`${base}${path}`);
    } catch (_) {
      return null;
    }
  }

  async function fetchMetJewelry(limit) {
    const cached = cacheGet("met.jewelry");
    if (cached) return cached;
    const search = await fetchJson(
      "https://collectionapi.metmuseum.org/public/collection/v1/search?q=jewelry&hasImages=true"
    );
    const ids = (search.objectIDs || []).slice(0, 40);
    const picked = [];
    for (const id of ids) {
      if (picked.length >= (limit || 12)) break;
      try {
        const obj = await fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
        if (!obj || !obj.isPublicDomain || !obj.primaryImageSmall) continue;
        picked.push(
          normalizeCard({
            id: `met-${obj.objectID}`,
            source: "met",
            type: "museum_object",
            title: obj.title || "Untitled",
            titleKo: obj.title || "",
            summaryKo: [obj.culture, obj.objectDate, obj.medium].filter(Boolean).join(" · "),
            image: obj.primaryImage || obj.primaryImageSmall,
            thumbnail: obj.primaryImageSmall || obj.primaryImage,
            creator: (obj.artistDisplayName || "").trim(),
            institution: "The Metropolitan Museum of Art",
            objectDate: obj.objectDate || "",
            rights: "Public Domain (Met Open Access)",
            licenseUrl: "https://www.metmuseum.org/about-the-met/policies-and-terms/open-access",
            sourceUrl: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
            tags: ["museum", "jewelry", ...(obj.tags || []).map((t) => t.term).slice(0, 4)],
            attribution: `Image: The Metropolitan Museum of Art — ${obj.title}`,
            topic: "history",
          })
        );
      } catch (_) {}
    }
    cacheSet("met.jewelry", picked, 24);
    return picked;
  }

  async function fetchCmaJewelry(limit) {
    const cached = cacheGet("cma.jewelry");
    if (cached) return cached;
    const data = await fetchJson(
      "https://openaccess-api.clevelandart.org/api/artworks/?q=jewelry&has_image=1&cc0&limit=" + (limit || 12)
    );
    const rows = (data.data || [])
      .map((a) => {
        const img = a.images?.web?.url || a.images?.print?.url || "";
        if (!img) return null;
        return normalizeCard({
          id: `cma-${a.id}`,
          source: "cma",
          type: "museum_object",
          title: a.title || "Untitled",
          titleKo: a.title || "",
          summaryKo: [
            Array.isArray(a.culture)
              ? a.culture.map((c) => c?.name || c).filter(Boolean).join(", ")
              : a.culture || "",
            a.creation_date,
            a.technique,
          ]
            .flat()
            .filter(Boolean)
            .join(" · "),
          image: img,
          thumbnail: img,
          creator: a.creators?.[0]?.description || a.creators?.[0]?.name || "",
          institution: "Cleveland Museum of Art",
          objectDate: a.creation_date || "",
          rights: a.share_license_status || "CC0 / Open Access",
          licenseUrl: "https://www.clevelandart.org/open-access",
          sourceUrl: a.url || `https://www.clevelandart.org/art/${a.id}`,
          tags: ["museum", "jewelry", "cc0"],
          attribution: `Image: Cleveland Museum of Art — ${a.title}`,
          topic: "history",
        });
      })
      .filter(Boolean);
    cacheSet("cma.jewelry", rows, 24);
    return rows;
  }

  async function fetchAicJewelry(limit) {
    const cached = cacheGet("aic.jewelry");
    if (cached) return cached;
    const data = await fetchJson(
      "https://api.artic.edu/api/v1/artworks/search?q=jewelry&fields=id,title,image_id,artist_display,date_display,medium_display,is_public_domain,api_link&limit=30"
    );
    const rows = [];
    for (const a of data.data || []) {
      if (!a.is_public_domain || !a.image_id) continue;
      const img = `https://www.artic.edu/iiif/2/${a.image_id}/full/843,/0/default.jpg`;
      rows.push(
        normalizeCard({
          id: `aic-${a.id}`,
          source: "aic",
          type: "museum_object",
          title: a.title || "Untitled",
          titleKo: a.title || "",
          summaryKo: [a.artist_display, a.date_display, a.medium_display].filter(Boolean).join(" · "),
          image: img,
          thumbnail: img,
          creator: a.artist_display || "",
          institution: "Art Institute of Chicago",
          objectDate: a.date_display || "",
          rights: "Public Domain",
          licenseUrl: "https://www.artic.edu/open-access",
          sourceUrl: `https://www.artic.edu/artworks/${a.id}`,
          tags: ["museum", "jewelry"],
          attribution: `Image: Art Institute of Chicago — ${a.title}`,
          topic: "history",
        })
      );
      if (rows.length >= (limit || 12)) break;
    }
    cacheSet("aic.jewelry", rows, 24);
    return rows;
  }

  async function fetchWikiSummary(title) {
    const key = `wiki.${title}`;
    const cached = cacheGet(key);
    if (cached) return cached;
    const data = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const card = normalizeCard({
      id: `wiki-${title}`,
      source: "wikipedia",
      type: "encyclopedia",
      title: data.title || title,
      titleKo: data.title || title,
      summaryKo: data.extract || "",
      image: data.originalimage?.source || data.thumbnail?.source || "",
      thumbnail: data.thumbnail?.source || "",
      institution: "Wikipedia",
      rights: data.license?.type || "CC BY-SA",
      licenseUrl: data.license?.url || "https://creativecommons.org/licenses/by-sa/4.0/",
      sourceUrl: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      tags: ["gem", "learn"],
      attribution: `Source: Wikipedia — ${data.title}`,
      topic: "gems",
    });
    cacheSet(key, card, 48);
    return card;
  }

  async function fetchPageviews(article) {
    const key = `pv.${article}`;
    const cached = cacheGet(key);
    if (cached) return cached;
    const end = new Date();
    const start = new Date(Date.now() - 6 * 86400000);
    const fmt = (d) =>
      `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
    const data = await fetchJson(
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(
        article
      )}/daily/${fmt(start)}/${fmt(end)}`
    );
    const items = data.items || [];
    const total = items.reduce((s, x) => s + (x.views || 0), 0);
    const out = { article, total, days: items.length, source: "wikimedia_pageviews" };
    cacheSet(key, out, 12);
    return out;
  }

  async function fetchVideos() {
    const cached = cacheGet("youtube.curated");
    if (cached) return cached;
    const data = await fetchJson(`./hx-youtube-curated.json?v=${Date.now()}`);
    const rows = (data.videos || [])
      .filter((v) => !v.disabled && v.videoId)
      .map((v) =>
        normalizeCard({
          id: v.id,
          source: "youtube_embed",
          type: "video",
          title: v.title,
          titleKo: v.titleKo || v.title,
          summaryKo: `${v.channel} · 공식 embed`,
          thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
          videoId: v.videoId,
          creator: v.channel,
          institution: "YouTube",
          rights: "YouTube Embed Terms — no rehost",
          sourceUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
          tags: v.tags || [],
          attribution: `${v.channel} · YouTube`,
          topic: v.topic || "watch",
        })
      );
    cacheSet("youtube.curated", rows, 168);
    return rows;
  }

  async function jewelOfTheDay() {
    const stamp = todayStamp();
    const dayCached = cacheGet(`jod.${stamp}`);
    if (dayCached) return dayCached;
    let pool = [];
    try {
      const [met, cma, aic] = await Promise.all([
        fetchMetJewelry(8).catch(() => []),
        fetchCmaJewelry(8).catch(() => []),
        fetchAicJewelry(8).catch(() => []),
      ]);
      pool = [...met, ...cma, ...aic];
    } catch (_) {}
    if (!pool.length) {
      const last = cacheGet("jod.last");
      if (last) return { ...last, offline: true };
      return null;
    }
    const pick = pool[dayIndex(pool.length)];
    cacheSet(`jod.${stamp}`, pick, 36);
    cacheSet("jod.last", pick, 168);
    return pick;
  }

  async function gemstoneDaily() {
    const gem = GEMS[dayIndex(GEMS.length)];
    let wiki = null;
    try {
      wiki = await fetchWikiSummary(gem.wiki);
    } catch (_) {}
    return {
      gem,
      wiki,
      careUltrasonic: CARE_RULES.ultrasonic[gem.id],
      careSteam: CARE_RULES.steam[gem.id],
      careWater: CARE_RULES.water[gem.id],
    };
  }

  async function trendSignals() {
    const articles = ["Diamond", "Emerald", "Ruby", "Engagement_ring", "Pearl"];
    const rows = [];
    for (const a of articles) {
      try {
        rows.push(await fetchPageviews(a));
      } catch (_) {}
    }
    rows.sort((x, y) => y.total - x.total);
    return {
      label: "Wikipedia 관심도 (최근 약 7일 조회)",
      note: "단일 플랫폼 신호 · 전체 시장 점유율 아님",
      rows,
      source: "wikimedia_pageviews",
    };
  }

  async function buildGlobalFeed() {
    const backend = await viaBackend("/api/heritage/content/feed");
    if (backend && Array.isArray(backend.items)) {
      return { items: backend.items.map(normalizeCard), from: "backend", syncedAt: Date.now() };
    }

    const cached = cacheGet("feed.global");
    const parts = await Promise.allSettled([
      fetchMetJewelry(10),
      fetchCmaJewelry(10),
      fetchAicJewelry(8),
      fetchVideos(),
      gemstoneDaily().then(async (g) => {
        const wiki = g.wiki;
        return wiki
          ? [
              normalizeCard({
                ...wiki,
                id: `gemday-${g.gem.id}`,
                titleKo: `오늘의 젬 · ${g.gem.nameKo}`,
                summaryKo: `${g.gem.nameKo} · 경도 ${g.gem.hardness} · ${g.gem.care}`,
                topic: "gems",
                tags: ["gemstone-daily", ...(wiki.tags || [])],
              }),
            ]
          : [];
      }),
    ]);

    let items = [];
    parts.forEach((p) => {
      if (p.status === "fulfilled" && Array.isArray(p.value)) items = items.concat(p.value);
    });

    // interleave sources
    const bySource = {};
    items.forEach((it) => {
      bySource[it.source] = bySource[it.source] || [];
      bySource[it.source].push(it);
    });
    const mixed = [];
    const keys = Object.keys(bySource);
    let i = 0;
    while (mixed.length < items.length && i < 200) {
      keys.forEach((k) => {
        if (bySource[k].length) mixed.push(bySource[k].shift());
      });
      i += 1;
    }

    if (!mixed.length && cached) {
      return { items: cached.items || cached, from: "cache", syncedAt: cached.syncedAt || 0, offline: true };
    }

    const payload = { items: mixed, from: "live", syncedAt: Date.now() };
    cacheSet("feed.global", payload, 12);
    return payload;
  }

  function getFollowedTopics() {
    try {
      const list = JSON.parse(localStorage.getItem(FOLLOW_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function setFollowedTopics(list) {
    localStorage.setItem(FOLLOW_KEY, JSON.stringify((list || []).slice(0, 24)));
  }

  function toggleTopic(topic) {
    const list = getFollowedTopics();
    const i = list.indexOf(topic);
    if (i >= 0) list.splice(i, 1);
    else list.push(topic);
    setFollowedTopics(list);
    return list;
  }

  function filterByTopic(items, topic) {
    if (!topic || topic === "all") return items;
    const follows = getFollowedTopics();
    return items.filter((it) => {
      if (topic === "saved") return follows.includes(it.topic) || (it.tags || []).some((t) => follows.includes(t));
      return it.topic === topic || (it.tags || []).includes(topic);
    });
  }

  function quizBank() {
    return [
      {
        q: "모스 경도 척도에서 다이아몬드의 경도는?",
        opts: ["7", "8", "9", "10"],
        a: 3,
        explain: "다이아몬드는 모스 경도 10입니다.",
      },
      {
        q: "에메랄드에 초음파 세척은?",
        opts: ["항상 안전", "보통 비권장", "필수", "색이 좋아짐"],
        a: 1,
        explain: "내포·처리가 많아 초음파는 대체로 비권장입니다.",
      },
      {
        q: "진주 관리로 옳지 않은 것은?",
        opts: ["착용 후 천으로 닦기", "향수 뿌린 뒤 착용", "산·화학물질 피하기", "부드러운 보관"],
        a: 1,
        explain: "향수·화장품 후 착용은 표면을 상하게 할 수 있습니다.",
      },
      {
        q: "메트 뮤지엄 Open Access 이미지 사용의 핵심 조건은?",
        opts: ["유료 라이선스 필수", "isPublicDomain일 때 공개 이미지", "무조건 상업 금지", "워터마크 제거 가능"],
        a: 1,
        explain: "공개 도메인 작품의 이미지가 Open Access로 제공됩니다. 출처 표기를 권장합니다.",
      },
    ];
  }

  window.HxContent = {
    GEMS,
    CARE_RULES,
    loadRegistry,
    buildGlobalFeed,
    jewelOfTheDay,
    gemstoneDaily,
    fetchVideos,
    fetchMetJewelry,
    fetchCmaJewelry,
    fetchAicJewelry,
    fetchWikiSummary,
    trendSignals,
    getFollowedTopics,
    setFollowedTopics,
    toggleTopic,
    filterByTopic,
    quizBank,
    dayIndex,
    todayStamp,
    normalizeCard,
    cacheGet,
  };
})();
