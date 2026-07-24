import { prepareJewelry } from "./services/jewelry.js";
import { detectBody } from "./services/mediapipe.js";
import { assetUrl, guessTypeFromText, loadPortfolioItem } from "./services/portfolio.js";
import { composeTryOn, fallbackTarget } from "./services/tryon.js";
import { evaluateAlignment, stopAlignClock } from "./services/align.js";

const params = new URLSearchParams(location.search);
const embedded = params.get("embed") === "1";

const state = {
  item: {
    id: params.get("id") || "portfolio-item",
    title: params.get("title") || "헤리티지",
    category: params.get("category") || "",
    cover: params.get("image") || params.get("path") || "",
  },
  bodyImage: null,
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

function setBodyFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    state.bodyImage = img;
    const preview = $("bodyPreview");
    preview.src = url;
    preview.alt = "";
    show(preview);
    hide($("captureEmpty"));
    $("captureFrame")?.classList.add("has-photo");
    refreshReady();
    setStatus("사진이 준비되었습니다. ‘착용해보기’를 눌러주세요.", "is-ok");
  };
  img.onerror = () => setStatus("사진 로드에 실패했습니다.", "is-err");
  img.src = url;
}

function onPickFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  setBodyFromBlob(file);
  event.target.value = "";
}

const CAMERA_HINT = {
  ring: "왼손 손등 · 아래에서 착용할 손가락을 고르세요",
  bracelet: "주먹을 위로 · 주황 링(+)에 손목을 맞추세요",
  earring: "전면 카메라 · 귀를 가이드에 맞춘 뒤 3초간 유지",
  necklace: "전면 · 얼굴·목을 가이드 중심에 맞추고 3초 유지",
};

