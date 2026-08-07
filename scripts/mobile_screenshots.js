'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');

const chromeCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];
const chrome = chromeCandidates.find(p => fs.existsSync(p));
if (!chrome) {
  console.error('No Chrome/Edge found for screenshots');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'qa-screenshots');
fs.mkdirSync(outDir, { recursive: true });
const fileUrl = pathToFileURL(path.join(root, 'index.html')).href;

const sizes = [
  [320, 568],
  [360, 800],
  [375, 812],
  [390, 844],
  [430, 932],
  [1280, 800]
];

for (const [width, height] of sizes) {
  const out = path.join(outDir, `${width}x${height}.png`);
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--window-size=${width},${height}`,
    `--screenshot=${out}`,
    fileUrl
  ], { stdio: 'ignore', timeout: 30000 });
  console.log('wrote', out);
}

console.log('Screenshots complete.');
