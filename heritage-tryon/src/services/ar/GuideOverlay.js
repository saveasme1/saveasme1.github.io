/**
 * Customer-facing live guide: wrist ellipse / finger ring / neck curve / ear dots.
 * Skeleton only when debug=true.
 */
export class GuideOverlay {
  constructor(root) {
    this.root = root;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "ar-guide-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    this.ctx = this.canvas.getContext("2d");
    const dim = root.querySelector(".guide-dim");
    if (dim?.nextSibling) root.insertBefore(this.canvas, dim.nextSibling);
    else root.appendChild(this.canvas);
    this._status = "idle";
    this._debug = false;
    this._debugHud = null;
  }

  setDebug(on) {
    this._debug = Boolean(on);
  }

  setDebugHud(stats) {
    this._debugHud = stats;
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

  draw(type, anchor, status = "idle", debugLm = null, extras = {}) {
    this.resize();
    this.clear();
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    this._status = status;

    if (this._debug && debugLm) this._drawDebugSkeleton(debugLm, W, H, type);
    if (this._debug && this._debugHud) this._drawHud(W, H);

    if (!anchor) return;
    const c = anchor.center2D || anchor.center || anchor.attachment2D;
    if (!c) return;
    const cx = c.x * W;
    const cy = c.y * H;

    const stroke =
      status === "stable" || status === "capturing"
        ? "rgba(80, 210, 140, 0.95)"
        : status === "failed" || status === "capture_failed"
          ? "rgba(255, 120, 90, 0.9)"
          : status === "detecting" || status === "idle" || status === "no_hand" || status === "no_face"
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
    } else if (type === "ring") {
      const r = Math.max(10, (anchor.radiusEstimate || anchor.width || 0.03) * W * 0.9);
      const ang = ((anchor.angle || 0) * Math.PI) / 180;
      ctx.translate(cx, cy);
      ctx.rotate(ang + Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.15, r * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.2);
      ctx.lineTo(0, -r * 1.6);
      ctx.stroke();
    } else if (type === "necklace") {
      const pts = extras.curvePoints || anchor.curvePoints;
      if (pts?.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x * W, pts[0].y * H);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * W, pts[i].y * H);
        ctx.stroke();
      } else {
        const rx = Math.max(40, (anchor.collarboneWidth || 0.3) * W * 0.55);
        const ry = Math.max(14, (anchor.necklaceDropEstimate || 0.06) * H * 1.4);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
      // small center marker
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cx, cy + (anchor.necklaceDropEstimate || 0.04) * H * 0.5, 5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === "earring") {
      const r = Math.max(8, (anchor.earScale || anchor.width || 0.04) * W * 0.55);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy + r * 0.2);
      ctx.lineTo(cx, cy + r * 2.2);
      ctx.stroke();
      const other = extras.secondary;
      if (other?.attachment2D || other?.center2D) {
        const o = other.attachment2D || other.center2D;
        const vis = other.visibility ?? 1;
        ctx.globalAlpha = Math.max(0.2, vis);
        ctx.beginPath();
        ctx.arc(o.x * W, o.y * H, r * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();

    // debug: projection cross
    if (this._debug && this._debugHud?.projectionError) {
      const pe = this._debugHud.projectionError;
      ctx.strokeStyle = "rgba(0,255,255,0.9)";
      ctx.lineWidth = 2;
      const px = pe.projected.x * W;
      const py = pe.projected.y * H;
      ctx.beginPath();
      ctx.moveTo(px - 8, py);
      ctx.lineTo(px + 8, py);
      ctx.moveTo(px, py - 8);
      ctx.lineTo(px, py + 8);
      ctx.stroke();
    }
  }

  _drawHud(W, H) {
    const s = this._debugHud || {};
    const lines = [
      `FPS ${s.fps ?? "-"}  render ${s.renderMs?.toFixed?.(1) ?? "-"}ms`,
      `tier ${s.tier || "-"}  GLB ${s.hasGlb ? "yes" : "no"}  tris ${s.triangles ?? "-"}`,
      `err ${(s.projectionError?.pxError * 1000)?.toFixed?.(1) ?? "-"}‰`,
      `product ${s.productId || "-"}`,
    ];
    const { ctx } = this;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(8, 8, 280, 12 + lines.length * 16);
    ctx.fillStyle = "#7CFFB2";
    ctx.font = "12px monospace";
    lines.forEach((t, i) => ctx.fillText(t, 14, 24 + i * 16));
  }

  _drawDebugSkeleton(lm, W, H, type) {
    if (!lm?.length) return;
    const { ctx } = this;
    ctx.strokeStyle = "rgba(0, 255, 180, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    if (type === "bracelet" || type === "ring") {
      const edges = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [9, 10], [10, 11], [11, 12],
        [0, 13], [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20],
        [5, 9], [9, 13], [13, 17],
      ];
      for (const [a, b] of edges) {
        if (!lm[a] || !lm[b]) continue;
        ctx.beginPath();
        ctx.moveTo(lm[a].x * W, lm[a].y * H);
        ctx.lineTo(lm[b].x * W, lm[b].y * H);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "rgba(255, 80, 80, 0.75)";
    for (const p of lm) {
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
