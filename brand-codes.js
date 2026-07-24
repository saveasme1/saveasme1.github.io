/**
 * Portfolio brand codes (C=Cartier …). Keep in sync with brand-codes.json / server.
 */
(function () {
  const BRAND_BY_CODE = {
    C: { en: "Cartier", ko: "까르띠에" },
    B: { en: "Bulgari", ko: "불가리" },
    VCA: { en: "Van Cleef & Arpels", ko: "반클리프" },
    BO: { en: "Boucheron", ko: "부쉐론" },
    CM: { en: "Chaumet", ko: "쇼메" },
    "C&H": { en: "Chrome Hearts", ko: "크롬하츠" },
    CL: { en: "Chanel", ko: "샤넬" },
    G: { en: "Gucci", ko: "구찌" },
    H: { en: "Hermes", ko: "에르메스" },
    P: { en: "Prada", ko: "프라다" },
    F: { en: "Fred", ko: "프레드" },
    "T&C": { en: "Tiffany & Co", ko: "티파니" },
    L: { en: "Louis Vuitton", ko: "루이비통" },
    D: { en: "Damiani", ko: "다미아니" },
  };
  const CODE_ALIASES = {
    CH: "C&H",
    CANDH: "C&H",
    "T&CO": "T&C",
    TCO: "T&C",
    TC: "T&C",
    BV: "B",
  };

  function normalizeCode(raw) {
    if (!raw) return "";
    let token = String(raw).trim().toUpperCase().replace(/\s+/g, "").replace(/＆/g, "&");
    if (CODE_ALIASES[token]) token = CODE_ALIASES[token];
    return BRAND_BY_CODE[token] ? token : "";
  }

  function extractPortfolioCode(title, category) {
    const fromCat = normalizeCode(category);
    const text = String(title || "").trim();
    if (!text) return fromCat;
    const codes = Object.keys(BRAND_BY_CODE).sort((a, b) => b.length - a.length);
    const upper = text.toUpperCase().replace(/＆/g, "&");
    for (const code of codes) {
      for (const variant of [code, code.replace("&", " & ")]) {
        const vu = variant.toUpperCase();
        if (!upper.startsWith(vu)) continue;
        const rest = text.slice(variant.length);
        if (!rest || /^[\s\-_·./]/.test(rest)) return code;
      }
    }
    const lead = text.match(/^([A-Za-z0-9&]+)/);
    if (lead) {
      const hit = normalizeCode(lead[1]);
      if (hit) return hit;
    }
    return fromCat;
  }

  function resolveBrand(title, category) {
    const code = extractPortfolioCode(title, category);
    const info = BRAND_BY_CODE[code] || {};
    return { code: code || "", en: info.en || "", ko: info.ko || "" };
  }

  window.HeritageBrandCodes = {
    BRAND_BY_CODE,
    extractPortfolioCode,
    resolveBrand,
    normalizeCode,
  };
})();
