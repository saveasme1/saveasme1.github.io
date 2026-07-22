const https = require("https");
const { execSync } = require("child_process");
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "Cache-Control": "no-cache" } }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve(d));
    }).on("error", reject);
  });
}
(async () => {
  for (let i = 0; i < 12; i++) {
    let status = "unknown";
    try {
      status = execSync("gh api repos/saveasme1/gongbang171_temp/pages --jq .status", { encoding: "utf8" }).trim();
    } catch {}
    const html = await get("https://hand-made.kr/landing.html?t=" + Date.now());
    const build = (html.match(/guide-build" content="([^"]+)"/) || [])[1];
    const ver = (html.match(/board-meta\.js\?v=([^"]+)/) || [])[1] || "x";
    const meta = await get("https://hand-made.kr/board-meta.js?v=" + ver + "&t=" + Date.now());
    let ok = false;
    let err = "";
    try { new Function(meta); ok = true; } catch (e) { err = e.message; }
    console.log({ i, status, build, ver, metaOk: ok, err, tail: JSON.stringify(meta.slice(-35)) });
    if (ok && String(build || "").includes("mp17")) break;
    await new Promise((r) => setTimeout(r, 7000));
  }
})();