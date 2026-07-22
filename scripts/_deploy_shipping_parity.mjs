import fs from "fs";
import { execSync } from "child_process";

const BUST = "20260722-mp20";
for (const f of ["landing.html", "mypage.html", "portfolio.html", "site-nav.js"]) {
  if (!fs.existsSync(f)) continue;
  let t = fs.readFileSync(f, "utf8");
  t = t.replace(/20260722-mp\d+/g, BUST);
  fs.writeFileSync(f, t, "utf8");
  console.log("bust", f);
}

for (const f of ["shipping-board.js", "landing-boards.js", "site-nav.js"]) {
  new Function(fs.readFileSync(f, "utf8"));
  console.log("syntax", f);
}

execSync(
  "git add landing.html landing.css landing-boards.js shipping-board.js site-nav.js shipping-data.json shipping/categories portfolio/categories scripts/categorize-shipping.mjs scripts/lib/brand-detect.mjs",
  { stdio: "inherit" }
);
execSync(
  'git commit -m "Match shipping board to portfolio UI with brand categories and calendars."',
  { stdio: "inherit" }
);
execSync("git push -u origin HEAD", { stdio: "inherit" });
execSync("git status -sb", { stdio: "inherit" });
