(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.KRForce = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

const LB_TO_KG = 0.45359237;
  const MAX_LOAD = 5000;

  const RPE_TABLE = {
    '10':  [1, .955, .922, .892, .863, .837, .811, .786, .762, .739, .707, .68],
    '9.5': [.978, .939, .907, .878, .85, .824, .799, .774, .751, .723, .694, .667],
    '9':   [.955, .922, .892, .863, .837, .811, .786, .762, .739, .707, .68, .653],
    '8.5': [.939, .907, .878, .85, .824, .799, .774, .751, .723, .694, .667, .64],
    '8':   [.922, .892, .863, .837, .811, .786, .762, .739, .707, .68, .653, .626],
    '7.5': [.907, .878, .85, .824, .799, .774, .751, .723, .694, .667, .64, .613],
    '7':   [.892, .863, .837, .811, .786, .762, .739, .707, .68, .653, .626, .599],
    '6.5': [.878, .85, .824, .799, .774, .751, .723, .694, .667, .64, .613, .586]
  };

  const PLATE_CONFIGS = {
    lb: {
      unit: 'lb', step: .5, collarsEach: 0,
      bars: [{v:45,l:'45 lb — olympique'}, {v:35,l:'35 lb'}, {v:33,l:'33 lb'}, {v:20,l:'20 lb'}, {v:15,l:'15 lb — technique'}],
      plates: [
        {w:45,l:'45',c:'#555'}, {w:35,l:'35',c:'#666'}, {w:25,l:'25',c:'#777'},
        {w:10,l:'10',c:'#888'}, {w:5,l:'5',c:'#999',s:'small'}, {w:2.5,l:'2.5',c:'#aaa',s:'tiny'}
      ],
      note:'Mode gym : aucun collet n’est ajouté automatiquement.'
    },
    kgGym: {
      unit: 'kg', step: .5, collarsEach: 0,
      bars: [{v:20,l:'20 kg'}, {v:15,l:'15 kg'}, {v:10,l:'10 kg — technique'}],
      plates: [
        {w:25,l:'25',c:'#e53935'}, {w:20,l:'20',c:'#1e88e5'}, {w:15,l:'15',c:'#fdd835',t:'#222'},
        {w:10,l:'10',c:'#43a047'}, {w:5,l:'5',c:'#fff',t:'#222'}, {w:2.5,l:'2.5',c:'#e53935',s:'small'},
        {w:1.25,l:'1.25',c:'#bbb',t:'#222',s:'small'}, {w:.5,l:'0.5',c:'#ddd',t:'#222',s:'tiny'}
      ],
      note:'Mode gym kg : jeu non officiel, sans collets obligatoires.'
    },
    iwf: {
      unit: 'kg', step: 1, collarsEach: 2.5,
      bars: [{v:20,l:'20 kg — homme'}, {v:15,l:'15 kg — femme'}],
      plates: [
        {w:25,l:'25',c:'#e53935'}, {w:20,l:'20',c:'#1e88e5'}, {w:15,l:'15',c:'#fdd835',t:'#222'},
        {w:10,l:'10',c:'#43a047'}, {w:5,l:'5',c:'#fff',t:'#222'}, {w:2.5,l:'2.5',c:'#e53935',s:'small'},
        {w:2,l:'2',c:'#1e88e5',s:'small'}, {w:1.5,l:'1.5',c:'#fdd835',t:'#222',s:'small'},
        {w:1,l:'1',c:'#43a047',s:'tiny'}, {w:.5,l:'0.5',c:'#fff',t:'#222',s:'tiny'}
      ],
      note:'Mode IWF : deux collets de 2,5 kg sont inclus dans la charge totale.'
    }
  };

  function finiteNumber(value, min, max) {
    const n = Number(value);
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  }

  function roundToIncrement(value, increment) {
    if (!Number.isFinite(value) || !Number.isFinite(increment) || increment <= 0) return null;
    return Math.round(value / increment) * increment;
  }

  function estimate1RM(load, reps, rpe) {
    const l = finiteNumber(load, .01, MAX_LOAD);
    const r = Number(reps);
    const intensity = RPE_TABLE[String(rpe)]?.[r - 1];
    if (l === null || !Number.isInteger(r) || r < 1 || r > 12 || !intensity) return null;
    return { value: l / intensity, intensity };
  }

  const RPE_ORDER = ['6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10'];
  const RPE_LABELS = {
    '10': '10 — aucune répétition restante',
    '9.5': '9,5 — presque aucune répétition restante',
    '9': '9 — environ 1 répétition restante',
    '8.5': '8,5 — entre 1 et 2 répétitions restantes',
    '8': '8 — environ 2 répétitions restantes',
    '7.5': '7,5 — entre 2 et 3 répétitions restantes',
    '7': '7 — environ 3 répétitions restantes',
    '6.5': '6,5 — environ 3–4 répétitions restantes'
  };
  const ROUNDING_WARN_RATIO = 0.05;

  function shiftRpe(rpe, delta) {
    const i = RPE_ORDER.indexOf(String(rpe));
    if (i < 0) return null;
    return RPE_ORDER[Math.max(0, Math.min(RPE_ORDER.length - 1, i + delta))];
  }

  function targetLoad(oneRm, reps, rpe, increment) {
    const rm = finiteNumber(oneRm, .01, MAX_LOAD);
    const inc = finiteNumber(increment, .01, 100);
    const r = Number(reps);
    const intensity = RPE_TABLE[String(rpe)]?.[r - 1];
    if (rm === null || inc === null || !Number.isInteger(r) || r < 1 || r > 12 || !intensity) return null;
    const theoretical = rm * intensity;
    if (!(theoretical > 0) || !Number.isFinite(theoretical)) return null;

    let load = roundToIncrement(theoretical, inc);
    let incrementTooCoarse = false;
    if (load === null || !(load > 0) || !Number.isFinite(load)) {
      load = inc;
      incrementTooCoarse = true;
    }

    const relativeRoundingError = Math.abs(load - theoretical) / theoretical;
    const significantRounding = incrementTooCoarse || relativeRoundingError >= ROUNDING_WARN_RATIO;

    return {
      theoretical,
      load,
      intensity,
      relativeRoundingError,
      significantRounding,
      incrementTooCoarse
    };
  }

  function suggestNextLoad(executedLoad, reps, prescribedRpe, feel, increment) {
    const load = finiteNumber(executedLoad, .01, MAX_LOAD);
    const inc = finiteNumber(increment, .01, 100);
    const r = Number(reps);
    if (load === null || inc === null || !Number.isInteger(r) || r < 1 || r > 12) return null;
    if (!['easier', 'same', 'harder'].includes(feel)) return null;

    if (feel === 'same') {
      const kept = Math.max(inc, roundToIncrement(load, inc) || load);
      if (!(kept > 0) || !Number.isFinite(kept)) return null;
      return { load: kept, previous: load, delta: kept - load, warning: null, feel };
    }

    const feltDelta = feel === 'easier' ? -1 : 1;
    const feltRpe = shiftRpe(prescribedRpe, feltDelta);
    let suggested = null;

    if (feltRpe && feltRpe !== String(prescribedRpe)) {
      const est = estimate1RM(load, r, feltRpe);
      if (est) {
        const next = targetLoad(est.value, r, prescribedRpe, inc);
        if (next && next.load > 0) suggested = next.load;
      }
    }

    if (suggested === null) {
      const nudged = feel === 'easier' ? load + inc : load - inc;
      suggested = Math.max(inc, roundToIncrement(nudged, inc) || inc);
    }

    if (!(suggested > 0) || !Number.isFinite(suggested)) return null;

    const maxStep = Math.max(load * 0.05, inc);
    let warning = null;
    if (Math.abs(suggested - load) > maxStep + 1e-9) {
      suggested = feel === 'easier'
        ? Math.max(inc, roundToIncrement(load + maxStep, inc) || (load + inc))
        : Math.max(inc, roundToIncrement(load - maxStep, inc) || Math.max(inc, load - inc));
      warning = 'L’écart est important. Vérifie ta charge et ton ressenti avant d’ajuster.';
    } else if (Math.abs(suggested - load) / load > 0.05) {
      warning = 'L’écart est important. Vérifie ta charge et ton ressenti avant d’ajuster.';
    }

    if (!(suggested > 0) || !Number.isFinite(suggested)) return null;
    return { load: suggested, previous: load, delta: suggested - load, warning, feel };
  }

  function warmupBaseSteps(topReps, compact) {
    const reps = Number(topReps);
    const emptyReps = reps <= 3 ? 8 : 10;
    if (compact) {
      return [
        {r: emptyReps, p: null},
        {r: 5, p: .45},
        {r: 2, p: .75}
      ];
    }
    return [
      {r: emptyReps, p: null},
      {r: 5, p: .40},
      {r: 3, p: .60},
      {r: 2, p: .75}
    ];
  }

  function approachSteps(topReps, compact) {
    if (compact) return [];
    const reps = Number(topReps);
    if (reps <= 1) return [{r:1, p:.85}, {r:1, p:.95}];
    if (reps <= 3) return [{r:1, p:.85}, {r:1, p:.93}];
    if (reps <= 6) return [{r:1, p:.85}];
    return [{r: Math.min(4, Math.max(2, reps - 3)), p: .85}];
  }

  function stepLabel(step, weight, target, equipment) {
    if (step.p === null) {
      return equipment === 'barbell' ? 'Barre vide' : 'Départ';
    }
    return `${Math.round((weight / target) * 100)} %`;
  }

  function buildWarmupPlan(options) {
    const target = finiteNumber(options.target, .01, MAX_LOAD);
    const reps = Number(options.topReps);
    const increment = finiteNumber(options.increment, .01, 100);
    const equipment = options.equipment;
    const compact = !!options.compact;
    const minimum = equipment === 'barbell'
      ? finiteNumber(options.barWeight, 1, 100)
      : finiteNumber(options.minimum ?? 5, .01, 500);

    if (target === null || increment === null || minimum === null || !Number.isInteger(reps) || reps < 1 || reps > 10) {
      return { error:'Entrées invalides.', requested: target, achievable: null };
    }
    if (equipment === 'barbell' && target < minimum) {
      return { error:`Le top set (${target} lb) est inférieur au poids de la barre (${minimum} lb).`, requested: target, achievable: null };
    }

    const roundedTop = roundToIncrement(target, increment);
    const topWeight = equipment === 'barbell' ? Math.max(minimum, roundedTop) : roundedTop;
    if (topWeight < minimum) {
      return { error:'La charge suggérée est sous la charge minimale de l’équipement.', requested: target, achievable: topWeight };
    }

    if (Math.abs(topWeight - minimum) < 1e-9) {
      return {
        rows:[{reps, weight:topWeight, label:'TOP SET', top:true}],
        note: equipment === 'barbell'
          ? 'Aucune montée de charge n’est possible : le top set correspond à la barre sélectionnée.'
          : 'Aucune montée de charge distincte n’est nécessaire à cette charge.',
        requested: target,
        achievable: topWeight,
        compact
      };
    }

    const candidates = [...warmupBaseSteps(reps, compact), ...approachSteps(reps, compact)];
    const rows = [];

    for (const step of candidates) {
      const raw = step.p === null ? minimum : target * step.p;
      const weight = step.p === null
        ? minimum
        : Math.max(minimum, roundToIncrement(raw, increment));
      if (weight >= topWeight) continue;
      if (rows.length && weight <= rows[rows.length - 1].weight) continue;
      rows.push({ reps: step.r, weight, label: stepLabel(step, weight, target, equipment) });
    }

    rows.push({reps, weight:topWeight, label:'TOP SET', top:true});
    const notes = [];
    if (rows.length <= 2) notes.push('Le nombre d’étapes a été réduit parce que la charge cible est proche de la charge minimale.');
    if (compact) notes.push('Version courte : moins d’étapes avant le top set.');
    return {
      rows,
      note: notes.join(' '),
      requested: target,
      achievable: topWeight,
      compact
    };
  }

  function buildPlateDp(maxUnits, plates) {
    const scale = 4;
    const coins = plates
      .map(p => ({...p, u:Math.round(p.w * scale)}))
      .filter(p => p.u > 0);
    const counts = new Int32Array(maxUnits + 1);
    const previousCoin = new Int16Array(maxUnits + 1);
    counts.fill(2147483647);
    previousCoin.fill(-1);
    counts[0] = 0;

    for (let amount = 1; amount <= maxUnits; amount++) {
      for (let i = 0; i < coins.length; i++) {
        const coin = coins[i];
        if (coin.u <= amount && counts[amount - coin.u] !== 2147483647) {
          const candidateCount = counts[amount - coin.u] + 1;
          if (candidateCount < counts[amount]) {
            counts[amount] = candidateCount;
            previousCoin[amount] = i;
          }
        }
      }
    }

    function reconstruct(amount) {
      if (amount < 0 || amount > maxUnits || counts[amount] === 2147483647) return null;
      const result = [];
      while (amount > 0) {
        const coinIndex = previousCoin[amount];
        if (coinIndex < 0) return null;
        const coin = coins[coinIndex];
        result.push(coin);
        amount -= coin.u;
      }
      return result;
    }

    return {scale, reconstruct, counts};
  }

  function solveExactPlates(perSide, plates) {
    if (!Number.isFinite(perSide) || perSide < 0) return null;
    const scale = 4;
    const rawUnits = perSide * scale;
    if (Math.abs(rawUnits - Math.round(rawUnits)) > 1e-8) return null;
    const targetUnits = Math.round(rawUnits);
    return buildPlateDp(targetUnits, plates).reconstruct(targetUnits);
  }

  function distributePlates(total, bar, config) {
    const t = finiteNumber(total, .01, MAX_LOAD);
    const b = finiteNumber(bar, .01, 100);
    if (t === null || b === null || !config) return {error:'Charge ou barre invalide.'};
    const collarsTotal = config.collarsEach * 2;
    const available = t - b - collarsTotal;
    if (available < -1e-9) return {error:`La charge totale est inférieure à la barre et aux collets (${b + collarsTotal} ${config.unit}).`};

    const requestedPerSide = Math.max(0, available / 2);
    const scale = 4;
    const rawUnits = requestedPerSide * scale;
    const maxUnits = Math.floor(rawUnits + 1e-9);
    const searchCeiling = maxUnits + Math.round(50 * scale);
    const dp = buildPlateDp(searchCeiling, config.plates);
    const targetIsDiscrete = Math.abs(rawUnits - Math.round(rawUnits)) <= 1e-8;
    const targetUnits = Math.round(rawUnits);

    if (targetIsDiscrete) {
      const exact = dp.reconstruct(targetUnits);
      if (exact) return {plates:exact, exact:true, actualTotal:t, requestedTotal:t, collarsTotal};
    }

    let below = null;
    for (let units = maxUnits; units >= 0; units--) {
      const candidate = dp.reconstruct(units);
      if (candidate) {
        const actualTotal = b + collarsTotal + (units / scale) * 2;
        below = {plates:candidate, exact:false, actualTotal, difference:t - actualTotal, collarsTotal, requestedTotal:t};
        break;
      }
    }

    let nearestAbove = null;
    for (let units = maxUnits + 1; units <= searchCeiling; units++) {
      const candidate = dp.reconstruct(units);
      if (candidate) {
        nearestAbove = b + collarsTotal + (units / scale) * 2;
        break;
      }
    }

    if (below) {
      below.nearestAbove = nearestAbove;
      return below;
    }
    return {error:'Aucune combinaison de disques n’a été trouvée.'};
  }

  function clampWithNote(value, min, max, label) {
    const adjusted = Math.max(min, Math.min(max, value));
    return {adjusted, note: adjusted === value ? '' : `${label} : ${value.toFixed(2)} kg ajusté à ${adjusted.toFixed(2)} kg.`};
  }

  function dotsCoefficient(bodyweightKg, sex) {
    const bounds = sex === 'm' ? [40,210] : [40,150];
    const c = clampWithNote(bodyweightKg, bounds[0], bounds[1], 'DOTS');
    const x = c.adjusted;
    const denominator = sex === 'm'
      ? -0.0000010930*x**4 + 0.0007391293*x**3 - 0.1918759221*x**2 + 24.0900756*x - 307.75076
      : -0.0000010706*x**4 + 0.0005158568*x**3 - 0.1126655495*x**2 + 13.6175032*x - 57.96288;
    return {coefficient:500/denominator, note:c.note, adjusted:c.adjusted};
  }

  function wilksCoefficient(bodyweightKg, sex) {
    const bounds = sex === 'm' ? [40,201.9] : [26.51,154.53];
    const c = clampWithNote(bodyweightKg, bounds[0], bounds[1], 'Wilks');
    const x = c.adjusted;
    const denominator = sex === 'm'
      ? -216.0475144 + 16.2606339*x - .002388645*x**2 - .00113732*x**3 + 7.01863e-6*x**4 - 1.291e-8*x**5
      : 594.31747775582 - 27.23842536447*x + .82112226871*x**2 - .00930733913*x**3 + 4.731582e-5*x**4 - 9.054e-8*x**5;
    return {coefficient:500/denominator, note:c.note, adjusted:c.adjusted};
  }

  function ipfGlCoefficient(bodyweightKg, sex, equipment) {
    const sets = {
      m:{classic:[1199.72839,1025.18162,.00921],equipped:[1236.25115,1449.21864,.01644]},
      f:{classic:[610.32796,1045.59282,.03048],equipped:[758.63878,949.31382,.02435]}
    };
    const [A,B,C] = sets[sex]?.[equipment] || [];
    if (![A,B,C,bodyweightKg].every(Number.isFinite) || bodyweightKg <= 0) return null;
    const denominator = A - B * Math.exp(-C * bodyweightKg);
    return denominator > 0 ? 100 / denominator : null;
  }

  function calculateScores(bodyweightKg, totalKg, sex, equipment) {
    const bw = finiteNumber(bodyweightKg, 1, 1000);
    const total = finiteNumber(totalKg, 1, 10000);
    if (bw === null || total === null || !['m','f'].includes(sex)) return null;
    const dots = dotsCoefficient(bw, sex);
    const wilks = wilksCoefficient(bw, sex);
    const gl = ipfGlCoefficient(bw, sex, equipment);
    if (!Number.isFinite(dots.coefficient) || !Number.isFinite(wilks.coefficient) || !Number.isFinite(gl)) return null;
    return {
      dots:total*dots.coefficient,
      wilks:total*wilks.coefficient,
      ipfGl:total*gl,
      notes:[dots.note,wilks.note].filter(Boolean)
    };
  }

  const API = {LB_TO_KG,RPE_TABLE,RPE_LABELS,RPE_ORDER,PLATE_CONFIGS,finiteNumber,roundToIncrement,estimate1RM,targetLoad,suggestNextLoad,buildWarmupPlan,solveExactPlates,distributePlates,dotsCoefficient,wilksCoefficient,ipfGlCoefficient,calculateScores};
  return API;
}));
