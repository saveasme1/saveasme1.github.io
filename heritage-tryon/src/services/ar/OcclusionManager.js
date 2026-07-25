/**
 * Depth-only wrist/finger ellipse occluders for Three.js.
 */
export function createWristOccluder(THREE, { radiusX = 0.55, radiusY = 0.4, length = 0.9 } = {}) {
  const geo = new THREE.CylinderGeometry(1, 1, length, 32, 1, true);
  geo.scale(radiusX, 1, radiusY);
  const mat = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

export function createFingerOccluder(THREE, { radius = 0.22, length = 0.7 } = {}) {
  const geo = new THREE.CylinderGeometry(radius, radius * 0.95, length, 24, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  return mesh;
}

export function syncOccluderToWrist(mesh, anchor, worldScale = 1) {
  if (!mesh || !anchor) return;
  const c = anchor.center3D || anchor.center2D || anchor.center;
  mesh.position.set((c.x - 0.5) * worldScale, -(c.y - 0.5) * worldScale, -(c.z || 0) * worldScale);
  const rx = (anchor.radiusX || 0.06) * worldScale * 8;
  const ry = (anchor.radiusY || 0.04) * worldScale * 8;
  mesh.scale.set(rx, worldScale * 0.35, ry);
  if (anchor.rotationQuaternion) {
    const q = anchor.rotationQuaternion;
    mesh.quaternion.set(q.x, q.y, q.z, q.w);
  }
}
