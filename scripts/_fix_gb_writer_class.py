# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(r"F:/공방171포폴프로젝트/_pwa_push/groupbuy-calendar.js")
text = p.read_text(encoding="utf-8")
old = 'dlg.className = "gb-cal-writer review-dialog write-dialog gb-write-dialog";'
new = 'dlg.className = "gb-cal-writer review-dialog write-dialog gb-write-dialog pf-write-dialog";'
if old not in text:
    raise SystemExit("className line missing")
p.write_text(text.replace(old, new, 1), encoding="utf-8")
print("js classname ok")
