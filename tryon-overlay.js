(() => {
  "use strict";

  const TRYON_ORIGIN = "https://saveasme1.github.io";
  const TRYON_PATH = "/heritage-tryon/studio.html";
  const TRYON_BUST = "20260724-tryon21";
  let overlay = null;
  let frame = null;
  let overlayOpen = false;
  let cameraOpen = false;
  let ignorePop = false;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "heritageTryOnOverlay";
    overlay.className = "heritage-tryon-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="heritage-tryon-sheet" role="dialog" aria-modal="true" aria-label="착용해보기">
        <iframe class="heritage-tryon-frame" title="착용해보기" allow="camera *; microphone *; fullscreen *; autoplay *" allowfullscreen></iframe>
      </div>`;
    document.body.append(overlay);
    frame = overlay.querySelector("iframe");
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeTryOn();
    });
    return overlay;
  }

  function openTryOn(payload = {}) {
    ensureOverlay();
    const params = new URLSearchParams();
    params.set("embed", "1");
    params.set("v", TRYON_BUST);
    if (payload.id) params.set("id", payload.id);
    if (payload.title) params.set("title", payload.title);
    if (payload.category) params.set("category", payload.category);
    const image = String(payload.image || payload.path || "").trim();
    if (image) {
      if (/^https?:\/\//i.test(image)) {
        try {
          const u = new URL(image);
          params.set("path", u.pathname.replace(/^\/+/, ""));
          params.set("image", image);
        } catch (_) {
          params.set("image", image);
        }
      } else {
        params.set("path", image.replace(/^\/+/, ""));
      }
    }
    frame.src = `${TRYON_ORIGIN}${TRYON_PATH}?${params.toString()}`;
    overlay.hidden = false;
    document.documentElement.classList.add("heritage-tryon-open");
    document.body.classList.add("heritage-tryon-open");
    if (!overlayOpen) {
      overlayOpen = true;
      history.pushState({ heritageTryOn: true }, "");
    }
  }

  function closeTryOnQuiet() {
    if (!overlay) return;
    overlay.hidden = true;
    if (frame) frame.src = "about:blank";
    document.documentElement.classList.remove("heritage-tryon-open");
    document.body.classList.remove("heritage-tryon-open");
    overlayOpen = false;
    cameraOpen = false;
  }

  function closeTryOn() {
    if (!overlayOpen) {
      closeTryOnQuiet();
      return;
    }
    closeTryOnQuiet();
    ignorePop = true;
    history.back();
  }

  function postToFrame(data) {
    try {
      frame?.contentWindow?.postMessage(data, "*");
    } catch (_) {}
  }

  window.addEventListener("popstate", () => {
    if (ignorePop) {
      ignorePop = false;
      return;
    }
    // Android/system back: close camera first, then overlay.
    if (cameraOpen) {
      cameraOpen = false;
      postToFrame({ type: "heritage-tryon-close-camera" });
      return;
    }
    if (overlayOpen) {
      closeTryOnQuiet();
    }
  });

  window.addEventListener("message", (event) => {
    const type = event?.data?.type;
    if (!type) return;
    if (type === "heritage-tryon-close") {
      closeTryOn();
      return;
    }
    if (type === "heritage-tryon-camera-open") {
      if (!cameraOpen) {
        cameraOpen = true;
        history.pushState({ heritageTryOnCamera: true }, "");
      }
      return;
    }
    if (type === "heritage-tryon-camera-close") {
      if (!cameraOpen) return;
      cameraOpen = false;
      ignorePop = true;
      history.back();
    }
  });

  window.openHeritageTryOn = openTryOn;
  window.closeHeritageTryOn = closeTryOn;
})();
