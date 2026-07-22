import fs from "fs";

let html = fs.readFileSync("portfolio.html", "utf8");
html = html.replaceAll("20260722-portfolio7", "20260722-portfolio8");
if (!html.includes("site-nav.css")) {
  html = html.replace(
    '<link rel="stylesheet" href="portfolio-board.css?v=20260722-portfolio8">',
    '<link rel="stylesheet" href="portfolio-board.css?v=20260722-portfolio8">\n  <link rel="stylesheet" href="site-nav.css?v=20260722-mp5">'
  );
}
if (!html.includes("site-nav.js")) {
  html = html.replace(
    '<script src="portfolio-board.js?v=20260722-portfolio8"></script>',
    '<script src="portfolio-board.js?v=20260722-portfolio8"></script>\n  <script src="site-nav.js?v=20260722-mp5"></script>'
  );
}
if (!html.includes("pf-rail-home")) {
  html = html.replace(
    /<div class="pf-rail-head">[\s\S]*?<\/div>/,
    '<div class="pf-rail-head">\n          <div class="pf-rail-head-copy">\n            <span class="pf-rail-kicker">Collection</span>\n            <strong class="pf-rail-count" id="pfCount">—</strong>\n          </div>\n          <a class="pf-rail-home" href="/landing.html" aria-label="HERITAGE home">HERITAGE</a>\n        </div>'
  );
}
fs.writeFileSync("portfolio.html", html);
console.log("html", html.includes("pf-rail-home"), html.includes("site-nav.js"));
