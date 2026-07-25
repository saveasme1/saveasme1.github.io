/**
 * Live camera alignment (PASS/ID-style) using MediaPipe VIDEO hand/face/pose.
 * Poses assume phone held in the RIGHT hand → left arm / face slightly angled.
 */

import { estimateWristAnchor3D } from "./ar/WristAnchorEstimator.js";
import { estimateFingerAnchor3D } from "./ar/FingerAnchorEstimator.js";
import { estimateNeckAnchor3D } from "./ar/NeckAnchorEstimator.js";
import { estimateEarAnchor3D, estimateEarPair } from "./ar/EarAnchorEstimator.js";
import { fitNecklaceWithChain } from "./ar/NecklaceChain.js";
import { fitNecklace } from "./ar/NecklaceFitter3D.js";
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
  // Left arm, dorsum, phone in right hand. Keep scoring LOOSE so live lock works.
  const wrist = lm[0];
  const mid = lm[9];
  const tip = lm[12] || mid;
  const indexMcp = lm[5];
  const pinkyMcp = lm[17];
  if (!wrist || !mid) {
    return {
      score: 0,
      ok: false,
      far: true,
      message: "왼팔·손목이 화면에 들어오게 해 주세요",
      placement: null,
    };
  }
  const target = { x: 0.5, y: 0.52 };
  const d = dist2(wrist.x, wrist.y, target.x, target.y);
  const ang = (Math.atan2(mid.y - wrist.y, mid.x - wrist.x) * 180) / Math.PI;
  // Accept wide diagonal poses (either tilt) — user often won't match exact guide angle
  const angOk = Math.abs(ang) > 15 && Math.abs(ang) < 165;
  const handTowardTop = mid.y < wrist.y + 0.08;
  const palmSpan =
    indexMcp && pinkyMcp ? dist2(indexMcp.x, indexMcp.y, pinkyMcp.x, pinkyMcp.y) : 0.12;
  const handSize = dist2(wrist.x, wrist.y, tip.x, tip.y);

  let score = Math.max(0, 1 - d / 0.38);
  if (angOk) score = Math.min(1, score + 0.12);
  if (handTowardTop) score = Math.min(1, score + 0.18);
  if (palmSpan > 0.04 && palmSpan < 0.45) score = Math.min(1, score + 0.12);
  if (handSize > 0.1) score = Math.min(1, score + 0.1);
  // Soft floor once a hand is clearly in-frame near center
  if (d < 0.28 && handSize > 0.12) score = Math.max(score, 0.72);

  const ok = score >= 0.62 && d <= 0.26;
  const far = d > 0.45 || score < 0.22;
  const planeAng =
    indexMcp && pinkyMcp
      ? (Math.atan2(pinkyMcp.y - indexMcp.y, pinkyMcp.x - indexMcp.x) * 180) / Math.PI
      : ang + 90;
  const frontAng = (Math.atan2(mid.y - wrist.y, mid.x - wrist.x) * 180) / Math.PI;
  const anchor3D = estimateWristAnchor3D(lm, { handedness: "Left" });
  const placement = anchor3D || {
    kind: "bracelet",
    center: {
      x: wrist.x + ((wrist.x - mid.x) / (dist2(wrist.x, wrist.y, mid.x, mid.y) || 1)) * 0.05,
      y: wrist.y + ((wrist.y - mid.y) / (dist2(wrist.x, wrist.y, mid.x, mid.y) || 1)) * 0.05,
    },
    width: Math.max(palmSpan * 1.4, handSize * 0.35, 0.14),
    angle: planeAng,
    frontAngle: frontAng,
  };
  return {
    score,
    ok,
    far,
    message: far
      ? "손목을 화면 중앙에 맞춰주세요"
      : ok
        ? "좋습니다. 그대로 유지해주세요"
        : "손등을 카메라로 향해주세요",
    placement,
    landmarks: lm,
    anchor3D,
  };
}

const FINGER_LM = {
  // Left hand dorsum, fingers upper-right → index more left, pinky more right
  index: { mcp: 5, pip: 6, tip: 8, label: "검지", target: { x: 0.44, y: 0.28 } },
  middle: { mcp: 9, pip: 10, tip: 12, label: "중지", target: { x: 0.5, y: 0.24 } },
  ring: { mcp: 13, pip: 14, tip: 16, label: "약지", target: { x: 0.56, y: 0.28 } },
  pinky: { mcp: 17, pip: 18, tip: 20, label: "소지", target: { x: 0.62, y: 0.32 } },
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
      ? `${spec.label}를 화면에 맞춰주세요`
      : ok
        ? "좋습니다. 그대로 유지해주세요"
        : `${spec.label}를 곧게 펴주세요`,
    placement: estimateFingerAnchor3D(lm, finger) || {
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
    landmarks: lm,
    anchor3D: estimateFingerAnchor3D(lm, finger),
  };
}

