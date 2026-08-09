#!/usr/bin/env node
/**
 * Bump PWA build across ALL public HTML + core assets.
 */
import fs from "fs";
import path from "path";

const BUILD = process.argv[2] || "20260809-gbcal29";
const PREV = process.argv[3] || "20260809-gbcal28";
const SHORT = BUILD.replace("20260809-", "");

const NOTES = [
  "세로 화면 고정 (회전 자체 차단)",
  "앱 업데이트 안내 복구",
  "공동구매 캘린더 개선",
];

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const htmlFiles = fs.readdirSync(".").filter((f) => f.endsWith(".html"));

for (const file of htmlFiles) {
  let t = fs.readFileSync(file, "utf8");
  const before = t;
  t = t.replace(new RegExp(esc(PREV), "g"), BUILD);
  t = t.replace(/hx\.pwa\.forceNuke\.[a-zA-Z0-9_-]+/g, `hx.pwa.forceNuke.${SHORT}`);
  t = t.replace(/pwa-register\.js\?v=[^"']+/g, `pwa-register.js?v=${BUILD}`);
  t = t.replace(/manifest\.webmanifest\?v=[^"']+/g, `manifest.webmanifest?v=${BUILD}`);
  t = t.replace(/sw\.js\?v=[^"']+/g, `sw.js?v=${BUILD}`);
  t = t.replace(/content="20260809-gbcal\d+"/g, `content="${BUILD}"`);
  t = t.replace(
    /try \{ if \(sessionStorage\.getItem\(KEY\) === "1"\) return; \} catch \(_\) \{\}\s*try \{ sessionStorage\.setItem\(KEY, "1"\); \} catch \(_\) \{\}/g,
    'try { if (localStorage.getItem(KEY) === "1") return; } catch (_) {}\n      try { localStorage.setItem(KEY, "1"); } catch (_) {}'
  );
  t = t.replace(
    /localStorage\.removeItem\("hx\.pwa\.build"\);\s*localStorage\.removeItem\("hx\.pwa\.activatedBuild"\);\s*localStorage\.removeItem\("hx\.pwa\.updateSnooze"\);/g,
    'localStorage.removeItem("hx.pwa.updateSnooze");'
  );
  t = t.replace(/<!-- cache-bust: [^>]+ -->/g, `<!-- cache-bust: ${BUILD} -->`);
  if (t !== before) {
    fs.writeFileSync(file, t);
    console.log("bumped html", file);
  }
}

let reg = fs.readFileSync("pwa-register.js", "utf8");
reg = reg.replace(/const APP_BUILD = "[^"]+";/, `const APP_BUILD = "${BUILD}";`);
fs.writeFileSync("pwa-register.js", reg);

let sw = fs.readFileSync("sw.js", "utf8");
sw = sw.replace(/const CACHE_VERSION = "hx-pwa-v[^"]+";/, `const CACHE_VERSION = "hx-pwa-v${BUILD}";`);
fs.writeFileSync("sw.js", sw);

const meta = {
  build: BUILD,
  deployedAt: new Date().toISOString(),
  note: "PWA portrait lock + update fix (all pages)",
  notes: NOTES,
};
fs.writeFileSync("app-build.json", JSON.stringify(meta) + "\n");
fs.writeFileSync(`app-build.${BUILD}.json`, JSON.stringify(meta, null, 2) + "\n");

let manifest = fs.readFileSync("manifest.webmanifest", "utf8");
manifest = manifest.replace(/"id": "[^"]+"/, `"id": "/?pwa=${BUILD}"`);
manifest = manifest.replace(/"start_url": "[^"]+"/, `"start_url": "./landing.html?_pwa=${BUILD}"`);
manifest = manifest.replace(
  /"display_override": \[\s*"standalone",\s*"minimal-ui"\s*\]/,
  '"display_override": ["standalone"]'
);
manifest = manifest.replace(/"orientation": "[^"]+"/, '"orientation": "portrait-primary"');
fs.writeFileSync("manifest.webmanifest", manifest);

console.log("done", BUILD);
