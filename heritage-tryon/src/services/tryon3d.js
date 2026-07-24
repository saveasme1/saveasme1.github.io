/**
 * Studio-grade WebGL try-on (Three.js PBR + depth occlusion).
 * Bracelet/ring: real 3D mesh posed from MediaPipe wrist frame, not a 2D sticker.
 */

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

let THREE = null;

async function loadThree() {
  if (THREE) return THREE;
  THREE = await import(THREE_URL);
  return THREE;
}

function avgMetalColor(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let r = 0, g = 0, b = 0, n = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 80));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 100) continue;
      if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 235) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  if (!n) return { r: 0.83, g: 0.68, b: 0.32 };
  return { r: (r / n) / 255, g: (g / n) / 255, b: (b / n) / 255 };
}

function sampleAmbient(bodyCanvas) {
  const ctx = bodyCanvas.getContext("2d", { willReadFrequently: true });
  const w = bodyCanvas.width;
  const h = bodyCanvas.height;
  const { data } = ctx.getImageData(0, 0, w, h);
  let r = 0, g = 0, b = 0, n = 0;
  const step = Math.max(4, Math.floor(Math.min(w, h) / 40));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  return {
    r: (r / n) / 255,
    g: (g / n) / 255,
    b: (b / n) / 255,
  };
}

function makeGoldMaterial(THREE, metal, ambient) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(metal.r, metal.g, metal.b),
    metalness: 1.0,
    roughness: 0.22,
    clearcoat: 0.55,
    clearcoatRoughness: 0.18,
    reflectivity: 1.0,
    envMapIntensity: 1.35,
    emissive: new THREE.Color(metal.r * 0.04, metal.g * 0.03, metal.b * 0.01),
    sheen: 0.2,
    sheenColor: new THREE.Color(ambient.r, ambient.g, ambient.b),
  });
}

/** Oval Love-style bracelet with tube + screw studs. */
function buildBraceletMesh(THREE, material, radius, tube) {
  const group = new THREE.Group();
  // Flattened oval torus (Love bracelet silhouette)
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 36, 160),
    material
  );
  torus.scale.set(1, 0.72, 1);
  torus.castShadow = true;
  torus.receiveShadow = true;
  group.add(torus);

  // Inner bevel ring for thickness cue
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(radius - tube * 0.15, tube * 0.55, 24, 120),
    material.clone()
  );
  inner.material.roughness = 0.28;
  inner.scale.set(1, 0.72, 1);
  group.add(inner);

  // Screw / stud accents around the front arc
  const studMat = material.clone();
  studMat.roughness = 0.35;
  studMat.metalness = 1;
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    // skip deep back studs slightly (still add a few for wrap feel)
    const stud = new THREE.Mesh(
      new THREE.CylinderGeometry(tube * 0.38, tube * 0.38, tube * 0.55, 12),
      studMat
    );
    const sx = Math.cos(t) * radius;
    const sy = Math.sin(t) * radius * 0.72;
    stud.position.set(sx, sy, 0);
    // orient stud outward
    stud.lookAt(sx * 2, sy * 2, 0);
    stud.rotateX(Math.PI / 2);
    group.add(stud);

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(tube * 0.42, 12, 12),
      studMat
    );
    cap.position.set(sx * 1.02, sy * 1.02, 0);
    group.add(cap);
  }

  return group;
}

function buildRingMesh(THREE, material, radius, tube) {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 28, 96),
    material
  );
  mesh.castShadow = true;
  return mesh;
}

function buildArmOccluder(THREE, length, radius) {
  let geo;
  try {
    geo = new THREE.CapsuleGeometry(radius, Math.max(length - radius * 2, radius), 8, 16);
  } catch (_) {
    geo = new THREE.CylinderGeometry(radius, radius * 0.95, length, 24);
  }
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  mat.colorWrite = false;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  return mesh;
}

function deg(n) {
  return (n * Math.PI) / 180;
}

/**
 * Pose bracelet in photo pixel space (Y-down image → Y-up Three).
 */
