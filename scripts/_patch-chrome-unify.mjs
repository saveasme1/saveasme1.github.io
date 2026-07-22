import fs from "fs";

function replaceOnce(src, from, to, label) {
  if (!src.includes(from)) {
    if (src.includes(to.trim().slice(0, 40))) {
      console.log("skip", label);
      return src;
    }
    throw new Error("missing: " + label);
  }
  return src.replace(from, to);
}

// --- site-nav.css: unify scroll opacity + paper chrome ---
let css = fs.readFileSync("site-nav.css", "utf8");

css = css.replace(
  /\.gb-top-brand\.is-scrolling \{\s*opacity: \.9;\s*\}/,
  ".gb-top-brand.is-scrolling {\n  opacity: .78;\n}"
);

css = css.replace(
  /\.gb-bottom-nav\.is-scrolling \{\s*opacity: \.5;\s*\}/,
  "  .gb-bottom-nav.is-scrolling {\n    opacity: .78;\n  }"
);

const oldPaperStart = "/* Paper chrome: portfolio + shipping */";
const idx = css.indexOf(oldPaperStart);
if (idx === -1) throw new Error("paper block missing");
css = css.slice(0, idx) + `/* Paper chrome: portfolio + shipping */
body.gb-chrome-paper {
  --gb-chrome-bg: #f7f5f2;
  --gb-chrome-ink: #161513;
  --gb-chrome-muted: rgba(22, 21, 19, 0.48);
  --gb-chrome-line: rgba(22, 21, 19, 0.1);
  --gb-chrome-accent: #ff8236;
  --gb-chrome-fill: rgba(247, 245, 242, 0.94);
}
body.gb-chrome-paper .gb-top-brand,
body.gb-chrome-paper .gb-top-brand.is-compact {
  background: var(--gb-chrome-fill);
  border-bottom-color: var(--gb-chrome-line);
  backdrop-filter: blur(14px) saturate(1.15);
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
}
body.gb-chrome-paper .gb-top-brand__text {
  color: var(--gb-chrome-ink);
}
body.gb-chrome-paper .gb-top-brand__rule {
  background: linear-gradient(90deg, transparent, rgba(255, 130, 54, 0.35) 20%, var(--gb-chrome-accent) 50%, rgba(255, 130, 54, 0.35) 80%, transparent);
}
body.gb-chrome-paper .gb-top-brand__glow {
  background: radial-gradient(circle at 50% 50%, rgba(255, 130, 54, 0.16), transparent 70%);
}
body.gb-chrome-paper .gb-top-auth-btn {
  border-color: rgba(22, 21, 19, 0.16);
  color: rgba(22, 21, 19, 0.78);
}
body.gb-chrome-paper .gb-top-auth-btn:hover,
body.gb-chrome-paper .gb-top-auth-btn:focus-visible {
  border-color: rgba(22, 21, 19, 0.34);
  color: var(--gb-chrome-ink);
}
body.gb-chrome-paper .gb-top-auth-btn.is-accent {
  border-color: rgba(255, 130, 54, 0.55);
  color: var(--gb-chrome-accent);
}
body.gb-chrome-paper .pf-rail,
body.gb-chrome-paper .portfolio-inline .pf-rail {
  background: var(--gb-chrome-fill) !important;
  border-bottom-color: var(--gb-chrome-line) !important;
  backdrop-filter: blur(14px) saturate(1.15) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.15) !important;
  transition: opacity .18s ease;
}
body.gb-chrome-paper .pf-rail.is-scrolling,
body.gb-chrome-paper .gb-top-brand.is-scrolling,
body.gb-chrome-paper .gb-bottom-nav.is-scrolling {
  opacity: .78;
}
@media (max-width: 1024px) {
  body.gb-chrome-paper .gb-bottom-nav {
    background: var(--gb-chrome-fill);
    border-top-color: var(--gb-chrome-line);
    backdrop-filter: blur(14px) saturate(1.15);
    -webkit-backdrop-filter: blur(14px) saturate(1.15);
  }
  body.gb-chrome-paper .gb-bottom-nav__item {
    color: var(--gb-chrome-muted);
  }
  body.gb-chrome-paper .gb-bottom-nav__item.is-active {
    color: var(--gb-chrome-accent);
  }
}
@media (min-width: 1100px) {
  body.gb-chrome-paper .portfolio-inline .pf-rail,
  body.gb-chrome-paper.pf-body .pf-rail {
    background: var(--gb-chrome-fill) !important;
    border-color: var(--gb-chrome-line) !important;
  }
}
`;

fs.writeFileSync("site-nav.css", css);
console.log("site-nav.css ok");

// bust landing + portfolio
for (const f of ["landing.html", "portfolio.html"]) {
  let t = fs.readFileSync(f, "utf8");
  t = t.replace(/20260722-mp\d+/g, "20260722-mp24");
  fs.writeFileSync(f, t);
  console.log(f, "mp24");
}
