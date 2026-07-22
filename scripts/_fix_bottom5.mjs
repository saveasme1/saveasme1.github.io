import fs from "fs";
import { execSync } from "child_process";

const path = "site-nav.js";
let t = fs.readFileSync(path, "utf8");

const before = t;
t = t.replace(
  /function syncBottomMyPage\(\) \{[\s\S]*?\n  \}/,
  `function syncBottomMyPage() {
    // Bottom nav always shows all 5 items (including mypage).
  }`
);

if (t === before) {
  console.error("replace failed");
  process.exit(1);
}

t = t.replace(/20260722-mp\d+/g, "20260722-mp13");
fs.writeFileSync(path, t, "utf8");
new Function(t);
console.log("SYNTAX OK");
console.log("hidden still?", t.includes("li.hidden = !loggedIn"));

for (const f of ["landing.html", "mypage.html", "portfolio.html"]) {
  let html = fs.readFileSync(f, "utf8");
  const n = html.replace(/20260722-mp\d+/g, "20260722-mp13");
  fs.writeFileSync(f, n, "utf8");
  console.log("bust", f);
}

execSync("git add site-nav.js landing.html mypage.html portfolio.html", {
  stdio: "inherit",
});
execSync(
  'git commit -m "Always show all five bottom nav buttons including mypage."',
  { stdio: "inherit" }
);
execSync("git push -u origin HEAD", { stdio: "inherit" });
execSync("git status -sb", { stdio: "inherit" });
