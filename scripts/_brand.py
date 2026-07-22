from pathlib import Path
p = Path("portfolio.html")
t = p.read_text(encoding="utf-8")
old = 'class="pf-rail-home"'
new = 'class="pf-rail-home brand-link"'
if old in t:
    p.write_text(t.replace(old, new, 1), encoding="utf-8")
    print("added")
else:
    print("skip", "brand-link" in t)
