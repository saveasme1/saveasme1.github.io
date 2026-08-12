(() => {
  "use strict";

  const ROBOTS =
    "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate, max-image-preview:none, max-snippet:0, max-video-preview:0";

  function ensureMeta(name, content) {
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", name);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  function stripImgAlts(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("img").forEach((img) => {
      if (img.getAttribute("alt") !== "") img.setAttribute("alt", "");
      img.removeAttribute("title");
      img.removeAttribute("aria-label");
    });
  }

  function enforce() {
    ensureMeta("robots", ROBOTS);
    ensureMeta("googlebot", ROBOTS);
    ensureMeta("googlebot-image", "noindex, noimageindex");
    ensureMeta("bingbot", ROBOTS);
    ensureMeta("yeti", ROBOTS);
    ensureMeta("NaverBot", ROBOTS);
    stripImgAlts(document);
    // #region agent log
    fetch("http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "eef336",
      },
      body: JSON.stringify({
        sessionId: "eef336",
        runId: "post-fix",
        hypothesisId: "SEO1",
        location: "seo-guard.js:enforce",
        message: "seo noindex + empty alts enforced",
        data: {
          path: location.pathname,
          robots: document.querySelector('meta[name="robots"]')?.content || "",
          imgCount: document.images.length,
          nonemptyAlt: [...document.images].filter((i) => (i.getAttribute("alt") || "").trim()).length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }

  enforce();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enforce, { once: true });
  }
  window.addEventListener("load", enforce, { once: true });

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.tagName === "IMG") {
          node.setAttribute("alt", "");
          node.removeAttribute("title");
        } else {
          stripImgAlts(node);
        }
      });
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  window.GongbangSeoGuard = { enforce, stripImgAlts };
})();
