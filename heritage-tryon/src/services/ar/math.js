/**
 * Shared math helpers for AR anchors (no Three.js dependency).
 */

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function len3(v) {
  return Math.hypot(v.x, v.y, v.z || 0) || 1;
}

export function norm3(v) {
  const L = len3(v);
  return { x: v.x / L, y: v.y / L, z: (v.z || 0) / L };
}

export function cross3(a, b) {
  return {
    x: a.y * (b.z || 0) - (a.z || 0) * b.y,
    y: (a.z || 0) * b.x - a.x * (b.z || 0),
    z: a.x * b.y - a.y * b.x,
  };
}

export function dot3(a, b) {
  return a.x * b.x + a.y * b.y + (a.z || 0) * (b.z || 0);
}

/** Build quaternion from orthonormal basis: xRight, yUp, zForward (OpenGL-ish). */
export function quatFromBasis(xAxis, yAxis, zAxis) {
  const m00 = xAxis.x, m01 = yAxis.x, m02 = zAxis.x;
  const m10 = xAxis.y, m11 = yAxis.y, m12 = zAxis.y;
  const m20 = xAxis.z || 0, m21 = yAxis.z || 0, m22 = zAxis.z || 0;
  const tr = m00 + m11 + m22;
  let qw, qx, qy, qz;
  if (tr > 0) {
    const S = Math.sqrt(tr + 1) * 2;
    qw = 0.25 * S;
    qx = (m21 - m12) / S;
    qy = (m02 - m20) / S;
    qz = (m10 - m01) / S;
  } else if (m00 > m11 && m00 > m22) {
    const S = Math.sqrt(1 + m00 - m11 - m22) * 2;
    qw = (m21 - m12) / S;
    qx = 0.25 * S;
    qy = (m01 + m10) / S;
    qz = (m02 + m20) / S;
  } else if (m11 > m22) {
    const S = Math.sqrt(1 + m11 - m00 - m22) * 2;
    qw = (m02 - m20) / S;
    qx = (m01 + m10) / S;
    qy = 0.25 * S;
    qz = (m12 + m21) / S;
  } else {
    const S = Math.sqrt(1 + m22 - m00 - m11) * 2;
    qw = (m10 - m01) / S;
    qx = (m02 + m20) / S;
    qy = (m12 + m21) / S;
    qz = 0.25 * S;
  }
  return normQuat({ x: qx, y: qy, z: qz, w: qw });
}

export function normQuat(q) {
  const L = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / L, y: q.y / L, z: q.z / L, w: q.w / L };
}

export function slerpQuat(a, b, t) {
  let ax = a.x, ay = a.y, az = a.z, aw = a.w;
  let bx = b.x, by = b.y, bz = b.z, bw = b.w;
  let cos = ax * bx + ay * by + az * bz + aw * bw;
  if (cos < 0) {
    bx = -bx; by = -by; bz = -bz; bw = -bw;
    cos = -cos;
  }
  if (cos > 0.9995) {
    return normQuat({
      x: ax + (bx - ax) * t,
      y: ay + (by - ay) * t,
      z: az + (bz - az) * t,
      w: aw + (bw - aw) * t,
    });
  }
  const th = Math.acos(clamp(cos, -1, 1));
  const s = Math.sin(th);
  const w1 = Math.sin((1 - t) * th) / s;
  const w2 = Math.sin(t * th) / s;
  return {
    x: ax * w1 + bx * w2,
    y: ay * w1 + by * w2,
    z: az * w1 + bz * w2,
    w: aw * w1 + bw * w2,
  };
}

export function ema(prev, next, a) {
  if (prev == null || Number.isNaN(prev)) return next;
  return prev * (1 - a) + next * a;
}

export function emaVec2(prev, next, a) {
  if (!prev) return { ...next };
  return { x: ema(prev.x, next.x, a), y: ema(prev.y, next.y, a) };
}

export function emaVec3(prev, next, a) {
  if (!prev) return { ...next };
  return {
    x: ema(prev.x, next.x, a),
    y: ema(prev.y, next.y, a),
    z: ema(prev.z, next.z ?? 0, a),
  };
}
