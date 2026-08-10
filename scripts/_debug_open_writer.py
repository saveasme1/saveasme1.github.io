# -*- coding: utf-8 -*-
from pathlib import Path
from playwright.sync_api import sync_playwright

html = Path(r"F:/공방171포폴프로젝트/_pwa_push/groupbuy.html").resolve().as_uri()
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script("sessionStorage.setItem('gongbang171.adminToken','test-token');")
    page.goto(html, wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    print(
        page.evaluate(
            """() => ({
      tok: sessionStorage.getItem('gongbang171.adminToken'),
      btn: !!document.querySelector('[data-write]'),
      hidden: document.querySelector('[data-write]')?.hidden,
    })"""
        )
    )
    print(
        page.evaluate(
            """() => {
      sessionStorage.setItem('gongbang171.adminToken','test-token');
      const btn = document.querySelector('[data-write]');
      if (!btn) return {err:'no-btn'};
      btn.hidden = false;
      btn.click();
      const dlg = document.getElementById('gbCalWriter');
      return {hasDlg: !!dlg, open: dlg && dlg.open, cls: dlg && dlg.className};
    }"""
        )
    )
    b.close()
