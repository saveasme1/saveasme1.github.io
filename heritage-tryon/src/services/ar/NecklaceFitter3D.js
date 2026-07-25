/**
 * Necklace fitting from NeckAnchor3D + metadata.
 */
export function fitNecklace(anchor, meta = {}) {
  if (!anchor) return null;
  const drop = meta.dropMm ? meta.dropMm / 1000 : anchor.necklaceDropEstimate || 0.06;
  const [lo, hi] = meta.allowedScaleRange || [0.94, 1.06];
  const scale = Math.min(hi, Math.max(lo, meta.defaultScale || 1));
  const center2D = {
    x: anchor.center2D.x,
    y: anchor.center2D.y + drop * 0.35,
  };
  return {
    ...anchor,
    center2D,
    center: center2D,
    productScale: scale,
    drop,
    sizeFit: (anchor.shoulderWidth || 0) > 0.15,
    deformationPolicy: meta.deformationPolicy || "chain-path-only",
    curvePoints: [
      { x: anchor.center2D.x - anchor.collarboneWidth * 0.45, y: anchor.center2D.y - 0.01 },
      { x: anchor.center2D.x - anchor.collarboneWidth * 0.2, y: anchor.center2D.y + drop * 0.15 },
      { x: center2D.x, y: center2D.y },
      { x: anchor.center2D.x + anchor.collarboneWidth * 0.2, y: anchor.center2D.y + drop * 0.15 },
      { x: anchor.center2D.x + anchor.collarboneWidth * 0.45, y: anchor.center2D.y - 0.01 },
    ],
  };
}
