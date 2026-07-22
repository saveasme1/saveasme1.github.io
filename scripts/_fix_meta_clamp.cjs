const fs = require("fs");

let bm = fs.readFileSync("board-meta.js", "utf8");
// fix broken closing
bm = bm.replace(/\u2019\}\)\(\);/g, "})();"); // fancy quote
bm = bm.replace(/'\}\)\(\);/g, "})();");
bm = bm.replace(/"\}\)\(\);/g, "})();");
if (bm.trimEnd().endsWith("'})();")) {
  bm = bm.replace(/'\}\)\(\);\s*$/, "})();\n");
}
// replace setupContentClamp with hardened version
const start = bm.indexOf("function setupContentClamp");
const end = bm.indexOf("window.GongbangBoardMeta");
if (start < 0 || end < 0) throw new Error("clamp block not found");

const hardened = `function setupContentClamp(contentEl) {
    if (!contentEl) return;
    const parent = contentEl.parentElement;
    if (!parent) return;

    let btn = parent.querySelector(".content-more-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "content-more-btn";
      contentEl.insertAdjacentElement("afterend", btn);
    }
    btn.textContent = "\\uC790\\uC138\\uD788\\uBCF4\\uAE30";
    btn.hidden = true;
    btn.onclick = null;

    contentEl.classList.remove("is-expanded");
    contentEl.classList.remove("is-clamped");

    const apply = () => {
      contentEl.classList.remove("is-expanded");
      contentEl.classList.add("is-clamped");
      // Force layout, then compare full scroll size vs visible box.
      const visible = contentEl.getBoundingClientRect().height;
      const full = contentEl.scrollHeight;
      const needs = full > visible + 4;
      if (needs) {
        btn.hidden = false;
        btn.onclick = () => {
          contentEl.classList.remove("is-clamped");
          contentEl.classList.add("is-expanded");
          btn.hidden = true;
        };
      } else {
        contentEl.classList.remove("is-clamped");
        btn.hidden = true;
      }
    };

    // Wait for images/fonts inside html content.
    const imgs = Array.from(contentEl.querySelectorAll("img"));
    let pending = imgs.filter((img) => !img.complete).length;
    const run = () => requestAnimationFrame(() => requestAnimationFrame(apply));
    if (!pending) run();
    else {
      imgs.forEach((img) => {
        if (img.complete) return;
        const done = () => {
          pending -= 1;
          if (pending <= 0) run();
        };
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
      // safety timeout
      setTimeout(run, 400);
    }
  }

  `;

bm = bm.slice(0, start) + hardened + bm.slice(end);
// ensure proper close
bm = bm.replace(/window\.GongbangBoardMeta = \{[\s\S]*?\};\s*['"]?\}\)\(\);/, (block) => {
  return `window.GongbangBoardMeta = {
    KAKAO_URL,
    formatViews,
    fetchViews,
    bumpView,
    renderMetaRow,
    syncCarouselHeight,
    setupContentClamp,
  };
})();`;
});

fs.writeFileSync("board-meta.js", bm);
try {
  new Function(bm);
  console.log("syntax OK");
} catch (e) {
  console.log("still bad:", e.message);
  console.log(JSON.stringify(bm.slice(-120)));
}

// strengthen CSS clamp - use em based clip that works with nested blocks
let css = fs.readFileSync("landing.css", "utf8");
css = css.replace(
  /\.html-content\.is-clamped \{[\s\S]*?\}\n\.html-content\.is-expanded \{[\s\S]*?\}/,
  `.html-content.is-clamped {
  display: block;
  max-height: 4.8em;
  overflow: hidden;
  position: relative;
}
.html-content.is-clamped::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1.6em;
  background: linear-gradient(180deg, rgba(255,255,255,0), #fff 90%);
  pointer-events: none;
}
.html-content.is-expanded {
  display: block;
  max-height: none;
  overflow: visible;
}
.html-content.is-expanded::after { display: none; }`
);
fs.writeFileSync("landing.css", css);

let hr = fs.readFileSync("handmade-reviews.css", "utf8");
if (hr.includes(".html-content.is-clamped")) {
  hr = hr.replace(
    /\.review-view-text\.html-content\.is-clamped,[\s\S]*?\.html-content\.is-expanded \{[\s\S]*?\}/,
    `.review-view-text.html-content.is-clamped,
.html-content.is-clamped {
  display: block;
  max-height: 4.8em;
  overflow: hidden;
  position: relative;
}
.review-view-text.html-content.is-clamped::after,
.html-content.is-clamped::after {
  content: "";
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 1.6em;
  background: linear-gradient(180deg, rgba(255,255,255,0), #fff 90%);
  pointer-events: none;
}
.review-view-text.html-content.is-expanded,
.html-content.is-expanded {
  display: block;
  max-height: none;
  overflow: visible;
}`
  );
  fs.writeFileSync("handmade-reviews.css", hr);
}

// bump cache
const v = "20260722-mp17";
for (const f of ["landing.html", "portfolio.html", "mypage.html", "site-nav.js"]) {
  let t = fs.readFileSync(f, "utf8");
  t = t.replace(/20260722-mp\\d+/g, v);
  // fix regex - in JS string
  t = t.replace(/20260722-mp\d+/g, v);
  fs.writeFileSync(f, t);
}
console.log("bumped", v);
console.log("label check", bm.includes("자세히보기") || bm.includes("\\uC790"));