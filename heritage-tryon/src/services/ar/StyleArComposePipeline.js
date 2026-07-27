/**
 * StyleAR compose — hardened so merge always yields a canvas.
 */
import { composeHighResTryOn } from "./HighResCompose.js";
import { resolveComposeTarget, targetToAnchor } from "./StillRedetect.js";
import { applyPartOcclusion } from "./PartOcclusionMask.js";
import { harmonizeCompose } from "./ComposeHarmonize.js";
import { applyPartSpecialist } from "./PartSpecialists.js";
import { applyCatalogMaterial2D, normalizeSkuMeta } from "./CatalogMaterial.js";

export const STYLEAR_PIPELINE_VERSION = "1.3.1-compose-fix";

export const STYLEAR_PARTS = Object.freeze({
  earring: ["face", "ear"],
  ring: ["hand", "finger"],
  bracelet: ["hand", "wrist"],
  necklace: ["pose", "neck", "face"],
});

function stampFallback(bodyCanvas, jewelryCanvas, target) {
  const out = document.createElement("canvas");
  out.width = Math.max(1, bodyCanvas?.width || 1);
  out.height = Math.max(1, bodyCanvas?.height || 1);
  const ctx = out.getContext("2d");
  if (bodyCanvas) ctx.drawImage(bodyCanvas, 0, 0);
  if (!jewelryCanvas) return out;
  const c = target?.center || target?.center2D || { x: out.width * 0.5, y: out.height * 0.45 };
  const cx = c.x <= 1 && c.y <= 1 ? c.x * out.width : c.x;
  const cy = c.y <= 1 && c.x <= 1 ? c.y * out.height : c.y;
  let tw =
    target?.width != null
      ? target.width <= 1.5
        ? target.width * out.width
        : target.width
      : out.width * 0.22;
  tw = Math.max(24, Math.min(out.width * 0.55, tw));
  const aspect = jewelryCanvas.height / Math.max(1, jewelryCanvas.width);
  const th = Math.max(12, tw * aspect);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(((target?.angle || 0) * Math.PI) / 180);
  ctx.drawImage(jewelryCanvas, -tw / 2, -th / 2, tw, th);
  ctx.restore();
  return out;
}

export async function runStyleArCompose(opts) {
  const mode = opts?.mode || opts?.type || "bracelet";
  const parts = STYLEAR_PARTS[mode] || STYLEAR_PARTS.bracelet;
  const bodyCanvas = opts.bodyCanvas;
  const bodyImage = opts.bodyImage || bodyCanvas;

  let target = opts.target;
  let resolveMeta = {
    source: opts.target?.source || "caller",
    usedFallback: false,
    stillConfidence: 0,
  };

  if (!target && (opts.detection || opts.capturePlacement)) {
    resolveMeta = resolveComposeTarget({
      mode,
      detection: opts.detection,
      capturePlacement: opts.capturePlacement,
      bodyImage,
      placementToPixels: opts.placementToPixels,
      extras: opts.extras || {},
    });
    target = resolveMeta.target;
  }

  try {
    target = applyPartSpecialist(mode, target) || target;
  } catch (_) {
    /* keep target */
  }

  const meta = normalizeSkuMeta(opts.meta || opts.arRenderer?.meta || {}, mode);
  let jewelryCanvas = opts.jewelryCanvas;
  const useGlb = Boolean(
    opts.arRenderer?.hasGlb &&
      opts.arRenderer?.assetState &&
      opts.arRenderer.assetState !== "fallback_2_5d" &&
      opts.arRenderer.assetState !== "unavailable"
  );

  if (jewelryCanvas && !useGlb) {
    try {
      jewelryCanvas = applyCatalogMaterial2D(jewelryCanvas, meta.materialPreset);
    } catch (_) {
      /* keep original cutout */
    }
  }

  const anchor =
    opts.anchor ||
    (bodyCanvas ? targetToAnchor(target, bodyCanvas.width, bodyCanvas.height) : null);

  let base;
  try {
    // Skip flaky GLB high-res when renderer mount is zero-sized (camera closed)
    const ar = useGlb ? opts.arRenderer : null;
    base = await composeHighResTryOn({
      ...opts,
      type: mode,
      target,
      anchor,
      jewelryCanvas,
      arRenderer: ar,
    });
  } catch (err) {
    console.warn("composeHighResTryOn failed, stamp fallback", err);
    base = {
      canvas: stampFallback(bodyCanvas, jewelryCanvas || opts.jewelryCanvas, target),
      path: "stamp-fallback",
      assetState: "fallback_2_5d",
    };
  }

  let canvas = base?.canvas;
  if (!canvas) {
    canvas = stampFallback(bodyCanvas, jewelryCanvas || opts.jewelryCanvas, target);
    base = { ...(base || {}), canvas, path: "stamp-fallback" };
  }

  if (canvas && bodyCanvas && target) {
    try {
      canvas = applyPartOcclusion(canvas, bodyCanvas, target, mode);
      canvas = harmonizeCompose(canvas, bodyCanvas, target, mode);
    } catch (err) {
      console.warn("StyleAR post-pass failed", err);
    }
  }

  return {
    ...base,
    canvas,
    target,
    anchor,
    meta,
    pipeline: "stylear-compose",
    pipelineVersion: STYLEAR_PIPELINE_VERSION,
    parts,
    primaryPath: "photo_compose",
    resolveSource: resolveMeta.source,
    usedFallback: resolveMeta.usedFallback || base?.path === "stamp-fallback",
    stillConfidence: resolveMeta.stillConfidence,
    specialist: target?.specialist || null,
    materialPreset: meta.materialPreset,
    phase: 3,
  };
}

export { resolveComposeTarget, targetToAnchor } from "./StillRedetect.js";
export { applyPartSpecialist } from "./PartSpecialists.js";
export { applyCatalogMaterial2D, normalizeSkuMeta } from "./CatalogMaterial.js";
export { liveSmootherOptions, livePreviewOpacity, PHASE4_LIVE_POLICY } from "./LivePreviewPolish.js";
