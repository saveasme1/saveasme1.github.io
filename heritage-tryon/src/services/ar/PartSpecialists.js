/**
 * Phase 2 — part specialists (StyleAR Face·Ear / Hand·Finger·Wrist / Neck).
 * Refine anchors/targets after generic MediaPipe estimates.
 */
import { clamp } from "./math.js";

/** Ear: when side-on / hair likely, bias attachment toward cheek and lower visibility swing. */
export function refineEarSpecialist(anchor) {
  if (!anchor) return null;
  const vis = anchor.visibility ?? 1;
  const yaw = Math.abs(anchor.yaw || 0);
  const out = { ...anchor, specialist: "ear-v1" };
  if (vis < 0.42 || yaw > 0.55) {
    // pull toward face center slightly (hair/occluded lobe heuristic)
    const c = out.attachment2D || out.center2D;
    if (c) {
      const toward = anchor.side === "left" ? 0.012 : -0.012;
      out.attachment2D = { x: clamp(c.x + toward, 0.02, 0.98), y: clamp(c.y + 0.008, 0.02, 0.98) };
      out.center2D = out.attachment2D;
      out.center = out.attachment2D;
    }
    out.visibility = clamp(vis * 0.85, 0.08, 1);
    out.confidence = clamp((out.confidence || 0.4) * 0.9, 0.1, 1);
    out.hairOcclusionHint = true;
  }
  // asymmetric product: keep side identity
  out.sideIdentity = out.side;
  return out;
}

/** Ring: keep band on MCP–PIP plane; on high bend move toward MCP (avoid tip stretch). */
export function refineFingerSpecialist(anchor) {
  if (!anchor) return null;
  const out = { ...anchor, specialist: "finger-v1" };
  const bend = out.jointBend || 0;
  if (bend >= 1.0 && out.center2D && out.direction) {
    // nudge toward MCP along -direction (finger base)
    const t = clamp((bend - 1.0) / 0.8, 0, 0.35);
    out.center2D = {
      x: out.center2D.x - out.direction.x * 0.018 * t,
      y: out.center2D.y - out.direction.y * 0.018 * t,
    };
    out.center = out.center2D;
    out.fitWarning = true;
  }
  // uniform scale hint for compose
  out.uniformScaleOnly = true;
  return out;
}

/** Bracelet: tighten wrist ellipse from palm span / orientation. */
export function refineWristSpecialist(anchor) {
  if (!anchor) return null;
  const out = { ...anchor, specialist: "wrist-v1" };
  const rx = out.radiusX || 0.06;
  const ry = out.radiusY || rx * 0.72;
  // keep elliptical, never circular stretch
  out.radiusX = clamp(rx, 0.03, 0.16);
  out.radiusY = clamp(Math.min(ry, out.radiusX * 0.85), 0.022, 0.12);
  if (out.width == null) out.width = out.radiusX * 2.4;
  out.ellipseOnly = true;
  out.uniformScaleOnly = true;
  return out;
}

/** Necklace: collarbone drape — drop along neck axis, widen with shoulders. */
export function refineNecklaceSpecialist(anchor) {
  if (!anchor) return null;
  const out = { ...anchor, specialist: "necklace-v1" };
  const drop = out.necklaceDropEstimate || 0.06;
  const c = out.center2D || out.center;
  if (c && out.neckAxis) {
    out.center2D = {
      x: c.x + out.neckAxis.x * drop * 0.35,
      y: c.y + Math.abs(out.neckAxis.y) * drop * 0.85 + drop * 0.25,
    };
    out.center = out.center2D;
  }
  out.drapeWidth = out.collarboneWidth || out.width || 0.3;
  if (out.width == null) out.width = out.drapeWidth;
  out.frontCameraPreferred = true;
  return out;
}

/**
 * Apply specialist by mode to a compose target (pixel or normalized).
 */
export function applyPartSpecialist(mode, target) {
  if (!target) return null;
  if (mode === "earring") return refineEarSpecialist(target);
  if (mode === "ring") return refineFingerSpecialist(target);
  if (mode === "bracelet") return refineWristSpecialist(target);
  if (mode === "necklace") return refineNecklaceSpecialist(target);
  return target;
}
