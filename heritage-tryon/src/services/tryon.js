/**
 * Jewelry placement — cylindrical bracelet wrap (not flat sticker).
 * Uses MediaPipe wrist geometry + metal texture from rembg cutout.
 */

function canvasFromImage(img) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  c.getContext("2d").drawImage(img, 0, 0);
  return c;
}

function jewelryBounds(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width, minY = height, maxX = 0, maxY = 0, found = false;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 500));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3] > 24) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return { x: 0, y: 0, w: width, h: height };
  const bw = Math.min(width - 1, maxX + step) - Math.max(0, minX - step) + 1;
  const bh = Math.min(height - 1, maxY + step) - Math.max(0, minY - step) + 1;
  // Watermark wipe sometimes nukes too much — fall back to full canvas
  if (bw * bh < width * height * 0.015) return { x: 0, y: 0, w: width, h: height };
  return {
    x: Math.max(0, minX - step),
    y: Math.max(0, minY - step),
    w: bw,
    h: bh,
  };
}

/** Kill white/halo fringe left by rembg. */
export function despillCanvas(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width: w, height: h } = canvas;
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const alphaAt = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    return d[(y * w + x) * 4 + 3];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = d[i + 3];
      if (a === 0) continue;
      if (a < 40) {
        d[i + 3] = 0;
        continue;
      }
      const nearClear =
        alphaAt(x - 1, y) < 20 ||
        alphaAt(x + 1, y) < 20 ||
        alphaAt(x, y - 1) < 20 ||
        alphaAt(x, y + 1) < 20;
      const bright = d[i] > 228 && d[i + 1] > 228 && d[i + 2] > 220;
      if (nearClear && bright) d[i + 3] = 0;
      else if (a > 200) d[i + 3] = 255;
    }
  }
  ctx.putImageData(id, 0, 0);
  return canvas;
}

function minWidthForType(outW, type) {
  if (type === "bracelet") return outW * 0.22;
  if (type === "necklace") return outW * 0.16;
  if (type === "earring") return outW * 0.07;
  if (type === "ring") return outW * 0.03;
  return outW * 0.085;
}

/**
 * Place ring as foreshortened band on finger (not wrist-cylinder / Clash 3D).
 * Product photo is scaled to finger diameter and squashed along finger axis.
 */
function placeRingOnFinger(layerCtx, crop, target, outW) {
  if (!target?.center) return;
  const diameter = Math.max(
    minWidthForType(outW, "ring"),
    Math.min(target.width || outW * 0.05, outW * 0.1)
  );
  const fingerRad = ((target.angle || 0) * Math.PI) / 180;
  // Ring sits across the finger → rotate so local X is perpendicular to finger
  const bandAngle = fingerRad + Math.PI / 2;
  const size = diameter * 1.15;
  layerCtx.save();
  layerCtx.translate(target.center.x, target.center.y);
  layerCtx.rotate(bandAngle);
  // Soft contact shadow under band
  layerCtx.fillStyle = "rgba(0,0,0,0.22)";
  layerCtx.beginPath();
  layerCtx.ellipse(0, diameter * 0.06, size * 0.48, size * 0.16, 0, 0, Math.PI * 2);
  layerCtx.fill();
  // Foreshortened oval = looking down at dorsum of hand
  layerCtx.scale(1, 0.38);
  layerCtx.imageSmoothingEnabled = true;
  layerCtx.imageSmoothingQuality = "high";
  layerCtx.drawImage(crop, -size / 2, -size / 2, size, size);
  layerCtx.restore();
}

