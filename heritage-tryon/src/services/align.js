/**
 * Live camera alignment (PASS/ID-style) using MediaPipe VIDEO hand/face/pose.
 * Poses assume phone held in the RIGHT hand → left arm / face slightly angled.
 */

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const ESM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";

let vision = null;
let mod = null;
let videoHand = null;
let videoFace = null;
let videoPose = null;
let lastVideoTime = -1;

async function ensureMod() {
  if (mod && vision) return { mod, vision };
  mod = await import(ESM_URL);
  vision = await mod.FilesetResolver.forVisionTasks(WASM_URL);
  return { mod, vision };
}

async function getVideoHand() {
  if (videoHand) return videoHand;
  const { mod: m, vision: v } = await ensureMod();
  videoHand = await m.HandLandmarker.createFromOptions(v, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "CPU",
    },
    numHands: 2,
    minHandDetectionConfidence: 0.35,
    minHandPresenceConfidence: 0.35,
    minTrackingConfidence: 0.35,
    runningMode: "VIDEO",
  });
  return videoHand;
}

async function getVideoFace() {
  if (videoFace) return videoFace;
  const { mod: m, vision: v } = await ensureMod();
  videoFace = await m.FaceLandmarker.createFromOptions(v, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "CPU",
    },
    numFaces: 1,
    runningMode: "VIDEO",
  });
  return videoFace;
}

async function getVideoPose() {
  if (videoPose) return videoPose;
  const { mod: m, vision: v } = await ensureMod();
  videoPose = await m.PoseLandmarker.createFromOptions(v, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "CPU",
    },
    numPoses: 1,
    runningMode: "VIDEO",
  });
  return videoPose;
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function scoreBracelet(lm) {
  // Phone in RIGHT hand → left arm angled in (not a straight horizontal bar).
  const wrist = lm[0];
  const mid = lm[9];
  const tip = lm[12];
  const indexMcp = lm[5];
  const pinkyMcp = lm[17];
  const target = { x: 0.52, y: 0.48 };
  const d = dist2(wrist.x, wrist.y, target.x, target.y);
  const ang = (Math.atan2(mid.y - wrist.y, mid.x - wrist.x) * 180) / Math.PI;
  const angOk = ang > -145 && ang < -20;
  const fistUp = tip.y < wrist.y;
  const palmSpan =
    indexMcp && pinkyMcp ? dist2(indexMcp.x, indexMcp.y, pinkyMcp.x, pinkyMcp.y) : 0.12;
  let score = Math.max(0, 1 - d / 0.24);
  if (angOk) score = Math.min(1, score + 0.14);
  else score *= 0.7;
  if (fistUp) score = Math.min(1, score + 0.1);
  else score *= 0.75;
  if (palmSpan > 0.06 && palmSpan < 0.35) score = Math.min(1, score + 0.05);
  const ok = score >= 0.7 && d <= 0.14;
  const far = d > 0.3 || score < 0.28;
  return {
    score,
    ok,
    far,
    message: far
      ? "왼팔을 비스듬히 · 주황 링(+)에 손목을 맞춰 주세요"
      : ok
        ? "좋아요! 그대로 3초간 유지해 주세요"
        : "오른손 폰 · 왼팔 비스듬히 · 주먹↑ 손목(+)",
  };
}

const FINGER_LM = {
  index: { mcp: 5, pip: 6, tip: 8, label: "검지", target: { x: 0.56, y: 0.3 } },
  middle: { mcp: 9, pip: 10, tip: 12, label: "중지", target: { x: 0.52, y: 0.26 } },
  ring: { mcp: 13, pip: 14, tip: 16, label: "약지", target: { x: 0.48, y: 0.3 } },
  pinky: { mcp: 17, pip: 18, tip: 20, label: "소지", target: { x: 0.42, y: 0.34 } },
};

