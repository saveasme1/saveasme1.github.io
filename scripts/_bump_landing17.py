# -*- coding: utf-8 -*-
import os
import re

base = r"F:\공방171포폴프로젝트\_gh_fix"
path = os.path.join(base, "landing.html")
html = open(path, encoding="utf-8").read()
html = html.replace("20260720-landing16", "20260720-landing17")
html = re.sub(r'handmade-reviews\.css\?v=[^"]+', "handmade-reviews.css?v=20260720-landing17", html)
html = re.sub(r'handmade-reviews\.js\?v=[^"]+', "handmade-reviews.js?v=20260720-landing17", html)
html = re.sub(r'landing-boards\.js\?v=[^"]+', "landing-boards.js?v=20260720-landing17", html)
html = re.sub(r'landing\.css\?v=[^"]+', "landing.css?v=20260720-landing17", html)
open(path, "w", encoding="utf-8").write(html)
for line in html.splitlines():
    if any(x in line for x in ["time-kr", "handmade-reviews", "landing-boards", "landing.css", "guide-build", "BUILD"]):
        if "script" in line or "link" in line or "guide-build" in line or "BUILD" in line:
            print(line.strip())
