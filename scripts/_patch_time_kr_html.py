# -*- coding: utf-8 -*-
import os
import re

base = r"F:\공방171포폴프로젝트\_gh_fix"

html_path = os.path.join(base, "landing.html")
html = open(html_path, encoding="utf-8").read()
html = html.replace("20260720-landing16", "20260720-landing17")
if "time-kr.js" not in html:
    html = html.replace(
        '<script src="portfolio.js',
        '<script src="time-kr.js?v=20260720-kst1"></script>\n  <script src="portfolio.js',
    )
open(html_path, "w", encoding="utf-8").write(html)
print("landing", "landing17" in html, "time-kr" in html)

admin_pages = [
    ("admin/index.html", "/admin/hub.js"),
    ("admin/portfolio/index.html", "/admin/admin.js"),
    ("admin/shipping/index.html", "/admin/board-admin.js"),
    ("admin/notices/index.html", "/admin/board-admin.js"),
    ("admin/preview.html", "/admin/preview.js"),
]

for rel, marker in admin_pages:
    path = os.path.join(base, rel)
    text = open(path, encoding="utf-8").read()
    if "time-kr.js" not in text:
        needle = f'<script src="{marker}'
        if needle in text:
            text = text.replace(
                needle,
                f'<script src="/time-kr.js?v=20260720-kst1"></script>\n  {needle}',
                1,
            )
        else:
            # relative script tags
            alt = marker.lstrip("/")
            needle2 = f'<script src="{alt}'
            if needle2 in text:
                text = text.replace(
                    needle2,
                    f'<script src="/time-kr.js?v=20260720-kst1"></script>\n  {needle2}',
                    1,
                )
    text = re.sub(r"(hub\.js\?v=)[^\"]+", r"\g<1>20260720-hub4", text)
    text = re.sub(r"(admin\.js\?v=)[^\"]+", r"\g<1>20260720-admin9", text)
    text = re.sub(r"(board-admin\.js\?v=)[^\"]+", r"\g<1>20260720-b6", text)
    text = re.sub(r"(preview\.js\?v=)[^\"]+", r"\g<1>20260720-preview2", text)
    open(path, "w", encoding="utf-8").write(text)
    print(rel, "time-kr" in open(path, encoding="utf-8").read())
