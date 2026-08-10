# Direct 1:1 screenshot only. Never stretch. Never cover-crop.
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

SRC = Path(r"F:\공방171포폴프로젝트\_pwa_push\posters\banner\src")
OUT = Path(r"F:\공방171포폴프로젝트\_pwa_push\posters\banner")

JOBS = [
    ("account", 1000, 1500),
    ("care", 1000, 1000),
    ("delivery", 1000, 1000),
]


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for name, tw, th in JOBS:
            page = browser.new_page(
                viewport={"width": tw, "height": th},
                device_scale_factor=1,
            )
            page.goto((SRC / f"{name}.html").as_uri(), wait_until="networkidle")
            page.evaluate("() => document.fonts && document.fonts.ready")
            page.wait_for_timeout(500)

            out = OUT / f"{name}.png"
            page.locator("#banner").screenshot(path=str(out), type="png")
            img = Image.open(out)
            w, h = img.size
            img.close()
            if (w, h) != (tw, th):
                raise SystemExit(f"{name}: got {w}x{h}, expected {tw}x{th}")
            print(f"ok {name}.png {w}x{h} 1:1 capture")
            page.close()
        browser.close()


if __name__ == "__main__":
    main()
