# -*- coding: utf-8 -*-
from pathlib import Path
import json
import time
from playwright.sync_api import sync_playwright

ROOT = Path(r"F:/공방171포폴프로젝트/_pwa_push")
LOG = Path(r"F:/#1_zeron_web_develop/makerbridge/.cursor/debug-eef336.log")
html = (ROOT / "groupbuy.html").resolve().as_uri()

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={"width": 1440, "height": 900})
    page.goto(html, wait_until="domcontentloaded")
    page.wait_for_timeout(800)
    m = page.evaluate(
        """() => {
          const root = document.createElement('div');
          root.className = 'gb-cal-sheet';
          root.innerHTML = '<div class="gb-cal-sheet__card board-detail"></div>';
          document.body.appendChild(root);
          const card = root.querySelector('.gb-cal-sheet__card');
          const r = card.getBoundingClientRect();
          const cs = getComputedStyle(card);
          return {
            vw: innerWidth,
            rectW: Math.round(r.width),
            cssWidth: cs.width,
            cssMaxWidth: cs.maxWidth,
            cls: card.className,
          };
        }"""
    )
    with LOG.open("a", encoding="utf-8") as f:
        f.write(
            json.dumps(
                {
                    "sessionId": "eef336",
                    "runId": "post-fix",
                    "hypothesisId": "H2",
                    "location": "playwright:groupbuy-sheet",
                    "message": "detail sheet width",
                    "data": m,
                    "timestamp": int(time.time() * 1000),
                },
                ensure_ascii=False,
            )
            + "\n"
        )
    print(m)
    b.close()
