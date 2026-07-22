import { execSync } from "child_process";
import fs from "fs";

const src = execSync("git show 59adb42:site-nav.js");
let text = src.toString("utf8");
text = text.replace(/20260722-mp7/g, "20260722-mp12");
fs.writeFileSync("site-nav.js", text, "utf8");

try {
  new Function(text);
  console.log("SYNTAX OK");
} catch (e) {
  console.error("SYNTAX FAIL", e.message);
  process.exit(1);
}

console.log("has syncBottomMyPage", text.includes("syncBottomMyPage"));
console.log("has injectBottomNav", text.includes("injectBottomNav"));
console.log("cache", text.match(/site-nav\.css\?v=[^"']+/)?.[0]);

for (const f of ["landing.html", "mypage.html", "portfolio.html"]) {
  let t = fs.readFileSync(f, "utf8");
  const n = t.replace(/20260722-mp1[01]/g, "20260722-mp12");
  if (n !== t) {
    fs.writeFileSync(f, n, "utf8");
    console.log("updated", f);
  } else {
    console.log("no change", f);
  }
}
