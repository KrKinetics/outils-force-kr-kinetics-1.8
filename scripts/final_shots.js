'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

async function main() {
  const puppeteer = require('puppeteer-core');
  const chrome = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ].find(p => fs.existsSync(p));
  const root = path.join(__dirname, '..');
  const outDir = path.join(root, 'qa-screenshots');
  fs.mkdirSync(outDir, { recursive: true });

  const server = await new Promise(resolve => {
    const s = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, ''));
      if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404); res.end('missing'); return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });

  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new' });
  const sizes = [[320, 568, '320'], [375, 812, '375'], [430, 932, '430'], [1366, 768, '1366']];

  for (const [width, height, name] of sizes) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(base, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#warmupBody tr');
    await page.screenshot({ path: path.join(outDir, `final-${name}-top.png`) });
    const warmup = await page.$('#warmup');
    if (warmup) await warmup.screenshot({ path: path.join(outDir, `final-${name}-warmup.png`) });
    await page.click('a[href="#target-load"]');
    await new Promise(r => setTimeout(r, 200));
    const target = await page.$('#target-load');
    if (target) await target.screenshot({ path: path.join(outDir, `final-${name}-target.png`) });

    const loadOk = await page.evaluate(() => {
      const loads = [...document.querySelectorAll('#warmup .warmup-load')];
      return loads.every(el => {
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        return /^\d+(?:\.\d+)? lb$/.test(text) && el.getBoundingClientRect().right <= window.innerWidth + 1;
      });
    });
    const pageOk = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    if (!loadOk || !pageOk) {
      console.error('Broken load/page at', name, { loadOk, pageOk });
      process.exitCode = 1;
    }
    await page.close();
  }

  await browser.close();
  server.close();
  console.log('Final screenshots written.');
}

main().catch(err => { console.error(err); process.exit(1); });
