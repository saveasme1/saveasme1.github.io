/**
 * Earring fitting from EarAnchor3D + metadata.
 */
const SWING_TYPES = new Set(["drop", "dangle", "chandelier"]);

export function fitEarring(anchor, meta = {}, side = "right") {
  if (!anchor) return null;
  const [lo, hi] = meta.allowedScaleRange || [0.95, 1.05];
  const scale = Math.min(hi, Math.max(lo, meta.defaultScale || 1));
  const rotKey = side === "left" ? "rotationOffsetLeft" : "rotationOffsetRight";
  const posKey = side === "left" ? "positionOffsetLeft" : "positionOffsetRight";
  const type = meta.type || "drop";
  const swingEnabled =
    meta.swingEnabled != null ? Boolean(meta.swingEnabled) : SWING_TYPES.has(type);
  return {
    ...anchor,
    productScale: scale,
    rotationOffset: meta[rotKey] || [0, 0, 0],
    positionOffset: meta[posKey] || [0, 0, 0],
    sizeFit: (anchor.visibility || 0) > 0.3,
    gravityEnabled: meta.gravityEnabled !== false,
    swingEnabled,
  };
}