function poseFromTarget(THREE, target, imgW, imgH, kind) {
  const cx = target.center.x;
  const cy = target.center.y;
  const wristR = Math.max(8, (target.width || imgW * 0.2) * 0.42);
  const plane = deg(target.angle || 0);
  const front = deg(target.frontAngle != null ? target.frontAngle : (target.angle || 0) - 90);

  const x = cx - imgW / 2;
  const y = -(cy - imgH / 2);

  const group = new THREE.Group();
  group.position.set(x, y, 0);

  // Image Y-down angles → Three Y-up (negate).
  // 1) Lay torus in wrist plane (hole along forearm).
  // 2) Align across-wrist with landmark plane angle.
  // 3) Slight tilt so tube volume reads in photo.
  group.rotation.order = "ZYX";
  group.rotation.z = -plane;
  group.rotation.x = Math.PI / 2.2;
  group.rotation.y = -(front - plane) * 0.85;

  const tube = kind === "ring" ? wristR * 0.2 : wristR * 0.17;
  const major = kind === "ring" ? wristR * 0.58 : wristR * 1.02;
  return { group, major, tube, wristR };
}

/**
 * Render 3D jewelry onto body photo. Returns HTMLCanvasElement.
 */
export async function composeTryOn3D(bodyCanvas, jewelryCanvas, target, type = "bracelet") {
  const T = await loadThree();
  const w = bodyCanvas.width;
  const h = bodyCanvas.height;
  const kind = type === "ring" ? "ring" : "bracelet";

  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  const cam = new T.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 5000);
  cam.position.set(0, 0, 1200);
  cam.lookAt(0, 0, 0);

  const metal = avgMetalColor(jewelryCanvas);
  const ambient = sampleAmbient(bodyCanvas);
  const goldMat = makeGoldMaterial(T, metal, ambient);

  // Soft environment from photo colors (no external HDR dependency)
  const pmrem = new T.PMREMGenerator(renderer);
  const envScene = new T.Scene();
  envScene.add(new T.AmbientLight(new T.Color(ambient.r, ambient.g, ambient.b), 1.2));
  const sky = new T.Mesh(
    new T.SphereGeometry(10, 16, 16),
    new T.MeshBasicMaterial({
      side: T.BackSide,
      color: new T.Color(
        Math.min(1, ambient.r * 1.2 + 0.15),
        Math.min(1, ambient.g * 1.15 + 0.12),
        Math.min(1, ambient.b * 1.1 + 0.1)
      ),
    })
  );
  envScene.add(sky);
  const envTex = pmrem.fromScene(envScene, 0.04).texture;
  scene.environment = envTex;
  goldMat.envMap = envTex;

  const hemi = new T.HemisphereLight(
    new T.Color(Math.min(1, ambient.r + 0.35), Math.min(1, ambient.g + 0.32), Math.min(1, ambient.b + 0.3)),
    new T.Color(ambient.r * 0.4, ambient.g * 0.35, ambient.b * 0.3),
    1.05
  );
  scene.add(hemi);

  const key = new T.DirectionalLight(0xfff2dc, 2.1);
  key.position.set(-w * 0.15, h * 0.25, 900);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);

  const fill = new T.DirectionalLight(0xddeeff, 0.65);
  fill.position.set(w * 0.2, -h * 0.1, 700);
  scene.add(fill);

  const rim = new T.DirectionalLight(0xffffff, 0.55);
  rim.position.set(0, h * 0.2, -600);
  scene.add(rim);

  const posed = poseFromTarget(T, target, w, h, kind);
  const jewel =
    kind === "ring"
      ? buildRingMesh(T, goldMat, posed.major, posed.tube)
      : buildBraceletMesh(T, goldMat, posed.major, posed.tube);
  posed.group.add(jewel);

  // Forearm occluder (depth only) so band wraps / hides behind wrist
  const occluder = buildArmOccluder(T, posed.wristR * 5.5, posed.wristR * 0.92);
  occluder.rotation.x = Math.PI / 2;
  occluder.position.z = 0;
  // Match forearm: extend behind and forward from wrist
  occluder.scale.set(1, 1, 1);
  posed.group.add(occluder);

  // Contact shadow catcher (transparent dark disc on skin plane)
  const shadowMat = new T.ShadowMaterial({ opacity: 0.35 });
  const shadowPlane = new T.Mesh(new T.CircleGeometry(posed.wristR * 1.35, 48), shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.z = -posed.tube * 0.2;
  shadowPlane.receiveShadow = true;
  posed.group.add(shadowPlane);

  scene.add(posed.group);

  renderer.render(scene, cam);

  // Composite: body photo + GL layer
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  ctx.drawImage(bodyCanvas, 0, 0);
  ctx.drawImage(renderer.domElement, 0, 0);

  // Cleanup GPU
  renderer.dispose();
  pmrem.dispose();
  envTex.dispose();

  return out;
}

export function canUse3D(type) {
  return type === "bracelet" || type === "ring";
}
