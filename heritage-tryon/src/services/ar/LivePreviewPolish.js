/**
 * Phase 4 — live preview polish helpers (guidance quality, not final pixels).
 * Final quality remains StyleAR compose path.
 */
export function liveSmootherOptions(mode = "bracelet") {
  if (mode === "earring" || mode === "necklace") {
    return { posAlpha: 0.28, scaleAlpha: 0.22, rotAlpha: 0.24, jumpPx: 0.09, holdMs: 280 };
  }
  if (mode === "ring") {
    return { posAlpha: 0.32, scaleAlpha: 0.24, rotAlpha: 0.26, jumpPx: 0.08, holdMs: 240 };
  }
  return { posAlpha: 0.33, scaleAlpha: 0.24, rotAlpha: 0.26, jumpPx: 0.1, holdMs: 240 };
}

/** Dim live GLB slightly so guide stays readable; save path uses full material. */
export function livePreviewOpacity(mode = "bracelet") {
  if (mode === "necklace") return 0.88;
  if (mode === "earring") return 0.9;
  return 0.92;
}

export const PHASE4_LIVE_POLICY = Object.freeze({
  role: "guidance_only",
  finalPixels: "runStyleArCompose",
});
