const https = require("https");
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "Cache-Control": "no-cache", Pragma: "no-cache" } }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, d }));
    }).on("error", reject);
  });
}
(async () => {
  const html = await get("https://hand-made.kr/landing.html?t=" + Date.now());
  const build = (html.d.match(/guide-build" content="([^"]+)"/) || [])[1];
  const css = (html.d.match(/landing\.css\?v=([^"]+)/) || [])[1];
  const bm = (html.d.match(/board-meta\.js\?v=([^"]+)/) || [])[1];
  const lb = (html.d.match(/landing-boards\.js\?v=([^"]+)/) || [])[1];
  console.log({ build, css, bm, lb, status: html.status });
  console.log("html has board-detail-body", html.d.includes("board-detail-body"));
  console.log("html has review-view-scroll", html.d.includes("review-view-scroll"));

  const landingCss = await get("https://hand-made.kr/landing.css?v=" + (css || "x") + "&t=" + Date.now());
  console.log("css status", landingCss.status, "len", landingCss.d.length);
  console.log("css 920", landingCss.d.includes("920px"));
  console.log("css z2800", landingCss.d.includes("z-index: 2800"));
  console.log("css clamp", landingCss.d.includes("is-clamped"));
  console.log("css more-btn", landingCss.d.includes("content-more-btn"));
  console.log("css detail-body", landingCss.d.includes("board-detail-body"));

  const meta = await get("https://hand-made.kr/board-meta.js?v=" + (bm || "x") + "&t=" + Date.now());
  console.log("meta setupContentClamp", meta.d.includes("setupContentClamp"));
  console.log("meta label", /자세히보기/.test(meta.d));

  const boards = await get("https://hand-made.kr/landing-boards.js?v=" + (lb || "x") + "&t=" + Date.now());
  console.log("boards setupContentClamp call", boards.d.includes("setupContentClamp"));

  const pages = await get("https://api.github.com/repos/saveasme1/gongbang171_temp/pages");
  // skip auth
})().catch((e) => console.error(e));