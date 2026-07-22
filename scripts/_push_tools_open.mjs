import fs from "fs";
import { execSync } from "child_process";

let t = fs.readFileSync("portfolio-board.js", "utf8");
t = t.replace(/20260722-mp\d+/g, "20260722-mp16");
fs.writeFileSync("portfolio-board.js", t, "utf8");
new Function(t);

execSync("git add portfolio-board.js", { stdio: "inherit" });
execSync(
  'git commit -m "Re-place portfolio tools when the panel opens."',
  { stdio: "inherit" }
);
execSync("git push -u origin HEAD", { stdio: "inherit" });

await new Promise((r) => setTimeout(r, 25000));
const html = await fetch("https://hand-made.kr/landing.html?_=" + Date.now(), {
  cache: "no-store",
}).then((r) => r.text());
console.log("bust", [...new Set(html.match(/20260722-mp\d+/g) || [])]);
console.log("board-tools-copy", html.includes("board-tools-copy"));
console.log(
  "rail-head tools",
  /pf-rail-head[\s\S]{0,400}pf-search[\s\S]{0,400}pf-tools-actions/.test(html)
);
const pages = JSON.parse(
  execSync("gh api repos/saveasme1/gongbang171_temp/pages/builds", {
    encoding: "utf8",
  })
);
console.log(
  pages.slice(0, 2).map((b) => ({ status: b.status, at: b.created_at }))
);
