/**
 * FingerAnchor3D for ring placement.
 */
import { norm3, cross3, quatFromBasis, clamp } from "./math.js";

const FINGER = {
  index: { mcp: 5, pip: 6, tip: 8, neighbors: [9] },
  middle: { mcp: 9, pip: 10, tip: 12, neighbors: [5, 13] },
  ring: { mcp: 13, pip: 14, tip: 16, neighbors: [9, 17] },
  pinky: { mcp: 17, pip: 18, tip: 20, neighbors: [13] },
};

export function estimateFingerAnchor3D(lm, finger = "ring", opts = {}) {
  const spec = FINGER[finger] || FINGER.ring;
  if (!lm?.[spec.mcp] || !lm[spec.tip]) return null;
  const mcp = lm[spec.mcp];
  const pip = lm[spec.pip] || mcp;
  const tip = lm[spec.tip];
  const mid = {
    x: (mcp.x + pip.x) * 0.5,
    y: (mcp.y + pip.y) * 0.5,
    z: ((mcp.z || 0) + (pip.z || 0)) * 0.5,
  };
  const direction = norm3({
    x: tip.x - mcp.x,
    y: tip.y - mcp.y,
    z: (tip.z || 0) - (mcp.z || 0),
  });
  // Prefer palm normal from whole hand if available
  let surfaceNormal = { x: 0, y: 0, z: -1 };
  if (lm[0] && lm[5] && lm[17]) {
    const palmX = norm3({ x: lm[17].x - lm[5].x, y: lm[17].y - lm[5].y, z: 0 });
    const palmY = norm3({ x: lm[9].x - lm[0].x, y: lm[9].y - lm[0].y, z: 0 });
    surfaceNormal = norm3(cross3(palmX, palmY));
    if (surfaceNormal.z > 0) surfaceNormal = { x: -surfaceNormal.x, y: -surfaceNormal.y, z: -surfaceNormal.z };
  }
  const across = norm3(cross3(direction, surfaceNormal));
  const yAxis = norm3(cross3(across, direction));
  const rotationQuaternion = quatFromBasis(across, yAxis, direction);

  let fingerW = Math.hypot(mcp.x - pip.x, mcp.y - pip.y) * 0.4;
  for (const ni of spec.neighbors) {
    const n = lm[ni];
    if (n) fingerW = Math.max(fingerW, Math.hypot(mcp.x - n.x, mcp.y - n.y) * 0.48);
  }
  const radiusEstimate = clamp(fingerW * 0.5, 0.012, 0.05);
  const jointBend = Math.acos(
    clamp(
      ((pip.x - mcp.x) * (tip.x - pip.x) + (pip.y - mcp.y) * (tip.y - pip.y)) /
        ((Math.hypot(pip.x - mcp.x, pip.y - mcp.y) || 1e-6) *
          (Math.hypot(tip.x - pip.x, tip.y - pip.y) || 1e-6)),
      -1,
      1
    )
  );

  let confidence = 0.5;
  if (tip.y < mcp.y) confidence += 0.15;
  if (fingerW > 0.015) confidence += 0.15;
  if (jointBend < 0.7) confidence += 0.1;
  confidence = clamp(confidence, 0, 1);

  return {
    finger,
    center2D: { x: mid.x, y: mid.y },
    center3D: { x: mid.x, y: mid.y, z: mid.z },
    direction,
    surfaceNormal,
    rotationQuaternion,
    radiusEstimate,
    jointBend,
    scale: fingerW,
    confidence,
    // legacy
    center: { x: mid.x, y: mid.y },
    width: fingerW,
    angle: (Math.atan2(direction.y, direction.x) * 180) / Math.PI,
    frontAngle: (Math.atan2(direction.y, direction.x) * 180) / Math.PI - 90,
    source: "finger3d",
  };
}
