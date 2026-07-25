(() => {
  "use strict";
  if (!("serviceWorker" in navigator)) return;

  const register = () => {
    const swUrl = new URL("sw.js", location.href).href;
    navigator.serviceWorker
      .register(swUrl, { scope: "./", updateViaCache: "none" })
      .then((reg) => {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              worker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
        return navigator.serviceWorker.ready;
      })
      .catch(() => {});

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      // Don't force reload in airplane mode loops — only when an update took control online.
      if (navigator.onLine) location.reload();
    });
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);
})();
