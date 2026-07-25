/**
 * Production Three.js jewelry AR overlay.
 * - Real GLB only (no runtime TorusGeometry as product)
 * - Depth-only occlusion pass connected every frame
 * - Screen-aligned projection from normalized anchors
 * - High-resolution still re-render for save
 */
import { createWristOccluder, createFingerOccluder } from "./OcclusionManager.js";
import { tryLoadGltf } from "./JewelryAssetLoader.js";
import { resolveJewelryAsset, ASSET_STATES } from "./AssetResolver.js";
import { detectQualityTier, QualityManager } from "./QualityManager.js";
import { applyMaterialPreset } from "./MaterialPresets.js";
import { estimateLightingFromVideo } from "./LightingEstimator.js";
import { fitBracelet } from "./BraceletFitter3D.js";
import { fitRing } from "./RingFitter3D.js";
import { fitNecklaceWithChain, syncNecklaceChainMesh } from "./NecklaceChain.js";
import { EarringPhysics } from "./EarringPhysics.js";

const THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

export class JewelryARRenderer {
  /**
   * @param {HTMLElement} mount
   * @param {{ debug?: boolean }} opts
   */
  constructor(mount, opts = {}) {
    this.mount = mount;
    this.debug = Boolean(opts.debug);
    this.canvas = document.createElement("canvas");
    this.canvas.className = "ar-three-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    mount.appendChild(this.canvas);

    this.THREE = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.jewelryRoot = null;
    this.jewelry = null;
    this.jewelrySecondary = null; // pair earring
    this.occluder = null;
    this.occluderSecondary = null;
    this.contactShadow = null;
    this.keyLight = null;
    this.fillLight = null;
    this.ambLight = null;

    this.productId = null;
    this.meta = null;
    this.mode = "bracelet";
    this.hasGlb = false;
    this.assetState = ASSET_STATES.UNAVAILABLE;
    this.assetReason = "";
    this.quality = new QualityManager();
    this.tier = this.quality.tier;
    this.earringPhysics = new EarringPhysics();
    this.chainGroup = null;
    this.debugFlags = {
      showOccluder: false,
      jewelryOnly: false,
      disableOcclusion: false,
    };
    this._livePivotNorm = null;
    this._saveConsistency = null;

    this._ready = false;
    this._disposed = false;
    this._lastFps = 0;
    this._frames = 0;
    this._fpsT0 = performance.now();
    this._renderMs = 0;
    this._triangleCount = 0;
    this._lastAnchor = null;
    this._lastLighting = null;
    this._projectionError = null;
    this._glbLoadMs = 0;
    this._visible = true;
  }

