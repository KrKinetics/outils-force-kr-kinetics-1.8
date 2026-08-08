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
  if (!chrome) throw new Error('Chrome/Edge not found for smoke');

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
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('pageerror', err => consoleErrors.push(String(err)));
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: 'networkidle0' });

  const snapshot = await page.evaluate(() => {
    const text = id => (document.getElementById(id)?.textContent || '').replace(/\s+/g, ' ').trim();
    return {
      hasCore: typeof window.KRForce === 'object' && typeof window.KRForce.targetLoad === 'function',
      warmupRows: document.querySelectorAll('#warmupBody tr').length,
      rmResult: text('rmResult'),
      targetResult: text('targetLoadResult'),
      plateResult: text('plateResult'),
      dots: text('dotsScore'),
      wilks: text('wilksScore'),
      ipfGl: text('ipfGlScore'),
      afterSet: !!document.getElementById('afterSet'),
      feelButtons: document.querySelectorAll('[data-feel]').length,
      brand: !!document.querySelector('a.brand'),
      storageRoundtrip: (() => {
        try {
          localStorage.setItem('kr-force-m9-smoke', '1');
          const ok = localStorage.getItem('kr-force-m9-smoke') === '1';
          localStorage.removeItem('kr-force-m9-smoke');
          return ok;
        } catch (_) {
          return false;
        }
      })()
    };
  });

  await page.click('a[href="#one-rm"]');
  await page.click('a[href="#target-load"]');
  await page.click('a[href="#plates"]');
  await page.click('a[href="#scores"]');
  await page.click('a[href="#warmup"]');
  await new Promise(r => setTimeout(r, 150));

  await page.screenshot({ path: path.join(outDir, 'm9-smoke-1366.png'), fullPage: true });

  await browser.close();
  server.close();

  const failures = [];
  if (!snapshot.hasCore) failures.push('KRForce missing');
  if (snapshot.warmupRows < 2) failures.push('warmup empty');
  if (!snapshot.rmResult || snapshot.rmResult.includes('--')) failures.push('1RM empty');
  if (!snapshot.targetResult || snapshot.targetResult.includes('--')) failures.push('target empty');
  if (!snapshot.plateResult || snapshot.plateResult === '--') failures.push('plates empty');
  if (!snapshot.dots || snapshot.dots === '--') failures.push('DOTS empty');
  if (!snapshot.wilks || snapshot.wilks === '--') failures.push('Wilks empty');
  if (!snapshot.ipfGl || snapshot.ipfGl === '--') failures.push('IPF GL empty');
  if (!snapshot.afterSet || snapshot.feelButtons < 1) failures.push('after-set missing');
  if (!snapshot.brand) failures.push('brand missing');
  if (!snapshot.storageRoundtrip) failures.push('localStorage failed');
  if (consoleErrors.length) failures.push('console errors: ' + consoleErrors.join(' | '));

  console.log(JSON.stringify({ ok: failures.length === 0, snapshot, consoleErrors, failures }, null, 2));
  if (failures.length) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
