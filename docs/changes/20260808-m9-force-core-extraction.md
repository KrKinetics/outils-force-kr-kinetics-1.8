# M9-0 — Canonical Force core extraction

Date: 2026-08-08  
Scope: Force repository only (`outils-force-kr-kinetics-1.8`)  
Milestone: M9-0 extraction / packaging (not M9-1, not M10)

## Starting point

| Item | Value |
|------|-------|
| Branch | `main` |
| Starting HEAD | `cff4fbcd741a482b001af1894a2732119e3748ff` |
| Relation to audited plan | Exact audited CSS commit (`cff4fbc`); no Force calculation drift since audit |
| Baseline | `node test_app.js` passed before extraction |
| `build.json` | Already stale (`1.10.0` / `51aa6d5`) — **not** used as source authority |

## Files created

- `force-core.js` — canonical DOM-free calculation module
- `package.json` — Git-dependency export metadata for `@krkinetics/force-core`
- `docs/changes/20260808-m9-force-core-extraction.md` — this report
- `scripts/m9_smoke.js` — local visual smoke helper
- `qa-screenshots/m9-smoke-1366.png` — smoke evidence (when generated)

## Files modified

- `app.js` — UI/browser wiring only; requires/re-exports `force-core.js`
- `index.html` — loads `force-core.js` before `app.js`
- `test_app.js` — asserts single canonical core + extraction contracts
- `.github/workflows/ci.yml` — requires `force-core.js` and `package.json`
- `README.md` — architecture + Git dependency notes
- `qa-screenshots/final-*.png` — refreshed smoke captures where binary changed

## Exact symbols moved into `force-core.js`

Constants:

- `LB_TO_KG`
- `MAX_LOAD` (internal)
- `RPE_TABLE`
- `RPE_LABELS`
- `RPE_ORDER`
- `PLATE_CONFIGS`

Helpers / algorithms:

- `finiteNumber`
- `roundToIncrement`
- `estimate1RM`
- `targetLoad`
- `suggestNextLoad`
- `warmupBaseSteps` (internal)
- `approachSteps` (internal)
- `stepLabel` (internal)
- `buildWarmupPlan`
- `solveExactPlates`
- `distributePlates`
- `clampWithNote` (internal)
- `dotsCoefficient`
- `wilksCoefficient`
- `ipfGlCoefficient`
- `calculateScores`

Public API object: `module.exports` / `globalThis.KRForce`.

Warm-up rows retain structured fields usable by a future adapter:

- `reps`
- `weight`
- `top` (Force UI may continue using labels such as `Barre vide`, `Départ`, `TOP SET`)

Legacy equipment contract preserved (`dumbbells`, etc.).

## Module format

UMD-style factory compatible with:

1. Browser globals (`KRForce` via `<script>`)
2. Node CommonJS (`require('./force-core.js')`)
3. Later Git-pinned dependency from Maître Coach (`require('@krkinetics/force-core')`)

No bundler / build step introduced.

## Package / export strategy

`package.json`:

- `"name": "@krkinetics/force-core"`
- `"main": "force-core.js"`
- `"exports"` map to `./force-core.js`
- private / no npm publish required

Consumer example (future M9-1, not done here):

```json
{
  "dependencies": {
    "@krkinetics/force-core": "git+https://github.com/KrKinetics/outils-force-kr-kinetics-1.8.git#<M9-0-commit-sha>"
  }
}
```

## Proof of single source

- `app.js` Node path: `require('./force-core.js')` then `module.exports = core`
- Browser path: reads `root.KRForce` after `force-core.js` script
- `test_app.js`: `assert.strictEqual(app, core)`
- Structural guards: `app.js` must not redefine `RPE_TABLE`, `estimate1RM`, `targetLoad`, `buildWarmupPlan`
- `force-core.js` must remain free of `document` / `localStorage` / listeners / DOM APIs

## Legacy public API compatibility

Preserved for the Force product:

- equipment value `dumbbells`
- warm-up labels (`Barre vide` / `Départ` / `TOP SET`)
- existing result shapes used by `app.js` / `test_app.js`
- plate + score APIs

No Maître Coach naming migration in M9-0.

## Tests

```bash
node test_app.js
```

Result: **All tests passed.**

Focused extraction contracts retained/added:

- rounding: `283.5` → `0.5` / `2.5` / `5` / `10`
- RPE: 8 × 12 = 96 coefficients present
- warm-up canonical scenarios + invalids
- NaN / Infinity / range behavior unchanged from existing suite

CI essential-file checks updated for `force-core.js` + `package.json`.

## Visual smoke

Commands:

```bash
node scripts/final_shots.js
node scripts/m9_smoke.js
```

Checks:

- page loads with `window.KRForce`
- Montée en charge table populated
- 1RM / Charge cible / Disques / Scores sections render results
- Ajuster après ma série (`#afterSet` / `[data-feel]`) present
- localStorage round-trip OK
- no console page errors observed in smoke run
- branding/layout not redesigned

Evidence: `qa-screenshots/` (`final-*`, `m9-smoke-1366.png`).

## Calculation drift

**NONE** intentional.

No algorithm coefficients, rounding rules, warm-up steps, plate math, or score formulas were changed — source relocation only.

Pre-extraction HEAD was the audited `cff4fbc` tip; no post-audit calculation commits intervened.

## Unrelated / pre-existing debt

- `build.json` remains stale relative to HEAD (`commit: 51aa6d5` while HEAD was `cff4fbc…`).
- Correct sequence for Force release metadata remains: land functional commit first, then a separate metadata commit that records the **already published** SHA if/when the project process requires footer accuracy.
- M9 consumers must pin the **extraction commit SHA**, not `build.json`.

## build.json

**Not changed** in the M9-0 extraction commit (avoids self-referential / misleading metadata).

## Confirmations

- Maître Coach modified: **NO**
- M9-1 started: **NO**
- M10 started: **NO**
