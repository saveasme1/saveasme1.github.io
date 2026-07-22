from pathlib import Path

js_path = Path("site-nav.js")
css_path = Path("site-nav.css")
js = js_path.read_text(encoding="utf-8").replace("\r\n", "\n")
css = css_path.read_text(encoding="utf-8").replace("\r\n", "\n")

# bump css version references in js ensureStylesheet
js = js.replace("site-nav.css?v=20260722-mp5", "site-nav.css?v=20260722-mp6")

# Add auth icons to ICONS object if missing
if "authRegister:" not in js:
    insert_at = js.find("mypage:")
    if insert_at < 0:
        raise SystemExit("mypage icon missing")
    # find end of mypage svg line
    end = js.find("`,", insert_at)
    end = js.find("\n", end)
    icons = (
        '\n    authRegister: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">'
        '<circle cx="9.2" cy="8.2" r="3.1" stroke="currentColor" stroke-width="1.6"/>'
        '<path d="M3.6 19c1.3-2.9 3.4-4.4 5.6-4.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
        '<path d="M16.2 8.2v6.2M13.1 11.3h6.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
        "</svg>`,"
        '\n    authLogin: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">'
        '<circle cx="12" cy="8.2" r="3.3" stroke="currentColor" stroke-width="1.6"/>'
        '<path d="M5.2 19.2c1.5-3.3 3.9-5 6.8-5s5.3 1.7 6.8 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
        "</svg>`,"
        '\n    authLogout: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">'
        '<path d="M10 4.5H7.5A2.5 2.5 0 0 0 5 7v10a2.5 2.5 0 0 0 2.5 2.5H10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
        '<path d="M13.5 12H20M17.2 8.8 20.4 12l-3.2 3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
        "</svg>`,"
    )
    js = js[:end] + icons + js[end:]

helper = '''
  function makeTopAuthButton(label, className, iconHtml, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML =
      `<span class="gb-top-auth-btn__icon" aria-hidden="true">${iconHtml}</span>` +
      `<span class="gb-top-auth-btn__label">${label}</span>`;
    button.addEventListener("click", onClick);
    return button;
  }

'''

if "makeTopAuthButton" not in js:
    js = js.replace("  function renderTopAuth() {", helper + "  function renderTopAuth() {")

old_render = '''  function renderTopAuth() {
    const host = document.querySelector(".gb-top-brand__auth");
    if (!host) return;
    host.replaceChildren();
    if (topAuthMember || document.body.dataset.authState === "in") {
      const logout = document.createElement("button");
      logout.type = "button";
      logout.className = "gb-top-auth-btn";
      logout.textContent = "로그아웃";
      logout.addEventListener("click", logoutFromTop);
      const mypage = document.createElement("button");
      mypage.type = "button";
      mypage.className = "gb-top-auth-btn is-accent";
      mypage.textContent = "마이페이지";
      mypage.addEventListener("click", openMyPage);
      host.append(logout, mypage);
      return;
    }
    const register = document.createElement("button");
    register.type = "button";
    register.className = "gb-top-auth-btn";
    register.textContent = "회원가입";
    register.addEventListener("click", () => openAuth("register"));
    const login = document.createElement("button");
    login.type = "button";
    login.className = "gb-top-auth-btn";
    login.textContent = "로그인";
    login.addEventListener("click", () => openAuth("login"));
    const mypage = document.createElement("button");
    mypage.type = "button";
    mypage.className = "gb-top-auth-btn is-accent";
    mypage.textContent = "마이페이지";
    mypage.addEventListener("click", openMyPage);
    host.append(register, login, mypage);
  }'''

