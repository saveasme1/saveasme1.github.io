/**
 * Live camera alignment (PASS/ID-style) using MediaPipe VIDEO hand/face/pose.
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

/**
 * Score 0..1 how well landmarks match guide target zone.
 * @returns {{ score: number, message: string, ok: boolean, far: boolean }}
 */
function scoreBracelet(lm) {
  // Guide: fist top, wrist ~ (0.50, 0.32)
  const wrist = lm[0];
  const mid = lm[9];
  const tip = lm[12];
  const target = { x: 0.5, y: 0.32 };
  const d = dist2(wrist.x, wrist.y, target.x, target.y);
  const handAbove = mid.y < wrist.y + 0.02 && tip.y < wrist.y;
  let score = Math.max(0, 1 - d / 0.22);
  if (handAbove) score = Math.min(1, score + 0.12);
  else score *= 0.5;
  const ok = score >= 0.8;
  const far = score < 0.35;
  return {
    score,
    ok,
    far,
    message: far
      ? "손목이 가이드에서 벗어났습니다. 주황 링(+)에 맞춰 주세요"
      : ok
        ? "좋아요! 그대로 3초간 유지해 주세요"
        : "주먹을 위로 · 주황 링(+)에 손목을 더 가까이",
  };
}

const FINGER_LM = {
  index: { mcp: 5, pip: 6, tip: 8, label: "검지", target: { x: 0.52, y: 0.22 } },
  middle: { mcp: 9, pip: 10, tip: 12, label: "중지", target: { x: 0.50, y: 0.18 } },
  ring: { mcp: 13, pip: 14, tip: 16, label: "약지", target: { x: 0.46, y: 0.22 } },
  pinky: { mcp: 17, pip: 18, tip: 20, label: "소지", target: { x: 0.40, y: 0.26 } },
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
  let score = Math.max(0, 1 - d / 0.3);
  if (fingersUp) score = Math.min(1, score + 0.12);
  else score *= 0.55;
  const ok = score >= 0.72;
  const far = score < 0.28;
  // Finger diameter ≈ neighboring MCP span (more stable than whole-finger length)
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
  const ang = (Math.atan2(tip.y - mcp.y, tip.x - mcp.x) * 180) / Math.PI;
  return {
    score,
    ok,
    far,
    message: far
      ? `왼손 ${spec.label}가 가이드에서 벗어났습니다`
      : ok
        ? "좋아요! 그대로 3초간 유지해 주세요"
        : `왼손 손등 · ${spec.label}(+)에 맞춰 주세요`,
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
  // earSide = anatomical. Mirrored front preview (KYC): right ear → screen right.
  // Unmirrored raw landmarks: right ear is on the left of the frame → flip X when scoring.
  const L = faceLm[234] || faceLm[127];
  const R = faceLm[454] || faceLm[356];
  const anatomical = earSide === "left" ? "left" : "right";
  const ear = anatomical === "left" ? L : R;
  if (!ear) return { score: 0, ok: false, far: true, message: "얼굴·귀가 보이도록 맞춰 주세요" };
  const sx = mirror ? 1 - ear.x : ear.x;
  // Screen-space target (mirror preview = same side as anatomical)
  const target = anatomical === "right" ? { x: 0.72, y: 0.45 } : { x: 0.28, y: 0.45 };
  const d = dist2(sx, ear.y, target.x, target.y);
  const score = Math.max(0, 1 - d / 0.26);
  const ok = score >= 0.8;
  const far = score < 0.3;
  const label = anatomical === "left" ? "왼쪽" : "오른쪽";
  return {
    score,
    ok,
    far,
    message: far
      ? `${label} 귀가 가이드에서 벗어났습니다`
      : ok
        ? "좋아요! 그대로 3초간 유지해 주세요"
        : `${label} 귀를 가이드(+)에 맞춰 주세요`,
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
  // Face + neck band (NOT collarbone) — must sit near guide center
  const faceNeck = {
    x: mid.x,
    y: noseY != null ? noseY * 0.5 + mid.y * 0.5 : mid.y - 0.04,
  };
  const target = { x: 0.5, y: 0.36 };
  const d = dist2(faceNeck.x, faceNeck.y, target.x, target.y);

  let score = Math.max(0, 1 - d / 0.16);
  if (Math.abs(mid.x - 0.5) > 0.18) score *= 0.55;
  if (noseY == null) score *= 0.45;
  else if (noseY > 0.48 || noseY < 0.03) score *= 0.4;
  if (shoulderW < 0.22 || shoulderW > 0.88) score *= 0.65;
  const level = 1 - Math.min(1, Math.abs(mapY(ls.y) - mapY(rs.y)) / 0.1);
  score *= 0.65 + 0.35 * level;

  const ok = score >= 0.74;
  const far = score < 0.4;
  return {
    score,
    ok,
    far,
    message: far
      ? "가이드에 더 가까이 · 얼굴·목을 가운데로"
      : ok
        ? "좋아요! 그대로 3초간 유지해 주세요"
        : "얼굴·목을 가이드 중심에 맞춰 주세요",
  };
}

/**
 * Run one alignment frame against live video.
 * @param {string} earSide anatomical ear for earrings
 * @param {string} ringFinger index|middle|ring|pinky
 * @param {{ mirror?: boolean }} opts front-camera mirror preview (KYC)
 */
export async function evaluateAlignment(video, type, earSide = "right", ringFinger = "ring", opts = {}) {
  if (!video || video.readyState < 2) {
    return { score: 0, ok: false, far: false, message: "카메라 준비 중…" };
  }
  const now = performance.now();
  if (video.currentTime === lastVideoTime) {
    return null; // skip duplicate frame
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
      // Prefer Left hand for rings
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
            : "팔·손목이 화면에 들어오게 해 주세요",
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
