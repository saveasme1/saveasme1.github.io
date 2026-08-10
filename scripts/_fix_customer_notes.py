#!/usr/bin/env python3
from pathlib import Path
import json
import re

root = Path(r"F:/공방171포폴프로젝트/_pwa_push")

# Customer-facing copy only — never ops/admin internals.
CUSTOMER_NOTES = ["버그 수정 및 안정성 개선"]

reg = root / "pwa-register.js"
t = reg.read_text(encoding="utf-8")
t = re.sub(r'const APP_BUILD = "[^"]+";', 'const APP_BUILD = "20260810-gbcal56";', t, count=1)
t = re.sub(r'const APP_VERSION = "[^"]+";', 'const APP_VERSION = "v1.12.42";', t, count=1)
notes_js = (
    "const RELEASE_NOTES = [\n"
    '    "버그 수정 및 안정성 개선",\n'
    "  ];"
)
t = re.sub(r"const RELEASE_NOTES = \[[^\]]*\];", notes_js, t, count=1, flags=re.S)

# Soften dialog body if it mentions design/feature update in a way that's fine - keep generic
# Ensure fallback when filtered notes empty uses CUSTOMER notes
t = t.replace(
    "notes: customerNotes.length ? customerNotes : RELEASE_NOTES,",
    "notes: customerNotes.length ? customerNotes : [\"버그 수정 및 안정성 개선\"],",
)

# Expand filter to drop ops-ish lines if remote notes ever leak
old_filter = r"\.filter\(\(n\) => n && !/[^/]+/i\.test\(n\)\);"
# Replace the customerNotes filter block more carefully
pat = r"const customerNotes = \(notes \|\| \[\]\)\s*\.map\([\s\S]*?\.filter\([\s\S]*?\);"
repl = '''const customerNotes = (notes || [])
      .map((n) => String(n || "").trim())
      .filter((n) => n && !/커서|모바일앱과 동일|동일 방식|debug|내부|개발자|관리자|어드민|admin|전체관리|글쓰기|삭제|Contabo|Git|배포|최종검수|shipping|portfolio|공지·|바로 저장|바로 올라|운영|API|서버/i.test(n));'''
t2, n = re.subn(pat, repl, t, count=1)
if n != 1:
    print("WARN filter replace", n)
else:
    t = t2

reg.write_text(t, encoding="utf-8", newline="\n")

for p in root.rglob("*"):
    if p.suffix.lower() not in {".html", ".js", ".webmanifest"}:
        continue
    if any(x in p.parts for x in ("node_modules", ".git", "heritage-tryon")):
        continue
    try:
        text = p.read_text(encoding="utf-8")
    except Exception:
        continue
    if "gbcal55" not in text:
        continue
    p.write_text(text.replace("gbcal55", "gbcal56"), encoding="utf-8", newline="\n")
    print("bumped", p.name)

meta = {
    "build": "20260810-gbcal56",
    "minInstallBuild": "20260809-gbcal31",
    "appVersion": "v1.12.42",
    "deployedAt": "2026-08-10T12:05:00.000Z",
    "note": "internal: customer notes only in notes[]; ops detail stays in note",
    "notes": CUSTOMER_NOTES,
}
(root / "app-build.json").write_text(
    json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
(root / "app-build.20260810-gbcal56.json").write_text(
    json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)

# Ops doc rule
doc = Path(r"F:/공방171포폴프로젝트/본헤리티지-PWA-운영.md")
if doc.exists():
    d = doc.read_text(encoding="utf-8")
    rule = """
### 고객 업데이트 문구 (`app-build.json` → `notes`)

- **`notes`는 고객이 보는 문구만.** 예: `버그 수정 및 안정성 개선`
- 운영/개발 상세(최종검수 Contabo, Git, 배포 정책 등)는 **`note`(단수, 내부용)** 또는 이 문서에만 적는다.
- 고객에게 내부 작업 로그를 그대로 노출하지 않는다.
"""
    if "고객 업데이트 문구" not in d:
        d = d.replace(
            "### 릴리스 절차 (권장)",
            rule + "\n### 릴리스 절차 (권장)",
        )
        doc.write_text(d, encoding="utf-8")
        (root / "본헤리티지-PWA-운영.md").write_text(d, encoding="utf-8")

print("done", meta["build"], meta["notes"])
