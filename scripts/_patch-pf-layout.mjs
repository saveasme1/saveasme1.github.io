import fs from "fs";

// --- HTML ---
let html = fs.readFileSync("portfolio.html", "utf8");
html = html.replaceAll("20260722-portfolio6", "20260722-portfolio7");
html = html.replace(
  /placeholder="[^"]*"/,
  'placeholder="제품 브랜드 검색"'
);
html = html.replace(
  /aria-label="포트폴리오 검색"/,
  'aria-label="제품 브랜드 검색"'
);
fs.writeFileSync("portfolio.html", html);

// --- CSS: harden body/shell, grid, pager, toolbar ---
let css = fs.readFileSync("portfolio-board.css", "utf8").replace(/\r\n/g, "\n");

// Ensure body clips horizontal overflow
if (!css.includes("overflow-x: clip") && !css.includes("overflow-x: hidden")) {
  css = css.replace(
    `.pf-body {
  margin: 0;
  min-height: 100vh;
  color: var(--pf-ink);
  background: var(--pf-paper);
  font-family: var(--pf-sans);
  -webkit-font-smoothing: antialiased;
  word-break: keep-all;
}`,
    `.pf-body {
  margin: 0;
  min-height: 100vh;
  color: var(--pf-ink);
  background: var(--pf-paper);
  font-family: var(--pf-sans);
  -webkit-font-smoothing: antialiased;
  word-break: keep-all;
  overflow-x: hidden;
}`
  );
}

// Replace from .pf-toolbar through .pf-grid block start tooling — do targeted replacements

css = css.replace(/\.pf-toolbar \{[\s\S]*?\.pf-toast\.is-error \{[^}]+\}\n\n/, `@REPLACE_TOOLBAR@`);

const toolbar = `.pf-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin: 0;
  box-sizing: border-box;
}

.pf-search {
  position: relative;
  display: block;
  flex: 1 1 auto;
  width: auto;
  min-width: 0;
  max-width: 200px;
}
.pf-search-ico {
  position: absolute;
  left: 11px;
  top: 50%;
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--pf-muted);
  border-radius: 50%;
  transform: translateY(-58%);
  pointer-events: none;
}
.pf-search-ico::after {
  content: "";
  position: absolute;
  right: -4px;
  bottom: -3px;
  width: 6px;
  height: 1.5px;
  background: var(--pf-muted);
  transform: rotate(40deg);
  transform-origin: left center;
}
.pf-search input {
  width: 100%;
  max-width: 100%;
  height: 38px;
  padding: 0 12px 0 34px;
  border: 1px solid var(--pf-line);
  border-radius: 10px;
  background: var(--pf-card);
  color: var(--pf-ink);
  font: 500 13px/1.2 var(--pf-sans);
  outline: none;
  box-sizing: border-box;
  transition: border-color .2s ease, box-shadow .2s ease;
}
.pf-search input::placeholder { color: #a39e96; }
.pf-search input:focus {
  border-color: rgba(255, 130, 54, 0.45);
  box-shadow: 0 0 0 3px rgba(255, 130, 54, 0.12);
}

.pf-tools-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex: 0 0 auto;
  min-width: 0;
  margin-left: auto;
}

.pf-status {
  margin: 10px 2px 0;
  color: var(--pf-muted);
  font-size: 12px;
  letter-spacing: -.01em;
}

.pf-write,
.pf-tools-actions .primary {
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid var(--pf-ink);
  border-radius: 10px;
  background: var(--pf-ink);
  color: #fff;
  font: 700 12px/1 Pretendard, sans-serif;
  cursor: pointer;
  white-space: nowrap;
}

.pf-body .review-session > button {
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid #dedee2;
  border-radius: 10px;
  background: #fff;
  color: #333;
  font: 700 12px/1 Pretendard, sans-serif;
  cursor: pointer;
  white-space: nowrap;
}

.pf-toast {
  position: fixed;
  left: 50%;
  bottom: max(24px, env(safe-area-inset-bottom));
  z-index: 80;
  transform: translateX(-50%);
  max-width: min(90vw, 360px);
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(22, 21, 19, 0.92);
  color: #fff;
  font: 650 13px/1.4 var(--pf-sans);
  box-shadow: 0 12px 30px rgba(0,0,0,.22);
  opacity: 0;
  pointer-events: none;
  transition: opacity .2s ease, transform .2s ease;
}
.pf-toast.is-on {
  opacity: 1;
  transform: translateX(-50%) translateY(-4px);
}
.pf-toast.is-error { background: rgba(150, 40, 30, 0.95); }

`;

