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
  if (arRenderer?.hasGlb && anchor && typeof arRenderer.composeHighRes === "function") {
    try {
      const out = arRenderer.composeHighRes(bodyCanvas, type, anchor, extras);
      if (out) return { canvas: out, path: "glb-highres" };
    } catch (err) {
      console.warn("high-res GLB compose failed", err);
    }
  }

  // Fallback to standard composeTryOn (2.5D / necklace 3D procedural)
  const { composeTryOn } = await import("../tryon.js");
  const canvas = await composeTryOn(bodyCanvas, jewelryCanvas, target, type);
  return { canvas, path: arRenderer?.hasGlb ? "glb-failed-fallback" : "fallback-25d" };
}
