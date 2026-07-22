function openAuthPopup(mode) {
    const next = mode === "register" ? "register" : "login";
    if (focusAuthPopup()) return true;
    const width = Math.min(440, Math.max(320, window.screen.availWidth - 40));
    const height = Math.min(640, Math.max(520, window.screen.availHeight - 60));
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    authPopup = window.open(
      `/auth.html?mode=${encodeURIComponent(next)}`,
      "gongbangAuth",
      `popup=yes,width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
    return Boolean(authPopup);
  }

  function applyAuthMember(member, accessToken) {
    if (accessToken) {
      try { sessionStorage.setItem(TOKEN_KEY, accessToken); } catch (_) {}
    }
    state.member = member || null;
    renderSession();
    notifyAuthChanged();
    if (state.opened) loadReviews(true);
  }

  function canWrite() {
    return state.member && (state.member.role === "admin" || state.member.status === "approved");
  }

  function showMemberGate() {
    els.grid.replaceChildren();
    els.pager.replaceChildren();
    const gate = document.createElement("div");
    gate.className = "review-gate";
    gate.innerHTML = `
      <strong>인증된 회원만 볼 수 있습니다</strong>
      <p>실시간 리얼후기는 회원가입 후 로그인하신 회원만 확인할 수 있습니다.</p>
      <div class="review-gate-actions">
        <button type="button" class="primary" data-gate="register">회원가입</button>
        <button type="button" data-gate="login">로그인</button>
      </div>`;
    gate.querySelector('[data-gate="register"]').addEventListener("click", () => openAuth("register"));
    gate.querySelector('[data