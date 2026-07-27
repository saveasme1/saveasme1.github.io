import { prepareJewelry } from "./services/jewelry.js";
import { detectBody } from "./services/mediapipe.js";
import { assetUrl, guessTypeFromText, loadPortfolioItem } from "./services/portfolio.js";
import { evaluateAlignment, stopAlignClock } from "./services/align.js";
import {
  GuideOverlay,
  GuideStateEngine,
  TrackingSmoother,
  JewelryARRenderer,
  runStyleArCompose,
  resolveComposeTarget,
  targetToAnchor,
  PerfHarness,
  HAIR_OCCLUSION_DECISION,
  probeHairSegmenterCost,
} from "./services/ar/index.js";

const params = new URLSearchParams(location.search);
const embedded = params.get("embed") === "1";
const AR_DEBUG = params.get("arDebug") === "1";

const state = {
  item: {
    id: params.get("id") || "portfolio-item",
    title: params.get("title") || "헤리티지",
    category: params.get("category") || "",
    cover: params.get("image") || params.get("path") || "",
  },
  bodyImage: null,
  bodySource: null, // "camera" | "upload" — same StyleAR compose path either way
  afterCanvas: null,
  productReady: false,
  wearType: "bracelet",
  earSide: "right",
  ringFinger: "ring",
  cameraStream: null,
  cameraOpen: false,
  cameraHistoryLocal: false,
  alignRaf: 0,
  goodStreak: 0,
  goodSince: 0,
  autoCaptureArmed: true,
  capturing: false,
  closingCameraFromUi: false,
  camZoom: 1,
  lastPlacement: null,
  capturePlacement: null,
  pinchStartDist: 0,
  pinchStartZoom: 1,
  guideOverlay: null,
  guideState: null,
  smoother: null,
  arRenderer: null,
  arReady: false,
  arHasGlb: false,
  assetState: null,
  _arLoadKey: null,
  lastLandmarks: null,
  lastSecondaryAnchor: null,
  captureExtras: null,
  perfHarness: null,
};

const $ = (id) => document.getElementById(id);
const show = (el) => el && el.classList.remove("is-hidden");
const hide = (el) => el && el.classList.add("is-hidden");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label)), ms);
    Promise.resolve(promise).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

function setStatus(msg, kind = "") {
  const el = $("status");
  el.textContent = msg;
  el.classList.remove("is-err", "is-ok");
  if (kind) el.classList.add(kind);
}

function setMergeProgress(pct) {
  const panel = $("mergeProgress");
  const fill = $("mergeProgressFill");
  const label = $("mergeProgressPct");
  if (!panel || !fill || !label) return;
  const n = Math.max(0, Math.min(100, Math.round(pct)));
  fill.style.width = `${n}%`;
  label.textContent = `${n}%`;
}

function showMergeProgress(pct = 0) {
  const panel = $("mergeProgress");
  if (!panel) return;
  panel.hidden = false;
  panel.classList.remove("is-hidden");
  setMergeProgress(pct);
  if ($("status")) $("status").textContent = "";
  if ($("mergeTryOn")) $("mergeTryOn").classList.add("is-hidden");
}

function hideMergeProgress() {
  const panel = $("mergeProgress");
  if (!panel) return;
  panel.hidden = true;
  panel.classList.add("is-hidden");
  if ($("mergeTryOn")) $("mergeTryOn").classList.remove("is-hidden");
}

function setStageMode(mode) {
  const stage = $("studioStage");
  stage.classList.remove("mode-split", "mode-merging", "mode-result");
  stage.classList.add(`mode-${mode}`);
  if (mode === "split") {
    show($("panelProduct"));
    show($("panelCapture"));
    hide($("panelResult"));
    $("mergeTryOn").classList.remove("is-hidden");
  } else if (mode === "result") {
    hide($("panelProduct"));
    hide($("panelCapture"));
    show($("panelResult"));
    $("mergeTryOn").classList.add("is-hidden");
  }
}

function refreshReady() {
  const ready = Boolean(state.productReady && state.bodyImage);
  $("mergeTryOn").disabled = !ready;
  if (ready) setStatus("준비가 끝났습니다. ‘착용해보기’를 눌러 결과를 확인하세요.", "is-ok");
}

function imageCandidates(raw, { maxMirrors = 2 } = {}) {
  let value = String(raw || "").trim();
  if (!value) return [];
  try { value = decodeURIComponent(value); } catch (_) {}

  const list = [];
  const push = (u) => { if (u && !list.includes(u)) list.push(u); };
  const onGithubHost = /github\.io$/i.test(location.hostname);

  const pushMirrors = (path) => {
    const p = String(path || "").replace(/^\/+/, "");
    if (!p) return;
    // Prefer same-site first; keep list short to avoid timeout stacking.
    if (onGithubHost) {
      push(`${location.origin}/${p}`);
      push(`https://hand-made.kr/${p}`);
      if (maxMirrors > 2) push(`https://saveasme1.github.io/${p}`);
    } else {
      push(`https://hand-made.kr/${p}`);
      push(`${location.origin}/${p}`);
      if (maxMirrors > 2) push(`https://saveasme1.github.io/${p}`);
    }
  };

  if (/^https?:\/\//i.test(value)) {
    try {
      const u = new URL(value);
      pushMirrors(u.pathname);
      push(value);
    } catch (_) {
      push(value);
    }
  } else {
    pushMirrors(value);
  }
  return list.slice(0, Math.max(1, maxMirrors + 1));
}

function loadIntoProductImg(url, ms = 2500) {
  const img = $("productImage");
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (ok, err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      ok ? resolve(url) : reject(err || new Error("load failed"));
    };
    const timer = setTimeout(() => finish(false, new Error("이미지 로딩 시간 초과")), ms);
    img.onload = () => finish(true);
    img.onerror = () => finish(false, new Error("load failed"));
    const sep = url.includes("?") ? "&" : "?";
    img.src = `${url}${sep}_tryon=${Date.now()}`;
  });
}