/** True if opaque mass is heavier on top half → pendant likely upside-down in crop. */
function necklaceNeedsFlip(crop) {
  const ctx = crop.getContext("2d", { willReadFrequently: true });
  const { data, width: w, height: h } = ctx.getImageData(0, 0, crop.width, crop.height);
  let top = 0;
  let bot = 0;
  let sumY = 0;
  let n = 0;
  const step = Math.max(1, Math.floor(Math.min(w, h) / 200));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4 + 3] < 40) continue;
      n++;
      sumY += y;
      if (y < h * 0.5) top++;
      else bot++;
    }
  }
  if (!n) return true; // default flip — safer for Alhambra-style product shots that looked inverted
  const cy = sumY / n / h;
  // Pendant should sit in lower half; if center of mass is high, flip.
  return cy < 0.52 || top > bot * 1.05;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function sampleBilinear(data, tw, th, x, y) {
  const x0 = clamp(Math.floor(x), 0, tw - 1);
  const y0 = clamp(Math.floor(y), 0, th - 1);
  const x1 = clamp(x0 + 1, 0, tw - 1);
  const y1 = clamp(y0 + 1, 0, th - 1);
  const fx = x - x0;
  const fy = y - y0;
  const i00 = (y0 * tw + x0) * 4;
  const i10 = (y0 * tw + x1) * 4;
  const i01 = (y1 * tw + x0) * 4;
  const i11 = (y1 * tw + x1) * 4;
  const mix = (a, b, t) => a + (b - a) * t;
  const r = mix(mix(data[i00], data[i10], fx), mix(data[i01], data[i11], fx), fy);
  const g = mix(mix(data[i00 + 1], data[i10 + 1], fx), mix(data[i01 + 1], data[i11 + 1], fx), fy);
  const b = mix(mix(data[i00 + 2], data[i10 + 2], fx), mix(data[i01 + 2], data[i11 + 2], fx), fy);
  const a = mix(mix(data[i00 + 3], data[i10 + 3], fx), mix(data[i01 + 3], data[i11 + 3], fx), fy);
  return [r, g, b, a];
}

/** Average opaque metal color + build 1D circumferential texture strip. */
function buildMetalStrip(crop, stripW = 512, stripH = 48) {
  const ctx = crop.getContext("2d", { willReadFrequently: true });
  const { data, width: tw, height: th } = ctx.getImageData(0, 0, crop.width, crop.height);
  let sr = 0, sg = 0, sb = 0, n = 0;
  const step = Math.max(1, Math.floor(Math.min(tw, th) / 120));
  for (let y = 0; y < th; y += step) {
    for (let x = 0; x < tw; x += step) {
      const i = (y * tw + x) * 4;
      if (data[i + 3] < 80) continue;
      // skip near-white plate leftovers
      if (data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 230) continue;
      sr += data[i];
      sg += data[i + 1];
      sb += data[i + 2];
      n++;
    }
  }
  const avg = n
    ? [sr / n, sg / n, sb / n]
    : [212, 175, 95];

  const strip = document.createElement("canvas");
  strip.width = stripW;
  strip.height = stripH;
  const sctx = strip.getContext("2d", { willReadFrequently: true });
  const sid = sctx.createImageData(stripW, stripH);
  const sd = sid.data;

  // Sample crop along a ring path if oval-like, else scan row by luminance
  for (let u = 0; u < stripW; u++) {
    const t = u / stripW;
    // walk a horizontal band across the crop mid-height (bracelet product arcs)
    const srcX = t * (tw - 1);
    for (let v = 0; v < stripH; v++) {
      const srcY = (0.25 + (v / stripH) * 0.5) * (th - 1);
      let [r, g, b, a] = sampleBilinear(data, tw, th, srcX, srcY);
      if (a < 40) {
        // fallback to average metal with slight variation
        const wobble = 0.92 + 0.16 * Math.sin(t * Math.PI * 8 + v * 0.2);
        r = avg[0] * wobble;
        g = avg[1] * wobble;
        b = avg[2] * wobble;
        a = 255;
      }
      const o = (v * stripW + u) * 4;
      sd[o] = r;
      sd[o + 1] = g;
      sd[o + 2] = b;
      sd[o + 3] = 255;
    }
  }
  sctx.putImageData(sid, 0, 0);
  return { strip, avg };
}

/**
 * Product-faithful bracelet wrap — FRONT of wrist ONLY (back occluded by arm).
 * No Love screw studs / Clash pyramids — those changed the product shape.
 */
