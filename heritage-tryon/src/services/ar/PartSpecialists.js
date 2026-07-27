/**
 * Phase 2 — part specialists. Must not invent normalized radius when width is pixels.
 */
import { clamp } from "./math.js";

function isPixelWidth(w) {
  return w != null && w > 2;
}

export function refineEarSpecialist(anchor) {
  if (!anchor) return null;
  const vis = anchor.visibility ?? 1;
  const yaw = Math.abs(anchor.yaw || 0);
  const out = { ...anchor, specialist: "ear-v1" };
  if (vis < 0.42 || yaw > 0.55) {
    const c = out.attachment2D || out.center2D || out.center;
    if (c) {
      const toward = anchor.side === "left" ? 0.012 : -0.012;
      const nx = c.x <= 1 && c.y <= 1 ? clamp(c.x + toward, 0.02, 0.98) : c.x + toward * 20;
      const ny = c.x <= 1 && c.y <= 1 ? clamp(c.y + 0.008, 0.02, 0.98) : c.y + 4;
      out.attachment2D = { x: nx, y: ny };
      out.center2D = out.attachment2D;
      out.center = out.attachment2D;
    }
    out.visibility = clamp(vis * 0.85, 0.08, 1);
    out.confidence = clamp((out.confidence || 0.4) * 0.9, 0.1, 1);
    out.hairOcclusionHint = true;
  }
  out.sideIdentity = out.side;
  return out;
}

export function refineFingerSpecialist(anchor) {
  if (!anchor) return null;
  const out = { ...anchor, specialist: "finger-v1" };
  const bend = out.jointBend || 0;
  if (bend >= 1.0 && out.center2D && out.direction) {
    const t = clamp((bend - 1.0) / 0.8, 0, 0.35);
    const c = out.center2D;
    const scale = c.x <= 1 && c.y <= 1 ? 0.018 : 8;
    out.center2D = {
      x: c.x - out.direction.x * scale * t,
      y: c.y - out.direction.y * scale * t,
    };
    out.center = out.center2D;
    out.fitWarning = true;
  }
  out.uniformScaleOnly = true;
  return out;
}

export function refineWristSpecialist(anchor) {
  if (!anchor) return null;
  const out = { ...anchor, specialist: "wrist-v1" };
  // Do NOT invent normalized radiusX when still-detect gave pixel width — that shrinks the stamp.
  if (out.radiusX != null && out.radiusX <= 1.5) {
    out.radiusX = clamp(out.radiusX, 0.03, 0.16);
    out.radiusY = clamp(
      Math.min(out.radiusY != null ? out.radiusY : out.radiusX * 0.72, out.radiusX * 0.85),
      0.022,
      0.12
    );
  } else if (isPixelWidth(out.width)) {
    delete out.radiusX;
    delete out.radiusY;
  }
  out.ellipseOnly = true;
  out.uniformScaleOnly = true;
  return out;
}

export function refineNecklaceSpecialist(anchor) {
  if (!anchor) return null;
  const out = { ...anchor, specialist: "necklace-v1" };
  const drop = out.necklaceDropEstimate;
  const c = out.center2D || out.center;
  if (c && out.neckAxis && drop != null) {
    const unit = c.x <= 1 && c.y <= 1 ? 1 : 120;
    out.center2D = {
      x: c.x + out.neckAxis.x * drop * 0.35 * unit,
      y: c.y + (Math.abs(out.neckAxis.y) * drop * 0.85 + drop * 0.25) * unit,
    };
    out.center = out.center2D;
  }
  if (out.collarboneWidth != null && !isPixelWidth(out.width)) {
    out.width = out.collarboneWidth;
  }
  out.frontCameraPreferred = true;
  return out;
}

export function applyPartSpecialist(mode, target) {
  if (!target) return null;
  if (mode === "earring") return refineEarSpecialist(target);
  if (mode === "ring") return refineFingerSpecialist(target);
  if (mode === "bracelet") return refineWristSpecialist(target);
  if (mode === "necklace") return refineNecklaceSpecialist(target);
  return target;
}
