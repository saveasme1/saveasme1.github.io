/**
 * Earring fitting from EarAnchor3D + metadata.
 */
export function fitEarring(anchor, meta = {}, side = "right") {
  if (!anchor) return null;
  const [lo, hi] = meta.allowedScaleRange || [0.95, 1.05];
  const scale = Math.min(hi, Math.max(lo, meta.defaultScale || 1));
  const rotKey = side === "left" ? "rotationOffsetLeft" : "rotationOffsetRight";
  const posKey = side === "left" ? "positionOffsetLeft" : "positionOffsetRight";
  return {
    ...anchor,
    productScale: scale,
    rotationOffset: meta[rotKey] || [0, 0, 0],
    positionOffset: meta[posKey] || [0, 0, 0],
    sizeFit: (anchor.visibility || 0) > 0.3,
    gravityEnabled: meta.gravityEnabled !== false,
    swingEnabled: Boolean(meta.swingEnabled),
  };
}