function wrapBraceletCylinder(layerCtx, bodyCanvas, crop, center, wristW, angleDeg, frontAngleDeg) {
  const plane = (angleDeg * Math.PI) / 180;
  // Camera-up side of wrist (top-down shot): favor screen-up as "front"
  const frontRef =
    frontAngleDeg != null
      ? (frontAngleDeg * Math.PI) / 180
      : plane - Math.PI / 2;

  const majorR = Math.max(16, wristW * 0.48);
  const depthR = Math.max(10, majorR * 0.48);
  const tubeR = clamp(majorR * 0.22, 6, majorR * 0.32);
  const bandHalf = clamp(majorR * 0.2, 5, majorR * 0.28);

  const { strip, avg } = buildMetalStrip(crop, 1024, 96);
  const stripCtx = strip.getContext("2d", { willReadFrequently: true });
  const { data: td, width: sw, height: sh } = stripCtx.getImageData(0, 0, strip.width, strip.height);

  const cosP = Math.cos(plane);
  const sinP = Math.sin(plane);
  const alongX = -sinP;
  const alongY = cosP;

  const pad = Math.ceil(majorR + tubeR + bandHalf + 12);
  const x0 = Math.max(0, Math.floor(center.x - pad));
  const y0 = Math.max(0, Math.floor(center.y - pad));
  const x1 = Math.min(layerCtx.canvas.width, Math.ceil(center.x + pad));
  const y1 = Math.min(layerCtx.canvas.height, Math.ceil(center.y + pad));
  const bw = Math.max(1, x1 - x0);
  const bh = Math.max(1, y1 - y0);

  const front = layerCtx.createImageData(bw, bh);
  const fd = front.data;

  // Contact AO only (under metal)
  layerCtx.save();
  layerCtx.translate(center.x, center.y);
  layerCtx.rotate(plane);
  const ao = layerCtx.createRadialGradient(0, 0, majorR * 0.3, 0, 0, majorR + tubeR);
  ao.addColorStop(0, "rgba(0,0,0,0)");
  ao.addColorStop(0.75, "rgba(0,0,0,0.16)");
  ao.addColorStop(1, "rgba(0,0,0,0)");
  layerCtx.fillStyle = ao;
  layerCtx.beginPath();
  layerCtx.ellipse(0, 0, majorR + tubeR * 0.5, depthR + tubeR * 0.4, 0, 0, Math.PI * 2);
  layerCtx.fill();
  layerCtx.restore();

  const lightX = 0.25;
  const lightY = -0.8;
  const lightZ = 0.5;
  const llen = Math.hypot(lightX, lightY, lightZ) || 1;

  // Prefer screen-up as visible face for top-down arm photos
  const camUpX = 0;
  const camUpY = -1;

  for (let py = 0; py < bh; py++) {
    for (let px = 0; px < bw; px++) {
      const gx = x0 + px + 0.5;
      const gy = y0 + py + 0.5;
      const dx = gx - center.x;
      const dy = gy - center.y;
      const across = dx * cosP + dy * sinP;
      const depth = -dx * sinP + dy * cosP;
      const along = dx * alongX + dy * alongY;
      if (Math.abs(along) > bandHalf * 1.4) continue;

      const nx = across / majorR;
      const ny = depth / depthR;
      const er = Math.hypot(nx, ny);
      if (er < 1e-4) continue;

      const ex = (nx / er) * majorR;
      const ey = (ny / er) * depthR;
      const eMetric = er;
      const dMaj = Math.abs(eMetric - 1) * ((majorR + depthR) * 0.5);
      const tubeSdf = Math.hypot(dMaj, Math.max(0, Math.abs(along) - bandHalf * 0.2)) - tubeR;
      if (tubeSdf > 0.7) continue;

      const theta = Math.atan2(ny, nx);

      // World direction from wrist center to this ellipse point (screen)
      const wx = ex * cosP - ey * sinP;
      const wy = ex * sinP + ey * cosP;
      // Visible = toward camera-up (top of wrist). Hide underside / far side.
      const towardCam = (wx * camUpX + wy * camUpY) / (Math.hypot(wx, wy) || 1);
      // Also require outer side of tube (not buried in arm)
      if (towardCam < 0.08) continue; // HARD occlusion — no back hoop through arm

      const facing = Math.cos(theta - (frontRef - plane));
      if (facing < -0.35 && towardCam < 0.35) continue;

      let tnx = across - ex;
      let tny = depth - ey;
      let tnz = along * 0.35;
      const tnLen = Math.hypot(tnx, tny, tnz) || 1;
      tnx /= tnLen;
      tny /= tnLen;
      tnz /= tnLen;

      const ndot = (tnx * lightX + tny * lightY + tnz * lightZ) / llen;
      const diff = 0.42 + 0.58 * Math.max(0, ndot);
      const spec = Math.pow(Math.max(0, ndot), 18) * 70;

      const u = ((theta / (Math.PI * 2)) + 0.5) * (sw - 1);
      const v = clamp((0.35 + towardCam * 0.45) * (sh - 1), 0, sh - 1);
      let [r, g, b] = sampleBilinear(td, sw, sh, u, v);
      if (!(r + g + b > 0)) {
        r = avg[0];
        g = avg[1];
        b = avg[2];
      }

      // Keep pave sparkle — don't crush product colors
      const shade = diff * (0.85 + 0.15 * towardCam);
      r = clamp(r * shade + spec, 0, 255);
      g = clamp(g * shade + spec * 0.92, 0, 255);
      b = clamp(b * shade + spec * 0.7, 0, 255);

      const edge = clamp(1 - tubeSdf / 0.7, 0, 1);
      const alpha = clamp(255 * Math.pow(edge, 0.55) * clamp(towardCam * 1.35, 0.35, 1), 0, 255);
      if (alpha < 8) continue;

      const o = (py * bw + px) * 4;
      const oa = fd[o + 3] / 255;
      const na = alpha / 255;
      const outA = na + oa * (1 - na);
      if (outA < 1e-4) continue;
      fd[o] = (r * na + fd[o] * oa * (1 - na)) / outA;
      fd[o + 1] = (g * na + fd[o + 1] * oa * (1 - na)) / outA;
      fd[o + 2] = (b * na + fd[o + 2] * oa * (1 - na)) / outA;
      fd[o + 3] = outA * 255;
    }
  }

  // Stamp a foreshortened slice of the real product on the top arc (nail/pave identity)
  layerCtx.save();
  layerCtx.translate(center.x, center.y);
  layerCtx.rotate(plane);
  layerCtx.beginPath();
  // Top half ellipse clip (visible band)
  layerCtx.ellipse(0, 0, majorR + tubeR * 0.15, depthR + tubeR * 0.1, 0, Math.PI, Math.PI * 2);
  layerCtx.clip();
  const stampW = majorR * 2.05;
  const stampH = Math.max(tubeR * 2.4, bandHalf * 2.8);
  layerCtx.globalAlpha = 0.92;
  layerCtx.imageSmoothingEnabled = true;
  layerCtx.imageSmoothingQuality = "high";
  layerCtx.drawImage(crop, -stampW / 2, -stampH * 0.75, stampW, stampH);
  layerCtx.restore();

  const tmpFront = document.createElement("canvas");
  tmpFront.width = bw;
  tmpFront.height = bh;
  tmpFront.getContext("2d").putImageData(front, 0, 0);
  layerCtx.drawImage(tmpFront, x0, y0);
}

