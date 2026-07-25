/**
 * Tracking smoother — EMA + quaternion slerp + jump rejection + hold on dropout.
 */
import { clamp, ema, emaVec2, emaVec3, slerpQuat, normQuat } from "./math.js";

export class TrackingSmoother {
  constructor(opts = {}) {
    this.posAlpha = opts.posAlpha ?? 0.35;
    this.scaleAlpha = opts.scaleAlpha ?? 0.25;
    this.rotAlpha = opts.rotAlpha ?? 0.28;
    this.jumpPx = opts.jumpPx ?? 0.12; // normalized
    this.holdMs = opts.holdMs ?? 220;
    this._wrist = null;
    this._finger = null;
    this._lastOk = 0;
  }

  reset() {
    this._wrist = null;
    this._finger = null;
    this._generic = {};
    this._lastOk = 0;
  }

  smoothWrist(anchor, now = performance.now()) {
    if (!anchor || (anchor.confidence ?? 0) < 0.2) {
      if (this._wrist && now - this._lastOk < this.holdMs) {
        return { ...this._wrist, confidence: (this._wrist.confidence || 0) * 0.85, held: true };
      }
      return null;
    }
    const prev = this._wrist;
    if (prev) {
      const jump = Math.hypot(
        anchor.center2D.x - prev.center2D.x,
        anchor.center2D.y - prev.center2D.y
      );
      if (jump > this.jumpPx) {
        // blend toward new instead of snap
        const t = clamp(this.jumpPx / jump, 0.15, 0.45);
        anchor = {
          ...anchor,
          center2D: {
            x: prev.center2D.x + (anchor.center2D.x - prev.center2D.x) * t,
            y: prev.center2D.y + (anchor.center2D.y - prev.center2D.y) * t,
          },
        };
      }
    }
    const out = {
      ...anchor,
      center2D: emaVec2(prev?.center2D, anchor.center2D, this.posAlpha),
      center3D: emaVec3(prev?.center3D, anchor.center3D, this.posAlpha),
      wristAxis: emaVec3(prev?.wristAxis, anchor.wristAxis, this.posAlpha),
      palmNormal: emaVec3(prev?.palmNormal, anchor.palmNormal, this.posAlpha),
      armDirection: emaVec3(prev?.armDirection, anchor.armDirection, this.posAlpha),
      radiusX: ema(prev?.radiusX, anchor.radiusX, this.scaleAlpha),
      radiusY: ema(prev?.radiusY, anchor.radiusY, this.scaleAlpha),
      scale: ema(prev?.scale, anchor.scale, this.scaleAlpha),
      rotationQuaternion: prev?.rotationQuaternion
        ? slerpQuat(prev.rotationQuaternion, normQuat(anchor.rotationQuaternion), this.rotAlpha)
        : normQuat(anchor.rotationQuaternion),
      confidence: anchor.confidence,
      handedness: anchor.handedness,
      mirrored: anchor.mirrored,
      held: false,
    };
    out.center = out.center2D;
    out.width = out.radiusX * 2.4;
    out.angle = anchor.angle;
    out.frontAngle = anchor.frontAngle;
    this._wrist = out;
    this._lastOk = now;
    return out;
  }

  smoothFinger(anchor, now = performance.now()) {
    if (!anchor || (anchor.confidence ?? 0) < 0.2) {
      if (this._finger && now - this._lastOk < this.holdMs) {
        return { ...this._finger, confidence: (this._finger.confidence || 0) * 0.85, held: true };
      }
      return null;
    }
    const prev = this._finger;
    const out = {
      ...anchor,
      center2D: emaVec2(prev?.center2D, anchor.center2D, this.posAlpha),
      center3D: emaVec3(prev?.center3D, anchor.center3D, this.posAlpha),
      direction: emaVec3(prev?.direction, anchor.direction, this.posAlpha),
      surfaceNormal: emaVec3(prev?.surfaceNormal, anchor.surfaceNormal, this.posAlpha),
      radiusEstimate: ema(prev?.radiusEstimate, anchor.radiusEstimate, this.scaleAlpha),
      scale: ema(prev?.scale, anchor.scale, this.scaleAlpha),
      rotationQuaternion: prev?.rotationQuaternion
        ? slerpQuat(prev.rotationQuaternion, normQuat(anchor.rotationQuaternion), this.rotAlpha)
        : normQuat(anchor.rotationQuaternion),
      confidence: anchor.confidence,
      held: false,
    };
    out.center = out.center2D;
    out.width = out.radiusEstimate * 2;
    out.angle = anchor.angle;
    out.frontAngle = anchor.frontAngle;
    out.finger = anchor.finger;
    this._finger = out;
    this._lastOk = now;
    return out;
  }

  /** Neck / ear / generic anchor with center2D */
  smoothGeneric(key, anchor, now = performance.now()) {
    if (!this._generic) this._generic = {};
    if (!anchor || (anchor.confidence ?? 0) < 0.2) {
      const prev = this._generic[key];
      if (prev && now - this._lastOk < this.holdMs) {
        return { ...prev, confidence: (prev.confidence || 0) * 0.85, held: true };
      }
      return null;
    }
    const prev = this._generic[key];
    const c2 = anchor.center2D || anchor.attachment2D || anchor.center;
    const prevC = prev?.center2D || prev?.attachment2D;
    const center2D = emaVec2(prevC, c2, this.posAlpha);
    const out = {
      ...anchor,
      center2D,
      attachment2D: center2D,
      center3D: emaVec3(prev?.center3D || prev?.attachment3D, anchor.center3D || anchor.attachment3D, this.posAlpha),
      scale: ema(prev?.scale || prev?.earScale || prev?.shoulderWidth, anchor.scale || anchor.earScale || anchor.shoulderWidth, this.scaleAlpha),
      rotationQuaternion: prev?.rotationQuaternion && anchor.rotationQuaternion
        ? slerpQuat(prev.rotationQuaternion, normQuat(anchor.rotationQuaternion), this.rotAlpha)
        : anchor.rotationQuaternion
          ? normQuat(anchor.rotationQuaternion)
          : prev?.rotationQuaternion,
      confidence: anchor.confidence,
      visibility: anchor.visibility,
      held: false,
    };
    out.center = center2D;
    out.attachment2D = center2D;
    if (anchor.earScale != null) out.earScale = ema(prev?.earScale, anchor.earScale, this.scaleAlpha);
    if (anchor.shoulderWidth != null) out.shoulderWidth = ema(prev?.shoulderWidth, anchor.shoulderWidth, this.scaleAlpha);
    this._generic[key] = out;
    this._lastOk = now;
    return out;
  }
}
