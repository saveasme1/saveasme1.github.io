# -*- coding: utf-8 -*-
"""Measure calendar cover overflow, PWA gutters, and detail rail thumbs."""
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


def measure(page, label, vw):
    page.set_viewport_size({"width": vw, "height": 900})
    page.wait_for_timeout(600)
    # force render wait
    page.evaluate("() => window.GroupbuyCalendar && window.GroupbuyCalendar.refreshAll && window.GroupbuyCalendar.refreshAll()")
    page.wait_for_timeout(900)
    data = page.evaluate(
        """() => {
          const cal = document.querySelector('.gb-cal');
          const sec = document.querySelector('.pwa-groupbuy') || document.querySelector('.gb-cal-page');
          const covers = [...document.querySelectorAll('.gb-cal__cover')];
          if (!cal) return {err:'no-cal'};
          const cr = cal.getBoundingClientRect();
          const sr = sec ? sec.getBoundingClientRect() : null;
          const parent = cal.parentElement;
          const pr = parent ? parent.getBoundingClientRect() : null;
          let minLeft = Infinity, maxRight = -Infinity, overflowLeft = 0, overflowRight = 0;
          covers.forEach((el) => {
            const r = el.getBoundingClientRect();
            minLeft = Math.min(minLeft, r.left);
            maxRight = Math.max(maxRight, r.right);
            overflowLeft = Math.max(overflowLeft, cr.left - r.left);
            overflowRight = Math.max(overflowRight, r.right - cr.right);
          });
          // open a multi-image detail if possible
          return {
            vw: innerWidth,
            calLeft: Math.round(cr.left),
            calRight: Math.round(cr.right),
            calW: Math.round(cr.width),
            secPadL: sec ? Math.round(parseFloat(getComputedStyle(sec).paddingLeft)||0) : null,
            secPadR: sec ? Math.round(parseFloat(getComputedStyle(sec).paddingRight)||0) : null,
            mountML: parent ? Math.round(parseFloat(getComputedStyle(parent).marginLeft)||0) : null,
            mountMR: parent ? Math.round(parseFloat(getComputedStyle(parent).marginRight)||0) : null,
            parentW: pr ? Math.round(pr.width) : null,
            parentLeft: pr ? Math.round(pr.left) : null,
            parentRight: pr ? Math.round(pr.right) : null,
            gapL: pr ? Math.round(cr.left - pr.left) : null,
            gapR: pr ? Math.round(pr.right - cr.right) : null,
            coverCount: covers.length,
            overflowLeft: Math.round(overflowLeft),
            overflowRight: Math.round(overflowRight),
            thumb: getComputedStyle(cal).getPropertyValue('--gb-thumb').trim(),
          };
        }"""
    )
    log({"runId": "post-fix", "hypothesisId": "H7", "location": f"playwright:{label}", "message": "cal layout metrics", "data": data})
    print(label, json.dumps(data, ensure_ascii=False))
    return data


def measure_rail(page, label):
    data = page.evaluate(
        """() => {
          // synthesize detail with rail
          let root = document.querySelector('.gb-cal-sheet');
          if (!root) {
            root = document.createElement('div');
            root.className = 'gb-cal-sheet';
            root.innerHTML = '<div class="gb-cal-sheet__card board-detail"><div class="gb-cal-sheet__scroll board-detail-body"><div class="gb-cal-sheet__hero detail-images"></div><div class="gb-cal-sheet__rail"><button class="is-on"><img alt=""></button><button><img alt=""></button></div><div class="gb-cal-sheet__body detail-copy"><h2>t</h2></div></div></div>';
            document.body.appendChild(root);
          } else {
            const card = root.querySelector('.gb-cal-sheet__card') || root;
            if (!card.querySelector('.gb-cal-sheet__rail')) {
              const scroll = card.querySelector('.gb-cal-sheet__scroll') || card;
              const rail = document.createElement('div');
              rail.className = 'gb-cal-sheet__rail';
              rail.innerHTML = '<button class="is-on"><img alt=""></button><button><img alt=""></button>';
              scroll.append(rail);
            }
            root.hidden = false;
          }
          const rail = document.querySelector('.gb-cal-sheet__rail');
          const btns = [...rail.querySelectorAll('button')];
          const rr = rail.getBoundingClientRect();
          return {
            railH: Math.round(rr.height),
            railPadT: Math.round(parseFloat(getComputedStyle(rail).paddingTop)||0),
            railPadB: Math.round(parseFloat(getComputedStyle(rail).paddingBottom)||0),
            btnW: btns[0] ? Math.round(btns[0].getBoundingClientRect().width) : 0,
            btnH: btns[0] ? Math.round(btns[0].getBoundingClientRect().height) : 0,
            btnCount: btns.length,
            flex: getComputedStyle(rail).flex,
          };
        }"""
    )
    log({"runId": "post-fix", "hypothesisId": "H8", "location": f"playwright:{label}-rail", "message": "detail rail metrics", "data": data})
    print(label + "-rail", json.dumps(data, ensure_ascii=False))
    return data


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Web groupbuy page
        page = browser.new_page()
        page.goto((ROOT / "groupbuy.html").resolve().as_uri(), wait_until="domcontentloaded")
        page.wait_for_timeout(1200)
        d1 = measure(page, "web-390", 390)
        d2 = measure(page, "web-1440", 1440)
        r1 = measure_rail(page, "web")

        # PWA landing with is-pwa
        page2 = browser.new_page()
        page2.add_init_script("document.documentElement.classList.add('is-pwa');")
        page2.goto((ROOT / "landing.html").resolve().as_uri() + "?app=1", wait_until="domcontentloaded")
        page2.wait_for_timeout(2000)
        # scroll to groupbuy
        page2.evaluate("() => document.querySelector('.pwa-groupbuy')?.scrollIntoView()")
        page2.wait_for_timeout(800)
        d3 = measure(page2, "pwa-390", 390)
        r2 = measure_rail(page2, "pwa")
        browser.close()

        fails = []
        for d in (d1, d2, d3):
            if d.get("overflowLeft", 0) > 1 or d.get("overflowRight", 0) > 1:
                fails.append(("overflow", d))
        if d3.get("secPadL") is not None and d3.get("secPadR") is not None:
            if abs(d3["secPadL"] - d3["secPadR"]) > 1:
                fails.append(("unequal-pad", d3))
        for r in (r1, r2):
            if r.get("btnH", 0) < 60 or r.get("railH", 0) < 70:
                fails.append(("rail-small", r))
        if fails:
            raise SystemExit("FAIL " + json.dumps(fails, ensure_ascii=False))
        print("PASS")


if __name__ == "__main__":
    main()
