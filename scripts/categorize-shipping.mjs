import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DEFAULT_CATEGORIES, detectCategory } from "./lib/brand-detect.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function writeCategoryIndexes(baseDir, categories, items) {
  fs.mkdirSync(baseDir, { recursive: true });
  const byCat = Object.fromEntries(categories.map((c) => [c, []]));
  items.forEach((item) => {
    const cat = categories.includes(item.category) ? item.category : "ETC";
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push({
      id: item.id,
      title: item.title,
      category: cat,
      publishedAt: item.publishedAt || item.uploadedAt || item.sortAt || "",
      cover: item.cover || item.image || "",
    });
  });
  for (const cat of categories) {
    const dir = path.join(baseDir, cat.replace(/&/g, "and"));
    fs.mkdirSync(dir, { recursive: true });
    const list = byCat[cat] || [];
    fs.writeFileSync(
      path.join(dir, "index.json"),
      `${JSON.stringify({ category: cat, count: list.length, items: list }, null, 2)}\n`,
      "utf8"
    );
  }
  return byCat;
}

function categorizeShipping() {
  const file = path.join(ROOT, "shipping-data.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const categories = [...DEFAULT_CATEGORIES];
  const counts = Object.fromEntries(categories.map((c) => [c, 0]));
  data.categories = categories;
  data.items = (data.items || []).map((item) => {
    const category = detectCategory(item.title, item.content);
    counts[category] = (counts[category] || 0) + 1;
    return { ...item, category };
  });
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  writeCategoryIndexes(path.join(ROOT, "shipping", "categories"), categories, data.items);
  console.log("shipping categorized", data.items.length, counts);
}

function indexPortfolio() {
  const file = path.join(ROOT, "portfolio-data.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const categories =
    Array.isArray(data.categories) && data.categories.length
      ? data.categories
      : [...DEFAULT_CATEGORIES];
  writeCategoryIndexes(path.join(ROOT, "portfolio", "categories"), categories, data.items || []);
  const counts = {};
  (data.items || []).forEach((item) => {
    const c = item.category || "ETC";
    counts[c] = (counts[c] || 0) + 1;
  });
  console.log("portfolio indexes", (data.items || []).length, counts);
}

categorizeShipping();
indexPortfolio();