async function loadProduct() {
  $("productTitle").textContent = state.item.title || "헤리티지";
  const cat = $("productCat");
  if (state.item.category) {
    cat.textContent = state.item.category;
    show(cat);
  }

  const skeleton = $("productSkeleton");
  const img = $("productImage");
  hide(img);
  img.removeAttribute("src");
  img.alt = "";
  show(skeleton);
  setStatus("선택 제품 불러오는 중…");
  applyWearTypeFromProduct();

  // 1) Show cover from URL params FIRST (never wait on full portfolio JSON).
  const coverCandidates = imageCandidates(state.item.cover, { maxMirrors: 2 });
  let shown = false;
  let lastErr;
  for (const url of coverCandidates) {
    try {
      await loadIntoProductImg(url, 2500);
      img.src = url;
      img.alt = state.item.title || "선택 제품";
      show(img);
      hide(skeleton);
      state.productReady = true;
      state.item.sourceUrl = url;
      state.item.cover = url;
      setStatus("제품을 확인한 뒤 사진을 준비하세요.");
      refreshReady();
      shown = true;
      break;
    } catch (err) {
      lastErr = err;
    }
  }

  // 2) Enrich gallery in background (optional). Must not block first paint.
  if (state.item.id && state.item.id !== "portfolio-item") {
    loadPortfolioItem(state.item.id)
      .then((full) => {
        if (!full) return;
        state.item.title = full.title || state.item.title;
        state.item.category = full.category || state.item.category;
        state.item.images = Array.isArray(full.images) ? full.images.slice(0, 8) : [];
        $("productTitle").textContent = state.item.title || "헤리티지";
        if (state.item.category) {
          cat.textContent = state.item.category;
          show(cat);
        }
        applyWearTypeFromProduct();
        if (state.item.images?.length && shown) {
          setStatus(`다각도 ${state.item.images.length}장 준비됨 · 사진을 준비하세요.`);
        }
      })
      .catch((err) => console.warn("gallery enrich", err));
  }

  if (shown) return;

  // 3) Last resort: try first gallery path only (still capped).
  try {
    const full = await withTimeout(loadPortfolioItem(state.item.id), 6000, "포폴 조회 시간 초과");
    const first = full?.images?.[0] || full?.cover;
    if (first) {
      for (const url of imageCandidates(first, { maxMirrors: 2 })) {
        try {
          await loadIntoProductImg(url, 2500);
          img.src = url;
          img.alt = state.item.title || "선택 제품";
          show(img);
          hide(skeleton);
          state.productReady = true;
          state.item.sourceUrl = url;
          state.item.cover = url;
          state.item.images = full.images || [];
          setStatus("제품을 확인한 뒤 사진을 준비하세요.");
          refreshReady();
          return;
        } catch (err) {
          lastErr = err;
        }
      }
    }
  } catch (err) {
    lastErr = err;
  }

  hide(skeleton);
  hide(img);
  setStatus(`제품 이미지를 불러오지 못했습니다. ${lastErr?.message || ""}`.trim(), "is-err");
}

function setBodyFromBlob(blob, source = "upload") {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    state.bodyImage = img;
    state.bodySource = source === "camera" ? "camera" : "upload";
    state.capturePlacement = source === "camera" ? state.capturePlacement : null;
    if (source !== "camera") {
      state.captureExtras = null;
    }
    const preview = $("bodyPreview");
    preview.src = url;
    preview.alt = "";
    show(preview);
    hide($("captureEmpty"));
    $("captureFrame")?.classList.add("has-photo");
    refreshReady();
    setStatus(
      state.bodySource === "upload"
        ? "앨범 사진이 준비되었습니다. ‘착용해보기’로 StyleAR 합성합니다."
        : "사진이 준비되었습니다. ‘착용해보기’를 눌러주세요.",
      "is-ok"
    );
  };
  img.onerror = () => setStatus("사진 로드에 실패했습니다.", "is-err");
  img.src = url;
}

function onPickFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  state.capturePlacement = null;
  state.captureExtras = null;
  setBodyFromBlob(file, "upload");
  event.target.value = "";
}

const CAMERA_HINT = {
  ring: "왼손을 보여주세요",
  bracelet: "손등을 카메라로 향해주세요",
  earring: "한손 셀카 · 살짝 기울여 귀를 가이드에",
  necklace: "전면 카메라 · 얼굴·목을 가이드에 맞추세요",
};

const GUIDE_CAPTION = {
  ring: "반지 착용",
  bracelet: "팔찌 착용",
  earring: "귀걸이 착용",
  necklace: "목걸이 착용",
};

const FINGER_LABEL = {
  index: "검지",
  middle: "중지",
  ring: "약지",
  pinky: "소지",
};

const WEAR_LABEL = {
  ring: "반지",
  bracelet: "팔찌",
  earring: "귀걸이",
  necklace: "목걸이",
};

function resolveType() {
  return state.wearType || guessTypeFromText(state.item.title, state.item.category || "") || "bracelet";
}

/** 목걸이·귀걸이 = 전면(user), 반지·팔찌 = 후면(environment) */
function facingModeForType(type) {
  return type === "earring" || type === "necklace" ? "user" : "environment";
}

/** Prefer exact facing; many phones ignore `ideal` and open the rear cam. */
async function openCameraStream(facing) {
  const base = { width: { ideal: 1280 }, height: { ideal: 720 } };
  const tryGet = async (videoConstraints) =>
    navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints });

  if (facing === "user") {
    try {
      return await tryGet({ ...base, facingMode: { exact: "user" } });
    } catch (_) {
      /* fall through */
    }
    try {
      return await tryGet({ ...base, facingMode: "user" });
    } catch (_) {
      /* fall through */
    }
  }

  try {
    return await tryGet({ ...base, facingMode: { ideal: facing } });
  } catch (_) {
    return tryGet(true);
  }
}

