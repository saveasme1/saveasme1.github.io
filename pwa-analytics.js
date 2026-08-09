(() => {
  "use strict";

  const API = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(
    /\/$/,
    ""
  );
  const CLIENT_KEY = "hx.pwa.clientId";
  const BEACON_PREFIX = "hx.pwa.beacon.";

  function clientId() {
    try {
      let id = localStorage.getItem(CLIENT_KEY);
      if (!id) {
        id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `hx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        localStorage.setItem(CLIENT_KEY, id);
      }
      return id;
    } catch (_) {
      return `hx-${Date.now()}`;
    }
  }

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

  function currentBuild() {
    const meta = document.querySelector('meta[name="guide-build"]');
    return (meta && meta.content) || window.__HX_APP_BUILD || "";
  }

  function alreadySent(type, path) {
    try {
      const day = new Date().toISOString().slice(0, 10);
      if (type === "pwa_install") {
        return localStorage.getItem(`${BEACON_PREFIX}install.${currentBuild()}`) === "1";
      }
      if (type === "pwa_session") {
        return sessionStorage.getItem(`${BEACON_PREFIX}session.${day}`) === "1";
      }
      if (type === "page_view") {
        return sessionStorage.getItem(`${BEACON_PREFIX}view.${day}.${path}`) === "1";
      }
    } catch (_) {}
    return false;
  }

  function markSent(type, path) {
    try {
      const day = new Date().toISOString().slice(0, 10);
      if (type === "pwa_install") {
        localStorage.setItem(`${BEACON_PREFIX}install.${currentBuild()}`, "1");
        return;
      }
      if (type === "pwa_session") {
        sessionStorage.setItem(`${BEACON_PREFIX}session.${day}`, "1");
        return;
      }
      if (type === "page_view") {
        sessionStorage.setItem(`${BEACON_PREFIX}view.${day}.${path}`, "1");
      }
    } catch (_) {}
  }

  async function beacon(type, extra = {}) {
    const normalized = String(type || "").trim();
    if (!["page_view", "pwa_session", "pwa_install"].includes(normalized)) return;
    const path =
      String(extra.path || location.pathname || "")
        .replace(/^\//, "")
        .split("?")[0] || "index";
    if (alreadySent(normalized, path)) return;

    try {
      const res = await fetch(`${API}/analytics/beacon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        keepalive: true,
        body: JSON.stringify({
          type: normalized,
          clientId: clientId(),
          path,
          build: String(extra.build || currentBuild() || ""),
          isPwa: extra.isPwa != null ? !!extra.isPwa : isPwaMode(),
          userAgent: navigator.userAgent || "",
        }),
      });
      if (res.ok) markSent(normalized, path);
    } catch (_) {}
  }

  function trackVisit() {
    if (isPwaMode()) beacon("pwa_session");
    else beacon("page_view");
  }

  window.HxPwaAnalytics = { beacon, clientId, isPwaMode, trackVisit };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", trackVisit);
  } else {
    trackVisit();
  }
})();
