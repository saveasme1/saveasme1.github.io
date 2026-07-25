/**
 * WristAnchor3D from MediaPipe hand (+ optional pose elbow).
 * Landmarks are normalized 0..1 image space unless worldLandmarks provided.
 */
import { norm3, cross3, quatFromBasis, clamp } from "./math.js";

/**
 * @param {Array<{x:number,y:number,z?:number}>} lm — hand landmarks (image)
 * @param {{ elbow?: {x:number,y:number}, handedness?: string, mirrored?: boolean, world?: Array }} opts
 */
export function estimateWristAnchor3D(lm, opts = {}) {
  if (!lm?.[0] || !lm[5] || !lm[9] || !lm[17]) return null;
  const wrist = lm[0];
  const indexMcp = lm[5];
  const midMcp = lm[9];
  const pinkyMcp = lm[17];
  const thumbMcp = lm[2] || lm[1];

  const palmX = norm3({
    x: pinkyMcp.x - indexMcp.x,
    y: pinkyMcp.y - indexMcp.y,
    z: (pinkyMcp.z || 0) - (indexMcp.z || 0),
  });
  const palmY = norm3({
    x: midMcp.x - wrist.x,
    y: midMcp.y - wrist.y,
    z: (midMcp.z || 0) - (wrist.z || 0),
  });
  let palmNormal = norm3(cross3(palmX, palmY));
  // Ensure normal roughly faces camera (−Z in image-ish) for dorsum preference
  if (palmNormal.z > 0.15) {
    palmNormal = { x: -palmNormal.x, y: -palmNormal.y, z: -palmNormal.z };
  }

  let armDirection = { x: -palmY.x, y: -palmY.y, z: -(palmY.z || 0) };
  if (opts.elbow) {
    armDirection = norm3({
      x: wrist.x - opts.elbow.x,
      y: wrist.y - opts.elbow.y,
      z: 0,
    });
  }

  const palmSpan = Math.hypot(pinkyMcp.x - indexMcp.x, pinkyMcp.y - indexMcp.y);
  const handLen = Math.hypot(midMcp.x - wrist.x, midMcp.y - wrist.y);
  const radiusX = clamp(palmSpan * 0.42, 0.035, 0.14);
  const radiusY = clamp(radiusX * 0.72, 0.025, 0.11);

  const ux = armDirection.x;
  const uy = armDirection.y;
  const center2D = {
    x: wrist.x + ux * handLen * 0.1,
    y: wrist.y + uy * handLen * 0.1,
  };

  // Local depth from landmark z if present
  const zAvg = ((wrist.z || 0) + (midMcp.z || 0)) * 0.5;
  const center3D = { x: center2D.x, y: center2D.y, z: zAvg };

  const wristAxis = palmX; // across wrist
  const zAxis = palmNormal;
  const yAxis = norm3(cross3(zAxis, wristAxis));
  const xAxis = norm3(cross3(yAxis, zAxis));
  const rotationQuaternion = quatFromBasis(xAxis, yAxis, zAxis);

  const tip = lm[12] || midMcp;
  const dorsumLikely = tip.y < wrist.y + 0.05;
  let confidence = 0.55;
  if (palmSpan > 0.05 && palmSpan < 0.4) confidence += 0.15;
  if (handLen > 0.08) confidence += 0.1;
  if (dorsumLikely) confidence += 0.1;
  if (thumbMcp) confidence += 0.05;
  confidence = clamp(confidence, 0, 1);

  return {
    center2D,
    center3D,
    rotationQuaternion,
    wristAxis,
    palmNormal,
    armDirection,
    radiusX,
    radiusY,
    circumferenceEstimate: Math.PI * (3 * (radiusX + radiusY) - Math.sqrt((3 * radiusX + radiusY) * (radiusX + 3 * radiusY))),
    scale: palmSpan,
    confidence,
    handedness: opts.handedness === "Right" ? "Right" : "Left",
    mirrored: Boolean(opts.mirrored),
    // legacy 2D target compatibility
    center: center2D,
    width: radiusX * 2.4,
    angle: (Math.atan2(wristAxis.y, wristAxis.x) * 180) / Math.PI,
    frontAngle: (Math.atan2(palmY.y, palmY.x) * 180) / Math.PI,
    source: "hand3d",
  };
}
