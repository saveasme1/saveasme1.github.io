(() => {
  "use strict";

  const APP_BUILD = "20260810-gbcal41";
  const APP_VERSION = "v1.12.35";
  const RELEASE_NOTES = [
    "?îÎ©¥ ?âÏÉÅÍ≥?Î≤ÑÌäº?????†Î™Ö?òÍ≤å ÎßûÏ∑Ñ?µÎãà??,
    "Í≥µÎèôÍµ¨Îß§ ?ºÏ†ï ?âÏÉÅ??Î∂Ä?úÎü¨???§ÏúºÎ°?Ï°∞Ï†ï?àÏäµ?àÎã§",
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

  /** Only true after customer taps ?åÏóÖ?∞Ïù¥?∏„Ä?*/
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
      (sample.length > 8 && !/[Í∞Ä-??/.test(sample) && /[√É√Ç√Ø√¨√´]/.test(sample));
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

  // Run ASAP ??corrupted cache must not linger on web or PWA
  emergencyFixMojibake();

  const IMG_FALLBACK =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">' +
        '<rect width="640" height="640" fill="#2a2724"/>' +
        '<text x="320" y="292" text-anchor="middle" fill="#c4bdb4" font-family="sans-serif" font-size="26">?¥Î?ÏßÄ Ï§ÄÎπ?Ï§?/text>' +
        '<text x="320" y="340" text-anchor="middle" fill="#8a837b" font-family="sans-serif" font-size="18">?Ä?¥Ìåå?¥Ïóê???¥Î©¥ ?Ä?•Îê©?àÎã§</text>' +
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
      "<h2>???¨ÏÑ§ÏπòÍ? ?ÑÏöî?©Îãà??/h2>" +
      "<p>?∏Î°ú Í≥†Ï†ï¬∑ÏµúÏã† Í∏∞Îä• ?ÅÏö©???ÑÌï¥ ?àÌôîÎ©??ÑÏù¥ÏΩòÏùÑ ??†ú?????§Ïãú ?§Ïπò??Ï£ºÏÑ∏??</p>" +
      "<ol>" +
      "<li>?àÌôîÎ©?<strong>Î≥??§Î¶¨?∞Ï?</strong> ?ÑÏù¥ÏΩ?Í∏∏Í≤å ?åÎü¨ <strong>??†ú</strong></li>" +
      "<li>?ÑÎûò Î≤ÑÌäº?ºÎ°ú ?§Ïπò ?òÏù¥ÏßÄ ?¥Í∏∞</li>" +
      "<li>?§Ïãú <strong>???îÎ©¥??Ï∂îÍ?</strong></li>" +
      "</ol>" +
      `<a href="${installUrl}">?¨ÏÑ§Ïπ??àÎÇ¥ ¬∑ ?§Ïπò ?òÏù¥ÏßÄ ?¥Í∏∞</a>` +
      "</div>";
    (document.body || document.documentElement).appendChild(gate);
    return true;
  }

  if (showReinstallGate()) {
    window.__HX_PWA_REINSTALL_REQUIRED = true;
  }

  /**
   * Same as cursorphone-relay rd38 ??OS portrait lock via Screen Orientation API.
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
      img.alt = img.alt || "?¥Î?ÏßÄ Ï§ÄÎπ?Ï§?;
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
      img.alt = img.alt || "?¥Î?ÏßÄ Ï§ÄÎπ?Ï§?;
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
      '<button type="button" class="pwa-status__action" hidden>?ïÏù∏</button>' +
      '<button type="button" class="pwa-status__close" aria-label="?´Í∏∞">√ó</button>' +
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
        detail || "?§ÌîÑ?ºÏù∏ Î™®Îìú ¬∑ ?Ä?•ÎêòÏßÄ ?äÏ? ?¥Î?ÏßÄ???ÄÏ≤??îÎ©¥?ºÎ°ú ?úÏãú?©Îãà??";
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
      text.textContent = `?ÖÎç∞?¥Ìä∏ ?ÅÏö© Ï§?{pct}`;
      el.hidden = false;
      return;
    }
    if (state === "ready" || state === "activated") {
      if (!userApprovedUpdate && state === "activated") return;
      el.classList.add("is-ready");
      text.textContent = detail || "Ï§ÄÎπ??ÑÎ£å";
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
    wrap.querySelector(".pwa-dlg__eyebrow").textContent = eyebrow || "Î≥??§Î¶¨?∞Ï? ??;
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
    secondary.textContent = secondaryLabel || "?´Í∏∞";
    primary.textContent = primaryLabel || "?ïÏù∏";
    secondary.onclick = () => {
      closeDialog();
      if (typeof onSecondary === "function") onSecondary();
    };
    primary.onclick = () => {
      // Update flow keeps the dialog as a progress panel ??don't dismiss first.
      const keepOpen = typeof onPrimary === "function" && primaryLabel === "?ÖÎç∞?¥Ìä∏";
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
    wrap.querySelector(".pwa-dlg__title").textContent = "?ÖÎç∞?¥Ìä∏ ?ÅÏö© Ï§?;
    wrap.querySelector(".pwa-dlg__body").textContent =
      label || "ÏµúÏã† ?îÎ©¥???¥Î†§Î∞õÎäî Ï§ëÏûÖ?àÎã§. ?†ÏãúÎß?Í∏∞Îã§??Ï£ºÏÑ∏??";
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
      title: "?ÖÎç∞?¥Ìä∏ ?ÅÏö© Ï§?,
      body: "ÏµúÏã† ?îÎ©¥???¥Î†§Î∞õÎäî Ï§ëÏûÖ?àÎã§.",
      primaryLabel: "?ïÏù∏",
      secondaryLabel: "?´Í∏∞",
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
    setUpdateProgress(4, "Ï∫êÏãúÎ•??ïÎ¶¨?òÎäî Ï§ë‚Ä?);
    showStatus("updating", { done: 0, total: 100 });

    const finish = async () => {
      const started = Date.now();
      const MIN_MS = 3200;
      let pct = 4;

      const tick = setInterval(() => {
        // Ease toward ~88% while work runs; finish jumps to 100.
        if (pct < 88) {
          pct += pct < 40 ? 7 : pct < 70 ? 4 : 2;
          setUpdateProgress(pct, pct < 45 ? "Ï∫êÏãúÎ•??ïÎ¶¨?òÎäî Ï§ë‚Ä? : "??Î≤ÑÏ†Ñ???ÅÏö©?òÎäî Ï§ë‚Ä?);
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

      setUpdateProgress(100, "?ÖÎç∞?¥Ìä∏ ?ÑÎ£å ¬∑ ?±ÏùÑ ?§Ïãú Î∂àÎü¨?µÎãà??);
      showStatus("ready", "?ÖÎç∞?¥Ìä∏ ?ÑÎ£å ¬∑ ?±ÏùÑ ?§Ïãú Î∂àÎü¨?µÎãà??);
      await sleep(900);

      updateProgressLock = false;
      if (!refreshing) {
        refreshing = true;
        location.reload();
      }
    };
    finish();
  }

  function promptUpdateAvailable(extraNotes, force) {
    force = true; // always force apply for this release
    const targetBuild = String(pendingRemoteBuild || APP_BUILD);
    try {
      if (!promptedBuild) promptedBuild = localStorage.getItem(PROMPTED_BUILD_KEY) || "";
    } catch (_) {}

    if (document.getElementById(DIALOG_ID)) return;

    // Same build already announced ??never stack duplicate dialogs.
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
      if (Date.now() - snooze < 1000 * 60 * 5) return;
    }

    updateOffered = true;
    promptedBuild = targetBuild;
    try {
      localStorage.setItem(PROMPTED_BUILD_KEY, targetBuild);
    } catch (_) {}

    const notes = Array.isArray(extraNotes) && extraNotes.length ? extraNotes : remoteNotes || RELEASE_NOTES;
    const customerNotes = (notes || [])
      .map((n) => String(n || "").trim())
      .filter((n) => n && !/Ïª§ÏÑú|Î™®Î∞î?ºÏï±Í≥??ôÏùº|?ôÏùº Î∞©Ïãù|debug|?¥Î?|Í∞úÎ∞ú??Í¥ÄÎ¶¨Ïûê|?¥ÎìúÎØ?admin|?ÑÏ≤¥Í¥ÄÎ¶?Í∏Ä?∞Í∏∞|??†ú Î≤ÑÌäº/i.test(n));

    showDialog({
      eyebrow: `UPDATE ${APP_VERSION}`,
      title: "??Î≤ÑÏ†Ñ???àÏäµ?àÎã§",
      body: "?îÏûê?∏¬∑Í∏∞???ÖÎç∞?¥Ìä∏?ÖÎãà?? ?åÏóÖ?∞Ïù¥?∏„ÄçÎ? ?åÎü¨??ÏµúÏã† ?îÎ©¥???ÅÏö©?©Îãà??",
      notes: customerNotes.length ? customerNotes : RELEASE_NOTES,
      secondaryLabel: "?òÏ§ë??,
      primaryLabel: "?ÖÎç∞?¥Ìä∏",
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
      chip.textContent = "?ÖÎç∞?¥Ìä∏ ?àÏùå";
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
        showStatus("ready", "?ÖÎç∞?¥Ìä∏ ?ÑÎ£å ¬∑ ÏµúÏã† Î≤ÑÏ†Ñ?ÖÎãà??);
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
    // Running script is newer than stored build ??require user update (no silent stamp).
    promptUpdateAvailable(RELEASE_NOTES, true);
  }

  function needsUpdatePrompt() {
    const activated = localStorage.getItem(ACTIVATED_KEY) || localStorage.getItem(BUILD_KEY) || "";
    return activated && activated !== APP_BUILD;
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

      if (remoteBuild === APP_BUILD) {
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

      // Newer build on server ??show update dialog (no silent reload / no reinstall).
      promptUpdateAvailable(remoteNotes || RELEASE_NOTES, true);
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
    // Wait for progress UI minimum time ??applyUpdate will reload.
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
        // Periodic re-check (CDN lag)
        [2500, 8000, 20000].forEach((ms) => {
          setTimeout(() => {
            checkRemoteBuild();
            reg.update().catch(() => {});
            if (reg.waiting && navigator.serviceWorker.controller) {
              pendingWorker = reg.waiting;
              promptUpdateAvailable(RELEASE_NOTES, true);
            }
          }, ms);
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
