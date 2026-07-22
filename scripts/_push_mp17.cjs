const fs = require("fs");
const { execSync } = require("child_process");
const t = fs.readFileSync("board-meta.js", "utf8");
try { new Function(t); console.log("syntax OK"); } catch (e) { console.log("BAD", e.message); process.exit(1); }
console.log("tail", JSON.stringify(t.slice(-40)));
execSync("git add board-meta.js landing.css handmade-reviews.css landing.html portfolio.html mypage.html site-nav.js", { stdio: "inherit" });
execSync('git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "Fix board-meta syntax error blocking detail clamp."', { stdio: "inherit" });
execSync("git push origin HEAD", { stdio: "inherit" });
execSync("git log -1 --oneline", { stdio: "inherit" });