function streamFacingMode(stream) {
  try {
    return stream?.getVideoTracks?.()?.[0]?.getSettings?.()?.facingMode || "";
  } catch (_) {
    return "";
  }
}

function earringGuideCaption(anatomicalSide) {
  return anatomicalSide === "left" ? "왼쪽 귀(+)" : "오른쪽 귀(+)";
}

function ringGuideCaption(finger) {
  const label = FINGER_LABEL[finger] || "약지";
  return `왼손 · ${label}`;
}

function setRingFinger(finger) {
  const ok = ["index", "middle", "ring", "pinky"].includes(finger) ? finger : "ring";
  state.ringFinger = ok;
  document.querySelectorAll(".finger-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.finger === state.ringFinger);
  });
  const changeBtn = $("fingerChangeBtn");
  if (changeBtn) changeBtn.textContent = `${FINGER_LABEL[state.ringFinger] || "약지"} 변경`;
  if (state.wearType === "ring") {
    if ($("guideCaption")) $("guideCaption").textContent = ringGuideCaption(state.ringFinger);
    if ($("cameraHint")) {
      $("cameraHint").textContent = CAMERA_HINT.ring;
    }
  }
}

function postParent(type) {
  if (!embedded || !window.parent || window.parent === window) return;
  try {
    window.parent.postMessage({ type }, "*");
  } catch (_) {}
}

function setEarSide(side) {
  state.earSide = side === "left" ? "left" : "right";
  const guide = $("cameraGuide");
  if (guide) guide.dataset.ear = state.earSide;
  document.querySelectorAll(".ear-side-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.ear === state.earSide);
  });
  if (state.wearType === "earring" && $("guideCaption")) {
    $("guideCaption").textContent = earringGuideCaption(state.earSide);
  }
  if (state.wearType === "earring" && $("cameraHint")) {
    $("cameraHint").textContent =
      state.earSide === "right"
        ? "전면 카메라 · 오른쪽 귀를 가이드에 맞추세요"
        : "전면 카메라 · 왼쪽 귀를 가이드에 맞추세요";
  }
}

function applyWearTypeFromProduct() {
  const forced = String(params.get("type") || "").toLowerCase();
  const allowed = ["bracelet", "ring", "necklace", "earring"];
  if (allowed.includes(forced)) {
    state.wearType = forced;
  } else {
    state.wearType =
      guessTypeFromText(state.item.title, state.item.category || "") ||
      guessTypeFromText(state.item.id || "", "") ||
      "bracelet";
  }
  const guide = $("cameraGuide");
  if (guide) {
    guide.dataset.type = state.wearType;
    guide.dataset.ear = state.earSide || "right";
  }
  if ($("cameraHint")) {
    if (state.wearType === "earring") {
      $("cameraHint").textContent =
        state.earSide === "right"
          ? "전면 카메라 · 오른쪽 귀를 화면 왼쪽 가이드에"
          : "전면 카메라 · 왼쪽 귀를 화면 오른쪽 가이드에";
    } else {
      $("cameraHint").textContent = CAMERA_HINT[state.wearType] || CAMERA_HINT.bracelet;
    }
  }
  if ($("guideCaption")) {
    $("guideCaption").textContent =
      state.wearType === "earring"
        ? earringGuideCaption(state.earSide)
        : state.wearType === "ring"
          ? ringGuideCaption(state.ringFinger)
          : (GUIDE_CAPTION[state.wearType] || GUIDE_CAPTION.bracelet);
  }
  const chip = $("wearTypeChip");
  if (chip) chip.textContent = WEAR_LABEL[state.wearType] || "자동";

  const earBar = $("earSideBar");
  if (earBar) {
    const showEar = state.wearType === "earring";
    earBar.hidden = !showEar;
    earBar.classList.toggle("is-hidden", !showEar);
  }
  const fingerBar = $("fingerBar");
  const fingerChange = $("fingerChangeBtn");
  if (fingerBar) {
    const showFinger = state.wearType === "ring";
    fingerBar.hidden = true;
    fingerBar.classList.add("is-hidden");
    fingerBar.classList.remove("is-expanded");
    if (showFinger) setRingFinger(state.ringFinger || "ring");
  }
  if (fingerChange) {
    const showFinger = state.wearType === "ring";
    fingerChange.hidden = !showFinger;
    fingerChange.classList.toggle("is-hidden", !showFinger);
    fingerChange.setAttribute("aria-expanded", "false");
    if (showFinger) {
      fingerChange.textContent = `${FINGER_LABEL[state.ringFinger] || "약지"} 변경`;
    }
  }
  const sub = $("cameraSub");
  if (sub) {
    sub.textContent =
      state.wearType === "earring" || state.wearType === "necklace"
        ? "전면 카메라로 얼굴을 맞춘 뒤 촬영하세요"
        : "정렬되면 약 1초 후 자동 촬영 · 직접 눌러도 됩니다";
  }
}

function stopCamera() {
  const video = $("cameraVideo");
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach((t) => t.stop());
    state.cameraStream = null;
  }
  if (video) video.srcObject = null;
}

function stopAlignLoop() {
  if (state.alignRaf) {
    cancelAnimationFrame(state.alignRaf);
    state.alignRaf = 0;
  }
  stopAlignClock();
  state.goodStreak = 0;
  state.goodSince = 0;
  const sheet = $("cameraSheet");
  sheet?.classList.remove("is-align-ok", "is-align-far");
  const alert = $("alignAlert");
  if (alert) {
    alert.textContent = "";
    alert.classList.add("is-hidden");
    alert.classList.remove("is-ok");
  }
  const holdEl = $("holdCountdown");
  if (holdEl) {
    holdEl.hidden = true;
    holdEl.classList.add("is-hidden");
    const num = holdEl.querySelector(".hold-countdown-num");
    if (num) num.textContent = "";
  }
}