const GUIDE_CAPTION = {
  ring: "왼손 손등 · 약지(+)",
  bracelet: "손↑ · 손목(+) · 팔뚝↓",
  earring: "오른쪽 귀(+)",
  necklace: "얼굴·목 · 가이드 중심 · 3초",
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

function earringGuideCaption(anatomicalSide) {
  return anatomicalSide === "left" ? "왼쪽 귀(+)" : "오른쪽 귀(+)";
}

function ringGuideCaption(finger) {
  const label = FINGER_LABEL[finger] || "약지";
  return `왼손 손등 · ${label}(+)`;
}

function setRingFinger(finger) {
  const ok = ["index", "middle", "ring", "pinky"].includes(finger) ? finger : "ring";
  state.ringFinger = ok;
  document.querySelectorAll(".finger-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.finger === state.ringFinger);
  });
  if (state.wearType === "ring") {
    if ($("guideCaption")) $("guideCaption").textContent = ringGuideCaption(state.ringFinger);
    if ($("cameraHint")) {
      $("cameraHint").textContent = `왼손 손등 · ${FINGER_LABEL[state.ringFinger]}에 맞춰 주세요`;
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
  state.wearType = guessTypeFromText(state.item.title, state.item.category || "") || "bracelet";
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
  if (fingerBar) {
    const showFinger = state.wearType === "ring";
    fingerBar.hidden = !showFinger;
    fingerBar.classList.toggle("is-hidden", !showFinger);
    if (showFinger) setRingFinger(state.ringFinger || "ring");
  }
  const sub = $("cameraSub");
  if (sub) {
    sub.textContent =
      state.wearType === "earring" || state.wearType === "necklace"
        ? "전면 카메라로 얼굴을 맞춘 뒤 촬영하세요"
        : state.wearType === "ring"
          ? "왼손 손등 · 손가락을 고른 뒤 가이드에 맞추세요"
          : "가이드에 맞추면 자동 촬영됩니다 · 직접 눌러도 됩니다";
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
    const sec = Math.max(1, Math.ceil(leftMs / 1000));
    message = leftMs > 50 ? `그대로 ${sec}초간 유지해 주세요` : "촬영합니다";
    if (holdEl) {
      holdEl.hidden = false;
      holdEl.classList.remove("is-hidden");
      holdEl.dataset.sec = String(sec);
      const num = holdEl.querySelector(".hold-countdown-num");
      if (num) num.textContent = String(sec);
      const ring = $("holdRingFill");
      if (ring) {
        const p = Math.min(1, holdInfo.held / Math.max(1, holdInfo.need));
        ring.style.strokeDashoffset = String((1 - p) * 113.1);
      }
    }
  } else if (holdEl) {
    holdEl.hidden = true;
    holdEl.classList.add("is-hidden");
    const num = holdEl.querySelector(".hold-countdown-num");
    if (num) num.textContent = "";
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

/** KYC-style hold: 3 seconds after alignment ok. */
const HOLD_MS = {
  necklace: 3000,
  earring: 3000,
  ring: 3000,
  bracelet: 3000,
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
  if (!placement?.center) return null;
  return {
    center: { x: placement.center.x * imgW, y: placement.center.y * imgH },
    width: Math.max(8, (placement.width || 0.05) * imgW),
    angle: placement.angle || 0,
    frontAngle: placement.frontAngle != null ? placement.frontAngle : (placement.angle || 0) - 90,
    finger: placement.finger,
    source: "capture",
  };
}

async function alignTick() {
  if (!state.cameraOpen || state.capturing) return;
  const video = $("cameraVideo");
  const type = resolveType();
  const mirror = usesFrontCamera(type);
  try {
    const result = await evaluateAlignment(video, type, state.earSide, state.ringFinger, {
      mirror,
      zoom: state.camZoom || 1,
    });
    if (result) {
      // Must be truly locked — loose ok alone must not start 3-2-1
      const locked = Boolean(result.ok) && (result.score || 0) >= 0.86;
      if (result.placement && locked) state.lastPlacement = result.placement;
      const need = HOLD_MS[type] || 3000;
      if (locked) {
        state.goodStreak += 1;
        // Warm-up ~0.6s continuous lock before countdown begins
        if (state.goodStreak < 20) {
          state.goodSince = 0;
          applyAlignUi(
            { ...result, message: "좋아요 · 가이드에 정확히 유지 중…" },
            null
          );
        } else {
          if (!state.goodSince) state.goodSince = performance.now();
          const held = performance.now() - state.goodSince;
          applyAlignUi(result, { held, need });
          if (state.autoCaptureArmed && held >= need && state.goodStreak >= 40) {
            state.autoCaptureArmed = false;
            shutterCapture();
            return;
          }
        }
      } else {
        state.goodStreak = 0;
        state.goodSince = 0;
        applyAlignUi(
          result.ok
            ? { ...result, ok: false, message: "가이드에 더 정확히 맞춰 주세요" }
            : result,
          null
        );
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
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    state.cameraStream = stream;
    video.srcObject = stream;
    // 전면 = 신분증/얼굴인식처럼 거울 미리보기. 후면 = 미러 없음.
    const front = usesFrontCamera(state.wearType);
    sheet.classList.toggle("is-front-mirror", front);
    setCamZoom(defaultZoomForType(state.wearType));
    bindCameraZoomGestures();
    setZoomUiVisible(front);
    await video.play();
    setStatus(CAMERA_HINT[state.wearType] || "가이드에 맞춘 뒤 3초간 유지하세요.");
    if ($("cameraSub")) {
      $("cameraSub").textContent = front
        ? "좌·우 버튼 또는 두 손가락으로 줌 · 얼굴·목 맞춘 뒤 3초 유지"
        : "가이드에 맞춘 뒤 3초간 유지하면 자동 촬영됩니다 · 직접 눌러도 됩니다";
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
  // Freeze last good ring placement from live align (still-image redetect often fails)
  state.capturePlacement =
    state.wearType === "ring" && state.lastPlacement ? { ...state.lastPlacement } : null;

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

    if (state.capturePlacement?.center) {
      const p = state.capturePlacement;
      let nx = (p.center.x * vw - sx) / cw;
      let ny = (p.center.y * vh - sy) / ch;
      if (front) nx = 1 - nx;
      p.center = { x: nx, y: ny };
      p.width = (p.width || 0.05) * z;
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

    if (state.capturePlacement?.center && front) {
      const p = state.capturePlacement;
      p.center = { x: 1 - p.center.x, y: p.center.y };
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
    setBodyFromBlob(blob);
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
    let target = detection.target;
    if (useType === "bracelet") {
      target = detection.allTargets?.bracelet || fallbackTarget(state.bodyImage, "bracelet");
    } else if (useType === "ring") {
      const w = state.bodyImage.naturalWidth || state.bodyImage.width;
      const h = state.bodyImage.naturalHeight || state.bodyImage.height;
      const fromCapture = placementToPixels(state.capturePlacement, w, h);
      target =
        fromCapture ||
        detection.allTargets?.ring ||
        detection.target ||
        fallbackTarget(state.bodyImage, "ring", { ringFinger: state.ringFinger });
    } else if (!target) {
      target = fallbackTarget(state.bodyImage, useType, {
        earSide: state.earSide,
        ringFinger: state.ringFinger,
      });
    }
    const usedFallback = useType === "bracelet"
      ? !detection.allTargets?.bracelet
      : useType === "ring"
        ? !(state.capturePlacement || detection.allTargets?.ring || detection.target)
        : !detection.target;

    setMergeProgress(82);
    const after = await withTimeout(
      composeTryOn(state.bodyImage, jewelry.canvas, target, useType),
      45000,
      "합성 시간 초과"
    );
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
    setStatus(
      usedFallback
        ? "위치 인식이 어려워 가이드 기준으로 합성했습니다. 손·손목이 더 보이게 다시 촬영해 보세요."
        : "착용 미리보기입니다. 저장하거나 초기화할 수 있습니다.",
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
});
$("zoomIn")?.addEventListener("click", () => setCamZoom((state.camZoom || 1) + 0.15));
$("zoomOut")?.addEventListener("click", () => setCamZoom((state.camZoom || 1) - 0.15));

setStageMode("split");
applyWearTypeFromProduct();
loadProduct();
