const fs = require("fs");
const v = "20260722-mp18";

let bm = fs.readFileSync("board-meta.js", "utf8");
bm = bm.replace(
  /function syncCarouselHeight\(viewport, track, index\) \{[\s\S]*?\n  \}/,
  "function syncCarouselHeight(viewport) {\n    if (!viewport) return;\n    viewport.style.removeProperty(\"height\");\n  }"
);
fs.writeFileSync("board-meta.js", bm);
try { new Function(bm); console.log("meta OK"); } catch (e) { console.log("meta BAD", e.message); process.exit(1); }

const moreBtnCss = [
  ".content-more-btn {",
  "  display: flex;",
  "  align-items: center;",
  "  justify-content: flex-end;",
  "  width: 100%;",
  "  margin: 8px 0 0;",
  "  padding: 0;",
  "  border: 0;",
  "  background: transparent;",
  "  color: #8a8680;",
  "  font-size: 12px;",
  "  font-weight: 650;",
  "  letter-spacing: -.01em;",
  "  text-decoration: underline;",
  "  text-underline-offset: 2px;",
  "  cursor: pointer;",
  "}",
  ".content-more-btn[hidden] { display: none !important; }",
  ".content-more-btn:hover { color: #55514c; }",
].join("\n");

const clampCss = [
  ".html-content.is-clamped {",
  "  display: block;",
  "  max-height: 4.8em;",
  "  overflow: hidden;",
  "  position: relative;",
  "}",
  ".html-content.is-clamped::after {",
  "  content: \"\";",
  "  position: absolute;",
  "  left: 0; right: 0; bottom: 0;",
  "  height: 1.5em;",
  "  background: linear-gradient(180deg, rgba(255,255,255,0), #fff 85%);",
  "  pointer-events: none;",
  "}",
  ".html-content.is-expanded {",
  "  display: block;",
  "  max-height: none;",
  "  overflow: visible;",
  "}",
  ".html-content.is-expanded::after { display: none; }",
].join("\n");