function scoreRing(lm, finger = "ring") {
  const spec = FINGER_LM[finger] || FINGER_LM.ring;
  const mcp = lm[spec.mcp];
  const pip = lm[spec.pip] || mcp;
  const tip = lm[spec.tip] || pip;
  if (!mcp || !tip) {
    return {
      score: 0,
      ok: false,
      far: true,
      message: `왼손 손등 · ${spec.label}가 보이게 해 주세요`,
      placement: null,
    };
  }
  const mid = { x: (mcp.x + pip.x) / 2, y: (mcp.y + pip.y) / 2 };
  const d = dist2(mid.x, mid.y, spec.target.x, spec.target.y);
  const fingersUp = tip.y < mcp.y;
  const ang = (Math.atan2(tip.y - mcp.y, tip.x - mcp.x) * 180) / Math.PI;
  const angOk = ang > -150 && ang < -10;
  let score = Math.max(0, 1 - d / 0.22);
  if (fingersUp) score = Math.min(1, score + 0.1);
  else score *= 0.55;
  if (angOk) score = Math.min(1, score + 0.08);
  const ok = score >= 0.72 && d <= 0.11;
  const far = d > 0.26 || score < 0.28;
  const neighbors = {
    index: [9],
    middle: [5, 13],
    ring: [9, 17],
    pinky: [13],
  };
  let fingerW = dist2(mcp.x, mcp.y, pip.x, pip.y) * 0.4;
  for (const ni of neighbors[finger] || neighbors.ring) {
    const n = lm[ni];
    if (n) fingerW = Math.max(fingerW, dist2(mcp.x, mcp.y, n.x, n.y) * 0.48);
  }
  return {
    score,
    ok,
    far,
    message: far
      ? `왼손 ${spec.label}가 가이드에서 벗어났습니다`
      : ok
        ? "좋아요! 그대로 3초간 유지해 주세요"
        : `왼손 비스듬히 · ${spec.label}(+)에 맞춰 주세요`,
    placement: {
      kind: "ring",
      finger,
      center: mid,
      width: fingerW,
      angle: ang,
      frontAngle: ang - 90,
      mcp: { x: mcp.x, y: mcp.y },
      pip: { x: pip.x, y: pip.y },
      tip: { x: tip.x, y: tip.y },
    },
  };
}

function scoreEarring(faceLm, earSide, mirror = false) {
  const L = faceLm[234] || faceLm[127];
  const R = faceLm[454] || faceLm[356];
  const anatomical = earSide === "left" ? "left" : "right";
  const ear = anatomical === "left" ? L : R;
  if (!ear) return { score: 0, ok: false, far: true, message: "얼굴·귀가 보이도록 맞춰 주세요" };
  const sx = mirror ? 1 - ear.x : ear.x;
  const target = anatomical === "right" ? { x: 0.68, y: 0.4 } : { x: 0.32, y: 0.4 };
  const d = dist2(sx, ear.y, target.x, target.y);
  let score = Math.max(0, 1 - d / 0.18);
  if (d > 0.1) score = Math.min(score, 0.78);
  const ok = score >= 0.78 && d <= 0.09;
  const far = d > 0.22 || score < 0.3;
  const label = anatomical === "left" ? "왼쪽" : "오른쪽";
  return {
    score,
    ok,
    far,
    message: far
      ? `${label} 귀가 가이드에서 벗어났습니다`
      : ok
        ? "좋아요! 그대로 3초간 유지해 주세요"
        : `${label} 귀 · 살짝 기울여 가이드(+)에`,
  };
}

