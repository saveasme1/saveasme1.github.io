# -*- coding: utf-8 -*-
from pathlib import Path
import re

# Fix RELEASE_NOTES encoding in pwa-register.js
p = Path(r"F:/공방171포폴프로젝트/_pwa_push/pwa-register.js")
raw = p.read_bytes()
start = raw.find(b"const APP_VERSION")
end = raw.find(b"const BUILD_KEY")
assert start > 0 and end > start
header = (
    'const APP_VERSION = "v1.12.45";\r\n'
    "  const RELEASE_NOTES = [\r\n"
    '    "\uacf5\ub3d9\uad6c\ub9e4 \uc774\ubbf8\uc9c0 \ubbf8\ub9ac\ubcf4\uae30 \uc218\uc815",\r\n'
    '    "\uacf5\ub3d9\uad6c\ub9e4 \uae00\uc4f0\uae30\u00b7\uae00\ubcf4\uae30 PC \ud3ed \uac1c\uc120",\r\n'
    '    "\ubc84\uadf8 \uc218\uc815 \ubc0f \uc548\uc815\uc131 \uac1c\uc120",\r\n'
    "  ];\r\n"
    "  "
).encode("utf-8")
p.write_bytes(raw[:start] + header + raw[end:])
print("pwa-register notes ok")
print("\n".join(p.read_text(encoding="utf-8").splitlines()[3:12]))

# Fix app-build.json
Path(r"F:/공방171포폴프로젝트/_pwa_push/app-build.json").write_text(
    """{
  "build": "20260810-gbcal60",
  "minInstallBuild": "20260809-gbcal31",
  "deployedAt": "2026-08-10T13:50:00.000Z",
  "note": "Groupbuy writer cover/detail preview match shipping",
  "notes": [
    "공동구매 이미지 미리보기 수정",
    "공동구매 글쓰기·글보기 PC 폭 개선",
    "버그 수정 및 안정성 개선"
  ]
}
""",
    encoding="utf-8",
)
print("app-build ok")
