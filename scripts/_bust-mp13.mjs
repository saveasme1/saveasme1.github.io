import fs from "fs";

const v = "20260722-mp13";
for (const f of ["landing.html", "portfolio.html", "mypage.html", "site-nav.js"]) {
  let t = fs.readFileSync(f, "utf8");
  t = t.replace(/20260722-mp\d+/g, v);
  fs.writeFileSync(f, t);
}
console.log("bumped to", v);
