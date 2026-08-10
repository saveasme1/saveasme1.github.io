#!/usr/bin/env node
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const URL = process.env.GROUPBUY_URL || 'https://hand-made.kr/groupbuy.html';
const ITEM_ID = process.env.ITEM_ID || 'gb-2026-08-10-90c5a1';
const OUT = process.env.OUT ||
  `/var/www/makerbridge/private/gongbang171/groupbuy/uploads/${ITEM_ID}/cover-live-1000.png`;
const SIZE = 1000;

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const raw = OUT.replace(/\.png$/, '-raw.png');

  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({
    viewport: { width: 430, height: 900 },
    deviceScaleFactor: 2,
    locale: 'ko-KR',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })).newPage();

  await page.goto(`${URL}?v=${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await page.waitForSelector('.gb-cal', { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.fonts?.ready).catch(() => {});

  const bodyText = await page.locator('.gb-cal').innerText();
  if (/test/i.test(bodyText)) {
    throw new Error('capture blocked: calendar still contains "test" schedule');
  }

  const panel = page.locator('.gb-cal-page').first();
  await panel.screenshot({ path: raw, type: 'png', timeout: 60000 });
  await browser.close();

  const meta = await sharp(raw).metadata();
  const bg = await sharp(raw).resize(1, 1).raw().toBuffer();
  const background = { r: bg[0], g: bg[1], b: bg[2], alpha: 1 };

  await sharp(raw)
    .resize(SIZE, SIZE, {
      fit: 'contain',
      background,
      position: 'top',
    })
    .png()
    .toFile(OUT);

  fs.unlinkSync(raw);
  const outMeta = await sharp(OUT).metadata();
  console.log(JSON.stringify({
    ok: true,
    url: URL,
    out: OUT,
    from: `${meta.width}x${meta.height}`,
    to: `${outMeta.width}x${outMeta.height}`,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
