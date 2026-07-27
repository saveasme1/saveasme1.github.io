/**
 * StyleAR-class compose pipeline (photo / offline quality path).
 *
 * Phase 1:
 *  - still re-detect preferred over live capture coords
 *  - part occlusion soft masks
 *  - edge / lighting harmonize
 *
 * @see LONGTERM_STYLEAR_KO.md
 */
import { composeHighResTryOn } from "./HighResCompose.js";
import { resolveComposeTarget, targetToAnchor } from "./StillRedetect.js";
import { applyPartOcclusion } from "./PartOcclusionMask.js";
import { harmonizeCompose } from "./ComposeHarmonize.js";

export const STYLEAR_PIPELINE_VERSION = "1.1.0-phase1";

export const STYLEAR_PARTS = Object.freeze({
  earring: ["face", "ear"],
  ring: ["hand", "finger"],
  bracelet: ["hand", "wrist"],
  necklace: ["pose", "neck", "face"],
});

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.bodyCanvas
 * @param {HTMLCanvasElement} opts.jewelryCanvas
 * @param {string} [opts.mode]
 * @param {string} [opts.type]
 * @param {object} [opts.target] — optional pre-resolved; if omitted + detection given, resolve inside
 * @param {object} [opts.detection]
 * @param {object} [opts.capturePlacement]
 * @param {HTMLImageElement|HTMLCanvasElement} [opts.bodyImage]
 * @param {Function} [opts.placementToPixels]
 * @param {object} [opts.extras]
 * @param {object} [opts.arRenderer]
 * @param {object} [opts.anchor]
 */
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

  const anchor =
    opts.anchor ||
    targetToAnchor(target, bodyCanvas.width, bodyCanvas.height);

  const base = await composeHighResTryOn({
    ...opts,
    type: mode,
    target,
    anchor,
  });

  let canvas = base.canvas;
  if (canvas && bodyCanvas && target) {
    try {
      canvas = applyPartOcclusion(canvas, bodyCanvas, target, mode);
      canvas = harmonizeCompose(canvas, bodyCanvas, target, mode);
    } catch (err) {
      console.warn("StyleAR Phase1 post-pass failed", err);
    }
  }

  return {
    ...base,
    canvas,
    target,
    anchor,
    pipeline: "stylear-compose",
    pipelineVersion: STYLEAR_PIPELINE_VERSION,
    parts,
    primaryPath: "photo_compose",
    resolveSource: resolveMeta.source,
    usedFallback: resolveMeta.usedFallback,
    stillConfidence: resolveMeta.stillConfidence,
    phase: 1,
  };
}

export { resolveComposeTarget, targetToAnchor } from "./StillRedetect.js";
