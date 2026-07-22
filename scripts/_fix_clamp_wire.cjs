const fs = require("fs");
const path = require("path");
const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const write = (f, t) => fs.writeFileSync(path.join(root, f), t, "utf8");
const LABEL = "\uC790\uC138\uD788\uBCF4\uAE30";
let t = read("board-meta.js");
t = t.replace(/btn\.textContent = "[^"]*";/g, `btn.textContent = "${LABEL}";`);
write("board-meta.js", t);
console.log("labels", t.includes("자세히보기") || /\\uC790/.test(LABEL));

function insertAfter(file, anchor, insert) {
  let s = read(file);
  if (s.includes("setupContentClamp")) { console.log(file, "already"); return; }
  const i = s.indexOf(anchor);
  if (i < 0) {
    console.log(file, "anchor missing");
    const k = s.indexOf("renderSafe");
    console.log(JSON.stringify(s.slice(k, k + 260)));
    return;
  }
  s = s.slice(0, i + anchor.length) + insert + s.slice(i + anchor.length);
  write(file, s);
  console.log(file, "wired");
}
insertAfter("landing-boards.js", "dialog.content.textContent = item.content || \"\";\n    }", "\n    window.GongbangBoardMeta?.setupContentClamp?.(dialog.content);");
insertAfter("portfolio-board.js", "els.content.textContent = safeContent;\n    }", "\n    window.GongbangBoardMeta?.setupContentClamp?.(els.content);");
insertAfter("handmade-reviews.js", "els.viewText.textContent = review.body;\n      }", "\n      window.GongbangBoardMeta?.setupContentClamp?.(els.viewText);");
const v = "20260722-mp15";
for (const f of ["landing.html", "portfolio.html", "mypage.html", "site-nav.js"]) {
  let s = read(f); s = s.replace(/20260722-mp\d+/g, v); write(f, s);
}
console.log("cache", v);