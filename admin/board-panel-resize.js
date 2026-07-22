(() => {
  "use strict";

  const STORAGE_KEY = `gongbang171.boardPanelHeight:${location.pathname}`;
  const MQ = "(max-width: 880px)";

  function initBoardPanelResize() {
    const panel = document.querySelector(".board-panel");
    if (!panel || panel.dataset.resizeReady === "1") return;
    panel.dataset.resizeReady = "1";

    const handle = document.createElement("div");
    handle.className = "board-panel-resize";
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "horizontal");
    handle.setAttribute("aria-label", "게시글 목록 높이 조절");
    handle.title = "위아래로 끌어 목록 높이 조절";
    handle.tabIndex = 0;
    panel.after(handle);

    const mq = window.matchMedia(MQ);

    function applyStored() {
      if (!mq.matches) {
        panel.style.removeProperty("height");
        return;
      }
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) panel.style.height = stored;
    }

    let startY = 0;
    let startH = 0;
    let dragging = false;

    function setHeight(next) {
      const value = `${Math.round(next)}px`;
      panel.style.height = value;
      sessionStorage.setItem(STORAGE_KEY, value);
      handle.setAttribute("aria-valuenow", String(Math.round(next)));
    }

    function onMove(event) {
      if (!dragging || event.pointerId !== dragging) return;
      event.preventDefault();
      const clientY = event.clientY;
      const next = Math.min(
        Math.max(startH + (clientY - startY), 160),
        Math.round(window.innerHeight * 0.88)
      );
      setHeight(next);
    }

    function onUp(event) {
      if (!dragging || event.pointerId !== dragging) return;
      if (handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
      dragging = 0;
      document.body.classList.remove("is-resizing-board");
    }

    function onDown(event) {
      if (!mq.matches) return;
      event.preventDefault();
      dragging = event.pointerId;
      startY = event.clientY;
      startH = panel.getBoundingClientRect().height;
      document.body.classList.add("is-resizing-board");
      handle.setPointerCapture(event.pointerId);
    }

    handle.addEventListener("pointerdown", onDown);
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
    handle.addEventListener("keydown", (event) => {
      if (!mq.matches) return;
      const step = event.shiftKey ? 40 : 16;
      const current = panel.getBoundingClientRect().height;
      let next = current;
      if (event.key === "ArrowUp") next = current - step;
      if (event.key === "ArrowDown") next = current + step;
      if (next === current) return;
      event.preventDefault();
      next = Math.min(Math.max(next, 160), Math.round(window.innerHeight * 0.88));
      setHeight(next);
    });

    applyStored();
    mq.addEventListener("change", applyStored);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBoardPanelResize);
  } else {
    initBoardPanelResize();
  }
})();
