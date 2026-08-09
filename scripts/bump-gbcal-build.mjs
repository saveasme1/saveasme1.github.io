#!/usr/bin/env node
/**
 * Groupbuy / landing cache-bust bump (gbcal* builds).
 *
 * Rules (see landing.html head):
 * 1. forceNuke KEY  → hx.pwa.forceNuke.{BUILD}
 * 2. _pwa redirect  → 20260809-gbcalNN
 * 3. meta guide-build + HTML cache-bust comment
 * 4. ?v= on touched assets (groupbuy-calendar, pwa-register, pwa-home, portfolio-board, landing-boards)
 * 5. pwa-register.js APP_BUILD
 * 6. sw.js CACHE_VERSION (hx-pwa-v{BUILD})
 * 7. app-build.json + app-build.{BUILD}.json
 */
import fs from "fs";

const BUILD = process.argv[2] || "20260809-gbcal16";
const PREV = process.argv[3] || "20260809-gbcal15";

const htmlFiles = ["landing.html", "groupbuy.html"];

function bumpHtml(file) {
  if (!fs.existsSync(file)) return;
  let t = fs.readFileSync(file, "utf8");
  t = t.replace(new RegExp(PREV.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), BUILD);
  t = t.replace(/hx\.pwa\.forceNuke\.gbcal\d+/g, `hx.pwa.forceNuke.${BUILD.replace("20260809-", "")}`);
  fs.writeFileSync(file, t);
  console.log("bumped", file);
}

for (const f of htmlFiles) bumpHtml(f);

let reg = fs.readFileSync("pwa-register.js", "utf8");
reg = reg.replace(/const APP_BUILD = "[^"]+";/, `const APP_BUILD = "${BUILD}";`);
fs.writeFileSync("pwa-register.js", reg);
console.log("bumped pwa-register.js APP_BUILD");

let sw = fs.readFileSync("sw.js", "utf8");
sw = sw.replace(/const CACHE_VERSION = "hx-pwa-v[^"]+";/, `const CACHE_VERSION = "hx-pwa-v${BUILD}";`);
fs.writeFileSync("sw.js", sw);
console.log("bumped sw.js CACHE_VERSION");

const meta = {
  build: BUILD,
  deployedAt: new Date().toISOString(),
  note: "groupbuy calendar deploy",
};
fs.writeFileSync("app-build.json", JSON.stringify(meta) + "\n");
fs.writeFileSync(`app-build.${BUILD}.json`, JSON.stringify(meta, null, 2) + "\n");
console.log("wrote app-build", BUILD);
