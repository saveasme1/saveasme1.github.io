import fs from "fs";

const path = "site-nav.css";
let css = fs.readFileSync(path, "utf8");
const marker = "/* Paper chrome: portfolio + shipping */";
if (css.includes(marker)) {
  console.log("already patched");
  process.exit(0);
}

const block = [
  "",
  marker,
  "body.gb-chrome-paper {",
  "  --gb-chrome-bg: #ebe7e1;",
  "  --gb-chrome-ink: #161513;",
  "  --gb-chrome-muted: rgba(22, 21, 19, 0.48);",
  "  --gb-chrome-line: rgba(22, 21, 19, 0.1);",
  "  --gb-chrome-accent: #ff8236;",
  "}",
  "body.gb-chrome-paper .gb-top-brand,",
  "body.gb-chrome-paper .gb-top-brand.is-compact {",
  "  background: rgba(235, 231, 225, 0.94);",
  "  border-bottom-color: var(--gb-chrome-line);",
  "}",
  "body.gb-chrome-paper .gb-top-brand__text {",
  "  color: var(--gb-chrome-ink);",
  "}",
  "body.gb-chrome-paper .gb-top-brand__rule {",
  "  background: linear-gradient(90deg, transparent, rgba(255, 130, 54, 0.35) 20%, var(--gb-chrome-accent) 50%, rgba(255, 130, 54, 0.35) 80%, transparent);",
  "}",
  "body.gb-chrome-paper .gb-top-brand__glow {",
  "  background: radial-gradient(circle at 50% 50%, rgba(255, 130, 54, 0.16), transparent 70%);",
  "}",
  "body.gb-chrome-paper .gb-top-auth-btn {",
  "  border-color: rgba(22, 21, 19, 0.16);",
  "  color: rgba(22, 21, 19, 0.78);",
  "}",
  "body.gb-chrome-paper .gb-top-auth-btn:hover,",
  "body.gb-chrome-paper .gb-top-auth-btn:focus-visible {",
  "  border-color: rgba(22, 21, 19, 0.34);",
  "  color: var(--gb-chrome-ink);",
  "}",
  "body.gb-chrome-paper .gb-top-auth-btn.is-accent {",
  "  border-color: rgba(255, 130, 54, 0.55);",
  "  color: var(--gb-chrome-accent);",
  "}",
  "@media (max-width: 1024px) {",
  "  body.gb-chrome-paper .gb-bottom-nav {",
  "    background: rgba(235, 231, 225, 0.96);",
  "    border-top-color: var(--gb-chrome-line);",
  "  }",
  "  body.gb-chrome-paper .gb-bottom-nav__item {",
  "    color: var(--gb-chrome-muted);",
  "  }",
  "  body.gb-chrome-paper .gb-bottom-nav__item.is-active {",
  "    color: var(--gb-chrome-accent);",
  "  }",
  "}",
  "",
].join("\n");

fs.writeFileSync(path, css.trimEnd() + "\n" + block);
console.log("patched site-nav.css");
