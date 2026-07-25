/**
 * Lightweight damped pendulum for drop/dangle earrings.
 * Studs / huggies / ear cuffs → no swing (identity).
 */
import { clamp } from "./math.js";

const SWING_TYPES = new Set(["drop", "dangle", "chandelier"]);

export class EarringPhysics {
  constructor() {
    this.angleX = 0;
    this.angleZ = 0;
    this.velX = 0;
    this.velZ = 0;
    this._prevYaw = null;
    this._prevPitch = null;
    this._prevT = 0;
    this.maxAngle = 0.22; // rad ~12.5deg
    this.damping = 0.86;
    this.stiffness = 18;
    this.frozen = false;
  }

  reset() {
    this.angleX = 0;
    this.angleZ = 0;
    this.velX = 0;
    this.velZ = 0;
    this._prevYaw = null;
    this._prevPitch = null;
    this.frozen = false;
  }

  /**
   * @param {object} anchor EarAnchor3D
   * @param {object} meta product metadata
   * @param {number} now performance.now()
   */
  update(anchor, meta = {}, now = performance.now()) {
    const type = meta.type || "drop";
    if (!meta.swingEnabled && !SWING_TYPES.has(type)) {
      this.angleX = 0;
      this.angleZ = 0;
      this.velX = 0;
      this.velZ = 0;
      return this.pose();
    }
    if (this.frozen) return this.pose();

    const dt = Math.min(0.05, Math.max(0.008, (now - (this._prevT || now)) / 1000));
    this._prevT = now;

    const yaw = anchor.yaw || 0;
    const pitch = 0;
    const dYaw = this._prevYaw == null ? 0 : yaw - this._prevYaw;
    const dPitch = this._prevPitch == null ? 0 : pitch - this._prevPitch;
    this._prevYaw = yaw;
    this._prevPitch = pitch;

    // gravity spring toward 0 + impulse from head angular velocity
    const targetX = 0;
    const targetZ = 0;
    const forceX = (targetX - this.angleX) * this.stiffness - dPitch * 2.5;
    const forceZ = (targetZ - this.angleZ) * this.stiffness - dYaw * 3.2;
    this.velX = (this.velX + forceX * dt) * this.damping;
    this.velZ = (this.velZ + forceZ * dt) * this.damping;
    this.velX = clamp(this.velX, -1.5, 1.5);
    this.velZ = clamp(this.velZ, -1.5, 1.5);
    this.angleX = clamp(this.angleX + this.velX * dt, -this.maxAngle, this.maxAngle);
    this.angleZ = clamp(this.angleZ + this.velZ * dt, -this.maxAngle, this.maxAngle);
    return this.pose();
  }

  /** Freeze for high-res save */
  freeze() {
    this.frozen = true;
    this.velX = 0;
    this.velZ = 0;
    // settle slightly toward gravity rest
    this.angleX *= 0.4;
    this.angleZ *= 0.4;
    return this.pose();
  }

  pose() {
    return {
      angleX: this.angleX,
      angleZ: this.angleZ,
      quaternionDelta: {
        // approximate small-angle quaternion (x,y,z,w)
        x: this.angleX * 0.5,
        y: 0,
        z: this.angleZ * 0.5,
        w: 1,
      },
    };
  }
}
