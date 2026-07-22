from pathlib import Path

p = Path("site-nav.js")
text = p.read_text(encoding="utf-8").replace("\r\n", "\n")
text = text.replace("site-nav.css?v=20260722-mp4", "site-nav.css?v=20260722-mp5")
slash = chr(47)
port = slash + "portfolio.html"

if "isPortfolioPage" not in text:
    old = (
        "function isMyPage() {\n"
        "    return " + slash + "mypage\\.html$/i.test(location.pathname);\n"
        "  }"
    )
    # The source uses a JS regex literal: /\/mypage\.html$/i
    old = "function isMyPage() {\n    return /\\" + slash + "mypage\\.html$/i.test(location.pathname);\n  }"
    new = old + (
        "\n\n  function isPortfolioPage() {\n"
        "    return /\\" + slash + "portfolio\\.html$/i.test(location.pathname);\n"
        "  }"
    )
    if old not in text:
        raise SystemExit("isMyPage block missing: " + repr(text[text.find("isMyPage"):text.find("isMyPage")+120]))
    text = text.replace(old, new, 1)

needle = 'function detectActivePanel() {\n    if (isMyPage()) return "mypage";'
if 'if (isPortfolioPage()) return "portfolio"' not in text:
    if needle not in text:
        raise SystemExit("detectActivePanel missing")
    text = text.replace(
        needle,
        needle + '\n    if (isPortfolioPage()) return "portfolio";',
        1,
    )

start = text.find('if (name === "portfolio") {\n        if (typeof window.closeGongbangBoardPanels')
end = text.find("else location.href = HOME;", start)
print("marks", start, end)
if start < 0 or end < 0:
    raise SystemExit("portfolio openPanel block missing")
end2 = end + len("else location.href = HOME;")
if port not in text[start:end2]:
    repl = (
        'if (name === "portfolio") {\n'
        '        location.href = "' + port + '";\n'
        '        return;\n'
        '      }\n'
        '    }\n'
        '    if (name === "portfolio") {\n'
        '      if (isPortfolioPage()) {\n'
        '        setActiveNav("portfolio");\n'
        '        window.scrollTo({ top: 0, behavior: "smooth" });\n'
        '        return;\n'
        '      }\n'
        '      location.href = "' + port + '";\n'
        '    } else if (name === "reviews") location.href = `${HOME}?open=reviews`;\n'
        '    else if (name === "shipping") location.href = `${HOME}?open=shipping`;\n'
        '    else location.href = HOME;'
    )
    text = text[:start] + repl + text[end2:]

p.write_text(text.replace("\n", "\r\n"), encoding="utf-8")
print("nav", "isPortfolioPage" in text, port in text)

# portfolio-board auth export
pj = Path("portfolio-board.js")
ps = pj.read_text(encoding="utf-8").replace("\r\n", "\n")
if "window.openGongbangAuth" not in ps:
    oldb = "bootSession();\n  loadData();"
    newb = (
        'window.openGongbangAuth = (mode) => openAuth(mode || "login");\n'
        "  window.getGongbangMember = () => state.member;\n\n"
        "  bootSession();\n  loadData();"
    )
    if oldb not in ps:
        raise SystemExit("boot block missing")
    ps = ps.replace(oldb, newb, 1)
    pj.write_text(ps.replace("\n", "\r\n"), encoding="utf-8")
print("auth", "window.openGongbangAuth" in pj.read_text(encoding="utf-8"))

land = Path("landing.html").read_text(encoding="utf-8")
land = land.replace("site-nav.js?v=20260722-mp4", "site-nav.js?v=20260722-mp5")
land = land.replace("site-nav.css?v=20260722-mp4", "site-nav.css?v=20260722-mp5")
Path("landing.html").write_text(land, encoding="utf-8")
print("landing bumped")
