from pathlib import Path

VER = "20260722-mp10"
files = ["landing.html", "portfolio.html", "mypage.html", "site-nav.js"]

# normalize query versions for site-nav and common assets that matter for this fix
repls = [
    ("20260722-mp9", VER),
    ("20260722-mp8", VER),
    ("20260722-mp7", VER),
    ("20260722-mp6", VER),
    ("20260722-mp5", VER),
    ("20260722-mp4", VER),
    ("20260722-portfolio9", VER),
    ("20260722-portfolio8", VER),
    ("20260722-portfolio7", VER),
]

for name in files:
    path = Path(name)
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    orig = text
    for a, b in repls:
        text = text.replace(a, b)
    if name.endswith(".html") and f'content="{VER}"' not in text and "guide-build" in text:
        import re
        text = re.sub(r'content="20260722-[^"]+"', f'content="{VER}"', text, count=1)
        text = re.sub(r'cache-bust: 20260722-[^\s-]+', f'cache-bust: {VER}', text, count=1)
    if text != orig:
        path.write_text(text, encoding="utf-8")
        print("updated", name)
    else:
        print("noop", name)

# ensure syncBottomMyPage is called after bottom nav inject
nav = Path("site-nav.js").read_text(encoding="utf-8").replace("\r\n", "\n")
if "syncBottomMyPage" in nav and "setActiveNav(detectActivePanel());\n    syncBottomMyPage();" not in nav:
    nav2 = nav.replace(
        "setActiveNav(detectActivePanel());\n\n    nav.querySelectorAll",
        "setActiveNav(detectActivePanel());\n    syncBottomMyPage();\n\n    nav.querySelectorAll",
    )
    if nav2 == nav:
        nav2 = nav.replace(
            "setActiveNav(detectActivePanel());\r\n\r\n    nav.querySelectorAll",
            "setActiveNav(detectActivePanel());\r\n    syncBottomMyPage();\r\n\r\n    nav.querySelectorAll",
        )
    # also handle single newline variants without blank line
    if "syncBottomMyPage();" not in nav2[nav2.find("function injectBottomNav"):nav2.find("function injectBottomNav")+800]:
        nav2 = nav.replace(
            "setActiveNav(detectActivePanel());",
            "setActiveNav(detectActivePanel());\n    syncBottomMyPage();",
            1,
        )
    Path("site-nav.js").write_text(nav2.replace("\n", "\r\n"), encoding="utf-8")
    print("sync call fixed", "syncBottomMyPage();" in Path("site-nav.js").read_text(encoding="utf-8"))

print("site-nav ensure", VER in Path("site-nav.js").read_text(encoding="utf-8"))
