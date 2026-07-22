(() => {
  "use strict";

  const API = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  const TOKEN_KEY = "gongbang171.adminToken";
  const $ = (id) => document.getElementById(id);
  const els = {
    loginShell: $("loginShell"),
    loginForm: $("loginForm"),
    usernameInput: $("usernameInput"),
    passwordInput: $("passwordInput"),
    loginStatus: $("loginStatus"),
    adminHub: $("adminHub"),
    adminIdentity: $("adminIdentity"),
    logoutButton: $("logoutButton"),
    refreshMembersButton: $("refreshMembersButton"),
    memberStatus: $("memberStatus"),
    approvalList: $("approvalList"),
  };

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(sessionStorage.getItem(TOKEN_KEY)
          ? { Authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY)}` }
          : {}),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `요청 실패 (${response.status})`);
    return payload;
  }

  function message(element, text, type = "") {
    element.textContent = text;
    element.className = `form-status${type ? ` ${type}` : ""}`;
  }

  async function loadMembers() {
    message(els.memberStatus, "승인 대기 목록을 불러오는 중…");
    els.refreshMembersButton.disabled = true;
    try {
      const payload = await request("/admin/members?status=pending");
      const members = payload.members || [];
      els.approvalList.replaceChildren();
      message(
        els.memberStatus,
        members.length ? `${members.length}명이 가입 승인을 기다리고 있습니다.` : "승인 대기 회원이 없습니다.",
        members.length ? "" : "success"
      );
      members.forEach((member) => {
        const row = document.createElement("div");
        row.className = "approval-member";
        const info = document.createElement("span");
        info.className = "approval-member-info";
        const name = document.createElement("strong");
        name.textContent = member.username;
        const date = document.createElement("small");
        const createdAt = member.createdAt || member.created_at;
        date.textContent = createdAt
          ? `신청 ${window.GongbangTime ? window.GongbangTime.formatDateTime(createdAt) : createdAt}`
          : "가입 승인 대기";
        info.append(name, date);

        const approve = document.createElement("button");
        approve.type = "button";
        approve.className = "button compact primary";
        approve.textContent = "승인";
        const reject = document.createElement("button");
        reject.type = "button";
        reject.className = "button compact danger";
        reject.textContent = "거절";

        const act = async (action) => {
          if (action === "reject" && !confirm(`${member.username} 회원의 가입을 거절할까요?`)) return;
          approve.disabled = true;
          reject.disabled = true;
          try {
            await request(`/admin/members/${member.id}/${action}`, { method: "POST", body: "{}" });
            await loadMembers();
          } catch (error) {
            message(els.memberStatus, error.message, "error");
            approve.disabled = false;
            reject.disabled = false;
          }
        };
        approve.addEventListener("click", () => act("approve"));
        reject.addEventListener("click", () => act("reject"));
        row.append(info, approve, reject);
        els.approvalList.append(row);
      });
    } catch (error) {
      message(els.memberStatus, error.message, "error");
    } finally {
      els.refreshMembersButton.disabled = false;
    }
  }

  async function enterAdmin() {
    const payload = await request("/auth/me");
    if (!payload.member || payload.member.role !== "admin") {
      throw new Error("관리자 로그인이 필요합니다.");
    }
    els.adminIdentity.textContent = `${payload.member.username} · 관리자`;
    els.loginShell.hidden = true;
    els.adminHub.hidden = false;
    await loadMembers();
  }

  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    message(els.loginStatus, "로그인 중…");
    try {
      const payload = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: els.usernameInput.value.trim(),
          password: els.passwordInput.value,
        }),
      });
      if (payload.accessToken) sessionStorage.setItem(TOKEN_KEY, payload.accessToken);
      els.loginForm.reset();
      await enterAdmin();
    } catch (error) {
      message(els.loginStatus, error.message, "error");
    }
  });

  els.logoutButton.addEventListener("click", async () => {
    await request("/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
    sessionStorage.removeItem(TOKEN_KEY);
    location.reload();
  });
  els.refreshMembersButton.addEventListener("click", loadMembers);

  enterAdmin().catch(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    els.loginShell.hidden = false;
    els.adminHub.hidden = true;
  });
})();
