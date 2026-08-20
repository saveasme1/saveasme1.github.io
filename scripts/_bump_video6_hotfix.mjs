import fs from "fs";

const BUILD = "20260820-video6";
const PREV = "20260820-video5";
const MIN = "20260809-gbcal31";

for (const f of fs.readdirSync(".").filter((x) => x.endsWith(".html"))) {
  let t = fs.readFileSync(f, "utf8");
  const n = t.split(PREV).join(BUILD);
  if (n !== t) {
    fs.writeFileSync(f, n);
    console.log("html", f);
  }
}

let reg = fs.readFileSync("pwa-register.js", "utf8");
reg = reg.replace(/const APP_BUILD = "[^"]+";/, `const APP_BUILD = "${BUILD}";`);
if (!reg.includes(`MIN_INSTALL_BUILD = "${MIN}"`)) {
  throw new Error("MIN_INSTALL_BUILD drifted");
}
fs.writeFileSync("pwa-register.js", reg);

let sw = fs.readFileSync("sw.js", "utf8");
sw = sw.replace(
  /const CACHE_VERSION = "hx-pwa-v[^"]+";/,
  `const CACHE_VERSION = "hx-pwa-v${BUILD}";`
);
fs.writeFileSync("sw.js", sw);

const meta = {
  build: BUILD,
  minInstallBuild: MIN,
  deployedAt: new Date().toISOString(),
  note: "Fix accidental reinstall gate on video bump",
  notes: ["재설치 게이트 오발동 수정", "영상 업로드는 일반 업데이트로 적용"],
};
fs.writeFileSync("app-build.json", JSON.stringify(meta) + "\n");
fs.writeFileSync(`app-build.${BUILD}.json`, JSON.stringify(meta, null, 2) + "\n");

let m = fs.readFileSync("manifest.webmanifest", "utf8");
m = m.replace(/"id": "[^"]+"/, `"id": "/?pwa=${BUILD}"`);
m = m.replace(/"start_url": "[^"]+"/, `"start_url": "./landing.html?_pwa=${BUILD}"`);
fs.writeFileSync("manifest.webmanifest", m);

console.log("ok", BUILD);