function applyAlignUi(result, holdInfo = null) {
  const sheet = $("cameraSheet");
  const hint = $("cameraHint");
  const alert = $("alignAlert");
  const holdEl = $("holdCountdown");
  if (!sheet || !result) return;

  sheet.classList.toggle("is-align-ok", Boolean(result.ok));
  sheet.classList.toggle("is-align-far", Boolean(result.far));

  let message = result.message || "";
  if (result.ok && holdInfo) {
    const leftMs = Math.max(0, holdInfo.need - holdInfo.held);
    const p = Math.min(1, holdInfo.held / Math.max(1, holdInfo.need));
    message = leftMs > 40 ? "좋습니다. 그대로 유지해주세요" : "촬영합니다";
    if (holdEl) {
      holdEl.hidden = false;
      holdEl.classList.remove("is-hidden");
      holdEl.dataset.sec = "";
      const num = holdEl.querySelector(".hold-countdown-num");
      if (num) num.textContent = "";
      const ring = $("holdRingFill");
      if (ring) {
        ring.style.strokeDashoffset = String((1 - p) * 113.1);
      }
    }
    const shutter = $("shutterBtn");
    if (shutter) shutter.style.setProperty("--shutter-progress", String(p));
  } else if (holdEl) {
    holdEl.hidden = true;
    holdEl.classList.add("is-hidden");
    const num = holdEl.querySelector(".hold-countdown-num");
    if (num) num.textContent = "";
    $("shutterBtn")?.style.removeProperty("--shutter-progress");
  }

  if (message && hint) hint.textContent = message;

  if (!alert) return;
  if (result.far || result.ok) {
    alert.textContent = message;
    alert.classList.toggle("is-ok", Boolean(result.ok));
    alert.classList.remove("is-hidden");
  } else {
    alert.textContent = "";
    alert.classList.add("is-hidden");
    alert.classList.remove("is-ok");
  }
}

/** KYC-style hold after alignment ok — shorter for AR UX. */
const HOLD_MS = {
  necklace: 1000,
  earring: 1000,
  ring: 1000,
  bracelet: 1000,
};

function usesFrontCamera(type) {
  return type === "earring" || type === "necklace";
}

const ZOOM_MIN = 0.55;
const ZOOM_MAX = 2.6;

function defaultZoomForType(type) {
  if (type === "necklace") return 1.2;
  if (type === "earring") return 1.15;
  return 1;
}

function applyVideoTransform() {
  const video = $("cameraVideo");
  if (!video) return;
  const z = state.camZoom || 1;
  const front = usesFrontCamera(state.wearType);
  video.style.transformOrigin = "center center";
  video.style.transform = front ? `scaleX(-1) scale(${z})` : `scale(${z})`;
}

function setCamZoom(next) {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(next) || 1));
  state.camZoom = Math.round(z * 20) / 20;
  applyVideoTransform();
}

function setZoomUiVisible(show) {
  ["zoomSideLeft", "zoomSideRight"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.hidden = !show;
    el.classList.toggle("is-hidden", !show);
  });
}

function touchDistance(touches) {
  if (!touches || touches.length < 2) return 0;
  const a = touches[0];
  const b = touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function bindCameraZoomGestures() {
  const stage = document.querySelector(".camera-stage");
  if (!stage || stage.dataset.zoomBound === "1") return;
  stage.dataset.zoomBound = "1";

  stage.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 2) {
        state.pinchStartDist = touchDistance(e.touches);
        state.pinchStartZoom = state.camZoom || 1;
      }
    },
    { passive: true }
  );
  stage.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length !== 2 || !state.pinchStartDist) return;
      e.preventDefault();
      const d = touchDistance(e.touches);
      setCamZoom(state.pinchStartZoom * (d / state.pinchStartDist));
    },
    { passive: false }
  );
  stage.addEventListener(
    "touchend",
    () => {
      state.pinchStartDist = 0;
    },
    { passive: true }
  );
}

function placementToPixels(placement, imgW, imgH) {
  const c = placement?.center2D || placement?.center;
  if (!c) return null;
  const nx = c.x <= 1.5 ? c.x : c.x / imgW;
  const ny = c.y <= 1.5 ? c.y : c.y / imgH;
  const widthNorm =
    placement.radiusX != null
      ? placement.radiusX * 2.4
      : placement.radiusEstimate != null
        ? placement.radiusEstimate * 2
        : placement.width || 0.05;
  return {
    ...placement,
    center: { x: nx * imgW, y: ny * imgH },
    center2D: { x: nx, y: ny },
    width: Math.max(8, (widthNorm <= 1.5 ? widthNorm : widthNorm / imgW) * imgW),
    radiusX: placement.radiusX != null ? (placement.radiusX <= 1.5 ? placement.radiusX : placement.radiusX / imgW) : undefined,
    radiusY: placement.radiusY != null ? (placement.radiusY <= 1.5 ? placement.radiusY : placement.radiusY / imgH) : undefined,
    radiusEstimate: placement.radiusEstimate,
    angle: placement.angle || 0,
    frontAngle: placement.frontAngle != null ? placement.frontAngle : (placement.angle || 0) - 90,
    finger: placement.finger,
    source: placement.source || "capture",
  };
}

function ensureArGuide() {
  const root = $("cameraGuide");
  if (!root) return;
  if (!state.guideOverlay) {
    state.guideOverlay = new GuideOverlay(root);
    state.guideOverlay.setDebug(AR_DEBUG);
  }
  if (!state.guideState) state.guideState = new GuideStateEngine();
  if (!state.smoother) state.smoother = new TrackingSmoother();
  if (!state.perfHarness) state.perfHarness = new PerfHarness(45000);
  if (AR_DEBUG) ensureDebugPanel();
}

