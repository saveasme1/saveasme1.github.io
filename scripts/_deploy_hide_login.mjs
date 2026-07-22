import fs from "fs";
import { execSync } from "child_process";

const BUST = "20260722-mp17";
for (const f of ["landing.html", "mypage.html", "portfolio.html", "site-nav.js"]) {
  if (!fs.existsSync(f)) continue;
  const t = fs.readFileSync(f, "utf8");
  fs.writeFileSync(f, t.replace(/20260722-mp\d+/g, BUST), "utf8");
}

for (const f of ["portfolio-board.js", "handmade-reviews.js", "landing-boards.js"]) {
  new Function(fs.readFileSync(f, "utf8"));
  console.log("OK", f);
}

execSync(
  "git add portfolio-board.js handmade-reviews.js landing-boards.js portfolio-board.css handmade-reviews.css landing.css landing.html mypage.html portfolio.html site-nav.js",
  { stdio: "inherit" }
);
execSync(
  'git commit -m "Hide board login buttons; show write only when permitted so search expands."',
  { stdio: "inherit" }
);
execSync("git push -u origin HEAD", { stdio: "inherit" });
execSync("git status -sb", { stdio: "inherit" });
