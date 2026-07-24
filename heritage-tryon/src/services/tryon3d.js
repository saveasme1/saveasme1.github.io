/**
 * WebGL try-on — Clash-style studded bracelet + correct wrist pose.
 * (Previous thin gold "line" was torus edge-on to camera.)
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
  return { r: (r / n) / 255, g: (g / n) / 255, b: (b / n) / 255 };
}

function makeGoldMaterial(THREE, metal, ambient, mapTex) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(metal.r, metal.g, metal.b),
    map: mapTex || null,
    metalness: 1.0,
    roughness: 0.2,
    clearcoat: 0.65,
    clearcoatRoughness: 0.15,
    reflectivity: 1.0,
    envMapIntensity: 1.5,
    emissive: new THREE.Color(metal.r * 0.03, metal.g * 0.025, metal.b * 0.01),
  });
  if (mapTex) {
    mat.color = new THREE.Color(1, 1, 1);
    mapTex.colorSpace = THREE.SRGBColorSpace;
    mapTex.wrapS = THREE.RepeatWrapping;
    mapTex.wrapT = THREE.RepeatWrapping;
    mapTex.needsUpdate = true;
  }
  return mat;
}

/** Build Clash-like wide band with pyramid studs (not a thin Love torus). */
function buildClashBracelet(THREE, material, radius) {
  const group = new THREE.Group();
  // Oval bracelet around Z axis (hole = Z = forearm)
  const rx = radius;
  const ry = radius * 0.78;
  // Band cross-section: wide & tall like Clash
  const halfW = radius * 0.07; // radial thickness
  const halfH = radius * 0.16; // band height (studs sit on this)

  const shape = new THREE.Shape();
  shape.moveTo(-halfW, -halfH);
  shape.lineTo(halfW, -halfH);
  shape.lineTo(halfW, halfH);
  shape.lineTo(-halfW, halfH);
  shape.closePath();

  const pts = [];
  const SEG = 96;
  for (let i = 0; i <= SEG; i++) {
    const t = (i / SEG) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(t) * rx, Math.sin(t) * ry, 0));
  }
  const path = new THREE.CatmullRomCurve3(pts, true);

  const bandGeo = new THREE.ExtrudeGeometry(shape, {
    steps: SEG,
    bevelEnabled: false,
    extrudePath: path,
    curveSegments: 8,
  });
  const band = new THREE.Mesh(bandGeo, material);
  band.castShadow = true;
  band.receiveShadow = true;
  group.add(band);

  // Pyramid studs along outer rim (Clash signature)
  const studMat = material.clone();
  studMat.roughness = 0.28;
  const studCount = 28;
  for (let i = 0; i < studCount; i++) {
    const t = (i / studCount) * Math.PI * 2;
    const cx = Math.cos(t) * rx;
    const cy = Math.sin(t) * ry;
    // outward normal in XY
    const nx = Math.cos(t);
    const ny = Math.sin(t);
    const stud = new THREE.Mesh(
      new THREE.ConeGeometry(halfH * 0.55, halfH * 1.15, 4),
      studMat
    );
    stud.position.set(cx + nx * halfW * 1.05, cy + ny * halfW * 1.05, 0);
    // point outward
    stud.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(nx, ny, 0).normalize()
    );
    stud.castShadow = true;
    group.add(stud);
  }

  return group;
}

function buildRingMesh(THREE, material, radius) {
  const tube = radius * 0.22;
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 28, 96), material);
  mesh.castShadow = true;
  return mesh;
}

function buildArmOccluder(THREE, length, radius) {
  let geo;
  try {
    geo = new THREE.CapsuleGeometry(radius, Math.max(length - radius * 2, radius), 8, 16);
  } catch (_) {
    geo = new THREE.CylinderGeometry(radius * 0.95, radius, length, 24);
  }
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  mat.colorWrite = false;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  return mesh;
}

/**
 * Critical: bracelet hole must align with forearm in the IMAGE plane.
 * Edge-on torus = thin gold line (the bug in tryon21 screenshots).
 */
