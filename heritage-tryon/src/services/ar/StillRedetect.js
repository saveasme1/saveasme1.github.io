/**
 * Phase 1 — still-image target resolution (StyleAR SaaS photo path).
 * Prefer MediaPipe re-detect on the final still; live capture is a soft prior only.
 */
import { fallbackTarget } from "../tryon.js";

function confOf(t) {
  if (!t) return 0;
  return Number(t.confidence ?? t.score ?? (t.center || t.center2D ? 0.55 : 0));
}

/**
 * @returns {{ target: object, source: "still"|"capture"|"fallback", usedFallback: boolean, stillConfidence: number }}
 */
export function resolveComposeTarget({
  mode,
  detection,
  capturePlacement,
  bodyImage,
  placementToPixels,
  extras = {},
}) {
  const w = bodyImage.naturalWidth || bodyImage.width;
  const h = bodyImage.naturalHeight || bodyImage.height;
  const still =
    detection?.allTargets?.[mode] ||
    detection?.target ||
    null;
  const stillConf = confOf(still);
  const fromCapture =
    typeof placementToPixels === "function" && capturePlacement
      ? placementToPixels(capturePlacement, w, h)
      : null;
  const captureConf = fromCapture ? Math.max(0.45, confOf(fromCapture)) : 0;

  // StyleAR photo path: still wins when it has a usable attachment.
  if (still && stillConf >= 0.35 && (still.center || still.center2D)) {
    // If capture is close, blend angle/width softly for stability.
    let target = { ...still, source: "still" };
    if (fromCapture && captureConf >= 0.4) {
      const sc = still.center || still.center2D;
      const cc = fromCapture.center || fromCapture.center2D;
      const sx = sc.x <= 1.5 && sc.x <= 1 ? sc.x * w : sc.x;
      const sy = sc.y <= 1.5 && sc.y <= 1 ? sc.y * h : sc.y;
      const cx = cc.x;
      const cy = cc.y;
      const distPx = Math.hypot(sx - cx, sy - cy);
      if (distPx < Math.min(w, h) * 0.12) {
        target = {
          ...target,
          angle: still.angle != null ? still.angle : fromCapture.angle,
          frontAngle: still.frontAngle != null ? still.frontAngle : fromCapture.frontAngle,
          width: still.width || fromCapture.width,
        };
      }
    }
    return {
      target,
      source: "still",
      usedFallback: false,
      stillConfidence: stillConf,
    };
  }

  if (fromCapture && (fromCapture.center || fromCapture.center2D)) {
    return {
      target: { ...fromCapture, source: "capture" },
      source: "capture",
      usedFallback: false,
      stillConfidence: stillConf,
    };
  }

  const fb = fallbackTarget(bodyImage, mode, extras);
  return {
    target: fb ? { ...fb, source: "fallback" } : null,
    source: "fallback",
    usedFallback: true,
    stillConfidence: stillConf,
  };
}

/** Build normalized/pixel anchor for GLB high-res save from pixel target. */
export function targetToAnchor(target, bodyW, bodyH) {
  if (!target) return null;
  if (target.center2D && target.radiusX != null && target.source === "capture") {
    return target;
  }
  const c = target.center || target.center2D;
  if (!c) return null;
  const px = c.x <= 1 && c.y <= 1 ? c.x * bodyW : c.x;
  const py = c.y <= 1 && c.x <= 1 ? c.y * bodyH : c.y;
  const widthPx =
    target.width != null
      ? target.width <= 1.5
        ? target.width * bodyW
        : target.width
      : bodyW * 0.12;
  return {
    ...target,
    center2D: { x: px / bodyW, y: py / bodyH },
    center: { x: px / bodyW, y: py / bodyH },
    radiusX: target.radiusX != null ? (target.radiusX <= 1.5 ? target.radiusX : target.radiusX / bodyW) : widthPx / bodyW / 2.4,
    radiusY: target.radiusY != null ? (target.radiusY <= 1.5 ? target.radiusY : target.radiusY / bodyH) : (widthPx / bodyW / 2.4) * 0.7,
    radiusEstimate: target.radiusEstimate != null ? target.radiusEstimate : widthPx / bodyW / 2,
    angle: target.angle || 0,
    frontAngle: target.frontAngle != null ? target.frontAngle : (target.angle || 0) - 90,
  };
}
