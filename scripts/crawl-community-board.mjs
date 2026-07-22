/**
 * Imweb 실시간 출고/공지사항 목록·상세·이미지를 GitHub Pages 데이터로 이관합니다.
 * Usage: node scripts/crawl-community-board.mjs --board=shipping
 *        node scripts/crawl-community-board.mjs --board=notices
 */
import { access, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanHtmlText, downloadOptimizedJpeg, extractImwebDetail } from "./lib/imweb-portfolio.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const kind = process.argv.find((arg) => arg.startsWith("--board="))?.split("=")[1] || "";
const CONFIG = {
  shipping: { url: "https://hyunah681076451.imweb.me/26", label: "실시간 출고확인", maxPages: 30 },
  notices: { url: "https://hyunah681076451.imweb.me/49", label: "공지사항", maxPages: 10 },
}[kind];
if (!CONFIG) throw new Error("--board=shipping 또는 --board=notices를 지정하세요.");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36";
const uploadRoot = join(ROOT, kind, "uploads", "imported");

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}
function absoluteUrl(value) {
  return new URL(decodeEntities(value), CONFIG.url).toString();
}
async function fetchHtml(url) {
  const response = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}
function extractEntries(html) {
  const map = new Map();
  for (const match of String(html).matchAll(/href=["']([^"']*bmode=view[^"']*idx=(\d+)[^"']*)["']/gi)) {
    if (!map.has(match[2])) map.set(match[2], { externalId: match[2], sourceUrl: absoluteUrl(match[1]) });
  }
  return [...map.values()];
}
function meta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const a = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)`, "i");
  const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i");
  return decodeEntities((html.match(a) || html.match(b) || [])[1] || "");
}
function titleFrom(html, id) {
  const og = meta(html, "og:title").replace(/\s*(?::|[|｜-])\s*공방171.*$/i, "").trim();
  if (og) return og.slice(0, 160);
  const block = html.match(/class=["'][^"']*(?:board_txt_title|view_tit|board-title)[^"']*["'][^>]*>([\s\S]*?)<\//i);
  return (cleanHtmlText(block?.[1]) || `${CONFIG.label} ${id}`).slice(0, 160);
}
function dateFrom(html, id) {
  const candidates = [
    meta(html, "article:published_time"),
    meta(html, "og:updated_time"),
    (html.match(/(?:write_date|board_date|date_text)[^>]*>\s*([^<]{8,40})</i) || [])[1] || "",
  ];
  for (const value of candidates) {
    const date = new Date(String(value).trim());
    if (!Number.isNaN(date.getTime()) && date.getUTCFullYear() >= 2015) return date.toISOString();
  }
  // Stable fallback preserving newest-first external board order.
  return new Date(Date.UTC(2026, 0, 1) + Number(id)).toISOString();
}
async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}
async function collect() {
  const all = new Map();
  for (let page = 1; page <= CONFIG.maxPages; page += 1) {
    const url = page === 1 ? CONFIG.url : `${CONFIG.url}?page=${page}`;
    const entries = extractEntries(await fetchHtml(url));
    let added = 0;
    entries.forEach((entry) => {
      if (!all.has(entry.externalId)) added += 1;
      all.set(entry.externalId, entry);
    });
    console.log(`LIST ${page}: parsed=${entries.length} added=${added} total=${all.size}`);
    if (page > 1 && added === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  if (!all.size) throw new Error(`${CONFIG.label} 상세 링크를 찾지 못했습니다.`);
  return [...all.values()];
}
async function hydrate(entry) {
  const html = await fetchHtml(entry.sourceUrl);
  const detail = extractImwebDetail(html);
  const urls = [...new Set(detail.imageUrls)];
  if (!urls.length && detail.coverUrl) urls.push(detail.coverUrl);
  const paths = [];
  for (let index = 0; index < urls.length; index += 1) {
    const filename = `${String(index + 1).padStart(2, "0")}.jpg`;
    const output = join(uploadRoot, entry.externalId, filename);
    if (!(await exists(output))) {
      await downloadOptimizedJpeg(urls[index], output, { maxSide: 1800, quality: 84, userAgent: UA });
    }
    paths.push(`${kind}/uploads/imported/${entry.externalId}/${filename}`);
  }
  return {
    id: `imweb-${entry.externalId}`,
    title: titleFrom(html, entry.externalId),
    content: detail.content || meta(html, "description"),
    cover: paths[0] || "",
    image: paths[0] || "",
    images: paths.slice(1),
    publishedAt: dateFrom(html, entry.externalId),
    sourceUrl: entry.sourceUrl,
    sourceExternalId: entry.externalId,
    updatedAt: new Date().toISOString(),
  };
}

const entries = await collect();
const items = [];
let failures = 0;
for (let start = 0; start < entries.length; start += 4) {
  const batch = entries.slice(start, start + 4);
  const results = await Promise.allSettled(batch.map(hydrate));
  results.forEach((result, index) => {
    if (result.status === "fulfilled") items.push(result.value);
    else {
      failures += 1;
      console.warn(`FAIL ${batch[index].externalId}: ${result.reason.message}`);
    }
  });
  console.log(`DETAIL ${Math.min(start + 4, entries.length)}/${entries.length} ok=${items.length} fail=${failures}`);
}
items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
const manifest = { version: 1, source: CONFIG.url, publishedAt: new Date().toISOString(), items };
await writeFile(join(ROOT, `${kind}-data.json`), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(join(ROOT, `${kind}-draft.json`), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`DONE ${kind}: ${items.length} posts, ${items.reduce((sum, item) => sum + 1 + item.images.length, 0)} images, ${failures} failures`);