new_render = '''  function renderTopAuth() {
    const host = document.querySelector(".gb-top-brand__auth");
    if (!host) return;
    host.replaceChildren();
    if (topAuthMember || document.body.dataset.authState === "in") {
      host.append(
        makeTopAuthButton("로그아웃", "gb-top-auth-btn", ICONS.authLogout, logoutFromTop),
        makeTopAuthButton("마이페이지", "gb-top-auth-btn is-accent", ICONS.mypage, openMyPage)
      );
      return;
    }
    host.append(
      makeTopAuthButton("회원가입", "gb-top-auth-btn", ICONS.authRegister, () => openAuth("register")),
      makeTopAuthButton("로그인", "gb-top-auth-btn", ICONS.authLogin, () => openAuth("login")),
      makeTopAuthButton("마이페이지", "gb-top-auth-btn is-accent", ICONS.mypage, openMyPage)
    );
  }'''

# Normalize whitespace for match - try flexible replace via markers
start = js.find("  function renderTopAuth() {")
# if helper was inserted, find the actual renderTopAuth after helper
start = js.find("  function renderTopAuth() {", js.find("makeTopAuthButton") if "makeTopAuthButton" in js else 0)
if start < 0:
    raise SystemExit("renderTopAuth missing")
# find matching closing brace at function level - naive: next "\n  function " after start+1
end = js.find("\n  function injectTopBrand()", start)
if end < 0:
    raise SystemExit("injectTopBrand missing after render")
js = js[:start] + new_render + "\n\n" + js[end+1:]  # keep "function inject..."

# CSS updates
css = css.replace("?v=20260722-mp5", "?v=20260722-mp6")  # no-op if not present

auth_css = '''
.gb-top-auth-btn__icon {
  display: none;
  width: 18px;
  height: 18px;
  flex: none;
}
.gb-top-auth-btn__icon svg {
  display: block;
  width: 100%;
  height: 100%;
}
.gb-top-auth-btn__label {
  display: inline;
}

@media (max-width: 1024px) {
  .gb-top-brand__auth {
    gap: 4px;
  }
  .gb-top-auth-btn {
    width: 34px;
    min-width: 34px;
    height: 34px;
    min-height: 34px;
    padding: 0;
    border-radius: 10px;
  }
  .gb-top-auth-btn__icon {
    display: block;
  }
  .gb-top-auth-btn__label {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .gb-top-brand__text {
    letter-spacing: .36em;
    text-indent: .36em;
    font-size: 13px;
  }
}

@media (max-width: 420px) {
  .gb-top-auth-btn {
    width: 32px;
    min-width: 32px;
    height: 32px;
    min-height: 32px;
    padding: 0;
    font-size: inherit;
  }
}
'''

# Remove old max-width 420 auth padding override that fights icon buttons - replace block
old_420 = '''@media (max-width: 420px) {
  .gb-top-auth-btn {
    min-height: 28px;
    padding: 0 8px;
    font-size: 11px;
  }
  .gb-top-brand__text {
    letter-spacing: .4em;
    text-indent: .4em;
    font-size: 13px;
  }
}'''
if old_420 in css:
    css = css.replace(old_420, "")

if ".gb-top-auth-btn__icon" not in css:
    # insert before body.has-gb-top-brand
    marker = "body.has-gb-top-brand {"
    if marker not in css:
        raise SystemExit("css marker missing")
    css = css.replace(marker, auth_css + "\n" + marker)

js_path.write_text(js.replace("\n", "\r\n"), encoding="utf-8")
css_path.write_text(css.replace("\n", "\r\n"), encoding="utf-8")

# bump refs in html files
for name in ("landing.html", "portfolio.html", "mypage.html"):
    path = Path(name)
    if not path.exists():
        continue
    html = path.read_text(encoding="utf-8")
    html2 = html.replace("site-nav.css?v=20260722-mp5", "site-nav.css?v=20260722-mp6")
    html2 = html2.replace("site-nav.js?v=20260722-mp5", "site-nav.js?v=20260722-mp6")
    if html2 != html:
        path.write_text(html2, encoding="utf-8")
        print("bumped", name)

print("ok", "makeTopAuthButton" in js, ".gb-top-auth-btn__icon" in css, "authRegister" in js)