function scoreEarring(faceLm, earSide, mirror = false) {
  const anatomical = earSide === "left" ? "left" : "right";
  const pair = estimateEarPair(faceLm, { mirrored: false });
  const primary = pair[anatomical] || estimateEarAnchor3D(faceLm, anatomical, { mirrored: false });
  const secondary = anatomical === "left" ? pair.right : pair.left;
  if (!primary) {
    return {
      score: 0,
      ok: false,
      far: true,
      message: "얼굴·귀가 보이도록 맞춰 주세요",
      placement: null,
      anchor3D: null,
    };
  }
  // Display-space center when video is CSS-mirrored
  const displayPrimary = mirror
    ? {
        ...primary,
        center2D: { x: 1 - primary.center2D.x, y: primary.center2D.y },
        attachment2D: { x: 1 - primary.attachment2D.x, y: primary.attachment2D.y },
        center: { x: 1 - primary.center2D.x, y: primary.center2D.y },
        mirrored: true,
      }
    : primary;
  const displaySecondary =
    secondary && mirror
      ? {
          ...secondary,
          center2D: { x: 1 - secondary.center2D.x, y: secondary.center2D.y },
          attachment2D: { x: 1 - secondary.attachment2D.x, y: secondary.attachment2D.y },
          center: { x: 1 - secondary.center2D.x, y: secondary.center2D.y },
          mirrored: true,
        }
      : secondary;

  const c = displayPrimary.attachment2D;
  const target = anatomical === "right" ? { x: 0.68, y: 0.4 } : { x: 0.32, y: 0.4 };
  const d = dist2(c.x, c.y, target.x, target.y);
  let score = Math.max(0, 1 - d / 0.2);
  score = Math.min(1, score + (displayPrimary.visibility || 0) * 0.25);
  if (displayPrimary.confidence > 0.6) score = Math.min(1, score + 0.1);
  const ok = score >= 0.72 && (displayPrimary.visibility || 0) >= 0.35 && d <= 0.14;
  const far = d > 0.28 || score < 0.28;
  const label = anatomical === "left" ? "왼쪽" : "오른쪽";
  return {
    score,
    ok,
    far,
    message: far
      ? `${label} 귀가 보이도록 맞춰주세요`
      : ok
        ? "좋습니다. 그대로 유지해주세요"
        : `${label} 귀가 보이도록 고개를 돌려주세요`,
    placement: displayPrimary,
    anchor3D: displayPrimary,
    secondaryAnchor: displaySecondary,
    landmarks: faceLm,
  };
}

function scoreNecklace(poseLm, faceLm = null, mirror = false, zoom = 1) {
  const z = Math.max(0.5, Number(zoom) || 1);
  let anchor = estimateNeckAnchor3D(faceLm, poseLm, { mirrored: false });
  if (!anchor) {
    return { score: 0, ok: false, far: true, message: "얼굴·목이 보이게 맞춰 주세요", placement: null };
  }
  // apply zoom mapping similar to prior guide targeting
  const mapPoint = (p) => ({
    x: 0.5 + ((mirror ? 1 - p.x : p.x) - 0.5) * z,
    y: 0.5 + (p.y - 0.5) * z,
  });
  const center2D = mapPoint(anchor.center2D);
  anchor = {
    ...anchor,
    center2D,
    center: center2D,
    mirrored: mirror,
    shoulderWidth: anchor.shoulderWidth * z,
    collarboneWidth: anchor.collarboneWidth * z,
    scale: anchor.scale * z,
  };
  const fitted = fitNecklaceWithChain(anchor, {}, "MEDIUM") || fitNecklace(anchor, {});  const target = { x: 0.52, y: 0.38 };
  const d = dist2(fitted.center2D.x, fitted.center2D.y, target.x, target.y);
  let score = Math.max(0, 1 - d / 0.16);
  if (anchor.confidence > 0.6) score = Math.min(1, score + 0.12);
  if (anchor.shoulderWidth > 0.18 && anchor.shoulderWidth < 0.8) score = Math.min(1, score + 0.1);
  const ok = score >= 0.72 && d <= 0.12;
  const far = d > 0.24 || score < 0.3;
  return {
    score,
    ok,
    far,
    message: far
      ? "얼굴과 어깨를 화면 중앙에 맞춰주세요"
      : ok
        ? "좋습니다. 그대로 유지해주세요"
        : "정면을 바라봐주세요",
    placement: fitted,
    anchor3D: fitted,
    landmarks: poseLm,
    faceLandmarks: faceLm,
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
      // Prefer anatomical Left for ring/bracelet (left hand dorsum)
      if (hands.length > 1) {
        const leftIdx = handed.findIndex((h) => h?.[0]?.categoryName === "Left");
        if (leftIdx >= 0) lm = hands[leftIdx];
      } else if (hands.length === 1 && handed[0]?.[0]?.categoryName === "Right" && type === "bracelet") {
        // Still accept single detected hand — rear-cam handedness is often flipped
        lm = hands[0];
      }
      if (!lm) {
        // Pose wrist fallback so bracelet isn't stuck on "no hand"
        try {
          const pose = await getVideoPose();
          const pres = pose.detectForVideo(video, now);
          const plm = pres.landmarks?.[0];
          const lw = plm?.[15];
          if (lw) {
            const fake = [];
            fake[0] = { x: lw.x, y: lw.y };
            fake[9] = { x: lw.x + 0.04, y: lw.y - 0.12 };
            fake[12] = { x: lw.x + 0.05, y: lw.y - 0.18 };
            fake[5] = { x: lw.x - 0.03, y: lw.y - 0.08 };
            fake[17] = { x: lw.x + 0.06, y: lw.y - 0.06 };
            return scoreBracelet(fake);
          }
        } catch (_) {}
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
      if (!lm) return { score: 0, ok: false, far: true, message: "얼굴을 화면에 보여주세요", placement: null };
      return scoreEarring(lm, earSide, mirror);
    }
    if (type === "necklace") {
      const pose = await getVideoPose();
      const pres = pose.detectForVideo(video, now);
      const plm = pres.landmarks?.[0];
      if (!plm) return { score: 0, ok: false, far: true, message: "얼굴과 어깨를 화면에 보여주세요", placement: null };
      let faceLm = null;
      try {
        const face = await getVideoFace();
        const fres = face.detectForVideo(video, now);
        faceLm = fres.faceLandmarks?.[0] || null;
      } catch (_) {}
      return scoreNecklace(plm, faceLm, mirror, zoom);
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
