/**
 * Bracelet-specific fitting from WristAnchor3D + product metadata.
 */
export function fitBracelet(anchor, meta = {}) {
  if (!anchor) return null;
  const clearance = 0.012;
  const fittedRadiusX = (anchor.radiusX || 0.06) + clearance;
  const fittedRadiusY = (anchor.radiusY || 0.04) + clearance;
  const inner = meta.innerDiameterMm || 58;
  const scaleFromWrist = (fittedRadiusX * 2) / (inner / 1000 || 0.058);
  const [lo, hi] = meta.allowedScaleRange || [0.96, 1.04];
  let scale = Math.min(hi, Math.max(lo, scaleFromWrist * (meta.defaultScale || 1)));
  const sizeFit = scaleFromWrist >= lo * 0.9 && scaleFromWrist <= hi * 1.15;
  return {
    ...anchor,
    fittedRadiusX,
    fittedRadiusY,
    productScale: scale,
    sizeFit,
    deformationPolicy: meta.deformationPolicy || "none",
  };
}