function scoreNecklace(poseLm, mirror = false, zoom = 1) {
  const ls = poseLm[11];
  const rs = poseLm[12];
  const nose = poseLm[0];
  if (!ls || !rs) return { score: 0, ok: false, far: true, message: "얼굴·목이 보이게 맞춰 주세요" };

  const z = Math.max(0.5, Number(zoom) || 1);
  const mapX = (x) => {
    const sx = mirror ? 1 - x : x;
    return 0.5 + (sx - 0.5) * z;
  };
  const mapY = (y) => 0.5 + (y - 0.5) * z;

  const mid = { x: (mapX(ls.x) + mapX(rs.x)) / 2, y: (mapY(ls.y) + mapY(rs.y)) / 2 };
  const shoulderW = dist2(mapX(ls.x), mapY(ls.y), mapX(rs.x), mapY(rs.y));
  const noseY = nose ? mapY(nose.y) : null;
  const faceNeck = {
    x: mid.x,
    y: noseY != null ? noseY * 0.55 + mid.y * 0.45 : mid.y - 0.04,
  };
  const target = { x: 0.52, y: 0.34 };
  const d = dist2(faceNeck.x, faceNeck.y, target.x, target.y);

  let score = Math.max(0, 1 - d / 0.14);
  if (Math.abs(mid.x - 0.5) > 0.2) score *= 0.55;
  if (noseY == null) score *= 0.35;
  else if (noseY > 0.45 || noseY < 0.04) score *= 0.4;
  if (shoulderW < 0.22 || shoulderW > 0.85) score *= 0.55;
  const level = 1 - Math.min(1, Math.abs(mapY(ls.y) - mapY(rs.y)) / 0.12);
  score *= 0.6 + 0.4 * level;
  if (d > 0.11) score = Math.min(score, 0.72);

  const ok = score >= 0.8 && d <= 0.08;
  const far = d > 0.2 || score < 0.35;
  return {
    score,
    ok,
    far,
    message: far
      ? "가이드에 더 가까이 · 얼굴·목을 가운데로"
      : ok
        ? "좋아요! 그대로 3초간 유지해 주세요"
        : "한손 셀카 · 얼굴·목을 가이드에 맞춰 주세요",
  };
}

/**
 * @param {string} earSide anatomical ear
 * @param {string} ringFinger index|middle|ring|pinky
 * @param {{ mirror?: boolean, zoom?: number }} opts
 */
export async function evaluateAlignment(video, type, earSide = "right", ringFinger = "ring", opts = {}) {
  if (!video || video.readyState < 2) {
    return { score: 0, ok: false, far: false, message: "카메라 준비 중…" };
  }
  const now = performance.now();
  if (video.currentTime === lastVideoTime) {
    return null;
  }
  lastVideoTime = video.currentTime;
  const mirror = Boolean(opts.mirror);
  const zoom = Math.max(0.5, Number(opts.zoom) || 1);

  try {
    if (type === "ring" || type === "bracelet") {
      const detector = await getVideoHand();
      const res = detector.detectForVideo(video, now);
      const hands = res.landmarks || [];
      const handed = res.handednesses || [];
      let lm = hands[0];
      if (type === "ring" && hands.length > 1) {
        const leftIdx = handed.findIndex((h) => h?.[0]?.categoryName === "Left");
        if (leftIdx >= 0) lm = hands[leftIdx];
      }
      if (!lm) {
        return {
          score: 0,
          ok: false,
          far: true,
          message: type === "ring"
            ? "왼손 손등이 화면에 들어오게 해 주세요"
            : "왼팔·손목이 화면에 들어오게 해 주세요",
          placement: null,
        };
      }
      return type === "ring" ? scoreRing(lm, ringFinger) : scoreBracelet(lm);
    }
    if (type === "earring") {
      const detector = await getVideoFace();
      const res = detector.detectForVideo(video, now);
      const lm = res.faceLandmarks?.[0];
      if (!lm) return { score: 0, ok: false, far: true, message: "얼굴이 화면에 들어오게 해 주세요" };
      return scoreEarring(lm, earSide, mirror);
    }
    if (type === "necklace") {
      const detector = await getVideoPose();
      const res = detector.detectForVideo(video, now);
      const lm = res.landmarks?.[0];
      if (!lm) return { score: 0, ok: false, far: true, message: "상체가 화면에 들어오게 해 주세요" };
      return scoreNecklace(lm, mirror, zoom);
    }
  } catch (err) {
    console.warn("align", err);
    return { score: 0, ok: false, far: false, message: "인식 준비 중…" };
  }
  return { score: 0, ok: false, far: false, message: "" };
}

export function stopAlignClock() {
  lastVideoTime = -1;
}
