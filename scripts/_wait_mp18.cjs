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
  for (let i = 0; i < 10; i++) {
    let status = "";
    try { status = execSync("gh api repos/saveasme1/gongbang171_temp/pages --jq .status", { encoding: "utf8" }).trim(); } catch {}
    const html = await get("https://hand-made.kr/landing.html?t=" + Date.now());
    const build = (html.match(/guide-build" content="([^"]+)/) || [])[1];
    const ver = (html.match(/landing\.css\?v=([^"]+)/) || [])[1];
    const css = await get("https://hand-made.kr/landing.css?v=" + ver + "&t=" + Date.now());
    const flags = {
      i, status, build, ver,
      rightMore: css.includes("justify-content: flex-end"),
      fixedH: css.includes("height: min(860px"),
      transparentBtn: css.includes("background: transparent"),
      mediaFixed: css.includes("height: min(42vh, 380px)"),
    };
    console.log(flags);
    if (flags.rightMore && flags.fixedH && status === "built") break;
    await new Promise((r) => setTimeout(r, 7000));
  }
})();
