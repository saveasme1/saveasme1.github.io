/**
 * Phase 1 — soft part occlusion: body pixels over jewelry in wear contact zones.
 */
function sampleBody(bodyCtx, x, y, W, H) {
  const ix = Math.max(0, Math.min(W - 1, Math.round(x)));
  const iy = Math.max(0, Math.min(H - 1, Math.round(y)));
  return bodyCtx.getImageData(ix, iy, 1, 1).data;
}

function softEllipseMask(rx, ry, feather) {
  const w = Math.ceil(rx * 2 + feather * 2);
  const h = Math.ceil(ry * 2 + feather * 2);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(rx, ry) * 0.35, w / 2, h / 2, Math.max(rx, ry) + feather);
  g.addColorStop(0, "rgba(0,0,0,0.92)");
  g.addColorStop(0.55, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/**
 * Paint soft body patches over composed jewelry where contact occlusion is expected.
 * @param {HTMLCanvasElement} composed
 * @param {HTMLCanvasElement} bodyCanvas
 * @param {object} target pixel or normalized target
 * @param {string} mode
 */
export function applyPartOcclusion(composed, bodyCanvas, target, mode = "bracelet") {
  if (!composed || !bodyCanvas || !target) return composed;
  const W = composed.width;
  const H = composed.height;
  const c = target.center || target.center2D;
  if (!c) return composed;

  const cx = c.x <= 1.5 && Math.max(c.x, c.y) <= 1.5 ? c.x * W : c.x;
  const cy = c.y <= 1.5 && Math.max(c.x, c.y) <= 1.5 ? c.y * H : c.y;

  let rx;
  let ry;
  let ox = 0;
  let oy = 0;
  if (mode === "bracelet") {
    const rw = target.width != null ? (target.width <= 1.5 ? target.width * W : target.width) : W * 0.22;
    rx = rw * 0.28;
    ry = rw * 0.38;
    oy = ry * 0.05;
  } else if (mode === "ring") {
    const rw = target.width != null ? (target.width <= 1.5 ? target.width * W : target.width) : W * 0.08;
    rx = rw * 0.22;
    ry = rw * 0.45;
  } else if (mode === "earring") {
    rx = Math.max(6, W * 0.012);
    ry = Math.max(10, H * 0.028);
    oy = ry * 0.15;
  } else if (mode === "necklace") {
    rx = Math.max(40, W * 0.16);
    ry = Math.max(10, H * 0.035);
    oy = -ry * 0.6;
  } else {
    return composed;
  }

  const feather = Math.max(4, Math.min(rx, ry) * 0.45);
  const mask = softEllipseMask(rx, ry, feather);
  const bodyCtx = bodyCanvas.getContext("2d", { willReadFrequently: true });
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const octx = out.getContext("2d");
  octx.drawImage(composed, 0, 0);

  // Stamp body under soft mask at contact zone (destination-in style via clip)
  const patch = document.createElement("canvas");
  patch.width = mask.width;
  patch.height = mask.height;
  const pctx = patch.getContext("2d");
  const dx = cx + ox - mask.width / 2;
  const dy = cy + oy - mask.height / 2;
  pctx.drawImage(bodyCanvas, dx, dy, mask.width, mask.height, 0, 0, mask.width, mask.height);
  pctx.globalCompositeOperation = "destination-in";
  pctx.drawImage(mask, 0, 0);
  octx.drawImage(patch, dx, dy);
  return out;
}

/** Average nearby skin luminance for harmonize hints. */
export function sampleSkinTone(bodyCanvas, target, mode = "bracelet") {
  if (!bodyCanvas || !target) return null;
  const W = bodyCanvas.width;
  const H = bodyCanvas.height;
  const c = target.center || target.center2D;
  if (!c) return null;
  const cx = c.x <= 1.5 && Math.max(c.x, c.y) <= 1.5 ? c.x * W : c.x;
  const cy = c.y <= 1.5 && Math.max(c.x, c.y) <= 1.5 ? c.y * H : c.y;
  const ctx = bodyCanvas.getContext("2d", { willReadFrequently: true });
  const offsets =
    mode === "earring"
      ? [[-18, 0], [18, 0], [0, 12]]
      : mode === "necklace"
        ? [[0, 24], [-40, 20], [40, 20]]
        : [[0, 16], [-20, 8], [20, 8]];
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const [ox, oy] of offsets) {
    const d = sampleBody(ctx, cx + ox, cy + oy, W, H);
    if (d[3] < 8) continue;
    r += d[0];
    g += d[1];
    b += d[2];
    n += 1;
  }
  if (!n) return null;
  return { r: r / n, g: g / n, b: b / n, lum: (0.2126 * r + 0.7152 * g + 0.0722 * b) / n / 255 };
}
