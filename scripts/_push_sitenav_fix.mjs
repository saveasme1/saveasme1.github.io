import fs from "fs";
import { execSync } from "child_process";

const t = fs.readFileSync("site-nav.js", "utf8");
try {
  new Function(t);
  console.log("SYNTAX OK");
} catch (e) {
  console.error("SYNTAX FAIL", e.message);
  process.exit(1);
}
console.log(
  [...t.matchAll(/makeTopAuthButton\("([^"]+)"/g)].map((m) => m[1]).join(" | ")
);
console.log(
  [...t.matchAll(/data-nav="[^"]+"><svg[\s\S]*?<span>([^<]*)<\/span>/g)]
    .map((m) => m[1])
    .join(" | ")
);

execSync("git add site-nav.js landing.html mypage.html portfolio.html", {
  stdio: "inherit",
});
execSync('git commit -m "Fix site-nav.js encoding that killed the bottom nav."', {
  stdio: "inherit",
});
execSync("git push -u origin HEAD", { stdio: "inherit" });
execSync("git status -sb", { stdio: "inherit" });
