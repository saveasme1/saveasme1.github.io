/**
 * Device quality tier for AR rendering.
 */
export function detectQualityTier() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  let glOk = false;
  try {
    const c = document.createElement("canvas");
    glOk = Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (_) {}
  if (!glOk) return "FALLBACK";
  if (mem >= 6 && cores >= 6) return "HIGH";
  if (mem >= 4 && cores >= 4) return "MEDIUM";
  return "LOW";
}

export class QualityManager {
  constructor() {
    this.tier = detectQualityTier();
    this._lowFrames = 0;
  }

  noteFps(fps) {
    if (fps > 0 && fps < 20) this._lowFrames++;
    else this._lowFrames = Math.max(0, this._lowFrames - 1);
    if (this._lowFrames > 45) {
      if (this.tier === "HIGH") this.tier = "MEDIUM";
      else if (this.tier === "MEDIUM") this.tier = "LOW";
      else if (this.tier === "LOW") this.tier = "FALLBACK";
      this._lowFrames = 0;
    }
  }
}
