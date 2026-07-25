/**
 * Ring-specific fitting from FingerAnchor3D + product metadata.
 */
export function fitRing(anchor, meta = {}) {
  if (!anchor) return null;
  const clearance = 0.004;
  const r = (anchor.radiusEstimate || 0.02) + clearance;
  const [lo, hi] = meta.allowedScaleRange || [0.96, 1.04];
  const base = meta.defaultScale || 1;
  const scale = Math.min(hi, Math.max(lo, base));
  return {
    ...anchor,
    fittedRadius: r,
    productScale: scale,
    sizeFit: (anchor.jointBend || 0) < 1.15,
    deformationPolicy: meta.deformationPolicy || "none",
  };
}
