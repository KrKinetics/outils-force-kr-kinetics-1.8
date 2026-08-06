'use strict';
const assert = require('assert');
const app = require('./app.js');

function approx(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

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

console.log('All tests passed.');
