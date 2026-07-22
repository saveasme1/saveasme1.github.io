/* cache: 20260720-call3 */
(function () {
  var granted = false;
  var stream = null;

  function stop() {
    if (!stream) return;
    stream.getTracks().forEach(function (t) {
      try { t.stop(); } catch (e) {}
    });
    stream = null;
  }

  function ask() {
    if (granted) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

    var opts = { audio: true, video: { facingMode: "user" } };
    navigator.mediaDevices.getUserMedia(opts).then(onOk).catch(function () {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(onOk).catch(function () {});
    });
  }

  function onOk(s) {
    granted = true;
    stream = s;
    var gate = document.getElementById("call-perm-gate");
    if (gate) gate.remove();
    setTimeout(stop, 600);
  }

  function ensureGate() {
    if (document.getElementById("call-perm-gate")) return;
    var gate = document.createElement("button");
    gate.id = "call-perm-gate";
    gate.type = "button";
    gate.setAttribute("aria-label", "continue");
    gate.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "margin:0",
      "padding:0",
      "border:0",
      "background:transparent",
      "cursor:pointer",
      "touch-action:manipulation",
      "-webkit-tap-highlight-color:transparent"
    ].join(";");
    gate.addEventListener("click", function (e) {
      e.preventDefault();
      ask();
    }, { passive: false });
    document.body.appendChild(gate);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      ensureGate();
      ask();
    });
  } else {
    ensureGate();
    ask();
  }

  ["pointerdown", "touchstart", "click"].forEach(function (ev) {
    document.addEventListener(ev, ask, true);
  });
})();
