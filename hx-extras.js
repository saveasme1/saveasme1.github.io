(() => {
  "use strict";

  const CACHE_PREFIX = "hx.content.cache.";

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
        JSON.stringify({ exp: Date.now() + (ttlHours || 12) * 3600 * 1000, data, at: Date.now() })
      );
    } catch (_) {}
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  function norm(partial) {
    return window.HxContent?.normalizeCard
      ? window.HxContent.normalizeCard(partial)
      : partial;
  }

  /** Gold / Silver / Platinum board (KRW per troy oz → g / don helpers) */
  async function fetchMetalsBoard() {
    const cached = cacheGet("metals.board");
    if (cached) return cached;
    const [xau, xag, xpt] = await Promise.all([
      fetchJson("https://latest.currency-api.pages.dev/v1/currencies/xau.json"),
      fetchJson("https://latest.currency-api.pages.dev/v1/currencies/xag.json"),
      fetchJson("https://latest.currency-api.pages.dev/v1/currencies/xpt.json"),
    ]);
    const oz = 31.1035;
    const pack = (code, payload) => {
      const krwOz = Number(payload?.[code]?.krw) || 0;
      const perG = krwOz / oz;
      return {
        code: code.toUpperCase(),
        date: payload?.date || "",
        krwPerOz: krwOz,
        krwPerG: perG,
        krwPerDon: perG * 3.75,
      };
    };
    const board = {
      source: "currency-api.pages.dev",
      attribution: "Exchange rates via fawazahmed0/exchange-api mirror",
      disclaimer: "참고 시세 · 투자 조언 아님 · 스프레드/수수료 미포함",
      metals: [pack("xau", xau), pack("xag", xag), pack("xpt", xpt)],
      at: Date.now(),
    };
    cacheSet("metals.board", board, 6);
    try {
      localStorage.setItem(
        "hx.gold.last",
        JSON.stringify({
          don: board.metals[0].krwPerDon,
          perG: board.metals[0].krwPerG,
          at: Date.now(),
          source: "live",
        })
      );
    } catch (_) {}
    return board;
  }

  /** Met objects currently on view */
  async function fetchMetOnView(limit) {
    const cached = cacheGet("met.onview");
    if (cached) return cached;
    const search = await fetchJson(
      "https://collectionapi.metmuseum.org/public/collection/v1/search?q=jewelry&hasImages=true&isOnView=true"
    );
    const ids = (search.objectIDs || []).slice(0, 30);
    const out = [];
    for (const id of ids) {
      if (out.length >= (limit || 8)) break;
      try {
        const obj = await fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
        if (!obj?.isPublicDomain || !obj.primaryImageSmall) continue;
        out.push(
          norm({
            id: `met-onview-${obj.objectID}`,
            source: "met",
            type: "museum_object",
            title: obj.title,
            titleKo: obj.title,
            summaryKo: `Currently on view · ${[obj.GalleryNumber && `Gallery ${obj.GalleryNumber}`, obj.culture, obj.objectDate]
              .filter(Boolean)
              .join(" · ")}`,
            image: obj.primaryImage || obj.primaryImageSmall,
            thumbnail: obj.primaryImageSmall,
            creator: obj.artistDisplayName || "",
            institution: "The Metropolitan Museum of Art",
            objectDate: obj.objectDate || "",
            rights: "Public Domain (Met Open Access)",
            sourceUrl: obj.objectURL,
            tags: ["on-view", "museum"],
            attribution: `The Met — ${obj.title}`,
            topic: "history",
          })
        );
      } catch (_) {}
    }
    cacheSet("met.onview", out, 24);
    return out;
  }

  const ERAS = [
    { id: "ancient", label: "Ancient", ko: "고대", begin: -3000, end: 500, q: "jewelry" },
    { id: "medieval", label: "Medieval", ko: "중세", begin: 500, end: 1400, q: "jewelry" },
    { id: "renaissance", label: "Renaissance", ko: "르네상스", begin: 1400, end: 1600, q: "jewelry" },
    { id: "georgian", label: "Georgian", ko: "조지안", begin: 1714, end: 1837, q: "jewelry" },
    { id: "victorian", label: "Victorian", ko: "빅토리안", begin: 1837, end: 1901, q: "jewelry" },
    { id: "artnouveau", label: "Art Nouveau", ko: "아르누보", begin: 1890, end: 1910, q: "jewelry" },
    { id: "artdeco", label: "Art Deco", ko: "아르데코", begin: 1919, end: 1939, q: "jewelry" },
    { id: "contemporary", label: "Contemporary", ko: "현대", begin: 1960, end: 2025, q: "jewelry" },
  ];

  async function fetchEraSamples(eraId, limit) {
    const era = ERAS.find((e) => e.id === eraId) || ERAS[4];
    const key = `era.${era.id}`;
    const cached = cacheGet(key);
    if (cached) return { era, items: cached };
    const search = await fetchJson(
      `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(
        era.q
      )}&hasImages=true&dateBegin=${era.begin}&dateEnd=${era.end}`
    );
    const ids = (search.objectIDs || []).slice(0, 24);
    const items = [];
    for (const id of ids) {
      if (items.length >= (limit || 6)) break;
      try {
        const obj = await fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
        if (!obj?.isPublicDomain || !obj.primaryImageSmall) continue;
        items.push(
          norm({
            id: `met-era-${era.id}-${obj.objectID}`,
            source: "met",
            type: "museum_object",
            title: obj.title,
            titleKo: obj.title,
            summaryKo: `${era.ko} · ${obj.objectDate || ""} · ${obj.medium || ""}`,
            image: obj.primaryImage || obj.primaryImageSmall,
            thumbnail: obj.primaryImageSmall,
            creator: obj.artistDisplayName || "",
            institution: "The Met",
            objectDate: obj.objectDate || "",
            rights: "Public Domain",
            sourceUrl: obj.objectURL,
            tags: ["timeline", era.id],
            attribution: `The Met — ${obj.title}`,
            topic: "history",
          })
        );
      } catch (_) {}
    }
    cacheSet(key, items, 48);
    return { era, items };
  }

  async function fetchCommonsJewellery(limit) {
    const cached = cacheGet("commons.jewellery");
    if (cached) return cached;
    const cat = await fetchJson(
      "https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:Jewellery_in_the_Metropolitan_Museum_of_Art&cmtype=file&cmlimit=20&format=json&origin=*"
    );
    const titles = (cat.query?.categorymembers || []).map((x) => x.title).slice(0, limit || 10);
    if (!titles.length) return [];
    const info = await fetchJson(
      "https://commons.wikimedia.org/w/api.php?action=query&titles=" +
        encodeURIComponent(titles.join("|")) +
        "&prop=imageinfo&iiprop=url|extmetadata|extmetadata&iiurlwidth=640&format=json&origin=*"
    );
    const rows = Object.values(info.query?.pages || {})
      .map((p) => {
        const ii = p.imageinfo?.[0];
        if (!ii?.url && !ii?.thumburl) return null;
        const artist = ii.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, "") || "Unknown";
        const license = ii.extmetadata?.LicenseShortName?.value || "Commons";
        return norm({
          id: `commons-${p.pageid}`,
          source: "wikipedia",
          type: "commons_image",
          title: (p.title || "").replace(/^File:/, ""),
          titleKo: (p.title || "").replace(/^File:/, ""),
          summaryKo: `Wikimedia Commons · ${license}`,
          image: ii.url,
          thumbnail: ii.thumburl || ii.url,
          creator: artist,
          institution: "Wikimedia Commons",
          rights: license,
          licenseUrl: ii.extmetadata?.LicenseUrl?.value || "https://commons.wikimedia.org/",
          sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
          tags: ["commons", "museum"],
          attribution: `${artist} / ${license} via Wikimedia Commons`,
          topic: "history",
        });
      })
      .filter(Boolean);
    cacheSet("commons.jewellery", rows, 48);
    return rows;
  }

  async function fetchOnThisDayJewelry() {
    const cached = cacheGet("otd.jewelry");
    if (cached) return cached;
    const d = new Date();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const data = await fetchJson(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${m}/${day}`);
    const pool = []
      .concat(data.selected || [], data.events || [], data.births || [], data.deaths || [])
      .filter(Boolean);
    const re = /jewel|gem|diamond|pearl|goldsmith|necklace|ring|crown|tiara|brooch|museum|faberg|tiffany|cartier/i;
    const hits = pool
      .filter((e) => re.test(e.text || "") || re.test(e.pages?.[0]?.titles?.normalized || ""))
      .slice(0, 8)
      .map((e, i) =>
        norm({
          id: `otd-${m}-${day}-${i}`,
          source: "wikipedia",
          type: "onthisday",
          title: e.text?.slice(0, 120) || "On this day",
          titleKo: e.text?.slice(0, 120) || "",
          summaryKo: `On this day · ${e.year || ""} · Wikipedia`,
          thumbnail: e.pages?.[0]?.thumbnail?.source || "",
          image: e.pages?.[0]?.originalimage?.source || e.pages?.[0]?.thumbnail?.source || "",
          institution: "Wikipedia On This Day",
          objectDate: String(e.year || ""),
          rights: "CC BY-SA",
          sourceUrl: e.pages?.[0]?.content_urls?.desktop?.page || "https://en.wikipedia.org/wiki/Special:OnThisDay",
          tags: ["onthisday"],
          attribution: "Wikipedia · On this day",
          topic: "learn",
        })
      );
    const out = hits.length
      ? hits
      : [
          norm({
            id: `otd-fallback-${m}-${day}`,
            source: "wikipedia",
            type: "onthisday",
            title: `On this day · ${m}/${day}`,
            titleKo: `역사 속 오늘 · ${m}월 ${day}일`,
            summaryKo: "주얼리 키워드 매칭 이벤트가 없어 일반 On This Day로 연결합니다.",
            institution: "Wikipedia",
            rights: "CC BY-SA",
            sourceUrl: `https://en.wikipedia.org/wiki/Wikipedia:Selected_anniversaries/${m}_${day}`,
            attribution: "Wikipedia",
            topic: "learn",
          }),
        ];
    cacheSet("otd.jewelry", out, 24);
    return out;
  }

  async function fetchMotifCards() {
    const motifs = [
      { id: "serpent", wiki: "Serpent_(symbolism)", ko: "뱀 모티프" },
      { id: "scarab", wiki: "Scarab_(artifact)", ko: "스카라베" },
      { id: "cameo", wiki: "Cameo_(carving)", ko: "카메오" },
      { id: "enamel", wiki: "Enamel_(glass_art)", ko: "에나멜" },
      { id: "filigree", wiki: "Filigree", ko: "필리그리" },
    ];
    const out = [];
    for (const m of motifs) {
      try {
        const card = await window.HxContent.fetchWikiSummary(m.wiki);
        out.push(
          norm({
            ...card,
            id: `motif-${m.id}`,
            titleKo: m.ko,
            summaryKo: card.summaryKo?.slice(0, 160) || "",
            topic: "learn",
            tags: ["motif", m.id],
          })
        );
      } catch (_) {}
    }
    return out;
  }

  const HALLMARKS = [
    { code: "750", mean: "18K 금 (75% Au)", region: "국제/유럽 공통" },
    { code: "585", mean: "14K 금 (58.5% Au)", region: "국제/유럽 공통" },
    { code: "375", mean: "9K 금 (37.5% Au)", region: "영국 등" },
    { code: "925", mean: "스털링 실버", region: "국제" },
    { code: "950", mean: "플래티넘 950", region: "국제" },
    { code: "PT950", mean: "플래티넘 950 표기", region: "일본/아시아 표기 예" },
    { code: "K18", mean: "18K 금", region: "한국/일본 관용" },
    { code: "K14", mean: "14K 금", region: "한국/일본 관용" },
    { code: "WG", mean: "화이트골드", region: "관용 약어" },
    { code: "PG", mean: "핑크/로즈골드", region: "관용 약어" },
  ];

  function decodeHallmark(input) {
    const q = String(input || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!q) return [];
    return HALLMARKS.filter((h) => q.includes(h.code) || h.code.includes(q));
  }

  window.HxExtras = {
    ERAS,
    HALLMARKS,
    fetchMetalsBoard,
    fetchMetOnView,
    fetchEraSamples,
    fetchCommonsJewellery,
    fetchOnThisDayJewelry,
    fetchMotifCards,
    decodeHallmark,
  };
})();
