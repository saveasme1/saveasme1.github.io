from pathlib import Path

html_path = Path("portfolio.html")
css_path = Path("portfolio-board.css")

html = html_path.read_text(encoding="utf-8")
html = html.replace("20260722-portfolio8", "20260722-portfolio9")
html = html.replace(
    """          <a class="pf-rail-home brand-link" href="/landing.html" aria-label="HERITAGE home">HERITAGE</a>\n""",
    "",
)
# also without trailing newline variants
html = html.replace(
    '<a class="pf-rail-home brand-link" href="/landing.html" aria-label="HERITAGE home">HERITAGE</a>',
    "",
)
# simplify rail-head back if copy wrapper alone is fine
html_path.write_text(html, encoding="utf-8")

css = css_path.read_text(encoding="utf-8").replace("\r\n", "\n")

# Base mobile rail: stick below global top brand, not over content wrongly
css = css.replace(
    """.pf-rail {
  position: sticky;
  top: 0;
  z-index: 24;
  margin: 0 -4px;
  padding: 10px 4px 12px;
  background: rgba(247, 245, 242, 0.92);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--pf-line);
}""",
    """.pf-rail {
  position: sticky;
  top: calc(48px + env(safe-area-inset-top, 0px));
  z-index: 20;
  margin: 0;
  padding: 10px 0 12px;
  background: rgba(247, 245, 242, 0.96);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--pf-line);
}""",
)

# Remove rail-home styles
import re
css = re.sub(r"\n\.pf-rail-home \{[\s\S]*?\n\}\n\.pf-rail-home:hover \{\n  color: var\(--pf-ink\);\n\}\n", "\n", css)

# Desktop: no sticky toolbar; rail sticky clears top brand
css = css.replace(
    """.pf-rail {
    position: sticky;
    top: 18px;
    margin: 0;
    padding: 18px 14px;
    border: 1px solid var(--pf-line);
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.72);
    box-shadow: 0 10px 30px rgba(22, 21, 19, 0.04);
  }""",
    """.pf-rail {
    position: sticky;
    top: calc(56px + env(safe-area-inset-top, 0px));
    margin: 0;
    padding: 18px 14px;
    border: 1px solid var(--pf-line);
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 10px 30px rgba(22, 21, 19, 0.04);
  }""",
)

css = css.replace(
    """.pf-stage .pf-toolbar {
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
  }""",
    """.pf-stage .pf-toolbar {
    position: relative;
    top: auto;
    z-index: 1;
    margin: 0 0 8px;
    padding: 12px;
    border: 1px solid var(--pf-line);
    border-radius: 18px;
    background: #fff;
  }""",
)

# Fix shell top padding under global brand so hero/search aren't under it
css = css.replace(
    """body.pf-body.has-gb-top-brand .pf-shell {
  padding-top: max(20px, env(safe-area-inset-top));
}""",
    """body.pf-body.has-gb-top-brand .pf-shell {
  padding-top: 12px;
}
body.pf-body.has-gb-top-brand .pf-rail {
  top: calc(48px + env(safe-area-inset-top, 0px));
}
@media (min-width: 1100px) {
  body.pf-body.has-gb-top-brand .pf-rail {
    top: calc(56px + env(safe-area-inset-top, 0px));
  }
}""",
)

css_path.write_text(css.replace("\n", "\r\n"), encoding="utf-8")

print({
    "home_gone": "pf-rail-home" not in html_path.read_text(encoding="utf-8"),
    "v9": "portfolio9" in html_path.read_text(encoding="utf-8"),
    "sticky_toolbar": "pf-stage .pf-toolbar" in css and "position: sticky" not in css[css.find(".pf-stage .pf-toolbar"):css.find(".pf-stage .pf-toolbar")+200],
})
