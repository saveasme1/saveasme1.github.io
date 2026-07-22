import fs from "fs";
let css = fs.readFileSync("portfolio-board.css", "utf8").replace(/\r\n/g, "\n");

css = css.replace(
  /\.pf-rail-head \{[\s\S]*?\n\}/,
  `.pf-rail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 4px 10px;
}
.pf-rail-head-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.pf-rail-home {
  flex: 0 0 auto;
  align-self: center;
  color: var(--pf-accent);
  font-family: SUIT, Pretendard, sans-serif;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .28em;
  text-decoration: none;
  line-height: 1;
  padding: 8px 2px;
  text-indent: .14em;
}
.pf-rail-home:hover {
  color: var(--pf-ink);
}`
);

css = css.replace(
  /\.pf-search \{[\s\S]*?max-width: 200px;\n\}/,
  `.pf-search {
  position: relative;
  display: block;
  flex: 1 1 auto;
  width: auto;
  min-width: 0;
  max-width: none;
}`
);

css = css.replace(/\s*\.pf-search \{\n\s*max-width: min\(46vw, 168px\);\n\s*flex: 1 1 46%;\n\s*\}\n/g, "\n");
css = css.replace(/\s*\.pf-search \{\n\s*max-width: 200px;\n\s*flex: 0 1 200px;\n\s*\}\n/g, "\n");
css = css.replace(/\s*\.pf-search \{\n\s*max-width: 220px;\n\s*flex: 0 1 220px;\n\s*\}\n/g, "\n");

css = css.replace(
  /\.pf-rail-head \{\n\s*flex-direction: column;\n\s*align-items: flex-start;\n\s*gap: 4px;\n\s*padding: 0 2px 14px;\n\s*border-bottom: 1px solid var\(--pf-line\);\n\s*margin-bottom: 12px;\n\s*\}/,
  `.pf-rail-head {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 0 2px 14px;
    border-bottom: 1px solid var(--pf-line);
    margin-bottom: 12px;
  }
  .pf-rail-head-copy {
    gap: 4px;
  }`
);

if (!css.includes("body.pf-body.has-gb-bottom-nav")) {
  css += `

body.pf-body.has-gb-top-brand .pf-shell {
  padding-top: max(20px, env(safe-area-inset-top));
}
body.pf-body.has-gb-bottom-nav .pf-shell {
  padding-bottom: max(88px, calc(72px + env(safe-area-inset-bottom)));
}
`;
}

fs.writeFileSync("portfolio-board.css", css.replace(/\n/g, "\r\n"));
console.log("css", css.includes("max-width: none"), css.includes("pf-rail-home"));
