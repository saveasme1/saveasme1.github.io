const fs = require("fs");
const v = "20260722-mp19";

const moTbBlock = `
/* MO/TB detail: taller photo, no empty white under actions */
@media (max-width: 1099px) {
  .board-detail {
    height: calc(100dvh - var(--gb-top-h, 48px) - env(safe-area-inset-top, 0px) - 24px);
    max-height: calc(100dvh - var(--gb-top-h, 48px) - env(safe-area-inset-top, 0px) - 24px);
  }
  .board-detail-body {
    display: flex;
    flex-direction: column;
  }
  .detail-images {
    flex: 1 1 auto;
    height: auto;
    min-height: 52vh;
    max-height: none;
  }
  .detail-copy {
    flex: 0 0 auto !important;
    min-height: 0 !important;
    padding: 16px 16px 18px !important;
  }
  .detail-actions {
    margin-top: 14px !important;
    padding-top: 12px !important;
  }
  .review-view-panel {
    height: calc(100dvh - var(--gb-top-h, 48px) - env(safe-area-inset-top, 0px) - 24px);
    max-height: calc(100dvh - var(--gb-top-h, 48px) - env(safe-area-inset-top, 0px) - 24px);
  }
  .review-view-scroll {
    display: flex;
    flex-direction: column;
  }
  .review-view-images {
    flex: 1 1 auto;
    height: auto;
    min-height: 52vh;
    max-height: none;
  }
  .review-view-body {
    flex: 0 0 auto;
    padding-bottom: 16px;
  }
}
`;

function upsertMediaQuery(file, marker, block) {
  let t = fs.readFileSync(file, "utf8");
  const start = t.indexOf(marker);
  if (start >= 0) {
    // replace from marker to end-ish or next section - simpler: remove old marker block if present
    const endMark = "/* end MO/TB detail */";
    const end = t.indexOf(endMark, start);
    if (end >= 0) t = t.slice(0, start) + t.slice(end + endMark.length);
    else {
      // remove previous inserted media if exact match portion exists
      t = t.replace(/\/\* MO\/TB detail:[\s\S]*?\n\}\n(?=\n|\/\*|$)/, "");
    }
  }
  // also strip older duplicate if any
  t = t.replace(/\/\* MO\/TB detail: taller photo[\s\S]*?\n\}\n/, "");
  t = t.trimEnd() + "\n\n" + block.trim() + "\n/* end MO/TB detail */\n";
  fs.writeFileSync(file, t);
  console.log(file, "media ok");
}

upsertMediaQuery("landing.css", "/* MO/TB detail:", moTbBlock);
upsertMediaQuery("handmade-reviews.css", "/* MO/TB detail:", moTbBlock);

// PC: keep copy from flex-growing empty space too when short content
{
  let t = fs.readFileSync("landing.css", "utf8");
  t = t.replace(
    ".detail-copy { flex: 1 1 auto; min-height: 0; padding: 24px 24px 32px; background: #fff; color: #171719; border-radius: 0 0 16px 16px; }",
    ".detail-copy { flex: 0 0 auto; min-height: 0; padding: 24px 24px 32px; background: #fff; color: #171719; border-radius: 0 0 16px 16px; }"
  );
  // on desktop, images can take remaining space inside body
  if (!t.includes(".board-detail-body {") || !t.includes("display: flex")) {
    t = t.replace(
      ".board-detail-body {\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow-x: hidden;\n  overflow-y: auto;\n  -webkit-overflow-scrolling: touch;\n  border-radius: inherit;\n}",
      [
        ".board-detail-body {",
        "  flex: 1 1 auto;",
        "  min-height: 0;",
        "  display: flex;",
        "  flex-direction: column;",
        "  overflow-x: hidden;",
        "  overflow-y: auto;",
        "  -webkit-overflow-scrolling: touch;",
        "  border-radius: inherit;",
        "}",
        ".detail-images {",
        "  flex: 1 1 auto;",
        "}",
      ].join("\n")
    );
  } else {
    t = t.replace(
      ".board-detail-body {\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow-x: hidden;\n  overflow-y: auto;\n  -webkit-overflow-scrolling: touch;\n  border-radius: inherit;\n}",
      [
        ".board-detail-body {",
        "  flex: 1 1 auto;",
        "  min-height: 0;",
        "  display: flex;",
        "  flex-direction: column;",
        "  overflow-x: hidden;",
        "  overflow-y: auto;",
        "  -webkit-overflow-scrolling: touch;",
        "  border-radius: inherit;",
        "}",
      ].join("\n")
    );
  }
  // bump base image min on all sizes a bit when flexing
  t = t.replace(
    /\.detail-images \{\n  flex: 0 0 auto;\n  height: min\(42vh, 380px\);\n  max-height: 42%;\n  background: #111;\n  overflow: hidden;\n  border-radius: 16px 16px 0 0;\n\}/,
    [
      ".detail-images {",
      "  flex: 1 1 auto;",
      "  height: auto;",
      "  min-height: min(48vh, 420px);",
      "  max-height: none;",
      "  background: #111;",
      "  overflow: hidden;",
      "  border-radius: 16px 16px 0 0;",
      "}",
    ].join("\n")
  );
  fs.writeFileSync("landing.css", t);
  console.log("landing base images flexed");
}

{
  let t = fs.readFileSync("handmade-reviews.css", "utf8");
  t = t.replace(
    /\.review-view-images \{\n  flex: 0 0 auto;\n  height: min\(42vh, 380px\);\n  max-height: 42%;\n  overflow: hidden;\n  background: #111;\n  border-radius: 18px 18px 0 0;\n\}/g,
    [
      ".review-view-images {",
      "  flex: 1 1 auto;",
      "  height: auto;",
      "  min-height: min(48vh, 420px);",
      "  max-height: none;",
      "  overflow: hidden;",
      "  background: #111;",
      "  border-radius: 18px 18px 0 0;",
      "}",
    ].join("\n")
  );
  if (!t.includes(".review-view-scroll {\n  flex: 1 1 auto;\n  min-height: 0;\n  display: flex;")) {
    t = t.replace(
      ".review-view-scroll {\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow-x: hidden;\n  overflow-y: auto;\n  -webkit-overflow-scrolling: touch;\n  border-radius: inherit;\n}",
      [
        ".review-view-scroll {",
        "  flex: 1 1 auto;",
        "  min-height: 0;",
        "  display: flex;",
        "  flex-direction: column;",
        "  overflow-x: hidden;",
        "  overflow-y: auto;",
        "  -webkit-overflow-scrolling: touch;",
        "  border-radius: inherit;",
        "}",
      ].join("\n")
    );
  }
  fs.writeFileSync("handmade-reviews.css", t);
  console.log("reviews images flexed");
}

for (const f of ["landing.html", "portfolio.html", "mypage.html", "site-nav.js"]) {
  let t = fs.readFileSync(f, "utf8");
  fs.writeFileSync(f, t.replace(/20260722-mp\d+/g, v));
}
console.log("cache", v);
