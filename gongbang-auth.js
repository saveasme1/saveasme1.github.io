(() => {
  "use strict";

  if (window.__gongbangAuthReady) return;
  window.__gongbangAuthReady = true;

  const API_BASE = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  const TOKEN_KEY = "gongbang171.adminToken";
  const $ = (id) => document.getElementById(id);

  let member = null;
  let authRedirect = "";
  let bootDone = false;

  function notify(next) {
    member = next || null;
    window.dispatchEvent(new CustomEvent("gongbang:auth-changed", { detail: { member } }));
  }

  async function fetchAuthMe() {
    const once = async (withToken) => {
      const headers = {};
      if (withToken) {
        const token = sessionStorage.getItem(TOKEN_KEY);
        if (token) headers.Authorization = `Bearer ${token}`;
      }
      const response = await fetch(`${API_BASE}/auth/me`, {
        credentials: "include",
        headers,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.message || `요청 실패 (${response.status})`);
        error.status = response.status;
        throw error;
      }
      return payload;
    };
    try {
      return await once(true);
    } catch (error) {
      if (error.status === 401 && sessionStorage.getItem(TOKEN_KEY)) {
        try {
          sessionStorage.removeItem(TOKEN_KEY);
        } catch (_) {}
        return await once(false);
      }
      throw error;
    }
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(sessionStorage.getItem(TOKEN_KEY)
          ? { Authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY)}` }
          : {}),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || `요청 실패 (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function ensureDialog() {
    if ($("reviewAuthDialog")) return;
    document.body.insertAdjacentHTML(
      "beforeend",
      `<dialog class="review-dialog auth-dialog" id="reviewAuthDialog">
        <form id="reviewAuthForm" data-mode="login">
          <div class="auth-tabs" role="tablist">
            <button type="button" class="auth-tab is-active" data-auth-tab="login" role="tab">로그인</button>
            <button type="button" class="auth-tab" data-auth-tab="register" role="tab">회원가입</button>
          </div>
          <div class="auth-panel" data-auth-panel="login">
            <h2>로그인</h2>
            <p class="auth-desc">가입하신 아이디로 로그인하세요.</p>
          </div>
          <div class="auth-panel" data-auth-panel="register" hidden>
            <h2>회원가입</h2>
            <p class="auth-desc">새 계정을 만들고 관리자 승인을 기다려 주세요.</p>
            <p class="auth-notice">가입 신청 후 관리자 승인이 완료되어야 이용할 수 있습니다. 승인이 늦으면 카카오톡 add68로 문의해 주세요.</p>
          </div>
          <label class="auth-field">아이디
            <input id="reviewUsername" autocomplete="username" minlength="4" maxlength="30" required placeholder="아이디 입력">
          </label>
          <label class="auth-field">비밀번호
            <input id="reviewPassword" type="password" autocomplete="current-password" minlength="12" maxlength="128" required placeholder="비밀번호 입력">
          </label>
          <p class="review-dialog-status" id="reviewAuthStatus" aria-live="polite"></p>
          <div class="review-dialog-actions auth-actions">
            <button type="button" data-close>취소</button>
            <button class="primary" type="submit" id="reviewAuthSubmit">로그인</button>
          </div>
        </form>
      </dialog>`
    );
    $("reviewAuthDialog")
      .querySelectorAll("[data-close]")
      .forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
    $("reviewAuthDialog")
      .querySelectorAll("[data-auth-tab]")
      .forEach((button) => button.addEventListener("click", () => openAuth(button.dataset.authTab)));
    $("reviewAuthForm").addEventListener("submit", submitAuth);
  }

  function openAuth(mode = "login", options = {}) {
    const next = mode === "register" ? "register" : "login";
    authRedirect = typeof options.redirect === "string" ? options.redirect : "";
    ensureDialog();
    const form = $("reviewAuthForm");
    const dialog = $("reviewAuthDialog");
    if (!form || !dialog) return;
    form.dataset.mode = next;
    dialog.dataset.mode = next;
    dialog.querySelectorAll("[data-auth-tab]").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.authTab === next);
    });
    dialog.querySelectorAll("[data-auth-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.authPanel !== next;
    });
    const password = $("reviewPassword");
    const submit = $("reviewAuthSubmit");
    const status = $("reviewAuthStatus");
    if (password) {
      password.autocomplete = next === "login" ? "current-password" : "new-password";
      password.placeholder = next === "login" ? "비밀번호 입력" : "12자 이상 비밀번호";
    }
    if (submit) submit.textContent = next === "login" ? "로그인" : "가입 신청하기";
    if (status) {
      status.textContent = "";
      status.className = "review-dialog-status";
    }
    try {
      if (!dialog.open) dialog.showModal();
    } catch (_) {
      dialog.setAttribute("open", "");
    }
  }

  async function submitAuth(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = $("reviewAuthStatus");
    const mode = form.dataset.mode === "register" ? "register" : "login";
    if (status) {
      status.className = "review-dialog-status";
      status.textContent = mode === "login" ? "로그인 중…" : "가입 신청 중…";
    }
    try {
      const payload = await api(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({
          username: $("reviewUsername").value,
          password: $("reviewPassword").value,
        }),
      });
      if (mode === "register") {
        $("reviewAuthDialog")?.close();
        form.reset();
        form.dataset.mode = "login";
        authRedirect = "";
        if (typeof window.showGongbangToast === "function") {
          window.showGongbangToast("가입신청이 완료되었습니다. 관리자 승인을 기다려주세요.");
        }
        return;
      }
      if (payload.accessToken) {
        try {
          sessionStorage.setItem(TOKEN_KEY, payload.accessToken);
        } catch (_) {}
      }
      notify(payload.member || null);
      document.body.dataset.authState = payload.member ? "in" : "out";
      $("reviewAuthDialog")?.close();
      const nextUrl = authRedirect;
      authRedirect = "";
      if (nextUrl) {
        location.href = nextUrl;
        return;
      }
      if (typeof window.showGongbangToast === "function") {
        window.showGongbangToast("로그인되었습니다.");
      }
    } catch (error) {
      if (status) {
        status.className = "review-dialog-status error";
        status.textContent = error.message || "로그인에 실패했습니다.";
      }
    }
  }

  async function boot() {
    try {
      const payload = await fetchAuthMe();
      if (payload.accessToken) {
        try {
          sessionStorage.setItem(TOKEN_KEY, payload.accessToken);
        } catch (_) {}
      }
      member = payload.member || null;
      document.body.dataset.authState = member ? "in" : "out";
      bootDone = true;
      notify(member);
    } catch (_) {
      bootDone = true;
      // Do not broadcast logout on boot failure — cookie may still be valid later
    }
  }

  window.GongbangAuth = {
    fetchMe: fetchAuthMe,
    getMember: () => member,
    open: openAuth,
    boot,
  };
  window.openGongbangAuth = (mode, options = {}) => openAuth(mode || "login", options);
  window.getGongbangMember = () => member;

  window.addEventListener("gongbang:auth-changed", (event) => {
    if (!event.detail || !Object.prototype.hasOwnProperty.call(event.detail, "member")) return;
    member = event.detail.member || null;
  });

  const start = () => {
    const params = new URLSearchParams(location.search);
    const wantMyPage = params.get("open") === "mypage";
    boot().then(() => {
      if (!wantMyPage) return;
      const mode = params.get("auth") === "register" ? "register" : "login";
      const redirect = params.get("redirect") || "/mypage.html";
      if (!member) openAuth(mode, { redirect });
      else if (redirect) location.href = redirect;
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
