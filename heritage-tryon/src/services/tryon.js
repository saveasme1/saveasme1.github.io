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
  return {
    x: Math.max(0, minX - step),
    y: Math.max(0, minY - step),
    w: Math.min(width - 1, maxX + step) - Math.max(0, minX - step) + 1,
    h: Math.min(height - 1, maxY + step) - Math.max(0, minY - step) + 1,
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
 * Volumetric torus bracelet around wrist.
 * Local frame: X = across wrist, Y = along forearm (depth foreshortened on X–screen).
 * Tube cross-section gives round metal + side crescents + AO, not a flat sticker.
 */
function wrapBraceletCylinder(layerCtx, bodyCanvas, crop, center, wristW, angleDeg, frontAngleDeg) {
  // Plane of the bracelet: across the wrist (angleDeg from landmarks).
  const plane = (angleDeg * Math.PI) / 180;
  // Knuckles / "front" of arm in image
  const frontRef = ((frontAngleDeg != null ? frontAngleDeg : angleDeg - 90) * Math.PI) / 180;

  const majorR = Math.max(14, wristW * 0.46); // wrist radius across
  const depthR = Math.max(9, majorR * 0.52); // foreshortened depth axis
  const tubeR = clamp(majorR * 0.2, 5, majorR * 0.28); // round metal thickness
  const bandHalf = clamp(majorR * 0.16, 4, majorR * 0.22); // width along forearm

  const { strip, avg } = buildMetalStrip(crop, 768, 64);
  const stripCtx = strip.getContext("2d", { willReadFrequently: true });
  const { data: td, width: sw, height: sh } = stripCtx.getImageData(0, 0, strip.width, strip.height);

  const cosP = Math.cos(plane);
  const sinP = Math.sin(plane);
  // Forearm axis in screen ≈ perpendicular to bracelet plane
  const alongX = -sinP;
  const alongY = cosP;

  const pad = Math.ceil(majorR + tubeR + bandHalf + 10);
  const x0 = Math.max(0, Math.floor(center.x - pad));
  const y0 = Math.max(0, Math.floor(center.y - pad));
  const x1 = Math.min(layerCtx.canvas.width, Math.ceil(center.x + pad));
  const y1 = Math.min(layerCtx.canvas.height, Math.ceil(center.y + pad));
  const bw = Math.max(1, x1 - x0);
  const bh = Math.max(1, y1 - y0);

  const back = layerCtx.createImageData(bw, bh);
  const front = layerCtx.createImageData(bw, bh);
  const bd = back.data;
  const fd = front.data;

  // Soft contact AO on skin (under jewelry)
  layerCtx.save();
  layerCtx.translate(center.x, center.y);
  layerCtx.rotate(plane);
  const ao = layerCtx.createRadialGradient(0, 0, majorR * 0.35, 0, 0, majorR + tubeR);
  ao.addColorStop(0, "rgba(0,0,0,0.00)");
  ao.addColorStop(0.72, "rgba(0,0,0,0.18)");
  ao.addColorStop(0.9, "rgba(0,0,0,0.32)");
  ao.addColorStop(1, "rgba(0,0,0,0)");
  layerCtx.fillStyle = ao;
  layerCtx.beginPath();
  layerCtx.ellipse(0, 0, majorR + tubeR * 0.6, depthR + tubeR * 0.45, 0, 0, Math.PI * 2);
  layerCtx.fill();
  // Inner ring contact shadow
  layerCtx.strokeStyle = "rgba(0,0,0,0.28)";
  layerCtx.lineWidth = Math.max(2, tubeR * 0.45);
  layerCtx.beginPath();
  layerCtx.ellipse(0, 0, majorR - tubeR * 0.15, depthR - tubeR * 0.1, 0, 0, Math.PI * 2);
  layerCtx.stroke();
  layerCtx.restore();

  const lightX = 0.35;
  const lightY = -0.75;
  const lightZ = 0.55;
  const llen = Math.hypot(lightX, lightY, lightZ) || 1;

  for (let py = 0; py < bh; py++) {
    for (let px = 0; px < bw; px++) {
      const gx = x0 + px + 0.5;
      const gy = y0 + py + 0.5;
      const dx = gx - center.x;
      const dy = gy - center.y;
      // Local: lx across plane, ly depth-in-plane, la along forearm
      const lx = dx * cosP + dy * sinP;
      const ly = -dx * sinP + dy * cosP;
      // Project out the along-forearm component using ly as depth axis of ellipse
      // Bracelet sits mostly in lx–depth; band width uses offset along forearm.
      // Approximate along as ly contribution from arm angle: use second axis.
      const across = lx;
      const depth = ly;
      const along = dx * alongX + dy * alongY;

      if (Math.abs(along) > bandHalf * 1.35) continue;

      const nx = across / majorR;
      const ny = depth / depthR;
      const er = Math.hypot(nx, ny);
      if (er < 1e-4) continue;

      // Nearest point on major ellipse
      const ex = (nx / er) * majorR;
      const ey = (ny / er) * depthR;
      const radialDist = Math.hypot(across - ex, depth - ey);
      // Tube SDF in radial + along (stadium / rounded rect tube)
      const radialGap = radialDist;
      const alongGap = Math.max(0, Math.abs(along) - bandHalf * 0.55);
      const tubeDist = Math.hypot(radialGap - 0, alongGap); // center of tube at major ellipse
      // Reinterpret: distance to tube centerline (ellipse) in 2D then include along
      const dRadial = Math.abs(radialDist); // from ellipse curve — wait radialDist IS distance to ellipse point
      // Better tube: radial distance from major radius in elliptical metric
      const eMetric = er; // 1 on surface
      const dMaj = Math.abs(eMetric - 1) * ((majorR + depthR) * 0.5);
      const tubeSdf = Math.hypot(dMaj, Math.max(0, Math.abs(along) - bandHalf * 0.15)) - tubeR;
      if (tubeSdf > 0.85) continue;

      const theta = Math.atan2(ny, nx);
      // Camera faces +Z; back of wrist is negative depth (behind arm)
      // Use elliptical "depth" : positive ny toward one side.
      // Front of bracelet = side facing knuckles (frontRef relative to plane).
      const facing = Math.cos(theta - (frontRef - plane));
      const isBack = facing < -0.05;

      // Tube surface normal (outward from tube centerline)
      const invEr = 1 / er;
      const radialDirX = nx * invEr;
      const radialDirY = ny * invEr;
      // From ellipse point to pixel → tube normal in plane
      let tnx = across - ex;
      let tny = depth - ey;
      let tnz = along * 0.35;
      const tnLen = Math.hypot(tnx, tny, tnz) || 1;
      tnx /= tnLen;
      tny /= tnLen;
      tnz /= tnLen;

      const ndot = (tnx * lightX + tny * lightY + tnz * lightZ) / llen;
      const diff = 0.38 + 0.62 * Math.max(0, ndot);
      const spec = Math.pow(Math.max(0, ndot), 22) * 95;
      const fresnel = Math.pow(1 - Math.max(0, Math.abs(tnz) * 0.4 + Math.max(0, facing) * 0.6), 1.4) * 28;
      // Roundness cue: darker in tube creases toward skin
      const crease = clamp(1 - Math.abs(eMetric - 1) / (tubeR / majorR + 1e-6), 0, 1);
      const aoMul = 0.72 + 0.28 * crease;

      const u = ((theta / (Math.PI * 2)) + 0.5) * (sw - 1);
      const v = clamp((ndot * 0.5 + 0.5) * (sh - 1), 0, sh - 1);
      let [r, g, b] = sampleBilinear(td, sw, sh, u, v);
      if (!(r + g + b > 0)) {
        r = avg[0];
        g = avg[1];
        b = avg[2];
      }

      let shade = diff * aoMul;
      if (isBack) shade *= 0.42;
      r = clamp(r * shade + spec * (isBack ? 0.15 : 1) + fresnel * (isBack ? 0.2 : 1), 0, 255);
      g = clamp(g * shade + spec * 0.9 * (isBack ? 0.15 : 1) + fresnel * 0.85, 0, 255);
      b = clamp(b * shade + spec * 0.65 * (isBack ? 0.15 : 1) + fresnel * 0.5, 0, 255);

      const edge = clamp(1 - tubeSdf / 0.85, 0, 1);
      const vis = isBack ? 0.55 : 1;
      // Hide most of true back (behind wrist); keep side crescents
      const sideKeep = clamp(1 + facing * 1.1, 0, 1);
      const alpha = clamp(255 * Math.pow(edge, 0.65) * vis * (isBack ? sideKeep * 0.75 : 1), 0, 255);
      if (alpha < 4) continue;

      const o = (py * bw + px) * 4;
      const dest = isBack ? bd : fd;
      // alpha composite into layer buffer
      const oa = dest[o + 3] / 255;
      const na = alpha / 255;
      const outA = na + oa * (1 - na);
      if (outA < 1e-4) continue;
      dest[o] = (r * na + dest[o] * oa * (1 - na)) / outA;
      dest[o + 1] = (g * na + dest[o + 1] * oa * (1 - na)) / outA;
      dest[o + 2] = (b * na + dest[o + 2] * oa * (1 - na)) / outA;
      dest[o + 3] = outA * 255;
    }
  }

  // Raised screw studs on front arc (Love bracelet cue)
  for (let k = 0; k < 10; k++) {
    const th = -Math.PI * 0.92 + (k / 9) * Math.PI * 1.84;
    const facing = Math.cos(th - (frontRef - plane));
    if (facing < 0.2) continue;
    const ex = Math.cos(th) * majorR;
    const ey = Math.sin(th) * depthR;
    const gx = center.x + ex * cosP - ey * sinP;
    const gy = center.y + ex * sinP + ey * cosP;
    const sx = Math.floor(gx - x0);
    const sy = Math.floor(gy - y0);
    const rad = Math.max(2.2, tubeR * 0.42);
    for (let yy = -rad * 1.2; yy <= rad * 1.2; yy++) {
      for (let xx = -rad * 1.2; xx <= rad * 1.2; xx++) {
        const rr = Math.hypot(xx, yy);
        if (rr > rad * 1.15) continue;
        const px = sx + Math.round(xx);
        const py = sy + Math.round(yy);
        if (px < 0 || py < 0 || px >= bw || py >= bh) continue;
        const o = (py * bw + px) * 4;
        const bump = Math.max(0, 1 - rr / rad);
        const hi = Math.pow(bump, 1.6);
        fd[o] = clamp(avg[0] * (0.55 + 0.45 * hi) + hi * 80, 0, 255);
        fd[o + 1] = clamp(avg[1] * (0.55 + 0.45 * hi) + hi * 70, 0, 255);
        fd[o + 2] = clamp(avg[2] * (0.55 + 0.4 * hi) + hi * 40, 0, 255);
        fd[o + 3] = Math.max(fd[o + 3], 210 * bump);
      }
    }
  }

  const tmpBack = document.createElement("canvas");
  tmpBack.width = bw;
  tmpBack.height = bh;
  tmpBack.getContext("2d").putImageData(back, 0, 0);
  layerCtx.drawImage(tmpBack, x0, y0);

  // Wrist body occludes back / fills hole — elliptical stamp
  layerCtx.save();
  layerCtx.translate(center.x, center.y);
  layerCtx.rotate(plane);
  layerCtx.beginPath();
  layerCtx.ellipse(0, 0, majorR - tubeR * 0.35, depthR - tubeR * 0.25, 0, 0, Math.PI * 2);
  layerCtx.clip();
  layerCtx.setTransform(1, 0, 0, 1, 0, 0);
  layerCtx.drawImage(bodyCanvas, 0, 0);
  layerCtx.restore();

  const tmpFront = document.createElement("canvas");
  tmpFront.width = bw;
  tmpFront.height = bh;
  tmpFront.getContext("2d").putImageData(front, 0, 0);
  layerCtx.drawImage(tmpFront, x0, y0);
}

export async function composeTryOn(bodyImg, jewelryCanvas, target, type = "ring") {
  const bodyCanvas = bodyImg instanceof HTMLCanvasElement ? bodyImg : canvasFromImage(bodyImg);

  // Bracelet keeps WebGL PBR. Rings use dedicated 2D band (3D wrist occluder hid rings).
  if (type === "bracelet") {
    try {
      const { composeTryOn3D } = await import("./tryon3d.js");
      return await composeTryOn3D(bodyCanvas, jewelryCanvas, target, type);
    } catch (err) {
      console.warn("3D try-on failed, fallback 2D", err);
    }
  }

  const out = document.createElement("canvas");
  out.width = bodyCanvas.width;
  out.height = bodyCanvas.height;
  const octx = out.getContext("2d");
  octx.drawImage(bodyCanvas, 0, 0);

  despillCanvas(jewelryCanvas);
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

    if (type === "bracelet") {
      wrapBraceletCylinder(
        lctx,
        bodyCanvas,
        crop,
        t.center,
        targetW,
        angle,
        t.frontAngle
      );
      return;
    }

    if (type === "ring") {
      placeRingOnFinger(lctx, crop, { ...t, width: targetW }, out.width);
      return;
    }

    // Necklace: pendant must hang DOWN.
    // Also unwrap ~180° shoulder angle from unmirrored selfies.
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
    // Guide/collarbone band — not mid-chest logo height
    return { center: { x: w * 0.5, y: h * 0.38 }, width: w * 0.2, angle: 0 };
  }
  if (type === "bracelet") {
    return {
      center: { x: w * 0.5, y: h * 0.42 },
      width: w * 0.28,
      angle: 8,
      frontAngle: -90,
    };
  }
  return { center: { x: w * 0.55, y: h * 0.28 }, width: w * 0.09, angle: -15 };
}
