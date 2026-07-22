import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeManifest, toPublishedManifest } from "./lib/portfolio-normalize.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const publishedPath = join(ROOT, "portfolio-data.json");
const draftPath = join(ROOT, "portfolio-draft.json");

const current = JSON.parse(await readFile(publishedPath, "utf8"));
// The legacy crawler wrote processing timestamps, not the Imweb post dates.
// Preserve its existing newest-to-oldest array order with a stable synthetic
// sort timestamp. Future admin posts use their selected 게시일 as sortAt.
const legacySortBase = Date.parse("2026-07-18T23:59:59.000Z");
const prepared = {
  ...current,
  items: (current.items || []).map((item, index) => ({
    ...item,
    sortAt: item.sortAt || new Date(legacySortBase - index * 1000).toISOString(),
  })),
};
const draft = normalizeManifest(prepared);
draft.updatedAt = new Date().toISOString();
draft.draftSavedAt = draft.updatedAt;

await writeFile(draftPath, JSON.stringify(draft));
await writeFile(publishedPath, JSON.stringify(toPublishedManifest(draft)));

console.log(`Migrated ${draft.items.length} portfolio items to schema v3.`);
