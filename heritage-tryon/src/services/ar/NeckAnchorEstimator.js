/**
 * NeckAnchor3D from Face + Pose landmarks.
 */
import { norm3, cross3, quatFromBasis, clamp } from "./math.js";

/**
 * @param {Array} faceLm — Face Landmarker landmarks (optional)
 * @param {Array} poseLm — Pose landmarks
 * @param {{ mirrored?: boolean }} opts
 */
export function estimateNeckAnchor3D(faceLm, poseLm, opts = {}) {
  if (!poseLm?.[11] || !poseLm?.[12]) return null;
  const ls = poseLm[11];
  const rs = poseLm[12];
  const nose = poseLm[0] || faceLm?.[1];
  const mouth = faceLm?.[13] || faceLm?.[152] || nose;

  const mapX = (x) => (opts.mirrored ? 1 - x : x);

  const lx = mapX(ls.x);
  const rx = mapX(rs.x);
  const ly = ls.y;
  const ry = rs.y;

  const shoulderAxis = norm3({ x: rx - lx, y: ry - ly, z: (rs.z || 0) - (ls.z || 0) });
  const midShoulder = { x: (lx + rx) / 2, y: (ly + ry) / 2, z: ((ls.z || 0) + (rs.z || 0)) / 2 };
  const shoulderWidth = Math.hypot(rx - lx, ry - ly);

  const noseX = nose ? mapX(nose.x) : midShoulder.x;
  const noseY = nose ? nose.y : midShoulder.y - 0.12;
  const chinY = mouth ? mouth.y : noseY + 0.06;

  // neck base between chin and shoulders
  const center2D = {
    x: midShoulder.x * 0.55 + noseX * 0.45,
    y: midShoulder.y * 0.62 + chinY * 0.38,
  };

  const neckAxis = norm3({
    x: noseX - midShoulder.x,
    y: noseY - midShoulder.y,
    z: 0,
  });
  let chestNormal = norm3(cross3(shoulderAxis, { x: 0, y: 1, z: 0 }));
  if (chestNormal.z > 0) chestNormal = { x: -chestNormal.x, y: -chestNormal.y, z: -chestNormal.z };

  const headForward = chestNormal;
  const yAxis = norm3(cross3(chestNormal, shoulderAxis));
  const xAxis = norm3(cross3(yAxis, chestNormal));
  const rotationQuaternion = quatFromBasis(xAxis, yAxis, chestNormal);

  const neckWidth = clamp(shoulderWidth * 0.28, 0.06, 0.2);
  const collarboneWidth = clamp(shoulderWidth * 0.72, 0.12, 0.55);
  const necklaceDropEstimate = clamp(shoulderWidth * 0.22, 0.04, 0.16);

  let confidence = 0.45;
  if (shoulderWidth > 0.18 && shoulderWidth < 0.85) confidence += 0.2;
  if (nose) confidence += 0.15;
  if (Math.abs(ly - ry) < 0.08) confidence += 0.1;
  confidence = clamp(confidence, 0, 1);

  return {
    center2D,
    center3D: { x: center2D.x, y: center2D.y, z: midShoulder.z },
    neckAxis,
    shoulderAxis,
    palmAxis: neckAxis,
    chestNormal,
    palmNormal: chestNormal,
    headForward,
    armDirection: neckAxis,
    rotationQuaternion,
    neckWidth,
    shoulderWidth,
    collarboneWidth,
    necklaceDropEstimate,
    radiusX: collarboneWidth * 0.45,
    radiusY: neckWidth * 0.55,
    scale: shoulderWidth,
    confidence,
    mirrored: Boolean(opts.mirrored),
    timestamp: performance.now(),
    // legacy
    center: center2D,
    width: collarboneWidth,
    angle: (Math.atan2(shoulderAxis.y, shoulderAxis.x) * 180) / Math.PI,
    frontAngle: (Math.atan2(neckAxis.y, neckAxis.x) * 180) / Math.PI,
    source: "neck3d",
  };
}