  async init() {
    if (this._ready || this._disposed) return this._ready;
    try {
      this.THREE = await import(/* @vite-ignore */ THREE_CDN);
      const THREE = this.THREE;
      const dprCap = this.tier === "HIGH" ? 2 : this.tier === "MEDIUM" ? 1.5 : 1;
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: this.tier !== "LOW" && this.tier !== "FALLBACK",
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
      this.renderer.setPixelRatio(Math.min(dprCap, window.devicePixelRatio || 1));
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.renderer.autoClear = false;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 50);
      this.camera.position.set(0, 0, 1.6);

      this.ambLight = new THREE.AmbientLight(0xffffff, 0.55);
      this.keyLight = new THREE.DirectionalLight(0xfff2dd, 1.15);
      this.keyLight.position.set(0.55, 1.1, 1.2);
      this.fillLight = new THREE.DirectionalLight(0xc8d4ff, 0.4);
      this.fillLight.position.set(-0.7, 0.3, 0.5);
      this.scene.add(this.ambLight, this.keyLight, this.fillLight);

      // soft contact shadow disc
      const shGeo = new THREE.CircleGeometry(1, 32);
      const shMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      });
      this.contactShadow = new THREE.Mesh(shGeo, shMat);
      this.contactShadow.rotation.x = -Math.PI / 2;
      this.contactShadow.visible = false;
      this.scene.add(this.contactShadow);

      this.jewelryRoot = new THREE.Group();
      this.scene.add(this.jewelryRoot);

      this._ready = true;
      this.resize();
      return true;
    } catch (err) {
      console.warn("JewelryARRenderer.init failed", err);
      this._ready = false;
      return false;
    }
  }

  setVisible(v) {
    this._visible = Boolean(v);
    this.canvas.style.visibility = this._visible ? "visible" : "hidden";
  }

  resize(width, height) {
    if (!this.renderer || !this.mount) return;
    const r = this.mount.getBoundingClientRect();
    const w = Math.max(1, Math.floor(width || r.width));
    const h = Math.max(1, Math.floor(height || r.height));
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.renderer.setSize(w, h, false);
    if (this.camera) {
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Resolve asset via AssetResolver then load GLB.
   * Returns { ok, state, reason }. Never uses torus. Never leaks validation into production.
   */
  async loadProductForSku(itemId, mode = "bracelet", resolveOpts = {}) {
    this.mode = mode;
    const t0 = performance.now();
    if (!this._ready) await this.init();
    if (!this._ready) {
      this.hasGlb = false;
      this.assetState = ASSET_STATES.UNAVAILABLE;
      return { ok: false, state: this.assetState, reason: "webgl_init_failed" };
    }

    const resolution = await resolveJewelryAsset({
      itemId,
      wearType: mode,
      allowValidation: Boolean(resolveOpts.allowValidation),
      allowRepresentative: Boolean(resolveOpts.allowRepresentative),
      forceValidation: Boolean(resolveOpts.forceValidation),
      tier: this.tier === "HIGH" ? "high" : this.tier === "LOW" || this.tier === "FALLBACK" ? "low" : "medium",
    });

    this.assetState = resolution.state;
    this.assetReason = resolution.reason;
    this.productId = resolution.productId;
    this.meta = resolution.meta;
    this._clearJewelry();
    this._clearChain();

    if (
      resolution.state === ASSET_STATES.FALLBACK_25D ||
      resolution.state === ASSET_STATES.UNAVAILABLE ||
      !resolution.modelUrl
    ) {
      this.hasGlb = false;
      this._glbLoadMs = performance.now() - t0;
      return { ok: false, state: resolution.state, reason: resolution.reason };
    }

    const THREE = this.THREE;
    const root = await tryLoadGltf(THREE, resolution.modelUrl);
    this._glbLoadMs = performance.now() - t0;
    if (!root) {
      this.hasGlb = false;
      this.assetState = ASSET_STATES.FALLBACK_25D;
      this.assetReason = `${resolution.reason}|gltf_parse_failed`;
      return { ok: false, state: this.assetState, reason: this.assetReason };
    }

    applyMaterialPreset(THREE, root, this.meta.materialPreset || "yellow-gold-polished", "live");
    this._applyMetaOffsets(root, this.meta);
    this.jewelry = root;
    this.jewelryRoot.add(root);
    this._triangleCount = this._countTriangles(root);
    this._ensureOccluder(mode);
    if (mode === "necklace") {
      this.chainGroup = new THREE.Group();
      this.scene.add(this.chainGroup);
    }
    this.earringPhysics.reset();
    this.hasGlb = true;
    return { ok: true, state: resolution.state, reason: resolution.reason };
  }

  /** @deprecated use loadProductForSku — kept for call-site migration */
  async loadProduct(productId, mode = "bracelet") {
    const r = await this.loadProductForSku(productId, mode, {
      allowValidation: isValidationAllowedDefault(),
      allowRepresentative: false,
    });
    return r.ok;
  }

  setDebugFlags(flags = {}) {
    Object.assign(this.debugFlags, flags);
    if (this.occluder?.material) {
      // wireframe-ish visibility when showOccluder
      this.occluder.material.colorWrite = Boolean(this.debugFlags.showOccluder);
    }
  }

  _clearChain() {
    if (this.chainGroup) {
      this.scene.remove(this.chainGroup);
      this._disposeObject(this.chainGroup);
      this.chainGroup = null;
    }
  }

  _applyMetaOffsets(root, meta) {
    const rot = meta.rotationOffset || [0, 0, 0];
    root.rotation.set(
      (rot[0] * Math.PI) / 180,
      (rot[1] * Math.PI) / 180,
      (rot[2] * Math.PI) / 180
    );
    const pos = meta.positionOffset || [0, 0, 0];
    root.position.set(pos[0], pos[1], pos[2]);
  }

  _countTriangles(root) {
    let n = 0;
    root.traverse((o) => {
      if (o.isMesh && o.geometry) {
        const idx = o.geometry.index;
        const pos = o.geometry.attributes.position;
        n += idx ? idx.count / 3 : (pos?.count || 0) / 3;
      }
    });
    return Math.round(n);
  }

  _clearJewelry() {
    if (this.jewelry) {
      this.jewelryRoot.remove(this.jewelry);
      this._disposeObject(this.jewelry);
      this.jewelry = null;
    }
    if (this.jewelrySecondary) {
      this.jewelryRoot.remove(this.jewelrySecondary);
      this._disposeObject(this.jewelrySecondary);
      this.jewelrySecondary = null;
    }
  }

  _disposeObject(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
        else o.material.dispose?.();
      }
    });
  }

  _ensureOccluder(mode) {
    const THREE = this.THREE;
    if (this.occluder) {
      this.scene.remove(this.occluder);
      this._disposeObject(this.occluder);
      this.occluder = null;
    }
    if (mode === "bracelet") this.occluder = createWristOccluder(THREE, { radiusX: 1, radiusY: 0.72, length: 1.1 });
    else if (mode === "ring") this.occluder = createFingerOccluder(THREE, { radius: 0.35, length: 0.85 });
    else if (mode === "necklace") this.occluder = createWristOccluder(THREE, { radiusX: 1.2, radiusY: 0.9, length: 1.4 });
    else if (mode === "earring") this.occluder = createFingerOccluder(THREE, { radius: 0.55, length: 1.2 });
    if (this.occluder) {
      this.occluder.visible = true;
      this.scene.add(this.occluder);
    }
  }

  /**
   * Map normalized image point (0..1) to Three.js world at given depth along camera forward.
   */
  normalizedToWorld(nx, ny, depth = 1.35) {
    const THREE = this.THREE;
    const ndcX = nx * 2 - 1;
    const ndcY = -(ny * 2 - 1);
    const v = new THREE.Vector3(ndcX, ndcY, 0.5);
    v.unproject(this.camera);
    const dir = v.sub(this.camera.position).normalize();
    return this.camera.position.clone().add(dir.multiplyScalar(depth));
  }

  worldToNormalized(worldPos) {
    const THREE = this.THREE;
    const v = worldPos.clone().project(this.camera);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  }

  applyLighting(video) {
    const L = estimateLightingFromVideo(video);
    this._lastLighting = L;
    if (!this.keyLight) return;
    const intensity = 0.7 + L.luminance * 0.7;
    this.keyLight.intensity = intensity;
    this.ambLight.intensity = 0.35 + L.luminance * 0.4;
    this.keyLight.position.set(
      L.highlightDir.x * 1.2,
      0.4 + L.highlightDir.y,
      0.8 + L.highlightDir.z
    );
    const warm = L.temperature;
    this.keyLight.color.setRGB(1, 0.92 + warm * 0.06, 0.82 + (1 - warm) * 0.1);
    if (this.renderer) {
      this.renderer.toneMappingExposure = 0.9 + L.luminance * 0.35;
    }
  }

  /**
   * Update jewelry + occluder from stabilized anchor.
   * @returns {{ fitWarning?: boolean }|null}
   */
  updateFromAnchor(mode, anchor, extras = {}) {
    if (!this._ready || !this.hasGlb || !this.jewelry || !anchor) return null;
    this.mode = mode;
    this._lastAnchor = anchor;
    this.resize();

    const c = anchor.center2D || anchor.center || anchor.attachment2D;
    if (!c) return null;

    const depth = 1.2 + Math.max(-0.25, Math.min(0.35, -(anchor.center3D?.z || 0) * 0.8));
    const world = this.normalizedToWorld(c.x, c.y, depth);
    this.jewelryRoot.position.copy(world);

    if (anchor.rotationQuaternion) {
      const q = anchor.rotationQuaternion;
      this.jewelryRoot.quaternion.set(q.x, q.y, q.z, q.w);
    } else if (anchor.angle != null) {
      this.jewelryRoot.rotation.set(Math.PI / 2, 0, (anchor.angle * Math.PI) / 180);
    }

    let fit = null;
    if (mode === "bracelet") fit = fitBracelet(anchor, this.meta || {});
    else if (mode === "ring") fit = fitRing(anchor, this.meta || {});
    else if (mode === "necklace") {
      fit = fitNecklaceWithChain(anchor, this.meta || {}, this.tier);
      if (fit?.pendant?.center2D) {
        const pc = fit.pendant.center2D;
        const pw = this.normalizedToWorld(pc.x, pc.y, depth);
        this.jewelryRoot.position.copy(pw);
      }
      if (this.chainGroup && fit) {
        const mat = this.jewelry?.children?.[0]?.material;
        syncNecklaceChainMesh(
          this.THREE,
          this.chainGroup,
          fit,
          (x, y, d) => this.normalizedToWorld(x, y, d),
          { radius: 0.006 * (fit.productScale || 1), material: mat }
        );
      }
    } else if (mode === "earring") {
      const pose = this.earringPhysics.update(anchor, this.meta || {});
      if (pose && this.jewelry) {
        this.jewelry.rotation.x = pose.angleX;
        this.jewelry.rotation.z = pose.angleZ;
      }
      if ((anchor.visibility ?? 1) < 0.35) {
        this.jewelryRoot.visible = false;
      } else {
        this.jewelryRoot.visible = !this.debugFlags.jewelryOnly ? true : true;
        this.jewelryRoot.visible = true;
      }
    }

    const baseScale =
      mode === "bracelet"
        ? Math.max(0.04, (fit?.fittedRadiusX || anchor.radiusX || 0.06) * 1.85)
        : mode === "ring"
          ? Math.max(0.02, (fit?.fittedRadius || anchor.radiusEstimate || 0.02) * 2.4)
          : mode === "necklace"
            ? Math.max(0.08, (anchor.scale || anchor.shoulderWidth || 0.25) * 0.55)
            : Math.max(0.03, (anchor.earScale || anchor.scale || 0.08) * 1.1);

    const [lo, hi] = this.meta?.allowedScaleRange || [0.94, 1.06];
    const metaScale = this.meta?.defaultScale || 1;
    let s = baseScale * metaScale;
    // uniform only — clamp relative to default base, not distort
    const ref = baseScale * metaScale;
    s = Math.min(ref * hi, Math.max(ref * lo, s));
    this.jewelryRoot.scale.setScalar(s);

    // projection error for debug (viewport-normalized → approximate px using mount width)
    const projected = this.worldToNormalized(this.jewelryRoot.position);
    const box = this.mount.getBoundingClientRect();
    const errNorm = Math.hypot(projected.x - c.x, projected.y - c.y);
    this._projectionError = {
      target: { x: c.x, y: c.y },
      projected,
      pxError: errNorm * box.width,
      normError: errNorm,
    };
    this._livePivotNorm = { ...projected, scale: s };

    this._syncOccluder(mode, anchor, world, s);
    this._syncContactShadow(world, s, mode);

    // secondary earring
    if (mode === "earring" && extras.secondaryAnchor && this.jewelrySecondary) {
      const c2 = extras.secondaryAnchor.attachment2D || extras.secondaryAnchor.center2D;
      if (c2) {
        const w2 = this.normalizedToWorld(c2.x, c2.y, depth);
        this.jewelrySecondary.position.copy(w2);
        if (extras.secondaryAnchor.rotationQuaternion) {
          const q = extras.secondaryAnchor.rotationQuaternion;
          this.jewelrySecondary.quaternion.set(q.x, q.y, q.z, q.w);
        }
        this.jewelrySecondary.scale.setScalar(s);
        this.jewelrySecondary.visible = (extras.secondaryAnchor.visibility ?? 1) > 0.35;
      }
    }

    return { fitWarning: fit ? !fit.sizeFit : false, projectionError: this._projectionError };
  }

  _syncOccluder(mode, anchor, world, scale) {
    if (!this.occluder) return;
    this.occluder.position.copy(world);
    if (anchor.rotationQuaternion) {
      const q = anchor.rotationQuaternion;
      this.occluder.quaternion.set(q.x, q.y, q.z, q.w);
    } else {
      this.occluder.quaternion.copy(this.jewelryRoot.quaternion);
    }
    if (mode === "bracelet") {
      const rx = (anchor.radiusX || 0.06) * 14;
      const ry = (anchor.radiusY || 0.04) * 14;
      this.occluder.scale.set(rx, scale * 2.2, ry);
    } else if (mode === "ring") {
      const r = (anchor.radiusEstimate || 0.02) * 18;
      this.occluder.scale.set(r, scale * 2.5, r * 0.9);
    } else if (mode === "necklace") {
      this.occluder.scale.set(scale * 3.2, scale * 2.4, scale * 2.2);
    } else {
      this.occluder.scale.set(scale * 2.8, scale * 3.5, scale * 2.5);
    }
  }

  _syncContactShadow(world, scale, mode) {
    if (!this.contactShadow) return;
    this.contactShadow.visible = true;
    this.contactShadow.position.set(world.x, world.y - scale * 0.08, world.z + 0.01);
    const r = mode === "bracelet" ? scale * 1.1 : mode === "ring" ? scale * 0.7 : scale * 0.9;
    this.contactShadow.scale.set(r, r, 1);
    this.contactShadow.material.opacity = this.tier === "HIGH" ? 0.26 : 0.18;
  }

  /**
   * Connected occlusion + jewelry render pass.
   */
  render() {
    if (!this._ready || !this.renderer || !this.hasGlb || !this._visible) return;
    const t0 = performance.now();
    const r = this.renderer;
    r.autoClear = false;
    r.clear(true, true, true);

    const disableOcc = this.debugFlags.disableOcclusion;
    if (this.occluder) {
      this.occluder.material.colorWrite = Boolean(this.debugFlags.showOccluder);
      this.occluder.visible = !disableOcc || this.debugFlags.showOccluder;
    }

    // Pass 1: depth-only occluder
    if (this.occluder && !disableOcc) {
      const wasJewelry = this.jewelryRoot.visible;
      const wasShadow = this.contactShadow?.visible;
      const wasChain = this.chainGroup?.visible;
      this.jewelryRoot.visible = false;
      if (this.contactShadow) this.contactShadow.visible = false;
      if (this.chainGroup) this.chainGroup.visible = false;
      this.occluder.visible = true;
      r.render(this.scene, this.camera);
      this.jewelryRoot.visible = wasJewelry;
      if (this.contactShadow) this.contactShadow.visible = wasShadow;
      if (this.chainGroup) this.chainGroup.visible = wasChain !== false;
    }

    // Pass 2: jewelry + soft shadow
    if (this.debugFlags.jewelryOnly && this.occluder) this.occluder.visible = false;
    r.render(this.scene, this.camera);

    this._renderMs = performance.now() - t0;
    this._frames += 1;
    const now = performance.now();
    if (now - this._fpsT0 >= 1000) {
      this._lastFps = this._frames;
      this.quality.noteFps(this._lastFps);
      this.tier = this.quality.tier;
      this._frames = 0;
      this._fpsT0 = now;
    }
  }

  clearFrame() {
    if (!this.renderer) return;
    this.renderer.autoClear = true;
    this.renderer.clear(true, true, true);
  }

  getDebugStats() {
    return {
      fps: this._lastFps,
      renderMs: this._renderMs,
      glbLoadMs: this._glbLoadMs,
      triangles: this._triangleCount,
      tier: this.tier,
      hasGlb: this.hasGlb,
      assetState: this.assetState,
      assetReason: this.assetReason,
      productId: this.productId,
      projectionError: this._projectionError,
      saveConsistency: this._saveConsistency,
      lighting: this._lastLighting,
      mode: this.mode,
    };
  }

  /**
   * High-resolution transparent jewelry layer for save composite.
   */
  renderStillLayer(width, height, mode, anchor, extras = {}) {
    if (!this._ready || !this.hasGlb || !anchor) return null;
    const THREE = this.THREE;
    const prevSize = new THREE.Vector2();
    this.renderer.getSize(prevSize);
    const prevPr = this.renderer.getPixelRatio();
    const pr = Math.min(2, window.devicePixelRatio || 1);

    if (mode === "earring") this.earringPhysics.freeze();
    if (this.jewelry && this.meta) {
      applyMaterialPreset(THREE, this.jewelry, this.meta.materialPreset || "yellow-gold-polished", "save");
    }

    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();

    const livePivot = this._livePivotNorm ? { ...this._livePivotNorm } : null;
    this.updateFromAnchor(mode, anchor, extras);
    this.render();
    const savePivot = this.worldToNormalized(this.jewelryRoot.position);
    this._saveConsistency = {
      livePivot,
      savePivot,
      positionDeltaNorm: livePivot
        ? Math.hypot(savePivot.x - livePivot.x, savePivot.y - livePivot.y)
        : null,
      scaleDelta: livePivot ? Math.abs((this.jewelryRoot.scale.x || 1) - (livePivot.scale || 1)) : null,
    };

    const snap = document.createElement("canvas");
    snap.width = width;
    snap.height = height;
    snap.getContext("2d").drawImage(this.canvas, 0, 0, width, height);

    if (this.jewelry && this.meta) {
      applyMaterialPreset(THREE, this.jewelry, this.meta.materialPreset || "yellow-gold-polished", "live");
    }
    this.renderer.setPixelRatio(prevPr);
    this.renderer.setSize(prevSize.x, prevSize.y, false);
    this.camera.aspect = prevSize.x / Math.max(1, prevSize.y);
    this.camera.updateProjectionMatrix();
    return snap;
  }

  /**
   * Composite high-res jewelry onto body canvas. Returns new canvas.
   */
  composeHighRes(bodyCanvas, mode, anchor, extras = {}) {
    const layer = this.renderStillLayer(bodyCanvas.width, bodyCanvas.height, mode, anchor, extras);
    if (!layer) return null;
    const out = document.createElement("canvas");
    out.width = bodyCanvas.width;
    out.height = bodyCanvas.height;
    const ctx = out.getContext("2d");
    ctx.drawImage(bodyCanvas, 0, 0);
    ctx.drawImage(layer, 0, 0);
    return out;
  }

  async ensurePairClone() {
    if (!this.hasGlb || !this.jewelry || this.jewelrySecondary) return;
    this.jewelrySecondary = this.jewelry.clone(true);
    this.jewelryRoot.add(this.jewelrySecondary);
  }

  dispose() {
    this._disposed = true;
    this._clearJewelry();
    this._clearChain();
    if (this.occluder) {
      this.scene?.remove(this.occluder);
      this._disposeObject(this.occluder);
    }
    if (this.contactShadow) {
      this.scene?.remove(this.contactShadow);
      this.contactShadow.geometry?.dispose();
      this.contactShadow.material?.dispose();
    }
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.canvas?.remove();
    this._ready = false;
    this.hasGlb = false;
  }
}

function isValidationAllowedDefault() {
  try {
    const p = new URLSearchParams(location.search);
    return p.get("arDebug") === "1" && p.get("arValidation") === "1";
  } catch (_) {
    return false;
  }
}

/**
 * @deprecated Prefer loadProductForSku + AssetResolver.
 * Returns SKU id only — does NOT map production items to validation GLBs.
 */
export function resolveArProductId(itemId, wearType) {
  if (itemId && itemId !== "portfolio-item") return itemId;
  return itemId || `unresolved-${wearType}`;
}
