/**
 * High-resolution save compose: prefer live AR renderer GLB layer, else 2.5D.
 */
export async function composeHighResTryOn({
  bodyCanvas,
  jewelryCanvas,
  type,
  target,
  arRenderer,
  anchor,
  extras = {},
}) {
  // Prefer connected Three.js high-res path when GLB is loaded
  if (arRenderer?.hasGlb && arRenderer?.assetState !== "fallback_2_5d" && anchor && typeof arRenderer.composeHighRes === "function") {
    try {
      const out = arRenderer.composeHighRes(bodyCanvas, type, anchor, extras);
      if (out) {
        return {
          canvas: out,
          path: arRenderer.assetState === "validation_glb" ? "validation-glb-highres" : "glb-highres",
          assetState: arRenderer.assetState,
          consistency: arRenderer.getDebugStats?.()?.saveConsistency,
        };
      }
    } catch (err) {
      console.warn("high-res GLB compose failed", err);
    }
  }

  const { composeTryOn } = await import("../tryon.js");
  const canvas = await composeTryOn(bodyCanvas, jewelryCanvas, target, type);
  return {
    canvas,
    path: "fallback-25d",
    assetState: arRenderer?.assetState || "fallback_2_5d",
  };
}
