/**
 * Phase 1 — edge feather + soft lighting harmonize on composed still.
 */
import { sampleSkinTone } from "./PartOcclusionMask.js";

/**
 * Soften jewelry edges and tint metal toward scene lighting (skin luminance).
 * Operates on full composed canvas; keeps body pixels mostly intact.
 */
export function harmonizeCompose(composed, bodyCanvas, target, mode = "bracelet") {
  if (!composed || !bodyCanvas) return composed;
  const W = composed.width;
  const H = composed.height;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const octx = out.getContext("2d");
  octx.drawImage(composed, 0, 0);

  const skin = sampleSkinTone(bodyCanvas, target, mode);
  if (!skin) return out;

  // Soft contact shadow near attachment (all modes)
  const c = target?.center || target?.center2D;
  if (c) {
    const cx = c.x <= 1.5 && Math.max(c.x, c.y) <= 1.5 ? c.x * W : c.x;
    const cy = c.y <= 1.5 && Math.max(c.x, c.y) <= 1.5 ? c.y * H : c.y;
    const rw =
      target.width != null
        ? target.width <= 1.5
          ? target.width * W
          : target.width
        : mode === "ring"
          ? W * 0.06
          : mode === "earring"
            ? W * 0.03
            : W * 0.18;
    octx.save();
    octx.globalCompositeOperation = "multiply";
    const g = octx.createRadialGradient(cx, cy + rw * 0.08, rw * 0.15, cx, cy + rw * 0.1, rw * 0.55);
    const shadowA = mode === "earring" ? 0.12 : 0.18;
    g.addColorStop(0, `rgba(40,28,20,${shadowA})`);
    g.addColorStop(1, "rgba(40,28,20,0)");
    octx.fillStyle = g;
    octx.fillRect(cx - rw, cy - rw, rw * 2, rw * 2);
    octx.restore();
  }

  // Mild color grade toward scene warmth (screen-wide very light)
  octx.save();
  octx.globalCompositeOperation = "soft-light";
  octx.globalAlpha = 0.12 + Math.min(0.1, Math.abs(skin.lum - 0.5) * 0.25);
  octx.fillStyle = `rgb(${skin.r | 0},${skin.g | 0},${skin.b | 0})`;
  octx.fillRect(0, 0, W, H);
  octx.restore();

  // Edge soften: slight blur of difference layer is expensive; use light canvas filter pass on a inset copy
  const soft = document.createElement("canvas");
  soft.width = W;
  soft.height = H;
  const sctx = soft.getContext("2d");
  sctx.filter = "blur(0.6px)";
  sctx.drawImage(out, 0, 0);
  sctx.filter = "none";
  octx.globalAlpha = 0.35;
  octx.drawImage(soft, 0, 0);
  octx.globalAlpha = 1;

  return out;
}
