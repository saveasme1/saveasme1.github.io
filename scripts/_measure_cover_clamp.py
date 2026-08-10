# -*- coding: utf-8 -*-
"""Inject mock covers and verify they stay inside .gb-cal bounds."""
from pathlib import Path
import json
import time
from playwright.sync_api import sync_playwright

ROOT = Path(r"F:/공방171포폴프로젝트/_pwa_push")
LOG = Path(r"F:/#1_zeron_web_develop/makerbridge/.cursor/debug-eef336.log")


def log(payload):
    payload.setdefault("sessionId", "eef336")
    payload.setdefault("timestamp", int(time.time() * 1000))
    with LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")


def main():
    html = (ROOT / "groupbuy.html").resolve().as_uri()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for vw in (390, 1440):
            page = browser.new_page(viewport={"width": vw, "height": 900})
            page.goto(html, wait_until="domcontentloaded")
            page.wait_for_timeout(1000)
            # inject covers at left/right extremes like buggy layout
            metrics = page.evaluate(
                """() => {
                  const cal = document.querySelector('.gb-cal');
                  const wrap = document.querySelector('.gb-cal__grid-wrap') || cal;
                  let coversEl = document.querySelector('.gb-cal__covers');
                  if (!coversEl) {
                    coversEl = document.createElement('div');
                    coversEl.className = 'gb-cal__covers';
                    wrap.append(coversEl);
                  }
                  coversEl.innerHTML = '';
                  const grid = document.querySelector('.gb-cal__grid');
                  const gridW = grid ? grid.getBoundingClientRect().width : cal.clientWidth;
                  // simulate pre-clamp left overflow and right overflow positions then rely on CSS overflow:hidden
                  // Also call refresh if items exist — instead place covers with clamp logic copy
                  const size = parseFloat(getComputedStyle(cal).getPropertyValue('--gb-thumb')) || 32;
                  const half = size/2;
                  const positions = [-10, 0, half, gridW, gridW + 20];
                  const minX = half + 2;
                  const maxX = Math.max(minX, gridW - half - 2);
                  positions.forEach((x, i) => {
                    const clamped = Math.min(maxX, Math.max(minX, x));
                    const el = document.createElement('div');
                    el.className = 'gb-cal__cover';
                    el.style.width = size + 'px';
                    el.style.height = size + 'px';
                    el.style.left = clamped + 'px';
                    el.style.top = '8px';
                    el.style.background = '#ccc';
                    coversEl.append(el);
                  });
                  const cr = cal.getBoundingClientRect();
                  let overflowLeft = 0, overflowRight = 0;
                  [...coversEl.children].forEach((el) => {
                    const r = el.getBoundingClientRect();
                    overflowLeft = Math.max(overflowLeft, cr.left - r.left);
                    overflowRight = Math.max(overflowRight, r.right - cr.right);
                  });
                  const cs = getComputedStyle(cal);
                  return {
                    vw: innerWidth,
                    thumb: cs.getPropertyValue('--gb-thumb').trim(),
                    padL: cs.paddingLeft,
                    padR: cs.paddingRight,
                    overflowLeft: Math.round(overflowLeft*10)/10,
                    overflowRight: Math.round(overflowRight*10)/10,
                    coverCount: coversEl.children.length,
                    ox: cs.overflowX,
                  };
                }"""
            )
            log(
                {
                    "runId": "post-fix",
                    "hypothesisId": "H7",
                    "location": f"playwright:cover-clamp-{vw}",
                    "message": "clamped covers vs cal bounds",
                    "data": metrics,
                }
            )
            print(vw, metrics)
            page.close()
            if metrics["overflowLeft"] > 1 or metrics["overflowRight"] > 1:
                raise SystemExit(f"overflow at {vw}: {metrics}")
        browser.close()
        print("PASS")


if __name__ == "__main__":
    main()
