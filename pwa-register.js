(() => {
  "use strict";

  const APP_BUILD = "20260810-gbcal66";
  const APP_VERSION = "v1.12.47";
  const RELEASE_NOTES = [
    "공지사항 독립 페이지·퀵메뉴 순서 수정",
    "메인 배너·공지 목록 여백 개선",
    "버그 수정 및 안정성 개선",
  ];
  const BUILD_KEY = "hx.pwa.build";
  const ACTIVATED_KEY = "hx.pwa.activatedBuild";
  const FRESH_KEY = "hx.pwa.freshToastAt";
  const BANNER_ID = "pwaStatusBanner";
  const DIALOG_ID = "pwaUpdateDialog";
  const RECOVER_KEY = "hx.pwa.mojibakeRecover";
  const UPDATE_SNOOZE_KEY = "hx.pwa.updateSnooze";
  const INSTALLED_BUILD_KEY = "hx.pwa.installedBuild";
  const PROMPTED_BUILD_KEY = "hx.pwa.promptedBuild";
  const MIN_INSTALL_BUILD = "20260809-gbcal31";
  const REINSTALL_GATE_ID = "pwaReinstallGate";

  /** Only true after customer taps 「업데이트」 */
  let userApprovedUpdate = false;
  let pendingWorker = null;
  let refreshing = false;
  let updateOffered = false;
  let promptedBuild = "";
  let remoteNotes = null;
  let pendingRemoteBuild = "";
  let updateProgressLock = false;

  async function emergencyFixMojibake() {
    if (sessionStorage.getItem(RECOVER_KEY) === "1") return false;
    const title = document.querySelector(".hero-title");
    const sample =
      (title && title.textContent) ||
      document.title ||
      (document.body && document.body.innerText.slice(0, 400)) ||
      "";
    const broken =
      sample.includes("\uFFFD") ||
      /br>/.test(sample) ||
      (sample.length > 8 && !/[가-힣]/.test(sample) && /[ÃÂïìë]/.test(sample));
    if (!broken) return false;

    sessionStorage.setItem(RECOVER_KEY, "1");
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (_) {}
    const url = new URL(location.href);
    url.searchParams.set("_fix", String(Date.now()));
    location.replace(url.href);
    return true;
  }

  // Run ASAP — corrupted cache must not linger on web or PWA
  emergencyFixMojibake();

  const IMG_FALLBACK =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">' +
        '<rect width="640" height="640" fill="#2a2724"/>' +
        '<text x="320" y="292" text-anchor="middle" fill="#c4bdb4" font-family="sans-serif" font-size="26">이미지 준비 중</text>' +
        '<text x="320" y="340" text-anchor="middle" fill="#8a837b" font-family="sans-serif" font-size="18">와이파이에서 열면 저장됩니다</text>' +
        "</svg>"
    );

  function isPwaMode() {
    try {
      if (window.matchMedia("(display-mode: standalone)").matches) return true;
      if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
      if (window.matchMedia("(display-mode: minimal-ui)").matches) return true;
    } catch (_) {}
    if (window.navigator.standalone === true) return true;
    if (/[?&]app=1(?:&|$)/.test(location.search)) return true;
    return false;
  }

  function markPwaMode() {
    if (!isPwaMode()) return false;
    document.documentElement.classList.add("is-pwa");
    if (document.body) document.body.classList.add("is-pwa");
    return true;
  }

  markPwaMode();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", markPwaMode);
  }

  function compareBuild(a, b) {
    return String(a || "").localeCompare(String(b || ""));
  }

  function needsReinstallGate() {
    if (!isPwaMode()) return false;
    if (/install\.html/i.test(location.pathname)) return false;
    const installed = localStorage.getItem(INSTALLED_BUILD_KEY) || "";
    if (!installed) return true;
    return compareBuild(installed, MIN_INSTALL_BUILD) < 0;
  }

  function ensureReinstallGateStyles() {
    if (document.getElementById("pwaReinstallGateStyle")) return;
    const style = document.createElement("style");
    style.id = "pwaReinstallGateStyle";
    style.textContent =
      "html.is-pwa.is-pwa-reinstall-required body{overflow:hidden!important;background:#0b0b0c!important}" +
      "html.is-pwa.is-pwa-reinstall-required #pwaHome," +
      "html.is-pwa.is-pwa-reinstall-required .gb-bottom-nav," +
      "html.is-pwa.is-pwa-reinstall-required .landing," +
      "html.is-pwa.is-pwa-reinstall-required .pwa-groupbuy," +
      "html.is-pwa.is-pwa-reinstall-required main," +
      "html.is-pwa.is-pwa-reinstall-required .site-nav," +
      "html.is-pwa.is-pwa-reinstall-required .atmosphere{display:none!important}" +
      `#${REINSTALL_GATE_ID}{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:#0b0b0c;color:#f5f0e8;font-family:Pretendard,"Noto Sans KR",sans-serif}` +
      `#${REINSTALL_GATE_ID} .pwa-reinstall__card{width:min(360px,100%);border-radius:22px;padding:24px 20px;border:1px solid rgba(201,166,107,.35);background:linear-gradient(180deg,#1c1b19,#141312);box-shadow:0 24px 60px rgba(0,0,0,.45)}` +
      `#${REINSTALL_GATE_ID} h2{margin:0 0 10px;font-size:20px;font-weight:800;letter-spacing:-.03em}` +
      `#${REINSTALL_GATE_ID} p{margin:0;color:rgba(245,240,232,.72);font-size:14px;line-height:1.6}` +
      `#${REINSTALL_GATE_ID} ol{margin:14px 0 0;padding-left:18px;color:rgba(245,240,232,.78);font-size:13px;line-height:1.55}` +
      `#${REINSTALL_GATE_ID} a{display:flex;align-items:center;justify-content:center;min-height:48px;margin-top:18px;border-radius:14px;background:linear-gradient(145deg,#f0d09a,#e8b86d 55%,#d4924a);color:#161513;font-size:15px;font-weight:800;text-decoration:none}` +
      `#${REINSTALL_GATE_ID} a:active{filter:brightness(.97}`;
    document.head.appendChild(style);
  }

  function showReinstallGate() {
    if (!needsReinstallGate()) return false;
    document.documentElement.classList.add("is-pwa-reinstall-required");
    ensureReinstallGateStyles();
    if (document.getElementById(REINSTALL_GATE_ID)) return true;
    const installUrl = new URL("./install.html", location.href).href;
    const gate = document.createElement("div");
    gate.id = REINSTALL_GATE_ID;
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    gate.innerHTML =
      '<div class="pwa-reinstall__card">' +
      "<h2>앱 재설치가 필요합니다</h2>" +
      "<p>세로 고정·최신 기능 적용을 위해 홈화면 아이콘을 삭제한 뒤 다시 설치해 주세요.</p>" +
      "<ol>" +
      "<li>홈화면 <strong>본 헤리티지</strong> 아이콘 길게 눌러 <strong>삭제</strong></li>" +
      "<li>아래 버튼으로 설치 페이지 열기</li>" +
      "<li>다시 <strong>홈 화면에 추가</strong></li>" +
      "</ol>" +
      `<a href="${installUrl}">재설치 안내 · 설치 페이지 열기</a>` +
      "</div>";
    (document.body || document.documentElement).appendChild(gate);
    return true;
  }

  if (showReinstallGate()) {
    window.__HX_PWA_REINSTALL_REQUIRED = true;
  }

  /**
   * Same as cursorphone-relay rd38 — OS portrait lock via Screen Orientation API.
   */
  function lockPortraitOrientation() {
    if (!isPwaMode()) return;
    const root = document.documentElement;
    root.classList.add("is-device-portrait");
    root.classList.remove("is-device-landscape", "is-landscape-blocked", "portrait-lock-active");

    function tryLock() {
      root.classList.remove("is-device-landscape");
      root.classList.add("is-device-portrait");
      try {
        const o = screen.orientation || screen.mozOrientation || screen.msOrientation;
        if (o && typeof o.lock === "function") {
          Promise.resolve(o.lock("portrait-primary")).catch(() => {
            Promise.resolve(o.lock("portrait")).catch(() => {});
          });
        }
      } catch (_) {}
      try {
        if (typeof screen.lockOrientation === "function") screen.lockOrientation("portrait-primary");
        if (typeof screen.mozLockOrientation === "function") screen.mozLockOrientation("portrait-primary");
        if (typeof screen.msLockOrientation === "function") screen.msLockOrientation("portrait-primary");
      } catch (_) {}
    }

    tryLock();
    window.addEventListener("orientationchange", () => {
      setTimeout(tryLock, 30);
      setTimeout(tryLock, 200);
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) tryLock();
    });
    window.addEventListener("focus", tryLock);
    document.addEventListener("touchstart", tryLock, { passive: true, capture: true });
    document.addEventListener("pointerdown", tryLock, { passive: true, capture: true });
    document.addEventListener("click", tryLock, true);
    window.setInterval(tryLock, 1500);
  }

  lockPortraitOrientation();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", lockPortraitOrientation);
  }

  function ensureAppCss() {
    if (document.querySelector('link[href*="pwa-app.css"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL(`pwa-app.css?v=${APP_BUILD}`, location.href).href;
    document.head.appendChild(link);
  }
  ensureAppCss();

  function protectImage(img) {
    if (!img || img.tagName !== "IMG" || img.dataset.pwaProtect === "1") return;
    img.dataset.pwaProtect = "1";
    const applyFallback = () => {
      if (img.dataset.pwaFallback === "1") return;
      img.dataset.pwaFallback = "1";
      img.alt = img.alt || "이미지 준비 중";
      img.removeAttribute("srcset");
      img.src = IMG_FALLBACK;
    };
    img.addEventListener("error", applyFallback);
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) {
      applyFallback();
    }
  }

  function scanImages(root) {
    (root || document).querySelectorAll?.("img").forEach(protectImage);
  }

  document.addEventListener(
    "error",
    (event) => {
      const img = event.target;
      if (!img || img.tagName !== "IMG") return;
      protectImage(img);
      if (img.dataset.pwaFallback === "1") return;
      img.dataset.pwaFallback = "1";
      img.alt = img.alt || "이미지 준비 중";
      img.removeAttribute("srcset");
      img.src = IMG_FALLBACK;
    },
    true
  );

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => scanImages(document));
  } else {
    scanImages(document);
  }

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.tagName === "IMG") protectImage(node);
        else scanImages(node);
      });
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  window.GongbangProtectImage = protectImage;

  function ensureBannerStyles() {
    if (document.getElementById("pwaStatusStyle")) return;
    const style = document.createElement("style");
    style.id = "pwaStatusStyle";
    style.textContent = `
      #${BANNER_ID}{
        position:fixed; left:50%; transform:translateX(-50%);
        top:max(10px, env(safe-area-inset-top));
        z-index:99999; width:min(520px, calc(100vw - 20px));
        background:rgba(18,17,16,.94); color:#f4f2ee;
        border:1px solid rgba(232,184,109,.35); border-radius:14px;
        box-shadow:0 12px 32px rgba(0,0,0,.35); backdrop-filter:blur(10px);
        font-family:Pretendard,SUIT,"Noto Sans KR",sans-serif;
      }
      #${BANNER_ID}[hidden]{ display:none !important; }
      #${BANNER_ID}.is-offline{ border-color:rgba(148,163,184,.45); }
      #${BANNER_ID}.is-updating{ border-color:rgba(232,184,109,.55); }
      #${BANNER_ID}.is-ready{ border-color:rgba(52,211,153,.45); }
      .pwa-status__row{ display:flex; align-items:center; gap:10px; padding:11px 12px; }
      .pwa-status__dot{ width:8px; height:8px; border-radius:50%; background:#e8b86d; flex:0 0 auto; }
      .is-offline .pwa-status__dot{ background:#94a3b8; }
      .is-ready .pwa-status__dot{ background:#34d399; }
      .is-updating .pwa-status__dot{ animation:pwaPulse 1s ease-in-out infinite; }
      @keyframes pwaPulse{ 0%,100%{ opacity:1 } 50%{ opacity:.35 } }
      .pwa-status__text{ flex:1; font-size:13px; line-height:1.4; font-weight:650; }
      .pwa-status__action{
        border:0; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:800;
        background:#e8b86d; color:#161513; cursor:pointer;
      }
      .pwa-status__close{
        border:0; background:transparent; color:#c4bdb4; font-size:18px; line-height:1;
        cursor:pointer; padding:0 2px;
      }
      #${DIALOG_ID}{
        position:fixed; inset:0; z-index:100000; display:grid; place-items:center;
        padding:20px; background:rgba(0,0,0,.55); backdrop-filter:blur(6px);
        font-family:Pretendard,SUIT,"Noto Sans KR",sans-serif;
      }
      #${DIALOG_ID}[hidden]{ display:none !important; }
      .pwa-dlg{
        width:min(360px, 100%); border-radius:22px; padding:22px 20px 16px;
        background:linear-gradient(180deg,#1c1b19,#141312);
        border:1px solid rgba(232,184,109,.28); color:#f6f3ee;
        box-shadow:0 24px 60px rgba(0,0,0,.45);
      }
      .pwa-dlg__eyebrow{
        margin:0 0 8px; color:#e8b86d; font-size:11px; font-weight:800; letter-spacing:.16em;
      }
      .pwa-dlg__title{ margin:0; font-size:18px; font-weight:800; letter-spacing:-.03em; }
      .pwa-dlg__body{ margin:10px 0 0; color:rgba(246,243,238,.68); font-size:13px; line-height:1.55; }
      .pwa-dlg__actions{ display:flex; gap:8px; margin-top:18px; }
      .pwa-dlg__actions button{
        flex:1; min-height:44px; border-radius:14px; border:1px solid rgba(255,255,255,.12);
        background:transparent; color:#f6f3ee; font-size:14px; font-weight:750; cursor:pointer;
      }
      .pwa-dlg__actions .is-primary{
        border:0; background:linear-gradient(145deg,#f0d09a,#e8b86d 55%,#d4924a); color:#161513;
      }
      .pwa-dlg.is-progress .pwa-dlg__actions{ display:none; }
      .pwa-dlg.is-progress .pwa-dlg__notes{ display:none; }
      .pwa-progress{
        margin-top:18px; height:8px; border-radius:999px; overflow:hidden;
        background:rgba(255,255,255,.08);
      }
      .pwa-progress > i{
        display:block; height:100%; width:0%; border-radius:999px;
        background:linear-gradient(90deg,#f0d09a,#e8b86d 55%,#d4924a);
        transition:width .35s ease;
      }
      .pwa-progress__pct{
        margin:10px 0 0; font-size:12px; font-weight:750; color:rgba(246,243,238,.72);
        letter-spacing:.02em;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureBanner() {
    ensureBannerStyles();
    let el = document.getElementById(BANNER_ID);
    if (el) return el;
    el = document.createElement("div");
    el.id = BANNER_ID;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.hidden = true;
    el.innerHTML =
      '<div class="pwa-status__row">' +
      '<span class="pwa-status__dot" aria-hidden="true"></span>' +
      '<span class="pwa-status__text"></span>' +
      '<button type="button" class="pwa-status__action" hidden>확인</button>' +
      '<button type="button" class="pwa-status__close" aria-label="닫기">×</button>' +
      "</div>";
    document.documentElement.appendChild(el);
    el.querySelector(".pwa-status__close").addEventListener("click", () => {
      el.hidden = true;
    });
    el.querySelector(".pwa-status__action").addEventListener("click", () => {
      el.hidden = true;
    });
    return el;
  }

  function showStatus(state, detail) {
    const el = ensureBanner();
    const text = el.querySelector(".pwa-status__text");
    const action = el.querySelector(".pwa-status__action");
    el.classList.remove("is-offline", "is-updating", "is-ready");
    action.hidden = true;

    if (state === "offline") {
      el.classList.add("is-offline");
      text.textContent =
        detail || "오프라인 모드 · 저장되지 않은 이미지는 대체 화면으로 표시됩니다.";
      el.hidden = false;
      return;
    }
    // Progress ONLY after customer approved update
    if (state === "updating") {
      if (!userApprovedUpdate) return;
      el.classList.add("is-updating");
      const pct =
        detail && detail.total
          ? ` ${Math.min(100, Math.round((detail.done / detail.total) * 100))}%`
          : "";
      text.textContent = `업데이트 적용 중${pct}`;
      el.hidden = false;
      return;
    }
    if (state === "ready" || state === "activated") {
      if (!userApprovedUpdate && state === "activated") return;
      el.classList.add("is-ready");
      text.textContent = detail || "준비 완료";
      el.hidden = false;
      clearTimeout(showStatus._t);
      showStatus._t = setTimeout(() => {
        if (!navigator.onLine) return;
        el.hidden = true;
      }, 3200);
    }
  }

  function closeDialog() {
    const el = document.getElementById(DIALOG_ID);
    if (el) el.hidden = true;
  }

  function showDialog({ eyebrow, title, body, notes, primaryLabel, secondaryLabel, onPrimary, onSecondary }) {
    ensureBannerStyles();
    let wrap = document.getElementById(DIALOG_ID);
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = DIALOG_ID;
      wrap.setAttribute("role", "dialog");
      wrap.setAttribute("aria-modal", "true");
      wrap.innerHTML =
        '<div class="pwa-dlg">' +
        '<p class="pwa-dlg__eyebrow"></p>' +
        '<h2 class="pwa-dlg__title"></h2>' +
        '<p class="pwa-dlg__body"></p>' +
        '<ul class="pwa-dlg__notes" hidden></ul>' +
        '<div class="pwa-dlg__actions">' +
        '<button type="button" class="pwa-dlg__secondary"></button>' +
        '<button type="button" class="pwa-dlg__primary is-primary"></button>' +
        "</div></div>";
      document.documentElement.appendChild(wrap);
      if (!document.getElementById("pwaDlgNotesStyle")) {
        const st = document.createElement("style");
        st.id = "pwaDlgNotesStyle";
        st.textContent =
          ".pwa-dlg__notes{margin:12px 0 0;padding:0 0 0 18px;color:rgba(246,243,238,.72);font-size:12px;line-height:1.55}" +
          ".pwa-dlg__notes li{margin:0 0 4px}";
        document.head.appendChild(st);
      }
    }
    wrap.querySelector(".pwa-dlg__eyebrow").textContent = eyebrow || "본 헤리티지 앱";
    wrap.querySelector(".pwa-dlg__title").textContent = title || "";
    wrap.querySelector(".pwa-dlg__body").textContent = body || "";
    const notesEl = wrap.querySelector(".pwa-dlg__notes");
    if (notesEl) {
      notesEl.replaceChildren();
      if (Array.isArray(notes) && notes.length) {
        notes.forEach((line) => {
          const li = document.createElement("li");
          li.textContent = line;
          notesEl.append(li);
        });
        notesEl.hidden = false;
      } else {
        notesEl.hidden = true;
      }
    }
    const secondary = wrap.querySelector(".pwa-dlg__secondary");
    const primary = wrap.querySelector(".pwa-dlg__primary");
    secondary.textContent = secondaryLabel || "닫기";
    primary.textContent = primaryLabel || "확인";
    secondary.onclick = () => {
      closeDialog();
      if (typeof onSecondary === "function") onSecondary();
    };
    primary.onclick = () => {
      // Update flow keeps the dialog as a progress panel — don't dismiss first.
      const keepOpen = typeof onPrimary === "function" && primaryLabel === "업데이트";
      if (!keepOpen) closeDialog();
      if (typeof onPrimary === "function") onPrimary();
    };
    wrap.hidden = false;
  }

  function setUpdateProgress(pct, label) {
    const wrap = document.getElementById(DIALOG_ID) || ensureProgressDialog();
    wrap.hidden = false;
    const dlg = wrap.querySelector(".pwa-dlg");
    dlg.classList.add("is-progress");
    wrap.querySelector(".pwa-dlg__eyebrow").textContent = `UPDATE ${APP_VERSION}`;
    wrap.querySelector(".pwa-dlg__title").textContent = "업데이트 적용 중";
    wrap.querySelector(".pwa-dlg__body").textContent =
      label || "최신 화면을 내려받는 중입니다. 잠시만 기다려 주세요.";
    let bar = dlg.querySelector(".pwa-progress");
    let pctEl = dlg.querySelector(".pwa-progress__pct");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "pwa-progress";
      bar.innerHTML = "<i></i>";
      pctEl = document.createElement("p");
      pctEl.className = "pwa-progress__pct";
      dlg.append(bar, pctEl);
    }
    const n = Math.max(0, Math.min(100, Math.round(pct)));
    bar.querySelector("i").style.width = `${n}%`;
    pctEl.textContent = `${n}%`;
  }

  function ensureProgressDialog() {
    showDialog({
      eyebrow: `UPDATE ${APP_VERSION}`,
      title: "업데이트 적용 중",
      body: "최신 화면을 내려받는 중입니다.",
      primaryLabel: "확인",
      secondaryLabel: "닫기",
    });
    return document.getElementById(DIALOG_ID);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function applyUpdate() {
    userApprovedUpdate = true;
    updateOffered = true;
    updateProgressLock = true;
    const chip = document.getElementById("pwaUpdateChip");
    if (chip) chip.hidden = true;

    // Keep modal open as progress UI (do not flash-dismiss).
    setUpdateProgress(4, "캐시를 정리하는 중…");
    showStatus("updating", { done: 0, total: 100 });

    const finish = async () => {
      const started = Date.now();
      const MIN_MS = 3200;
      let pct = 4;

      const tick = setInterval(() => {
        // Ease toward ~88% while work runs; finish jumps to 100.
        if (pct < 88) {
          pct += pct < 40 ? 7 : pct < 70 ? 4 : 2;
          setUpdateProgress(pct, pct < 45 ? "캐시를 정리하는 중…" : "새 버전을 적용하는 중…");
          showStatus("updating", { done: pct, total: 100 });
        }
      }, 280);

      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (_) {}

      const target = pendingRemoteBuild || APP_BUILD;
      localStorage.setItem(ACTIVATED_KEY, target);
      localStorage.setItem(BUILD_KEY, target);
      localStorage.removeItem(UPDATE_SNOOZE_KEY);
      localStorage.removeItem(PROMPTED_BUILD_KEY);
      promptedBuild = "";
      updateOffered = false;

      try {
        const worker = pendingWorker;
        if (worker) {
          worker.postMessage({ type: "SKIP_WAITING" });
        } else {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      } catch (_) {}

      const remain = Math.max(0, MIN_MS - (Date.now() - started));
      await sleep(remain);
      clearInterval(tick);

      setUpdateProgress(100, "업데이트 완료 · 앱을 다시 불러옵니다");
      showStatus("ready", "업데이트 완료 · 앱을 다시 불러옵니다");
      await sleep(900);

      updateProgressLock = false;
      if (!refreshing) {
        refreshing = true;
        location.reload();
      }
    };
    finish();
  }

  function buildRank(build) {
    const text = String(build || "");
    const m = text.match(/gbcal(\d+)/i);
    if (m) return Number(m[1]) || 0;
    return 0;
  }

  function promptUpdateAvailable(extraNotes, force = false) {
    const targetBuild = String(pendingRemoteBuild || APP_BUILD);
    try {
      if (!promptedBuild) promptedBuild = localStorage.getItem(PROMPTED_BUILD_KEY) || "";
    } catch (_) {}

    if (document.getElementById(DIALOG_ID)) return;

    // Same build already announced — never stack duplicate dialogs.
    if (promptedBuild === targetBuild) {
      try {
        if (localStorage.getItem(UPDATE_SNOOZE_KEY)) showUpdateChip();
      } catch (_) {}
      return;
    }

    if (updateOffered) return;

    if (force) {
      try {
        localStorage.removeItem(UPDATE_SNOOZE_KEY);
      } catch (_) {}
    } else {
      const snooze = Number(localStorage.getItem(UPDATE_SNOOZE_KEY) || 0);
      if (snooze && Date.now() - snooze < 1000 * 60 * 60 * 24) { showUpdateChip(); return; }
    }

    updateOffered = true;
    promptedBuild = targetBuild;
    try {
      localStorage.setItem(PROMPTED_BUILD_KEY, targetBuild);
    } catch (_) {}

    const notes = Array.isArray(extraNotes) && extraNotes.length ? extraNotes : remoteNotes || RELEASE_NOTES;
    const customerNotes = (notes || [])
      .map((n) => String(n || "").trim())
      .filter((n) => n && !/커서|모바일앱과 동일|동일 방식|debug|내부|개발자|관리자|어드민|admin|전체관리|글쓰기|삭제|Contabo|Git|배포|최종검수|shipping|portfolio|공지·|바로 저장|바로 올라|운영|API|서버/i.test(n));

    showDialog({
      eyebrow: `UPDATE ${APP_VERSION}`,
      title: "새 버전이 있습니다",
      body: "디자인·기능 업데이트입니다. 「업데이트」를 눌러야 최신 화면이 적용됩니다.",
      notes: customerNotes.length ? customerNotes : ["버그 수정 및 안정성 개선"],
      secondaryLabel: "나중에",
      primaryLabel: "업데이트",
      onPrimary: applyUpdate,
      onSecondary: () => {
        localStorage.setItem(UPDATE_SNOOZE_KEY, String(Date.now()));
        showUpdateChip();
      },
    });
  }

  function showUpdateChip() {
    ensureBannerStyles();
    let chip = document.getElementById("pwaUpdateChip");
    if (!chip) {
      chip = document.createElement("button");
      chip.id = "pwaUpdateChip";
      chip.type = "button";
      chip.textContent = "업데이트 있음";
      chip.style.cssText =
        "position:fixed;right:14px;bottom:calc(72px + env(safe-area-inset-bottom,0px));z-index:100001;" +
        "border:0;border-radius:999px;padding:12px 16px;font-size:13px;font-weight:800;" +
        "background:linear-gradient(145deg,#f0d09a,#e8b86d);color:#161513;" +
        "box-shadow:0 10px 28px rgba(0,0,0,.35);cursor:pointer;" +
        "font-family:Pretendard,SUIT,sans-serif;";
      chip.addEventListener("click", () => {
        updateOffered = false;
        promptedBuild = "";
        try {
          localStorage.removeItem(PROMPTED_BUILD_KEY);
          localStorage.removeItem(UPDATE_SNOOZE_KEY);
        } catch (_) {}
        promptUpdateAvailable(RELEASE_NOTES, true);
      });
      document.documentElement.appendChild(chip);
    }
    chip.hidden = false;
  }

  function noteBuildActivated() {
    const activated = localStorage.getItem(ACTIVATED_KEY) || localStorage.getItem(BUILD_KEY) || "";
    if (activated === APP_BUILD) {
      if (userApprovedUpdate) {
        showStatus("ready", "업데이트 완료 · 최신 버전입니다");
        const chip = document.getElementById("pwaUpdateChip");
        if (chip) chip.hidden = true;
      }
      return;
    }
    if (!activated) {
      localStorage.setItem(ACTIVATED_KEY, APP_BUILD);
      localStorage.setItem(BUILD_KEY, APP_BUILD);
      return;
    }
    // Customer prompts only when app-build.json is newer (checkRemoteBuild).

  }

  function needsUpdatePrompt() {
    // Customer update UI is driven only by app-build.json (checkRemoteBuild).
    return false;
  }

  async function checkRemoteBuild() {
    try {
      const url = new URL("./app-build.json", location.href);
      url.searchParams.set("t", String(Date.now()));
      url.searchParams.set("b", APP_BUILD);
      const res = await fetch(url.href, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.notes) && data.notes.length) remoteNotes = data.notes;
      const remoteBuild = String(data.build || "");
      if (!remoteBuild) return;
      pendingRemoteBuild = remoteBuild;

      if (buildRank(remoteBuild) <= buildRank(APP_BUILD)) {
        localStorage.setItem(ACTIVATED_KEY, APP_BUILD);
        localStorage.setItem(BUILD_KEY, APP_BUILD);
        try {
          localStorage.removeItem(PROMPTED_BUILD_KEY);
        } catch (_) {}
        promptedBuild = "";
        updateOffered = false;
        const chip = document.getElementById("pwaUpdateChip");
        if (chip) chip.hidden = true;
        return;
      }

      // Only prompt when remote build is newer than the running script.
      promptUpdateAvailable(remoteNotes || RELEASE_NOTES, false);
    } catch (_) {}
  }

  function syncOnlineState() {
    if (!navigator.onLine) showStatus("offline");
    else {
      const el = document.getElementById(BANNER_ID);
      if (el && el.classList.contains("is-offline")) el.hidden = true;
    }
  }

  window.addEventListener("online", syncOnlineState);
  window.addEventListener("offline", () => showStatus("offline"));

  if (!("serviceWorker" in navigator)) {
    syncOnlineState();
    checkRemoteBuild();
    return;
  }

  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type !== "PWA_STATUS") return;
    if (data.state === "updating" || data.state === "ready" || data.state === "activated") {
      if (!userApprovedUpdate) return;
      showStatus(data.state, data);
    }
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!userApprovedUpdate) return;
    if (refreshing) return;
    // Wait for progress UI minimum time — applyUpdate will reload.
    if (updateProgressLock) return;
    refreshing = true;
    location.reload();
  });

  const register = () => {
    if (window.__HX_PWA_REINSTALL_REQUIRED) return;
    const swUrl = new URL(`sw.js?v=${APP_BUILD}`, location.href).href;

    navigator.serviceWorker
      .register(swUrl, { scope: "./", updateViaCache: "none" })
      .then(async (reg) => {
        const offerUpdate = (worker) => {
          if (!worker) return;
          if (!navigator.serviceWorker.controller) {
            localStorage.setItem(ACTIVATED_KEY, APP_BUILD);
            localStorage.setItem(BUILD_KEY, APP_BUILD);
            return;
          }
          pendingWorker = worker;
          promptUpdateAvailable(RELEASE_NOTES, true);
        };

        const trackWorker = (worker) => {
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              offerUpdate(worker);
            }
          });
        };

        if (reg.waiting) offerUpdate(reg.waiting);

        reg.addEventListener("updatefound", () => {
          trackWorker(reg.installing);
        });

        try {
          await reg.update();
        } catch (_) {}

        await navigator.serviceWorker.ready;

        if (needsUpdatePrompt()) {
          promptUpdateAvailable(RELEASE_NOTES, true);
        } else {
          noteBuildActivated();
        }

        await checkRemoteBuild();
        // SW waiting worker
        if (reg.waiting && navigator.serviceWorker.controller) {
          pendingWorker = reg.waiting;
          promptUpdateAvailable(RELEASE_NOTES, true);
        }
        // One delayed CDN catch-up only (no multi-minute spam).
        setTimeout(() => {
          checkRemoteBuild();
          reg.update().catch(() => {});
        }, 8000);
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) checkRemoteBuild();
        });
      })
      .catch(() => {
        checkRemoteBuild();
      });
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);

  syncOnlineState();
})();
