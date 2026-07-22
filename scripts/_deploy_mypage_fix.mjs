import fs from "fs";
import { execSync } from "child_process";

new Function(fs.readFileSync("mypage.js", "utf8"));
console.log("mypage.js OK");

execSync("git add mypage.css mypage.html mypage.js", { stdio: "inherit" });
execSync(
  'git commit -m "Isolate mypage from landing board CSS and restore a stable list layout."',
  { stdio: "inherit" }
);
execSync("git push -u origin HEAD", { stdio: "inherit" });
execSync("git status -sb", { stdio: "inherit" });
