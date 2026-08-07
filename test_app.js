'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const app = require('./app.js');

function approx(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const CRITICAL_IDS = [
  'warmupEquipment', 'targetWeight', 'topReps', 'warmupBarWrap', 'warmupBar', 'warmupIncrement',
  'warmupHint', 'warmupMessage', 'warmupBody', 'charge', 'reps', 'rpe', 'rmResult', 'targetRm',
  'targetReps', 'targetRpe', 'targetIncrement', 'useEstimatedRm', 'targetLoadResult', 'plateMode',
  'plateBar', 'plateTotal', 'plateHint', 'plateResult', 'plateVisual', 'plateMessage', 'plateBody',
  'scoreUnit', 'scoreSex', 'scoreEquipment', 'scoreBw', 'scoreTotal', 'dotsScore', 'wilksScore',
  'ipfGlScore', 'scoreMessage', 'buildMeta'
];

for (const id of CRITICAL_IDS) {
  assert.ok(html.includes(`id="${id}"`), `Missing critical id: ${id}`);
}

assert.ok(!html.includes('raw.githubusercontent.com'), 'External branding URL found in index.html');
assert.ok(!html.includes('hero-logo'), 'Hero watermark marker found in index.html');
assert.ok(fs.existsSync(path.join(root, 'assets', 'kr-logo-lockup.png')), 'Missing lockup logo');
assert.ok(fs.existsSync(path.join(root, 'assets', 'kr-monogram.png')), 'Missing monogram logo');
assert.ok(fs.existsSync(path.join(root, 'build.json')), 'Missing build.json');

const buildRaw = fs.readFileSync(path.join(root, 'build.json'), 'utf8').replace(/^\uFEFF/, '');
const build = JSON.parse(buildRaw);
assert.ok(build.version && build.commit, 'build.json must include version and commit');


for (const barWeight of [10, 15, 20, 33, 35, 45]) {
  for (const target of [barWeight, barWeight + 1, barWeight + 5, 100, 515]) {
    for (let reps = 1; reps <= 10; reps++) {
      const plan = app.buildWarmupPlan({target, topReps:reps, increment:5, equipment:'barbell', barWeight});
      assert.ok(!plan.error, plan.error);
      assert.ok(plan.rows.every(row => row.weight >= barWeight));
      for (let i = 1; i < plan.rows.length; i++) {
        assert.ok(plan.rows[i].weight > plan.rows[i - 1].weight);
      }
      assert.equal(plan.rows.at(-1).top, true);
    }
  }
}
assert.ok(app.buildWarmupPlan({target:15, topReps:5, increment:5, equipment:'barbell', barWeight:20}).error);

let result = app.distributePlates(23, 20, app.PLATE_CONFIGS.kgGym);
assert.equal(result.exact, true);
approx(result.plates.reduce((sum, plate) => sum + plate.w, 0), 1.5);

result = app.distributePlates(100, 20, app.PLATE_CONFIGS.iwf);
assert.equal(result.exact, true);
approx(result.plates.reduce((sum, plate) => sum + plate.w, 0), 37.5);
assert.equal(app.PLATE_CONFIGS.iwf.collarsEach, 2.5);
for (const officialSmallPlate of [2, 1.5, 1, 0.5]) {
  assert.ok(app.PLATE_CONFIGS.iwf.plates.some(plate => plate.w === officialSmallPlate));
}

assert.ok(app.dotsCoefficient(220, 'm').note.includes('210.00'));
assert.ok(app.wilksCoefficient(20, 'f').note.includes('26.51'));
approx(app.ipfGlCoefficient(58.74, 'm', 'classic'), 0.1659, 0.0002);

assert.equal(app.estimate1RM(Infinity, 5, 10), null);
assert.ok(app.distributePlates(Infinity, 20, app.PLATE_CONFIGS.iwf).error);
assert.ok(app.distributePlates(1e12, 20, app.PLATE_CONFIGS.iwf).error);

const roundingPlan = app.buildWarmupPlan({
  target: 46, topReps: 5, increment: 5, equipment: 'barbell', barWeight: 45
});
assert.ok(!roundingPlan.error, roundingPlan.error);
assert.equal(roundingPlan.requested, 46);
assert.equal(roundingPlan.achievable, 45);

const lbFromKg = 100 / app.LB_TO_KG;
const kgRoundTrip = lbFromKg * app.LB_TO_KG;
approx(kgRoundTrip, 100, 1e-9);

console.log('All tests passed.');
