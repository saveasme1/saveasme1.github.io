/**
 * Imweb 리얼후기 목록/상세/이미지를 모두 이관하고 MakerBridge MySQL에 upsert합니다.
 * 실행 전 MakerBridge에서 `npm run migrate`를 먼저 실행하세요.
 */
import { access, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { cleanHtmlText, downloadOptimizedJpeg, extractImwebDetail } from "./lib/imweb-portfolio.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOARD = "https://hyunah681076451.imweb.me/47";
const MAX_PAGES = Number(process.env.REVIEW_CRAWL_MAX_PAGES || 12);
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36";
const cliRoot = process.argv.find((value) => value.startsWith("--makerbridge-root="))?.split("=").slice(1).join("=");
const MAKERBRIDGE_ROOT = resolve(
  cliRoot || process.env.MAKERBRIDGE_ROOT || "F:/#1_zeron_web_develop/makerbridge"
);
const UPLOAD_ROOT = join(MAKERBRIDGE_ROOT, "public", "uploads", "reviews", "imported");
const NO_SEED = process.argv.includes("--no-seed");

dotenv.config({ path: join(MAKERBRIDGE_ROOT, ".env") });

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
  return new URL(decodeEntities(value), BOARD).toString();
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

function extractListEntries(html) {
  const entries = [];
  const seen = new Set();
  for (const match of String(html).matchAll(/href=["']([^"']*bmode=view[^"']*idx=(\d+)[^"']*)["']/gi)) {
    const externalId = match[2];
    if (seen.has(externalId)) continue;
    seen.add(externalId);
    entries.push({ externalId, sourceUrl: absoluteUrl(match[1]) });
  }
  return entries;
}

function extractMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const first = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)`, "i");
  const second = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i");
  return decodeEntities((html.match(first) || html.match(second) || [])[1] || "");
}

function detailTitle(html, externalId) {
  const ogTitle = extractMeta(html, "og:title")
    .replace(/\s*(?::|[|｜-])\s*공방171.*$/i, "")
    .trim();
  if (ogTitle) return ogTitle.slice(0, 160);
  const titleBlock = html.match(/class=["'][^"']*(?:board_txt_title|view_tit|board-title)[^"']*["'][^>]*>([\s\S]*?)<\//i);
  return (cleanHtmlText(titleBlock?.[1]) || `리얼후기 ${externalId}`).slice(0, 160);
}

function publishedAt(html) {
  const candidates = [
    extractMeta(html, "article:published_time"),
    extractMeta(html, "og:updated_time"),
    (html.match(/(?:write_date|board_date|date_text)[^>]*>\s*([^<]{8,40})</i) || [])[1] || "",
  ];
  for (const value of candidates) {
    const parsed = new Date(String(value).trim());
    // Imweb often emits epoch placeholders for older posts; treat those as missing.
    if (!Number.isNaN(parsed.getTime()) && parsed.getUTCFullYear() >= 2015) return parsed;
  }
  return null;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function collectEntries() {
  const all = new Map();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = page === 1 ? BOARD : `${BOARD}?page=${page}`;
    console.log(`LIST ${page}: ${url}`);
    const entries = extractListEntries(await fetchHtml(url));
    let added = 0;
    for (const entry of entries) {
      if (!all.has(entry.externalId)) added += 1;
      all.set(entry.externalId, entry);
    }
    console.log(`  parsed=${entries.length} added=${added} total=${all.size}`);
    if (page > 1 && added === 0) break;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  if (!all.size) throw new Error("No review detail links found");
  return [...all.values()];
}

async function hydrate(entry) {
  const html = await fetchHtml(entry.sourceUrl);
  const detail = extractImwebDetail(html);
  const imageUrls = [...new Set(detail.imageUrls)];
  const images = [];
  for (let index = 0; index < imageUrls.length; index += 1) {
    const filename = `${String(index + 1).padStart(2, "0")}.jpg`;
    const outputPath = join(UPLOAD_ROOT, entry.externalId, filename);
    let metadata = { width: null, height: null, bytes: null };
    if (!(await exists(outputPath))) {
      metadata = await downloadOptimizedJpeg(imageUrls[index], outputPath, {
        maxSide: 2400,
        quality: 86,
        userAgent: UA,
      });
    }
    images.push({
      path: `/uploads/reviews/imported/${entry.externalId}/${filename}`,
      ...metadata,
    });
  }
  return {
    ...entry,
    title: detailTitle(html, entry.externalId),
    body: detail.content || extractMeta(html, "description"),
    publishedAt: publishedAt(html),
    images,
  };
}

async function seed(reviews) {
  if (NO_SEED) return;
  const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing MakerBridge DB settings: ${missing.join(", ")}`);
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    charset: "utf8mb4",
  });
  try {
    for (const review of reviews) {
      await connection.beginTransaction();
      try {
        await connection.execute(
          `INSERT INTO reviews
             (member_id, title, body, source, source_external_id, source_url, published_at)
           VALUES (NULL, ?, ?, 'imweb', ?, ?, COALESCE(?, NOW()))
           ON DUPLICATE KEY UPDATE
             title = VALUES(title), body = VALUES(body), source_url = VALUES(source_url),
             published_at = COALESCE(VALUES(published_at), published_at), updated_at = NOW()`,
          [review.title, review.body, review.externalId, review.sourceUrl, review.publishedAt]
        );
        const [[row]] = await connection.execute(
          "SELECT id FROM reviews WHERE source = 'imweb' AND source_external_id = ?",
          [review.externalId]
        );
        await connection.execute("DELETE FROM review_images WHERE review_id = ?", [row.id]);
        for (let index = 0; index < review.images.length; index += 1) {
          const image = review.images[index];
          await connection.execute(
            `INSERT INTO review_images
               (review_id, image_path, width, height, byte_size, sort_order, is_cover)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [row.id, image.path, image.width, image.height, image.bytes, index, index === 0 ? 1 : 0]
          );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
  } finally {
    await connection.end();
  }
}

await access(MAKERBRIDGE_ROOT);
const entries = await collectEntries();
const reviews = [];
let failures = 0;
for (let start = 0; start < entries.length; start += 4) {
  const batch = entries.slice(start, start + 4);
  const results = await Promise.allSettled(batch.map(hydrate));
  results.forEach((result, index) => {
    if (result.status === "fulfilled") reviews.push(result.value);
    else {
      failures += 1;
      console.warn(`FAIL ${batch[index].externalId}: ${result.reason.message}`);
    }
  });
  console.log(`DETAIL ${Math.min(start + 4, entries.length)}/${entries.length} · ok=${reviews.length} fail=${failures}`);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
}

if (!reviews.length) throw new Error("No review details were hydrated");
await seed(reviews);
await writeFile(join(ROOT, "reviews-data.json"), `${JSON.stringify(reviews, null, 2)}\n`, "utf8");
await writeFile(
  join(ROOT, "reviews-migration-report.json"),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      board: BOARD,
      makerbridgeUploads: relative(ROOT, UPLOAD_ROOT).replaceAll("\\", "/"),
      seeded: !NO_SEED,
      total: reviews.length,
      images: reviews.reduce((sum, review) => sum + review.images.length, 0),
      failures,
    },
    null,
    2
  )}\n`,
  "utf8"
);
console.log(
  `DONE ${reviews.length} reviews · ${reviews.reduce((sum, review) => sum + review.images.length, 0)} images · ${failures} failures`
);