export async function composeTryOn(bodyImg, jewelryCanvas, target, type = "ring") {
  const bodyCanvas = bodyImg instanceof HTMLCanvasElement ? bodyImg : canvasFromImage(bodyImg);

  // Necklace: WebGL chain
  if (type === "necklace") {
    try {
      const { composeTryOn3D } = await import("./tryon3d.js");
      const { stripPortfolioWatermark } = await import("./sam2.js");
      stripPortfolioWatermark(jewelryCanvas);
      despillCanvas(jewelryCanvas);
      return await composeTryOn3D(bodyCanvas, jewelryCanvas, target, type);
    } catch (err) {
      console.warn("3D necklace failed, fallback 2D", err);
    }
  }

  const out = document.createElement("canvas");
  out.width = bodyCanvas.width;
  out.height = bodyCanvas.height;
  const octx = out.getContext("2d");
  octx.drawImage(bodyCanvas, 0, 0);

  despillCanvas(jewelryCanvas);
  try {
    const { stripPortfolioWatermark } = await import("./sam2.js");
    stripPortfolioWatermark(jewelryCanvas);
  } catch (_) {}
  const bounds = jewelryBounds(jewelryCanvas);
  const crop = document.createElement("canvas");
  crop.width = Math.max(1, bounds.w);
  crop.height = Math.max(1, bounds.h);
  crop.getContext("2d").drawImage(
    jewelryCanvas,
    bounds.x, bounds.y, bounds.w, bounds.h,
    0, 0, crop.width, crop.height
  );
  despillCanvas(crop);

  // If cutout is empty (rembg/watermark wiped), synthesize a gold band so stamp still works
  if (!cropHasOpaque(crop)) {
    const syn = document.createElement("canvas");
    syn.width = 256;
    syn.height = 96;
    const sctx = syn.getContext("2d");
    const g = sctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, "#c9a24a");
    g.addColorStop(0.5, "#f0d78c");
    g.addColorStop(1, "#a67c2e");
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, 256, 96);
    crop.width = syn.width;
    crop.height = syn.height;
    crop.getContext("2d").drawImage(syn, 0, 0);
  }

  // Bracelet: product texture wrap on wrist FRONT only (no Love-stud 3D mesh — wrong product)
  if (type === "bracelet") {
    const t = target?.center ? target : null;
    if (!t) {
      console.warn("bracelet compose: missing target");
      return out;
    }
    const cx = Math.min(out.width - 8, Math.max(8, t.center.x));
    const cy = Math.min(out.height - 8, Math.max(8, t.center.y));
    let targetW = Math.max(minWidthForType(out.width, "bracelet"), t.width || out.width * 0.28);
    try {
      wrapBraceletCylinder(
        octx,
        bodyCanvas,
        crop,
        { x: cx, y: cy },
        targetW,
        t.angle || 38,
        t.frontAngle
      );
    } catch (err) {
      console.warn("bracelet wrap failed", err);
    }
    return out;
  }

  const layer = document.createElement("canvas");
  layer.width = out.width;
  layer.height = out.height;
  const lctx = layer.getContext("2d");

  const placeOne = (t) => {
    if (!t?.center) return;
    let targetW = Math.max(8, t.width || out.width * 0.12);
    targetW = Math.max(targetW, minWidthForType(out.width, type));
    const aspect = crop.height / Math.max(crop.width, 1);
    let targetH = targetW * aspect;
    if (type === "necklace") targetH = targetW * aspect * 0.9;

    const angle = t.angle || 0;

    if (type === "ring") {
      placeRingOnFinger(lctx, crop, { ...t, width: targetW }, out.width);
      return;
    }

    if (type === "necklace") {
      let ang = angle;
      if (Math.abs(ang) > 90) ang = ang > 0 ? ang - 180 : ang + 180;
      const flipY = necklaceNeedsFlip(crop);
      lctx.save();
      lctx.translate(t.center.x, t.center.y);
      lctx.rotate((ang * Math.PI) / 180);
      if (flipY) lctx.scale(1, -1);
      lctx.imageSmoothingEnabled = true;
      lctx.imageSmoothingQuality = "high";
      lctx.drawImage(crop, -targetW / 2, -targetH / 2, targetW, targetH);
      lctx.restore();
      return;
    }

    lctx.save();
    lctx.translate(t.center.x, t.center.y);
    lctx.rotate((angle * Math.PI) / 180);
    lctx.imageSmoothingEnabled = true;
    lctx.imageSmoothingQuality = "high";
    lctx.drawImage(crop, -targetW / 2, -targetH / 2, targetW, targetH);
    lctx.restore();
  };

  placeOne(target);
  octx.drawImage(layer, 0, 0);
  return out;
}

