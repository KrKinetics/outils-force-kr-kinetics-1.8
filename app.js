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

  function targetLoad(oneRm, reps, rpe, increment) {
    const rm = finiteNumber(oneRm, .01, MAX_LOAD);
    const inc = finiteNumber(increment, .01, 100);
    const r = Number(reps);
    const intensity = RPE_TABLE[String(rpe)]?.[r - 1];
    if (rm === null || inc === null || !Number.isInteger(r) || !intensity) return null;
    return { theoretical: rm * intensity, load: roundToIncrement(rm * intensity, inc), intensity };
  }

  function approachSteps(topReps) {
    switch (Number(topReps)) {
      case 1: return [{r:1,p:.85},{r:1,p:.91},{r:1,p:.95}];
      case 2: case 3: return [{r:1,p:.85},{r:1,p:.95}];
      case 4: return [{r:2,p:.90}];
      case 5: return [{r:1,p:.90}];
      case 6: return [{r:3,p:.88}];
      case 7: return [{r:3,p:.85}];
      case 8: return [{r:4,p:.85}];
      case 9: case 10: return [{r:5,p:.85}];
      default: return [];
    }
  }

  function buildWarmupPlan(options) {
    const target = finiteNumber(options.target, .01, MAX_LOAD);
    const reps = Number(options.topReps);
    const increment = finiteNumber(options.increment, .01, 100);
    const equipment = options.equipment;
    const minimum = equipment === 'barbell'
      ? finiteNumber(options.barWeight, 1, 100)
      : finiteNumber(options.minimum ?? 5, .01, 500);

    if (target === null || increment === null || minimum === null || !Number.isInteger(reps) || reps < 1 || reps > 10) {
      return { error:'Entrées invalides.' };
    }
    if (equipment === 'barbell' && target < minimum) {
      return { error:`Le top set (${target} lb) est inférieur au poids de la barre (${minimum} lb).` };
    }

    const roundedTop = roundToIncrement(target, increment);
    const topWeight = equipment === 'barbell' ? Math.max(minimum, roundedTop) : roundedTop;
    if (topWeight < minimum) return { error:'La charge réalisable est sous la charge minimale de l’équipement.' };

    if (Math.abs(topWeight - minimum) < 1e-9) {
      return {
        rows:[{reps, weight:topWeight, label:'Top set', top:true}],
        note: equipment === 'barbell'
          ? 'Aucune montée de charge n’est possible : le top set correspond à la barre sélectionnée.'
          : 'Aucune montée de charge distincte n’est nécessaire à cette charge.'
      };
    }

    const base = [{r:10,p:null},{r:5,p:.35},{r:4,p:.50},{r:3,p:.65},{r:2,p:.75}];
    const candidates = [...base, ...approachSteps(reps)];
    const rows = [];

    for (const step of candidates) {
      const raw = step.p === null ? minimum : target * step.p;
      const weight = Math.max(minimum, roundToIncrement(raw, increment));
      if (weight >= topWeight) continue;
      if (rows.length && weight <= rows[rows.length - 1].weight) continue;
      rows.push({ reps:step.r, weight, label:step.p === null && equipment === 'barbell' ? 'Barre vide' : `${Math.round((weight / target) * 100)} %` });
    }

    rows.push({reps, weight:topWeight, label:'Top set', top:true});
    return { rows, note: rows.length <= 2 ? 'Le nombre d’étapes a été réduit parce que la charge cible est proche de la charge minimale.' : '' };
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
    const dp = buildPlateDp(maxUnits, config.plates);
    const targetIsDiscrete = Math.abs(rawUnits - Math.round(rawUnits)) <= 1e-8;
    const targetUnits = Math.round(rawUnits);

    if (targetIsDiscrete) {
      const exact = dp.reconstruct(targetUnits);
      if (exact) return {plates:exact, exact:true, actualTotal:t, collarsTotal};
    }

    for (let units = maxUnits; units >= 0; units--) {
      const candidate = dp.reconstruct(units);
      if (candidate) {
        const actualTotal = b + collarsTotal + (units / scale) * 2;
        return {plates:candidate, exact:false, actualTotal, difference:t - actualTotal, collarsTotal};
      }
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

  const API = {RPE_TABLE,PLATE_CONFIGS,finiteNumber,roundToIncrement,estimate1RM,targetLoad,buildWarmupPlan,solveExactPlates,distributePlates,dotsCoefficient,wilksCoefficient,ipfGlCoefficient,calculateScores};
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.KRForce = API;

  if (typeof document === 'undefined') return;

  const $ = id => document.getElementById(id);
  let equipment = 'barbell';
  let lastEstimatedRm = null;
  let scoreCanonical = {bwKg:100,totalKg:500,unit:'kg'};

  function setMessage(el, text, type) {
    el.hidden = !text;
    el.textContent = text || '';
    el.className = `message${type ? ` ${type}` : ''}`;
  }

  function fillSelect(select, values, selected) {
    select.innerHTML = values.map(v => `<option value="${v}"${String(v)===String(selected)?' selected':''}>${v}</option>`).join('');
  }

  function renderWarmup() {
    $('warmupBarWrap').hidden = equipment !== 'barbell';
    $('warmupHint').textContent = equipment === 'barbell'
      ? 'La charge de la barre est incluse. Les étapes impossibles ou redondantes sont retirées automatiquement.'
      : equipment === 'dumbbells'
        ? 'La charge indiquée est celle d’un seul haltère.'
        : 'La charge indiquée correspond à la pile ou à la résistance affichée.';
    const plan = buildWarmupPlan({
      target:$('targetWeight').value, topReps:$('topReps').value, increment:$('warmupIncrement').value,
      equipment, barWeight:$('warmupBar').value, minimum:5
    });
    $('warmupBody').innerHTML = '';
    if (plan.error) { setMessage($('warmupMessage'), plan.error, 'error'); return; }
    setMessage($('warmupMessage'), plan.note, plan.note ? 'warn' : '');
    $('warmupBody').innerHTML = plan.rows.map((r,i) => `<tr><td>${i+1}${r.top?' — top set':''}</td><td>${r.reps}</td><td>${r.label}</td><td><strong>${r.weight.toFixed(r.weight%1?1:0)} lb</strong></td></tr>`).join('');
  }

  function renderRm() {
    const out = estimate1RM($('charge').value,$('reps').value,$('rpe').value);
    if (!out) { lastEstimatedRm=null; $('rmResult').textContent='1RM estimé : --'; return; }
    lastEstimatedRm=out.value;
    $('rmResult').textContent=`1RM estimé : ${out.value.toFixed(1)} lb · intensité ${(out.intensity*100).toFixed(1)} %`;
  }

  function renderTarget() {
    const out = targetLoad($('targetRm').value,$('targetReps').value,$('targetRpe').value,$('targetIncrement').value);
    if (!out) { $('targetLoadResult').textContent='Charge cible : --'; return; }
    $('targetLoadResult').textContent=`Charge réalisable : ${out.load.toFixed(out.load%1?1:0)} lb · théorique ${out.theoretical.toFixed(1)} lb · ${(out.intensity*100).toFixed(1)} %`;
  }

  function updatePlateMode() {
    const cfg=PLATE_CONFIGS[$('plateMode').value];
    $('plateBar').innerHTML=cfg.bars.map(b=>`<option value="${b.v}">${b.l}</option>`).join('');
    $('plateTotal').step=String(cfg.step);
    $('plateHint').textContent=cfg.note;
    renderPlates();
  }

  function renderPlates() {
    const cfg=PLATE_CONFIGS[$('plateMode').value];
    const total=Number($('plateTotal').value), bar=Number($('plateBar').value);
    const out=distributePlates(total,bar,cfg);
    $('plateBody').innerHTML=''; $('plateVisual').innerHTML='';
    if (out.error) { $('plateResult').textContent='--'; setMessage($('plateMessage'),out.error,'error'); return; }
    const counts=new Map(); out.plates.forEach(p=>counts.set(p.l,(counts.get(p.l)||0)+1));
    const summary=[...counts.entries()].map(([l,q])=>`${q}× ${l} ${cfg.unit}`).join(' + ') || 'aucun disque';
    $('plateResult').textContent=`Par côté : ${summary}`;
    $('plateVisual').innerHTML='<span class="bar-label">BARRE</span>' + (cfg.collarsEach?'<span class="collar-label">COLLET 2,5</span>':'') + out.plates.map(p=>`<span class="plate ${p.s||''}" style="background:${p.c};color:${p.t||'#fff'}">${p.l}</span>`).join('');
    $('plateBody').innerHTML=cfg.plates.filter(p=>counts.has(p.l)).map(p=>`<tr><td><strong>${p.l} ${cfg.unit}</strong></td><td>${counts.get(p.l)}</td><td>${counts.get(p.l)*2}</td></tr>`).join('');
    const text=out.exact
      ? `Poids confirmé : ${out.actualTotal} ${cfg.unit}${cfg.collarsEach?' · collets inclus':''}.`
      : `Charge exacte impossible avec ce jeu. Charge inférieure la plus proche : ${out.actualTotal} ${cfg.unit} (écart ${out.difference.toFixed(2)} ${cfg.unit}).`;
    setMessage($('plateMessage'),text,out.exact?'':'warn');
  }

  function syncCanonicalFromInputs() {
    const unit=$('scoreUnit').value;
    const bw=finiteNumber($('scoreBw').value,1,1000), total=finiteNumber($('scoreTotal').value,1,10000);
    if (bw!==null) scoreCanonical.bwKg=unit==='lb'?bw*LB_TO_KG:bw;
    if (total!==null) scoreCanonical.totalKg=unit==='lb'?total*LB_TO_KG:total;
    scoreCanonical.unit=unit;
  }

  function renderScoreInputsFromCanonical() {
    const unit=$('scoreUnit').value;
    $('scoreBw').value=(unit==='lb'?scoreCanonical.bwKg/LB_TO_KG:scoreCanonical.bwKg).toFixed(2).replace(/\.00$/,'');
    $('scoreTotal').value=(unit==='lb'?scoreCanonical.totalKg/LB_TO_KG:scoreCanonical.totalKg).toFixed(2).replace(/\.00$/,'');
    scoreCanonical.unit=unit;
  }

  function renderScores() {
    const out=calculateScores(scoreCanonical.bwKg,scoreCanonical.totalKg,$('scoreSex').value,$('scoreEquipment').value);
    if (!out) { $('dotsScore').textContent=$('wilksScore').textContent=$('ipfGlScore').textContent='--'; setMessage($('scoreMessage'),'Entrées invalides.','error'); return; }
    $('dotsScore').textContent=out.dots.toFixed(2); $('wilksScore').textContent=out.wilks.toFixed(2); $('ipfGlScore').textContent=out.ipfGl.toFixed(2);
    setMessage($('scoreMessage'),out.notes.length?out.notes.join(' '):'Aucun plafonnement de poids corporel appliqué.',out.notes.length?'warn':'');
  }

  function init() {
    fillSelect($('topReps'),[1,2,3,4,5,6,7,8,9,10],5);
    fillSelect($('reps'),[1,2,3,4,5,6,7,8,9,10,11,12],5);
    fillSelect($('targetReps'),[1,2,3,4,5,6,7,8,9,10,11,12],3);
    fillSelect($('rpe'),['10','9.5','9','8.5','8','7.5','7','6.5'],'8');
    fillSelect($('targetRpe'),['10','9.5','9','8.5','8','7.5','7','6.5'],'8');

    document.querySelectorAll('#warmupEquipment button').forEach(btn=>btn.addEventListener('click',()=>{
      equipment=btn.dataset.equip;
      document.querySelectorAll('#warmupEquipment button').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
      renderWarmup();
    }));
    ['targetWeight','topReps','warmupBar','warmupIncrement'].forEach(id=>$(id).addEventListener('input',renderWarmup));
    ['charge','reps','rpe'].forEach(id=>$(id).addEventListener('input',renderRm));
    ['targetRm','targetReps','targetRpe','targetIncrement'].forEach(id=>$(id).addEventListener('input',renderTarget));
    $('useEstimatedRm').addEventListener('click',()=>{ if(lastEstimatedRm){$('targetRm').value=lastEstimatedRm.toFixed(1);renderTarget();} });
    $('plateMode').addEventListener('change',updatePlateMode); $('plateBar').addEventListener('change',renderPlates); $('plateTotal').addEventListener('input',renderPlates);
    $('scoreUnit').addEventListener('change',()=>{renderScoreInputsFromCanonical();renderScores();});
    ['scoreBw','scoreTotal'].forEach(id=>$(id).addEventListener('input',()=>{syncCanonicalFromInputs();renderScores();}));
    ['scoreSex','scoreEquipment'].forEach(id=>$(id).addEventListener('change',renderScores));

    renderWarmup(); renderRm(); renderTarget(); updatePlateMode(); renderScores();
  }

  document.addEventListener('DOMContentLoaded',init);
})(typeof window !== 'undefined' ? window : globalThis);
