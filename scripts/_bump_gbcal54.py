#!/usr/bin/env python3
from pathlib import Path
import json
import re

root = Path(r"F:/공방171포폴프로젝트/_pwa_push")
for p in root.rglob("*"):
    if p.suffix.lower() not in {".html", ".js", ".webmanifest"}:
        continue
    if any(x in p.parts for x in ("node_modules", ".git", "heritage-tryon")):
        continue
    try:
        t = p.read_text(encoding="utf-8")
    except Exception:
        continue
    if "gbcal53" not in t:
        continue
    p.write_text(t.replace("gbcal53", "gbcal54"), encoding="utf-8", newline="\n")
    print("bumped", p.relative_to(root))

reg = root / "pwa-register.js"
t = reg.read_text(encoding="utf-8")
t = re.sub(r'const APP_BUILD = "[^"]+";', 'const APP_BUILD = "20260810-gbcal54";', t, count=1)
t = re.sub(r'const APP_VERSION = "[^"]+";', 'const APP_VERSION = "v1.12.40";', t, count=1)
notes = (
    "const RELEASE_NOTES = [\n"
    '    "최종검수 삭제가 바로 반영됩니다",\n'
    "  ];"
)
t = re.sub(r"const RELEASE_NOTES = \[[^\]]*\];", notes, t, count=1, flags=re.S)
reg.write_text(t, encoding="utf-8", newline="\n")

meta = {
    "build": "20260810-gbcal54",
    "minInstallBuild": "20260809-gbcal31",
    "appVersion": "v1.12.40",
    "deployedAt": "2026-08-10T11:50:00.000Z",
    "note": "Fast Contabo shipping delete",
    "notes": ["최종검수 삭제가 바로 반영됩니다"],
}
(root / "app-build.json").write_text(
    json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
(root / "app-build.20260810-gbcal54.json").write_text(
    json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print("app-build", meta["build"])
