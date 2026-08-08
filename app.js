(function (root) {
  'use strict';

  const core = (typeof module !== 'undefined' && module.exports)
    ? require('./force-core.js')
    : root.KRForce;

  if (!core) {
    throw new Error('KRForce canonical core is missing. Load force-core.js before app.js.');
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = core;
  }
  root.KRForce = core;

  if (typeof document === 'undefined') return;

  const {
    LB_TO_KG,
    RPE_LABELS,
    RPE_ORDER,
    PLATE_CONFIGS,
    finiteNumber,
    estimate1RM,
    targetLoad,
    suggestNextLoad,
    buildWarmupPlan,
    distributePlates,
    calculateScores
  } = core;


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
