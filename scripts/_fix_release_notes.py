# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(r"F:/공방171포폴프로젝트/_pwa_push/pwa-register.js")
raw = p.read_bytes()
start = raw.find(b"const APP_VERSION")
end = raw.find(b"const BUILD_KEY")
if start < 0 or end < 0 or end <= start:
    raise SystemExit(f"markers missing start={start} end={end}")

header = (
    'const APP_VERSION = "v1.12.44";\r\n'
    "  const RELEASE_NOTES = [\r\n"
    '    "\uacf5\ub3d9\uad6c\ub9e4 \uae00\uc4f0\uae30\u00b7\uae00\ubcf4\uae30 PC \ud3ed \uac1c\uc120",\r\n'
    '    "\uc88b\uc544\uc694\u00b7\ubc1c\uacac \ud53c\ub4dc \uc548\uc815\ud654",\r\n'
    '    "\ubc84\uadf8 \uc218\uc815 \ubc0f \uc548\uc815\uc131 \uac1c\uc120",\r\n'
    "  ];\r\n"
    "  "
).encode("utf-8")

p.write_bytes(raw[:start] + header + raw[end:])
text = p.read_text(encoding="utf-8")
print("\n".join(text.splitlines()[3:12]))
