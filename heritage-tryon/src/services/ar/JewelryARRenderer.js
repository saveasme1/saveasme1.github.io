/**
 * Transparent Three.js overlay for live AR jewelry preview + high-quality still.
 * Falls back silently when WebGL/GLB unavailable — caller uses 2.5D compose.
 */
import { createWristOccluder, createFingerOccluder, syncOccluderToWrist } from "./OcclusionManager.js";
import { resolveModelUrl, tryLoadGltf } from "./JewelryAssetLoader.js";
import { detectQualityTier } from "./QualityManager.js";

const THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

export class JewelryARRenderer {
  /**
   * @param {HTMLElement} mount — usually cameraGuide or viewport
   */
  constructor(mount) {
    this.mount = mount;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "ar-three-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    mount.appendChild(this.canvas);
    this.THREE = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.jewelry = null;
    this.occluder = null;
    this.productId = null;
    this.meta = null;
    this.tier = detectQualityTier();
    this._ready = false;
    this._raf = 0;
    this._disposed = false;
  }

  async init() {
    if (this._ready || this._disposed) return this._ready;
    try {
      this.THREE = await import(/* @vite-ignore */ THREE_CDN);
      const THREE = this.THREE;
      const dpr = Math.min(this.tier === "HIGH" ? 2 : 1.5, window.devicePixelRatio || 1);
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: this.tier !== "LOW",
        preserveDrawingBuffer: true,
      });
      this.renderer.setPixelRatio(dpr);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
      this.camera.position.set(0, 0, 2.2);
      const amb = new THREE.AmbientLight(0xffffff, 0.65);
      const key = new THREE.DirectionalLight(0xfff0dd, 1.1);
      key.position.set(0.6, 1.2, 1.4);
      const fill = new THREE.DirectionalLight(0xc8d8ff, 0.35);
      fill.position.set(-0.8, 0.2, 0.6);
      this.scene.add(amb, key, fill);
      this._ready = true;
      this.resize();
      return true;
    } catch (err) {
      console.warn("JewelryARRenderer init failed", err);
      this._ready = false;
      return false;
    }
  }

  resize() {
    if (!this.renderer || !this.mount) return;
    const r = this.mount.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width));
    const h = Math.max(1, Math.floor(r.height));
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.renderer.setSize(w, h, false);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  async loadProduct(productId, meta) {
    this.productId = productId;
    this.meta = meta;
    if (!this._ready) await this.init();
    if (!this._ready) return false;
    const THREE = this.THREE;
    if (this.jewelry) {
      this.scene.remove(this.jewelry);
      this.jewelry = null;
    }
    const url = resolveModelUrl(productId, meta, this.tier === "HIGH" ? "high" : "medium");
    let root = url ? await tryLoadGltf(THREE, url) : null;
    if (!root) {
      // Procedural torus twin — shape placeholder only until GLB ships
      const geo = new THREE.TorusGeometry(0.55, 0.07, 16, 48);
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0xd4af77,
        metalness: 0.92,
        roughness: 0.28,
        clearcoat: 0.4,
      });
      root = new THREE.Mesh(geo, mat);
      root.rotation.x = Math.PI / 2;
    }
    this.jewelry = root;
    this.scene.add(root);
    if (!this.occluder) {
      this.occluder = createWristOccluder(THREE);
      this.scene.add(this.occluder);
    }
    return Boolean(url);
  }

  ensureFingerOccluder() {
    if (!this._ready || this.occluder) return;
    this.occluder = createFingerOccluder(this.THREE);
    this.scene.add(this.occluder);
  }

  /**
   * Place jewelry from WristAnchor3D / FingerAnchor3D (normalized).
   */
  updateFromAnchor(type, anchor) {
    if (!this._ready || !anchor || !this.jewelry) return;
    this.resize();
    const world = 2.0;
    const c = anchor.center2D || anchor.center;
    const x = (c.x - 0.5) * world;
    const y = -(c.y - 0.5) * world;
    const z = -((anchor.center3D?.z || 0) * 0.5);
    this.jewelry.position.set(x, y, z);
    if (anchor.rotationQuaternion) {
      const q = anchor.rotationQuaternion;
      this.jewelry.quaternion.set(q.x, q.y, q.z, q.w);
    } else if (anchor.angle != null) {
      this.jewelry.rotation.set(Math.PI / 2, 0, (anchor.angle * Math.PI) / 180);
    }
    const scale =
      type === "bracelet"
        ? Math.max(0.15, (anchor.radiusX || 0.06) * world * 6)
        : Math.max(0.08, (anchor.radiusEstimate || anchor.width || 0.03) * world * 8);
    const clampRange = this.meta?.allowedScaleRange || [0.96, 1.04];
    const s = Math.min(clampRange[1], Math.max(clampRange[0], 1)) * scale * (this.meta?.defaultScale || 1);
    this.jewelry.scale.setScalar(s);

    if (type === "bracelet") {
      syncOccluderToWrist(this.occluder, anchor, world);
    } else {
      this.ensureFingerOccluder();
      syncOccluderToWrist(this.occluder, {
        ...anchor,
        radiusX: anchor.radiusEstimate || 0.02,
        radiusY: (anchor.radiusEstimate || 0.02) * 0.85,
      }, world);
    }
  }

  render() {
    if (!this._ready || !this.renderer) return;
    this.renderer.render(this.scene, this.camera);
  }

  /** High-quality still for save path — returns canvas or null */
  renderStill(width, height) {
    if (!this._ready) return null;
    const prev = this.renderer.getSize(new this.THREE.Vector2());
    const pr = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    const snap = document.createElement("canvas");
    snap.width = width;
    snap.height = height;
    snap.getContext("2d").drawImage(this.canvas, 0, 0, width, height);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(prev.x, prev.y, false);
    return snap;
  }

  dispose() {
    this._disposed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    this.scene = null;
    this.camera = null;
    this.jewelry = null;
    this.occluder = null;
    this.canvas?.remove();
    this._ready = false;
  }
}
