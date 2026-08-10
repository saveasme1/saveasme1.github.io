# -*- coding: utf-8 -*-
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
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # notices standalone
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.goto((ROOT / "notices.html").resolve().as_uri(), wait_until="domcontentloaded")
        page.wait_for_timeout(1500)
        n = page.evaluate(
            """() => {
              const panel = document.getElementById('noticesPanel');
              const list = document.getElementById('noticesList');
              const toolbar = document.querySelector('.reviews-toolbar');
              if (!panel || !list) return {err:'missing'};
              const pr = panel.getBoundingClientRect();
              const lr = list.getBoundingClientRect();
              const tr = toolbar ? toolbar.getBoundingClientRect() : null;
              const ls = getComputedStyle(list);
              return {
                redirected: /landing\\.html/.test(location.pathname),
                path: location.pathname.split('/').pop(),
                panelHidden: panel.hidden,
                listML: ls.marginLeft,
                listMR: ls.marginRight,
                listLeft: Math.round(lr.left),
                listRight: Math.round(innerWidth - lr.right),
                toolbarLeft: tr ? Math.round(tr.left) : null,
                toolbarRight: tr ? Math.round(innerWidth - tr.right) : null,
              };
            }"""
        )
        log({"runId": "post-fix", "hypothesisId": "H11", "location": "playwright:notices", "message": "notices standalone gutters", "data": n})
        print("notices", n)

        # landing pwa quick + hero
        page2 = browser.new_page(viewport={"width": 390, "height": 844})
        page2.add_init_script(
            """() => {
              try {
                localStorage.setItem('hx.pwa.installedBuild', '20260810-gbcal62');
                localStorage.setItem('hx.pwa.activatedBuild', '20260810-gbcal62');
                localStorage.setItem('hx.pwa.build', '20260810-gbcal62');
              } catch (e) {}
            }"""
        )
        page2.goto((ROOT / "landing.html").resolve().as_uri() + "?app=1", wait_until="domcontentloaded")
        page2.wait_for_timeout(2500)
        page2.evaluate(
            """() => {
              document.documentElement.classList.remove('is-pwa-reinstall-required');
              document.getElementById('pwaReinstallGate')?.remove();
              const home = document.getElementById('pwaHome');
              if (home) home.style.display = 'block';
            }"""
        )
        page2.wait_for_timeout(200)
        m = page2.evaluate(
            """() => {
              const labels = [...document.querySelectorAll('.pwa-dock__txt')].map(el => el.textContent.trim());
              const hero = document.querySelector('.pwa-hero');
              if (!hero) return {labels, err:'no-hero'};
              const r = hero.getBoundingClientRect();
              const cs = getComputedStyle(hero);
              return {
                labels,
                heroLeft: Math.round(r.left),
                heroRight: Math.round(innerWidth - r.right),
                heroW: Math.round(r.width),
                heroH: Math.round(r.height),
                heightCss: cs.height,
                ml: cs.marginLeft,
                mr: cs.marginRight,
              };
            }"""
        )
        log({"runId": "post-fix", "hypothesisId": "H9", "location": "playwright:landing-pwa", "message": "menu+hero", "data": m})
        print("landing", m)

        # PC hero full bleed
        page3 = browser.new_page(viewport={"width": 1440, "height": 900})
        page3.add_init_script(
            """() => {
              document.documentElement.classList.add('is-pwa');
              try {
                localStorage.setItem('hx.pwa.installedBuild', '20260810-gbcal62');
                localStorage.setItem('hx.pwa.activatedBuild', '20260810-gbcal62');
                localStorage.setItem('hx.pwa.build', '20260810-gbcal62');
              } catch (e) {}
            }"""
        )
        page3.goto((ROOT / "landing.html").resolve().as_uri() + "?app=1", wait_until="domcontentloaded")
        page3.wait_for_timeout(3000)
        page3.evaluate(
            """() => {
              document.documentElement.classList.add('is-pwa');
              document.documentElement.classList.remove('is-pwa-reinstall-required');
              document.getElementById('pwaReinstallGate')?.remove();
              const home = document.getElementById('pwaHome');
              if (home) {
                home.style.display = 'block';
                home.style.width = '100%';
              }
            }"""
        )
        page3.wait_for_timeout(300)
        pc = page3.evaluate(
            """() => {
              const hero = document.querySelector('.pwa-hero');
              if (!hero) return {err:'no-hero'};
              const r = hero.getBoundingClientRect();
              return {
                left: Math.round(r.left),
                right: Math.round(innerWidth - r.right),
                w: Math.round(r.width),
                h: Math.round(r.height),
                vw: innerWidth,
              };
            }"""
        )
        log({"runId": "post-fix", "hypothesisId": "H10", "location": "playwright:landing-pc", "message": "pc hero bleed", "data": pc})
        print("pc", pc)
        browser.close()

        expected = ["포트폴리오", "발견", "최종검수", "스냅", "공동구매", "AI검색"]
        fails = []
        if n.get("redirected"):
            fails.append("notices-redirected")
        if n.get("listLeft", 0) < 8 or n.get("listRight", 0) < 8:
            fails.append(("notices-gutter", n))
        if m.get("labels") != expected:
            fails.append(("menu", m.get("labels")))
        if m.get("heroLeft", 99) > 2 or m.get("heroRight", 99) > 2:
            fails.append(("mo-hero-gap", m))
        if m.get("heroH", 999) > 480:
            fails.append(("mo-hero-tall", m.get("heroH")))
        if pc.get("left", 99) > 2 or pc.get("right", 99) > 2:
            fails.append(("pc-hero-gap", pc))
        if pc.get("h", 999) > 480:
            fails.append(("pc-hero-tall", pc.get("h")))
        if fails:
            raise SystemExit("FAIL " + json.dumps(fails, ensure_ascii=False))
        print("PASS")


if __name__ == "__main__":
    main()
