/**
 * Crawl every 공방171 portfolio post across all category boards.
 *
 * For each category board (/35../46) it paginates until no new posts appear,
 * collecting the exact post title (unchanged) and, from each post's detail
 * page, the high-resolution representative image (og:image). Images are stored
 * in the repository so the PDF builder never depends on Imweb at download time.
 */
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeItem,
  normalizeManifest,
  toPublishedManifest,
} from "./lib/portfolio-normalize.mjs";
import {
  extractImwebDetail,
  downloadOptimizedJpeg,
} from "./lib/imweb-portfolio.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://hyunah681076451.imweb.me";
const SEED_DIR = join(ROOT, "portfolio", "seed");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36";

// Board path -> category label. Order defines PDF section order.
const CATEGORIES = [
  { path: "35", label: "C" },
  { path: "36", label: "B" },
  { path: "37", label: "VCA" },
  { path: "38", label: "BO" },
  { path: "39", label: "CM" },
  { path: "40", label: "C&H" },
  { path: "41", label: "CL" },
  { path: "42", label: "G" },
  { path: "43", label: "H" },
  { path: "44", label: "P" },
  { path: "45", label: "F" },
  { path: "46", label: "ETC" },
];
const MAX_PAGES = 40;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJsonIfExists(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function cleanTitle(value) {
  return String(value || "")
    .replace(/<em[^>]*>[\s\S]*?<\/em>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function parseBoardPage(html) {
  const posts = [];
  const chunks = html.split(/list-style-card _card_wrap/).slice(1);
  for (const chunk of chunks) {
    const idxMatch = chunk.match(/[?&]idx=(\d+)/);
    const titleMatch = chunk.match(/<div class="title title-block">([\s\S]*?)<!--/);
    if (!idxMatch || !titleMatch) continue;
    const title = cleanTitle(titleMatch[1]);
    if (!title) continue;
    posts.push({ idx: idxMatch[1], title });
  }
  return posts;
}

async function collectCategory(category) {
  const seen = new Set();
  const posts = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${ORIGIN}/${category.path}${page > 1 ? `?page=${page}` : ""}`;
    const html = await fetchText(url);
    const pagePosts = parseBoardPage(html).filter((post) => !seen.has(post.idx));
    if (!pagePosts.length) break;
    pagePosts.forEach((post) => seen.add(post.idx));
    posts.push(...pagePosts);
    process.stdout.write(
      `  ${category.label} page ${page}: +${pagePosts.length} (total ${posts.length})\n`
    );
    await sleep(250);
  }
  return posts;
}

async function main() {
  await rm(SEED_DIR, { recursive: true, force: true });
  await mkdir(SEED_DIR, { recursive: true });

  const items = [];
  let ordinal = 0;
  for (const category of CATEGORIES) {
    console.log(`Category ${category.label} (/${category.path})`);
    const posts = await collectCategory(category);
    for (const post of posts) {
      ordinal += 1;
      const detailUrl = `${ORIGIN}/${category.path}/?bmode=view&idx=${post.idx}&t=board`;
      let detail = { coverUrl: "", imageUrls: [], content: "" };
      try {
        detail = extractImwebDetail(await fetchText(detailUrl));
      } catch (error) {
        console.warn(`  ! detail failed idx=${post.idx}: ${error.message}`);
      }
      const imageUrl = detail.coverUrl;
      if (!imageUrl) {
        console.warn(`  ! no image idx=${post.idx} (${post.title})`);
        continue;
      }
      const filename = `${String(ordinal).padStart(3, "0")}-imweb-${post.idx}.jpg`;
      try {
        await downloadOptimizedJpeg(imageUrl, join(SEED_DIR, filename), {
          maxSide: 760,
          quality: 82,
          userAgent: UA,
        });
      } catch (error) {
        console.warn(`  ! image download failed idx=${post.idx}: ${error.message}`);
        continue;
      }
      const detailPaths = [];
      for (let index = 0; index < detail.imageUrls.length; index += 1) {
        const relative = `portfolio/details/imweb-${post.idx}/${String(index + 1).padStart(2, "0")}.jpg`;
        try {
          await downloadOptimizedJpeg(
            detail.imageUrls[index],
            join(ROOT, ...relative.split("/")),
            { maxSide: 760, quality: 78, userAgent: UA }
          );
          detailPaths.push(relative);
        } catch (error) {
          console.warn(`  ! detail image failed idx=${post.idx} #${index + 1}: ${error.message}`);
        }
      }
      items.push({
        id: `imweb-${post.idx}`,
        category: category.label,
        title: post.title,
        content: detail.content,
        image: `portfolio/seed/${filename}`,
        cover: `portfolio/seed/${filename}`,
        images: detailPaths,
        sourceUrl: detailUrl,
        uploadedAt: new Date().toISOString(),
        sortAt: new Date(Date.now() - ordinal * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
        origin: "imweb",
      });
      await sleep(120);
    }
    console.log(`  → ${category.label} collected ${posts.length}`);
  }

  // Preserve admin-created posts and admin-maintained content/detail images.
  // Re-crawling must never wipe the board draft or portfolio/uploads.
  const draftPath = join(ROOT, "portfolio-draft.json");
  const publishedPath = join(ROOT, "portfolio-data.json");
  const previous = normalizeManifest(
    (await readJsonIfExists(draftPath)) || (await readJsonIfExists(publishedPath)) || {}
  );
  const previousById = new Map(previous.items.map((item) => [item.id, item]));
  const crawled = items.map((item) => {
    const old = previousById.get(item.id);
    if (!old) return normalizeItem(item);
    return normalizeItem({
      ...old,
      ...item,
      content: old.content || item.content || "",
      images: [
        ...item.images,
        ...(old.images || []).filter(
          (path) => !path.startsWith(`portfolio/details/${item.id}/`)
        ),
      ],
      updatedAt: old.updatedAt || item.updatedAt,
    });
  });
  const adminItems = previous.items.filter((item) => item.origin !== "imweb");
  const manifest = normalizeManifest({
    ...previous,
    version: 3,
    updatedAt: new Date().toISOString(),
    source: `${ORIGIN}/25`,
    categories: CATEGORIES.map((c) => c.label),
    items: [...crawled, ...adminItems],
  });
  manifest.draftSavedAt = manifest.updatedAt;
  await writeFile(draftPath, JSON.stringify(manifest));
  await writeFile(publishedPath, JSON.stringify(toPublishedManifest(manifest)));

  const byCategory = items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  console.log("DONE", items.length, "images");
  console.log(
    Object.entries(byCategory)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
