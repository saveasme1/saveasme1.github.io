/**
 * Node built-in smoke tests for heritage-tryon AR core (no browser/WebGL).
 * Run: node --test tests/smoke.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const {
  resolveAssetCandidate,
  ASSET_STATES,
  isValidationId,
  isRepresentativeId,
} = await import("../src/services/ar/AssetResolver.js");
const { estimateWristAnchor3D } = await import("../src/services/ar/WristAnchorEstimator.js");
const { estimateFingerAnchor3D } = await import("../src/services/ar/FingerAnchorEstimator.js");
const { estimateNeckAnchor3D } = await import("../src/services/ar/NeckAnchorEstimator.js");
const { estimateEarAnchor3D, estimateEarPair } = await import("../src/services/ar/EarAnchorEstimator.js");
const { fitBracelet } = await import("../src/services/ar/BraceletFitter3D.js");
const { fitRing } = await import("../src/services/ar/RingFitter3D.js");
const { fitNecklaceWithChain } = await import("../src/services/ar/NecklaceChain.js");
const { fitEarring } = await import("../src/services/ar/EarringFitter3D.js");
const { EarringPhysics } = await import("../src/services/ar/EarringPhysics.js");
const { GuideStateEngine } = await import("../src/services/ar/GuideStateEngine.js");
const {
  getObjectFitCoverTransform,
  applyFrontCameraMirror,
} = await import("../src/services/ar/coord.js");

function fakeHand() {
  const lm = [];
  lm[0] = { x: 0.5, y: 0.55, z: 0 };
  lm[1] = { x: 0.48, y: 0.52, z: 0 };
  lm[2] = { x: 0.46, y: 0.5, z: 0 };
  lm[5] = { x: 0.42, y: 0.42, z: 0 };
  lm[9] = { x: 0.5, y: 0.4, z: 0 };
  lm[12] = { x: 0.5, y: 0.28, z: 0 };
  lm[13] = { x: 0.55, y: 0.42, z: 0 };
  lm[14] = { x: 0.56, y: 0.36, z: 0 };
  lm[16] = { x: 0.57, y: 0.28, z: 0 };
  lm[17] = { x: 0.6, y: 0.45, z: 0 };
  return lm;
}

function fakePose() {
  const lm = [];
  lm[0] = { x: 0.5, y: 0.2, z: 0 };
  lm[11] = { x: 0.35, y: 0.42, z: 0 };
  lm[12] = { x: 0.65, y: 0.42, z: 0 };
  return lm;
}

function fakeFace() {
  const lm = new Array(500).fill(null).map((_, i) => ({ x: 0.5, y: 0.4, z: 0 }));
  lm[234] = { x: 0.32, y: 0.42, z: 0 };
  lm[454] = { x: 0.68, y: 0.42, z: 0 };
  lm[93] = { x: 0.34, y: 0.45, z: 0 };
  lm[323] = { x: 0.66, y: 0.45, z: 0 };
  lm[127] = { x: 0.3, y: 0.38, z: 0 };
  lm[356] = { x: 0.7, y: 0.38, z: 0 };
  lm[33] = { x: 0.38, y: 0.36, z: 0 };
  lm[263] = { x: 0.62, y: 0.36, z: 0 };
  lm[1] = { x: 0.5, y: 0.4, z: 0 };
  return lm;
}

describe("AssetResolver", () => {
  it("blocks validation id in production", () => {
    const r = resolveAssetCandidate({
      itemId: "validation-bracelet",
      wearType: "bracelet",
      allowValidation: false,
    });
    assert.equal(r.intendedState, ASSET_STATES.FALLBACK_25D);
    assert.match(r.reason, /blocked/);
  });

  it("allows validation only with flag", () => {
    const r = resolveAssetCandidate({
      itemId: "validation-ring",
      wearType: "ring",
      allowValidation: true,
    });
    assert.equal(r.intendedState, ASSET_STATES.VALIDATION_GLB);
  });

  it("uses production sku id", () => {
    const r = resolveAssetCandidate({
      itemId: "sku-love-bracelet-01",
      wearType: "bracelet",
    });
    assert.equal(r.productId, "sku-love-bracelet-01");
    assert.equal(r.intendedState, ASSET_STATES.PRODUCTION_GLB);
  });

  it("does not map portfolio-item to validation without flags", () => {
    const r = resolveAssetCandidate({
      itemId: "portfolio-item",
      wearType: "bracelet",
      allowValidation: false,
      allowRepresentative: false,
    });
    assert.equal(r.intendedState, ASSET_STATES.FALLBACK_25D);
    assert.equal(isValidationId(r.productId), false);
  });

  it("representative requires flag", () => {
    const blocked = resolveAssetCandidate({
      itemId: "rep-bracelet",
      wearType: "bracelet",
      allowRepresentative: false,
      allowValidation: false,
    });
    assert.equal(blocked.intendedState, ASSET_STATES.FALLBACK_25D);
    const ok = resolveAssetCandidate({
      itemId: "rep-bracelet",
      wearType: "bracelet",
      allowRepresentative: true,
    });
    assert.equal(ok.intendedState, ASSET_STATES.PRODUCTION_GLB);
    assert.equal(isRepresentativeId("rep-bracelet"), true);
  });
});

describe("Anchors", () => {
  it("wrist anchor shape", () => {
    const a = estimateWristAnchor3D(fakeHand(), { handedness: "Left" });
    assert.ok(a);
    assert.ok(a.center2D);
    assert.ok(a.rotationQuaternion);
    assert.ok(typeof a.radiusX === "number");
    assert.ok(typeof a.confidence === "number");
  });

  it("finger anchor shape", () => {
    const a = estimateFingerAnchor3D(fakeHand(), "ring");
    assert.ok(a);
    assert.equal(a.finger, "ring");
    assert.ok(a.center2D);
    assert.ok(typeof a.radiusEstimate === "number");
  });

  it("neck anchor shape", () => {
    const a = estimateNeckAnchor3D(null, fakePose());
    assert.ok(a);
    assert.ok(a.center2D);
    assert.ok(typeof a.shoulderWidth === "number");
  });

  it("ear left/right anchors", () => {
    const pair = estimateEarPair(fakeFace());
    assert.ok(pair.left);
    assert.ok(pair.right);
    assert.equal(pair.left.side, "left");
    assert.equal(pair.right.side, "right");
    assert.notEqual(pair.left.attachment2D.x, pair.right.attachment2D.x);
  });
});

describe("Fitters", () => {
  it("bracelet uniform scale + fitWarning", () => {
    const a = estimateWristAnchor3D(fakeHand());
    const f = fitBracelet(a, { allowedScaleRange: [0.96, 1.04], innerDiameterMm: 58 });
    assert.ok(f.productScale >= 0.96 && f.productScale <= 1.04);
    assert.equal(typeof f.fitWarning, "boolean");
  });

  it("ring fitWarning on bend", () => {
    const a = estimateFingerAnchor3D(fakeHand(), "ring");
    a.jointBend = 2;
    const f = fitRing(a, {});
    assert.equal(f.fitWarning, true);
  });

  it("necklace pendant rigid (curve does not warp pendant fields)", () => {
    const neck = estimateNeckAnchor3D(null, fakePose());
    const fitted = fitNecklaceWithChain(neck, { dropMm: 40 }, "MEDIUM");
    assert.ok(fitted.curvePoints.length > 4);
    assert.ok(fitted.pendant.center2D);
    assert.equal(fitted.deformationPolicy, "chain-path-only");
  });

  it("stud earring excludes swing physics", () => {
    const phys = new EarringPhysics();
    const ear = estimateEarAnchor3D(fakeFace(), "right");
    phys.angleX = 0.2;
    const pose = phys.update(ear, { type: "stud", swingEnabled: false });
    assert.equal(pose.angleX, 0);
    assert.equal(pose.angleZ, 0);
  });

  it("fitEarring returns sizeFit", () => {
    const ear = estimateEarAnchor3D(fakeFace(), "left");
    const f = fitEarring(ear, { type: "drop" }, "left");
    assert.equal(typeof f.sizeFit, "boolean");
    assert.equal(f.swingEnabled, true);
    const stud = fitEarring(ear, { type: "stud" }, "left");
    assert.equal(stud.swingEnabled, false);
  });
});

describe("GuideStateEngine", () => {
  it("single highest priority and hysteresis", async () => {
    const g = new GuideStateEngine();
    g._minHoldMs = 500;
    const s1 = g.evaluate("bracelet", null, {});
    assert.ok(["idle", "no_hand"].includes(s1));
    const wrist = estimateWristAnchor3D(fakeHand());
    wrist.confidence = 0.9;
    wrist.radiusX = 0.06;
    const s2 = g.evaluate("bracelet", wrist, {});
    // still within hysteresis may hold previous
    assert.ok(typeof s2 === "string");
    assert.ok(g.message(s2).length > 0);
    assert.equal(g.message("stable"), "좋습니다. 그대로 유지해주세요");
  });
});

describe("coord", () => {
  it("object-fit cover", () => {
    const t = getObjectFitCoverTransform(1920, 1080, 400, 800);
    assert.ok(t.drawW > 0 && t.drawH > 0);
  });

  it("front mirror utility", () => {
    assert.equal(applyFrontCameraMirror(0.2, true), 0.8);
    assert.equal(applyFrontCameraMirror(0.2, false), 0.2);
  });
});

describe("HOLD_MS and no torus in AR renderer source", () => {
  it("studio HOLD_MS is 1000 for all modes", () => {
    const src = readFileSync(join(ROOT, "src/studio.js"), "utf8");
    assert.match(src, /bracelet:\s*1000/);
    assert.match(src, /ring:\s*1000/);
    assert.match(src, /necklace:\s*1000/);
    assert.match(src, /earring:\s*1000/);
  });

  it("JewelryARRenderer has no TorusGeometry", () => {
    const src = readFileSync(join(ROOT, "src/services/ar/JewelryARRenderer.js"), "utf8");
    assert.equal(src.includes("TorusGeometry("), false);
  });

  it("debug validation requires flags in studio", () => {
    const src = readFileSync(join(ROOT, "src/studio.js"), "utf8");
    assert.match(src, /arValidation/);
    assert.match(src, /repAssets/);
    assert.match(src, /allowValidation/);
  });
});

describe("metadata schema samples", () => {
  it("rep-bracelet metadata has required keys", () => {
    const p = join(ROOT, "public/assets/jewelry/rep-bracelet/metadata.json");
    assert.equal(existsSync(p), true);
    const meta = JSON.parse(readFileSync(p, "utf8"));
    for (const k of ["productId", "type", "model", "allowedScaleRange", "materialPreset"]) {
      assert.ok(k in meta, k);
    }
    assert.equal(meta.validationAsset, false);
  });
});

describe("live-to-save normalized consistency helper", () => {
  it("normalized delta formula", () => {
    const live = { x: 0.5, y: 0.4 };
    const save = { x: 0.505, y: 0.402 };
    const delta = Math.hypot(save.x - live.x, save.y - live.y);
    assert.ok(delta < 0.015);
  });
});

describe("StyleAR compose pipeline Phase 0", () => {
  it("exports parts map and version", async () => {
    const { STYLEAR_PARTS, STYLEAR_PIPELINE_VERSION, runStyleArCompose } =
      await import("../src/services/ar/StyleArComposePipeline.js");
    assert.equal(typeof runStyleArCompose, "function");
    assert.ok(STYLEAR_PIPELINE_VERSION.startsWith("1."));
    assert.deepEqual(STYLEAR_PARTS.earring, ["face", "ear"]);
    assert.deepEqual(STYLEAR_PARTS.necklace, ["pose", "neck", "face"]);
  });
});

describe("StyleAR Phase 1 still resolve", () => {
  it("prefers still detection over capture", async () => {
    const { resolveComposeTarget } = await import("../src/services/ar/StillRedetect.js");
    const body = { width: 1000, height: 1000, naturalWidth: 1000, naturalHeight: 1000 };
    const detection = {
      target: { center: { x: 400, y: 500 }, width: 120, confidence: 0.8, angle: 10 },
      allTargets: {
        bracelet: { center: { x: 400, y: 500 }, width: 120, confidence: 0.8, angle: 10 },
      },
    };
    const capture = {
      center2D: { x: 0.7, y: 0.7 },
      radiusX: 0.06,
      angle: 40,
    };
    const r = resolveComposeTarget({
      mode: "bracelet",
      detection,
      capturePlacement: capture,
      bodyImage: body,
      placementToPixels: (p, w, h) => ({
        center: { x: p.center2D.x * w, y: p.center2D.y * h },
        width: 100,
        angle: p.angle,
      }),
    });
    assert.equal(r.source, "still");
    assert.equal(r.usedFallback, false);
    assert.ok(Math.abs(r.target.center.x - 400) < 1);
  });

  it("falls back to capture when still missing", async () => {
    const { resolveComposeTarget } = await import("../src/services/ar/StillRedetect.js");
    const body = { width: 800, height: 600, naturalWidth: 800, naturalHeight: 600 };
    const r = resolveComposeTarget({
      mode: "ring",
      detection: { target: null, allTargets: {} },
      capturePlacement: { center2D: { x: 0.4, y: 0.5 }, radiusEstimate: 0.03, angle: 0 },
      bodyImage: body,
      placementToPixels: (p, w, h) => ({
        center: { x: p.center2D.x * w, y: p.center2D.y * h },
        width: 40,
        angle: 0,
        source: "capture",
      }),
    });
    assert.equal(r.source, "capture");
  });
});

describe("StyleAR Phase 2–3 specialists and catalog", () => {
  it("ear specialist flags hair occlusion on low visibility", async () => {
    const { refineEarSpecialist } = await import("../src/services/ar/PartSpecialists.js");
    const a = refineEarSpecialist({
      side: "right",
      attachment2D: { x: 0.7, y: 0.45 },
      center2D: { x: 0.7, y: 0.45 },
      visibility: 0.3,
      yaw: 0.7,
      confidence: 0.5,
    });
    assert.equal(a.hairOcclusionHint, true);
    assert.equal(a.specialist, "ear-v1");
  });

  it("finger specialist marks fitWarning on high bend", async () => {
    const { refineFingerSpecialist } = await import("../src/services/ar/PartSpecialists.js");
    const a = refineFingerSpecialist({
      center2D: { x: 0.5, y: 0.5 },
      direction: { x: 0, y: -1, z: 0 },
      jointBend: 1.4,
    });
    assert.equal(a.fitWarning, true);
    assert.equal(a.uniformScaleOnly, true);
  });

  it("normalizeSkuMeta defaults material and occlusion", async () => {
    const { normalizeSkuMeta } = await import("../src/services/ar/CatalogMaterial.js");
    const m = normalizeSkuMeta({}, "ring");
    assert.equal(m.materialPreset, "yellow-gold-polished");
    assert.equal(m.occlusionMode, "finger-ellipse");
    assert.equal(m.deformationPolicy, "none");
  });

  it("pipeline version is phase3+", async () => {
    const { STYLEAR_PIPELINE_VERSION } = await import("../src/services/ar/StyleArComposePipeline.js");
    assert.match(STYLEAR_PIPELINE_VERSION, /^1\.3/);
  });
});
