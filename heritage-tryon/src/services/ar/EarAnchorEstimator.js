/**
 * Left/Right EarAnchor3D from Face Landmarker.
 */
import { norm3, cross3, quatFromBasis, clamp } from "./math.js";
import { refineEarSpecialist } from "./PartSpecialists.js";

/** Face mesh indices commonly used as ear / cheek proxies */
const EAR_IDX = {
  left: { lobe: 234, cheek: 93, temple: 127, eyeOuter: 33 },
  right: { lobe: 454, cheek: 323, temple: 356, eyeOuter: 263 },
};

/**
 * @param {Array} faceLm
 * @param {'left'|'right'} side anatomical
 * @param {{ mirrored?: boolean, faceMatrix?: number[] }} opts
 */
export function estimateEarAnchor3D(faceLm, side = "right", opts = {}) {
  if (!faceLm?.length) return null;
  const spec = EAR_IDX[side] || EAR_IDX.right;
  const lobe = faceLm[spec.lobe] || faceLm[spec.temple];
  const cheek = faceLm[spec.cheek] || lobe;
  const temple = faceLm[spec.temple] || lobe;
  const eye = faceLm[spec.eyeOuter] || temple;
  const nose = faceLm[1] || faceLm[4];
  if (!lobe) return null;

  const mapX = (x) => (opts.mirrored ? 1 - x : x);

  // calibrated blend toward anatomical earlobe
  const attachment2D = {
    x: mapX(lobe.x * 0.72 + cheek.x * 0.18 + temple.x * 0.1),
    y: lobe.y * 0.65 + eye.y * 0.2 + cheek.y * 0.15,
  };

  const other = side === "left" ? faceLm[EAR_IDX.right.lobe] : faceLm[EAR_IDX.left.lobe];
  const headWidth = other ? Math.abs(mapX(lobe.x) - mapX(other.x)) : 0.22;

  // yaw proxy: nose vs ear midline
  let yaw = 0;
  if (nose && other) {
    const mid = (mapX(lobe.x) + mapX(other.x)) / 2;
    yaw = (mapX(nose.x) - mid) / Math.max(0.08, headWidth);
  }

  const headUp = norm3({
    x: 0,
    y: -1,
    z: 0,
  });
  const headForward = norm3({
    x: Math.sin(yaw * 0.8),
    y: 0,
    z: -Math.cos(yaw * 0.8),
  });
  const earNormal = norm3(
    side === "left"
      ? { x: -Math.cos(yaw * 0.5), y: 0, z: -Math.sin(yaw * 0.5) }
      : { x: Math.cos(yaw * 0.5), y: 0, z: Math.sin(yaw * 0.5) }
  );
  const across = norm3(cross3(headUp, earNormal));
  const rotationQuaternion = quatFromBasis(across, headUp, earNormal);

  // visibility: facing camera when ear normal ~ toward camera (-Z)
  const visibility = clamp(0.55 + (side === "left" ? -yaw : yaw) * 0.55, 0.05, 1);
  const earScale = clamp(headWidth * 0.22, 0.03, 0.12);

  let confidence = 0.4;
  if (lobe) confidence += 0.2;
  if (cheek) confidence += 0.1;
  if (visibility > 0.45) confidence += 0.15;
  confidence = clamp(confidence, 0, 1);

  return refineEarSpecialist({
    side,
    attachment2D,
    attachment3D: { x: attachment2D.x, y: attachment2D.y, z: lobe.z || 0 },
    center2D: attachment2D,
    center3D: { x: attachment2D.x, y: attachment2D.y, z: lobe.z || 0 },
    earNormal,
    headUp,
    headForward,
    palmNormal: earNormal,
    rotationQuaternion,
    earScale,
    scale: earScale,
    visibility,
    confidence,
    mirrored: Boolean(opts.mirrored),
    timestamp: performance.now(),
    yaw,
    // legacy
    center: attachment2D,
    width: earScale,
    angle: (Math.atan2(earNormal.y, earNormal.x) * 180) / Math.PI,
    source: "ear3d",
  });
}

export function estimateEarPair(faceLm, opts = {}) {
  return {
    left: estimateEarAnchor3D(faceLm, "left", opts),
    right: estimateEarAnchor3D(faceLm, "right", opts),
  };
}
