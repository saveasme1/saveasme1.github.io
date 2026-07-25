/**
 * Customer-facing live guide: wrist ellipse / finger ring only (no skeleton).
 * Attaches to tracked anchors in normalized video space, mapped to overlay box.
 */
export class GuideOverlay {
  /**
   * @param {HTMLElement} root — #cameraGuide
   */
  constructor(root) {
    this.root = root;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "ar-guide-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    this.ctx = this.canvas.getContext("2d");
    // Insert above dim, below caption
    const dim = root.querySelector(".guide-dim");
    if (dim?.nextSibling) root.insertBefore(this.canvas, dim.nextSibling);
    else root.appendChild(this.canvas);
    this._status = "idle";
    this._debug = false;
  }

  setDebug(on) {
    this._debug = Boolean(on);
  }

  resize() {
    const r = this.root.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(r.width * dpr));
    const h = Math.max(1, Math.floor(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.canvas.style.width = `${r.width}px`;
    this.canvas.style.height = `${r.height}px`;
  }

  clear() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /**
   * @param {'bracelet'|'ring'|string} type
   * @param {object|null} anchor — WristAnchor3D or FingerAnchor3D (normalized 0..1)
   * @param {string} status
   * @param {object} [debugLm]
   */
  draw(type, anchor, status = "idle", debugLm = null) {
    this.resize();
    this.clear();
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    this._status = status;

    if (this._debug && debugLm) this._drawDebugSkeleton(debugLm, W, H);

    if (!anchor?.center2D && !anchor?.center) return;
    const c = anchor.center2D || anchor.center;
    const cx = c.x * W;
    const cy = c.y * H;

    const stroke =
      status === "stable" || status === "capturing"
        ? "rgba(80, 210, 140, 0.95)"
        : status === "failed"
          ? "rgba(255, 120, 90, 0.9)"
          : status === "detecting" || status === "idle"
            ? "rgba(255,255,255,0.45)"
            : "rgba(255, 140, 70, 0.92)";

    ctx.save();
    ctx.lineWidth = Math.max(2, W * 0.0035);
    ctx.strokeStyle = stroke;
    ctx.setLineDash(status === "stable" ? [] : [8, 7]);
    ctx.lineCap = "round";

    if (type === "bracelet") {
      const rx = Math.max(18, (anchor.radiusX || 0.06) * W * 1.15);
      const ry = Math.max(12, (anchor.radiusY || rx * 0.55 / W) * H * 1.05);
      const ang = ((anchor.angle || 0) * Math.PI) / 180;
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      // soft outer glow when aligning
      if (status !== "stable") {
        ctx.strokeStyle = stroke.replace(/[\d.]+\)$/, "0.25)");
        ctx.lineWidth = ctx.lineWidth * 2.2;
        ctx.stroke();
      }
    } else if (type === "ring") {
      const r = Math.max(10, (anchor.radiusEstimate || anchor.width || 0.03) * W * 0.9);
      const ang = ((anchor.angle || 0) * Math.PI) / 180;
      ctx.translate(cx, cy);
      ctx.rotate(ang + Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.15, r * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      // short direction tick
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.2);
      ctx.lineTo(0, -r * 1.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawDebugSkeleton(lm, W, H) {
    if (!lm?.length) return;
    const { ctx } = this;
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17],
    ];
    ctx.strokeStyle = "rgba(0, 255, 180, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    for (const [a, b] of edges) {
      if (!lm[a] || !lm[b]) continue;
      ctx.beginPath();
      ctx.moveTo(lm[a].x * W, lm[a].y * H);
      ctx.lineTo(lm[b].x * W, lm[b].y * H);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255, 80, 80, 0.8)";
    for (const p of lm) {
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