function cropHasOpaque(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const step = Math.max(1, Math.floor((width * height) / 8000));
  let n = 0;
  for (let i = 3; i < data.length; i += 4 * step) {
    if (data[i] > 40) {
      n++;
      if (n > 30) return true;
    }
  }
  return false;
}

/** Guaranteed-visible bracelet stamp on wrist (product photo as oval band). */
function placeBraceletStamp(layerCtx, crop, center, wristW, angleDeg) {
  if (!center || !crop?.width) return;
  const w = Math.max(36, wristW * 1.15);
  const ang = ((angleDeg || 0) * Math.PI) / 180;
  const aspect = crop.height / Math.max(crop.width, 1);
  const bw = w * 1.15;
  const bh = Math.max(w * 0.42, bw * Math.min(aspect, 0.6) * 0.6);
  layerCtx.save();
  layerCtx.translate(center.x, center.y);
  layerCtx.rotate(ang);
  layerCtx.imageSmoothingEnabled = true;
  layerCtx.imageSmoothingQuality = "high";
  // contact shadow under band
  layerCtx.fillStyle = "rgba(0,0,0,0.35)";
  layerCtx.beginPath();
  layerCtx.ellipse(2, 5, bw * 0.55, bh * 0.6, 0, 0, Math.PI * 2);
  layerCtx.fill();
  // metal rim so band always reads even if crop is sparse
  layerCtx.strokeStyle = "rgba(201,162,74,0.98)";
  layerCtx.lineWidth = Math.max(7, w * 0.09);
  layerCtx.beginPath();
  layerCtx.ellipse(0, 0, bw * 0.52, bh * 0.45, 0, 0, Math.PI * 2);
  layerCtx.stroke();
  // product photo clipped to stadium band
  layerCtx.save();
  layerCtx.beginPath();
  layerCtx.ellipse(0, 0, bw * 0.55, bh * 0.52, 0, 0, Math.PI * 2);
  layerCtx.clip();
  layerCtx.globalAlpha = 1;
  layerCtx.drawImage(crop, -bw / 2, -bh / 2, bw, bh);
  layerCtx.restore();
  // highlight arc (top of metal)
  layerCtx.strokeStyle = "rgba(255,240,200,0.65)";
  layerCtx.lineWidth = Math.max(2, w * 0.03);
  layerCtx.beginPath();
  layerCtx.ellipse(0, -bh * 0.08, bw * 0.45, bh * 0.3, 0, Math.PI * 1.15, Math.PI * 1.85);
  layerCtx.stroke();
  layerCtx.restore();
}

