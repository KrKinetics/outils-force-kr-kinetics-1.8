'use strict';
/**
 * Mobile overflow + screenshot smoke check.
 * Usage: node scripts/mobile_check.js
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const { chromium } = require('playwright');
  const root = path.join(__dirname, '..');
  const outDir = path.join(root, 'qa-screenshots');
  fs.mkdirSync(outDir, { recursive: true });
  const fileUrl = pathToFileURL(path.join(root, 'index.html')).href;

  const sizes = [
    { name: '320x568', width: 320, height: 568 },
    { name: '360x800', width: 360, height: 800 },
    { name: '375x812', width: 375, height: 812 },
    { name: '390x844', width: 390, height: 844 },
    { name: '430x932', width: 430, height: 932 },
    { name: '1280x800', width: 1280, height: 800 }
  ];

  const browser = await chromium.launch();
  const report = [];

  for (const size of sizes) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
    await page.goto(fileUrl, { waitUntil: 'load' });
    await page.waitForSelector('#warmupBody tr');

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const offenders = [];
      const nodes = [doc, body, ...document.querySelectorAll('nav, main, .card, .table-wrap, table, .tool-nav, .plate-visual, .score-grid')];
      for (const el of nodes) {
        if (!el) continue;
        if (el.scrollWidth > el.clientWidth + 1) {
          offenders.push({
            tag: el.tagName,
            className: el.className,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth
          });
        }
      }
      return {
        pageOverflow: doc.scrollWidth > window.innerWidth + 1,
        scrollWidth: doc.scrollWidth,
        innerWidth: window.innerWidth,
        offenders
      };
    });

    for (const section of ['#warmup', '#target-load', '#plates', '#scores']) {
      await page.locator(section).scrollIntoViewIfNeeded();
      const shot = path.join(outDir, `${size.name}${section.replace('#', '-')}.png`);
      await page.locator(section).screenshot({ path: shot });
    }
    await page.screenshot({ path: path.join(outDir, `${size.name}-full.png`), fullPage: true });

    report.push({ size: size.name, ...overflow });
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  const bad = report.filter(r => r.pageOverflow || r.offenders.length);
  if (bad.length) {
    console.error('Horizontal overflow detected:');
    console.error(JSON.stringify(bad, null, 2));
    process.exit(1);
  }
  console.log('Mobile checks passed. Screenshots in qa-screenshots/');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
