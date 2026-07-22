import fs from "fs";
import { execSync } from "child_process";

const BUST = "20260722-mp16";

for (const f of [
  "landing.html",
  "mypage.html",
  "portfolio.html",
  "site-nav.js",
]) {
  if (!fs.existsSync(f)) continue;
  let t = fs.readFileSync(f, "utf8");
  const n = t.replace(/20260722-mp\d+/g, BUST);
  fs.writeFileSync(f, n, "utf8");
  console.log("bust", f, n !== t);
}

for (const f of [
  "portfolio-board.js",
  "handmade-reviews.js",
  "landing-boards.js",
]) {
  const t = fs.readFileSync(f, "utf8");
  try {
    new Function(t);
    console.log("syntax OK", f);
  } catch (e) {
    console.error("syntax FAIL", f, e.message);
    process.exit(1);
  }
}

execSync(
  "git add landing.html portfolio.html mypage.html landing.css portfolio-board.css portfolio-board.js handmade-reviews.css handmade-reviews.js landing-boards.js site-nav.js",
  { stdio: "inherit" }
);
execSync(
  'git commit -m "Stick board search and auth into Collection/tools row on mobile and tablet."',
  { stdio: "inherit" }
);
execSync("git push -u origin HEAD", { stdio: "inherit" });
execSync("git status -sb", { stdio: "inherit" });
