(function (root) {
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
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.KRForce = API;

  if (typeof document === 'undefined') return;

  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'kr-force-tools-v1';
  const DEFAULTS = {
    equipment: 'barbell',
    targetWeight: '315',
    topReps: '5',
    warmupBar: '45',
    warmupIncrement: '5',
    charge: '315',
    reps: '5',
    rpe: '8',
    targetRm: '400',
    targetReps: '3',
    targetRpe: '8',
    targetIncrement: '5',
    plateMode: 'lb',
    plateBar: '45',
    plateTotal: '225',
    scoreUnit: 'kg',
    scoreSex: 'm',
    scoreEquipment: 'classic',
    scoreBwKg: 100,
    scoreTotalKg: 500
  };

  let equipment = DEFAULTS.equipment;
  let warmupCompact = false;
  let lastEstimatedRm = null;
  let lastTargetOut = null;
  let scoreCanonical = {bwKg:DEFAULTS.scoreBwKg,totalKg:DEFAULTS.scoreTotalKg,unit:DEFAULTS.scoreUnit};
  let lastWarmupCopy = '';
  let lastRmCopy = '';
  let lastTargetCopy = '';
  let lastPlatesCopy = '';
  let lastScoresCopy = '';
  let saveTimer = null;

  function setMessage(el, text, type) {
    el.hidden = !text;
    el.textContent = text || '';
    el.className = `message${type ? ` ${type}` : ''}`;
  }

  function setInvalid(input, messageId, invalid) {
    if (!input) return;
    if (invalid) {
      input.setAttribute('aria-invalid', 'true');
      if (messageId) input.setAttribute('aria-describedby', messageId);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }

  function fillSelect(select, values, selected) {
    select.innerHTML = values.map(v => `<option value="${v}"${String(v)===String(selected)?' selected':''}>${v}</option>`).join('');
  }

  function fillRpeSelect(select, selected) {
    select.innerHTML = RPE_ORDER.slice().reverse().map(v =>
      `<option value="${v}"${String(v)===String(selected)?' selected':''}>${RPE_LABELS[v] || v}</option>`
    ).join('');
  }

  function formatWeight(value) {
    return Number.isFinite(value) ? value.toFixed(value % 1 ? 1 : 0) : '--';
  }

  function updateWarmupCompactControl() {
    const btn = $('warmupCompactToggle');
    if (!btn) return;
    btn.textContent = warmupCompact ? 'Revenir à la version standard' : 'Réduire le nombre d’étapes';
    btn.setAttribute('aria-pressed', String(warmupCompact));
  }

  function setEquipment(next) {
    equipment = next || 'barbell';
    document.querySelectorAll('#warmupEquipment button').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.equip === equipment));
    });
  }

  function updateScoreUnitLabels() {
    const unit = $('scoreUnit').value === 'lb' ? 'lb' : 'kg';
    const bwLabel = $('scoreBwLabel');
    const totalLabel = $('scoreTotalLabel');
    if (bwLabel) bwLabel.textContent = `Poids corporel (${unit})`;
    if (totalLabel) totalLabel.textContent = `Total SBD (${unit})`;
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 250);
  }

  function saveState() {
    try {
      const payload = {
        equipment,
        targetWeight: $('targetWeight').value,
        topReps: $('topReps').value,
        warmupBar: $('warmupBar').value,
        warmupIncrement: $('warmupIncrement').value,
        charge: $('charge').value,
        reps: $('reps').value,
        rpe: $('rpe').value,
        targetRm: $('targetRm').value,
        targetReps: $('targetReps').value,
        targetRpe: $('targetRpe').value,
        targetIncrement: $('targetIncrement').value,
        plateMode: $('plateMode').value,
        plateBar: $('plateBar').value,
        plateTotal: $('plateTotal').value,
        scoreUnit: $('scoreUnit').value,
        scoreSex: $('scoreSex').value,
        scoreEquipment: $('scoreEquipment').value,
        scoreBwKg: scoreCanonical.bwKg,
        scoreTotalKg: scoreCanonical.totalKg
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_) { /* ignore quota / private mode */ }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function applySavedState(saved) {
    if (!saved || typeof saved !== 'object') return;
    if (saved.equipment) setEquipment(saved.equipment);
    ['targetWeight','topReps','warmupBar','warmupIncrement','charge','reps','rpe','targetRm','targetReps','targetRpe','targetIncrement','plateMode','plateTotal','scoreUnit','scoreSex','scoreEquipment']
      .forEach(id => {
        if (saved[id] != null && $(id)) $(id).value = String(saved[id]);
      });
    if (Number.isFinite(saved.scoreBwKg)) scoreCanonical.bwKg = saved.scoreBwKg;
    if (Number.isFinite(saved.scoreTotalKg)) scoreCanonical.totalKg = saved.scoreTotalKg;
    scoreCanonical.unit = $('scoreUnit').value;
  }

  function renderWarmup() {
    $('warmupBarWrap').hidden = equipment !== 'barbell';
    updateWarmupCompactControl();
    $('warmupHint').textContent = equipment === 'barbell'
      ? 'La charge de la barre est incluse. Les étapes impossibles ou redondantes sont retirées automatiquement.'
      : equipment === 'dumbbells'
        ? 'La charge indiquée est celle d’un seul haltère.'
        : 'La charge indiquée correspond à la pile ou à la résistance affichée.';
    const plan = buildWarmupPlan({
      target:$('targetWeight').value, topReps:$('topReps').value, increment:$('warmupIncrement').value,
      equipment, barWeight:$('warmupBar').value, minimum:5, compact:warmupCompact
    });
    $('warmupBody').innerHTML = '';
    lastWarmupCopy = '';
    if (plan.error) {
      setMessage($('warmupMessage'), plan.error, 'error');
      setInvalid($('targetWeight'), 'warmupMessage', true);
      return;
    }
    setInvalid($('targetWeight'), 'warmupMessage', false);

    const notes = [];
    if (plan.note) notes.push(plan.note);
    if (plan.requested != null && plan.achievable != null && Math.abs(plan.requested - plan.achievable) > 1e-9) {
      notes.push(`Cible demandée : ${formatWeight(plan.requested)} lb · Charge suggérée : ${formatWeight(plan.achievable)} lb`);
    }
    setMessage($('warmupMessage'), notes.join(' '), notes.length ? 'warn' : '');
    $('warmupBody').innerHTML = plan.rows.map((r,i) => {
      const load = `${formatWeight(r.weight)} lb`;
      const step = r.top ? 'TOP SET' : r.label;
      return `<tr class="${r.top ? 'is-top' : ''}">` +
        `<td class="warmup-series">${i + 1}</td>` +
        `<td class="warmup-reps">${r.reps} reps</td>` +
        `<td class="warmup-step">${step}</td>` +
        `<td class="warmup-load"><strong>${load}</strong></td>` +
        `</tr>`;
    }).join('');
    lastWarmupCopy = plan.rows.map((r,i) => `${i+1}. ${r.reps} reps · ${r.top ? 'TOP SET' : r.label} · ${formatWeight(r.weight)} lb`).join('\n');
  }

  function renderRm() {
    const out = estimate1RM($('charge').value,$('reps').value,$('rpe').value);
    if (!out) {
      lastEstimatedRm = null;
      lastRmCopy = '';
      $('rmResult').innerHTML = '<span class="result-primary">1RM estimé : --</span>';
      return;
    }
    lastEstimatedRm = out.value;
    const rounded = Math.round(out.value);
    const pct = `${(out.intensity * 100).toFixed(1)}`;
    $('rmResult').innerHTML =
      `<span class="result-primary">≈ ${rounded} lb</span>` +
      `<span class="result-secondary">Environ ${pct} % du 1RM</span>` +
      `<span class="result-note">Une estimation peut varier selon le mouvement, l’expérience et le RPE déclaré.</span>`;
    lastRmCopy = `1RM estimé ≈ ${rounded} lb · environ ${pct} % du 1RM`;
  }

  function renderAfterSetResult(suggestion) {
    const el = $('afterSetResult');
    if (!el) return;
    if (!suggestion) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    const primary = suggestion.delta === 0
      ? `Garde la même charge`
      : `Prochaine série suggérée`;
    const deltaTxt = suggestion.delta === 0
      ? ''
      : `<span class="result-secondary">${suggestion.delta > 0 ? '+' : ''}${formatWeight(suggestion.delta)} lb</span>`;
    el.hidden = false;
    el.innerHTML =
      `<span class="result-primary">${primary}</span>` +
      `<span class="result-primary result-load">${formatWeight(suggestion.load)} lb</span>` +
      deltaTxt +
      (suggestion.warning ? `<span class="result-note">${suggestion.warning}</span>` : '');
  }

  function renderTarget() {
    const out = targetLoad($('targetRm').value,$('targetReps').value,$('targetRpe').value,$('targetIncrement').value);
    lastTargetOut = out;
    renderAfterSetResult(null);
    if (!out) {
      lastTargetCopy = '';
      $('targetLoadResult').innerHTML = '<span class="result-primary">Charge de départ suggérée : --</span>';
      return;
    }
    const loadTxt = formatWeight(out.load);
    const theoTxt = out.theoretical.toFixed(1);
    const pctTxt = (out.intensity * 100).toFixed(1);
    let note = '';
    if (out.incrementTooCoarse) {
      note = `L’incrément sélectionné est trop grand pour cette charge. Charge suggérée minimale : ${loadTxt} lb.`;
    } else if (out.significantRounding) {
      note = 'L’incrément choisi est assez grand pour cette charge. Un incrément plus petit donnera une suggestion plus précise.';
    }
    $('targetLoadResult').innerHTML =
      `<span class="result-primary">Charge de départ suggérée</span>` +
      `<span class="result-primary result-load">${loadTxt} lb</span>` +
      `<span class="result-secondary">Théorique : ${theoTxt} lb · Environ ${pctTxt} % du 1RM</span>` +
      (note ? `<span class="result-note">${note}</span>` : '');
    lastTargetCopy = `Charge de départ suggérée : ${loadTxt} lb · Théorique : ${theoTxt} lb · Environ ${pctTxt} % du 1RM`;
  }

  function handleAfterSet(feel) {
    if (!lastTargetOut) {
      renderAfterSetResult(null);
      return;
    }
    const suggestion = suggestNextLoad(
      lastTargetOut.load,
      $('targetReps').value,
      $('targetRpe').value,
      feel,
      $('targetIncrement').value
    );
    renderAfterSetResult(suggestion);
  }

  function updatePlateMode(preserveBar) {
    const cfg = PLATE_CONFIGS[$('plateMode').value];
    const previousBar = preserveBar ? $('plateBar').value : null;
    $('plateBar').innerHTML = cfg.bars.map(b => `<option value="${b.v}">${b.l}</option>`).join('');
    if (previousBar && cfg.bars.some(b => String(b.v) === String(previousBar))) {
      $('plateBar').value = previousBar;
    }
    $('plateTotal').step = String(cfg.step);
    $('plateHint').textContent = cfg.note;
    renderPlates();
  }

  function renderPlates() {
    const cfg = PLATE_CONFIGS[$('plateMode').value];
    const total = Number($('plateTotal').value), bar = Number($('plateBar').value);
    const out = distributePlates(total, bar, cfg);
    $('plateBody').innerHTML = '';
    $('plateVisual').innerHTML = '';
    lastPlatesCopy = '';
    if (out.error) {
      $('plateResult').innerHTML = '<span class="result-primary">--</span>';
      setMessage($('plateMessage'), out.error, 'error');
      setInvalid($('plateTotal'), 'plateMessage', true);
      return;
    }
    setInvalid($('plateTotal'), 'plateMessage', false);
    const counts = new Map();
    out.plates.forEach(p => counts.set(p.l, (counts.get(p.l) || 0) + 1));
    const summary = [...counts.entries()].map(([l, q]) => `${q}× ${l} ${cfg.unit}`).join(' + ') || 'aucun disque';
    const confirmed = `${out.actualTotal} ${cfg.unit}`;
    $('plateResult').innerHTML =
      `<span class="result-primary">Par côté : ${summary}</span>` +
      `<span class="result-secondary">Total confirmé : ${confirmed}${cfg.collarsEach ? ' · collets inclus' : ''}</span>`;
    $('plateVisual').innerHTML =
      '<span class="bar-label">BARRE</span>' +
      (cfg.collarsEach ? '<span class="collar-label">COLLET 2,5</span>' : '') +
      '<span class="side-label">1 côté</span>' +
      out.plates.map(p => `<span class="plate ${p.s || ''}" style="background:${p.c};color:${p.t || '#fff'}">${p.l}</span>`).join('');
    $('plateBody').innerHTML = cfg.plates.filter(p => counts.has(p.l)).map(p =>
      `<tr><td><strong>${p.l} ${cfg.unit}</strong></td><td>${counts.get(p.l)}</td><td>${counts.get(p.l) * 2}</td></tr>`
    ).join('');
    const text = out.exact
      ? `Charge exacte atteinte : ${confirmed}${cfg.collarsEach ? ' · collets inclus' : ''}.`
      : [
          `Charge demandée : ${out.requestedTotal} ${cfg.unit}`,
          `Plus proche sous la cible : ${confirmed}`,
          Number.isFinite(out.nearestAbove) ? `Plus proche au-dessus : ${out.nearestAbove} ${cfg.unit}` : null
        ].filter(Boolean).join(' · ');
    setMessage($('plateMessage'), text, out.exact ? '' : 'warn');
    lastPlatesCopy = `Par côté : ${summary}\nTotal confirmé : ${confirmed}\n${text}`;
  }

  function syncCanonicalFromInputs() {
    const unit = $('scoreUnit').value;
    const bw = finiteNumber($('scoreBw').value, 1, 1000), total = finiteNumber($('scoreTotal').value, 1, 10000);
    if (bw !== null) scoreCanonical.bwKg = unit === 'lb' ? bw * LB_TO_KG : bw;
    if (total !== null) scoreCanonical.totalKg = unit === 'lb' ? total * LB_TO_KG : total;
    scoreCanonical.unit = unit;
  }

  function renderScoreInputsFromCanonical() {
    const unit = $('scoreUnit').value;
    $('scoreBw').value = (unit === 'lb' ? scoreCanonical.bwKg / LB_TO_KG : scoreCanonical.bwKg).toFixed(2).replace(/\.00$/, '');
    $('scoreTotal').value = (unit === 'lb' ? scoreCanonical.totalKg / LB_TO_KG : scoreCanonical.totalKg).toFixed(2).replace(/\.00$/, '');
    scoreCanonical.unit = unit;
    updateScoreUnitLabels();
  }

  function renderScores() {
    updateScoreUnitLabels();
    const out = calculateScores(scoreCanonical.bwKg, scoreCanonical.totalKg, $('scoreSex').value, $('scoreEquipment').value);
    if (!out) {
      $('dotsScore').textContent = $('wilksScore').textContent = $('ipfGlScore').textContent = '--';
      lastScoresCopy = '';
      setMessage($('scoreMessage'), 'Entrées invalides.', 'error');
      return;
    }
    $('dotsScore').textContent = out.dots.toFixed(2);
    $('wilksScore').textContent = out.wilks.toFixed(2);
    $('ipfGlScore').textContent = out.ipfGl.toFixed(2);
    if (out.notes.length) {
      setMessage($('scoreMessage'), out.notes.join(' '), 'warn');
    } else {
      setMessage($('scoreMessage'), '', '');
    }
    lastScoresCopy = `DOTS ${out.dots.toFixed(2)} · Wilks ${out.wilks.toFixed(2)} · IPF GL ${out.ipfGl.toFixed(2)}`;
  }

  function flashCopied(btn) {
    const original = btn.textContent;
    btn.textContent = 'Copié';
    setTimeout(() => { btn.textContent = original; }, 1200);
  }

  function copyText(text, btn) {
    if (!text) return;
    const done = () => flashCopied(btn);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (_) { /* ignore */ }
        document.body.removeChild(ta);
        done();
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (_) { /* ignore */ }
      document.body.removeChild(ta);
      done();
    }
  }

  function getCopyText(key) {
    switch (key) {
      case 'warmup': return lastWarmupCopy;
      case 'rm': return lastRmCopy;
      case 'target': return lastTargetCopy;
      case 'plates': return lastPlatesCopy;
      case 'scores': return lastScoresCopy;
      default: return '';
    }
  }

  function resetTool(key, { skipSave } = {}) {
    if (key === 'warmup') {
      setEquipment(DEFAULTS.equipment);
      warmupCompact = false;
      updateWarmupCompactControl();
      $('targetWeight').value = DEFAULTS.targetWeight;
      $('topReps').value = DEFAULTS.topReps;
      $('warmupBar').value = DEFAULTS.warmupBar;
      $('warmupIncrement').value = DEFAULTS.warmupIncrement;
      renderWarmup();
    } else if (key === 'rm') {
      $('charge').value = DEFAULTS.charge;
      $('reps').value = DEFAULTS.reps;
      $('rpe').value = DEFAULTS.rpe;
      renderRm();
    } else if (key === 'target') {
      $('targetRm').value = DEFAULTS.targetRm;
      $('targetReps').value = DEFAULTS.targetReps;
      $('targetRpe').value = DEFAULTS.targetRpe;
      $('targetIncrement').value = DEFAULTS.targetIncrement;
      renderTarget();
    } else if (key === 'plates') {
      $('plateMode').value = DEFAULTS.plateMode;
      updatePlateMode(false);
      $('plateBar').value = DEFAULTS.plateBar;
      $('plateTotal').value = DEFAULTS.plateTotal;
      renderPlates();
    } else if (key === 'scores') {
      $('scoreUnit').value = DEFAULTS.scoreUnit;
      $('scoreSex').value = DEFAULTS.scoreSex;
      $('scoreEquipment').value = DEFAULTS.scoreEquipment;
      scoreCanonical = {bwKg:DEFAULTS.scoreBwKg,totalKg:DEFAULTS.scoreTotalKg,unit:DEFAULTS.scoreUnit};
      renderScoreInputsFromCanonical();
      renderScores();
    }
    if (!skipSave) scheduleSave();
  }

  function resetAll() {
    ['warmup','rm','target','plates','scores'].forEach(key => resetTool(key, { skipSave: true }));
    scheduleSave();
  }

  function init() {
    fillSelect($('topReps'), [1,2,3,4,5,6,7,8,9,10], DEFAULTS.topReps);
    fillSelect($('reps'), [1,2,3,4,5,6,7,8,9,10,11,12], DEFAULTS.reps);
    fillSelect($('targetReps'), [1,2,3,4,5,6,7,8,9,10,11,12], DEFAULTS.targetReps);
    fillRpeSelect($('rpe'), DEFAULTS.rpe);
    fillRpeSelect($('targetRpe'), DEFAULTS.targetRpe);

    const saved = loadState();
    applySavedState(saved);
    updatePlateMode(true);
    if (saved && saved.plateBar != null) {
      const savedBar = String(saved.plateBar);
      if (PLATE_CONFIGS[$('plateMode').value].bars.some(b => String(b.v) === savedBar)) {
        $('plateBar').value = savedBar;
      }
    }
    renderScoreInputsFromCanonical();

    document.querySelectorAll('#warmupEquipment button').forEach(btn => btn.addEventListener('click', () => {
      setEquipment(btn.dataset.equip);
      renderWarmup();
      scheduleSave();
    }));

    const compactBtn = $('warmupCompactToggle');
    if (compactBtn) {
      compactBtn.addEventListener('click', () => {
        warmupCompact = !warmupCompact;
        renderWarmup();
        scheduleSave();
      });
    }

    const onChangeSave = fn => () => { fn(); scheduleSave(); };
    ['targetWeight','topReps','warmupBar','warmupIncrement'].forEach(id => $(id).addEventListener('input', onChangeSave(renderWarmup)));
    ['charge','reps','rpe'].forEach(id => $(id).addEventListener('input', onChangeSave(renderRm)));
    ['targetRm','targetReps','targetRpe','targetIncrement'].forEach(id => $(id).addEventListener('input', onChangeSave(renderTarget)));
    $('useEstimatedRm').addEventListener('click', () => {
      if (lastEstimatedRm) {
        $('targetRm').value = lastEstimatedRm.toFixed(1);
        renderTarget();
        scheduleSave();
      }
    });
    document.querySelectorAll('[data-feel]').forEach(btn => {
      btn.addEventListener('click', () => handleAfterSet(btn.dataset.feel));
    });
    $('plateMode').addEventListener('change', () => { updatePlateMode(false); scheduleSave(); });
    $('plateBar').addEventListener('change', onChangeSave(renderPlates));
    $('plateTotal').addEventListener('input', onChangeSave(renderPlates));
    $('scoreUnit').addEventListener('change', () => {
      renderScoreInputsFromCanonical();
      renderScores();
      scheduleSave();
    });
    ['scoreBw','scoreTotal'].forEach(id => $(id).addEventListener('input', () => {
      syncCanonicalFromInputs();
      renderScores();
      scheduleSave();
    }));
    ['scoreSex','scoreEquipment'].forEach(id => $(id).addEventListener('change', onChangeSave(renderScores)));

    document.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', () => copyText(getCopyText(btn.dataset.copy), btn));
    });
    document.querySelectorAll('[data-reset]').forEach(btn => {
      btn.addEventListener('click', () => resetTool(btn.dataset.reset));
    });
    $('resetAll').addEventListener('click', resetAll);

    const navLinks = [...document.querySelectorAll('.tool-nav a[href^="#"]')];
    const setActiveNav = id => {
      navLinks.forEach(link => {
        const active = link.getAttribute('href') === `#${id}`;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    };
    navLinks.forEach(link => link.addEventListener('click', () => {
      const id = link.getAttribute('href').slice(1);
      if (id) setActiveNav(id);
    }));
    const sections = navLinks
      .map(link => document.getElementById(link.getAttribute('href').slice(1)))
      .filter(Boolean);
    if ('IntersectionObserver' in window && sections.length) {
      const observer = new IntersectionObserver(entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActiveNav(visible.target.id);
      }, { rootMargin: '-35% 0px -50% 0px', threshold: [0.1, 0.35, 0.6] });
      sections.forEach(section => observer.observe(section));
    }
    setActiveNav('warmup');

    renderWarmup();
    renderRm();
    renderTarget();
    renderPlates();
    renderScores();
  }

  document.addEventListener('DOMContentLoaded', init);
})(typeof window !== 'undefined' ? window : globalThis);
