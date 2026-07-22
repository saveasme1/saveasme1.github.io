(() => {
  "use strict";
  if (!("serviceWorker" in navigator)) return;

  const register = () => {
    const swUrl = new URL("sw.js", document.baseURI || location.href).pathname;
    navigator.serviceWorker
      .register(swUrl, { scope: "./", updateViaCache: "none" })
      .catch(() => {});
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);
})();
