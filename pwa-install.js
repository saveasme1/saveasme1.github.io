(() => {
  "use strict";

  const APP_PATH = "landing.html";
  const origin = location.origin.replace(/\/$/, "");
  const appUrl = `${origin}/${APP_PATH}`;
  const installUrl = `${origin}/install.html`;

  const iosPanel = document.getElementById("iosPanel");
  const androidPanel = document.getElementById("androidPanel");
  const toast = document.getElementById("toast");
  const androidPromptBtn = document.getElementById("androidPrompt");

  let deferredPrompt = null;
  let toastTimer = 0;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-on");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-on"), 2200);
  }

  function isIOS() {
    const ua = navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent || "");
  }

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function openPanel(which) {
    iosPanel?.classList.toggle("is-open", which === "ios");
    androidPanel?.classList.toggle("is-open", which === "android");
  }

  function openInSafari() {
    const target = installUrl;
    // iOS Safari handoff scheme (best-effort; not guaranteed from every in-app browser)
    const safariScheme = `x-safari-${target}`;
    try {
      location.href = safariScheme;
    } catch (_) {}
    window.setTimeout(() => {
      // Fallback: stay on HTTPS page with instructions visible
      if (!/Safari/i.test(navigator.userAgent) || /CriOS|FxiOS|EdgiOS|NAVER/i.test(navigator.userAgent)) {
        showToast("Safari에서 직접 열어 주세요");
      }
    }, 700);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("링크를 복사했습니다");
    } catch (_) {
      showToast(text);
    }
  }

  document.getElementById("iosInstall")?.addEventListener("click", () => {
    openPanel("ios");
    if (isIOS()) openInSafari();
  });

  document.getElementById("openSafari")?.addEventListener("click", () => {
    openInSafari();
    copy(installUrl);
  });

  document.getElementById("androidInstall")?.addEventListener("click", async () => {
    openPanel("android");
    if (deferredPrompt && androidPromptBtn) {
      androidPromptBtn.hidden = false;
    }
  });

  document.getElementById("androidPrompt")?.addEventListener("click", async () => {
    if (!deferredPrompt) {
      showToast("브라우저 메뉴에서 홈 화면에 추가를 눌러 주세요");
      return;
    }
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice.catch(() => null);
    deferredPrompt = null;
    androidPromptBtn.hidden = true;
    if (result?.outcome === "accepted") showToast("설치를 시작했습니다");
  });

  document.getElementById("openApp")?.addEventListener("click", () => {
    location.href = appUrl;
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (androidPromptBtn) androidPromptBtn.hidden = false;
  });

  if (isStandalone()) {
    location.replace(appUrl);
    return;
  }

  // Auto-open matching panel
  if (isIOS()) openPanel("ios");
  else if (isAndroid()) openPanel("android");
})();
