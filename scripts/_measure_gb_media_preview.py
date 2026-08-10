# -*- coding: utf-8 -*-
from pathlib import Path
import json
import time
from playwright.sync_api import sync_playwright

ROOT = Path(r"F:/공방171포폴프로젝트/_pwa_push")
LOG = Path(r"F:/#1_zeron_web_develop/makerbridge/.cursor/debug-eef336.log")
JPEG = Path(__file__).with_name("_tiny.jpg")
JPEG.write_bytes(
    bytes.fromhex(
        "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080040004001011100ffc40014000100000000000000000000000000000000ffc40014100100000000000000000000000000000000ffda0008010100003f00fefeffd9"
    )
)


def log(payload):
    payload.setdefault("sessionId", "eef336")
    payload.setdefault("timestamp", int(time.time() * 1000))
    with LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")


def main():
    html = (ROOT / "groupbuy.html").resolve().as_uri()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(html, wait_until="domcontentloaded")
        page.wait_for_timeout(800)
        page.evaluate("() => window.GroupbuyCalendar.openWriter()")
        page.wait_for_timeout(300)
        page.locator('#gbCalWriter input[name="cover"]').set_input_files(str(JPEG))
        page.wait_for_timeout(250)
        page.locator('#gbCalWriter input[name="images"]').set_input_files([str(JPEG), str(JPEG)])
        page.wait_for_timeout(350)
        metrics = page.evaluate(
            """() => {
              const gallery = document.getElementById('gbCalWriterGallery');
              const grid = document.getElementById('gbCalWriterDetailGrid');
              const gr = gallery.getBoundingClientRect();
              const form = document.getElementById('gbCalWriterForm');
              return {
                coverW: Math.round(gr.width),
                coverH: Math.round(gr.height),
                hasImg: Boolean(gallery.querySelector('img')),
                bg: Boolean(gallery.style.backgroundImage && gallery.style.backgroundImage !== 'none'),
                isEmpty: gallery.classList.contains('is-empty'),
                thumbs: grid.querySelectorAll('.pf-writer-thumb').length,
                overflowX: form.scrollWidth > form.clientWidth + 2,
                dlgW: Math.round(document.getElementById('gbCalWriter').getBoundingClientRect().width),
              };
            }"""
        )
        log(
            {
                "runId": "post-fix",
                "hypothesisId": "H6",
                "location": "playwright:gb-media-preview",
                "message": "cover/detail preview after file select",
                "data": metrics,
            }
        )
        print(json.dumps(metrics, ensure_ascii=False, indent=2))
        browser.close()
        ok = (
            metrics["coverW"] <= 160
            and metrics["coverH"] <= 160
            and not metrics["hasImg"]
            and metrics["bg"]
            and metrics["thumbs"] == 2
            and not metrics["overflowX"]
        )
        if not ok:
            raise SystemExit("preview metrics failed: " + json.dumps(metrics))
        print("PASS")


if __name__ == "__main__":
    main()
