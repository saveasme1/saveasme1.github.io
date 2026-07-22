from pathlib import Path
import re

p = Path("site-nav.js")
t = p.read_text(encoding="utf-8").replace("\r\n", "\n")

# Logged-out: only 회원가입 + 로그인 (no 마이페이지)
old = '''    host.append(
      makeTopAuthButton("회원가입", "gb-top-auth-btn", ICONS.authRegister, () => openAuth("register")),
      makeTopAuthButton("로그인", "gb-top-auth-btn", ICONS.authLogin, () => openAuth("login")),
      makeTopAuthButton("마이페이지", "gb-top-auth-btn is-accent", ICONS.mypage, openMyPage)
    );'''

new = '''    host.append(
      makeTopAuthButton("회원가입", "gb-top-auth-btn", ICONS.authRegister, () => openAuth("register")),
      makeTopAuthButton("로그인", "gb-top-auth-btn", ICONS.authLogin, () => openAuth("login"))
    );'''

if old not in t:
    # try finding by ascii-safe markers
    a = t.find('makeTopAuthButton("회원가입"')
    b = t.find("host.append(", a - 80)
    c = t.find(");", a)
    # find end of host.append block
    c = t.find("\n  }", a)
    print("FAIL old block")
    print(repr(t[b:b+500]))
    raise SystemExit(1)

t = t.replace(old, new, 1)

# Hide bottom-nav mypage when logged out; show when logged in
# Add syncBottomMyPage and call from renderTopAuth / auth-changed

if "syncBottomMyPage" not in t:
    helper = '''
  function syncBottomMyPage() {
    const item = document.querySelector('.gb-bottom-nav [data-nav="mypage"]');
    if (!item) return;
    const li = item.closest("li") || item;
    const loggedIn = Boolean(topAuthMember || document.body.dataset.authState === "in");
    li.hidden = !loggedIn;
    item.hidden = !loggedIn;
  }

'''
    t = t.replace("  function renderTopAuth() {", helper + "  function renderTopAuth() {")
    # call at end of renderTopAuth
    t = t.replace(
        '''    host.append(
      makeTopAuthButton("회원가입", "gb-top-auth-btn", ICONS.authRegister, () => openAuth("register")),
      makeTopAuthButton("로그인", "gb-top-auth-btn", ICONS.authLogin, () => openAuth("login"))
    );
  }''',
        '''    host.append(
      makeTopAuthButton("회원가입", "gb-top-auth-btn", ICONS.authRegister, () => openAuth("register")),
      makeTopAuthButton("로그인", "gb-top-auth-btn", ICONS.authLogin, () => openAuth("login"))
    );
    syncBottomMyPage();
  }'''
    )
    # also after logged-in append
    t = t.replace(
        '''      host.append(
        makeTopAuthButton("로그아웃", "gb-top-auth-btn", ICONS.authLogout, logoutFromTop),
        makeTopAuthButton("마이페이지", "gb-top-auth-btn is-accent", ICONS.mypage, openMyPage)
      );
      return;
    }''',
        '''      host.append(
        makeTopAuthButton("로그아웃", "gb-top-auth-btn", ICONS.authLogout, logoutFromTop),
        makeTopAuthButton("마이페이지", "gb-top-auth-btn is-accent", ICONS.mypage, openMyPage)
      );
      syncBottomMyPage();
      return;
    }'''
    )
    # after bottom nav inject
    t = t.replace(
        "setActiveNav(detectActivePanel());\n\n    nav.querySelectorAll",
        "setActiveNav(detectActivePanel());\n    syncBottomMyPage();\n\n    nav.querySelectorAll",
    )

# bump cache
t = t.replace("site-nav.css?v=20260722-mp6", "site-nav.css?v=20260722-mp7")
p.write_text(t.replace("\n", "\r\n"), encoding="utf-8")

for name in ("landing.html", "portfolio.html", "mypage.html"):
    path = Path(name)
    if not path.exists():
        continue
    h = path.read_text(encoding="utf-8")
    h2 = h.replace("site-nav.js?v=20260722-mp6", "site-nav.js?v=20260722-mp7").replace(
        "site-nav.css?v=20260722-mp6", "site-nav.css?v=20260722-mp7"
    )
    if h2 != h:
        path.write_text(h2, encoding="utf-8")
        print("bumped", name)

print("ok", "syncBottomMyPage" in t, t.count('makeTopAuthButton("마이페이지"'))
