#!/usr/bin/env python3
from pathlib import Path
import re

p = Path(r"F:/공방171포폴프로젝트/_pwa_push/pwa-register.js")
t = p.read_text(encoding="utf-8")

notes = (
    "const RELEASE_NOTES = [\n"
    '    "최종검수 글·이미지가 바로 올라갑니다",\n'
    '    "업데이트는 새 배포가 있을 때만 한 번 안내합니다",\n'
    "  ];"
)
t = re.sub(r"const RELEASE_NOTES = \[[^\]]*\];", notes, t, count=1, flags=re.S)

t = re.sub(
    r"function needsUpdatePrompt\(\) \{\s*const activated = localStorage\.getItem\(ACTIVATED_KEY\) \|\| localStorage\.getItem\(BUILD_KEY\) \|\| \"\";\s*return activated && activated !== APP_BUILD;\s*\}",
    "function needsUpdatePrompt() {\n"
    "    // Customer update UI is driven only by app-build.json (checkRemoteBuild).\n"
    "    return false;\n"
    "  }",
    t,
    count=1,
)

# Drop leftover force-prompt comment if present
lines = []
for line in t.splitlines(True):
    if "require user update (no silent stamp)" in line:
        continue
    lines.append(line)
t = "".join(lines)

p.write_text(t, encoding="utf-8", newline="\n")
text = p.read_text(encoding="utf-8")
assert "최종검수" in text
assert "function needsUpdatePrompt() {\n    // Customer update UI" in text
print("ok")
