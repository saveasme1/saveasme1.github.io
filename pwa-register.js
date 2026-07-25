(() => {
  "use strict";

  const BANNER_ID = "pwaStatusBanner";

  function ensureBanner() {
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
      '<button type="button" class="pwa-status__action" hidden>새로고침</button>' +
      '<button type="button" class="pwa-status__close" aria-label="닫기">×</button>' +
      "</div>";
    document.documentElement.appendChild(el);

    if (!document.getElementById("pwaStatusStyle")) {
      const style = document.createElement("style");
      style.id = "pwaStatusStyle";
      style.textContent = `
        #${BANNER_ID}{
          position:fixed; left:50%; transform:translateX(-50%);
          top:max(10px, env(safe-area-inset-top));
          z-index:99999; width:min(520px, calc(100vw - 20px));
          background:rgba(22,21,19,.94); color:#f4f2ee;
          border:1px solid rgba(255,130,54,.35); border-radius:14px;
          box-shadow:0 12px 32px rgba(0,0,0,.35); backdrop-filter:blur(10px);
          font-family:Pretendard,SUIT,"Noto Sans KR",sans-serif;
        }
        #${BANNER_ID}[hidden]{ display:none !important; }
        #${BANNER_ID}.is-offline{ border-color:rgba(148,163,184,.45); }
        #${BANNER_ID}.is-updating{ border-color:rgba(255,130,54,.55); }
        #${BANNER_ID}.is-ready{ border-color:rgba(52,211,153,.45); }
        .pwa-status__row{ display:flex; align-items:center; gap:10px; padding:11px 12px; }
        .pwa-status__dot{ width:8px; height:8px; border-radius:50%; background:#ff8236; flex:0 0 auto; }
        .is-offline .pwa-status__dot{ background:#94a3b8; }
        .is-ready .pwa-status__dot{ background:#34d399; }
        .is-updating .pwa-status__dot{ animation:pwaPulse 1s ease-in-out infinite; }
        @keyframes pwaPulse{ 0%,100%{ opacity:1 } 50%{ opacity:.35 } }
        .pwa-status__text{ flex:1; font-size:13px; line-height:1.4; font-weight:650; }
        .pwa-status__action{
          border:0; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:800;
          background:#ff8236; color:#161513; cursor:pointer;
        }
        .pwa-status__close{
          border:0; background:transparent; color:#c4bdb4; font-size:18px; line-height:1;
          cursor:pointer; padding:0 2px;
        }
      `;
      document.head.appendChild(style);
    }

    el.querySelector(".pwa-status__close").addEventListener("click", () => {
      el.hidden = true;
    });
    el.querySelector(".pwa-status__action").addEventListener("click", () => {
      location.reload();
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
        detail || "오프라인 모드 · 이전에 열어본 이미지만 보입니다. 나머지는 와이파이에서 준비됩니다.";
      el.hidden = false;
      return;
    }
    if (state === "updating") {
      el.classList.add("is-updating");
      const pct =
        detail && detail.total
          ? ` ${Math.min(100, Math.round((detail.done / detail.total) * 100))}%`
          : "";
      text.textContent = `앱 데이터 준비 중${pct} · 잠시만 기다려 주세요`;
      el.hidden = false;
      return;
    }
    if (state === "ready" || state === "activated") {
      el.classList.add("is-ready");
      text.textContent = "앱 데이터 준비 완료 · 이제 오프라인에서도 기본 화면을 볼 수 있습니다";
      el.hidden = false;
      clearTimeout(showStatus._t);
      showStatus._t = setTimeout(() => {
        if (!navigator.onLine) return;
        el.hidden = true;
      }, 4200);
      return;
    }
    if (state === "update-available") {
      el.classList.add("is-updating");
      text.textContent = "새 버전이 준비되었습니다";
      action.hidden = false;
      action.textContent = "새로고침";
      el.hidden = false;
    }
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

  // Replace broken images (액박) with an inline offline placeholder
  const IMG_FALLBACK =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">' +
        '<rect width="640" height="640" fill="#2a2724"/>' +
        '<text x="320" y="300" text-anchor="middle" fill="#c4bdb4" font-family="sans-serif" font-size="28">오프라인</text>' +
        '<text x="320" y="348" text-anchor="middle" fill="#8a837b" font-family="sans-serif" font-size="20">아직 저장되지 않은 이미지</text>' +
        "</svg>"
    );

  document.addEventListener(
    "error",
    (event) => {
      const img = event.target;
      if (!img || img.tagName !== "IMG") return;
      if (img.dataset.pwaFallback === "1") return;
      img.dataset.pwaFallback = "1";
      img.alt = img.alt || "오프라인 · 미저장 이미지";
      img.src = IMG_FALLBACK;
    },
    true
  );

  if (!("serviceWorker" in navigator)) {
    syncOnlineState();
    return;
  }

  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type !== "PWA_STATUS") return;
    if (data.state === "updating") showStatus("updating", data);
    else if (data.state === "ready" || data.state === "activated") showStatus(data.state);
  });

  const register = () => {
    const swUrl = new URL("sw.js", location.href).href;
    navigator.serviceWorker
      .register(swUrl, { scope: "./", updateViaCache: "none" })
      .then((reg) => {
        const askSkip = (worker) => {
          if (worker) worker.postMessage({ type: "SKIP_WAITING" });
        };
        if (reg.waiting) {
          showStatus("update-available");
          askSkip(reg.waiting);
        }
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          showStatus("updating", { done: 0, total: 1 });
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed") {
              if (navigator.serviceWorker.controller) {
                showStatus("update-available");
                askSkip(worker);
              } else {
                showStatus("ready");
              }
            }
          });
        });
        return navigator.serviceWorker.ready;
      })
      .catch(() => {});

    // Do NOT auto-reload (confusing). Customer taps 새로고침 when ready.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!navigator.onLine) return;
      showStatus("update-available");
    });
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);

  syncOnlineState();
})();
