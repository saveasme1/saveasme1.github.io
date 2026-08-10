# -*- coding: utf-8 -*-
from pathlib import Path
import re

p = Path("pwa-register.js")
t = p.read_text(encoding="utf-8")
t = t.replace('const APP_VERSION = "v1.12.42";', 'const APP_VERSION = "v1.12.43";', 1)
t = re.sub(
    r"const RELEASE_NOTES = \[[^\]]*\];",
    'const RELEASE_NOTES = [\n    "좋아요·발견 피드 안정화",\n    "글 작성 화면 사용성 개선",\n    "버그 수정 및 안정성 개선",\n  ];',
    t,
    count=1,
)
p.write_text(t, encoding="utf-8", newline="\n")
print("APP_VERSION", "v1.12.43" in t)
print("notes", "좋아요" in t)
