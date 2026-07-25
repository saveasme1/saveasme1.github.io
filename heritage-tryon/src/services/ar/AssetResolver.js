/**
 * Explicit jewelry asset state machine.
 * States: production_glb | validation_glb | fallback_2_5d | unavailable
 *
 * Production SKUs MUST NEVER silently receive validation-* GLBs.
 */
import { loadJewelryMeta, resolveModelUrl } from "./JewelryAssetLoader.js";

export const ASSET_STATES = Object.freeze({
  PRODUCTION_GLB: "production_glb",
  VALIDATION_GLB: "validation_glb",
  FALLBACK_25D: "fallback_2_5d",
  UNAVAILABLE: "unavailable",
});

const VALIDATION_IDS = Object.freeze({
  bracelet: "validation-bracelet",
  ring: "validation-ring",
  necklace: "validation-necklace",
  earring: "validation-earring",
});

/** Representative QA SKUs — only when explicitly requested, never as silent substitute */
const REP_IDS = Object.freeze({
  bracelet: "rep-bracelet",
  ring: "rep-ring",
  necklace: "rep-necklace",
  earring: "rep-earring",
});

export function isValidationId(id) {
  return Boolean(id && String(id).startsWith("validation-"));
}

export function isRepresentativeId(id) {
  return Boolean(id && String(id).startsWith("rep-"));
}

/**
 * @param {{
 *   itemId: string,
 *   wearType: string,
 *   allowValidation?: boolean,
 *   allowRepresentative?: boolean,
 *   forceValidation?: boolean,
 * }} opts
 */
export function resolveAssetCandidate(opts) {
  const wearType = opts.wearType || "bracelet";
  const itemId = opts.itemId || "";
  const allowValidation = Boolean(opts.allowValidation);
  const allowRepresentative = Boolean(opts.allowRepresentative);
  const forceValidation = Boolean(opts.forceValidation);

  if (forceValidation && allowValidation) {
    return {
      productId: VALIDATION_IDS[wearType] || VALIDATION_IDS.bracelet,
      intendedState: ASSET_STATES.VALIDATION_GLB,
      reason: "explicit_validation_mode",
    };
  }

  if (itemId && isValidationId(itemId)) {
    if (!allowValidation) {
      return {
        productId: itemId,
        intendedState: ASSET_STATES.FALLBACK_25D,
        reason: "validation_id_blocked_in_production",
      };
    }
    return {
      productId: itemId,
      intendedState: ASSET_STATES.VALIDATION_GLB,
      reason: "validation_sku_allowed",
    };
  }

  if (itemId && isRepresentativeId(itemId)) {
    if (!allowRepresentative && !allowValidation) {
      return {
        productId: itemId,
        intendedState: ASSET_STATES.FALLBACK_25D,
        reason: "representative_blocked_without_flag",
      };
    }
    return {
      productId: itemId,
      intendedState: ASSET_STATES.PRODUCTION_GLB,
      reason: "representative_sku",
    };
  }

  if (itemId && itemId !== "portfolio-item") {
    return {
      productId: itemId,
      intendedState: ASSET_STATES.PRODUCTION_GLB,
      reason: "production_sku_id",
    };
  }

  // No SKU id — production must use 2.5D of the selected product photo, never validation GLB
  if (allowRepresentative) {
    return {
      productId: REP_IDS[wearType] || REP_IDS.bracelet,
      intendedState: ASSET_STATES.PRODUCTION_GLB,
      reason: "representative_fallback_for_qa",
    };
  }

  if (allowValidation) {
    return {
      productId: VALIDATION_IDS[wearType] || VALIDATION_IDS.bracelet,
      intendedState: ASSET_STATES.VALIDATION_GLB,
      reason: "dev_validation_fallback",
    };
  }

  return {
    productId: itemId || "portfolio-item",
    intendedState: ASSET_STATES.FALLBACK_25D,
    reason: "no_sku_glb_use_product_photo_25d",
  };
}

/**
 * Probe disk/CDN for meta + glb and return final AssetResolution.
 */
export async function resolveJewelryAsset(opts) {
  const candidate = resolveAssetCandidate(opts);
  const meta = await loadJewelryMeta(candidate.productId);

  if (!meta) {
    return {
      state: ASSET_STATES.FALLBACK_25D,
      productId: candidate.productId,
      meta: null,
      modelUrl: null,
      reason: `${candidate.reason}|meta_missing`,
      validationAsset: false,
    };
  }

  if (meta.validationAsset && !opts.allowValidation) {
    return {
      state: ASSET_STATES.FALLBACK_25D,
      productId: candidate.productId,
      meta,
      modelUrl: null,
      reason: "validation_meta_blocked",
      validationAsset: true,
    };
  }

  const modelUrl = resolveModelUrl(candidate.productId, meta, opts.tier || "medium");
  let glbOk = false;
  if (modelUrl) {
    try {
      const res = await fetch(modelUrl, { method: "HEAD", cache: "no-cache" });
      glbOk = res.ok;
      if (!glbOk) {
        const res2 = await fetch(modelUrl, { method: "GET", headers: { Range: "bytes=0-3" }, cache: "no-cache" });
        glbOk = res2.ok;
      }
    } catch (_) {
      glbOk = false;
    }
  }

  if (!glbOk) {
    return {
      state: ASSET_STATES.FALLBACK_25D,
      productId: candidate.productId,
      meta,
      modelUrl: null,
      reason: `${candidate.reason}|glb_missing`,
      validationAsset: Boolean(meta.validationAsset),
    };
  }

  const state = meta.validationAsset
    ? ASSET_STATES.VALIDATION_GLB
    : ASSET_STATES.PRODUCTION_GLB;

  return {
    state,
    productId: candidate.productId,
    meta,
    modelUrl,
    reason: candidate.reason,
    validationAsset: Boolean(meta.validationAsset),
  };
}

export function getValidationId(wearType) {
  return VALIDATION_IDS[wearType] || null;
}

export function getRepresentativeId(wearType) {
  return REP_IDS[wearType] || null;
}
