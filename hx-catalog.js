(() => {
  "use strict";

  const TYPE_RULES = [
    { type: "ring", re: /반지|링\b|ring/i },
    { type: "bracelet", re: /팔찌|브레이슬릿|bracelet/i },
    { type: "necklace", re: /목걸|네클리스|펜던|necklace|pendant/i },
    { type: "earring", re: /귀걸|이어링|earring/i },
  ];

  const METAL_RULES = [
    { metal: "rose", re: /로즈\s*골드|rose\s*gold|핑크\s*골드/i },
    { metal: "white", re: /화이트\s*골드|white\s*gold|WG/i },
    { metal: "yellow", re: /옐로우\s*골드|yellow\s*gold|YG|황금/i },
  ];

  const MOOD_RULES = [
    { mood: "minimal", re: /미니멀|심플|슬림|thin|minimal/i },
    { mood: "classic", re: /클래식|러브|저스트|알함브라|classic|love|juste/i },
    { mood: "vintage", re: /빈티지|앤틱|vintage|antique/i },
    { mood: "bold", re: /볼드|시그니처|와이드|bold|chunky/i },
    { mood: "romantic", re: /하트|플라워|로즈|heart|flower|amour|다무르/i },
    { mood: "geometric", re: /지오메|헥사|스퀘어|geometric|clous|네일/i },
  ];

  let cache = null;
  let brandMap = null;

  function assetUrl(value) {
    const path = String(value || "").trim();
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    try {
      return new URL(path.replace(/^\/+/, ""), location.origin + "/").href;
    } catch (_) {
      return `/${path.replace(/^\/+/, "")}`;
    }
  }

  async function loadBrands() {
    if (brandMap) return brandMap;
    try {
      const res = await fetch(`./brand-codes.json?v=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      brandMap = data.codes || {};
    } catch (_) {
      brandMap = {};
    }
    return brandMap;
  }

  function inferType(text) {
    for (const rule of TYPE_RULES) {
      if (rule.re.test(text)) return rule.type;
    }
    return "other";
  }

  function inferMetals(text) {
    const found = [];
    METAL_RULES.forEach((rule) => {
      if (rule.re.test(text)) found.push(rule.metal);
    });
    return found.length ? found : ["yellow"];
  }

  function inferMoods(text) {
    const found = [];
    MOOD_RULES.forEach((rule) => {
      if (rule.re.test(text)) found.push(rule.mood);
    });
    return found.length ? found : ["classic"];
  }

  function inferPurity(text) {
    if (/18\s*k/i.test(text)) return "18K";
    if (/14\s*k/i.test(text)) return "14K";
    if (/22\s*k/i.test(text)) return "22K";
    if (/24\s*k|순금/i.test(text)) return "24K";
    return "";
  }

  function enrich(item, brands) {
    const title = String(item.title || "");
    const content = String(item.content || "");
    const blob = `${title}\n${content}`;
    const cat = String(item.category || "");
    const brand = brands[cat] || null;
    return {
      ...item,
      cover: item.cover || item.image || "",
      coverUrl: assetUrl(item.cover || item.image),
      type: inferType(blob),
      metals: inferMetals(blob),
      moods: inferMoods(blob),
      purity: inferPurity(blob),
      brandCode: cat,
      brandEn: brand?.en || cat || "HERITAGE",
      brandKo: brand?.ko || "",
      displayTitle: title.replace(/^[A-Z&]+\s+/, "").trim() || title,
    };
  }

  async function loadCatalog(force) {
    if (cache && !force) return cache;
    await loadBrands();
    const res = await fetch(`./portfolio-data.json?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("catalog");
    const data = await res.json();
    const items = (data.items || []).map((item) => enrich(item, brandMap));
    cache = {
      version: data.version,
      categories: data.categories || [],
      items,
      byId: Object.fromEntries(items.map((x) => [String(x.id), x])),
      updatedAt: data.updatedAt || "",
    };
    return cache;
  }

  function scoreItem(item, prefs, ctx) {
    if (!item) return 0;
    let score = 1;
    const p = prefs || {};
    if (p.types?.length && p.types.includes(item.type)) score += 4;
    if (p.metals?.length && item.metals.some((m) => p.metals.includes(m))) score += 3;
    if (p.moods?.length && item.moods.some((m) => p.moods.includes(m))) score += 3;
    if (p.brands?.length && p.brands.includes(item.brandCode)) score += 5;
    if (p.occasions?.includes("daily") && item.moods.includes("minimal")) score += 1;
    if (p.occasions?.includes("wedding") && /러브|웨딩|다이아|알함브라/i.test(item.title)) score += 2;

    const stats = ctx?.stats || {};
    const views = Number(stats.views?.[item.id]) || 0;
    const saves = Number(stats.saves?.[item.id]) || 0;
    score += Math.min(3, views * 0.4) + Math.min(4, saves);

    if (ctx?.recentIds?.has(String(item.id))) score += 1.5;
    if (ctx?.wishIds?.has(String(item.id))) score += 2;
    return score;
  }

  function forYou(catalog, limit) {
    const prefs = window.HxStore?.getPrefs?.() || null;
    const stats = window.HxStore?.getStats?.() || {};
    const recentIds = new Set((window.HxStore?.loadRecent?.() || []).map((x) => String(x.id)));
    const wishIds = new Set(window.HxStore?.loadWish?.() || []);
    const ctx = { stats, recentIds, wishIds };
    const ranked = catalog.items
      .map((item) => ({ item, score: scoreItem(item, prefs, ctx) }))
      .sort((a, b) => b.score - a.score || String(b.item.id).localeCompare(String(a.item.id)));
    return ranked.slice(0, limit || 16).map((x) => x.item);
  }

  function filterBy(catalog, pred) {
    return catalog.items.filter(pred);
  }

  function editorialEdits(catalog) {
    const picks = (pred, n) => filterBy(catalog, pred).slice(0, n || 12);
    return [
      {
        id: "quiet-luxury",
        title: "Quiet Luxury",
        sub: "절제된 실루엣 · 데일리 골드",
        items: picks((x) => x.moods.includes("minimal") || x.moods.includes("classic"), 12),
      },
      {
        id: "daily-gold",
        title: "Daily Gold",
        sub: "매일 착용하기 좋은 골드 피스",
        items: picks((x) => x.metals.includes("yellow") && (x.type === "ring" || x.type === "bracelet"), 12),
      },
      {
        id: "rose-edit",
        title: "Rose Gold Edit",
        sub: "로즈 골드 톤 셀렉션",
        items: picks((x) => x.metals.includes("rose"), 12),
      },
      {
        id: "office",
        title: "Office Jewelry",
        sub: "단정한 라인 · 미팅에도 어울리게",
        items: picks((x) => x.moods.includes("minimal") || x.moods.includes("geometric"), 12),
      },
      {
        id: "romantic",
        title: "Romantic Motifs",
        sub: "하트 · 플라워 · 감성 모티프",
        items: picks((x) => x.moods.includes("romantic"), 12),
      },
      {
        id: "wedding-guest",
        title: "Wedding Guest",
        sub: "하객룩을 완성하는 포인트 주얼리",
        items: picks((x) => x.type === "earring" || x.type === "necklace" || /알함브라|플라워|하트/i.test(x.title), 12),
      },
      {
        id: "cartier-archive",
        title: "Cartier Archive",
        sub: "C 코드 아카이브 하이라이트",
        items: picks((x) => x.brandCode === "C", 12),
      },
      {
        id: "vca-archive",
        title: "VCA Archive",
        sub: "반클리프 모티프 셀렉션",
        items: picks((x) => x.brandCode === "VCA", 12),
      },
    ].filter((edit) => edit.items.length >= 3);
  }

  function localTrending(catalog, limit) {
    const stats = window.HxStore?.getStats?.() || { views: {}, saves: {} };
    const scored = catalog.items.map((item) => {
      const id = String(item.id);
      const v = Number(stats.views?.[id]) || 0;
      const s = Number(stats.saves?.[id]) || 0;
      return { item, score: v * 1 + s * 3 };
    });
    scored.sort((a, b) => b.score - a.score);
    const hasSignal = scored.some((x) => x.score > 0);
    if (!hasSignal) {
      return {
        label: "아카이브 하이라이트",
        note: "이 기기 이용 기록이 쌓이면 개인 순위로 바뀝니다",
        items: catalog.items.slice(0, limit || 8),
        demo: true,
      };
    }
    return {
      label: "이 기기에서 주목한 작품",
      note: "조회·저장 기록 기준 · 전체 고객 통계 아님",
      items: scored.filter((x) => x.score > 0).slice(0, limit || 8).map((x) => x.item),
      demo: false,
    };
  }

  function similarTo(catalog, item, limit) {
    if (!item) return [];
    return catalog.items
      .filter((x) => String(x.id) !== String(item.id))
      .map((x) => {
        let s = 0;
        if (x.brandCode === item.brandCode) s += 4;
        if (x.type === item.type) s += 3;
        if (x.metals.some((m) => item.metals.includes(m))) s += 2;
        if (x.moods.some((m) => item.moods.includes(m))) s += 2;
        return { x, s };
      })
      .sort((a, b) => b.s - a.s)
      .slice(0, limit || 10)
      .map((r) => r.x);
  }

  function giftMatch(catalog, answers) {
    const a = answers || {};
    return catalog.items
      .map((item) => {
        let s = 0;
        if (a.type && a.type !== "any" && item.type === a.type) s += 4;
        if (a.metal && a.metal !== "any" && item.metals.includes(a.metal)) s += 3;
        if (a.mood && item.moods.includes(a.mood)) s += 3;
        if (a.occasion === "wedding" && /러브|하트|다이아|알함브라/i.test(item.title + item.content)) s += 2;
        if (a.occasion === "daily" && item.moods.includes("minimal")) s += 2;
        if (a.brand && a.brand !== "any" && item.brandCode === a.brand) s += 5;
        return { item, s };
      })
      .sort((a, b) => b.s - a.s)
      .slice(0, 16)
      .map((x) => x.item);
  }

  function completeTheLook(catalog, item) {
    if (!item) return [];
    const want =
      item.type === "necklace"
        ? "earring"
        : item.type === "earring"
          ? "necklace"
          : item.type === "ring"
            ? "bracelet"
            : "ring";
    return catalog.items
      .filter((x) => x.type === want && x.brandCode === item.brandCode)
      .filter((x) => x.metals.some((m) => item.metals.includes(m)))
      .slice(0, 8);
  }

  function dailyPick(catalog) {
    const seed = window.HxStore?.getDailySeed?.() || { n: 1 };
    const idx = (Number(seed.n) || 1) % Math.max(1, catalog.items.length);
    return catalog.items[idx];
  }

  window.HxCatalog = {
    assetUrl,
    loadCatalog,
    enrich,
    forYou,
    editorialEdits,
    localTrending,
    similarTo,
    giftMatch,
    completeTheLook,
    dailyPick,
    scoreItem,
  };
})();
