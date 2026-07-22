import fs from "fs";
import { execSync } from "child_process";

// Align cache bust with landing.html (already mp14) and ensure fix is in site-nav.js
let t = fs.readFileSync("site-nav.js", "utf8");
if (!t.includes("always shows all 5")) {
  console.error("fix missing from site-nav.js");
  process.exit(1);
}
t = t.replace(/20260722-mp\d+/g, "20260722-mp14");
fs.writeFileSync("site-nav.js", t, "utf8");
new Function(t);
console.log("site-nav ensureStylesheet bumped to mp14");

for (const f of ["landing.html", "mypage.html", "portfolio.html"]) {
  let html = fs.readFileSync(f, "utf8");
  const n = html.replace(/20260722-mp\d+/g, "20260722-mp14");
  fs.writeFileSync(f, n, "utf8");
}

const status = execSync("git status --porcelain", { encoding: "utf8" });
console.log(status || "(clean)");

execSync(
  "git add site-nav.js landing.html mypage.html portfolio.html landing.css portfolio-board.css site-nav.css",
  { stdio: "inherit" }
);
execSync(
  'git commit -m "Show all five bottom nav items; bump cache to mp14."',
  { stdio: "inherit" }
);
execSync("git push -u origin HEAD", { stdio: "inherit" });

const builds = execSync(
  "gh api repos/saveasme1/gongbang171_temp/pages/builds",
  { encoding: "utf8" }
);
const list = JSON.parse(builds).slice(0, 3);
for (const b of list) {
  console.log(b.status, b.created_at, b.error?.message || "");
}
