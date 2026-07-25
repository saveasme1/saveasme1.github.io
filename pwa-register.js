(() => {
  "use strict";

  const APP_BUILD = "20260725-pwa15";
  const APP_VERSION = "v1.6.1";
  const RELEASE_NOTES = [
    "사진으로 찾기를 금시세 바로 위로 이동",
    "AI 섹션 중복 카테고리 칩 제거",
    "금시세 API 교체(기존 403) · LIVE 시세 복구",
  ];
  const BUILD_KEY = "hx.pwa.build";
  const ACTIVATED_KEY = "hx.pwa.activatedBuild";
  const FRESH_KEY = "hx.pwa.freshToastAt";
  const BANNER_ID = "pwaStatusBanner";
  const DIALOG_ID = "pwaUpdateDialog";
  const RECOVER_KEY = "hx.pwa.mojibakeRecover";
  const UPDATE_SNOOZE_KEY = "hx.pwa.updateSnooze";

  /** Only true after customer taps 「업데이트」 */
  let userApprovedUpdate = false;
  let pendingWorker = null;
  let refreshing = false;
  let updateOffered = false;
  let remoteNotes = null;

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
      closeDialog();
      if (typeof onPrimary === "function") onPrimary();
    };
    wrap.hidden = false;
  }

  function applyUpdate() {
    userApprovedUpdate = true;
    showStatus("updating", { done: 0, total: 1 });
    const finish = async () => {
      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (_) {}
      localStorage.setItem(ACTIVATED_KEY, APP_BUILD);
      localStorage.setItem(BUILD_KEY, APP_BUILD);
      localStorage.removeItem(UPDATE_SNOOZE_KEY);
      const worker = pendingWorker;
      if (worker) {
        worker.postMessage({ type: "SKIP_WAITING" });
      } else {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
          else location.reload();
        } catch (_) {
          location.reload();
        }
      }
      // If controllerchange doesn't fire quickly, still reload
      setTimeout(() => {
        if (!refreshing) location.reload();
      }, 1200);
    };
    finish();
  }

  function promptUpdateAvailable(extraNotes) {
    if (updateOffered) return;
    const snooze = Number(localStorage.getItem(UPDATE_SNOOZE_KEY) || 0);
    // Snooze only 30 min — UI updates must still surface soon
    if (Date.now() - snooze < 1000 * 60 * 30) return;
    updateOffered = true;
    const notes = Array.isArray(extraNotes) && extraNotes.length ? extraNotes : remoteNotes || RELEASE_NOTES;
    showDialog({
      eyebrow: `UPDATE ${APP_VERSION}`,
      title: "새 버전이 있습니다",
      body: "디자인·기능 업데이트입니다. 새 콘텐츠가 없어도 적용하면 화면이 달라집니다.",
      notes,
      secondaryLabel: "나중에",
      primaryLabel: "업데이트",
      onPrimary: applyUpdate,
      onSecondary: () => {
        localStorage.setItem(UPDATE_SNOOZE_KEY, String(Date.now()));
      },
    });
  }

  function noteBuildActivated() {
    // First install only — never mark a new build as done before user taps 업데이트
    const activated = localStorage.getItem(ACTIVATED_KEY);
    if (!activated) {
      const legacy = localStorage.getItem(BUILD_KEY) || "";
      if (legacy && legacy !== APP_BUILD) {
        // Returning user from older builds — keep legacy as "accepted" so remote check prompts
        localStorage.setItem(ACTIVATED_KEY, legacy);
        promptUpdateAvailable(RELEASE_NOTES);
        return;
      }
      localStorage.setItem(ACTIVATED_KEY, APP_BUILD);
      localStorage.setItem(BUILD_KEY, APP_BUILD);
      return;
    }
    if (userApprovedUpdate && activated !== APP_BUILD) {
      localStorage.setItem(ACTIVATED_KEY, APP_BUILD);
      localStorage.setItem(BUILD_KEY, APP_BUILD);
      showStatus("ready", "업데이트 완료 · 최신 버전입니다");
    } else if (activated !== APP_BUILD) {
      promptUpdateAvailable(RELEASE_NOTES);
    }
  }

  async function checkRemoteBuild() {
    try {
      const res = await fetch(`./app-build.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.notes) && data.notes.length) remoteNotes = data.notes;
      const remoteBuild = String(data.build || "");
      if (!remoteBuild) return;
      const activated = localStorage.getItem(ACTIVATED_KEY) || "";
      // Network says newer (or different) than what user last accepted
      if (activated && activated !== remoteBuild) {
        promptUpdateAvailable(data.notes);
      }
      // Script already newer than last activated (HTML/JS query bumped)
      if (activated && activated !== APP_BUILD) {
        promptUpdateAvailable(RELEASE_NOTES);
      }
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
    refreshing = true;
    location.reload();
  });

  const register = () => {
    const swUrl = new URL(`sw.js?v=${APP_BUILD}`, location.href).href;

    navigator.serviceWorker
      .register(swUrl, { scope: "./", updateViaCache: "none" })
      .then(async (reg) => {
        const offerUpdate = (worker) => {
          if (!worker) return;
          if (!navigator.serviceWorker.controller) {
            // First SW install — mark activated, no dialog
            localStorage.setItem(ACTIVATED_KEY, APP_BUILD);
            localStorage.setItem(BUILD_KEY, APP_BUILD);
            return;
          }
          pendingWorker = worker;
          promptUpdateAvailable();
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
        noteBuildActivated();
        await checkRemoteBuild();
      })
      .catch(() => {
        checkRemoteBuild();
      });
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);

  syncOnlineState();
})();
