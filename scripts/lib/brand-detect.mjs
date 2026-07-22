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

const DETECT_RULES = [
  { re: /\bC\s*&\s*H\b|C&H|씨앤에이치/i, cat: "C&H" },
  { re: /\bVCA\b|반클리프|Van\s*Cleef|알함브라/i, cat: "VCA" },
  { re: /\bBO\b|불가리|Bulgari|BVLGARI/i, cat: "BO" },
  { re: /\bCM\b|샤넬|Chanel/i, cat: "CM" },
  { re: /\bCL\b|셀린|Celine|CELINE/i, cat: "CL" },
  { re: /\bBV\b|보테가|Bottega/i, cat: "B" },
  { re: /\bT\s*&\s*CO\b|T&CO|티파니|Tiffany/i, cat: "ETC" },
  { re: /\bFR\b|프레드|Fred\b/i, cat: "F" },
  { re: /\bDC\b|디올|Dior/i, cat: "ETC" },
  { re: /\bCD\b/i, cat: "ETC" },
  { re: /\bVC\b(?!A)/i, cat: "VCA" },
  { re: /\bC\b(?!\s*&\s*H)|까르띠에|Cartier/i, cat: "C" },
  { re: /\bB\b|부쉐론|Boucheron/i, cat: "B" },
  { re: /\bG\b|구찌|Gucci/i, cat: "G" },
  { re: /\bH\b|에르메스|Hermes|Hermès/i, cat: "H" },
  { re: /\bP\b|피아제|Piaget/i, cat: "P" },
  { re: /\bF\b|프레드|Fred\b/i, cat: "F" },
];

export function detectCategory(title, content) {
  const titleText = String(title || "");
  const bodyText = String(content || "");

  const lead = titleText.trim().match(/^([A-Za-z0-9&]+)/);
  if (lead) {
    const token = lead[1].toUpperCase().replace(/\s+/g, "");
    const leadMap = {
      "C&H": "C&H",
      CH: "C&H",
      VCA: "VCA",
      VC: "VCA",
      BO: "BO",
      CM: "CM",
      CL: "CL",
      BV: "B",
      "T&CO": "ETC",
      TCO: "ETC",
      FR: "F",
      DC: "ETC",
      CD: "ETC",
      C: "C",
      B: "B",
      G: "G",
      H: "H",
      P: "P",
      F: "F",
      ETC: "ETC",
    };
    if (leadMap[token]) return leadMap[token];
  }

  for (const rule of DETECT_RULES) {
    if (rule.re.test(titleText)) return rule.cat;
  }
  for (const rule of DETECT_RULES) {
    if (rule.re.test(bodyText)) return rule.cat;
  }
  return "ETC";
}
