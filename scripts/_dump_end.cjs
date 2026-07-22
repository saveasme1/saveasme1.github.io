const fs = require("fs");
const bm = fs.readFileSync("board-meta.js", "utf8");
console.log("TAIL:", JSON.stringify(bm.slice(-80)));
try { new Function(bm); console.log("board-meta syntax OK"); }
catch (e) { console.log("board-meta SYNTAX ERROR:", e.message); }

const html = fs.readFileSync("landing.html", "utf8");
const i = html.indexOf('id="boardDialog"');
console.log(html.slice(i, i + 800));
console.log("\n--- review ---");
const j = html.indexOf('id="reviewView"');
console.log(html.slice(j, j + 700));

// live meta tail
const https = require("https");
https.get("https://hand-made.kr/board-meta.js?v=20260722-mp16&t=" + Date.now(), (res) => {
  let d = "";
  res.on("data", (c) => (d += c));
  res.on("end", () => {
    console.log("\nLIVE TAIL:", JSON.stringify(d.slice(-80)));
    try { new Function(d); console.log("live syntax OK"); }
    catch (e) { console.log("live SYNTAX ERROR:", e.message); }
  });
});