function poseWristGroup(THREE, target, imgW, imgH) {
  const cx = target.center.x;
  const cy = target.center.y;
  const wristR = Math.max(10, (target.width || imgW * 0.22) * 0.45);

  // Forearm direction in image (y-down): from knuckles toward wrist/elbow
  const frontRad = ((target.frontAngle != null ? target.frontAngle : (target.angle || 0) - 90) * Math.PI) / 180;
  // Unit vector along forearm in image space
  const fImgX = Math.cos(frontRad);
  const fImgY = Math.sin(frontRad);
  // Three.js Y-up
  const forearm = new THREE.Vector3(fImgX, -fImgY, 0).normalize();

  const group = new THREE.Group();
  group.position.set(cx - imgW / 2, -(cy - imgH / 2), 0);

  // Default torus/extrude hole along +Z → align to forearm
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forearm);

  // Spin so band "top" faces camera (+Z) as much as possible
  const camDir = new THREE.Vector3(0, 0, 1);
  const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(group.quaternion);
  const projected = camDir.clone().sub(forearm.clone().multiplyScalar(camDir.dot(forearm))).normalize();
  if (projected.lengthSq() > 0.01) {
    const angle = localUp.angleTo(projected);
    const cross = new THREE.Vector3().crossVectors(localUp, projected);
    const sign = Math.sign(cross.dot(forearm)) || 1;
    group.rotateOnWorldAxis(forearm, sign * angle);
  }

  return { group, wristR, forearm };
}

function textureFromCanvas(THREE, canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export async function composeTryOn3D(bodyCanvas, jewelryCanvas, target, type = "bracelet", extraCanvases = []) {
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
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  const cam = new T.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 8000);
  cam.position.set(0, 0, 2000);
  cam.lookAt(0, 0, 0);

  const metal = avgMetalColor(jewelryCanvas);
  const ambient = sampleAmbient(bodyCanvas);
  // Prefer jewelry cutout as albedo so product gold/studs read from portfolio photo
  const mapTex = textureFromCanvas(T, jewelryCanvas);
  mapTex.repeat.set(2, 1);
  const goldMat = makeGoldMaterial(T, metal, ambient, mapTex);

  const pmrem = new T.PMREMGenerator(renderer);
  const envScene = new T.Scene();
  envScene.background = new T.Color(
    Math.min(1, ambient.r * 1.15 + 0.2),
    Math.min(1, ambient.g * 1.1 + 0.18),
    Math.min(1, ambient.b * 1.05 + 0.16)
  );
  envScene.add(new T.AmbientLight(0xffffff, 0.8));
  const envTex = pmrem.fromScene(envScene, 0.04).texture;
  scene.environment = envTex;
  goldMat.envMap = envTex;

  scene.add(new T.HemisphereLight(
    new T.Color(Math.min(1, ambient.r + 0.4), Math.min(1, ambient.g + 0.38), Math.min(1, ambient.b + 0.35)),
    new T.Color(ambient.r * 0.35, ambient.g * 0.3, ambient.b * 0.25),
    1.1
  ));
  const key = new T.DirectionalLight(0xfff5e6, 2.4);
  key.position.set(-w * 0.2, h * 0.35, 1600);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const fill = new T.DirectionalLight(0xe8f0ff, 0.75);
  fill.position.set(w * 0.25, -h * 0.1, 1400);
  scene.add(fill);
  const rim = new T.DirectionalLight(0xffffff, 0.6);
  rim.position.set(0, 0, -1200);
  scene.add(rim);

  const posed = poseWristGroup(T, target, w, h);
  const jewel =
    kind === "ring"
      ? buildRingMesh(T, goldMat, posed.wristR * 0.55)
      : buildClashBracelet(T, goldMat, posed.wristR * 1.05);
  posed.group.add(jewel);

  // Arm depth occluder along forearm — hides back of bracelet
  const occluder = buildArmOccluder(T, posed.wristR * 6.5, posed.wristR * 0.88);
  // Capsule default axis = Y; align to forearm (world)
  occluder.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), posed.forearm);
  // Keep occluder in world orientation relative to wrist group:
  // add as sibling under scene at same position for stable depth
  occluder.position.copy(posed.group.position);
  occluder.renderOrder = -2;
  scene.add(occluder);
  scene.add(posed.group);

  // Contact shadow under band
  const shadowMat = new T.ShadowMaterial({ opacity: 0.32 });
  const shadow = new T.Mesh(new T.CircleGeometry(posed.wristR * 1.4, 48), shadowMat);
  shadow.position.copy(posed.group.position);
  shadow.quaternion.copy(posed.group.quaternion);
  shadow.rotateX(-Math.PI / 2);
  shadow.receiveShadow = true;
  scene.add(shadow);

  renderer.render(scene, cam);

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  ctx.drawImage(bodyCanvas, 0, 0);
  ctx.drawImage(renderer.domElement, 0, 0);

  renderer.dispose();
  pmrem.dispose();
  envTex.dispose();
  mapTex.dispose();

  return out;
}

export function canUse3D(type) {
  return type === "bracelet" || type === "ring";
}
