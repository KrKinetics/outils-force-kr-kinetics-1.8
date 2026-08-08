'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('./force-core.js');
const app = require('./app.js');

function approx(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const coreSource = fs.readFileSync(path.join(root, 'force-core.js'), 'utf8');

assert.strictEqual(app, core, 'app.js must re-export the same canonical force-core module');
assert.ok(fs.existsSync(path.join(root, 'force-core.js')), 'Missing force-core.js');
assert.ok(html.includes('force-core.js'), 'index.html must load force-core.js');
assert.ok(html.indexOf('force-core.js') < html.indexOf('app.js'), 'force-core.js must load before app.js');
assert.ok(appSource.includes("require('./force-core.js')"), 'app.js must require force-core.js in Node');
assert.ok(!/function\s+targetLoad\s*\(/.test(appSource), 'app.js must not redefine targetLoad');
assert.ok(!/function\s+buildWarmupPlan\s*\(/.test(appSource), 'app.js must not redefine buildWarmupPlan');
assert.ok(!/function\s+estimate1RM\s*\(/.test(appSource), 'app.js must not redefine estimate1RM');
assert.ok(!/const\s+RPE_TABLE\s*=/.test(appSource), 'app.js must not redefine RPE_TABLE');
assert.ok(!/document\.|localStorage|addEventListener|getElementById|clipboard|querySelector/.test(coreSource), 'force-core.js must stay DOM-free');

const CRITICAL_IDS = [
  'warmupEquipment', 'targetWeight', 'topReps', 'warmupBarWrap', 'warmupBar', 'warmupIncrement',
  'warmupHint', 'warmupMessage', 'warmupBody', 'charge', 'reps', 'rpe', 'rmResult', 'targetRm',
  'targetReps', 'targetRpe', 'targetIncrement', 'useEstimatedRm', 'targetLoadResult', 'plateMode',
  'plateBar', 'plateTotal', 'plateHint', 'plateResult', 'plateVisual', 'plateMessage', 'plateBody',
  'scoreUnit', 'scoreSex', 'scoreEquipment', 'scoreBw', 'scoreTotal', 'dotsScore', 'wilksScore',
  'ipfGlScore', 'scoreMessage', 'buildMeta', 'warmupCompactToggle', 'afterSet', 'afterSetResult'
];

for (const id of CRITICAL_IDS) {
  assert.ok(html.includes(`id="${id}"`), `Missing critical id: ${id}`);
}

assert.ok(!html.includes('raw.' + 'githubusercontent.com'), 'External branding URL found in index.html');
assert.ok(!html.includes('hero-' + 'logo'), 'Hero watermark marker found in index.html');
assert.ok(!html.includes('DM+Serif+Display') && !html.includes('DM Serif Display'), 'DM Serif Display should be removed');
assert.ok(html.includes('styles.css'), 'styles.css link missing in index.html');
assert.ok(fs.existsSync(path.join(root, 'styles.css')), 'Missing styles.css');
assert.ok(fs.existsSync(path.join(root, 'assets', 'kr-logo-lockup.png')), 'Missing lockup logo');
assert.ok(fs.existsSync(path.join(root, 'assets', 'kr-monogram.png')), 'Missing monogram logo');
assert.ok(fs.existsSync(path.join(root, 'assets', 'favicon-32.png')), 'Missing favicon-32.png');
assert.ok(fs.existsSync(path.join(root, 'assets', 'favicon-48.png')), 'Missing favicon-48.png');
assert.ok(fs.existsSync(path.join(root, 'assets', 'apple-touch-icon.png')), 'Missing apple-touch-icon.png');
assert.ok(fs.existsSync(path.join(root, 'build.json')), 'Missing build.json');
assert.ok(html.includes('<fieldset>') && html.includes('<legend>Équipement</legend>'), 'Equipment fieldset/legend missing');
assert.ok(html.includes('id="warmupEquipment"'), 'warmupEquipment id must remain');
assert.ok(html.includes('rel="canonical"'), 'canonical link missing');
assert.ok(html.includes('property="og:title"'), 'og:title missing');
assert.ok(html.includes('class="methodology"'), 'methodology panel missing');
assert.ok(html.includes('Charge de départ suggérée'), 'Suggested starting load label missing');
assert.ok(!html.includes('Charge réalisable'), 'Old "Charge réalisable" label should be removed');
assert.ok(html.includes('Ajuster après ma série'), 'After-set panel missing');
assert.ok(html.includes('C’est quoi le RPE'), 'RPE help missing');
assert.ok(html.includes('Références vérifiées'), 'Sources date missing');
assert.ok(html.includes('warmup-table'), 'warmup-table class missing');

const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
assert.ok(!styles.includes('DM Serif Display'), 'DM Serif Display found in styles.css');
assert.ok(styles.includes(':focus-visible'), 'focus-visible styles missing');
assert.ok(styles.includes('max-width:900px'), '900px breakpoint missing');
assert.ok(styles.includes('max-width:650px'), '650px breakpoint missing');
assert.ok(styles.includes('max-width:390px'), '390px breakpoint missing');
assert.ok(!styles.includes('min-width:520px') && !styles.includes('min-width:440px'), 'table min-width forcing horizontal scroll should be removed');
assert.ok(!/tool-nav-inner\{[^}]*overflow-x:\s*auto/.test(styles), 'tool-nav should not use horizontal scroll');
assert.ok(styles.includes('border-radius:8px') || styles.includes('--radius:8px'), 'card/nav radius system missing');

const buildRaw = fs.readFileSync(path.join(root, 'build.json'), 'utf8').replace(/^\uFEFF/, '');
const build = JSON.parse(buildRaw);
assert.ok(build.version && build.commit, 'build.json must include version and commit');
assert.ok(/^\d+\.\d+\.\d+$/.test(build.version), 'build.json version must be semver');
const buildBytes = fs.readFileSync(path.join(root, 'build.json'));
assert.ok(!(buildBytes[0] === 0xEF && buildBytes[1] === 0xBB && buildBytes[2] === 0xBF), 'build.json must be UTF-8 without BOM');

function assertWarmupPlan(plan, { minWeight }) {
  assert.ok(!plan.error, plan.error);
  assert.ok(plan.rows.length >= 1);
  assert.ok(plan.rows.every(row => Number.isFinite(row.weight) && row.weight > 0));
  assert.ok(plan.rows.every(row => row.weight >= minWeight - 1e-9));
  for (let i = 1; i < plan.rows.length; i++) {
    assert.ok(plan.rows[i].weight > plan.rows[i - 1].weight, 'warmup weights must be strictly increasing');
  }
  assert.equal(plan.rows.at(-1).top, true);
  const weights = plan.rows.map(r => r.weight);
  assert.equal(new Set(weights).size, weights.length, 'warmup must not duplicate loads');
  assert.ok(plan.rows.slice(0, -1).every(row => !row.top && row.weight < plan.rows.at(-1).weight));
}

for (const barWeight of [10, 15, 20, 33, 35, 45]) {
  for (const target of [barWeight, barWeight + 1, barWeight + 5, 100, 515]) {
    for (let reps = 1; reps <= 10; reps++) {
      const plan = app.buildWarmupPlan({target, topReps:reps, increment:5, equipment:'barbell', barWeight});
      assertWarmupPlan(plan, { minWeight: barWeight });
      if (plan.rows.length > 1 && plan.rows[0].weight === barWeight) {
        assert.equal(plan.rows[0].label, 'Barre vide');
      }
      const compact = app.buildWarmupPlan({target, topReps:reps, increment:5, equipment:'barbell', barWeight, compact:true});
      assertWarmupPlan(compact, { minWeight: barWeight });
      assert.ok(compact.rows.length <= plan.rows.length + 1);
    }
  }
}
assert.ok(app.buildWarmupPlan({target:15, topReps:5, increment:5, equipment:'barbell', barWeight:20}).error);

for (const equipment of ['dumbbells', 'machine']) {
  for (const target of [20, 50, 100, 200, 315]) {
    for (let reps = 1; reps <= 10; reps++) {
      const plan = app.buildWarmupPlan({target, topReps:reps, increment:5, equipment, minimum:5});
      assertWarmupPlan(plan, { minWeight: 5 });
      if (plan.rows.length > 1 && plan.rows[0].weight === 5) {
        assert.equal(plan.rows[0].label, 'Départ', `${equipment} first step must be Départ`);
      }
      assert.ok(!plan.rows.some(row => !row.top && /^\d+ %$/.test(row.label) && Number(row.label) < 10 && row.weight <= 5));
    }
  }
}

const warmupSnapshots = [
  [45, 5], [95, 8], [135, 5], [225, 5], [315, 5], [405, 1], [500, 3]
];
for (const [target, reps] of warmupSnapshots) {
  const plan = app.buildWarmupPlan({target, topReps:reps, increment:5, equipment:'barbell', barWeight:45});
  assertWarmupPlan(plan, { minWeight: 45 });
  const beforeTop = plan.rows.length - 1;
  if (target >= 135) {
    assert.ok(beforeTop >= 3 && beforeTop <= 7, `${target}x${reps} unexpected step count: ${beforeTop}`);
  }
}

const plan315 = app.buildWarmupPlan({target:315, topReps:5, increment:5, equipment:'barbell', barWeight:45});
assert.ok(plan315.rows.length - 1 <= 6);

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

const inexact = app.distributePlates(226.5, 45, app.PLATE_CONFIGS.lb);
assert.equal(inexact.exact, false);
assert.ok(inexact.actualTotal < 226.5);
assert.ok(Number.isFinite(inexact.nearestAbove));
assert.ok(inexact.nearestAbove > inexact.actualTotal);

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

const oneRms = [1, 5, 10, 20, 50, 100, 200, 400, 600, 1000];
const rpes = ['6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10'];
const increments = [0.5, 2.5, 5, 10];
for (const rm of oneRms) {
  for (const rpe of rpes) {
    for (let reps = 1; reps <= 12; reps++) {
      for (const inc of increments) {
        const out = app.targetLoad(rm, reps, rpe, inc);
        assert.ok(out, `targetLoad null for ${rm}/${reps}/${rpe}/${inc}`);
        assert.ok(Number.isFinite(out.theoretical) && out.theoretical > 0);
        assert.ok(Number.isFinite(out.load) && out.load > 0);
        assert.ok(!Number.isNaN(out.load));
        assert.ok(out.load !== Infinity);
        assert.ok(Number.isFinite(out.relativeRoundingError));
        assert.equal(typeof out.significantRounding, 'boolean');
        if (out.relativeRoundingError >= 0.05 || out.incrementTooCoarse) {
          assert.equal(out.significantRounding, true);
        }
      }
    }
  }
}

const zeroRisk = app.targetLoad(20, 12, '6.5', 10);
assert.ok(zeroRisk);
assert.ok(zeroRisk.load > 0);
assert.ok(zeroRisk.incrementTooCoarse || zeroRisk.significantRounding);

const baseTarget = app.targetLoad(400, 5, '8', 5);
assert.ok(baseTarget && baseTarget.load > 0);
const nextHarder = app.suggestNextLoad(baseTarget.load, 5, '8', 'harder', 5);
assert.ok(nextHarder);
assert.ok(nextHarder.load > 0);
assert.ok(nextHarder.load <= baseTarget.load);
assert.ok(Math.abs(nextHarder.load - baseTarget.load) <= baseTarget.load * 0.05 + 5);

const nextEasier = app.suggestNextLoad(baseTarget.load, 5, '8', 'easier', 5);
assert.ok(nextEasier);
assert.ok(nextEasier.load > 0);
assert.ok(nextEasier.load >= baseTarget.load);
assert.ok(Math.abs(nextEasier.load - baseTarget.load) <= baseTarget.load * 0.05 + 5);

const nextSame = app.suggestNextLoad(baseTarget.load, 5, '8', 'same', 5);
assert.ok(nextSame);
assert.equal(nextSame.load, baseTarget.load);

assert.ok(app.RPE_LABELS['8'].includes('2'));
assert.ok(app.RPE_LABELS['10'].includes('aucune'));
assert.ok(app.RPE_LABELS['9.5'].includes('presque'));

assert.equal(core.roundToIncrement(283.5, 0.5), 283.5);
assert.equal(core.roundToIncrement(283.5, 2.5), 282.5);
assert.equal(core.roundToIncrement(283.5, 5), 285);
assert.equal(core.roundToIncrement(283.5, 10), 280);

const rpeKeys = Object.keys(core.RPE_TABLE);
assert.equal(rpeKeys.length, 8, 'RPE_TABLE must expose 8 RPE levels');
let rpeCellCount = 0;
for (const key of rpeKeys) {
  assert.equal(core.RPE_TABLE[key].length, 12, `RPE ${key} must expose 12 reps`);
  rpeCellCount += core.RPE_TABLE[key].length;
  for (const intensity of core.RPE_TABLE[key]) {
    assert.ok(Number.isFinite(intensity) && intensity > 0 && intensity <= 1);
  }
}
assert.equal(rpeCellCount, 96, 'RPE_TABLE must expose 8 × 12 = 96 coefficients');

const est = core.estimate1RM(315, 5, '8');
assert.ok(est);
approx(est.value, 315 / core.RPE_TABLE['8'][4]);

assert.equal(core.estimate1RM(NaN, 5, '8'), null);
assert.equal(core.targetLoad(NaN, 5, '8', 5), null);
assert.equal(core.estimate1RM(Infinity, 5, '8'), null);
assert.equal(core.targetLoad(Infinity, 5, '8', 5), null);

const lbFromKg = 100 / app.LB_TO_KG;
const kgRoundTrip = lbFromKg * app.LB_TO_KG;
approx(kgRoundTrip, 100, 1e-9);

console.log('All tests passed.');
