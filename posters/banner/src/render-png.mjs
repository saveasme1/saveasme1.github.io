/**
 * Render banner HTML → PNG at fixed sizes.
 * account: 1000x1500 · care/delivery: 1000x1000
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "..");

const jobs = [
  { name: "account", w: 1000, h: 1500 },
  { name: "care", w: 1000, h: 1000 },
  { name: "delivery", w: 1000, h: 1000 },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const job of jobs) {
      const htmlPath = path.join(__dirname, `${job.name}.html`);
      const outPath = path.join(outDir, `${job.name}.png`);
      const url = pathToFileURL(htmlPath).href;

      const page = await browser.newPage({
        viewport: { width: job.w, height: job.h },
        deviceScaleFactor: 1,
      });

      await page.goto(url, { waitUntil: "networkidle" });
      // wait for webfonts
      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready;
      });
      await page.waitForTimeout(400);

      const banner = page.locator("#banner");
      await banner.screenshot({ path: outPath, type: "png" });

      const box = await banner.boundingBox();
      console.log(
        `${job.name}.png  target=${job.w}x${job.h}  box=${Math.round(box?.width || 0)}x${Math.round(box?.height || 0)}  -> ${outPath}`
      );
      await page.close();
    }
  } finally {
    await browser.close();
  }

  for (const job of jobs) {
    const p = path.join(outDir, `${job.name}.png`);
    const st = fs.statSync(p);
    console.log(`ok ${job.name}.png ${(st.size / 1024).toFixed(1)} KB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
