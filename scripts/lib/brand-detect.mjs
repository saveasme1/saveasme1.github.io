export const DEFAULT_CATEGORIES = [
  "C",
  "B",
  "VCA",
  "BO",
  "CM",
  "C&H",
  "CL",
  "G",
  "H",
  "P",
  "F",
  "ETC",
];

/** Canonical portfolio codes → brand (must match brand-codes.json / server). */
export const BRAND_BY_CODE = {
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

export function extractPortfolioCode(title, category = "") {
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

export function resolveBrand(title, category = "") {
  const code = extractPortfolioCode(title, category);
  if (!code) return { code: "", en: "", ko: "" };
  const info = BRAND_BY_CODE[code] || {};
  return { code, en: info.en || "", ko: info.ko || "" };
}

const DETECT_RULES = [
  { re: /\bC\s*&\s*H\b|C&H|크롬하츠|Chrome\s*Hearts/i, cat: "C&H" },
  { re: /\bVCA\b|반클리프|Van\s*Cleef|알함브라/i, cat: "VCA" },
  { re: /\bBO\b|부쉐론|Boucheron/i, cat: "BO" },
  { re: /\bCM\b|쇼메|쇼매|Chaumet/i, cat: "CM" },
  { re: /\bCL\b|샤넬|Chanel/i, cat: "CL" },
  { re: /\bT\s*&\s*C(?:O)?\b|T&C|티파니|Tiffany/i, cat: "ETC" },
  { re: /\bL\b|루이비통|Louis\s*Vuitton|\bLV\b/i, cat: "ETC" },
  { re: /\bD\b|다미아니|Damiani/i, cat: "ETC" },
  { re: /\bC\b(?!\s*&\s*H)|까르띠에|Cartier/i, cat: "C" },
  { re: /\bB\b|불가리|Bulgari|BVLGARI/i, cat: "B" },
  { re: /\bG\b|구찌|Gucci/i, cat: "G" },
  { re: /\bH\b|에르메스|Hermes|Hermès/i, cat: "H" },
  { re: /\bP\b|프라다|Prada/i, cat: "P" },
  { re: /\bF\b|프레드|Fred\b/i, cat: "F" },
];

export function detectCategory(title, content) {
  const titleText = String(title || "");
  const bodyText = String(content || "");

  const code = extractPortfolioCode(titleText);
  if (code === "T&C" || code === "L" || code === "D") return "ETC";
  if (code && DEFAULT_CATEGORIES.includes(code)) return code;

  for (const rule of DETECT_RULES) {
    if (rule.re.test(titleText)) return rule.cat;
  }
  for (const rule of DETECT_RULES) {
    if (rule.re.test(bodyText)) return rule.cat;
  }
  return "ETC";
}
