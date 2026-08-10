# -*- coding: utf-8 -*-
from pathlib import Path

notes = [
    "\uacf5\uc9c0\uc0ac\ud56d \ub3c5\ub9bd \ud398\uc774\uc9c0\u00b7\ud035\uba54\ub274 \uc21c\uc11c \uc218\uc815",
    "\uba54\uc778 \ubc30\ub108\u00b7\uacf5\uc9c0 \ubaa9\ub85d \uc5ec\ubc31 \uac1c\uc120",
    "\ubc84\uadf8 \uc218\uc815 \ubc0f \uc548\uc815\uc131 \uac1c\uc120",
]
assert "\ud035" in notes[0]
p = Path(r"F:/공방171포폴프로젝트/_pwa_push/pwa-register.js")
raw = p.read_bytes()
start = raw.find(b"const APP_VERSION")
end = raw.find(b"const BUILD_KEY")
header = (
    'const APP_VERSION = "v1.12.47";\r\n'
    "  const RELEASE_NOTES = [\r\n"
    + "".join(f'    "{n}",\r\n' for n in notes)
    + "  ];\r\n"
    "  "
).encode("utf-8")
p.write_bytes(raw[:start] + header + raw[end:])
print(p.read_text(encoding="utf-8").splitlines()[6])
Path(r"F:/공방171포폴프로젝트/_pwa_push/app-build.json").write_text(
    "{\n"
    '  "build": "20260810-gbcal62",\n'
    '  "minInstallBuild": "20260809-gbcal31",\n'
    '  "deployedAt": "2026-08-10T14:30:00.000Z",\n'
    '  "note": "Notices standalone + quick menu + hero restore; PWA only",\n'
    '  "notes": [\n'
    + "".join(f'    "{n}",\n' for n in notes)
    + "  ]\n}\n",
    encoding="utf-8",
)
Path(r"F:/공방171포폴프로젝트/_pwa_push/app-build.20260810-gbcal62.json").write_bytes(
    Path(r"F:/공방171포폴프로젝트/_pwa_push/app-build.json").read_bytes()
)
