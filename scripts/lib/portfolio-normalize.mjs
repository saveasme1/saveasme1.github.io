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

export function sanitizeContent(value) {
  return String(value || "").replace(/\s*<div\s+class="?[\s"]*$/i, "").trim();
}

export function normalizeItem(item = {}) {
  const image = String(item.cover || item.image || "");
  const images = Array.isArray(item.images)
    ? item.images.map(String).filter(Boolean).filter((path) => path !== image)
    : [];
  const uploadedAt = item.uploadedAt || item.createdAt || new Date(0).toISOString();

  return {
    ...item,
    id: String(item.id || ""),
    category: String(item.category || "ETC"),
    title: String(item.title || ""),
    content: sanitizeContent(item.content),
    image,
    cover: image,
    images,
    sourceUrl: String(item.sourceUrl || ""),
    uploadedAt,
    sortAt: item.sortAt || uploadedAt,
    updatedAt: item.updatedAt || uploadedAt,
    origin: item.origin || "admin",
  };
}

export function sortNewestFirst(items) {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.sortAt || a.uploadedAt || a.createdAt || 0) || 0;
    const bTime = Date.parse(b.sortAt || b.uploadedAt || b.createdAt || 0) || 0;
    return bTime - aTime || String(b.id).localeCompare(String(a.id));
  });
}

export function normalizeManifest(manifest = {}) {
  const categories = Array.isArray(manifest.categories)
    ? manifest.categories.map(String)
    : DEFAULT_CATEGORIES;
  return {
    ...manifest,
    version: 3,
    categories,
    items: sortNewestFirst(
      (Array.isArray(manifest.items) ? manifest.items : []).map(normalizeItem)
    ),
  };
}

export function toPublishedManifest(draft = {}) {
  const normalized = normalizeManifest(draft);
  return {
    version: 3,
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    source: normalized.source || "",
    categories: normalized.categories,
    items: normalized.items.map((item) => ({
      id: item.id,
      category: item.category,
      title: item.title,
      content: item.content,
      image: item.image,
      images: item.images,
      uploadedAt: item.uploadedAt,
      sortAt: item.sortAt,
    })),
  };
}