function ensureDebugPanel() {
  if ($("arDebugPanel")) return;
  const panel = document.createElement("div");
  panel.id = "arDebugPanel";
  panel.className = "ar-debug-panel";
  panel.innerHTML = `
    <button type="button" id="exportDebugReport" class="ar-debug-btn">디버그 리포트 내보내기</button>
    <label class="ar-debug-check"><input type="checkbox" id="dbgShowOcc" /> occluder</label>
    <label class="ar-debug-check"><input type="checkbox" id="dbgNoOcc" /> disable occlusion</label>
    <label class="ar-debug-check"><input type="checkbox" id="dbgJewelryOnly" /> jewelry only</label>
  `;
  document.body.appendChild(panel);
  $("exportDebugReport")?.addEventListener("click", () => {
    state.perfHarness?.download(`heritage-ar-debug-${Date.now()}.json`, {
      hairDecision: HAIR_OCCLUSION_DECISION,
      assetState: state.assetState,
      itemId: state.item.id,
      wearType: state.wearType,
      saveConsistency: state.arRenderer?.getDebugStats?.()?.saveConsistency,
    });
  });
  const syncFlags = () => {
    state.arRenderer?.setDebugFlags({
      showOccluder: Boolean($("dbgShowOcc")?.checked),
      disableOcclusion: Boolean($("dbgNoOcc")?.checked),
      jewelryOnly: Boolean($("dbgJewelryOnly")?.checked),
    });
  };
  $("dbgShowOcc")?.addEventListener("change", syncFlags);
  $("dbgNoOcc")?.addEventListener("change", syncFlags);
  $("dbgJewelryOnly")?.addEventListener("change", syncFlags);
  if (params.get("probeHair") === "1") {
    probeHairSegmenterCost().then((r) => console.info("[hair-probe]", r));
  }
}

async function ensureArRenderer(type) {
  const root = $("cameraGuide");
  if (!root) return null;
  if (!state.arRenderer) {
    state.arRenderer = new JewelryARRenderer(root, { debug: AR_DEBUG });
  }
  if (!state.arReady) {
    state.arReady = await state.arRenderer.init();
  }
  if (!state.arReady) return null;

  const allowValidation = AR_DEBUG && params.get("arValidation") === "1";
  const allowRepresentative = AR_DEBUG && params.get("repAssets") === "1";
  const forceValidation = allowValidation && params.get("forceValidation") === "1";
  const key = `${state.item.id}|${type}|${allowValidation}|${allowRepresentative}|${forceValidation}`;
  if (state._arLoadKey !== key) {
    const result = await state.arRenderer.loadProductForSku(state.item.id, type, {
      allowValidation,
      allowRepresentative,
      forceValidation,
    });
    state.arHasGlb = Boolean(result.ok);
    state.assetState = result.state;
    state._arLoadKey = key;
    if (type === "earring" && state.arHasGlb) {
      await state.arRenderer.ensurePairClone();
    }
  }
  state.arRenderer.setVisible(state.arHasGlb);
  return state.arRenderer;
}

async function alignTick() {
  if (!state.cameraOpen || state.capturing) return;
  const video = $("cameraVideo");
  const type = resolveType();
  const mirror = usesFrontCamera(type);
  ensureArGuide();
  try {
    const result = await evaluateAlignment(video, type, state.earSide, state.ringFinger, {
      mirror,
      zoom: state.camZoom || 1,
    });
    if (result) {
      let anchor = result.anchor3D || result.placement;
      let secondary = result.secondaryAnchor || null;
      if (type === "bracelet" && anchor) {
        anchor = state.smoother.smoothWrist(anchor) || anchor;
      } else if (type === "ring" && anchor) {
        anchor = state.smoother.smoothFinger(anchor) || anchor;
      } else if (type === "necklace" && anchor) {
        anchor = state.smoother.smoothGeneric("neck", anchor) || anchor;
      } else if (type === "earring" && anchor) {
        anchor = state.smoother.smoothGeneric("ear", anchor) || anchor;
        if (secondary) secondary = state.smoother.smoothGeneric("ear2", secondary) || secondary;
      }
      if (anchor && ((result.score || 0) >= 0.5 || result.ok)) {
        state.lastPlacement = anchor;
        state.lastSecondaryAnchor = secondary;
      }
      state.lastLandmarks = result.landmarks || null;

      const status = state.guideState.evaluate(type, anchor, {
        sawSomething: Boolean(result.landmarks || result.score),
        palmFacing: false,
      });
      const msg = state.guideState.message(status === "stable" && result.ok ? "stable" : status);

      // Live guide for all four modes
      state.guideOverlay.draw(
        type,
        anchor,
        result.ok || status === "stable" ? "stable" : status,
        AR_DEBUG ? result.landmarks : null,
        { secondary, curvePoints: anchor?.curvePoints }
      );

      // Production Three.js loop — every frame when GLB available
      const renderer = await ensureArRenderer(type);
      if (renderer?.hasGlb && anchor && (result.score || 0) >= 0.45) {
        const tRender0 = performance.now();
        renderer.applyLighting(video);
        renderer.updateFromAnchor(type, anchor, { secondaryAnchor: secondary });
        renderer.render();
        const stats = renderer.getDebugStats();
        if (AR_DEBUG) {
          state.guideOverlay.setDebugHud(stats);
          state.perfHarness?.noteFrame({
            fps: stats.fps,
            frameMs: performance.now() - tRender0 + (result._inferMs || 0),
            renderMs: stats.renderMs,
            handMs: result._handMs,
            faceMs: result._faceMs,
            poseMs: result._poseMs,
            anchorMs: result._anchorMs,
            projectionErrorPx: stats.projectionError?.pxError,
            tier: stats.tier,
            assetState: stats.assetState,
            mode: type,
            cameraW: video.videoWidth,
            cameraH: video.videoHeight,
            trackingLoss: !result.ok && (result.score || 0) < 0.3,
          });
        }
      } else if (renderer) {
        renderer.clearFrame();
        if (AR_DEBUG) {
          state.perfHarness?.noteFrame({
            fps: 0,
            assetState: state.assetState,
            mode: type,
            trackingLoss: true,
            cameraW: video.videoWidth,
            cameraH: video.videoHeight,
          });
        }
      }

      const lockMin = type === "bracelet" || type === "ring" || type === "necklace" || type === "earring" ? 0.65 : 0.86;
      const locked = Boolean(result.ok) && (result.score || 0) >= lockMin;
      const need = HOLD_MS[type] || 1000;
      const warmFrames = type === "bracelet" || type === "ring" || type === "necklace" || type === "earring" ? 4 : 12;
      const fireFrames = type === "bracelet" || type === "ring" || type === "necklace" || type === "earring" ? 10 : 24;
      if (locked) {
        state.goodStreak += 1;
        if (state.goodStreak < warmFrames) {
          state.goodSince = 0;
          applyAlignUi({ ...result, message: msg, ok: true }, null);
        } else {
          if (!state.goodSince) state.goodSince = performance.now();
          const held = performance.now() - state.goodSince;
          applyAlignUi({ ...result, message: msg }, { held, need });
          if (state.autoCaptureArmed && held >= need && state.goodStreak >= fireFrames) {
            state.autoCaptureArmed = false;
            shutterCapture();
            return;
          }
        }
      } else {
        state.goodStreak = 0;
        state.goodSince = 0;
        applyAlignUi({ ...result, ok: false, message: msg }, null);
      }
    }
  } catch (err) {
    console.warn("alignTick", err);
  }
  state.alignRaf = requestAnimationFrame(alignTick);
}

