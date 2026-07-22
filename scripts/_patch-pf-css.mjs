import fs from "fs";

let css = fs.readFileSync("portfolio-board.css", "utf8");

// Replace toolbar block through pf-write roughly
const toolbarStart = css.indexOf(".pf-toolbar {");
const gridStart = css.indexOf(".pf-grid {");
if (toolbarStart < 0 || gridStart < 0) throw new Error("css anchors missing");

const newToolbar = `.pf-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  margin: 0;
}

.pf-search {
  position: relative;
  display: block;
  flex: 0 1 42%;
  width: min(42%, 200px);
  max-width: 200px;
  min-width: 0;
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
  height: 38px;
  padding: 0 12px 0 34px;
  border: 1px solid var(--pf-line);
  border-radius: 10px;
  background: var(--pf-card);
  color: var(--pf-ink);
  font: 500 13px/1.2 var(--pf-sans);
  outline: none;
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

css = css.slice(0, toolbarStart) + newToolbar + css.slice(gridStart);

// Improve base mobile card readability
css = css.replace(
  `.pf-card-title {
  margin: 10px 4px 0;
  color: var(--pf-ink);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.45;
  letter-spacing: -.02em;`,
  `.pf-card-title {
  margin: 10px 4px 0;
  color: var(--pf-ink);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.45;
  letter-spacing: -.02em;`
);

css = css.replace(
  `.pf-card-meta {
  margin: 5px 4px 0;
  color: var(--pf-muted);
  font-size: 11px;`,
  `.pf-card-meta {
  margin: 5px 4px 0;
  color: var(--pf-muted);
  font-size: 12px;`
);

css = css.replace(
  `.pf-lead {
  margin: 12px auto 0;
  max-width: 34em;
  color: var(--pf-muted);
  font-size: 14px;
  line-height: 1.65;
}`,
  `.pf-lead {
  margin: 12px auto 0;
  max-width: 34em;
  color: var(--pf-muted);
  font-size: 14px;
  line-height: 1.65;
}
@media (max-width: 719px) {
  .pf-hero { padding: 4px 0 0; }
  .pf-brand { font-size: 12px; letter-spacing: .32em; }
  .pf-title { font-size: clamp(30px, 9vw, 40px); margin-top: 8px; }
  .pf-lead { font-size: 13px; margin-top: 8px; }
  .pf-deck { margin-top: 18px; }
  .pf-grid { gap: 20px 12px; margin-top: 14px; }
  .pf-card-title { font-size: 15px; }
  .pf-cat { min-height: 40px; padding: 0 14px; font-size: 12px; }
  .pf-cat-tag { font-size: 11px; padding: 5px 10px; }
  .pf-shots { font-size: 11px; padding: 6px 9px; }
}`
);

// Replace media query section from 720 up
const mq720 = css.indexOf("@media (min-width: 720px)");
if (mq720 < 0) throw new Error("mq720 missing");
const reduce = css.indexOf("@media (prefers-reduced-motion: reduce)");
if (reduce < 0) throw new Error("reduce missing");

css = css.slice(0, mq720) + `@media (min-width: 860px) {
  .pf-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 26px 18px;
  }
  .pf-thumb { border-radius: 20px; }
  .pf-card:nth-child(6n + 1) .pf-thumb,
  .pf-card:nth-child(6n + 4) .pf-thumb {
    aspect-ratio: 1 / 1;
  }
  .pf-card-title { font-size: 15px; }
}

@media (max-width: 560px) {
  .pf-toolbar {
    flex-wrap: wrap;
    row-gap: 8px;
  }
  .pf-search {
    flex: 1 1 auto;
    width: auto;
    max-width: none;
  }
  .pf-tools-actions {
    margin-left: 0;
    width: 100%;
    justify-content: flex-end;
  }
}

@media (min-width: 1200px) {
  .pf-shell { padding-top: 44px; }
  .pf-deck {
    grid-template-columns: 196px minmax(0, 1fr);
    align-items: start;
    gap: 28px;
    margin-top: 34px;
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
  .pf-card:nth-child(10n + 1) {
    grid-column: span 2;
    grid-row: span 2;
  }
  .pf-card:nth-child(10n + 1) .pf-thumb {
    aspect-ratio: 1 / 1;
    border-radius: 24px;
  }
  .pf-card:nth-child(10n + 1) .pf-card-title {
    font-size: 17px;
    margin-top: 14px;
  }
}

` + css.slice(reduce);

fs.writeFileSync("portfolio-board.css", css);
console.log("css ok");