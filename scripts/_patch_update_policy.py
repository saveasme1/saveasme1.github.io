#!/usr/bin/env python3
from pathlib import Path
import re

p = Path(r"F:/공방171포폴프로젝트/_pwa_push/pwa-register.js")
t = p.read_text(encoding="utf-8")

t = re.sub(r'const APP_BUILD = "[^"]+";', 'const APP_BUILD = "20260810-gbcal53";', t, count=1)
t = re.sub(r'const APP_VERSION = "[^"]+";', 'const APP_VERSION = "v1.12.39";', t, count=1)
t = re.sub(
    r"const RELEASE_NOTES = \[[^\]]*\];",
    'const RELEASE_NOTES = [\n    "최종검수 글·이미지가 바로 올라갑니다",\n    "업데이트는 새 배포가 있을 때만 한 번 안내합니다",\n  ];',
    t,
    count=1,
    flags=re.S,
)

t = t.replace("    force = true; // always force apply for this release\n", "")
t = t.replace(
    "if (Date.now() - snooze < 1000 * 60 * 5) return;",
    'if (snooze && Date.now() - snooze < 1000 * 60 * 60 * 24) { showUpdateChip(); return; }',
)

if "function buildRank" not in t:
    t = t.replace(
        "  function promptUpdateAvailable(extraNotes, force) {",
        """  function buildRank(build) {
    const text = String(build || "");
    const m = text.match(/gbcal(\\d+)/i);
    if (m) return Number(m[1]) || 0;
    return 0;
  }

  function promptUpdateAvailable(extraNotes, force = false) {""",
    )

pat = (
    r"(if \(remoteBuild === APP_BUILD\) \{[\s\S]*?return;\s*\}\s*)"
    r"(//[^\n]*\n\s*)?promptUpdateAvailable\(remoteNotes \|\| RELEASE_NOTES, true\);"
)
repl = """if (buildRank(remoteBuild) <= buildRank(APP_BUILD)) {
        localStorage.setItem(ACTIVATED_KEY, APP_BUILD);
        localStorage.setItem(BUILD_KEY, APP_BUILD);
        try {
          localStorage.removeItem(PROMPTED_BUILD_KEY);
        } catch (_) {}
        promptedBuild = "";
        updateOffered = false;
        const chip = document.getElementById("pwaUpdateChip");
        if (chip) chip.hidden = true;
        return;
      }

      // Only prompt when remote build is newer than the running script.
      promptUpdateAvailable(remoteNotes || RELEASE_NOTES, false);"""
t, n = re.subn(pat, repl, t, count=1)
print("checkRemote replace", n)

old_period = """        // Periodic re-check (CDN lag)
        [2500, 8000, 20000].forEach((ms) => {
          setTimeout(() => {
            checkRemoteBuild();
            reg.update().catch(() => {});
            if (reg.waiting && navigator.serviceWorker.controller) {
              pendingWorker = reg.waiting;
              promptUpdateAvailable(RELEASE_NOTES, true);
            }
          }, ms);
        });"""
new_period = """        // One delayed CDN catch-up only (no multi-minute spam).
        setTimeout(() => {
          checkRemoteBuild();
          reg.update().catch(() => {});
        }, 8000);
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) checkRemoteBuild();
        });"""
if old_period in t:
    t = t.replace(old_period, new_period)
    print("period replaced")
else:
    print("period NOT found")

p.write_text(t, encoding="utf-8", newline="\n")
print("ok", "gbcal53" in t, "buildRank" in t)