export function drawBefore(canvas, image) {
  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(image, 0, 0, w, h);
}

/** Fallback aligned with camera guide layout. */
export function fallbackTarget(bodyImg, type = "ring", opts = {}) {
  const w = bodyImg.naturalWidth || bodyImg.width || 1;
  const h = bodyImg.naturalHeight || bodyImg.height || 1;
  if (type === "earring") {
    // Front-cam capture is mirrored (KYC) → anatomical right sits on screen/image right
    const anatomicalRight = opts.earSide !== "left";
    return {
      center: { x: w * (anatomicalRight ? 0.72 : 0.28), y: h * 0.42 },
      width: w * 0.07,
      angle: anatomicalRight ? -8 : 8,
      side: anatomicalRight ? "right" : "left",
    };
  }
  if (type === "ring") {
    const finger = opts.ringFinger || "ring";
    const xMap = { index: 0.52, middle: 0.50, ring: 0.46, pinky: 0.40 };
    return {
      center: { x: w * (xMap[finger] || 0.46), y: h * 0.24 },
      width: w * 0.045,
      angle: -12,
      frontAngle: -102,
      finger,
    };
  }
  if (type === "necklace") {
    // Guide/neck band — not mid-chest logo height
    return { center: { x: w * 0.5, y: h * 0.4 }, width: w * 0.22, angle: 0 };
  }
  if (type === "bracelet") {
    // Match flipped guide: hand upper-RIGHT, elbow lower-LEFT
    return {
      center: { x: w * 0.48, y: h * 0.48 },
      width: w * 0.34,
      angle: 32,
      frontAngle: 122,
    };
  }
  return { center: { x: w * 0.55, y: h * 0.28 }, width: w * 0.09, angle: -15 };
}
