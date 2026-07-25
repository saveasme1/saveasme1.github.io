/**
 * Working necklace chain path: Catmull-Rom control points → sampled curve → tube/segments.
 * Pendant remains a separate rigid transform at the curve midpoint.
 */
import { clamp } from "./math.js";

/**
 * Build collarbone control points from NeckAnchor3D + metadata.
 */
export function buildNecklaceControlPoints(anchor, meta = {}) {
  if (!anchor?.center2D) return null;
  const dropNorm = meta.dropMm != null
    ? clamp(meta.dropMm / 900, 0.03, 0.18)
    : clamp(anchor.necklaceDropEstimate || 0.06, 0.03, 0.16);
  const half = clamp((anchor.collarboneWidth || anchor.shoulderWidth * 0.7 || 0.28) * 0.5, 0.1, 0.38);
  const cx = anchor.center2D.x;
  const cy = anchor.center2D.y;
  const tilt = (anchor.shoulderAxis?.y || 0) * 0.08;

  return [
    { x: cx - half * 0.95, y: cy - 0.02 + tilt, z: 0.02 }, // left neck base
    { x: cx - half * 0.55, y: cy + dropNorm * 0.25 + tilt * 0.5, z: 0 }, // left collarbone
    { x: cx, y: cy + dropNorm, z: -0.01 }, // center drop (pendant)
    { x: cx + half * 0.55, y: cy + dropNorm * 0.25 - tilt * 0.5, z: 0 }, // right collarbone
    { x: cx + half * 0.95, y: cy - 0.02 - tilt, z: 0.02 }, // right neck base
  ];
}

/** Catmull-Rom interpolate */
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    z: 0.5 * ((2 * (p1.z || 0)) + (-(p0.z || 0) + (p2.z || 0)) * t + (2 * (p0.z || 0) - 5 * (p1.z || 0) + 4 * (p2.z || 0) - (p3.z || 0)) * t2 + (-(p0.z || 0) + 3 * (p1.z || 0) - 3 * (p2.z || 0) + (p3.z || 0)) * t3),
  };
}

export function sampleNecklaceCurve(controls, segments = 24) {
  if (!controls || controls.length < 2) return [];
  const pts = [];
  const n = controls.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = controls[Math.max(0, i - 1)];
    const p1 = controls[i];
    const p2 = controls[i + 1];
    const p3 = controls[Math.min(n - 1, i + 2)];
    const steps = i === n - 2 ? segments : segments;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      pts.push(catmullRom(p0, p1, p2, p3, t));
    }
  }
  pts.push(controls[n - 1]);
  return pts;
}

/**
 * Fit result with curve + rigid pendant attachment (no pendant mesh warp).
 */
export function fitNecklaceWithChain(anchor, meta = {}, quality = "MEDIUM") {
  const controls = buildNecklaceControlPoints(anchor, meta);
  if (!controls) return null;
  const seg =
    quality === "HIGH" ? 32 : quality === "LOW" || quality === "FALLBACK" ? 12 : 20;
  const curvePoints = sampleNecklaceCurve(controls, Math.ceil(seg / (controls.length - 1)));
  const mid = controls[2];
  const [lo, hi] = meta.allowedScaleRange || [0.94, 1.06];
  const scale = Math.min(hi, Math.max(lo, meta.defaultScale || 1));

  // gravity: pendant hangs slightly below mid with restrained pitch
  const pendant = {
    center2D: { x: mid.x, y: mid.y },
    center3D: { x: mid.x, y: mid.y, z: mid.z || 0 },
    rotationHint: {
      // keep pendant upright relative to gravity (screen +Y down in image space)
      pitch: 0,
      yaw: (anchor.shoulderAxis?.y || 0) * 0.4,
    },
  };

  return {
    ...anchor,
    center2D: pendant.center2D,
    center: pendant.center2D,
    center3D: pendant.center3D,
    productScale: scale,
    sizeFit: (anchor.shoulderWidth || 0) > 0.15,
    deformationPolicy: "chain-path-only",
    controlPoints: controls,
    curvePoints,
    pendant,
    chainSegments: seg,
  };
}

/**
 * Build / update a Three.js chain tube from normalized curve points.
 * Pendant mesh is NOT deformed — only positioned at pendant.center.
 */
export function syncNecklaceChainMesh(THREE, group, fitted, worldMapper, opts = {}) {
  if (!group || !fitted?.curvePoints?.length || !worldMapper) return null;
  const radius = opts.radius ?? 0.008;
  const tubular = Math.max(8, fitted.chainSegments || 16);

  const worldPts = fitted.curvePoints.map((p) => {
    const w = worldMapper(p.x, p.y, 1.25 + (p.z || 0) * 0.2);
    return new THREE.Vector3(w.x, w.y, w.z);
  });

  let curve;
  try {
    curve = new THREE.CatmullRomCurve3(worldPts, false, "catmullrom", 0.35);
  } catch (_) {
    return null;
  }

  const geo = new THREE.TubeGeometry(curve, tubular, radius, 6, false);
  let mesh = group.userData.chainMesh;
  if (mesh) {
    group.remove(mesh);
    mesh.geometry?.dispose();
    if (mesh.material && !opts.keepMaterial) {
      /* keep material from previous if shared */
    }
  }
  const mat =
    opts.material ||
    new THREE.MeshPhysicalMaterial({
      color: 0xd4af37,
      metalness: 0.92,
      roughness: 0.28,
      clearcoat: 0.4,
    });
  mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  group.add(mesh);
  group.userData.chainMesh = mesh;
  return mesh;
}
