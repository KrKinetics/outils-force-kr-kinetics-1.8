'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');

const chrome = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find(p => fs.existsSync(p));

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'qa-screenshots');
fs.mkdirSync(outDir, { recursive: true });

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      let filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, ''));
      if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404); res.end('missing'); return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.json':'application/json' };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function cdp(wsUrl, method, params = {}) {
  const WebSocket = (await import('ws')).default;
  // fallback without ws: use fetch to HTTP endpoint via chrome remote
}

async function main() {
  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch (_) {
    console.log('Installing puppeteer-core...');
    require('child_process').execFileSync(process.execPath, ['-e', ''], {stdio:'inherit'});
  }
}

// Prefer puppeteer-core if available after npx
(async () => {
  const server = await serve();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/`;
  const sizes = [[320,568],[375,812],[390,844],[430,932],[1280,800]];

  let browser;
  try {
    const puppeteer = require('puppeteer-core');
    browser = await puppeteer.launch({
      executablePath: chrome,
      headless: 'new',
      args: ['--allow-file-access-from-files']
    });
  } catch (err) {
    console.error('puppeteer-core required. Run: npm install puppeteer-core --no-save');
    console.error(err.message);
    server.close();
    process.exit(1);
  }

  const report = [];
  for (const [width, height] of sizes) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(base, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#warmupBody tr');
    await page.click('a[href="#warmup"]');
    await new Promise(r => setTimeout(r, 200));

    const metrics = await page.evaluate(() => {
      const check = el => el ? ({
        sw: el.scrollWidth, cw: el.clientWidth, overflow: el.scrollWidth > el.clientWidth + 1
      }) : null;
      return {
        page: document.documentElement.scrollWidth <= window.innerWidth + 1,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        nav: check(document.querySelector('.tool-nav-inner')),
        table: check(document.querySelector('#warmup .table-wrap')),
        warmupTable: check(document.querySelector('#warmup table')),
        plateVisual: check(document.querySelector('#plateVisual')),
        h1: document.querySelector('h1')?.getBoundingClientRect().right <= window.innerWidth + 1
      };
    });

    await page.screenshot({ path: path.join(outDir, `qa-${width}x${height}-top.png`) });
    const warmup = await page.$('#warmup');
    if (warmup) await warmup.screenshot({ path: path.join(outDir, `qa-${width}x${height}-warmup.png`) });
    await page.click('a[href="#target-load"]');
    await new Promise(r => setTimeout(r, 150));
    const target = await page.$('#target-load');
    if (target) await target.screenshot({ path: path.join(outDir, `qa-${width}x${height}-target.png`) });

    report.push({ width, height, metrics });
    await page.close();
  }

  await browser.close();
  server.close();
  fs.writeFileSync(path.join(outDir, 'overflow-report.json'), JSON.stringify(report, null, 2));
  const failed = report.filter(r => !r.metrics.page || (r.metrics.nav && r.metrics.nav.overflow) || (r.metrics.table && r.metrics.table.overflow) || (r.metrics.warmupTable && r.metrics.warmupTable.overflow) || !r.metrics.h1);
  console.log(JSON.stringify(report, null, 2));
  if (failed.length) {
    console.error('Overflow failures:', failed.length);
    process.exit(1);
  }
  console.log('Overflow checks passed.');
})().catch(err => { console.error(err); process.exit(1); });
