#!/usr/bin/env node
/**
 * Daily wear feed:
 *  1) Re-verify allowlist (alive) → hx-wear-daily.json  (ONLY these go live)
 *  2) Strict discovery → hx-wear-candidates.json (review queue, NOT live)
 *
 * node scripts/build-wear-daily.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const REJECT_RE =
  /\b(tribal|ethnic|indigenous|folk|maasai|masai|beadwork|beaded|turquoise|handmade|boho|bohemian|primitive|macrame|friendship|toy|doll|bokeh|building|storefront|christmas|xmas|aquarium|nail\b|clou\b|lamp|cats?|scarab|watch\b|clock\b|vase|window|tiffany[- ]style|louis comfort|serpenti seduttori)\b/i;

const NSFW_RE = /\b(nude|naked|lingerie|porn|xxx|erotic|sexy|bikini|nsfw|fetish)\b/i;

const DISCOVER_QUERIES = [
  { brandEn: "Cartier", type: "bracelet", hints: ["love", "bracelet"], q: "Cartier Love bracelet" },
  { brandEn: "Cartier", type: "ring", hints: ["love", "ring"], q: "Cartier Love ring" },
  { brandEn: "Cartier", type: "bracelet", hints: ["juste", "clou"], q: "Cartier Juste un Clou" },
  { brandEn: "Chanel", type: "ring", hints: ["coco", "crush"], q: "Chanel Coco Crush ring" },
  { brandEn: "Tiffany & Co", type: "necklace", hints: ["knot"], q: "Tiffany Knot necklace" },
  { brandEn: "Van Cleef & Arpels", type: "necklace", hints: ["alhambra"], q: "Van Cleef Alhambra necklace" },
  { brandEn: "Bulgari", type: "bracelet", hints: ["serpenti", "bracelet"], q: "Bulgari Serpenti bracelet jewelry" },
  { brandEn: "Hermes", type: "bracelet", hints: ["clic"], q: "Hermes Clic H bracelet" },
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function writeJson(rel, data) {
  fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "HeritageWearDaily/1.1 (https://hand-made.kr; daily-verify; contact via site)",
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function urlAlive(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "HeritageWearDaily/1.1 (https://hand-made.kr; image-check)",
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function blobOf(row) {
  const tags = Array.isArray(row.tags)
    ? row.tags.map((t) => (typeof t === "string" ? t : t?.name || "")).join(" ")
    : "";
  return `${row.title || ""} ${row.creator || ""} ${tags}`.toLowerCase();
}

function brandInTitle(title, brandEn) {
  const t = String(title || "").toLowerCase();
  const b = brandEn.toLowerCase();
  if (b.includes("tiffany")) return /\btiffany\b/.test(t) && !/tiffany[- ]style|lamp/.test(t);
  if (b.includes("van cleef")) return /van\s*cleef|vancleef|alhambra/.test(t);
  if (b.includes("hermes")) return /hermes|hermès/.test(t);
  if (b.includes("bulgari")) return /bulgari|bvlgari/.test(t);
  return t.includes(b.split(/\s+/)[0]);
}

function candidateGate(row, spec) {
  const blob = blobOf(row);
  const title = String(row.title || "");
  if (NSFW_RE.test(blob) || REJECT_RE.test(blob)) return null;
  if (!brandInTitle(title, spec.brandEn)) return null;
  if (!spec.hints.some((h) => blob.includes(h.toLowerCase()))) return null;
  // reject watches when looking for jewelry types
  if (/\bwatch\b|wristwatch|horloge/i.test(blob) && spec.type !== "other") return null;
  return {
    id: `cand-${row.id}`,
    brandEn: spec.brandEn,
    type: spec.type,
    productHints: spec.hints,
    title,
    image: row.url || row.thumbnail,
    permalink: row.foreign_landing_url || row.detail_url,
    source: row.source || "openverse",
    license: row.license || "",
    indexedOn: row.indexed_on || "",
    status: "needs_review",
    note: "자동 후보 · 허용목록 승격 전까지 앱에 미송출",
  };
}

function normalizeLive(entry) {
  return {
    id: entry.id,
    brandEn: entry.brandEn,
    type: entry.type,
    productHints: entry.productHints || [],
    title: entry.title,
    image: entry.image,
    permalink: entry.permalink,
    source: entry.source,
    license: entry.license || "",
    indexedOn: entry.indexedOn || "",
    confidence: "high",
    reasons: entry.reasons || [],
    verifiedBy: "allowlist",
  };
}

async function main() {
  const allow = readJson("hx-wear-allowlist.json");
  const live = [];
  const dead = [];

  for (const entry of allow.entries || []) {
    const ok = await urlAlive(entry.image);
    if (!ok) {
      dead.push(entry.id);
      continue;
    }
    live.push(normalizeLive(entry));
  }

  const candidates = [];
  for (const spec of DISCOVER_QUERIES) {
    try {
      const url =
        "https://api.openverse.org/v1/images/?" +
        new URLSearchParams({
          q: spec.q,
          page_size: "10",
          mature: "false",
          source: "flickr,wikimedia,rawpixel",
        }).toString();
      const data = await fetchJson(url);
      for (const row of data.results || []) {
        const cand = candidateGate(row, spec);
        if (!cand) continue;
        if (live.some((l) => l.permalink === cand.permalink)) continue;
        if (candidates.some((c) => c.permalink === cand.permalink)) continue;
        const ok = await urlAlive(cand.image);
        if (!ok) continue;
        candidates.push(cand);
      }
    } catch (_) {}
  }

  const day = new Date().toISOString().slice(0, 10);
  const daily = {
    version: 3,
    day,
    builtAt: new Date().toISOString(),
    policy: allow.policy,
    note: "앱은 이 파일의 items 만 표시합니다. candidates 는 미송출.",
    stats: { live: live.length, deadAllowlist: dead.length, candidates: candidates.length },
    items: live,
  };

  writeJson("hx-wear-daily.json", daily);
  writeJson("hx-wear-candidates.json", {
    version: 1,
    day,
    builtAt: daily.builtAt,
    note: "검토 후 hx-wear-allowlist.json 에 승격하세요. 앱 미송출.",
    items: candidates,
  });

  console.log(`daily live=${live.length} dead=${dead.length} candidates=${candidates.length}`);
  live.forEach((i) => console.log(" LIVE", i.brandEn, "|", i.title));
  candidates.slice(0, 8).forEach((c) => console.log(" CAND", c.brandEn, "|", c.title.slice(0, 50)));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
