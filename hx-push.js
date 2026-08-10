(() => {
  "use strict";

  const API = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  const TOKEN_KEY = "gongbang171.adminToken";
  let readyPromise = null;

  function isStandalonePwa() {
    try {
      if (window.matchMedia("(display-mode: standalone)").matches) return true;
      if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
      if (window.matchMedia("(display-mode: minimal-ui)").matches) return true;
    } catch (_) {}
    if (window.navigator.standalone === true) return true;
    if (/[?&]app=1(?:&|$)/.test(location.search)) return true;
    return false;
  }

  function adminHeaders() {
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    try {
      const token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || "";
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch (_) {}
    return headers;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function fetchPublicKey() {
    const res = await fetch(`${API}/push/vapid-public-key`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.publicKey) throw new Error(data.message || "VAPID 키를 가져오지 못했습니다.");
    return data.publicKey;
  }

  async function postSubscription(subscription) {
    const res = await fetch(`${API}/push/subscribe`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        subscription,
        label: isStandalonePwa() ? "pwa" : "web",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "푸시 구독 저장 실패");
    return data;
  }

  async function ensurePermission() {
    if (!("Notification" in window)) throw new Error("이 브라우저는 알림을 지원하지 않습니다.");
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") throw new Error("알림 권한이 거부되어 있습니다.");
    const result = await Notification.requestPermission();
    if (result !== "granted") throw new Error("알림 권한이 필요합니다.");
    return result;
  }

  async function ensurePushSubscription() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("푸시 구독을 지원하지 않는 환경입니다.");
    }
    await ensurePermission();
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const publicKey = await fetchPublicKey();
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    await postSubscription(sub.toJSON());
    try {
      localStorage.setItem("hx.push.subscribed", "1");
    } catch (_) {}
    return sub;
  }

  async function enable() {
    if (!readyPromise) {
      readyPromise = ensurePushSubscription().catch((error) => {
        readyPromise = null;
        throw error;
      });
    }
    return readyPromise;
  }

  async function showLocal(title, body, options = {}) {
    const textTitle = String(title || "작업 완료");
    const textBody = String(body || "작업이 완료되었습니다.");
    try {
      if (Notification.permission === "granted" && "serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(textTitle, {
          body: textBody,
          icon: options.icon || "/icons/icon-192.png",
          badge: options.badge || "/icons/icon-192.png",
          tag: options.tag || `hx-local-${Date.now()}`,
          data: { url: options.url || location.href },
          renotify: true,
        });
        return;
      }
    } catch (_) {}
    if (Notification.permission === "granted") {
      // eslint-disable-next-line no-new
      new Notification(textTitle, { body: textBody });
    }
  }

  async function workDone(detail = {}) {
    const title = String(detail.title || "작업 완료").slice(0, 80);
    const body = String(detail.body || "작업이 완료되었습니다.").slice(0, 180);
    const url = String(detail.url || location.pathname || "/").slice(0, 400);
    const tag = String(detail.tag || `hx-work-${Date.now()}`).slice(0, 80);

    // Prefer server fan-out so the phone gets it even when PC finished the work.
    try {
      const res = await fetch(`${API}/push/notify`, {
        method: "POST",
        credentials: "include",
        headers: adminHeaders(),
        body: JSON.stringify({ title, body, url, tag }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (!data.sent) await showLocal(title, body, { url, tag });
        return data;
      }
    } catch (_) {}

    await showLocal(title, body, { url, tag });
    return { ok: false, sent: 0 };
  }

  function boot() {
    // User said all permissions are allowed — request as soon as SW is ready.
    const start = () => {
      enable().catch(() => {});
    };
    if (!("serviceWorker" in navigator)) return;
    if (document.readyState === "complete") {
      navigator.serviceWorker.ready.then(start).catch(() => {});
    } else {
      window.addEventListener("load", () => {
        navigator.serviceWorker.ready.then(start).catch(() => {});
      });
    }
  }

  window.HxNotify = {
    enable,
    workDone,
    showLocal,
    isStandalonePwa,
  };

  boot();
})();
