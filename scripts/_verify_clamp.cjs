const fs = require("fs");
const t = fs.readFileSync("board-meta.js", "utf8");
const m = t.match(/btn\.textContent = "([^"]+)"/);
console.log("label", m && m[1]);
for (const f of ["landing-boards.js", "portfolio-board.js", "handmade-reviews.js"]) {
  console.log(f, fs.readFileSync(f, "utf8").includes("setupContentClamp"));
}
const l = fs.readFileSync("landing.css", "utf8");
console.log({
  body: l.includes("board-detail-body"),
  more: l.includes("content-more-btn"),
  w920: l.includes("920px"),
  z: l.includes("z-index: 2800"),
  clamp: l.includes("is-clamped"),
});
const h = fs.readFileSync("landing.html", "utf8");
console.log("html", {
  body: h.includes("board-detail-body"),
  scroll: h.includes("review-view-scroll"),
  mp15: h.includes("mp15"),
});