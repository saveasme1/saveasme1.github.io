# -*- coding: utf-8 -*-
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(r"F:/공방171포폴프로젝트/_pwa_push")
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={"width": 390, "height": 844})
    page.goto((ROOT / "landing.html").resolve().as_uri() + "?app=1", wait_until="domcontentloaded")
    page.wait_for_timeout(3500)
    print(
        page.evaluate(
            """() => ({
      isPwa: document.documentElement.classList.contains('is-pwa'),
      hostDisp: document.getElementById('pwaHome') && getComputedStyle(document.getElementById('pwaHome')).display,
      hostW: document.getElementById('pwaHome') && document.getElementById('pwaHome').getBoundingClientRect().width,
      heroCount: document.querySelectorAll('.pwa-hero').length,
      hero: (() => {
        const hero = document.querySelector('#pwaHome .pwa-hero, .pwa-hero');
        if (!hero) return null;
        const r = hero.getBoundingClientRect();
        return {disp:getComputedStyle(hero).display, w:Math.round(r.width), h:Math.round(r.height), left:Math.round(r.left), right:Math.round(innerWidth-r.right)};
      })(),
      dock: [...document.querySelectorAll('.pwa-dock__txt')].map(e=>e.textContent.trim()),
    })"""
        )
    )
    b.close()
