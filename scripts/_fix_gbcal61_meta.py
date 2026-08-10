# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(r"F:/공방171포폴프로젝트/_pwa_push/pwa-register.js")
raw = p.read_bytes()
start = raw.find(b"const APP_VERSION")
end = raw.find(b"const BUILD_KEY")
header = (
    'const APP_VERSION = "v1.12.46";\r\n'
    "  const RELEASE_NOTES = [\r\n"
    '    "\uacf5\ub3d9\uad6c\ub9e4 \ub2ec\ub825 \uc5ec\ubc31\u00b7\ucee4\ubc84 \uc774\ubbf8\uc9c0 \uc218\uc815",\r\n'
    '    "\uc0c1\uc138 \ucd94\uac00\uc774\ubbf8\uc9c0 \uc378\ub124\uc77c \ud45c\uc2dc \uac1c\uc120",\r\n'
    '    "\ubc84\uadf8 \uc218\uc815 \ubc0f \uc548\uc815\uc131 \uac1c\uc120",\r\n'
    "  ];\r\n"
    "  "
).encode("utf-8")
# keep APP_BUILD from bump
p.write_bytes(raw[:start] + header + raw[end:])
# ensure APP_BUILD is gbcal61
text = p.read_text(encoding="utf-8")
text = text.replace('APP_BUILD = "20260810-gbcal60"', 'APP_BUILD = "20260810-gbcal61"')
p.write_text(text, encoding="utf-8")
print("\n".join(p.read_text(encoding="utf-8").splitlines()[3:12]))

Path(r"F:/공방171포폴프로젝트/_pwa_push/app-build.json").write_text(
    """{
  "build": "20260810-gbcal61",
  "minInstallBuild": "20260809-gbcal31",
  "deployedAt": "2026-08-10T14:10:00.000Z",
  "note": "Groupbuy calendar gutters + detail rail thumbs",
  "notes": [
    "공동구매 달력 여백·커버 이미지 수정",
    "상세 추가이미지 썸네일 표시 개선",
    "버그 수정 및 안정성 개선"
  ]
}
""",
    encoding="utf-8",
)
print("app-build ok")