let css = fs.readFileSync("landing.css", "utf8");
css = css.replace(
  /\.board-detail \{[\s\S]*?box-shadow: 0 30px 90px rgba\(0,0,0,\.35\);\r?\n\}/,
  [
    ".board-detail {",
    "  position: relative;",
    "  display: flex;",
    "  flex-direction: column;",
    "  width: min(100%, 920px);",
    "  max-width: calc(100vw - 32px);",
    "  height: min(860px, calc(100dvh - var(--gb-top-h, 48px) - env(safe-area-inset-top, 0px) - 36px));",
    "  max-height: min(860px, calc(100dvh - var(--gb-top-h, 48px) - env(safe-area-inset-top, 0px) - 36px));",
    "  overflow: hidden;",
    "  border-radius: 16px;",
    "  background: #fff;",
    "  color: #171719;",
    "  box-shadow: 0 30px 90px rgba(0,0,0,.35);",
    "}",
  ].join("\n")
);
css = css.replace(
  /\.detail-images \{ background: #111; overflow: hidden; border-radius: 16px 16px 0 0; \}/,
  [
    ".detail-images {",
    "  flex: 0 0 auto;",
    "  height: min(42vh, 380px);",
    "  max-height: 42%;",
    "  background: #111;",
    "  overflow: hidden;",
    "  border-radius: 16px 16px 0 0;",
    "}",
    ".board-carousel, .board-carousel-viewport { width: 100%; height: 100%; overflow: hidden; background: #111; }",
  ].join("\n")
);
css = css.replace(
  /\.board-carousel-track \{\r?\n  display: flex; align-items: flex-start; width: 100%;\r?\n  transition: transform \.28s cubic-bezier\(\.22,1,\.36,1\); will-change: transform;\r?\n\}/,
  ".board-carousel-track {\n  display: flex; align-items: stretch; width: 100%; height: 100%;\n  transition: transform .28s cubic-bezier(.22,1,.36,1); will-change: transform;\n}"
);
css = css.replace(
  /\.board-carousel-slide \{\r?\n  flex: 0 0 100%; width: 100%; min-width: 100%; max-width: 100%;\r?\n  box-sizing: border-box; display: block;\r?\n\}\r?\n\.board-carousel-slide img \{\r?\n  display: block; width: 100%; height: auto; max-width: 100%;\r?\n  object-fit: contain; object-position: center top; background: #111; vertical-align: top;\r?\n\}/,
  [
    ".board-carousel-slide {",
    "  flex: 0 0 100%; width: 100%; min-width: 100%; max-width: 100%;",
    "  box-sizing: border-box; display: grid; place-items: center; height: 100%;",
    "}",
    ".board-carousel-slide img {",
    "  display: block; width: 100%; height: 100%; max-width: 100%; max-height: 100%;",
    "  object-fit: contain; object-position: center center; background: #111;",
    "}",
  ].join("\n")
);
css = css.replace(/\/\* 3-line clamp \+ more \*\/[\s\S]*?\.content-more-btn:hover \{[^}]+\}\r?\n?/, "/* 3-line clamp + more */\n" + clampCss + "\n" + moreBtnCss + "\n");
if (css.includes("background: var(--brand")) {
  css = css.replace(/\.content-more-btn \{[\s\S]*?\.content-more-btn:hover \{[^}]+\}\r?\n?/, moreBtnCss + "\n");
}
fs.writeFileSync("landing.css", css);
console.log("landing ok", css.includes("justify-content: flex-end"), css.includes("height: min(860px"));

let hr = fs.readFileSync("handmade-reviews.css", "utf8");
hr = hr.replace(
  /\.review-view-panel \{[\s\S]*?text-align: left;\r?\n\}/,
  [
    ".review-view-panel {",
    "  position: relative;",
    "  display: flex;",
    "  flex-direction: column;",
    "  width: min(100%, 820px);",
    "  height: min(860px, calc(100dvh - var(--gb-top-h, 48px) - env(safe-area-inset-top, 0px) - 36px));",
    "  max-height: min(860px, calc(100dvh - var(--gb-top-h, 48px) - env(safe-area-inset-top, 0px) - 36px));",
    "  overflow: hidden;",
    "  border-radius: 18px;",
    "  background: #fff;",
    "  color: #1a1714;",
    "  box-shadow: 0 24px 60px rgba(0, 0, 0, .28);",
    "  text-align: left;",
    "}",
  ].join("\n")
);
hr = hr.replace(
  /\.review-view-images \{\r?\n  flex: none;\r?\n  overflow: hidden;\r?\n  background: #111;\r?\n\}/,
  [
    ".review-view-images {",
    "  flex: 0 0 auto;",
    "  height: min(42vh, 380px);",
    "  max-height: 42%;",
    "  overflow: hidden;",
    "  background: #111;",
    "  border-radius: 18px 18px 0 0;",
    "}",
  ].join("\n")
);
hr = hr.replace(
  /\.review-view-images \{\r?\n  flex: 0 0 auto;\r?\n  overflow: hidden;\r?\n  background: #111;\r?\n  border-radius: 18px 18px 0 0;\r?\n\}/,
  [
    ".review-view-images {",
    "  flex: 0 0 auto;",
    "  height: min(42vh, 380px);",
    "  max-height: 42%;",
    "  overflow: hidden;",
    "  background: #111;",
    "  border-radius: 18px 18px 0 0;",
    "}",
  ].join("\n")
);
hr = hr.replace(
  /\.review-carousel-viewport \{\r?\n  overflow: hidden;\r?\n  width: 100%;\r?\n  background: #111;\r?\n\}/,
  ".review-carousel, .review-carousel-viewport { width: 100%; height: 100%; overflow: hidden; background: #111; }"
);
hr = hr.replace(
  /\.review-carousel-track \{\r?\n  display: flex;\r?\n  align-items: flex-start;\r?\n  width: 100%;\r?\n  transition: transform \.28s cubic-bezier\(\.22, 1, \.36, 1\);\r?\n  will-change: transform;\r?\n\}/,
  ".review-carousel-track {\n  display: flex;\n  align-items: stretch;\n  width: 100%;\n  height: 100%;\n  transition: transform .28s cubic-bezier(.22, 1, .36, 1);\n  will-change: transform;\n}"
);
hr = hr.replace(
  /\.review-carousel-slide \{[\s\S]*?object-position: center top;\r?\n  background: #111;\r?\n\}/,
  [
    ".review-carousel-slide {",
    "  flex: 0 0 100%; width: 100%; min-width: 100%; max-width: 100%;",
    "  box-sizing: border-box; display: grid; place-items: center; height: 100%;",
    "}",
    ".review-carousel-slide img {",
    "  display: block; width: 100%; height: 100%; max-width: 100%; max-height: 100%;",
    "  object-fit: contain; object-position: center center; background: #111;",
    "}",
  ].join("\n")
);
hr = hr.replace(/\.content-more-btn,?[\s\S]*?\.content-more-btn\[hidden\] \{ display: none !important; \}/, moreBtnCss);
if (hr.includes("background: #ff8236")) {
  hr = hr.replace(/\.review-view-body \.content-more-btn,\r?\n\.content-more-btn \{[\s\S]*?cursor: pointer;\r?\n\}\r?\n\.content-more-btn\[hidden\] \{ display: none !important; \}/, moreBtnCss);
}
fs.writeFileSync("handmade-reviews.css", hr);
console.log("reviews ok", hr.includes("justify-content: flex-end"), hr.includes("height: min(860px"));

for (const f of ["landing.html", "portfolio.html", "mypage.html", "site-nav.js"]) {
  let t = fs.readFileSync(f, "utf8");
  fs.writeFileSync(f, t.replace(/20260722-mp\d+/g, v));
}
console.log("cache", v);
