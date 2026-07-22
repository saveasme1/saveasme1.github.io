import fs from "fs";
import { execSync } from "child_process";

const BUST = "20260722-mp18";
for (const f of ["landing.html", "mypage.html", "portfolio.html", "site-nav.js"]) {
  if (!fs.existsSync(f)) continue;
  const t = fs.readFileSync(f, "utf8");
  fs.writeFileSync(f, t.replace(/20260722-mp\d+/g, BUST), "utf8");
}

execSync(
  "git add landing.css handmade-reviews.css portfolio-board.css landing.html mypage.html portfolio.html site-nav.js",
  { stdio: "inherit" }
);
execSync(
  'git commit -m "Shrink PC write-button label size on orange and board toolbars."',
  { stdio: "inherit" }
);
execSync("git push -u origin HEAD", { stdio: "inherit" });
console.log("done");
