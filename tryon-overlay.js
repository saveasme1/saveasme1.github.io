(() => {
  "use strict";

  const TRYON_ORIGIN = "https://saveasme1.github.io";
  const TRYON_PATH = "/heritage-tryon/studio.html";
  const TRYON_BUST = "20260724-tryon12";
  let overlay = null;
  let frame = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "heritageTryOnOverlay";
    overlay.className = "heritage-tryon-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="heritage-tryon-sheet" role="dialog" aria-modal="true" aria-label="착용해보기">
        <iframe class="heritage-tryon-frame" title="착용해보기" allow="camera *; microphone *; fullscreen *" allowfullscreen></iframe>
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
  }

  function closeTryOn() {
    if (!overlay) return;
    overlay.hidden = true;
    if (frame) frame.src = "about:blank";
    document.documentElement.classList.remove("heritage-tryon-open");
    document.body.classList.remove("heritage-tryon-open");
  }

  window.addEventListener("message", (event) => {
    if (!event?.data || event.data.type !== "heritage-tryon-close") return;
    closeTryOn();
  });

  window.openHeritageTryOn = openTryOn;
  window.closeHeritageTryOn = closeTryOn;
})();