function startAlignLoop() {
  stopAlignLoop();
  state.autoCaptureArmed = true;
  state.goodStreak = 0;
  state.goodSince = 0;
  state.alignRaf = requestAnimationFrame(alignTick);
}

function closeCameraSheet({ fromHistory = false } = {}) {
  if (!state.cameraOpen && $("cameraSheet")?.hidden) return;

  stopAlignLoop();
  stopCamera();
  state.guideOverlay?.clear();
  state.smoother?.reset?.();
  if (state.arRenderer) {
    state.arRenderer.clearFrame();
    state.arRenderer.setVisible(false);
  }
  const sheet = $("cameraSheet");
  if (sheet) {
    sheet.hidden = true;
    sheet.classList.add("is-hidden");
    sheet.classList.remove("is-align-ok", "is-align-far", "is-front-mirror", "show-zoom");
  }
  setZoomUiVisible(false);
  document.body.classList.remove("camera-open");
  state.cameraOpen = false;
  state.capturing = false;
  state.autoCaptureArmed = true;

  if (fromHistory) return;

  if (embedded) {
    postParent("heritage-tryon-camera-close");
    return;
  }
  if (state.cameraHistoryLocal) {
    state.cameraHistoryLocal = false;
    state.closingCameraFromUi = true;
    history.back();
  }
}

async function openGuidedCamera() {
  applyWearTypeFromProduct();
  const sheet = $("cameraSheet");
  const video = $("cameraVideo");
  if (!sheet || !video) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("이 환경에서는 카메라 가이드 촬영이 불가합니다. 업로드를 이용해 주세요.", "is-err");
    $("fileInput")?.click();
    return;
  }

  sheet.hidden = false;
  sheet.classList.remove("is-hidden");
  document.body.classList.add("camera-open");
  state.cameraOpen = true;
  state.capturing = false;
  state.autoCaptureArmed = true;
  state.lastPlacement = null;
  setStatus("카메라 권한을 허용하면 가이드가 표시됩니다…");

  if (embedded) {
    postParent("heritage-tryon-camera-open");
  } else if (!state.cameraHistoryLocal) {
    history.pushState({ heritageCamera: true }, "");
    state.cameraHistoryLocal = true;
  }

  try {
    stopCamera();
    const facing = facingModeForType(state.wearType);
    let stream = await openCameraStream(facing);
    // If front was required but device still gave rear, retry once with exact user.
    const got = String(streamFacingMode(stream) || "").toLowerCase();
    if (facing === "user" && got && got !== "user") {
      try {
        stream.getTracks().forEach((t) => t.stop());
        stream = await openCameraStream("user");
      } catch (_) {
        /* keep previous stream */
      }
    }
    state.cameraStream = stream;
    video.srcObject = stream;
    // 전면 = 신분증/얼굴인식처럼 거울 미리보기. 후면 = 미러 없음.
    const front = usesFrontCamera(state.wearType);
    sheet.classList.toggle("is-front-mirror", front);
    setCamZoom(defaultZoomForType(state.wearType));
    bindCameraZoomGestures();
    setZoomUiVisible(front);
    await video.play();
    setStatus(CAMERA_HINT[state.wearType] || "손을 화면에 보여주세요");
    if ($("cameraSub")) {
      $("cameraSub").textContent = front
        ? "전면(셀카) 카메라 · 좌·우 줌 · 맞춘 뒤 잠시 유지"
        : "정렬되면 약 1초 후 자동 촬영 · 직접 눌러도 됩니다";
    }
    if (front && $("cameraHint") && state.wearType === "necklace") {
      $("cameraHint").textContent = "전면 카메라 · 얼굴·쇄골을 가이드에 맞추세요";
    }
    if (state.wearType === "earring") {
      setEarSide(state.earSide || "right");
    }
    if (state.wearType === "ring") {
      setRingFinger(state.ringFinger || "ring");
    }
    startAlignLoop();
  } catch (err) {
    console.warn(err);
    closeCameraSheet();
    setStatus("카메라 권한이 없어 업로드로 진행합니다.", "is-err");
    $("fileInput")?.click();
  }
}