if (!css.includes("@REPLACE_TOOLBAR@")) {
  // fallback: replace by anchors
  const a = css.indexOf(".pf-toolbar {");
  const b = css.indexOf(".pf-grid {");
  if (a < 0 || b < 0) throw new Error("toolbar/grid anchors missing");
  css = css.slice(0, a) + toolbar + css.slice(b);
} else {
  css = css.replace("@REPLACE_TOOLBAR@", toolbar);
}

// Force grid + pager rules
css = css.replace(
  /\.pf-grid \{[\s\S]*?margin-top: 8px;\n\}/,
  `.pf-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 10px;
  margin-top: 12px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}`
);

css = css.replace(
  /\.pf-pager \{\n  margin-top: 28px;\n\}/,
  `.pf-pager,
.pf-body .reviews-pager.pf-pager {
  display: flex !important;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center !important;
  width: 100%;
  max-width: 100%;
  margin: 28px auto 0;
  padding: 0;
  gap: 6px;
  box-sizing: border-box;
}
.pf-body .reviews-pager.pf-pager button {
  flex: 0 0 auto;
}`
);

// Replace ALL media query section from 860px onward (before reduced motion)
const mqStart = css.indexOf("@media (min-width: 860px)");
const reduce = css.indexOf("@media (prefers-reduced-motion: reduce)");
if (mqStart < 0 || reduce < 0) throw new Error("media anchors missing");

css = css.slice(0, mqStart) + `
/* Mobile default: 2 columns — already set above */

@media (max-width: 719px) {
  .pf-shell {
    padding-left: max(12px, env(safe-area-inset-left));
    padding-right: max(12px, env(safe-area-inset-right));
  }
  .pf-deck,
  .pf-stage,
  .pf-rail {
    min-width: 0;
    max-width: 100%;
  }
  .pf-rail {
    margin: 0;
  }
  .pf-search {
    max-width: min(46vw, 168px);
    flex: 1 1 46%;
  }
  .pf-write,
  .pf-tools-actions .primary,
  .pf-body .review-session > button {
    min-height: 36px;
    padding: 0 10px;
    font-size: 11px;
  }
  .pf-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 14px 8px;
  }
  .pf-card {
    grid-column: auto !important;
    grid-row: auto !important;
  }
  .pf-card-title { font-size: 13px; }
}

/* Tablet: 3 columns */
@media (min-width: 720px) and (max-width: 1099px) {
  .pf-search {
    max-width: 200px;
    flex: 0 1 200px;
  }
  .pf-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: 22px 14px;
  }
  .pf-card {
    grid-column: auto !important;
    grid-row: auto !important;
  }
  .pf-thumb { border-radius: 18px; }
  .pf-card-title { font-size: 14px; }
}

/* Desktop: 4 columns + optional featured */
@media (min-width: 1100px) {
  .pf-shell { padding-top: 44px; }
  .pf-search {
    max-width: 220px;
    flex: 0 1 220px;
  }
  .pf-deck {
    grid-template-columns: 196px minmax(0, 1fr);
    align-items: start;
    gap: 28px;
    margin-top: 34px;
    min-width: 0;
  }
  .pf-rail {
    position: sticky;
    top: 18px;
    margin: 0;
    padding: 18px 14px;
    border: 1px solid var(--pf-line);
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.72);
    box-shadow: 0 10px 30px rgba(22, 21, 19, 0.04);
  }
  .pf-rail-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 0 2px 14px;
    border-bottom: 1px solid var(--pf-line);
    margin-bottom: 12px;
  }
  .pf-cats {
    flex-direction: column;
    overflow: visible;
    gap: 6px;
    scroll-snap-type: none;
  }
  .pf-cat {
    width: 100%;
    justify-content: flex-start;
    border-radius: 12px;
    text-align: left;
    letter-spacing: .1em;
  }
  .pf-stage {
    min-width: 0;
    max-width: 100%;
  }
  .pf-stage .pf-toolbar {
    position: sticky;
    top: 18px;
    z-index: 18;
    margin: 0 0 4px;
    padding: 12px;
    border: 1px solid var(--pf-line);
    border-radius: 18px;
    background: rgba(247, 245, 242, 0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  .pf-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 30px 20px;
    margin-top: 18px;
  }
}

` + css.slice(reduce);

fs.writeFileSync("portfolio-board.css", css.replace(/\n/g, "\r\n"));

// --- JS: ensure PAGE_SIZE 12 ---
let js = fs.readFileSync("portfolio-board.js", "utf8");
js = js.replace(/const PAGE_SIZE = \d+;/, "const PAGE_SIZE = 12;");
fs.writeFileSync("portfolio-board.js", js);

console.log("ok", {
  ph: html.includes("제품 브랜드 검색"),
  v7: html.includes("portfolio7"),
  page: /PAGE_SIZE = 12/.test(js),
  center: css.includes("justify-content: center !important"),
});