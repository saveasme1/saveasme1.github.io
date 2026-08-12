from pathlib import Path
import re

root = Path(r"F:/공방171포폴프로젝트/_pwa_push")
BUILD = "20260811-gbcal82"

# --- install.html ---
p = root / "install.html"
if p.exists():
    t = p.read_text(encoding="utf-8")
    t = re.sub(
        r'<meta\s+name="robots"\s+content="[^"]*"\s*/?>',
        '<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate, max-image-preview:none, max-snippet:0, max-video-preview:0">',
        t,
        count=1,
    )
    if 'name="robots"' not in t and "</head>" in t:
        t = t.replace(
            "</head>",
            '  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate, max-image-preview:none, max-snippet:0, max-video-preview:0">\n</head>',
            1,
        )
    for a in ["본 헤리티지 앱 설치", "본 헤리티지", "아이폰 설치용 QR 코드", "QR"]:
        t = t.replace(f'alt="{a}"', 'alt=""')
    p.write_text(t, encoding="utf-8")
    print("install.html patched")

ROBOTS_BLOCK = """  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate, max-image-preview:none, max-snippet:0, max-video-preview:0">
  <meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
  <meta name="googlebot-image" content="noindex, noimageindex">
  <meta name="bingbot" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
  <meta name="yeti" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
  <meta name="NaverBot" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
"""

for rel in [
    "search.html",
    "offline.html",
    "main-closed-content.html",
    "heritage-gold/index.html",
    "opening-event.html",
    "shutdown-content.html",
    "main-blocked.html",
    "notice-view.html",
]:
    fp = root / rel
    if not fp.exists():
        print("skip", rel)
        continue
    s = fp.read_text(encoding="utf-8")
    if 'name="robots"' in s:
        s = re.sub(
            r'<meta\s+name="robots"\s+content="[^"]*"\s*/?>',
            '<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate, max-image-preview:none, max-snippet:0, max-video-preview:0">',
            s,
            count=1,
        )
        if "googlebot-image" not in s and "</head>" in s:
            s = s.replace("</head>", ROBOTS_BLOCK + "</head>", 1)
    elif "</head>" in s:
        s = s.replace("</head>", ROBOTS_BLOCK + "</head>", 1)
    fp.write_text(s, encoding="utf-8")
    print("robots+", rel)

SCRIPT = f'  <script src="seo-guard.js?v={BUILD}"></script>\n'
html_files = list(root.glob("*.html"))
if (root / "admin").exists():
    html_files += list((root / "admin").rglob("*.html"))
for fp in html_files:
    s = fp.read_text(encoding="utf-8")
    if "seo-guard.js" in s:
        s = re.sub(r"seo-guard\.js\?v=[^\"]+", f"seo-guard.js?v={BUILD}", s)
        fp.write_text(s, encoding="utf-8")
        continue
    if "</head>" not in s:
        continue
    s = s.replace("</head>", SCRIPT + "</head>", 1)
    fp.write_text(s, encoding="utf-8")
    print("seo-guard", fp.relative_to(root))

for fp in html_files:
    s = fp.read_text(encoding="utf-8")
    if 'name="robots"' not in s:
        continue
    if "googlebot-image" in s and "max-snippet:0" in s:
        continue
    inject = ""
    if 'name="googlebot"' not in s:
        inject += '  <meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet, noimageindex">\n'
    if "googlebot-image" not in s:
        inject += '  <meta name="googlebot-image" content="noindex, noimageindex">\n'
    if 'name="bingbot"' not in s:
        inject += '  <meta name="bingbot" content="noindex, nofollow, noarchive, nosnippet, noimageindex">\n'
    if 'name="yeti"' not in s:
        inject += '  <meta name="yeti" content="noindex, nofollow, noarchive, nosnippet, noimageindex">\n'
    if 'name="NaverBot"' not in s:
        inject += '  <meta name="NaverBot" content="noindex, nofollow, noarchive, nosnippet, noimageindex">\n'
    if inject and "</head>" in s:
        s = s.replace("</head>", inject + "</head>", 1)
    s = re.sub(
        r'<meta\s+name="robots"\s+content="[^"]*"\s*/?>',
        '<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate, max-image-preview:none, max-snippet:0, max-video-preview:0">',
        s,
        count=1,
    )
    fp.write_text(s, encoding="utf-8")
    print("strengthen", fp.relative_to(root))

fixes = {
    "landing-boards.js": [
        ('img.alt = item.title || "";', 'img.alt = "";'),
        ("img.alt = item.title;", 'img.alt = "";'),
    ],
    "notice-view.js": [
        ("img.alt = title;", 'img.alt = "";'),
    ],
    "portfolio-board.js": [
        ("img.alt = item.title;", 'img.alt = "";'),
    ],
    "handmade-reviews.js": [
        ("img.alt = title;", 'img.alt = "";'),
    ],
    "groupbuy-calendar.js": [
        ('img.alt = it.title || "";', 'img.alt = "";'),
    ],
    "board-page.js": [
        ("img.alt = item.title;", 'img.alt = "";'),
    ],
    "search.js": [
        ('img.alt = displayTitle(row.title) || "";', 'img.alt = "";'),
        ('img.alt = "선택한 사진";', 'img.alt = "";'),
        ('img.alt = "촬영한 사진";', 'img.alt = "";'),
    ],
    "pwa-register.js": [
        ('img.alt = img.alt || "이미지 준비 중";', 'img.alt = "";'),
    ],
    "price-trend-panel.js": [
        ("img.alt = meta.country;", 'img.alt = "";'),
    ],
    "hx-today.js": [
        ("img.alt = g.name;", 'img.alt = "";'),
    ],
    "heritage-tryon/src/studio.js": [
        ('img.alt = state.item.title || "선택 제품";', 'img.alt = "";'),
    ],
    "heritage-tryon/index.html": [
        ('alt="선택한 바디 사진 미리보기"', 'alt=""'),
    ],
}

for rel, pairs in fixes.items():
    fp = root / rel
    if not fp.exists():
        print("missing", rel)
        continue
    s = fp.read_text(encoding="utf-8")
    n = 0
    for a, b in pairs:
        c = s.count(a)
        if c:
            s = s.replace(a, b)
            n += c
    fp.write_text(s, encoding="utf-8")
    print(rel, "replacements", n)

# sw precache
sw = root / "sw.js"
if sw.exists():
    s = sw.read_text(encoding="utf-8")
    if "./seo-guard.js" not in s:
        s = s.replace('"./robots.txt"', '"./seo-guard.js",\n  "./robots.txt"')
        if '"./robots.txt"' not in s and "PRECACHE" in s:
            s = s.replace('"./notices.html",', '"./notices.html",\n  "./seo-guard.js",\n  "./robots.txt",')
        sw.write_text(s, encoding="utf-8")
        print("sw precache updated")
    if "./robots.txt" not in s:
        s = sw.read_text(encoding="utf-8")
        s = s.replace('"./seo-guard.js",', '"./seo-guard.js",\n  "./robots.txt",')
        sw.write_text(s, encoding="utf-8")

print("done")
