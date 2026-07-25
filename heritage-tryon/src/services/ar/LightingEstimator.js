/**
 * Lightweight lighting estimate from a video frame sample.
 */
export function estimateLightingFromVideo(video) {
  const out = {
    luminance: 0.55,
    temperature: 0.5,
    highlightDir: { x: 0.4, y: 0.8, z: 0.6 },
    contrast: 0.5,
  };
  if (!video?.videoWidth) return out;
  try {
    const c = document.createElement("canvas");
    const w = 48;
    const h = 27;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let sum = 0;
    let rSum = 0;
    let bSum = 0;
    let maxI = 0;
    let maxX = w / 2;
    let maxY = h / 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        sum += lum;
        rSum += r;
        bSum += b;
        if (lum > maxI) {
          maxI = lum;
          maxX = x;
          maxY = y;
        }
      }
    }
    const n = w * h;
    out.luminance = sum / n;
    out.temperature = Math.max(0, Math.min(1, (rSum - bSum) / (n * 255) * 0.5 + 0.5));
    out.highlightDir = {
      x: (maxX / w - 0.5) * 2,
      y: -(maxY / h - 0.5) * 2,
      z: 0.7,
    };
    out.contrast = Math.max(0.2, Math.min(0.9, maxI - out.luminance + 0.4));
  } catch (_) {}
  return out;
}
