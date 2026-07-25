/**
 * Real-device / debug performance harness with rolling window + JSON export.
 */
export class PerfHarness {
  constructor(windowMs = 45000) {
    this.windowMs = windowMs;
    this.samples = [];
    this.counters = {
      trackingLoss: 0,
      quatFlipReject: 0,
      frames: 0,
    };
    this.meta = {
      startedAt: new Date().toISOString(),
      browser: typeof navigator !== "undefined" ? navigator.userAgent : "",
      dpr: typeof window !== "undefined" ? window.devicePixelRatio : 1,
    };
    this._last = null;
    this._projErrors = [];
  }

  noteFrame(sample) {
    const now = performance.now();
    const row = {
      t: now,
      fps: sample.fps ?? null,
      frameMs: sample.frameMs ?? null,
      handMs: sample.handMs ?? null,
      faceMs: sample.faceMs ?? null,
      poseMs: sample.poseMs ?? null,
      anchorMs: sample.anchorMs ?? null,
      smoothMs: sample.smoothMs ?? null,
      renderMs: sample.renderMs ?? null,
      segMs: sample.segMs ?? null,
      projectionErrorPx: sample.projectionErrorPx ?? null,
      tier: sample.tier ?? null,
      assetState: sample.assetState ?? null,
      mode: sample.mode ?? null,
      cameraW: sample.cameraW ?? null,
      cameraH: sample.cameraH ?? null,
    };
    this.samples.push(row);
    this.counters.frames += 1;
    if (sample.trackingLoss) this.counters.trackingLoss += 1;
    if (sample.quatFlipReject) this.counters.quatFlipReject += 1;
    if (row.projectionErrorPx != null) this._projErrors.push(row.projectionErrorPx);
    this._last = row;
    const cutoff = now - this.windowMs;
    while (this.samples.length && this.samples[0].t < cutoff) this.samples.shift();
    while (this._projErrors.length > 300) this._projErrors.shift();
  }

  _avg(arr, key) {
    const vals = arr.map((s) => s[key]).filter((v) => v != null && !Number.isNaN(v));
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  _min(arr, key) {
    const vals = arr.map((s) => s[key]).filter((v) => v != null && !Number.isNaN(v));
    if (!vals.length) return null;
    return Math.min(...vals);
  }

  _p95(arr, key) {
    const vals = arr.map((s) => s[key]).filter((v) => v != null && !Number.isNaN(v)).sort((a, b) => a - b);
    if (!vals.length) return null;
    return vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.95))];
  }

  summarize() {
    const s = this.samples;
    const proj = this._projErrors;
    return {
      windowMs: this.windowMs,
      sampleCount: s.length,
      avgFps: this._avg(s, "fps"),
      minFps: this._min(s, "fps"),
      p95FrameMs: this._p95(s, "frameMs"),
      avgHandMs: this._avg(s, "handMs"),
      avgFaceMs: this._avg(s, "faceMs"),
      avgPoseMs: this._avg(s, "poseMs"),
      avgAnchorMs: this._avg(s, "anchorMs"),
      avgSmoothMs: this._avg(s, "smoothMs"),
      avgRenderMs: this._avg(s, "renderMs"),
      avgSegMs: this._avg(s, "segMs"),
      avgProjectionErrorPx: proj.length ? proj.reduce((a, b) => a + b, 0) / proj.length : null,
      maxProjectionErrorPx: proj.length ? Math.max(...proj) : null,
      trackingLossCount: this.counters.trackingLoss,
      quatFlipRejectCount: this.counters.quatFlipReject,
      last: this._last,
      meta: this.meta,
      exportedAt: new Date().toISOString(),
    };
  }

  exportJson(extra = {}) {
    const report = {
      ...this.summarize(),
      ...extra,
      glInfo: this._glInfo(),
    };
    return JSON.stringify(report, null, 2);
  }

  download(filename = `heritage-ar-debug-${Date.now()}.json`, extra = {}) {
    const blob = new Blob([this.exportJson(extra)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  _glInfo() {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2") || c.getContext("webgl");
      if (!gl) return null;
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        webgl2: Boolean(c.getContext("webgl2")),
      };
    } catch (_) {
      return null;
    }
  }
}