function shutterCapture() {
  if (state.capturing) return;
  const video = $("cameraVideo");
  const canvas = $("cameraSnap");
  if (!video || !canvas || !video.videoWidth) {
    setStatus("카메라가 아직 준비되지 않았습니다.", "is-err");
    return;
  }
  state.capturing = true;
  stopAlignLoop();
  // Freeze last good placement from live align for all jewelry modes
  const freezeTypes = ["ring", "bracelet", "necklace", "earring"];
  state.capturePlacement =
    freezeTypes.includes(state.wearType) && state.lastPlacement
      ? { ...state.lastPlacement }
      : null;
  state.captureExtras = {
    secondaryAnchor: state.lastSecondaryAnchor ? { ...state.lastSecondaryAnchor } : null,
    arHasGlb: state.arHasGlb,
    productId: state.arRenderer?.productId || null,
    mirror: usesFrontCamera(state.wearType),
  };

  const front = usesFrontCamera(state.wearType);
  const z = Math.max(ZOOM_MIN, state.camZoom || 1);
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const ctx = canvas.getContext("2d");

  if (z > 1.001) {
    const cw = vw / z;
    const ch = vh / z;
    const sx = (vw - cw) / 2;
    const sy = (vh - ch) / 2;
    canvas.width = Math.max(1, Math.round(cw));
    canvas.height = Math.max(1, Math.round(ch));
    ctx.save();
    if (front) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (state.capturePlacement?.center || state.capturePlacement?.center2D) {
      const p = state.capturePlacement;
      const c = p.center2D || p.center;
      let nx = (c.x * vw - sx) / cw;
      let ny = (c.y * vh - sy) / ch;
      if (front) nx = 1 - nx;
      p.center = { x: nx, y: ny };
      p.center2D = { x: nx, y: ny };
      p.width = (p.width || p.radiusX * 2.4 || 0.05) * z;
      if (p.radiusX != null) p.radiusX *= z;
      if (p.radiusY != null) p.radiusY *= z;
      if (p.radiusEstimate != null) p.radiusEstimate *= z;
      if (front && p.angle != null) {
        p.angle = 180 - p.angle;
        p.frontAngle = p.angle - 90;
      }
    }
  } else {
    // z <= 1: full frame (shrink is preview-only; can't capture wider than sensor)
    canvas.width = vw;
    canvas.height = vh;
    ctx.save();
    if (front) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    ctx.restore();

    if ((state.capturePlacement?.center || state.capturePlacement?.center2D) && front) {
      const p = state.capturePlacement;
      const c = p.center2D || p.center;
      p.center = { x: 1 - c.x, y: c.y };
      p.center2D = { x: 1 - c.x, y: c.y };
      if (p.angle != null) {
        p.angle = 180 - p.angle;
        p.frontAngle = p.angle - 90;
      }
    }
  }

  canvas.toBlob((blob) => {
    if (!blob) {
      state.capturing = false;
      setStatus("촬영에 실패했습니다.", "is-err");
      startAlignLoop();
      return;
    }
    closeCameraSheet();
    setBodyFromBlob(blob, "camera");
  }, "image/jpeg", 0.92);
}

async function runMergeTryOn() {
  if (!state.bodyImage || !state.productReady) return;
  const btn = $("mergeTryOn");
  btn.disabled = true;
  setStageMode("merging");
  showMergeProgress(8);
  await sleep(200);

  try {
    setMergeProgress(18);
    const jewelry = await withTimeout(
      prepareJewelry({
        id: state.item.id,
        cover: state.item.sourceUrl || state.item.cover,
        title: state.item.title,
      }, () => {
        // swallow text status during merge — progress bar only
        setMergeProgress(Math.min(48, 18 + Math.random() * 8));
      }),
      60000,
      "주얼리 전처리 시간 초과"
    );
    setMergeProgress(52);

    const type = resolveType();
    let detection;
    try {
      detection = await withTimeout(
        detectBody(state.bodyImage, type, () => setMergeProgress(62), {
          earSide: state.earSide,
          ringFinger: state.ringFinger,
        }),
        45000,
        "신체 인식 시간 초과"
      );
    } catch (err) {
      console.warn(err);
      detection = { type, target: null };
    }
    setMergeProgress(72);

    const useType = detection.type || type;
    // Phase 1 StyleAR: still re-detect wins over live capture coords
    const resolved = resolveComposeTarget({
      mode: useType,
      detection,
      capturePlacement: state.capturePlacement,
      bodyImage: state.bodyImage,
      placementToPixels,
      extras: {
        earSide: state.earSide,
        ringFinger: state.ringFinger,
      },
    });
    const target = resolved.target;
    const usedFallback = resolved.usedFallback;

    setMergeProgress(82);

    // Ensure AR renderer for high-res save — AssetResolver, no silent validation
    const allowValidation = AR_DEBUG && params.get("arValidation") === "1";
    const allowRepresentative = AR_DEBUG && params.get("repAssets") === "1";
    if (!state.arRenderer) {
      const mount = $("cameraGuide") || document.body;
      state.arRenderer = new JewelryARRenderer(mount, { debug: AR_DEBUG });
      state.arReady = await state.arRenderer.init();
    }
    if (state.arReady) {
      const result = await state.arRenderer.loadProductForSku(state.item.id, useType, {
        allowValidation,
        allowRepresentative,
      });
      state.arHasGlb = Boolean(result.ok);
      state.assetState = result.state;
    }

    const bodyCanvas =
      state.bodyImage instanceof HTMLCanvasElement
        ? state.bodyImage
        : (() => {
            const c = document.createElement("canvas");
            c.width = state.bodyImage.naturalWidth || state.bodyImage.width;
            c.height = state.bodyImage.naturalHeight || state.bodyImage.height;
            c.getContext("2d").drawImage(state.bodyImage, 0, 0);
            return c;
          })();

    const anchorForSave = targetToAnchor(target, bodyCanvas.width, bodyCanvas.height);
    const composed = await withTimeout(
      runStyleArCompose({
        bodyCanvas,
        bodyImage: state.bodyImage,
        jewelryCanvas: jewelry.canvas,
        type: useType,
        mode: useType,
        target,
        detection,
        capturePlacement: state.capturePlacement,
        placementToPixels,
        arRenderer: state.arRenderer,
        anchor: anchorForSave,
        extras: {
          secondaryAnchor: state.captureExtras?.secondaryAnchor || null,
          earSide: state.earSide,
          ringFinger: state.ringFinger,
          bodySource: state.bodySource || "unknown",
        },
      }),
      60000,
      "합성 시간 초과"
    );
    const after = composed.canvas;
    const composePath = composed.path || composed.pipeline || "stylear-compose";
    setMergeProgress(96);
    state.afterCanvas = after;
    const canvas = $("resultCanvas");
    canvas.width = after.width;
    canvas.height = after.height;
    canvas.getContext("2d").drawImage(after, 0, 0);
    setMergeProgress(100);
    await sleep(180);
    hideMergeProgress();
    setStageMode("result");
    const srcLabel =
      composed.resolveSource === "still"
        ? "사진 재인식"
        : composed.resolveSource === "capture"
          ? "촬영 가이드"
          : "기본 위치";
    setStatus(
      usedFallback
        ? "위치 인식이 어려워 가이드 기준으로 합성했습니다. 다시 촬영해 보세요."
        : composePath === "glb-highres"
          ? `3D 고해상도 착용 (${srcLabel}). 저장하거나 초기화할 수 있습니다.`
          : `착용 미리보기 (${srcLabel} · StyleAR 합성). 저장하거나 초기화할 수 있습니다.`,
      "is-ok"
    );
  } catch (err) {
    console.error(err);
    hideMergeProgress();
    setStageMode("split");
    setStatus(String(err.message || err), "is-err");
    refreshReady();
  }
}

