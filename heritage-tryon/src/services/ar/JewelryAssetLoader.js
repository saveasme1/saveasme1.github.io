/**
 * Load jewelry digital twin metadata + optional GLB.
 */
const META_CACHE = new Map();

export async function loadJewelryMeta(productId) {
  if (!productId) return null;
  if (META_CACHE.has(productId)) return META_CACHE.get(productId);
  const url = `./public/assets/jewelry/${encodeURIComponent(productId)}/metadata.json`;
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) {
      META_CACHE.set(productId, null);
      return null;
    }
    const meta = await res.json();
    META_CACHE.set(productId, meta);
    return meta;
  } catch (_) {
    META_CACHE.set(productId, null);
    return null;
  }
}

export function resolveModelUrl(productId, meta, tier = "medium") {
  if (!meta) return null;
  const lod = meta.lod || {};
  const file = lod[tier] || lod.high || meta.model || "model.glb";
  return `./public/assets/jewelry/${encodeURIComponent(productId)}/${file}`;
}

export async function tryLoadGltf(THREE, url) {
  if (!url || !THREE) return null;
  try {
    const { GLTFLoader } = await import(
      "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js"
    );
    const loader = new GLTFLoader();
    const gltf = await new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
    return gltf.scene || gltf.scenes?.[0] || null;
  } catch (err) {
    console.warn("GLB load failed", url, err);
    return null;
  }
}
