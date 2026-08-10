# -*- coding: utf-8 -*-
"""Measure groupbuy writer dialog computed width vs shipping rules."""
from pathlib import Path
import json
import time

from playwright.sync_api import sync_playwright

ROOT = Path(r"F:/공방171포폴프로젝트/_pwa_push")
LOG = Path(r"F:/#1_zeron_web_develop/makerbridge/.cursor/debug-eef336.log")


def append_log(payload: dict) -> None:
    payload.setdefault("sessionId", "eef336")
    payload.setdefault("timestamp", int(time.time() * 1000))
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")


def main() -> None:
    html = (ROOT / "groupbuy.html").resolve().as_uri()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(html, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(1500)

        # Force-open writer via public API if present
        opened = page.evaluate(
            """() => {
              const api = window.GongbangGroupbuyCalendar || window.GroupbuyCalendar || null;
              // Prefer direct create if exposed
              const host = document.querySelector('#gbCalMount, .gb-cal, [data-gb-cal], main') || document.body;
              if (window.GongbangGroupbuy && typeof window.GongbangGroupbuy.openWriter === 'function') {
                window.GongbangGroupbuy.openWriter();
                return 'GongbangGroupbuy.openWriter';
              }
              // Fallback: click write button
              const btn = document.querySelector('[data-write], .gb-cal__write, button');
              const candidates = [...document.querySelectorAll('button, a')].filter(el => /작성|글쓰기|등록/.test(el.textContent||''));
              if (candidates[0]) { candidates[0].click(); return 'click:'+candidates[0].textContent.trim(); }
              // Last resort: call module if mounted
              const writeBtn = document.querySelector('#gbCalWriteBtn, [data-gb-write]');
              if (writeBtn) { writeBtn.click(); return 'writeBtn'; }
              return 'no-op';
            }"""
        )
        page.wait_for_timeout(800)

        # If dialog not open, synthesize with same classes as production
        page.evaluate(
            """() => {
              let dlg = document.getElementById('gbCalWriter');
              if (!dlg) {
                dlg = document.createElement('dialog');
                dlg.id = 'gbCalWriter';
                dlg.className = 'gb-cal-writer review-dialog write-dialog gb-write-dialog pf-write-dialog';
                dlg.innerHTML = '<form><h2>공동구매 작성</h2><div class="pf-writer-fields"></div></form>';
                document.body.appendChild(dlg);
              } else {
                dlg.classList.add('pf-write-dialog');
              }
              if (!dlg.open) dlg.showModal();
            }"""
        )
        page.wait_for_timeout(200)

        metrics = page.evaluate(
            """() => {
              const dlg = document.getElementById('gbCalWriter');
              if (!dlg) return null;
              const r = dlg.getBoundingClientRect();
              const cs = getComputedStyle(dlg);
              return {
                openedHow: null,
                vw: window.innerWidth,
                vh: window.innerHeight,
                rectW: Math.round(r.width),
                rectH: Math.round(r.height),
                cssWidth: cs.width,
                cssMaxWidth: cs.maxWidth,
                cls: dlg.className,
              };
            }"""
        )
        if metrics:
            metrics["openedHow"] = opened
        append_log(
            {
                "runId": "post-fix",
                "hypothesisId": "H1",
                "location": "playwright:groupbuy-writer-width",
                "message": "local computed writer width",
                "data": metrics,
            }
        )
        print(json.dumps({"opened": opened, "metrics": metrics}, ensure_ascii=False, indent=2))

        # Also measure shipping writer classes if shipping page available
        ship = (ROOT / "shipping.html").resolve().as_uri()
        page2 = browser.new_page(viewport={"width": 1440, "height": 900})
        page2.goto(ship, wait_until="domcontentloaded", timeout=60000)
        page2.wait_for_timeout(1000)
        ship_m = page2.evaluate(
            """() => {
              const dlg = document.createElement('dialog');
              dlg.className = 'review-dialog write-dialog pf-write-dialog gb-write-dialog';
              dlg.innerHTML = '<form><h2>검수 작성</h2></form>';
              document.body.appendChild(dlg);
              dlg.showModal();
              const r = dlg.getBoundingClientRect();
              const cs = getComputedStyle(dlg);
              return {
                vw: window.innerWidth,
                rectW: Math.round(r.width),
                cssWidth: cs.width,
                cssMaxWidth: cs.maxWidth,
                cls: dlg.className,
              };
            }"""
        )
        append_log(
            {
                "runId": "post-fix",
                "hypothesisId": "H1",
                "location": "playwright:shipping-writer-width",
                "message": "shipping-like writer width baseline",
                "data": ship_m,
            }
        )
        print("SHIP", json.dumps(ship_m, ensure_ascii=False))
        browser.close()


if __name__ == "__main__":
    main()
