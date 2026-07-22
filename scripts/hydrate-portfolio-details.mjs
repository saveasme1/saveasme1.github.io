import { readFile, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractImwebDetail, downloadOptimizedJpeg } from "./lib/imweb-portfolio.mjs";
import { normalizeManifest, toPublishedManifest } from "./lib/portfolio-normalize.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRAFT_PATH = join(ROOT, "portfolio-draft.json");
const PUBLISHED_PATH = join(ROOT, "portfolio-data.json");
const DETAILS_ROOT = join(ROOT, "portfolio", "details");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36";
const CONCURRENCY = 18;

const draft = normalizeManifest(JSON.parse(await readFile(DRAFT_PATH, "utf8")));
const published = normalizeManifest(JSON.parse(await readFile(PUBLISHED_PATH, "utf8")));
const draftById = new Map(draft.items.map((item) => [item.id, item]));
const publishedById = new Map(published.items.map((item) => [item.id, item]));
const targets = draft.items.filter((item) => item.origin === "imweb" && item.sourceUrl);

let completed = 0;
let images = 0;
let failures = 0;
let bytes = 0;

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function hydrate(item) {
  try {
    const detail = extractImwebDetail(await fetchText(item.sourceUrl));
    const paths = [];
    for (let index = 0; index < detail.imageUrls.length; index += 1) {
      const relative = `portfolio/details/${item.id}/${String(index + 1).padStart(2, "0")}.jpg`;
      const output = join(ROOT, ...relative.split("/"));
      if (!(await exists(output))) {
        const result = await downloadOptimizedJpeg(detail.imageUrls[index], output, {
          maxSide: 760,
          quality: 78,
          userAgent: UA,
        });
        bytes += result.bytes;
      }
      paths.push(relative);
      images += 1;
    }

    for (const manifestItem of [draftById.get(item.id), publishedById.get(item.id)]) {
      if (!manifestItem) continue;
      const prefix = `portfolio/details/${item.id}/`;
      const manuallyAdded = (manifestItem.images || []).filter((path) => !path.startsWith(prefix));
      manifestItem.images = [...paths, ...manuallyAdded];
      if (detail.content) manifestItem.content = detail.content;
    }
  } catch (error) {
    failures += 1;
    console.warn(`FAIL ${item.id}: ${error.message}`);
  } finally {
    completed += 1;
    if (completed % 10 === 0 || completed === targets.length) {
      console.log(
        `PROGRESS ${completed}/${targets.length} posts · ${images} images · ${failures} failures`
      );
    }
  }
}

for (let start = 0; start < targets.length; start += CONCURRENCY) {
  await Promise.all(targets.slice(start, start + CONCURRENCY).map(hydrate));
  if ((start + CONCURRENCY) % 48 === 0) {
    draft.items = draft.items.map((item) => draftById.get(item.id) || item);
    published.items = published.items.map((item) => publishedById.get(item.id) || item);
    await Promise.all([
      writeFile(DRAFT_PATH, JSON.stringify(draft)),
      writeFile(PUBLISHED_PATH, JSON.stringify(toPublishedManifest(published))),
    ]);
  }
}

draft.items = draft.items.map((item) => draftById.get(item.id) || item);
published.items = published.items.map((item) => publishedById.get(item.id) || item);
const now = new Date().toISOString();
draft.updatedAt = now;
draft.draftSavedAt = now;
published.updatedAt = now;
published.publishedAt = now;
await Promise.all([
  writeFile(DRAFT_PATH, JSON.stringify(draft)),
  writeFile(PUBLISHED_PATH, JSON.stringify(toPublishedManifest(published))),
]);

console.log(
  `DONE ${completed} posts · ${images} detail images · ${(bytes / 1048576).toFixed(1)} MB written · ${failures} failures`
);
