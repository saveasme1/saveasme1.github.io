#!/usr/bin/env node
/**
 * Cache-bust bump for heritage PWA pages.
 *
 * Usage:
 *   node scripts/bump-gbcal-build.mjs 20260811-gbcal82 20260811-gbcal81 \
 *     --note "internal ops detail" \
 *     --notes "고객용 문구1" "고객용 문구2"
 *
 * Always bumps APP_VERSION patch. Customer-facing lines go in notes[] only.
 * Internal deploy detail stays in note (singular).
 */
import fs from "fs";

const BUILD = process.argv[2];
const PREV = process.argv[3];
if (!BUILD || !PREV) {
  console.error("Usage: node scripts/bump-gbcal-build.mjs <NEW> <PREV> [--note ...] [--notes ...]");
  process.exit(1);
}

function argList(flag) {
  const i = process.argv.indexOf(flag);
  if (i < 0) return [];
  const out = [];
  for (let j = i + 1; j < process.argv.length; j += 1) {
    if (process.argv[j].startsWith("--")) break;
    out.push(process.argv[j]);
  }
  return out;
}

const internalNote = argList("--note").join(" ") || "internal deploy";
const customerNotes = argList("--notes");
if (!customerNotes.length) {
  console.error("Refusing bump without --notes (customer-facing update lines required).");
  process.exit(1);
}

const htmlFiles = [
  "landing.html",
  "groupbuy.html",
  "shipping.html",
  "portfolio.html",
  "notices.html",
  "reviews.html",
];

for (const file of htmlFiles) {
  if (!fs.existsSync(file)) continue;
  let t = fs.readFileSync(file, "utf8");
  t = t.split(PREV).join(BUILD);
  fs.writeFileSync(file, t);
  console.log("bumped", file);
}

let reg = fs.readFileSync("pwa-register.js", "utf8");
reg = reg.replace(/const APP_BUILD = "[^"]+";/, `const APP_BUILD = "${BUILD}";`);
const verMatch = reg.match(/const APP_VERSION = "v(\d+)\.(\d+)\.(\d+)";/);
if (!verMatch) {
  console.error("APP_VERSION not found");
  process.exit(1);
}
const nextVer = `v${verMatch[1]}.${verMatch[2]}.${Number(verMatch[3]) + 1}`;
reg = reg.replace(/const APP_VERSION = "[^"]+";/, `const APP_VERSION = "${nextVer}";`);
reg = reg.replace(
  /const RELEASE_NOTES = \[[\s\S]*?\];/,
  `const RELEASE_NOTES = [\n${customerNotes.map((n) => `    ${JSON.stringify(n)}`).join(",\n")}\n  ];`
);
fs.writeFileSync("pwa-register.js", reg);
console.log("bumped pwa-register.js", BUILD, nextVer);

let sw = fs.readFileSync("sw.js", "utf8");
sw = sw.replace(/const CACHE_VERSION = "hx-pwa-v[^"]+";/, `const CACHE_VERSION = "hx-pwa-v${BUILD}";`);
fs.writeFileSync("sw.js", sw);

const meta = {
  build: BUILD,
  minInstallBuild: "20260809-gbcal31",
  appVersion: nextVer,
  deployedAt: new Date().toISOString(),
  note: internalNote,
  notes: customerNotes,
};
fs.writeFileSync("app-build.json", JSON.stringify(meta, null, 2) + "\n");
fs.writeFileSync(`app-build.${BUILD}.json`, JSON.stringify(meta, null, 2) + "\n");
console.log("wrote app-build", BUILD, nextVer);
