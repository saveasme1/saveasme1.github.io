/**
 * Improved 2.5D bracelet/ring compose — product PNG preserved, front/back split, contact shadow.
 * Used when GLB is unavailable. Does NOT invent Love studs or morph SKU geometry.
 */
import { clamp } from "./math.js";

function jewelryBounds(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width, minY = height, maxX = 0, maxY = 0, found = false;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 400));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3] > 28) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return { x: 0, y: 0, w: width, h: height };
  return {
    x: Math.max(0, minX - step),
    y: Math.max(0, minY - step),
    w: Math.min(width, maxX + step) - Math.max(0, minX - step) + 1,
    h: Math.min(height, maxY + step) - Math.max(0, minY - step) + 1,
  };
}

function cropJewelry(jewelryCanvas) {
  const b = jewelryBounds(jewelryCanvas);
  const c = document.createElement("canvas");
  c.width = Math.max(1, b.w);
  c.height = Math.max(1, b.h);
  c.getContext("2d").drawImage(jewelryCanvas, b.x, b.y, b.w, b.h, 0, 0, c.width, c.height);
  return c;
}

function resolveCenter(anchor, W, H) {
  const c = anchor.center2D || anchor.center || { x: 0.5, y: 0.5 };
  return {
    cx: c.x <= 1.5 ? c.x * W : c.x,
    cy: c.y <= 1.5 ? c.y * H : c.y,
  };
}

/**
 * Bracelet: back arc (dim) → wrist occlusion from body → front arc + contact shadow.
 * Scale clamped — no rubber-band stretch.
 */
export function composeBracelet25D(bodyCanvas, jewelryCanvas, anchor) {
  const out = document.createElement("canvas");
  out.width = bodyCanvas.width;
  out.height = bodyCanvas.height;
  const ctx = out.getContext("2d");
  ctx.drawImage(bodyCanvas, 0, 0);

  const crop = cropJewelry(jewelryCanvas);
  const W = out.width;
  const H = out.height;
  const { cx, cy } = resolveCenter(anchor, W, H);
  const rxNorm = anchor.radiusX || (anchor.width ? anchor.width * 0.42 : 0.06);
  const ryNorm = anchor.radiusY || rxNorm * 0.72;
  const rx = Math.max(18, (rxNorm <= 1.5 ? rxNorm * W : rxNorm) * 1.15);
  const ry = Math.max(12, (ryNorm <= 1.5 ? ryNorm * H : ryNorm) * 0.95);
  const plane = ((anchor.angle || 0) * Math.PI) / 180;
  const bandH = clamp(rx * 0.28, 10, rx * 0.4);
  const stampW = rx * 2.05;
  const aspect = crop.height / Math.max(1, crop.width);
  let stampH = stampW * aspect * 0.35;
  stampH = clamp(stampH, bandH * 0.85, bandH * 1.35);

  // Contact shadow (under product)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane);
  ctx.fillStyle = "rgba(0,0,0,0.26)";
  ctx.beginPath();
  ctx.ellipse(1, 3, rx * 0.92, ry * 0.68, 0, 0, Math.PI * 2);
  ctx.fill();

  // BACK arc — dim product behind wrist
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI);
  ctx.clip();
  ctx.globalAlpha = 0.2;
  ctx.drawImage(crop, -stampW / 2, -stampH / 2, stampW, stampH);
  ctx.restore();
  ctx.restore();

  // Wrist occlusion: redraw body inside ellipse
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.82, ry * 0.78, plane, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(bodyCanvas, 0, 0);
  ctx.restore();

  // FRONT arc — product identity
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 1.02, ry * 1.02, 0, Math.PI, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = 0.97;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(crop, -stampW / 2, -stampH * 0.85, stampW, stampH);
  ctx.strokeStyle = "rgba(255, 230, 180, 0.32)";
  ctx.lineWidth = Math.max(2, rx * 0.035);
  ctx.beginPath();
  ctx.ellipse(0, -ry * 0.12, rx * 0.88, ry * 0.5, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.restore();

  return out;
}

/** Ring 2.5D: back crescent → finger gap → front band from product crop. */
export function composeRing25D(bodyCanvas, jewelryCanvas, anchor) {
  const out = document.createElement("canvas");
  out.width = bodyCanvas.width;
  out.height = bodyCanvas.height;
  const ctx = out.getContext("2d");
  ctx.drawImage(bodyCanvas, 0, 0);
  const crop = cropJewelry(jewelryCanvas);
  const W = out.width;
  const { cx, cy } = resolveCenter(anchor, W, out.height);
  const rEst = anchor.radiusEstimate || anchor.width || 0.03;
  const diameter = Math.max(10, (rEst <= 1.5 ? rEst * W : rEst) * 2);
  const fingerRad = ((anchor.angle || 0) * Math.PI) / 180;
  const bandAngle = fingerRad + Math.PI / 2;
  const size = diameter * 1.15;
  const aspect = crop.height / Math.max(1, crop.width);
  const bh = clamp(size * aspect, size * 0.35, size * 0.8);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(bandAngle);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(1, 2, size * 0.46, bh * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  // back (dim)
  ctx.save();
  ctx.beginPath();
  ctx.rect(-size / 2, 0, size, bh);
  ctx.clip();
  ctx.globalAlpha = 0.32;
  ctx.drawImage(crop, -size / 2, -bh * 0.1, size, bh);
  ctx.restore();

  // finger occlusion strip
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000";
  ctx.fillRect(-size * 0.14, -bh * 0.55, size * 0.28, bh * 1.1);
  ctx.globalCompositeOperation = "source-over";

  // front
  ctx.save();
  ctx.beginPath();
  ctx.rect(-size / 2, -bh, size, bh * 0.92);
  ctx.clip();
  ctx.globalAlpha = 0.98;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(crop, -size / 2, -bh * 0.82, size, bh);
  ctx.restore();
  ctx.restore();
  return out;
}
