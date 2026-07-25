/**
 * Video ↔ display ↔ canvas coordinate transforms.
 * Keep mirror (preview CSS) separate from rear-camera handedness correction.
 */

/** object-fit: cover mapping from video intrinsic → element box */
export function getObjectFitCoverTransform(videoW, videoH, boxW, boxH) {
  const videoAspect = videoW / Math.max(1, videoH);
  const boxAspect = boxW / Math.max(1, boxH);
  let drawW;
  let drawH;
  let offsetX;
  let offsetY;
  if (videoAspect > boxAspect) {
    drawH = boxH;
    drawW = boxH * videoAspect;
    offsetX = (boxW - drawW) / 2;
    offsetY = 0;
  } else {
    drawW = boxW;
    drawH = boxW / videoAspect;
    offsetX = 0;
    offsetY = (boxH - drawH) / 2;
  }
  return { drawW, drawH, offsetX, offsetY, scaleX: drawW / videoW, scaleY: drawH / videoH };
}

export function normalizedLandmarkToVideoPixel(lm, videoW, videoH) {
  return { x: lm.x * videoW, y: lm.y * videoH, z: lm.z || 0 };
}

export function videoPixelToDisplayPixel(px, py, cover) {
  return {
    x: cover.offsetX + px * cover.scaleX,
    y: cover.offsetY + py * cover.scaleY,
  };
}

export function displayPixelToCanvasPixel(dx, dy, cssW, cssH, canvasW, canvasH) {
  return {
    x: (dx / Math.max(1, cssW)) * canvasW,
    y: (dy / Math.max(1, cssH)) * canvasH,
  };
}

/** Normalized landmark → overlay canvas pixels with object-fit:cover */
export function landmarkToOverlayPixel(lm, videoEl, overlayCanvas, { mirror = false } = {}) {
  const vw = videoEl.videoWidth || 1;
  const vh = videoEl.videoHeight || 1;
  const box = overlayCanvas.getBoundingClientRect();
  const cover = getObjectFitCoverTransform(vw, vh, box.width, box.height);
  let nx = lm.x;
  if (mirror) nx = 1 - nx;
  const vp = normalizedLandmarkToVideoPixel({ x: nx, y: lm.y }, vw, vh);
  const dp = videoPixelToDisplayPixel(vp.x, vp.y, cover);
  return displayPixelToCanvasPixel(dp.x, dp.y, box.width, box.height, overlayCanvas.width, overlayCanvas.height);
}

export function applyFrontCameraMirror(nx, mirrored) {
  return mirrored ? 1 - nx : nx;
}
