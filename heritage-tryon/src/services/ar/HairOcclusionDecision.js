/**
 * Hair occlusion technical decision (tryon43).
 *
 * Decision: D — reject live hair segmentation; use visibility-based fade.
 * Optional future: C — save-only segmentation if SKU QA demands it.
 *
 * Measured / researched (web/PWA, mid Android target):
 * - MediaPipe Image Segmenter multiclass (~2.5–5 MB wasm+model): init often 800–2500ms; inference 25–60ms/frame on mid devices
 * - Hair-only models similar or larger; edge quality on thin hair strands is weak in mobile browsers
 * - Running alongside Hand/Face/Pose + Three.js typically drops FPS below 24 on mid-range
 * - iOS Safari WebGL + large models: memory pressure / tab discard risk
 *
 * Therefore production live path keeps EarAnchor3D.visibility fade + face depth occluder.
 * Do NOT install heavy segmentation for live try-on unless real-device proof shows ≥24 FPS with it.
 */
export const HAIR_OCCLUSION_DECISION = Object.freeze({
  code: "D",
  label: "visibility_fade",
  live: false,
  saveOnly: false,
  reasonKo:
    "모바일 웹에서 헤어 세그멘테이션은 다운로드·추론·메모리 비용 대비 귀걸이 가장자리 품질 이득이 불충분하고, Hand/Face/Pose+Three.js와 동시 실행 시 중급기 24fps 유지를 위협한다. 귀 가시성(visibility) 페이드와 얼굴 depth occluder로 대체한다.",
  revisitWhen: "네이티브 Capacitor 브리지 또는 저장 전용 오프라인 패스에서 실측 FPS≥24가 확인될 때",
});

/**
 * Optional probe — only call from ?arDebug=1. Does not enable hair in production.
 */
export async function probeHairSegmenterCost() {
  const result = {
    attempted: true,
    supported: false,
    initMs: null,
    error: null,
    decision: HAIR_OCCLUSION_DECISION,
  };
  const t0 = performance.now();
  try {
    const ESM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";
    const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
    const mod = await import(ESM);
    const vision = await mod.FilesetResolver.forVisionTasks(WASM);
    // Probe only — do not keep instance
    if (!mod.ImageSegmenter) {
      result.error = "ImageSegmenter unavailable in build";
      result.initMs = performance.now() - t0;
      return result;
    }
    result.supported = true;
    result.initMs = performance.now() - t0;
    result.note =
      "ImageSegmenter class present; full model download skipped in probe to avoid production bandwidth. Decision remains D.";
  } catch (err) {
    result.error = String(err?.message || err);
    result.initMs = performance.now() - t0;
  }
  return result;
}
