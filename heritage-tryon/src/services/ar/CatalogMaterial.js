/**
 * Phase 3 — catalog material application for 2.5D / canvas compose path.
 * GLB path already uses MaterialPresets via JewelryARRenderer.
 */
import { MATERIAL_PRESETS } from "./MaterialPresets.js";

const PRESET_RGB = {
  "yellow-gold-polished": [212, 175, 55],
  "rose-gold-polished": [183, 110, 121],
  "white-gold-polished": [236, 236, 240],
  "silver-polished": [196, 196, 200],
  platinum: [217, 217, 222],
  "black-metal": [28, 28, 32],
  "black-onyx": [10, 10, 12],
  diamond: [255, 255, 255],
  pearl: [246, 240, 230],
  enamel: [42, 74, 138],
};

/**
 * Tint opaque jewelry pixels toward catalog metal while preserving luminance structure.
 * @returns {HTMLCanvasElement}
 */
export function applyCatalogMaterial2D(jewelryCanvas, materialPreset = "yellow-gold-polished") {
  if (!jewelryCanvas) return jewelryCanvas;
  const rgb = PRESET_RGB[materialPreset] || PRESET_RGB["yellow-gold-polished"];
  const out = document.createElement("canvas");
  out.width = jewelryCanvas.width;
  out.height = jewelryCanvas.height;
  const ctx = out.getContext("2d");
  ctx.drawImage(jewelryCanvas, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  const tr = rgb[0] / 255;
  const tg = rgb[1] / 255;
  const tb = rgb[2] / 255;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a < 12) continue;
    const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    // keep specular highs
    const shine = lum > 0.72 ? 1.08 : lum < 0.22 ? 0.85 : 1;
    const mix = 0.55;
    d[i] = Math.min(255, (d[i] * (1 - mix) + tr * 255 * lum * shine * mix * 1.35) | 0);
    d[i + 1] = Math.min(255, (d[i + 1] * (1 - mix) + tg * 255 * lum * shine * mix * 1.35) | 0);
    d[i + 2] = Math.min(255, (d[i + 2] * (1 - mix) + tb * 255 * lum * shine * mix * 1.35) | 0);
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** Normalize / default SKU meta fields used at compose. */
export function normalizeSkuMeta(meta = {}, mode = "bracelet") {
  const m = { ...meta };
  if (!m.materialPreset) m.materialPreset = "yellow-gold-polished";
  if (!m.allowedScaleRange) m.allowedScaleRange = [0.94, 1.06];
  if (m.defaultScale == null) m.defaultScale = 1;
  if (!m.unit) m.unit = "mm";
  if (!m.deformationPolicy) m.deformationPolicy = "none";
  if (!m.occlusionMode) {
    m.occlusionMode =
      mode === "ring"
        ? "finger-ellipse"
        : mode === "earring"
          ? "ear-lobe"
          : mode === "necklace"
            ? "neckline"
            : "wrist-ellipse";
  }
  if (!MATERIAL_PRESETS[m.materialPreset]) {
    m.materialPreset = "yellow-gold-polished";
  }
  return m;
}

export function catalogSpecularBoost(materialPreset) {
  const p = MATERIAL_PRESETS[materialPreset] || MATERIAL_PRESETS["yellow-gold-polished"];
  return {
    metalness: p.metalness ?? 0.9,
    roughness: p.roughness ?? 0.2,
    exposure: p.exposure ?? 1,
  };
}