function resetToSplit() {
  state.afterCanvas = null;
  setStageMode("split");
  refreshReady();
  setStatus("초기화되었습니다. 사진을 바꾸거나 다시 착용해보세요.");
}

function download() {
  const c = state.afterCanvas || $("resultCanvas");
  const a = document.createElement("a");
  a.download = `heritage-tryon-${state.item.id}.png`;
  a.href = c.toDataURL("image/png");
  a.click();
}

function closeStudio() {
  closeCameraSheet();
  if (state.arRenderer) {
    state.arRenderer.dispose();
    state.arRenderer = null;
    state.arReady = false;
    state.arHasGlb = false;
  }
  if (embedded && window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "heritage-tryon-close" }, "*");
    return;
  }
  if (history.length > 1) history.back();
  else location.href = "https://hand-made.kr/landing.html?open=portfolio";
}

window.addEventListener("popstate", () => {
  if (state.closingCameraFromUi) {
    state.closingCameraFromUi = false;
    return;
  }
  if (state.cameraOpen) {
    state.cameraHistoryLocal = false;
    closeCameraSheet({ fromHistory: true });
  }
});

window.addEventListener("message", (event) => {
  if (event?.data?.type === "heritage-tryon-close-camera") {
    closeCameraSheet({ fromHistory: true });
  }
});

$("closeStudio").addEventListener("click", () => {
  closeCameraSheet();
  closeStudio();
});
$("openCamera")?.addEventListener("click", openGuidedCamera);
$("closeCamera")?.addEventListener("click", () => closeCameraSheet());
$("shutterBtn")?.addEventListener("click", shutterCapture);
$("fileInput").addEventListener("change", onPickFile);
$("mergeTryOn").addEventListener("click", runMergeTryOn);
$("resetBtn").addEventListener("click", resetToSplit);
$("downloadBtn").addEventListener("click", download);
$("earSideBar")?.addEventListener("click", (event) => {
  const btn = event.target.closest(".ear-side-btn");
  if (!btn) return;
  setEarSide(btn.dataset.ear);
});
$("fingerBar")?.addEventListener("click", (event) => {
  const btn = event.target.closest(".finger-btn");
  if (!btn) return;
  setRingFinger(btn.dataset.finger);
  const bar = $("fingerBar");
  if (bar) {
    bar.hidden = true;
    bar.classList.add("is-hidden");
    bar.classList.remove("is-expanded");
  }
  const change = $("fingerChangeBtn");
  if (change) change.setAttribute("aria-expanded", "false");
});
$("fingerChangeBtn")?.addEventListener("click", () => {
  const bar = $("fingerBar");
  const change = $("fingerChangeBtn");
  if (!bar) return;
  const open = bar.classList.contains("is-expanded");
  if (open) {
    bar.hidden = true;
    bar.classList.add("is-hidden");
    bar.classList.remove("is-expanded");
    change?.setAttribute("aria-expanded", "false");
  } else {
    bar.hidden = false;
    bar.classList.remove("is-hidden");
    bar.classList.add("is-expanded");
    change?.setAttribute("aria-expanded", "true");
  }
});
$("zoomIn")?.addEventListener("click", () => setCamZoom((state.camZoom || 1) + 0.15));
$("zoomOut")?.addEventListener("click", () => setCamZoom((state.camZoom || 1) - 0.15));

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAlignLoop();
    state.arRenderer?.clearFrame();
  } else if (state.cameraOpen && !state.capturing) {
    startAlignLoop();
  }
});

window.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  console.warn("WebGL context lost");
  state.arReady = false;
  state.arHasGlb = false;
}, true);

setStageMode("split");
applyWearTypeFromProduct();
loadProduct();
