/**
 * StyleAR-class compose pipeline (photo / offline quality path).
 * Phase 1: still re-detect, occlusion, harmonize
 * Phase 2: part specialists
 * Phase 3: catalog material on 2.5D path
 *
 * @see LONGTERM_STYLEAR_KO.md
 */
import { composeHighResTryOn } from "./HighResCompose.js";
import { resolveComposeTarget, targetToAnchor } from "./StillRedetect.js";
import { applyPartOcclusion } from "./PartOcclusionMask.js";
import { harmonizeCompose } from "./ComposeHarmonize.js";
import { applyPartSpecialist } from "./PartSpecialists.js";
import { applyCatalogMaterial2D, normalizeSkuMeta } from "./CatalogMaterial.js";

export const STYLEAR_PIPELINE_VERSION = "1.3.0-phase3";

export const STYLEAR_PARTS = Object.freeze({
  earring: ["face", "ear"],
  ring: ["hand", "finger"],
  bracelet: ["hand", "wrist"],
  necklace: ["pose", "neck", "face"],
});

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

  // Phase 2 specialists
  target = applyPartSpecialist(mode, target) || target;

  const meta = normalizeSkuMeta(opts.meta || opts.arRenderer?.meta || {}, mode);
  let jewelryCanvas = opts.jewelryCanvas;
  // Phase 3: tint 2.5D product cutout toward catalog metal (GLB uses Three materials)
  const useGlb =
    opts.arRenderer?.hasGlb && opts.arRenderer?.assetState !== "fallback_2_5d";
  if (jewelryCanvas && !useGlb) {
    try {
      jewelryCanvas = applyCatalogMaterial2D(jewelryCanvas, meta.materialPreset);
    } catch (err) {
      console.warn("catalog material 2D failed", err);
    }
  }

  const anchor =
    opts.anchor ||
    targetToAnchor(target, bodyCanvas.width, bodyCanvas.height);

  const base = await composeHighResTryOn({
    ...opts,
    type: mode,
    target,
    anchor,
    jewelryCanvas,
  });

  let canvas = base.canvas;
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
    usedFallback: resolveMeta.usedFallback,
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
