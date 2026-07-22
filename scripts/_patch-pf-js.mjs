import fs from "fs";

let src = fs.readFileSync("portfolio-board.js", "utf8").replace(/\r\n/g, "\n");

if (src.includes("function openWriter")) {
  console.log("already patched");
  process.exit(0);
}

const authHelpers = `
  let authPopup = null;

  function showToast(message, options = {}) {
    let toast = document.querySelector(".pf-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "pf-toast";
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.classList.toggle("is-error", Boolean(options.tone === "error"));
    toast.classList.add("is-on");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove("is-on"), options.duration || 2600);
  }

  function focusAuthPopup() {
    if (authPopup && !authPopup.closed) {
      try { authPopup.focus(); } catch (_) {}
      return true;
    }
    return false;
  }

  function openAuth(mode = "login") {
    if (focusAuthPopup()) return;
    const next = mode === "register" ? "register" : "login";
    const width = Math.min(440, Math.max(320, window.screen.availWidth - 40));
    const height = Math.min(640, Math.max(520, window.screen.availHeight - 60));
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    authPopup = window.open(
      "/auth.html?mode=" + encodeURIComponent(next),
      "gongbangAuth",
      "popup=yes,width=" + width + ",height=" + height + ",left=" + left + ",top=" + top + ",scrollbars=yes,resizable=yes"
    );
    if (!authPopup) {
      location.href = "/auth.html?mode=" + encodeURIComponent(next) + "&return=" + encodeURIComponent(location.pathname);
    }
  }

  function applyAuthMember(member, accessToken) {
    if (accessToken) {
      try { sessionStorage.setItem(TOKEN_KEY, accessToken); } catch (_) {}
    }
    state.member = member || null;
    renderSession();
    if (state.current) renderActions();
  }

  function isAdmin() {
    return Boolean(state.member && state.member.role === "admin");
  }

  function openWriter() {
    if (!state.member) {
      showToast("관리자 로그인 후 작성할 수 있습니다.", { tone: "error" });
      openAuth("login");
      return;
    }
    if (!isAdmin()) {
      showToast("관리자만 글을 작성할 수 있습니다.", { tone: "error" });
      return;
    }
    location.href = "/admin/portfolio/";
  }

`;

const apiAnchor = "  async function api(path, options = {}) {";
if (!src.includes(apiAnchor)) throw new Error("api anchor missing");
src = src.replace(apiAnchor, authHelpers + apiAnchor);

const sessionRe = /  function renderSession\(\) \{[\s\S]*?\n  \}\n/;
if (!sessionRe.test(src)) throw new Error("renderSession missing");
src = src.replace(sessionRe, `  function renderSession() {
    if (!els.session) return;
    els.session.replaceChildren();
    if (els.write) {
      els.write.hidden = false;
      els.write.textContent = "글 작성하기";
    }
    if (!state.member) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "로그인";
      button.addEventListener("click", () => openAuth("login"));
      els.session.append(button);
      return;
    }
    const logout = document.createElement("button");
    logout.type = "button";
    logout.textContent = "로그아웃";
    logout.addEventListener("click", async () => {
      await api("/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
      sessionStorage.removeItem(TOKEN_KEY);
      state.member = null;
      renderSession();
      if (state.current) renderActions();
      window.dispatchEvent(new CustomEvent("gongbang:auth-changed", { detail: { member: null } }));
    });
    els.session.append(logout);
  }

`);

const writeRe = /els\.write\?\.addEventListener\("click", \(\) => \{\n\s*location\.href = "\/admin\/portfolio\/";\n\s*\}\);/;
if (!writeRe.test(src)) {
  console.log("write snippet", JSON.stringify(src.slice(src.indexOf("els.write"), src.indexOf("els.write") + 180)));
  throw new Error("write listener missing");
}
src = src.replace(writeRe, `els.write?.addEventListener("click", openWriter);
  window.addEventListener("gongbang:auth-changed", (event) => {
    state.member = event.detail?.member || null;
    renderSession();
    if (state.current) renderActions();
  });
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin) return;
    const data = event.data || {};
    if (data.type === "gongbang:auth-success") {
      applyAuthMember(data.member, data.accessToken);
      authPopup = null;
      return;
    }
    if (data.type === "gongbang:auth-cancel") {
      authPopup = null;
    }
  });`);

fs.writeFileSync("portfolio-board.js", src.replace(/\n/g, "\r\n"));
console.log("js patched ok");