// ================= utils =================
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const iso = d => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const z = new Date(d); z.setDate(z.getDate() + n); return z; };
const MON = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
const DOW = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const DOWL = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const fdate = s => { const d = parseISO(s); return d.getDate() + ' ' + MON[d.getMonth()]; };
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
const r1 = x => Math.round(x * 10) / 10;
const fmtKg = x => (Math.round(x * 10) / 10).toString().replace('.', ',');
const roundStep = (x, st) => Math.max(0, Math.round(x / st) * st);
const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
const TODAY_ISO = iso(TODAY);
const BACK = ['traps','reardelts','midback','lats','lowerback','triceps','glutemed','glutemax','hamstrings'];
let PDFMAP = {}; PDFX.forEach(p => PDFMAP[p.id] = p);
const PELVIS_ICON = '<svg viewBox="0 0 40 40"><path d="M8 13c5-6 19-6 24 0l-3 11c-2 5-16 5-18 0z" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round"/><circle cx="20" cy="21" r="3" fill="var(--hot)"/></svg>';

function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
}

// ================= storage =================
const KEY = 'forma.v1';
let S;
// вес из Здоровья иногда приходит в фунтах (118 lb = 53,5 кг)
function lbToKg(w, date) {
  if (!w) return w; const prev = (S.body || []).filter(b => b.weight && b.date !== date && !b.lb).map(b => b.weight);
  const ref = prev.length ? prev[prev.length - 1] : S.profile && S.profile.weight;
  const k = w / 2.20462; const looksLb = ref ? (w / ref > 1.7 && w / ref < 2.7) : w > 100;
  return looksLb ? Math.round(k * 10) / 10 : w;
}
function fixLbBody() { if (!S || !Array.isArray(S.body) || S.settings?.lbFix) return; S.body.forEach(b => { if (b.weight) { const k = lbToKg(b.weight, b.date); if (k !== b.weight) b.weight = k; } }); S.settings = S.settings || {}; S.settings.lbFix = 1; }
function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function save() { S.updatedAt = Date.now(); saveLocal(); if (S.google) { if (gValid()) { clearTimeout(SYNC_T); SYNC_T = setTimeout(() => driveSync(false), 2500); } else S.google.pending = true; } }
const emptyState = () => ({sample:false, profile:{sex:'f',age:30,height:166,restHR:64,goal:'recomp',level:'beginner',freq:3,activity:1.375}, logs:[], body:[], health:{}, settings:{}, onboarded:false});
let FRESH = false;
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { S = JSON.parse(raw); fixLbBody(); return; } } catch (e) {}
  S = emptyState(); FRESH = true;
}

// ================= sample data =================
const START = {hip_thrust:30,leg_press:50,lat_pulldown:22.5,chest_press:15,seated_row:25,hip_abduction:30,reverse_fly:10,db_curl:4,
  rdl:8,bulgarian:0,leg_curl:15,chinup_grav:35,dips_grav:30,cable_kickback:5,triceps_pushdown:10,pullup_grav:40,hyperext:0,
  hip_adduction:25,pec_deck:15,triceps_machine:15,hammer:4,machine_crunch:15};
function seed() {
  const st = {sample:true, onboarded:true, profile:{set:true,sex:'f',age:30,height:166,restHR:64,goal:'recomp',level:'beginner',freq:3,activity:1.375},
    logs:[], body:[], health:{}, settings:{}};
  // workouts: last 4 weeks of Mon/Wed/Fri before today
  const days = [];
  for (let i = 28; i >= 1; i--) { const d = addDays(TODAY, -i); const k = Object.keys(PLAN).find(k => PLAN[k].dow === d.getDay()); if (k) days.push([iso(d), k]); }
  const prog = {}; // exId -> {w, reps:[...]}
  let seedN = 7; const rnd = () => (seedN = (seedN * 9301 + 49297) % 233280) / 233280;
  days.forEach(([date, k], idx) => {
    const plan = PLAN[k]; const sets = {};
    plan.main.forEach(([id, n, lo, hi]) => {
      const ex = EX[id]; const key = id + '_' + k;
      if (!prog[key]) prog[key] = {w: k === 'C' && START[id] ? Math.max(0, START[id] - (ex.kind === 'a' ? -5 : ex.step)) : (START[id] || 0), r: lo};
      const P = prog[key];
      const arr = [];
      for (let s = 0; s < n; s++) arr.push({w: P.w, r: Math.max(lo - 1, Math.min(hi, P.r - (s === n - 1 && rnd() < .4 ? 1 : 0))), done: true});
      sets[id] = arr;
      if (arr.every(x => x.r >= hi)) { if (ex.kind === 'a') P.w = Math.max(0, P.w - ex.step); else if (ex.kind === 'w') P.w += ex.step; P.r = lo; }
      else P.r = Math.min(hi, P.r + (rnd() < .75 ? 1 : 2));
    });
    const startT = parseISO(date); startT.setHours(18, 30);
    const dur = 80 + Math.round(rnd() * 12);
    const hr = 112 + Math.round(rnd() * 12);
    st.logs.push({id: 'l' + idx, date, day: k, start: +startT, end: +startT + dur * 60000, sets, warm: true, mob: true, avgHR: hr,
      kcal: Math.round(260 + rnd() * 80), src: 'Apple Watch'});
  });
  st.logs.forEach(l => { const keep = S; S = st; l.prs = prsFor(l); S = keep; });
  // body weight & measurements
  let w = 62.4;
  for (let i = 30; i >= 0; i -= 3) {
    w = r1(w - 0.06 - rnd() * 0.08 + (rnd() < .3 ? 0.15 : 0));
    const e = {date: iso(addDays(TODAY, -i)), weight: w};
    if (i % 9 === 0) Object.assign(e, {waist: r1(70.6 - (30 - i) * 0.03), hips: r1(95.8 + (30 - i) * 0.025), thigh: r1(55.2 + (30 - i) * 0.01)});
    st.body.push(e);
  }
  // nutrition from Yazio via Apple Health
  for (let i = 13; i >= 0; i--) {
    const d = iso(addDays(TODAY, -i));
    st.health[d] = i === 0 ? {eatKcal: 1240, protein: 74, fat: 41, carbs: 128, activeKcal: 210, steps: 6120}
      : {eatKcal: Math.round(1650 + rnd() * 300), protein: Math.round(78 + rnd() * 34), fat: Math.round(48 + rnd() * 20), carbs: Math.round(170 + rnd() * 50), activeKcal: Math.round(320 + rnd() * 260), steps: Math.round(6000 + rnd() * 5000)};
  }
  return st;
}

// ================= domain helpers =================
const curWeight = () => (S.body.length ? S.body[S.body.length - 1].weight : (S.profile.weight || 60));
function planKeyFor(date) { return Object.keys(PLAN).find(k => PLAN[k].dow === date.getDay()) || null; }
function getItem(id) {
  if (EX[id]) return {type:'gym', id, ...EX[id]};
  if (PDFMAP[id]) return {type:'pdf', id, ...PDFMAP[id], name: PDFMAP[id].title};
  const w = WARM.find(x => x.id === id); if (w) return {type:'warm', ...w};
  return null;
}
function e1rm(w, r) { if (!w || !r) return 0; return r <= 10 ? (w * (1 + r / 30) + w * 36 / (37 - r)) / 2 : w * (1 + r / 30); }
function exHistory(exId) {
  const out = [];
  S.logs.forEach(l => { const s = l.sets[exId]; if (s && s.length) out.push({date: l.date, day: l.day, end: l.end, sets: s}); });
  return out.sort((a, b) => a.date < b.date ? -1 : 1);
}
function topSet(sets) { return sets.reduce((b, s) => (e1rm(s.w, s.r) > e1rm(b.w, b.r) ? s : b), sets[0]); }
function unitOf(ex) { return ex.kind === 'a' ? 'кг помощи' : ex.kind === 't' ? 'сек' : ex.kind === 'band' ? 'резинка' : ex.kind === 'bw' ? 'свой вес' : (ex.unit || 'кг'); }

// ---------- рабочие веса ----------
const WEIGHTED = k => k === 'w' || k === 'a' || k === 'bw';
function manualW(id) { const m = S.weights && S.weights[id]; if (!m) return null; const h = exHistory(id); const lastEnd = h.length ? h[h.length - 1].end || 0 : 0; return m.at > lastEnd ? m : null; }
function curW(id, k) { const sg = suggest(id, k || Object.keys(PLAN).find(x => PLAN[x].main.some(m => m[0] === id)) || 'A'); return sg; }
function wLabel(ex, w, bw) {
  if (ex.kind === 'a') return bw || w === 0 ? 'без помощи' : w == null ? 'не указан' : fmtKg(w) + ' кг помощи';
  if (ex.kind === 'bw') return w > 0 && !bw ? '+' + fmtKg(w) + ' кг' : 'без веса';
  if (ex.kind === 'w') return bw || w === 0 ? 'без веса' : w == null ? 'не указан' : fmtKg(w) + ' ' + (ex.unit || 'кг');
  return unitOf(ex);
}
function setW(id, w, bw) { S.weights = S.weights || {}; S.weights[id] = {w: w == null || isNaN(w) ? null : r1(w), bw: !!bw, at: Date.now()}; save(); }
// double progression: next session suggestion
function suggest(exId, dayKey) {
  const r = suggestRaw(exId, dayKey); const ex = EX[exId];
  if (r.bw == null) r.bw = (ex.kind === 'w' || ex.kind === 'a') && r.w === 0;
  return r;
}
function suggestRaw(exId, dayKey) {
  const ex = EX[exId]; const row = PLAN[dayKey]?.main.find(m => m[0] === exId);
  const lo = row ? row[2] : 8, hi = row ? row[3] : 12;
  const mw = manualW(exId);
  if (mw) return {w: mw.bw ? 0 : mw.w, bw: mw.bw || (ex.kind === 'bw' && !mw.w), target: lo + '–' + hi, dir: 'same', why: mw.bw ? 'Без веса — как ты указала.' : 'Рабочий вес, который ты указала.'};
  let h = exHistory(exId).filter(x => x.day === dayKey); if (!h.length) h = exHistory(exId);
  if (!h.length) return {w: null, target: lo + '–' + hi, dir: 'new', why: 'Первый раз: подбери вес, чтобы последние 2 повтора давались тяжело, но чисто.'};
  const last = h[h.length - 1].sets; const w = last[0].w;
  if (ex.kind === 'bw' || ex.kind === 'band' || ex.kind === 't') {
    const all = last.every(s => s.r >= hi);
    return {w, target: all ? (ex.kind === 't' ? hi + 5 + ' сек' : 'усложни') : (Math.min(hi, Math.max(...last.map(s => s.r)) + 1) + (ex.kind === 't' ? ' сек' : '')), dir: all ? 'up' : 'same',
      why: all ? (ex.kind === 'bw' ? 'Верхняя граница взята во всех подходах — добавь блин или гантель.' : ex.kind === 'band' ? 'Возьми резинку потуже.' : 'Добавь 5 секунд.') : 'Добавь повтор в каждом подходе.'};
  }
  const allTop = last.every(s => s.r >= hi), anyFail = last.some(s => s.r < lo);
  const prev = h.length > 1 ? h[h.length - 2].sets : null; const failTwice = anyFail && prev && prev.some(s => s.r < lo) && prev[0].w === w;
  if (allTop) { const nw = ex.kind === 'a' ? Math.max(0, w - ex.step) : w + ex.step; return {w: nw, target: lo + '–' + hi, dir: ex.kind === 'a' ? 'dn' : 'up', why: ex.kind === 'a' ? 'Все подходы на верхней границе — уменьши помощь на ' + ex.step + ' кг.' : 'Все подходы на верхней границе — +' + fmtKg(ex.step) + ' кг, начни снова с ' + lo + '.'}; }
  if (failTwice) { const nw = ex.kind === 'a' ? w + ex.step : roundStep(w * 0.9, ex.step); return {w: nw, target: lo + '–' + hi, dir: 'same', why: 'Два раза подряд ниже ' + lo + ' повторов — сбрось ~10% и набери заново.'}; }
  const best = Math.max(...last.map(s => s.r));
  return {w, target: Math.min(hi, best + 1) + '+', dir: 'same', why: 'Вес тот же, добавь по повтору. Цель — ' + hi + ' во всех подходах.'};
}

function proteinFor(dayKey) {
  const load = dayKey ? PLAN[dayKey].load : 'rest';
  let f = load === 'heavy' ? 2.0 : load === 'medium' ? 1.8 : 1.6;
  if (S.profile.goal === 'cut') f = Math.min(2.2, f + 0.2);
  const g = Math.round(f * curWeight());
  return {g, f, perMeal: Math.round(0.4 * curWeight()), post: dayKey ? '25–35 г в течение 2 ч после тренировки' : null};
}
function keytel(hr, kg, age, sex, min) {
  const perMin = sex === 'm' ? (-55.0969 + 0.6309 * hr + 0.1988 * kg + 0.2017 * age) / 4.184 : (-20.4022 + 0.4472 * hr - 0.1263 * kg + 0.074 * age) / 4.184;
  return Math.max(0, perMin * min);
}
const metKcal = (met, kg, min) => met * 3.5 * kg / 200 * min;
function sessionMinutes(k) { const p = PLAN[k]; const sets = p.main.reduce((a, m) => a + m[1], 0) + p.act.reduce((a, x) => a + x.sets, 0); return {warm: 15, main: Math.round(sets * 2.6), mob: 8, total: 15 + Math.round(sets * 2.6) + 8}; }
const nSets = sets => Object.values(sets).reduce((a, x) => a + x.length, 0);
function tonnage(sets) { let t = 0; Object.entries(sets).forEach(([id, arr]) => { const ex = EX[id]; if (ex && ex.kind === 'w') arr.forEach(s => { if (s.done) t += s.w * s.r * (ex.unit ? 2 : 1); }); }); return Math.round(t); }

// ================= muscle map =================
const SH = {
  front:{shoulders:'<ellipse cx="85" cy="53" rx="7" ry="8"/>',chest:'<path d="M61 49 Q74 45 82 52 Q83 64 72 68 Q63 68 61 62 Z"/>',
    biceps:'<ellipse cx="91" cy="73" rx="4.5" ry="11" transform="rotate(-10 91 73)"/>',forearms:'<ellipse cx="99" cy="106" rx="4" ry="14" transform="rotate(-14 99 106)"/>',
    abs:'<rect x="61.5" y="72" width="8" height="12" rx="3"/><rect x="61.5" y="86" width="8" height="12" rx="3"/><rect x="61.5" y="100" width="8" height="17" rx="3"/>',
    obliques:'<path d="M71.5 74 Q80 78 81 96 Q80 116 72 121 L71.5 100 Z"/>',hipflexors:'<ellipse cx="68" cy="131" rx="4.5" ry="6" transform="rotate(-25 68 131)"/>',
    abductors:'<ellipse cx="80" cy="147" rx="3.4" ry="9"/>',quads:'<ellipse cx="72.5" cy="169" rx="7.6" ry="23"/>',adductors:'<ellipse cx="63.6" cy="160" rx="3" ry="15"/>',
    calves:'<ellipse cx="75.5" cy="216" rx="4.5" ry="15"/>'},
  back:{traps:'<path d="M60 34 L70 42 L80 47 L68 55 L60 63 Z"/>',reardelts:'<ellipse cx="85" cy="53" rx="7" ry="8"/>',
    midback:'<path d="M61 65 L69 57 L74 61 L72 74 L61 80 Z"/>',lats:'<path d="M75 63 Q84 65 84 77 Q80 98 66 110 L65 92 L73 78 Z"/>',
    lowerback:'<rect x="61.5" y="91" width="7" height="32" rx="3"/>',triceps:'<ellipse cx="91" cy="73" rx="4.5" ry="11" transform="rotate(-10 91 73)"/>',
    forearms:'<ellipse cx="99" cy="106" rx="4" ry="14" transform="rotate(-14 99 106)"/>',glutemed:'<ellipse cx="75.5" cy="131" rx="7.5" ry="5.5"/>',
    glutemax:'<ellipse cx="70" cy="143.5" rx="9.6" ry="10"/>',hamstrings:'<ellipse cx="71.5" cy="176" rx="7.5" ry="20"/>',adductors:'<ellipse cx="63.4" cy="164" rx="2.6" ry="11"/>',
    calves:'<ellipse cx="73" cy="216" rx="6" ry="15"/>'}
};
const SIL_HALF = '<path d="M60 40 L76 42 Q86 45 87 56 L84 78 L82 100 L83 124 Q84 134 80 140 L60 142 Z"/><path d="M84 47 Q93 49 95 62 L97 86 L102 108 L105 128 Q105 135 100 133 L95 112 L89 90 L85 70 Z"/><path d="M60 140 L80 137 Q87 150 84 172 L80 200 L80 236 L82 252 L71 254 L69 236 L67 200 L63 172 L60 150 Z"/>';
const SIL_MID = '<circle cx="60" cy="20" r="12"/><rect x="54" y="29" width="12" height="12" rx="3"/>';
function figure(view, p, s, cmap) {
  const col = id => cmap ? (cmap[id] || 'var(--idle)') : p.includes(id) ? 'var(--hot)' : s.includes(id) ? 'var(--warm)' : 'var(--idle)';
  const half = Object.entries(SH[view]).map(([id, d]) => `<g fill="${col(id)}">${d}</g>`).join('');
  return `<g fill="var(--body)">${SIL_MID}${SIL_HALF}<g transform="translate(120 0) scale(-1 1)">${SIL_HALF}</g></g>${half}<g transform="translate(120 0) scale(-1 1)">${half}</g>`;
}
function bodyMap(p = [], s = [], cmap) {
  return `<svg viewBox="0 0 250 272" role="img" aria-label="Карта мышц: спереди и сзади">${figure('front', p, s, cmap)}<g transform="translate(130 0)">${figure('back', p, s, cmap)}</g>
    <text x="60" y="270" text-anchor="middle" font-size="10" fill="var(--muted)">спереди</text><text x="190" y="270" text-anchor="middle" font-size="10" fill="var(--muted)">сзади</text></svg>`;
}
function miniMap(p = [], s = []) {
  const view = p.some(x => BACK.includes(x)) ? 'back' : 'front';
  return `<svg viewBox="30 30 60 170" aria-hidden="true">${figure(view, p, s)}</svg>`;
}
function thumb(id) {
  const it = getItem(id); if (!it) return '';
  if (it.type === 'pdf') { const u = photo(it.imgs[0]); return u ? `<div class="thumb"><img src="${u}" alt="" loading="lazy"></div>` : `<div class="thumb pelvis" aria-hidden="true">${PELVIS_ICON}</div>`; }
  if (it.type === 'warm') return `<div class="thumb">${miniMap(it.mus || EX.stepper.p, [])}</div>`;
  return `<div class="thumb">${miniMap(it.p, it.s)}</div>`;
}

// ================= charts =================
function lineChart(pts, o = {}) {
  const W = 320, H = o.h || 130, pl = 30, pr = 10, pt = 10, pb = 20;
  const all = pts.concat(o.proj || []);
  if (pts.length < 2) return '<p class="small muted">Нужно минимум две записи, чтобы показать график.</p>';
  const xs = all.map(p => +parseISO(p.x)), ys = all.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs); let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = (y1 - y0) * 0.15 || 1; y0 -= pad; y1 += pad;
  const X = t => pl + (t - x0) / (x1 - x0 || 1) * (W - pl - pr), Y = v => pt + (1 - (v - y0) / (y1 - y0)) * (H - pt - pb);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + X(+parseISO(p.x)).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
  const area = path + ` L${X(+parseISO(pts[pts.length - 1].x)).toFixed(1)} ${H - pb} L${X(+parseISO(pts[0].x)).toFixed(1)} ${H - pb} Z`;
  const grid = [0, .5, 1].map(f => { const v = y0 + (y1 - y0) * f; return `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${pl - 4}" y="${Y(v) + 3}" text-anchor="end">${fmtKg(Math.round(v * 10) / 10)}</text>`; }).join('');
  const last = pts[pts.length - 1];
  let proj = '';
  if (o.proj && o.proj.length) { const a = [last].concat(o.proj); proj = `<path d="${a.map((p, i) => (i ? 'L' : 'M') + X(+parseISO(p.x)).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="4 4"/>`; const e = o.proj[o.proj.length - 1]; proj += `<circle cx="${X(+parseISO(e.x))}" cy="${Y(e.y)}" r="3.5" fill="var(--bg)" stroke="var(--accent)" stroke-width="2"/>`; }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'График')}">${grid}
    <path d="${area}" fill="var(--hot)" opacity=".12"/><path d="${path}" fill="none" stroke="var(--hot)" stroke-width="2.2" stroke-linejoin="round"/>${proj}
    <circle cx="${X(+parseISO(last.x))}" cy="${Y(last.y)}" r="4" fill="var(--hot)"/>
    <text x="${pl}" y="${H - 5}">${fdate(pts[0].x)}</text><text x="${W - pr}" y="${H - 5}" text-anchor="end">${fdate(all[all.length - 1].x)}</text></svg>`;
}

// ================= rendering shell =================
let TAB = 'today', PLANTAB = planKeyFor(TODAY) || nextWorkout().key, LIBCAT = 'all', LIBQ = '', JTAB = 'calendar';
function nextWorkout() { for (let i = 0; i < 8; i++) { const d = addDays(TODAY, i); const k = planKeyFor(d); if (k) return {key: k, date: d, inDays: i}; } return {key: 'A', date: TODAY, inDays: 0}; }

const ICONS = {
  today:'<svg viewBox="0 0 24 24"><path d="M12 3.5c3 2.6 5 5.4 5 8.6a5 5 0 0 1-10 0c0-3.2 2-6 5-8.6z"/><path d="M12 20.5v-3"/></svg>',
  plan:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="4"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  lib:'<svg viewBox="0 0 24 24"><path d="M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11"/></svg>',
  journal:'<svg viewBox="0 0 24 24"><path d="M4 18l5-6 4 3 7-8"/><circle cx="20" cy="7" r="1.2"/></svg>',
  calc:'<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="4"/><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/></svg>',
  gear:'<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="3.5"/><path d="M5 20c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5"/></svg>',
  sync:'<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/></svg>'
};
const GOOGLE_G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.4 5.7c4.3-4 6.9-9.9 6.9-17.2z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
const TABS = [['today','Сегодня'],['plan','План'],['lib','Упражнения'],['journal','Журнал'],['calc','Расчёты']];

function render() {
  const acct = S.google?.picture ? `<button class="icon-btn" data-act="settings" aria-label="Аккаунт и настройки"><img src="${esc(S.google.picture)}" alt="" referrerpolicy="no-referrer"></button>`
    : `<button class="icon-btn" data-act="settings" aria-label="Профиль и настройки">${ICONS.gear}</button>`;
  const cloud = S.google && !gValid() && (S.google.pending || weeklyDue()) ? '<button class="pill warn" data-act="gsync">Сохранить в Google</button>' : '';
  $('#app').innerHTML = `
    <header class="top">
      <div class="logo" aria-label="forma">forma<i>.</i></div>
      <div class="top-actions">${S.sample ? '<button class="sample-pill" data-act="settings">Пример данных</button>' : ''}${cloud}${acct}</div>
    </header>
    <main id="screen">${({today: vToday, plan: vPlan, lib: vLib, journal: vJournal, calc: vCalc})[TAB]()}</main>`;
  $('#nav').innerHTML = `<div class="nav-in">${TABS.map(([k, l]) => `<button data-tab="${k}" ${TAB === k ? 'aria-current="page"' : ''}>${ICONS[k]}<span>${l}</span></button>`).join('')}</div>`;
  if (TAB === 'calc') calcAll();
  if (!document.getElementById('totop')) { document.body.insertAdjacentHTML('beforeend', '<button id="totop" data-act="top" aria-label="Наверх">↑</button>'); addEventListener('scroll', () => document.getElementById('totop').classList.toggle('on', scrollY > 900), {passive: true}); }
}

// ---------- кольца, восстановление, рекорды ----------
function ringSVG(segs, size = 112, stroke = 9) {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r, gap = segs.length > 1 ? 10 : 0;
  let off = 0; const out = [];
  segs.forEach(s => { const len = C / segs.length - gap; const fill = Math.max(0, Math.min(1, s.frac)) * len;
    out.push(`<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--sunk)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}"/>`);
    if (fill > 0) out.push(`<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${fill} ${C - fill}" stroke-dashoffset="${-off}" style="--len:${fill};animation:draw 1.1s cubic-bezier(.2,.8,.2,1)"/>`);
    off += C / segs.length; });
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true">${out.join('')}</svg>`;
}
const BIG = ['glutemax','quads','hamstrings','lats','midback','lowerback','chest','adductors'];
const RG = [['Ягодицы',['glutemax','glutemed']],['Задняя поверхность бедра',['hamstrings']],['Квадрицепс',['quads']],['Спина',['lats','midback']],['Поясница',['lowerback']],['Грудь',['chest']],['Плечи',['shoulders','reardelts']],['Руки',['biceps','triceps']],['Пресс',['abs','obliques']],['Приводящие',['adductors']]];
function recovery(now = Date.now()) {
  const fat = {};
  S.logs.forEach(l => {
    const h = (now - l.end) / 36e5; if (h < 0 || h > 130) return;
    const load = {};
    Object.entries(l.sets).forEach(([id, arr]) => { const e = EX[id]; if (!e) return; const n = arr.length;
      e.p.forEach(m => load[m] = (load[m] || 0) + n); e.s.forEach(m => load[m] = (load[m] || 0) + n * 0.5); });
    Object.entries(load).forEach(([m, L]) => { const T = (BIG.includes(m) ? 72 : 48) * Math.min(1.2, Math.max(0.5, L / 4)); const f = Math.max(0, 1 - h / T); if (f > (fat[m] || 0)) fat[m] = f; });
  });
  const out = {}; Object.keys(MUSCLES).forEach(m => out[m] = Math.round(100 * (1 - (fat[m] || 0)))); return out;
}
const recColor = p => p < 50 ? 'var(--hot)' : p < 85 ? 'var(--warm)' : 'var(--fresh)';
function recoveryCard() {
  const r = recovery(); const cmap = {}; Object.entries(r).forEach(([m, p]) => cmap[m] = recColor(p));
  const g = RG.map(([n, ms]) => [n, Math.min(...ms.map(m => r[m]))]);
  const grp = (lo, hi) => g.filter(x => x[1] >= lo && x[1] < hi);
  const tired = grp(0, 50), mid = grp(50, 85), ready = grp(85, 101);
  const li = (t, arr) => arr.length ? `<div><b>${t}</b>${arr.map(x => x[0] + (x[1] < 100 ? ` <span class="muted num">${x[1]}%</span>` : '')).join(', ')}</div>` : '';
  const meta = tired.length ? 'отдыхают: ' + tired.slice(0, 2).map(x => x[0].toLowerCase()).join(', ') + (tired.length > 2 ? '…' : '') : mid.length ? 'почти всё готово' : 'все мышцы готовы';
  return fold('recov', '<h2>Восстановление</h2>', meta, `
    <div class="recov">${bodyMap([], [], cmap)}<div class="rlist">${tired.length || mid.length ? li('Отдыхают', tired) + li('Почти готовы', mid) + li('Готовы', ready) : '<div><b>Всё готово</b>Мышцы восстановились — можно работать в полную силу.</div>'}</div></div>
    <div class="legend3"><span><i style="background:var(--hot)"></i>нагружены</span><span><i style="background:var(--warm)"></i>восстанавливаются</span><span><i style="background:var(--fresh)"></i>готовы</span></div>`);
}
function bestBefore(id, end) {
  let w = 0, e = 0, a = Infinity, r = 0, had = false;
  S.logs.forEach(l => { if (l.end >= end) return; const arr = l.sets[id]; if (!arr) return; had = true; arr.forEach(s => { w = Math.max(w, s.w); e = Math.max(e, e1rm(s.w, s.r)); if (s.r > 0) a = Math.min(a, s.w); r = Math.max(r, s.r); }); });
  return {w, e, a, r, had};
}
function prsFor(log) {
  const out = [];
  Object.entries(log.sets).forEach(([id, arr]) => { const ex = EX[id]; if (!ex || !arr.length) return; const b = bestBefore(id, log.end); if (!b.had) return;
    if (ex.kind === 'w') { const mw = Math.max(...arr.map(s => s.w)), me = Math.max(...arr.map(s => e1rm(s.w, s.r)));
      if (mw > b.w) out.push({id, text: fmtKg(mw) + ' ' + unitOf(ex), label: 'новый рабочий вес'});
      else if (me > b.e * 1.02) out.push({id, text: '1ПМ ≈ ' + fmtKg(r1(me)) + ' кг', label: 'новый расчётный максимум'}); }
    else if (ex.kind === 'a') { const ma = Math.min(...arr.map(s => s.w)); if (ma < b.a) out.push({id, text: fmtKg(ma) + ' кг помощи', label: 'меньше помощи'}); }
    else { const mr = Math.max(...arr.map(s => s.r)); if (mr >= b.r + (ex.kind === 't' ? 5 : 2)) out.push({id, text: mr + (ex.kind === 't' ? ' сек' : ' повт.'), label: 'больше повторов'}); }
  });
  return out;
}
function weekStats() {
  const monday = addDays(TODAY, -((TODAY.getDay() + 6) % 7));
  const wkKey = d => iso(addDays(d, -((d.getDay() + 6) % 7)));
  const by = {}; S.logs.forEach(l => { const k = wkKey(parseISO(l.date)); (by[k] = by[k] || new Set()).add(l.day); });
  const done = by[iso(monday)] || new Set();
  let streak = done.size >= 3 ? 1 : 0; let d = addDays(monday, -7);
  while (by[iso(d)] && by[iso(d)].size >= 3) { streak++; d = addDays(d, -7); }
  return {monday, done, streak};
}
function greeting() {
  const h = new Date().getHours(); const g = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
  const n = S.google?.name || S.profile.name; return n ? `${g}, <em>${esc(n)}</em>` : g;
}

// ---------- Сегодня ----------
function vToday() {
  const k = planKeyFor(TODAY); const nx = nextWorkout(); const pr = proteinFor(k); const hd = S.health[TODAY_ISO] || {};
  const doneToday = S.logs.find(l => l.date === TODAY_ISO);
  const ws = weekStats();
  const week = [...Array(7)].map((_, i) => { const d = addDays(ws.monday, i); const kk = planKeyFor(d); const done = S.logs.some(l => l.date === iso(d));
    const dk = S.logs.find(l => l.date === iso(d))?.day || kk; return `<button class="wd ${dk ? 'on d' + dk : ''} ${iso(d) === TODAY_ISO ? 'today' : ''} ${done ? 'done' : ''}" data-act="day" data-date="${iso(d)}" aria-label="${DOWL[d.getDay()]}${done ? ', тренировка сделана' : ''}">${DOW[d.getDay()]}<b>${dk || '·'}</b></button>`; }).join('');
  const hk = k || nx.key, P = PLAN[hk];
  const rec = recovery(); const gl = Math.min(rec.glutemax, rec.glutemed);
  const recNote = k && gl < 70 ? `<p class="small"><b>Ягодицы восстановились на ${gl}%</b> — сегодня оставляй 2–3 повтора в запасе.</p>` : '';
  const hero = `
    <section class="hero d${hk}" aria-label="${k ? 'Тренировка сегодня' : 'День отдыха'}"><span class="letter" aria-hidden="true">${hk}</span>
      <span class="eyebrow">${k ? 'Сегодня · тренировка ' + k : 'Сегодня ' + DOWL[TODAY.getDay()] + ' · отдых'}</span>
      <h1>${k ? P.title : (nx.inDays === 1 ? 'Завтра' : DOWL[nx.date.getDay()][0].toUpperCase() + DOWL[nx.date.getDay()].slice(1)) + ' — ' + P.title.toLowerCase()}</h1>
      <p>${k ? P.accent.split('. ')[0] + '.' : 'День восстановления. Можно сделать 12-минутный комплекс для таза из гида — он не мешает отдыху.'}</p>
      <div class="meta"><span class="tag day">≈ ${sessionMinutes(hk).total} мин</span><span class="tag day">${P.main.length} упражнений</span>${doneToday ? '<span class="tag good">сегодня сделано</span>' : ''}</div>
      ${recNote}
      <div class="row wrap">${k ? `<button class="btn day" data-act="start" data-k="${k}">${doneToday ? 'Ещё раз' : 'Начать тренировку'}</button><button class="btn line sm" data-act="gotoplan" data-k="${k}">План дня</button>`
        : `<button class="btn day" data-act="restflow">Комплекс 12 минут</button><button class="btn line sm" data-act="start" data-k="${nx.key}">Начать ${nx.key} сейчас</button>`}</div>
    </section>`;
  const eat = hd.protein || 0; const pfrac = Math.min(1, eat / pr.g);
  const lastLog = S.logs[S.logs.length - 1];
  const month = S.logs.filter(l => l.end > Date.now() - 30 * 864e5).flatMap(l => (l.prs || []).map(p => ({...p, date: l.date})));
  const resume = SES ? `<button class="note" data-act="resume" style="border:0;text-align:left"><b>Тренировка ${SES.k} не завершена.</b> Нажми, чтобы продолжить.</button>` : '';
  return `<div class="screen">
    <p class="greet">${greeting()}</p>
    ${resume}${profileCard()}${!S.logs.length && !Object.keys(S.weights || {}).length && !S.sample ? '<section class="card"><div class="row between"><h2>Рабочие веса</h2><span class="tag hot">2 минуты</span></div><p class="small muted">Впиши, с какими весами работаешь сейчас, — forma. подставит их в тренировки и будет подсказывать прибавку.</p><button class="btn block" data-act="weights">Указать веса</button></section>' : ''}${hero}${backupReminder()}
    <section class="card"><div class="ringrow">
      <div class="ring">${ringSVG(['A','B','C'].map(x => ({frac: ws.done.has(x) ? 1 : 0, color: 'var(--d' + x + ')'})))}<div class="c"><div><b>${ws.done.size}/3</b><span>на неделе</span></div></div></div>
      <div style="display:flex;flex-direction:column;gap:10px;min-width:0"><div class="weekdays">${week}</div>
        <p class="small">${ws.streak ? `<b>Серия: ${ws.streak} ${plural(ws.streak, 'неделя', 'недели', 'недель')}</b> по 3 тренировки` : 'Сделай 3 тренировки за неделю — начнётся серия.'}</p></div>
    </div></section>
    ${recoveryCard()}
    <section class="card" aria-label="Белок"><div class="ringrow">
      <div class="ring">${ringSVG([{frac: pfrac, color: 'var(--accent)'}])}<div class="c"><div><b>${eat}</b><span>из ${pr.g} г</span></div></div></div>
      <div style="display:flex;flex-direction:column;gap:6px;min-width:0"><h2>Белок</h2>
        <p class="small muted">${k ? (PLAN[k].load === 'heavy' ? 'Тяжёлый' : 'Тренировочный') + ' день' : 'День отдыха'} · ${pr.f.toString().replace('.', ',')} г/кг. ${pr.post ? 'После зала — 25–35 г.' : 'По ~' + pr.perMeal + ' г на приём.'}</p>
        <span class="src"><span class="dot ${S.settings.lastSync === TODAY_ISO ? '' : 'off'}"></span>Yazio → Apple Health</span></div>
    </div></section>
    <section class="grid2">
      ${!Object.keys(S.health).length ? '<button class="stat" data-act="sync" style="grid-column:1/-1;border:1px dashed var(--line)"><span>Apple Health и Yazio ещё не подтянуты</span><b style="font-size:20px">Синхронизировать</b></button>' : ''}
      <div class="stat"><span>Съедено, Yazio</span><b>${hd.eatKcal ? (hd.eatEst ? '≈' : '') + hd.eatKcal : '—'}</b><span>${hd.eatEst ? 'ккал · по БЖУ' : 'ккал'}</span></div>
      <div class="stat"><span>Активные, Apple Health</span><b>${hd.activeKcal ?? '—'}</b><span>ккал</span></div>
      <div class="stat"><span>Вес тела</span><b>${fmtKg(curWeight())}</b><span>кг</span></div>
      <div class="stat"><span>Б · Ж · У</span><b>${hd.protein ?? '—'}·${hd.fat ?? '—'}·${hd.carbs ?? '—'}</b><span>г</span></div>
    </section>
    ${month.length ? fold('prm', '<h2>Рекорды за месяц</h2>', `<span class="tag pr">${month.length} PR</span>`, `
      <div class="prs">${month.slice(-3).reverse().map(p => `<div class="prrow"><span class="small">${esc(EX[p.id].name)}<br><span class="muted">${fdate(p.date)} · ${p.label}</span></span><b>${p.text}</b></div>`).join('')}</div>
      <button class="btn line sm" data-act="gotorec">Все рекорды</button>`) : ''}
    ${lastLog ? `<section class="card d${lastLog.day}"><div class="row between"><h2>Последняя тренировка</h2><span class="tag day">${lastLog.day}</span></div>
      <div class="grid3"><div class="stat"><span>${fdate(lastLog.date)}</span><b>${Math.round((lastLog.end - lastLog.start) / 60000)}</b><span>мин</span></div>
      <div class="stat"><span>Подходов</span><b>${nSets(lastLog.sets)}</b><span>рабочих</span></div>
      <div class="stat"><span>${esc(lastLog.src || 'оценка')}</span><b>${lastLog.kcal}</b><span>ккал</span></div></div>
      <button class="btn line sm" data-act="log" data-id="${lastLog.id}">Подробнее</button></section>` : ''}
  </div>`;
}

// ---------- План ----------
function itemRow(id, right, sub, extra = '') {
  const it = getItem(id);
  return `<button class="item" data-act="ex" data-id="${id}">${thumb(id)}<div><div class="t">${esc(it.name)}</div>${sub ? `<div class="s">${sub}</div>` : ''}${extra}</div><div class="r">${right}</div></button>`;
}
function vPlan() {
  const k = PLANTAB, p = PLAN[k], m = sessionMinutes(k);
  const main = p.main.map(([id, n, lo, hi, note, opt]) => {
    const ex = EX[id]; const sg = suggest(id, k);
    const wtxt = WEIGHTED(ex.kind) ? (sg.bw || (ex.kind === 'bw' && !sg.w) ? `<small>${esc(wLabel(ex, 0, true))}</small>` : sg.w == null ? '<small class="nextw" style="color:var(--warn)">указать вес</small>' : `<span class="nextw ${sg.dir}">${fmtKg(sg.w)}</span> <small>${ex.kind === 'a' ? 'кг помощи' : (ex.unit || 'кг')}</small>`) : `<small>${unitOf(ex)}</small>`;
    return itemRow(id, `<b>${n} × ${lo}–${hi}</b>${wtxt}`, (note ? note + ' · ' : '') + ex.p.map(x => MUSCLES[x].split(/[ ,]/)[0].toLowerCase()).join(', '), opt?.alt ? `<span class="tag" style="margin-top:4px">замена: ${esc(EX[opt.alt].name)}</span>` : '');
  }).join('');
  return `<div class="screen d${k}">
    <div class="screen-h"><span class="eyebrow">3 тренировки на всё тело</span><h1>План</h1></div>
    <div class="daytabs" role="group" aria-label="Тренировка">${Object.keys(PLAN).map(x => `<button class="daytab d${x}" data-act="ptab" data-k="${x}" aria-pressed="${x === k}"><b>${x}</b><span>${PLAN[x].day}</span></button>`).join('')}</div>
    <button class="btn line block" data-act="weights">Мои рабочие веса · указать или изменить</button>
    <section class="hero d${k}"><span class="letter" aria-hidden="true">${k}</span>
      <span class="eyebrow">${p.day} · ${p.main.length} основных · ≈ ${m.total} мин</span>
      <h1>${p.title}</h1>
      <div class="note"><b>Акцент дня.</b> ${p.accent}</div>
      <button class="btn day block" data-act="start" data-k="${k}">Начать тренировку ${k}</button>
    </section>
    ${fold('pw', '<h2><em>1</em>Разминка</h2>', '≈ 15 мин · ' + WARM.length + ' упр.', `<div class="list">${WARM.map(w => itemRow(w.id, `<b>${w.dose}</b>`, '')).join('')}</div>`, false, 'lfold')}
    ${fold('pa', '<h2><em>2</em>Активация</h2>', '≈ 4 мин · ' + p.act.length + ' упр.', `<div class="list">${p.act.map(a => itemRow(a.ex, `<b>${a.sets} × </b><small>${a.reps}</small>`, MUSCLES[EX[a.ex].p[0]])).join('')}</div>`, false, 'lfold')}
    ${fold('pm', '<h2><em>3</em>Основная часть</h2>', p.main.length + ' упр. · справа вес', `<div class="list">${main}</div>`, true, 'lfold')}
    ${fold('pb', '<h2><em>4</em>Мобильность таза</h2>', '≈ 8 мин · ' + p.mob.length + ' упр.', `<div class="list">${p.mob.map(id => itemRow(id, `<small>${esc(PDFMAP[id].reps || '')}</small>`, esc(PDFMAP[id].sectionTitle))).join('')}</div>`, false, 'lfold')}
    ${fold('pp', '<h2>Как прогрессировать</h2>', 'правила прибавки', `<ul class="clean">${p.progress.map(x => `<li>${x}</li>`).join('')}</ul>
      <p class="small muted">Общее правило: работай с запасом 1–2 повтора. Каждые 6–8 недель — лёгкая неделя: те же веса, вдвое меньше подходов.</p>`)}
    ${fold('pf', '<h2>На что рассчитывать</h2>', 'и прогноз весов', `<ul class="clean">${p.forecast.map(x => `<li>${x}</li>`).join('')}</ul>
      <button class="btn line sm" data-act="gotoprog">Прогноз по моим весам</button>`)}
    ${fold('pg', '<h2>Твои цели</h2>', GOALS.length + ' цели', GOALS.map(([g, h]) => `<div><b style="font-size:14px;font-weight:600">${g}</b><p class="small muted">${h}</p></div>`).join(''))}
    ${k === 'C' ? '<p class="small muted">«Разведение ног в тренажёре» и «Разведение бёдер в тренажёре сидя» — один и тот же тренажёр, поэтому история весов у них общая.</p>' : ''}
  </div>`;
}

// ---------- Библиотека ----------
function libItems() {
  const gym = Object.keys(EX).map(id => ({id, cats: EXCATS[id] || [EX[id].cat], kind: 0}));
  const warm = WARM.filter(w => !w.ref).map(w => ({id: w.id, cats: EXCATS[w.id] || ['warm'], kind: 1}));
  const pdf = PDFX.map(p => ({id: p.id, cats: PDFCATS[p.section] || ['pelvis'], kind: 2}));
  return gym.concat(warm, pdf);
}
function libRow(x) {
  const it = getItem(x.id);
  if (it.type === 'gym') { const sg = WEIGHTED(it.kind) ? curW(x.id) : null;
    return itemRow(x.id, sg ? `<b>${sg.w == null && !sg.bw ? '—' : esc(wLabel(it, sg.w, sg.bw))}</b><small>${esc(it.equip)}</small>` : `<small>${esc(it.equip)}</small>`, it.p.map(m => MUSCLES[m]).join(', ')); }
  if (it.type === 'pdf') return itemRow(x.id, `<span class="tag hot">${esc(it.tag || 'гид')}</span>`, esc(it.sectionTitle));
  return itemRow(x.id, `<small>${esc(it.dose)}</small>`, 'Разминка');
}
const libSort = (a, b) => a.kind - b.kind || (a.kind === 2 ? (a.id < b.id ? -1 : 1) : getItem(a.id).name.localeCompare(getItem(b.id).name, 'ru'));
function vLib() {
  const q = LIBQ.trim().toLowerCase(); const all = libItems();
  const match = x => !q || getItem(x.id).name.toLowerCase().includes(q);
  let body = '';
  if (LIBCAT === 'all') {
    body = CATS.slice(1).map(([c, l]) => { const g = all.filter(x => x.cats[0] === c && match(x)).sort(libSort); return g.length ? fold('lib-' + c, `<h2>${l}</h2>`, g.length + ' упр.', `<div class="list">${g.map(libRow).join('')}</div>`, false, 'lfold', q ? true : undefined) : ''; }).join('');
  } else {
    const g = all.filter(x => x.cats.includes(LIBCAT) && match(x)).sort(libSort);
    body = g.length ? `<div class="list">${g.map(libRow).join('')}</div>` : '';
  }
  return `<div class="screen">
    <div class="screen-h"><span class="eyebrow">${all.length} упражнений · твои + гид «Таз в движении»</span><h1>Упражнения</h1></div>
    <input class="inp" id="libq" type="search" placeholder="Найти упражнение" value="${esc(LIBQ)}" aria-label="Поиск">
    <div class="chips" role="group" aria-label="Категории">${CATS.map(([c, l]) => `<button class="chip" data-act="cat" data-c="${c}" aria-pressed="${LIBCAT === c}">${l}</button>`).join('')}</div>
    <button class="btn line block" data-act="weights">Мои рабочие веса</button>
    ${body || '<section class="card flat"><p class="small">Ничего не нашлось. Попробуй другое слово или категорию.</p></section>'}
  </div>`;
}

// ---------- Журнал ----------
function recordsList() {
  const ids = []; Object.values(PLAN).forEach(p => p.main.forEach(m => { if (!ids.includes(m[0])) ids.push(m[0]); }));
  const rows = ids.map(id => { const ex = EX[id]; const h = exHistory(id); if (!h.length) return '';
    let best = null, bestDate = '', bestE = 0;
    h.forEach(x => x.sets.forEach(s => { const better = ex.kind === 'a' ? (!best || s.w < best.w || (s.w === best.w && s.r > best.r)) : ex.kind === 'w' ? (!best || s.w > best.w || (s.w === best.w && s.r > best.r)) : (!best || s.r > best.r);
      if (better) { best = s; bestDate = x.date; } bestE = Math.max(bestE, e1rm(s.w, s.r)); }));
    const nPR = S.logs.reduce((a, l) => a + (l.prs || []).filter(p => p.id === id).length, 0);
    const val = ex.kind === 'w' || ex.kind === 'a' ? `${fmtKg(best.w)} × ${best.r}` : best.r + (ex.kind === 't' ? ' сек' : ' повт.');
    return `<button class="item" data-act="ex" data-id="${id}">${thumb(id)}<div><div class="t">${esc(ex.name)}</div><div class="s">${fdate(bestDate)}${ex.kind === 'w' ? ' · 1ПМ ≈ ' + fmtKg(r1(bestE)) + ' кг' : ''}${nPR ? ' · ' + nPR + ' PR' : ''}</div></div><div class="r"><b class="serif" style="font-size:20px">${val}</b><small>${unitOf(ex)}</small></div></button>`;
  }).join('');
  return rows ? `<div class="list">${rows}</div>` : '<section class="card flat"><h2>Рекордов пока нет</h2><p class="small muted">Они появятся после первых тренировок — и каждый новый отметим.</p></section>';
}
function vJournal() {
  const seg = `<div class="chips" role="group" aria-label="Раздел журнала">${[['calendar','Календарь'],['logs','История'],['progress','Прогресс'],['records','Рекорды'],['weight','Вес тела'],['body','Замеры']].map(([k, l]) => `<button class="chip" data-act="jtab" data-k="${k}" aria-pressed="${JTAB === k}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (JTAB === 'records') body = recordsList();
  else if (JTAB === 'calendar') body = calendarHtml();
  else if (JTAB === 'weight') {
    const pts = S.body.map(b => ({x: b.date, y: b.weight}));
    const first = S.body[0], last = S.body[S.body.length - 1];
    body = `<section class="card"><div class="row between"><h2>Вес тела</h2><span class="src"><span class="dot"></span>Apple Health</span></div>
      <div class="row between"><span class="num" style="font-family:var(--f-display);font-size:28px;font-weight:600">${last ? fmtKg(last.weight) + ' кг' : '—'}</span>
      ${first ? `<span class="tag ${last.weight <= first.weight ? 'good' : 'warn'}">${last.weight - first.weight > 0 ? '+' : ''}${fmtKg(r1(last.weight - first.weight))} кг за ${Math.round((parseISO(last.date) - parseISO(first.date)) / 864e5)} дн.</span>` : ''}</div>
      ${lineChart(pts, {label: 'Вес тела'})}</section>
      <form class="card" id="fw"><h2>Добавить запись</h2><div class="grid2"><label class="f">Дата<input class="inp" type="date" id="fw-d" value="${TODAY_ISO}"></label><label class="f">Вес, кг<input class="inp" type="number" step="0.1" id="fw-w" placeholder="61,5" inputmode="decimal"></label></div><button class="btn">Сохранить</button></form>
      <div class="list">${S.body.slice().reverse().slice(0, 8).map(b => `<div class="item" style="grid-template-columns:1fr auto"><div class="t">${fdate(b.date)}</div><div class="r"><b>${fmtKg(b.weight)} кг</b></div></div>`).join('')}</div>`;
  } else if (JTAB === 'body') {
    const ms = S.body.filter(b => b.waist);
    body = `<section class="card"><h2>Замеры</h2><p class="small muted">Раз в 2–3 недели утром. Для твоих целей важнее всего талия и обхват по ягодицам: вес может стоять, а форма меняться.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Дата</th><th>Талия</th><th>Ягодицы</th><th>Бедро</th></tr></thead><tbody>
      ${ms.slice().reverse().map(b => `<tr><td>${fdate(b.date)}</td><td>${fmtKg(b.waist)}</td><td>${fmtKg(b.hips)}</td><td>${fmtKg(b.thigh)}</td></tr>`).join('')}</tbody></table></div></section>
      <form class="card" id="fm"><h2>Новый замер, см</h2><div class="grid3"><label class="f">Талия<input class="inp" type="number" step="0.1" id="fm-w" inputmode="decimal"></label><label class="f">Ягодицы<input class="inp" type="number" step="0.1" id="fm-h" inputmode="decimal"></label><label class="f">Бедро<input class="inp" type="number" step="0.1" id="fm-t" inputmode="decimal"></label></div><button class="btn">Сохранить</button></form>`;
  } else if (JTAB === 'logs') {
    body = `<div class="list">${S.logs.slice().reverse().map(l => `<button class="item d${l.day}" data-act="log" data-id="${l.id}"><div class="thumb letter">${l.day}</div><div><div class="t">${fdate(l.date)} · ${PLAN[l.day].short}${(l.prs || []).length ? ' <span class="tag pr">' + l.prs.length + ' PR</span>' : ''}</div><div class="s">${Math.round((l.end - l.start) / 60000)} мин · ${l.kcal} ккал · ${esc(l.src || 'forma')}</div></div><div class="r"><b>${nSets(l.sets)}</b><small>подходов</small></div></button>`).join('') || '<p class="item" style="display:block">Тренировок пока нет.</p>'}</div><button class="btn line block" data-act="pastday">+ Добавить прошлую тренировку</button>`;
  } else {
    body = volumeCard() + weightForecastCard() + bodyForecastCard();
    const key = ['hip_thrust','leg_press','rdl','lat_pulldown'];
    const charts = key.map(id => {
      const dk = Object.keys(PLAN).find(k => PLAN[k].main.some(m => m[0] === id));
      const h = exHistory(id).filter(x => x.day === dk && !x.sets.every(z => !z.w)); if (h.length < 2) return '';
      const pts = h.map(x => ({x: x.date, y: r1(e1rm(topSet(x.sets).w, topSet(x.sets).r))}));
      const proj = forecast(pts, EX[id]);
      const gain = Math.round((pts[pts.length - 1].y / pts[0].y - 1) * 100);
      return `<div class="chartb"><div class="row between"><h3>${EX[id].name}</h3><span class="tag good">${gain >= 0 ? '+' : ''}${gain}%</span></div>
        ${lineChart(pts, {proj, label: EX[id].name})}</div>`;
    }).filter(Boolean);
    body += (charts.length ? fold('chr', '<h2>Графики силы</h2>', charts.length + ' ' + plural(charts.length, 'упражнение', 'упражнения', 'упражнений'), '<p class="small muted">Расчётный максимум на 1 раз, кг. Пунктир — куда ведёт нынешний темп.</p>' + charts.join('')) : '') + fold('when', '<h2>Чего ждать по срокам</h2>', 'от 2 недель до полугода', `
      <div class="tbl-wrap"><table class="tbl"><tbody>
      <tr><td><b>2–4 недели</b></td><td>Веса растут почти каждую тренировку — это техника и нервная система. Объёмы пока не меняются.</td></tr>
      <tr><td><b>6–8 недель</b></td><td>Первые видимые изменения ягодиц сверху и сбоку, поясница меньше устаёт, легче держать осанку.</td></tr>
      <tr><td><b>3 месяца</b></td><td>Около +1–1,5 кг мышц при белке от 1,6 г/кг (оценка для начинающих девушек). Ягодицы заметно круглее.</td></tr>
      <tr><td><b>6 месяцев</b></td><td>Темп замедляется до 0,2–0,3 кг мышц в месяц. Дальше нужны рост весов и разгрузочные недели.</td></tr>
      </tbody></table></div>`);
  }
  return `<div class="screen"><div class="screen-h"><span class="eyebrow">Веса, замеры, история</span><h1>Журнал</h1></div>${seg}${body}</div>`;
}
// ---------- сворачиваемые блоки ----------
const FOLDS = (() => { try { return JSON.parse(localStorage.getItem('forma.folds')) || {}; } catch (e) { return {}; } })();
function fold(id, title, meta, body, def = false, cls = 'card', force) {
  const open = force != null ? force : (id in FOLDS ? FOLDS[id] : def);
  return `<details class="${cls} fold" data-fold="${id}" ${open ? 'open' : ''}><summary><span class="ft">${title}</span><span class="fm">${meta || ''}</span><i class="chev" aria-hidden="true"></i></summary><div class="fb">${body}</div></details>`;
}
document.addEventListener('toggle', e => { const d = e.target; if (d && d.dataset && d.dataset.fold) { FOLDS[d.dataset.fold] = d.open; try { localStorage.setItem('forma.folds', JSON.stringify(FOLDS)); } catch (x) {} } }, true);

// ---------- прогноз и объём ----------
const VOLT = {'Ягодицы':[12,20],'Задняя поверхность бедра':[6,12],'Квадрицепс':[6,12],'Спина':[8,14],'Поясница':[3,8],'Грудь':[4,10],'Плечи':[4,10],'Руки':[4,10],'Пресс':[4,10],'Приводящие':[2,6]};
function weeklyVolume() {
  const since = Date.now() - 7 * 864e5; const g = {}; RG.forEach(([n]) => g[n] = 0);
  S.logs.filter(l => l.end >= since).forEach(l => Object.entries(l.sets).forEach(([id, arr]) => { const e = EX[id]; if (!e) return; const n = arr.length;
    RG.forEach(([name, ms]) => { if (e.p.some(m => ms.includes(m))) g[name] += n; else if (e.s.some(m => ms.includes(m))) g[name] += n * 0.5; }); }));
  return g;
}
function volumeCard() {
  const g = weeklyVolume(); const tot = Object.values(g).reduce((a, b) => a + b, 0);
  if (!tot) return `<section class="card flat"><h2>Подходы на мышцы</h2><p class="small muted">После первой тренировки здесь появится, сколько рабочих подходов за неделю получила каждая группа мышц, и в норме ли это для твоих целей.</p></section>`;
  const rows = Object.entries(VOLT).map(([n, [lo, hi]]) => { const v = Math.round(g[n] * 2) / 2; const max = hi * 1.4; const st = v < lo ? ['мало', 'warn'] : v > hi * 1.25 ? ['много', 'warn'] : ['в норме', 'good'];
    return `<div class="vrow"><div class="row between"><span class="small"><b>${n}</b></span><span class="small"><b class="num">${String(v).replace('.', ',')}</b> <span class="muted">из ${lo}–${hi}</span> <span class="tag ${st[1]}">${st[0]}</span></span></div>
      <div class="vbar"><i class="band" style="left:${lo / max * 100}%;width:${(hi - lo) / max * 100}%"></i><i class="fill" style="width:${Math.min(100, v / max * 100)}%"></i></div></div>`; }).join('');
  const gl = Math.round(g['Ягодицы'] * 2) / 2; const low = Object.entries(VOLT).filter(([n, [lo]]) => g[n] < lo).length;
  return fold('vol', '<h2>Подходы за 7 дней</h2>', `ягодицы ${String(gl).replace('.', ',')} · ${low ? 'мало у ' + low + ' гр.' : 'всё в норме'}`, `
    <p class="small muted">Главная мера нагрузки для роста: сколько рабочих подходов получила мышца за неделю. Полоска — рекомендуемый коридор для твоих целей, на ягодицы — больше всего.</p>${rows}`);
}
function forecastEx(id) {
  const e = EX[id]; const pe = planExercises().find(x => x.id === id); const f = pe ? pe.days.length : 1; const k = pe ? pe.days[0] : 'A';
  const row = PLAN[k].main.find(m => m[0] === id); const lo = row ? row[2] : 8, hi = row ? row[3] : 12;
  const sg = suggest(id, k); if (sg.bw || sg.w == null || e.kind === 'bw') return null;
  const h = exHistory(id).filter(x => !x.sets.every(z => !z.w));
  let reps = h.length ? Math.max(...h[h.length - 1].sets.map(z => z.r)) : lo; if (sg.dir === 'up' || sg.dir === 'dn') reps = lo;
  let pace = 1;
  if (h.length >= 3) { let inc = 0; for (let i = 1; i < h.length; i++) if (h[i].sets[0].w !== h[i - 1].sets[0].w) inc++;
    const r0 = Math.max(...h[0].sets.map(z => z.r)), r1x = Math.max(...h[h.length - 1].sets.map(z => z.r)); pace = Math.max(0.4, Math.min(1.6, (inc * (hi - lo + 1) + (r1x - r0)) / (h.length - 1))); }
  const step = e.step || 2.5, dir = e.kind === 'a' ? -1 : 1; let w = sg.w, r = reps, cyc = 0, p = pace; const out = {now: w, unit: e.kind === 'a' ? 'кг помощи' : (e.unit || 'кг'), kind: e.kind};
  out.next = Math.max(1, Math.ceil((hi - reps) / pace));
  for (let sN = 1; sN <= 12 * f; sN++) { r += p; if (r >= hi) { w = Math.max(0, w + dir * step); r = lo; cyc++; p = Math.max(0.35, pace * (1 - 0.1 * cyc)); }
    if (sN === 4 * f) out.w4 = w; if (sN === 8 * f) out.w8 = w; if (sN === 12 * f) out.w12 = w; }
  return out;
}
function weightForecastCard() {
  const ids = planExercises().map(x => x.id).filter(id => EX[id].kind === 'w' || EX[id].kind === 'a');
  const rows = ids.map(id => [id, forecastEx(id)]).filter(x => x[1]);
  if (!rows.length) return `<section class="card"><h2>Прогноз весов</h2><p class="small muted">Укажи рабочие веса — и здесь появится, с каким весом ты, скорее всего, будешь работать через 4, 8 и 12 недель.</p><button class="btn block" data-act="weights">Указать веса</button></section>`;
  const fmt = (o, v) => o.kind === 'a' && v === 0 ? 'без помощи' : fmtKg(v);
  return fold('wfc', '<h2>Прогноз весов</h2>', 'через 4 · 8 · 12 недель', `
    <p class="small muted">Считаю по твоим весам и диапазону повторов: каждый раз +1 повтор, на верхней границе — прибавка веса, со временем темп замедляется. Когда накопится история, прогноз подстроится под твой реальный темп.</p>
    ${(() => { const key = ['hip_thrust','leg_press','rdl','lat_pulldown','hip_abduction','cable_kickback'];
      const ord = rows.slice().sort((x, y) => (key.indexOf(x[0]) + 1 || 99) - (key.indexOf(y[0]) + 1 || 99));
      const row = ([id, o]) => `<div class="fcrow"><div class="row between"><button class="lnk" data-act="ex" data-id="${id}">${esc(EX[id].name)}</button><span class="small muted">${o.unit} · +шаг через ~${o.next} трен.</span></div>
        <div class="fcg"><div><span>сейчас</span><b>${fmt(o, o.now)}</b></div><div><span>4 нед</span><b>${fmt(o, o.w4)}</b></div><div><span>8 нед</span><b>${fmt(o, o.w8)}</b></div><div class="hl"><span>12 нед</span><b>${fmt(o, o.w12)}</b></div></div>
</div>`;
      return ord.slice(0, 4).map(row).join('') + (ord.length > 4 ? `<details class="fcmore"><summary>Ещё ${ord.length - 4} ${plural(ord.length - 4, 'упражнение', 'упражнения', 'упражнений')}</summary>${ord.slice(4).map(row).join('')}</details>` : ''); })()}`, true);
}
function bodyForecastCard() {
  const P = S.profile, w = curWeight(); const prot = avgYazio('protein'); const n4 = S.logs.filter(l => l.end > Date.now() - 28 * 864e5).length;
  const freq = n4 ? Math.min(4, n4 / 4) : 3; const freqF = freq >= 3 ? 1 : freq >= 2 ? 0.75 : 0.45; const protF = !prot ? 0.85 : prot / w < 1.4 ? 0.7 : prot / w < 1.6 ? 0.85 : 1;
  const goalF = P.goal === 'cut' ? 0.55 : P.goal === 'recomp' ? 0.85 : 1; const m = 0.45 * 3 * freqF * protF * goalF;
  const ms = S.body.filter(b => b.waist); const wd = ms.length >= 2 ? r1(ms[ms.length - 1].waist - ms[0].waist) : null; const hd = ms.length >= 2 ? r1(ms[ms.length - 1].hips - ms[0].hips) : null;
  return fold('bfc', '<h2>Прогноз тела</h2>', `+${fmtKg(r1(m * .75))}…${fmtKg(r1(m * 1.25))} кг мышц`, `
    <div class="grid2"><div class="stat"><span>Мышцы</span><b>+${fmtKg(r1(m * .75))}…${fmtKg(r1(m * 1.25))}</b><span>кг · оценка</span></div>
    <div class="stat"><span>Тренировок в неделю</span><b>${String(r1(freq)).replace('.', ',')}</b><span>${n4 ? 'за последние 4 недели' : 'по плану'}</span></div></div>
    <p class="small muted">${protF < 1 ? 'Белка в среднем меньше 1,6 г на кг — мышцы будут расти медленнее. ' : prot ? 'Белка хватает. ' : 'Подключи Yazio, чтобы учитывать белок. '}${wd != null ? `Замеры: талия ${wd > 0 ? '+' : ''}${fmtKg(wd)} см, ягодицы ${hd > 0 ? '+' : ''}${fmtKg(hd)} см с ${fdate(ms[0].date)}.` : 'Добавляй замеры раз в 2–3 недели — вес может стоять, а форма меняться.'}</p>`);
}
function forecast(pts, ex) {
  // linear trend on last 4 weeks, weekly growth capped at 3% (beginner) and tapering
  const n = pts.length, a = pts[0], b = pts[n - 1];
  const weeks = Math.max(1, (parseISO(b.x) - parseISO(a.x)) / 6048e5);
  let wk = (b.y - a.y) / weeks; wk = Math.min(wk, b.y * 0.03); if (ex.kind === 'a') wk = 0;
  const out = []; let y = b.y;
  for (let i = 2; i <= 8; i += 2) { y += wk * 2 * Math.pow(0.85, i / 2 - 1); out.push({x: iso(addDays(parseISO(b.x), i * 7)), y: r1(y)}); }
  return out;
}

// ---------- Расчёты ----------
const CALC_EX = ['hip_thrust','leg_press','rdl','lat_pulldown','chest_press','seated_row','leg_curl','hip_abduction','cable_kickback','machine_crunch'];
function exOptions(sel) { return CALC_EX.map(id => `<option value="${id}" ${id === sel ? 'selected' : ''}>${EX[id].name}</option>`).join(''); }
function lastTop(id) { const h = exHistory(id); return h.length ? topSet(h[h.length - 1].sets) : {w: START[id] || 20, r: 10}; }
function vCalc() {
  const P = S.profile, w = curWeight(), ht = lastTop('hip_thrust');
  const avgProt = avgYazio('protein'), avgKcal = avgYazio('eatKcal');
  const ext = (u, t) => `<a class="ext" href="${u}" target="_blank" rel="noopener">${t || 'Оригинал на tvoytrener.com'} ↗</a>`;
  return `<div class="screen">
    <div class="screen-h"><span class="eyebrow">Поля уже заполнены из профиля, журнала и Yazio</span><h1>Расчёты</h1></div>
    <details class="acc" open><summary><h2>Белок на сегодня</h2></summary><div class="acc-b">
      <div class="grid2"><label class="f">Вес, кг<input class="inp" id="pr-w" type="number" step="0.1" value="${w}"></label>
      <label class="f">День<select class="inp" id="pr-d"><option value="A">A — тяжёлый</option><option value="B">B — средний</option><option value="C">C — средний</option><option value="">отдых</option></select></label></div>
      <label class="f">Цель<select class="inp" id="pr-g"><option value="recomp" ${P.goal === 'recomp' ? 'selected' : ''}>Рельеф без изменения веса</option><option value="cut" ${P.goal === 'cut' ? 'selected' : ''}>Похудеть</option><option value="bulk" ${P.goal === 'bulk' ? 'selected' : ''}>Набрать мышцы</option></select></label>
      <div class="result" id="pr-out"></div>
      <p class="small muted">Основа — рекомендации ISSN: 1,4–2,0 г/кг при силовых тренировках, до 2,2 г/кг в дефиците. В тяжёлый день берём верх диапазона.</p>
    </div></details>
    <details class="acc"><summary><h2>Подбор рабочего веса</h2></summary><div class="acc-b">
      <label class="f">Упражнение<select class="inp" id="vw-e">${exOptions('hip_thrust')}</select></label>
      <div class="grid2"><label class="f">Вес, кг<input class="inp" id="vw-w" type="number" step="0.5" value="${ht.w}"></label><label class="f">Сделала повторов<input class="inp" id="vw-r" type="number" min="1" max="15" value="${ht.r}"></label></div>
      <div class="result" id="vw-out"></div>${ext('https://tvoytrener.com/www/kalk/ves_ypragnenia.html')}
    </div></details>
    <details class="acc"><summary><h2>Подходы на 10 недель</h2></summary><div class="acc-b">
      <label class="f">Упражнение<select class="inp" id="bz-e">${exOptions('hip_thrust')}</select></label>
      <div class="grid3"><label class="f">Вес, кг<input class="inp" id="bz-w" type="number" step="0.5" value="${ht.w}"></label><label class="f">Повторы<input class="inp" id="bz-r" type="number" min="1" max="15" value="${ht.r}"></label>
      <label class="f">Раз в неделю<select class="inp" id="bz-f"><option value="1">1</option><option value="2" selected>2</option></select></label></div>
      <div id="bz-out"></div>${ext('https://tvoytrener.com/www/kalk/bazovie_ypragnenia.html')}
    </div></details>
    <details class="acc"><summary><h2>Пульс для сжигания жира</h2></summary><div class="acc-b">
      <div class="grid2"><label class="f">Возраст<input class="inp" id="hr-a" type="number" value="${P.age}"></label><label class="f">Пульс покоя<input class="inp" id="hr-r" type="number" value="${P.restHR}"></label></div>
      <div class="result" id="hr-out"></div>${ext('https://tvoytrener.com/www/kalk/puls_dlia_sjigania_jira.html')}
    </div></details>
    <details class="acc"><summary><h2>Энергозатраты за тренировку</h2></summary><div class="acc-b">
      <div class="grid3"><label class="f">Вес, кг<input class="inp" id="en-w" type="number" step="0.1" value="${w}"></label><label class="f">Минут<input class="inp" id="en-m" type="number" value="85"></label><label class="f">Ср. пульс<input class="inp" id="en-h" type="number" value="${S.logs.length ? S.logs[S.logs.length - 1].avgHR : ''}" placeholder="из Watch"></label></div>
      <label class="f">Интенсивность<select class="inp" id="en-i"><option value="3.5">Лёгкая, пульс до 100</option><option value="5" selected>Средняя, 100–130</option><option value="6">Высокая, выше 130</option></select></label>
      <div class="result" id="en-out"></div>${ext('https://tvoytrener.com/www/kalk/energozatrati_trenirovka.html')}
    </div></details>
    <details class="acc"><summary><h2>Результат за 3 месяца</h2></summary><div class="acc-b">
      <div class="grid3"><label class="f">Возраст<input class="inp" id="rs-a" type="number" value="${P.age}"></label><label class="f">Рост<input class="inp" id="rs-h" type="number" value="${P.height}"></label><label class="f">Вес<input class="inp" id="rs-w" type="number" step="0.1" value="${w}"></label></div>
      <div class="grid2"><label class="f">Опыт<select class="inp" id="rs-x"><option value="0.45">Новичок</option><option value="0.3">Меньше года</option><option value="0.15">Год и больше</option></select></label>
      <label class="f">Тренировок в неделю<input class="inp" id="rs-f" type="number" min="1" max="7" value="${P.freq}"></label></div>
      <div class="grid2"><label class="f">Активность вне зала<select class="inp" id="rs-act"><option value="1.2">Сидячая работа</option><option value="1.375" selected>Средняя</option><option value="1.55">Повышенная</option><option value="1.725">Высокая</option></select></label>
      <label class="f">Калории в день<input class="inp" id="rs-k" type="number" value="${avgKcal || ''}" placeholder="из Yazio"></label></div>
      <label class="f">Белок в день, г<input class="inp" id="rs-p" type="number" value="${avgProt || ''}"></label>
      <div class="result" id="rs-out"></div>${ext('https://tvoytrener.com/www/kalk/rezultat.html')}
    </div></details>
    <p class="small muted">Формулы — общепринятые: 1ПМ по Эпли и Бжицки, пульс по Карвонену и Танаке, расход по Кейтелу (если есть пульс) или по МЕТ, базовый обмен по Миффлину — Сан Жеору. Точные алгоритмы «Твоего тренера» не опубликованы, поэтому ссылки ведут на оригиналы для сверки.</p>
  </div>`;
}
function avgYazio(k) { const v = Object.entries(S.health).filter(([d]) => d < TODAY_ISO).map(([, x]) => x[k]).filter(Boolean); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; }
const num = id => parseFloat(String($('#' + id)?.value || '').replace(',', '.')) || 0;
function calcAll() {
  // protein
  const pw = num('pr-w'), pd = $('#pr-d').value, pg = $('#pr-g').value;
  if (!$('#pr-d').dataset.init) { $('#pr-d').value = planKeyFor(TODAY) || ''; $('#pr-d').dataset.init = 1; }
  const load = $('#pr-d').value ? PLAN[$('#pr-d').value].load : 'rest';
  let f = load === 'heavy' ? 2.0 : load === 'medium' ? 1.8 : 1.6; if (pg === 'cut') f = Math.min(2.2, f + 0.2); if (pg === 'bulk') f = Math.max(1.6, f - 0.1);
  $('#pr-out').innerHTML = `<span class="big">${Math.round(pw * f)} г</span><span class="small">${f.toFixed(1).replace('.', ',')} г/кг · по ${Math.round(pw * 0.4)} г на приём, 3–4 приёма${$('#pr-d').value ? ' · 25–35 г после зала' : ''}</span>
    <span class="small muted">Сегодня по Yazio: ${(S.health[TODAY_ISO] || {}).protein ?? '—'} г</span>`;
  // weight selection
  const ve = EX[$('#vw-e').value], vw = num('vw-w'), vr = Math.min(15, Math.max(1, num('vw-r')));
  const orm = e1rm(vw, vr);
  $('#vw-out').innerHTML = `<span class="small muted">Расчётный максимум на 1 раз</span><span class="big">${fmtKg(r1(orm))} кг</span>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Повторы</th><th>Рабочий вес (2 в запасе)</th><th>Для чего</th></tr></thead><tbody>
    ${[[6,'сила'],[8,'ягодицы, база'],[10,'ягодицы, база'],[12,'объём'],[15,'изоляция, памп'],[20,'отведения']].map(([r, t]) => `<tr><td>${r}</td><td><b>${fmtKg(roundStep(orm / (1 + (r + 2) / 30), ve.step || 2.5))}</b> кг</td><td class="muted">${t}</td></tr>`).join('')}</tbody></table></div>`;
  // 10 weeks
  const be = EX[$('#bz-e').value], bm = e1rm(num('bz-w'), Math.min(15, Math.max(1, num('bz-r')))), bf = +$('#bz-f').value;
  const sch = [[60,'3×12'],[62.5,'3×12'],[65,'3×11'],[67.5,'3×10'],[70,'3×10'],[72.5,'3×9'],[75,'3×8'],[77.5,'3×8'],[80,'3×6–8'],[60,'2×10, разгрузка']];
  $('#bz-out').innerHTML = `<p class="small muted">1ПМ ≈ ${fmtKg(r1(bm))} кг. Мезоцикл 10 недель: вес растёт, повторы снижаются, последняя неделя — разгрузка.</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Нед.</th><th>%</th><th>Подходы</th><th>Вес</th>${bf === 2 ? '<th>2-я трен.</th>' : ''}</tr></thead><tbody>
    ${sch.map(([pc, sr], i) => `<tr><td>${i + 1}</td><td>${String(pc).replace('.', ',')}</td><td>${sr}</td><td><b>${fmtKg(roundStep(bm * pc / 100, be.step || 2.5))}</b></td>${bf === 2 ? `<td>${fmtKg(roundStep(bm * (pc - 10) / 100, be.step || 2.5))}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
  // HR
  const age = num('hr-a'), rest = num('hr-r'); const mx = 208 - 0.7 * age, res = mx - rest;
  const z = (a, b) => `${Math.round(rest + res * a)}–${Math.round(rest + res * b)}`;
  $('#hr-out').innerHTML = `<span class="small muted">Зона жиросжигания (60–70% резерва пульса)</span><span class="big">${z(.6, .7)} уд/мин</span>
    <span class="small">Разминка на степпере: ${z(.4, .5)} · Максимум ≈ ${Math.round(mx)} (Танака; по 220 − возраст: ${220 - age})</span>`;
  // energy
  const ew = num('en-w'), em = num('en-m'), eh = num('en-h'), met = +$('#en-i').value;
  const bymet = metKcal(met, ew, em), byhr = eh ? keytel(eh, ew, S.profile.age, S.profile.sex, em) : null;
  $('#en-out').innerHTML = `<span class="small muted">${byhr ? 'По пульсу (формула Кейтела)' : 'По МЕТ'}</span><span class="big">${Math.round(byhr || bymet)} ккал</span>
    <span class="small">${byhr ? 'По МЕТ без пульса: ' + Math.round(bymet) + ' ккал. ' : ''}Apple Watch считает «активные» калории без базового обмена — его цифра обычно на 60–90 ккал ниже.</span>`;
  // result 3 months
  const ra = num('rs-a'), rh = num('rs-h'), rw = num('rs-w'), rx = +$('#rs-x').value, rf = num('rs-f'), ract = +$('#rs-act').value, rk = num('rs-k'), rp = num('rs-p');
  const bmr = 10 * rw + 6.25 * rh - 5 * ra - 161; const tdee = bmr * ract + rf * 300 / 7;
  const freqF = rf >= 4 ? 1.05 : rf === 3 ? 1 : rf === 2 ? 0.75 : 0.45;
  const protF = !rp ? 0.85 : rp / rw < 1.4 ? 0.7 : rp / rw < 1.6 ? 0.85 : 1;
  const bal = (rk || tdee - 150) - tdee;
  const kcalF = bal < -300 ? 0.55 : bal < 0 ? 0.85 : 1;
  const mus = rx * 3 * freqF * protF * kcalF; const fat = bal * 91 / 7700;
  $('#rs-out').innerHTML = `<span class="small muted">Оценка к ${fdate(iso(addDays(TODAY, 91)))}</span>
    <div class="grid2"><div><span class="big">+${fmtKg(r1(mus * .75))}…${fmtKg(r1(mus * 1.25))}</span><div class="small">кг мышц</div></div>
    <div><span class="big">${fat <= 0 ? '−' : '+'}${fmtKg(Math.abs(r1(fat)))}</span><div class="small">кг жира при ${Math.round(rk || tdee - 150)} ккал/день</div></div></div>
    <span class="small">Расход в среднем ≈ ${Math.round(tdee)} ккал/день. ${protF < 1 ? 'Белка меньше 1,6 г/кг — мышцы растут медленнее.' : 'Белка достаточно.'}</span>`;
}

// ================= sheets =================
function openSheet(html, cls = '') {
  closeSheet();
  const w = document.createElement('div'); w.className = 'sheet-wrap'; w.id = 'sheet';
  w.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  if (!cls.includes('welcome')) w.addEventListener('click', e => { if (e.target === w) closeSheet(); });
  document.body.appendChild(w); document.body.style.overflow = 'hidden';
}
function closeSheet() { const s = $('#sheet'); if (s) s.remove(); document.body.style.overflow = ''; }
const sheetTop = (title, extra = '') => `<div class="grab"></div><div class="sheet-top"><h2>${title}</h2><div class="row">${extra}<button class="icon-btn" data-act="close" aria-label="Закрыть">✕</button></div></div>`;

function exSheet(id) {
  const it = getItem(id); let html = sheetTop(esc(it.name));
  if (it.type === 'pdf') {
    html += `<div class="row wrap"><span class="tag hot">${esc(it.tag || '')}</span><span class="tag">${esc(it.section)} · ${esc(it.sectionTitle)}</span><span class="tag">${esc(it.reps || '')}</span></div>
      ${photo(it.imgs[0]) ? `<div class="photos">${it.imgs.map((f, i) => `<figure><img src="${photo(f)}" alt="${esc(it.name)}, положение ${i ? 'B' : 'A'}"><figcaption>Положение ${i ? 'B' : 'A'}</figcaption></figure>`).join('')}</div>`
        : `<section class="card flat"><p class="small">Фото этого упражнения лежат в приватном репозитории forma-media.</p><button class="btn line sm" data-act="settings">Подключить фото</button></section>`}
      <section class="card"><h3>Как выполнять</h3><p>${esc(it.how)}</p><h3>На что обратить внимание</h3><p class="muted">${esc(it.attention)}</p></section>
      <p class="small muted">Из твоего гида «Таз в движении». Боль в пояснице, крестце, паху, колене или запястье — повод остановиться.</p>`;
  } else if (it.type === 'warm') {
    html += `<span class="tag hot">Разминка · ${esc(it.dose)}</span>${it.mus ? `<div class="mapwrap">${bodyMap(it.mus, [])}<div class="legend">${it.mus.map(m => `<span><i class="k" style="background:var(--hot)"></i>${MUSCLES[m]}</span>`).join('')}</div></div>` : ''}
      <section class="card"><h3>Как выполнять</h3><p>${esc(it.how)}</p></section>`;
  } else {
    const days = Object.entries(PLAN).flatMap(([k, p]) => p.main.filter(m => m[0] === id).map(m => `${p.day.slice(0, 2)} ${k}: ${m[1]} × ${m[2]}–${m[3]}`));
    const sgK = Object.keys(PLAN).find(k => PLAN[k].main.some(m => m[0] === id));
    const sg = sgK ? suggest(id, sgK) : null; const h = exHistory(id).filter(x => !sgK || x.day === sgK);
    html += `<div class="row wrap"><span class="tag">${esc(it.equip)}</span>${days.map(d => `<span class="tag hot">${d}</span>`).join('')}${it.perSide ? '<span class="tag">на каждую сторону</span>' : ''}</div>
      <div class="mapwrap">${bodyMap(it.p, it.s)}<div class="legend"><b class="small">Какие мышцы работают</b>${it.p.map(m => `<span><i class="k" style="background:var(--hot)"></i>${MUSCLES[m]}</span>`).join('')}${it.s.map(m => `<span class="muted"><i class="k" style="background:var(--warm)"></i>${MUSCLES[m]}</span>`).join('')}</div></div>
      ${WEIGHTED(it.kind) ? `<section class="card"><h3>Мой рабочий вес</h3><div class="wlist">${wRow(id, null)}</div></section>` : ''}
      ${sg ? `<section class="note"><b>В следующий раз:</b> ${sg.w != null && (it.kind === 'w' || it.kind === 'a') ? fmtKg(sg.w) + ' ' + unitOf(it) + ' × ' + sg.target + '. ' : ''}${sg.why}</section>` : ''}
      ${h.length >= 2 ? `<section class="card"><h3>${it.kind === 'w' ? 'Расчётный максимум (1ПМ), кг' : it.kind === 'a' ? 'Помощь гравитрона, кг' : 'Лучший подход, повторы'}${sgK ? ' · тренировка ' + sgK : ''}</h3>${lineChart(h.map(x => ({x: x.date, y: it.kind === 'w' ? r1(e1rm(topSet(x.sets).w, topSet(x.sets).r)) : it.kind === 'a' ? x.sets[0].w : Math.max(...x.sets.map(z => z.r))})), {label: 'История'})}
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Дата</th><th>Подходы</th></tr></thead><tbody>${h.slice(-5).reverse().map(x => `<tr><td>${fdate(x.date)} · ${x.day}</td><td>${x.sets.map(s => (it.kind === 'w' || it.kind === 'a' ? fmtKg(s.w) + '×' : '') + s.r).join(', ')}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
      <section class="card"><h3>Как выполнять</h3><ol class="steps">${it.how.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
        <h3>Частые ошибки</h3><ul class="clean">${it.err.map(x => `<li class="muted">${esc(x)}</li>`).join('')}</ul></section>
      ${it.tt ? `<a class="ext" href="${it.tt}" target="_blank" rel="noopener">Техника и видео на «Твой тренер»${it.ttNote ? ' (' + it.ttNote + ')' : ''} ↗</a>` : ''}`;
  }
  openSheet(html);
}

function logSheet(id) {
  const l = S.logs.find(x => x.id === id); if (!l) return;
  openSheet(sheetTop(`${fdate(l.date)} · тренировка ${l.day}`) + `
    <div class="grid3"><div class="stat"><span>Время</span><b>${Math.round((l.end - l.start) / 60000)} мин</b></div><div class="stat"><span>Ср. пульс</span><b>${l.avgHR || '—'}</b></div><div class="stat"><span>Ккал</span><b>${l.kcal}</b></div></div>
    <p class="small muted">Пульс и калории — ${esc(l.src || 'оценка forma')}. ${nSets(l.sets)} рабочих подходов.</p>
    <div class="list">${Object.entries(l.sets).map(([eid, sets]) => { const e = EX[eid]; return `<div class="item" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="t">${esc(e.name)}</div></div><div class="r">${sets.map(s => (WEIGHTED(e.kind) && s.w ? fmtKg(s.w) + '×' : '') + s.r).join(' · ')}</div></div>`; }).join('')}</div>
    <div class="row wrap"><button class="btn sm" data-act="editlog" data-id="${l.id}">Изменить веса и повторы</button><button class="btn ghost sm" data-act="dellog" data-id="${l.id}">Удалить</button></div>`);
}

// ---------- рабочие веса: один экран для всех упражнений ----------
function planExercises() { const out = []; Object.entries(PLAN).forEach(([k, p]) => p.main.forEach(m => { [m[0], m[5]?.alt].filter(Boolean).forEach(id => { let o = out.find(x => x.id === id); if (!o) out.push(o = {id, days: []}); if (!o.days.includes(k)) o.days.push(k); }); })); return out; }
function wRow(id, days) {
  const e = EX[id]; const sg = curW(id, days && days[0]); const bw = !!sg.bw || (e.kind === 'bw' && !sg.w); const val = bw || sg.w == null ? '' : String(sg.w);
  return `<div class="wrow" data-wrow="${id}">
    <div class="wname"><b>${esc(e.name)}</b><span class="small muted">${days ? days.join(' · ') + ' · ' : ''}${esc(e.equip)}${e.unit ? ' · вес одной гантели' : e.kind === 'a' ? ' · противовес' : ''}</span></div>
    <div class="wctl" ${bw ? 'data-off="1"' : ''}><button class="stepb" data-act="wstep" data-id="${id}" data-d="-1" aria-label="Меньше">−</button>
      <input class="inp wval" id="w-${id}" data-w="${id}" inputmode="decimal" type="number" step="0.5" min="0" value="${val}" placeholder="—" ${bw ? 'disabled' : ''} aria-label="Вес: ${esc(e.name)}">
      <span class="wunit">${e.kind === 'a' ? 'кг помощи' : 'кг'}</span>
      <button class="stepb" data-act="wstep" data-id="${id}" data-d="1" aria-label="Больше">+</button>
      <button class="chip bwchip" data-act="wbw" data-id="${id}" aria-pressed="${bw}">${e.kind === 'a' ? 'без помощи' : 'без веса'}</button></div>
  </div>`;
}
function weightsSheet() {
  const list = planExercises().filter(x => WEIGHTED(EX[x.id].kind));
  openSheet(sheetTop('Мои рабочие веса') + `<p class="small muted">Впиши, с каким весом работаешь сейчас. Если упражнение делаешь без отягощения — нажми «без веса». Эти цифры сразу подставятся в план, тренировку, библиотеку и расчёты, а после тренировок forma. будет сама предлагать прибавку.</p>
    ${['A', 'B', 'C'].map(k => { const g = list.filter(x => x.days[0] === k); return g.length ? `<div class="block-h d${k}"><h2><em>${k}</em>${PLAN[k].day}</h2></div><div class="card wlist">${g.map(x => wRow(x.id, x.days)).join('')}</div>` : ''; }).join('')}
    <button class="btn block" data-act="close">Готово</button>`);
}
function wSync(id) {
  const row = document.querySelector(`[data-wrow="${id}"]`); if (!row) return;
  const m = S.weights[id]; const inp = row.querySelector('.wval'), chip = row.querySelector('.bwchip'), ctl = row.querySelector('.wctl');
  inp.disabled = !!m.bw; chip.setAttribute('aria-pressed', !!m.bw); if (m.bw) ctl.dataset.off = '1'; else delete ctl.dataset.off;
  if (document.activeElement !== inp) inp.value = m.bw || m.w == null ? '' : String(m.w);
}

// ---------- прошлые дни ----------
function dayAction(date) {
  const logs = S.logs.filter(l => l.date === date);
  if (logs.length === 1) return logSheet(logs[0].id);
  if (logs.length > 1) return openSheet(sheetTop(fdate(date)) + `<div class="list">${logs.map(l => `<button class="item d${l.day}" data-act="log" data-id="${l.id}"><div class="thumb letter">${l.day}</div><div><div class="t">${PLAN[l.day].short}</div></div><div class="r"><small>${Math.round((l.end - l.start) / 60000)} мин</small></div></button>`).join('')}</div>`);
  if (date > TODAY_ISO) return toast('Это будущий день — отметить тренировку можно, когда он настанет.');
  pastDaySheet(date);
}
function pastDaySheet(date, k) {
  const d = date ? parseISO(date) : TODAY; k = k || planKeyFor(d) || nextWorkout().key;
  openSheet(sheetTop('Прошлая тренировка') + `
    <label class="f">Дата<input class="inp" type="date" id="pd-date" value="${iso(d)}" max="${TODAY_ISO}"></label>
    <div class="daytabs" role="group" aria-label="Какая тренировка">${Object.keys(PLAN).map(x => `<button class="daytab d${x}" data-act="pdk" data-k="${x}" aria-pressed="${x === k}"><b>${x}</b><span>${PLAN[x].day}</span></button>`).join('')}</div>
    <button class="btn block" data-act="pdfill">Вписать веса и повторы</button>
    <button class="btn line block" data-act="pdquick">Просто отметить выполненной</button>
    <p class="small muted">«Просто отметить» сохранит тренировку с твоими текущими рабочими весами и нижней границей повторов. Потом её можно открыть и поправить.</p>`);
}
function quickLog(date, k) {
  const d0 = parseISO(date); d0.setHours(18, 30); const start = +d0, end = start + 80 * 60000; const sets = {}; let skipped = 0;
  PLAN[k].main.forEach(([id, n, lo]) => { const e = EX[id]; const sg = suggest(id, k);
    if ((e.kind === 'w' || e.kind === 'a') && sg.w == null && !sg.bw) { skipped++; return; }
    sets[id] = [...Array(n)].map(() => ({w: sg.bw ? 0 : (sg.w || 0), r: lo, done: true})); });
  const log = {id: 'l' + end, date, day: k, start, end, sets, kcal: Math.round(metKcal(4.5, curWeight(), 80)), avgHR: null, src: 'отмечено вручную', quick: true, prs: []};
  S.logs.push(log); S.logs.sort((a, b) => a.start - b.start); save(); closeSheet(); render();
  toast(`Тренировка ${k} за ${fdate(date)} отмечена` + (skipped ? `. Вес не был указан у ${skipped} упр. — они не записаны, их можно добавить через «Изменить»` : ''));
}
let CALM = TODAY_ISO.slice(0, 7);
function calendarHtml() {
  const [y, m] = CALM.split('-').map(Number); const first = new Date(y, m - 1, 1); const days = new Date(y, m, 0).getDate();
  const pad = (first.getDay() + 6) % 7; const cells = [];
  for (let i = 0; i < pad; i++) cells.push('<span></span>');
  for (let dd = 1; dd <= days; dd++) { const ds = `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`; const lg = S.logs.find(l => l.date === ds); const pk = planKeyFor(parseISO(ds));
    const cls = lg ? 'done d' + lg.day : (pk && ds < TODAY_ISO ? 'miss d' + pk : pk ? 'plan d' + pk : '');
    cells.push(`<button class="cd ${cls} ${ds === TODAY_ISO ? 'today' : ''}" data-act="day" data-date="${ds}"><span>${dd}</span>${lg ? `<b>${lg.day}</b>` : pk ? `<i>${pk}</i>` : ''}</button>`); }
  const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const n = S.logs.filter(l => l.date.startsWith(CALM)).length;
  return `<section class="card"><div class="row between"><button class="icon-btn" data-act="calm" data-d="-1" aria-label="Предыдущий месяц">‹</button><h2>${MONTHS[m - 1]} ${y}</h2><button class="icon-btn" data-act="calm" data-d="1" aria-label="Следующий месяц">›</button></div>
    <div class="cal"><span class="cw">Пн</span><span class="cw">Вт</span><span class="cw">Ср</span><span class="cw">Чт</span><span class="cw">Пт</span><span class="cw">Сб</span><span class="cw">Вс</span>${cells.join('')}</div>
    <div class="legend3"><span><i style="background:var(--dA)"></i>сделано</span><span><i style="background:transparent;border:1.5px dashed var(--faint)"></i>пропущено</span></div>
    <p class="small muted">${n} ${plural(n, 'тренировка', 'тренировки', 'тренировок')} за месяц. Нажми на день, чтобы открыть тренировку или отметить прошедшую.</p></section>
    <button class="btn line block" data-act="pastday">+ Добавить прошлую тренировку</button>`;
}

// ---------- тренировка (сессия) ----------
let SES = null, TIMER = null, WAKE = null, AC = null, BEEPS = [];
const HEAVY = ['hip_thrust','leg_press','rdl','lat_pulldown','chest_press','seated_row','bulgarian'];
function warmupSets(id, w) {
  const ex = EX[id]; w = +w; if (!HEAVY.includes(id) || !w || ex.kind !== 'w') return [];
  const st = ex.step, sch = w >= st * 6 ? [[0.5, 10], [0.7, 5], [0.85, 2]] : [[0.5, 8], [0.75, 4]];
  const out = []; sch.forEach(([p, r]) => { const x = Math.max(st, roundStep(w * p, st)); if (x < w && !out.some(o => o.w === x)) out.push({w: x, r}); });
  return out;
}
async function wake(on) {
  try { if (on && 'wakeLock' in navigator && !WAKE) { WAKE = await navigator.wakeLock.request('screen'); WAKE.addEventListener('release', () => WAKE = null); } else if (!on && WAKE) { await WAKE.release(); WAKE = null; } } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && SES && $('#sheet .timer')) wake(true); });
function startSession(k, opt = {}) {
  const p = PLAN[k]; const edit = opt.editId ? S.logs.find(l => l.id === opt.editId) : null;
  SES = {k, start: Date.now(), warm: {}, act: {}, mob: {}, swap: {}, sets: {}, wu: {}, bw: {}, date: opt.date || (edit && edit.date) || null, editId: edit ? edit.id : null};
  p.main.forEach(([id, n, lo, hi, note, o]) => {
    const useId = edit && !edit.sets[id] && o?.alt && edit.sets[o.alt] ? o.alt : id; if (useId !== id) SES.swap[id] = useId;
    const sg = suggest(useId, k); const old = edit && edit.sets[useId];
    SES.bw[useId] = old ? old.every(x => !x.w) && EX[useId].kind !== 'band' && EX[useId].kind !== 't' : !!sg.bw;
    SES.sets[useId] = [...Array(Math.max(n, old ? old.length : 0))].map((_, i) => old && old[i] ? {w: old[i].w || '', r: old[i].r, done: true} : {w: sg.bw ? '' : (sg.w ?? ''), r: '', done: false});
  });
  saveSes(); if (!SES.date) wake(true); renderSession();
}
function renderSession() {
  const k = SES.k, p = PLAN[k]; const el = Math.round((Date.now() - SES.start) / 60000); SES.wu = SES.wu || {}; SES.bw = SES.bw || {};
  const past = !!SES.date;
  const mainHtml = p.main.map(([id0, n, lo, hi, note, opt]) => {
    const id = SES.swap[id0] || id0; const e = EX[id]; const sg = suggest(id, k);
    if (!SES.sets[id]) { SES.bw[id] = !!sg.bw; SES.sets[id] = [...Array(n)].map(() => ({w: sg.bw ? '' : (sg.w ?? ''), r: '', done: false})); }
    const canW = WEIGHTED(e.kind), bw = canW && !!SES.bw[id];
    const unit = e.kind === 'a' ? 'кг помощи' : (e.unit || 'кг');
    const wu = bw ? [] : warmupSets(id, SES.sets[id][0].w);
    return `<section class="card" data-ex="${id}">
      <div class="row between" style="align-items:flex-start;gap:8px"><button class="item" style="padding:0;grid-template-columns:46px 1fr" data-act="ex" data-id="${id}">${thumb(id)}<div><div class="t">${esc(e.name)}</div><div class="s">${n} × ${lo}–${hi} ${note || ''}</div></div></button>
      ${opt?.alt ? `<button class="btn ghost sm" data-act="swap" data-id="${id0}">Заменить</button>` : ''}</div>
      ${past ? '' : `<p class="small muted">${canW && !bw && sg.w != null ? 'Цель: ' + esc(wLabel(e, sg.w, false)) + ' × ' + sg.target + '. ' : ''}${sg.why}</p>`}
      ${canW ? `<div class="wtoggle" role="group" aria-label="Вес"><button data-act="sbw" data-id="${id}" data-v="0" aria-pressed="${!bw}">${e.kind === 'a' ? 'С помощью' : e.kind === 'bw' ? 'С отягощением' : 'С весом'}</button><button data-act="sbw" data-id="${id}" data-v="1" aria-pressed="${bw}">${e.kind === 'a' ? 'Без помощи' : 'Без веса'}</button></div>` : ''}
      ${wu.length && !past ? `<div class="warmups"><span>Разминочные:</span>${wu.map((x, i) => `<button data-act="wu" data-id="${id}" data-i="${i}" aria-pressed="${!!SES.wu[id + i]}">${fmtKg(x.w)} × ${x.r}</button>`).join('')}</div>` : ''}
      <div class="setrow small muted"><span class="n">#</span><span>${canW && !bw ? unit : canW ? (e.kind === 'a' ? 'без помощи' : 'без веса') : '—'}</span><span>${e.kind === 't' ? 'сек' : 'повторы'}</span><span></span></div>
      ${SES.sets[id].map((s, i) => `<div class="setrow"><span class="n">${i + 1}</span>
        ${canW && !bw ? `<input class="inp" id="s-${id}-${i}-w" data-set="${id}|${i}|w" type="number" step="0.5" inputmode="decimal" value="${s.w}" placeholder="кг" aria-label="Вес, подход ${i + 1}">` : `<span class="inp nobw">${canW ? (e.kind === 'a' ? 'без помощи' : 'свой вес') : (e.kind === 'band' ? 'резинка' : '—')}</span>`}
        <input class="inp" id="s-${id}-${i}-r" data-set="${id}|${i}|r" type="number" inputmode="numeric" value="${s.r}" placeholder="${hi}" aria-label="Повторы, подход ${i + 1}">
        <button class="ok" data-act="done" data-id="${id}" data-i="${i}" aria-pressed="${s.done}" aria-label="Подход выполнен">✓</button></div>`).join('')}
    </section>`;
  }).join('');
  const chk = (grp, id, dose) => `<label class="chk"><input type="checkbox" data-chk="${grp}|${id}" ${SES[grp][id] ? 'checked' : ''}><span>${esc(getItem(id).name)}</span><span class="small muted">${esc(dose)}</span></label>`;
  const title = past ? `${SES.editId ? 'Правка' : 'Тренировка'} <em>${k}</em>` : `Тренировка <em>${k}</em>`;
  openSheet(sheetTop(title, past ? `<span class="tag day">${fdate(SES.date)}</span>` : `<span class="tag day">${el} мин</span>`) + `
    <p class="small muted">${p.title}. ${past ? (SES.editId ? 'Поправь веса и повторы и нажми «Сохранить».' : 'Тренировка задним числом: впиши, что делала, и отметь подходы галочкой.') : 'Веса подставлены по прошлой тренировке, экран не погаснет до конца.'}</p>
    ${past ? '' : `<section class="card"><h3>Разминка</h3><div>${WARM.map(w => chk('warm', w.id, w.dose)).join('')}</div></section>
    <section class="card"><h3>Активация</h3><div>${p.act.map(a => chk('act', a.ex, a.sets + ' × ' + a.reps)).join('')}</div></section>`}
    ${mainHtml}
    ${past ? '' : `<section class="card"><h3>Мобильность таза</h3><div>${p.mob.map(id => chk('mob', id, PDFMAP[id].reps || '')).join('')}</div></section>`}
    <button class="btn day block" data-act="finish">${past ? 'Сохранить' : 'Завершить тренировку'}</button>
    <div class="timer" id="timer" hidden><span>Отдых</span><b id="tleft">1:30</b><button class="btn sm" data-act="tstop">Пропустить</button></div>`, 'full d' + k);
}
function stopBeeps() { BEEPS.forEach(o => { try { o.stop(); } catch (e) {} }); BEEPS = []; }
function startTimer(sec) {
  clearInterval(TIMER); stopBeeps(); const end = Date.now() + sec * 1000; const t = $('#timer'); if (!t) return; t.hidden = false;
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); AC.resume();
    [0, 0.25, 0.5].forEach(dt => { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.0001, AC.currentTime);
      const at = AC.currentTime + sec + dt; g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.25, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
      o.connect(g).connect(AC.destination); o.start(at); o.stop(at + 0.2); BEEPS.push(o); }); } catch (e) {}
  const tick = () => { const left = Math.max(0, Math.round((end - Date.now()) / 1000)); const el = $('#tleft'); if (el) el.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
    if (!left) { clearInterval(TIMER); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); if ($('#timer')) $('#timer').hidden = true; } };
  tick(); TIMER = setInterval(tick, 1000);
}
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas'); c.id = 'confetti'; document.body.appendChild(c);
  const dpr = devicePixelRatio || 1; c.width = innerWidth * dpr; c.height = innerHeight * dpr; const x = c.getContext('2d'); x.scale(dpr, dpr);
  const cs = getComputedStyle(document.documentElement); const cols = ['--dA', '--dB', '--dC', '--accent', '--warm'].map(v => cs.getPropertyValue(v).trim());
  const P = [...Array(140)].map(() => ({x: innerWidth / 2, y: innerHeight * 0.35, vx: (Math.random() - .5) * 12, vy: -Math.random() * 12 - 4, r: Math.random() * 6 + 3, a: Math.random() * 6, c: cols[Math.floor(Math.random() * cols.length)]}));
  const t0 = performance.now();
  const step = t => { const dt = t - t0; x.clearRect(0, 0, innerWidth, innerHeight);
    P.forEach(p => { p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += 0.15; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.globalAlpha = Math.max(0, 1 - dt / 2200); x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore(); });
    if (dt < 2200) requestAnimationFrame(step); else c.remove(); };
  requestAnimationFrame(step);
}
function finishSession() {
  clearInterval(TIMER); stopBeeps(); wake(false);
  const sets = {}; Object.entries(SES.sets).forEach(([id, arr]) => { const bw = SES.bw && SES.bw[id]; const d = arr.filter(s => s.done).map(s => ({w: bw ? 0 : (+String(s.w).replace(',', '.') || 0), r: +s.r || 0, done: true})); if (d.length) sets[id] = d; });
  const old = SES.editId ? S.logs.find(l => l.id === SES.editId) : null;
  let start = SES.start, end = Date.now();
  if (old) { start = old.start; end = old.end; } else if (SES.date) { const d0 = parseISO(SES.date); d0.setHours(18, 30); start = +d0; end = start + 80 * 60000; }
  const min = Math.max(1, Math.round((end - start) / 60000));
  const kcal = old ? old.kcal : Math.round(metKcal(6, curWeight(), Math.min(7, min)) + metKcal(5, curWeight(), Math.max(0, min - 15)) + metKcal(2.5, curWeight(), Math.min(8, min)));
  const log = {id: old ? old.id : 'l' + end, date: SES.date || iso(new Date(start)), day: SES.k, start, end, sets, kcal, avgHR: old ? old.avgHR : null, src: old ? old.src : (SES.date ? 'внесено вручную' : 'оценка forma')};
  const nDone = Object.values(sets).reduce((a, x) => a + x.length, 0);
  if (old && nDone) S.logs = S.logs.filter(l => l.id !== old.id);
  if (nDone) { log.prs = prsFor(log); S.logs.push(log); S.logs.sort((a, b) => a.start - b.start); save(); }
  if (SES.date) { const wasEdit = !!old; SES = null; saveSes(); closeSheet(); render(); toast(nDone ? (wasEdit ? 'Тренировка обновлена' : 'Тренировка за ' + fdate(log.date) + ' сохранена') : 'Подходы не отмечены — ничего не сохранено'); return; }
  const prs = log.prs || [];
  const pr = proteinFor(SES.k); const k = SES.k;
  openSheet(sheetTop('Готово') + `
    <section class="hero d${k}"><span class="letter" aria-hidden="true">${k}</span><span class="eyebrow">Тренировка ${k} · ${min} мин</span><h1>${nDone ? nDone + ' ' + plural(nDone, 'рабочий подход', 'рабочих подхода', 'рабочих подходов') : 'Подходы не отмечены'}</h1>
      <p>${nDone ? 'Сохранено в журнал. Веса на следующий раз уже посчитаны.' : 'Отметь хотя бы один подход галочкой, чтобы тренировка попала в журнал.'}</p></section>
    ${prs.length ? `<section class="card"><div class="row between"><h2>Новые рекорды</h2><span class="tag pr">${prs.length} PR</span></div><div class="prs">${prs.map(p => `<div class="prrow"><span class="small">${esc(EX[p.id].name)}<br><span class="muted">${p.label}</span></span><b>${p.text}</b></div>`).join('')}</div></section>` : ''}
    <div class="grid3"><div class="stat"><span>Подходов</span><b>${nSets(sets)}</b><span>рабочих</span></div><div class="stat"><span>Ккал, оценка</span><b>${kcal}</b><span>ккал</span></div><div class="stat"><span>Белок</span><b>${pr.g}</b><span>г за день</span></div></div>
    <section class="note"><b>Питание:</b> в ближайшие 2 часа 25–35 г белка. Всего за день — ${pr.g} г (${pr.f.toString().replace('.', ',')} г/кг).</section>
    <section class="card"><div class="row between"><h3>Пульс и калории из Apple Watch</h3><span class="src"><span class="dot off"></span>не подтянуто</span></div>
      <p class="small muted">Быстрая команда «forma sync» заберёт из Apple Health активные калории и пульс за время этой тренировки.</p>
      <button class="btn line sm" data-act="sync">Синхронизировать</button></section>
    ${S.google && !gValid() && nDone ? '<button class="btn google block" data-act="gsync">' + GOOGLE_G + ' Сохранить копию в Google Диск</button>' : ''}
    <button class="btn block" data-act="close">Закрыть</button>`);
  if (prs.length) confetti();
  SES = null; saveSes(); render();
}

// ---------- комплекс в день отдыха ----------
function restSheet() {
  openSheet(sheetTop('Комплекс 12 минут') + `<p class="small muted">Из гида «Таз в движении». 3–5 раз в неделю, в дни отдыха от зала — самое время.</p>
    <div class="list">${REST_PLAN.map((id, i) => itemRow(id, `<small>${['1 мин','2 мин','2 мин','2 мин','2 мин','2 мин'][i]}</small>`, esc(PDFMAP[id].sectionTitle))).join('')}
    <div class="item" style="grid-template-columns:44px 1fr auto"><div class="thumb">♪</div><div class="t">Свободное движение под музыку</div><div class="r"><small>1 мин</small></div></div></div>
    <section class="card"><h3>Как прогрессировать</h3><ul class="clean"><li>Неделя 1 — медленные наклоны и «кошка — корова», движение без участия плеч.</li><li>Неделя 2 — добавь волны и мягкие движения в приседе, подходы по 20–40 секунд.</li><li>Неделя 3 — наклоны таза стоя и в полуприседе под счёт 1–2–3–4, потом быстрее.</li></ul></section>`);
}

// ---------- профиль и синхронизация ----------
// ---------- профиль, фото, синхронизация, резервная копия ----------
const PHOTO_TOTAL = PDFX.reduce((a, p) => a + p.imgs.length, 0);
function settingsSheet() {
  const P = S.profile; const nPh = Object.keys(PHOTOS).length;
  openSheet(sheetTop('Настройки') + googleCard() + `
    ${S.sample ? `<section class="note"><b>Сейчас показан пример данных</b> — это не твои цифры. <button class="btn sm" data-act="clear" style="margin-top:8px">Удалить пример и начать с нуля</button></section>` : ''}
    <form class="card" id="fp"><h3>Профиль</h3>
      <div class="grid2"><label class="f">Возраст<input class="inp" id="pf-a" type="number" value="${P.age}"></label><label class="f">Рост, см<input class="inp" id="pf-h" type="number" value="${P.height}"></label></div>
      <div class="grid2"><label class="f">Пульс покоя<input class="inp" id="pf-r" type="number" value="${P.restHR}"></label>
      <label class="f">Цель<select class="inp" id="pf-g"><option value="recomp" ${P.goal === 'recomp' ? 'selected' : ''}>Рельеф, вес тот же</option><option value="cut" ${P.goal === 'cut' ? 'selected' : ''}>Похудеть</option><option value="bulk" ${P.goal === 'bulk' ? 'selected' : ''}>Набрать мышцы</option></select></label></div>
      <button class="btn">Сохранить профиль</button></form>
    <section class="card"><div class="row between"><h3>Apple Health и Yazio</h3><span class="src"><span class="dot ${Object.keys(S.health).length ? '' : 'off'}"></span>${S.settings.lastSync ? 'синхр. ' + fdate(S.settings.lastSync) : 'не подключено'}</span></div>
      <p class="small muted">Тренировки из Apple Watch и «Фитнеса», вес и питание из Yazio приходят через Apple Health быстрой командой «forma sync».</p>
      <button class="btn line sm" data-act="sync">Синхронизация и настройка команды</button></section>
    <section class="card"><div class="row between"><h3>Фото упражнений из гида</h3><span class="tag ${nPh >= PHOTO_TOTAL ? 'good' : ''}">${nPh} из ${PHOTO_TOTAL}</span></div>
      <p class="small muted">Фото лежат в приватном репозитории. Вставь ключ доступа GitHub (только чтение) — фото скачаются и останутся только на этом телефоне. Сам ключ не сохраняется.</p>
      <label class="f">Репозиторий<input class="inp" id="ph-repo" value="${esc(S.settings.mediaRepo || 'forma-ua/forma-media')}" autocapitalize="off" autocomplete="off"></label>
      <label class="f">Ключ доступа (fine-grained token)<input class="inp" id="ph-tok" type="password" placeholder="github_pat_…" autocapitalize="off" autocomplete="off"></label>
      <div class="row wrap"><button class="btn sm" data-act="photos">Скачать фото</button>${nPh ? '<button class="btn ghost sm" data-act="photosdel">Удалить с устройства</button>' : ''}</div>
      <p class="small" id="ph-status" role="status"></p></section>
    <section class="card"><h3>Резервная копия</h3><p class="small muted">Все тренировки и веса хранятся только на этом устройстве. Сохраняй копию раз в пару недель — в «Файлы» или iCloud.</p>
      <div class="row wrap"><button class="btn line sm" data-act="export">Сохранить копию</button><label class="btn line sm" for="restore">Восстановить из файла</label><input type="file" id="restore" accept="application/json,.json" hidden></div></section>
    ${!S.logs.length && !S.sample ? '<section class="card flat"><h3>Посмотреть на примере</h3><p class="small muted">Загрузит 4 недели примерных тренировок, чтобы увидеть графики и прогноз. Потом удаляется одной кнопкой.</p><button class="btn ghost sm" data-act="demo">Загрузить пример</button></section>' : ''}
    <section class="card flat">${aboutHtml()}</section>`);
}

function syncSheet() {
  openSheet(sheetTop('Синхронизация') + `
    <section class="card"><h3>1. Запусти команду</h3><p class="small muted">Откроются «Команды», заберут данные из Apple Health за сегодня и скопируют их. Потом вернись сюда.</p>
      <label class="f">Название команды — точно как в приложении «Команды»<input class="inp" id="sc-name" value="${esc(scName())}" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"></label>
      <button class="btn" data-act="runshortcut">Запустить команду</button>
      ${S.settings.lastSyncRaw ? '<button class="btn line sm" data-act="syncres">Что пришло в прошлый раз</button>' : ''}
      <p class="small muted">Если «Команды» пишут, что команда не найдена: открой «Команды», посмотри точное название (с пробелами и регистром) и впиши его сюда.</p></section>
    <section class="card"><h3>2. Вставь данные</h3><button class="btn line" data-act="paste">Вставить из буфера</button>
      <details><summary class="small muted" style="cursor:pointer">Вставить вручную</summary><textarea class="inp" id="imp" style="margin-top:8px" placeholder='{"date":"${TODAY_ISO}","protein":96}'></textarea><button class="btn line sm" data-act="import" style="margin-top:8px">Импортировать</button></details></section>
    <details class="acc"><summary><h2>Как создать команду «forma sync»</h2></summary><div class="acc-b small">
      <p>Один раз, на iPhone, в приложении «Команды» → «+». Назови команду <b>forma sync</b>.</p>
      <ol class="steps">
        <li>«Получить словарь из» → <i>Ввод быстрой команды</i>. forma передаёт <code>from</code> и <code>to</code> — время начала и конца тренировки.</li>
        <li>«Получить значение для ключа» <code>from</code>, затем то же для <code>to</code>.</li>
        <li>«Найти образцы здоровья»: тип <i>Пульс</i>, дата начала между <code>from</code> и <code>to</code> → «Вычислить статистику: Среднее». Это <code>workoutHR</code>.</li>
        <li>То же для <i>Активная энергия</i> → «Сумма». Это <code>workoutKcal</code>.</li>
        <li>«Найти образцы здоровья» за сегодня и «Сумма» для: <i>Активная энергия</i> (<code>activeKcal</code>), <i>Шаги</i> (<code>steps</code>), <i>Энергетическая ценность</i> (<code>eatKcal</code>), <i>Белки</i> (<code>protein</code>), <i>Общие жиры</i> (<code>fat</code>), <i>Углеводы</i> (<code>carbs</code>). Питание туда пишет Yazio.</li>
        <li><i>Вес</i>: последний образец, лимит 1 → <code>weight</code>.</li>
        <li>«Словарь» со всеми ключами выше + <code>date</code> (текущая дата в формате ГГГГ-ММ-ДД) → «Скопировать в буфер обмена».</li>
      </ol>
      <p>В Yazio включи запись в Apple Health: Профиль → Настройки → Apple Health. При первом запуске команда попросит доступ к данным Здоровья — разреши.</p>
    </div></details>`);
}
const scName = () => (S.settings.shortcutName || 'forma sync').trim();
function runShortcut() {
  const n = ($('#sc-name')?.value || scName()).trim();
  if (n !== scName()) { S.settings.shortcutName = n; saveLocal(); }
  location.href = 'shortcuts://run-shortcut?name=' + encodeURIComponent(n);
}
function syncResultSheet() {
  const L = S.settings.lastSyncRaw; if (!L) return;
  const r = L.raw; const has = k => r[k] != null && r[k] !== 0;
  const F = [['protein','Белки, г','Yazio'],['eatKcal','Съедено, ккал','Yazio'],['fat','Жиры, г','Yazio'],['carbs','Углеводы, г','Yazio'],['activeKcal','Активные ккал за день','Apple Watch'],['steps','Шаги','iPhone / Watch'],['weight','Вес, кг','весы / вручную'],['workoutHR','Пульс на тренировке','Apple Watch'],['workoutKcal','Ккал тренировки','Apple Watch']];
  const food = ['protein','fat','carbs'], foodN = food.filter(has).length;
  const tips = []; const tx = L.txt || {};
  const val = k => k === 'workoutHR' && L.lowHR ? `<span class="tag warn">${L.lowHR} — не тренировка</span>` : has(k) ? `<b>${fmtKg(r[k])}</b>` : k === 'eatKcal' && L.est ? `<b>≈${L.est}</b>` : k === 'workoutHR' && L.lowHR ? `<span class="tag warn">${L.lowHR} — не тренировка</span>` : tx[k] ? `<span class="tag warn">«${esc(tx[k])}»</span>` : '<span class="tag warn">нет данных</span>';
  if (!has('eatKcal') && L.est) tips.push('Калории еды не пришли из Здоровья, поэтому forma. посчитала их по белкам, жирам и углеводам (≈' + L.est + ' ккал) — это почти точно. Чтобы приходили напрямую, включи «Энергетическая ценность» в доступе YAZIO и «Быстрых команд» (см. ниже).');
  if (L.lb) tips.push('Вес пришёл как ' + fmtKg(L.lb) + ' — это фунты, forma. перевела в ' + fmtKg(r.weight) + ' кг. Чтобы приходили килограммы: в команде в шаге «Найти Данные Здоровья» с типом Weight поставь «Единица» → кг.');
  if (L.lowHR) tips.push('Пульс ' + L.lowHR + ' — это покой, а не тренировка: команда берёт последние 2 часа. Запускай её сразу после тренировки — тогда пульс и калории привяжутся к ней.');
  if (!foodN) tips.push('Питание не пришло. Проверь: Настройки iPhone → Приложения → Здоровье → Доступ к данным и устройства → YAZIO — запись питания включена; и что сегодня в Yazio уже есть записи.');
  else if (foodN < 3) tips.push('Часть питания пришла, часть нет — проверь, что в YAZIO включена запись всех пунктов: Энергетическая ценность, Белки, Жиры, Углеводы.');
  if (!has('activeKcal') || (!has('eatKcal'))) tips.push('Калории в Здоровье — это отдельные типы «Активная энергия» и «Энергетическая ценность», и доступ «Быстрых команд» к каждому типу включается отдельно. Открой Настройки → Приложения → Здоровье → Доступ к данным и устройства → Быстрые команды и включи «Активная энергия» и «Энергетическая ценность» (проще — «Включить все»).');
  if ((has('workoutHR') || has('workoutKcal')) && !L.hadLog) tips.push('Пульс тренировки пришёл, но сегодня в forma. нет тренировки — запусти команду после того, как отметишь тренировку.');
  openSheet(sheetTop('Что пришло') + `<div class="list">${F.map(([k, l, src]) => `<div class="item" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="t">${l}</div><div class="s">${src}</div></div><div class="r">${val(k)}</div></div>`).join('')}</div>
    ${tips.length ? `<section class="note"><b>Что проверить</b><ul class="clean small" style="margin-top:6px">${tips.map(t => `<li>${t}</li>`).join('')}</ul></section>` : '<section class="note"><b>Всё пришло.</b> Можно запускать команду после каждой тренировки и вечером, когда внесёшь еду.</section>'}
    <button class="btn block" data-act="close">Понятно</button>`);
}
async function pasteSync() {
  try { const t = await navigator.clipboard.readText(); toast(mergeSync(t)); }
  catch (e) { toast('Не получилось прочитать буфер. Вставь вручную ниже.'); const d = $('#sheet details'); if (d) d.open = true; }
}
const toNum = v => { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : null; };
function mergeSync(text) {
  let j; try { j = JSON.parse(text); } catch (e) { return 'Не получилось прочитать данные. Проверь, что команда скопировала словарь.'; }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(j.date || '') ? j.date : TODAY_ISO;
  const h = S.health[date] = S.health[date] || {}; let n = 0;
  ['activeKcal','steps','eatKcal','protein','fat','carbs'].forEach(k => { const v = toNum(j[k]); if (v) { h[k] = Math.round(v); n++; } });
  if (!toNum(j.eatKcal) && (h.protein || h.fat || h.carbs)) { h.eatKcal = Math.round((h.protein || 0) * 4 + (h.fat || 0) * 9 + (h.carbs || 0) * 4); h.eatEst = 1; } else if (toNum(j.eatKcal)) delete h.eatEst;
  const w0 = toNum(j.weight), w = lbToKg(w0, date);
  if (w) { S.body = S.body.filter(b => b.date !== date || b.waist); const m = S.body.find(b => b.date === date); if (m) m.weight = r1(w); else S.body.push({date, weight: r1(w)}); S.body.sort((x, y) => x.date < y.date ? -1 : 1); n++; }
  const hr0 = toNum(j.workoutHR), hr = hr0 && hr0 >= 90 ? hr0 : null, kc = toNum(j.workoutKcal);
  const log = S.logs.filter(l => l.date === date).pop();
  if (log && (hr || kc)) { if (hr) log.avgHR = Math.round(hr); if (kc) log.kcal = Math.round(kc + metKcal(1, curWeight(), (log.end - log.start) / 60000)); log.src = 'Apple Watch'; n++; }
  const raw = {}; ['protein','eatKcal','fat','carbs','activeKcal','steps','weight','workoutHR','workoutKcal'].forEach(k => raw[k] = toNum(j[k]));
  const txt = {}; ['eatKcal','activeKcal','workoutKcal'].forEach(k => { if (j[k] != null && j[k] !== '' && !toNum(j[k])) txt[k] = String(j[k]).slice(0, 40); });
  raw.weight = w || null; S.settings.lastSyncRaw = {at: Date.now(), raw, txt, lb: w0 && w !== w0 ? w0 : null, est: h.eatEst ? h.eatKcal : null, lowHR: hr0 && !hr ? Math.round(hr0) : null, hadLog: !!log};
  if (!n) { save(); return 'В данных нет знакомых полей — проверь названия ключей.'; }
  S.settings.lastSync = TODAY_ISO; save(); closeSheet(); render(); setTimeout(syncResultSheet, 250);
  return 'Синхронизировано за ' + fdate(date);
}
function exportBackup() {
  S.settings.fileBackupAt = Date.now(); saveLocal(); setTimeout(render, 300);
  const name = 'forma-backup-' + TODAY_ISO + '.json';
  const file = new File([JSON.stringify(S)], name, {type: 'application/json'});
  if (navigator.canShare && navigator.canShare({files: [file]})) { navigator.share({files: [file], title: name}).catch(() => {}); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function restoreBackup(f) {
  if (!f) return; const r = new FileReader();
  r.onload = () => { try { const j = JSON.parse(r.result); if (!Array.isArray(j.logs) || !Array.isArray(j.body)) throw 0; S = j; save(); closeSheet(); render(); toast('Копия восстановлена: ' + j.logs.length + ' тренировок'); } catch (e) { toast('Это не похоже на копию forma.'); } };
  r.readAsText(f);
}

// фото: IndexedDB на устройстве
let PHOTOS = {};
function idb() { return new Promise((res, rej) => { const q = indexedDB.open('forma', 1); q.onupgradeneeded = () => q.result.createObjectStore('photos'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
async function initPhotos() {
  try { const db = await idb(); const tx = db.transaction('photos'); const st = tx.objectStore('photos');
    const keys = await new Promise(r => { const q = st.getAllKeys(); q.onsuccess = () => r(q.result); });
    const vals = await new Promise(r => { const q = st.getAll(); q.onsuccess = () => r(q.result); });
    keys.forEach((k, i) => PHOTOS[k] = URL.createObjectURL(vals[i]));
  } catch (e) {}
}
const photo = fn => PHOTOS[fn] || null;
async function loadPhotos() {
  const tok = $('#ph-tok').value.trim(), repo = $('#ph-repo').value.trim().replace(/^https:\/\/github.com\//, '');
  const st = $('#ph-status');
  if (!tok) { st.textContent = 'Вставь ключ доступа — без него приватный репозиторий не откроется.'; return; }
  S.settings.mediaRepo = repo; save();
  const files = PDFX.flatMap(p => p.imgs); let done = 0, fail = null;
  let db; try { db = await idb(); } catch (e) { st.textContent = 'Браузер не дал сохранить фото. Выключи частный режим и попробуй ещё раз.'; return; }
  const get = async fn => {
    if (PHOTOS[fn]) { done++; return; }
    const r = await fetch(`https://api.github.com/repos/${repo}/contents/img/${fn}`, {headers: {Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github.raw+json', 'X-GitHub-Api-Version': '2022-11-28'}});
    if (!r.ok) { fail = r.status; return; }
    const b = await r.blob();
    await new Promise(res => { const tx = db.transaction('photos', 'readwrite'); tx.objectStore('photos').put(b, fn); tx.oncomplete = res; tx.onerror = res; });
    PHOTOS[fn] = URL.createObjectURL(b); done++; st.textContent = `Скачано ${done} из ${files.length}…`;
  };
  st.textContent = 'Скачиваю…';
  for (let i = 0; i < files.length && !fail; i += 6) await Promise.all(files.slice(i, i + 6).map(f => get(f).catch(() => { fail = fail || 'net'; })));
  if (fail) st.textContent = fail === 401 ? 'Ключ не подошёл. Проверь, что скопировала его целиком и он не истёк.' : fail === 404 ? 'Не нашла файлы. Проверь название репозитория и что ключ открывает доступ к нему (Contents: Read).' : fail === 403 ? 'GitHub отказал в доступе. Если репозиторий в организации, одобри ключ в настройках организации.' : 'Нет связи с GitHub. Попробуй ещё раз.';
  else { st.textContent = 'Готово: ' + done + ' фото на устройстве.'; toast('Фото загружены'); render(); }
}
async function clearPhotos() {
  Object.values(PHOTOS).forEach(u => URL.revokeObjectURL(u)); PHOTOS = {};
  try { const db = await idb(); await new Promise(r => { const tx = db.transaction('photos', 'readwrite'); tx.objectStore('photos').clear(); tx.oncomplete = r; }); } catch (e) {}
}

// незавершённая тренировка переживает закрытие приложения
function saveSes() { try { if (SES) localStorage.setItem('forma.ses', JSON.stringify(SES)); else localStorage.removeItem('forma.ses'); } catch (e) {} }
function loadSes() { try { const j = JSON.parse(localStorage.getItem('forma.ses')); if (j && Date.now() - j.start < 6 * 3600e3) SES = j; } catch (e) {} }

function onboarding() {
  openSheet(`<div class="welcome-in">
    <div class="welcome-top"><div class="logo welcome-logo">forma<i>.</i></div>
      <p class="welcome-lead">Тренировки, веса и белок — в одном спокойном месте.</p></div>
    <ul class="welcome-list">
      <li><b>A · B · C</b><span>три тренировки в неделю на всё тело</span></li>
      <li><b>↑ вес</b><span>подскажет, сколько брать в следующий раз</span></li>
      <li><b>PR</b><span>рекорды, восстановление мышц и прогноз</span></li>
    </ul>
    <div class="welcome-actions">
      <button class="btn google block" data-act="glogin">${GOOGLE_G} Войти через Google</button>
      <button class="btn line block" data-act="skipwelcome">Продолжить без входа</button>
      <button class="btn-link" data-act="demo">Посмотреть на примере</button>
      <p class="small muted" style="text-align:center">С Google копия хранится на твоём Google Диске — на новом телефоне всё восстановится.</p>
    </div></div>`, 'full welcome');
}
function profileCard() {
  if (S.profile.set || S.sample) return '';
  return `<form class="card" id="fp2"><div class="row between"><h2>Пара цифр о тебе</h2><span class="tag hot">1 минута</span></div>
    <p class="small muted">Для белка, рабочих весов и калькуляторов. Потом всё меняется в настройках.</p>
    <div class="grid2"><label class="f">Вес, кг<input class="inp" id="ob-w" type="number" step="0.1" inputmode="decimal" placeholder="61,5" value="${S.body.length ? curWeight() : ''}"></label><label class="f">Рост, см<input class="inp" id="ob-h" type="number" inputmode="numeric" placeholder="166"></label></div>
    <div class="grid2"><label class="f">Возраст<input class="inp" id="ob-a" type="number" inputmode="numeric" placeholder="30"></label><label class="f">Пульс покоя<input class="inp" id="ob-r" type="number" inputmode="numeric" placeholder="64"></label></div>
    <label class="f">Цель<select class="inp" id="ob-g"><option value="recomp">Рельеф, вес тот же</option><option value="cut">Похудеть</option><option value="bulk">Набрать мышцы</option></select></label>
    <button class="btn block">Сохранить</button></form>`;
}
function finishOnboarding() {
  const w = num('ob-w');
  Object.assign(S.profile, {age: num('ob-a') || S.profile.age, height: num('ob-h') || S.profile.height, restHR: num('ob-r') || S.profile.restHR, goal: $('#ob-g').value, set: true});
  if (w && (!S.body.length || curWeight() !== r1(w))) { S.body = S.body.filter(b => b.date !== TODAY_ISO || b.waist); S.body.push({date: TODAY_ISO, weight: r1(w)}); S.body.sort((x, y) => x.date < y.date ? -1 : 1); }
  S.onboarded = true; save(); render(); toast('Сохранено. Первая тренировка — ' + PLAN[nextWorkout().key].day.toLowerCase());
}


function aboutHtml() {
  return `<span class="eyebrow">О приложении</span><h2>forma<span style="color:var(--hot)">.</span></h2>
    <p class="small">Тренировки, веса и питание в одном месте — под цели: ягодицы, живот, осанка, тазобедренные суставы.</p>
    <h3>Как устроено</h3>
    <div class="flow"><div>Apple Watch / «Фитнес» + Yazio</div><i>↓ записывают в</i><div>Apple Health</div><i>↓ быстрая команда «forma sync»</i><div>forma — данные только на этом устройстве</div></div>
    <h3>Установить на iPhone</h3><p class="small">Открой сайт в Safari → «Поделиться» → «На экран „Домой“». forma откроется как приложение и будет работать без интернета.</p>
    <p class="small muted">Техника упражнений — с карточками и ссылками на «Твой тренер». Расчёты — по общепринятым формулам, это оценки, а не медицинские рекомендации.</p>`;
}


// ---------- Google: вход и копия в Google Диске (скрытая папка приложения) ----------
const GCLIENT = '771904817776-r7nllp6ci2vu27f5tjv32oh9troq93a3.apps.googleusercontent.com';
const GSCOPE = 'https://www.googleapis.com/auth/drive.appdata openid email profile';
let GTOK = null, GEXP = 0, GTC = null, SYNC_T = null, SYNCING = false, GTHEN = null;
const gValid = () => !!GTOK && Date.now() < GEXP;
const STANDALONE = (navigator.standalone === true) || matchMedia('(display-mode: standalone)').matches;
function gSignInRedirect() {
  const st = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { localStorage.setItem('forma.oauth', st); } catch (e) {}
  const p = new URLSearchParams({client_id: GCLIENT, redirect_uri: location.origin + '/', response_type: 'token', scope: GSCOPE, include_granted_scopes: 'true', state: st, prompt: S.google ? 'select_account' : 'consent'});
  if (S.google?.email) p.set('login_hint', S.google.email);
  location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + p.toString();
}
async function gHandleRedirect() {
  if (!location.hash.includes('access_token=') && !location.hash.includes('error=')) return false;
  const h = new URLSearchParams(location.hash.slice(1)); history.replaceState(null, '', location.pathname);
  let st = null; try { st = localStorage.getItem('forma.oauth'); localStorage.removeItem('forma.oauth'); } catch (e) {}
  if (h.get('error') || !h.get('access_token') || (st && h.get('state') !== st)) { toast('Вход через Google не завершён. Попробуй ещё раз.'); return true; }
  GTOK = h.get('access_token'); GEXP = Date.now() + (Number(h.get('expires_in') || 3600) - 60) * 1000;
  try { localStorage.setItem('forma.gtok', JSON.stringify([GTOK, GEXP])); } catch (e) {}
  try { await gProfile(); } catch (e) {}
  S.onboarded = true; saveLocal(); closeSheet();
  await driveSync(true); render();
  return true;
}
function gSignIn(then) {
  if (STANDALONE) { gSignInRedirect(); return; }
  if (!(window.google && google.accounts && google.accounts.oauth2)) { toast('Google ещё загружается — попробуй через пару секунд'); return; }
  GTHEN = then || null;
  if (!GTC) GTC = google.accounts.oauth2.initTokenClient({client_id: GCLIENT, scope: GSCOPE,
    callback: async r => {
      if (r.error) { toast('Вход не удался. Попробуй ещё раз.'); return; }
      GTOK = r.access_token; GEXP = Date.now() + (Number(r.expires_in || 3600) - 60) * 1000;
      try { localStorage.setItem('forma.gtok', JSON.stringify([GTOK, GEXP])); } catch (e) {}
      try { await gProfile(); } catch (e) {}
      await driveSync(true); const t = GTHEN; GTHEN = null; if (t) t();
    },
    error_callback: e => toast(e && e.type === 'popup_closed' ? 'Окно входа закрыто' : 'Не получилось открыть окно Google. Разреши всплывающие окна.')});
  GTC.requestAccessToken({prompt: S.google ? '' : 'consent', login_hint: S.google?.email || ''});
}
async function gFetch(url, opt = {}) {
  const r = await fetch(url, {...opt, headers: {...(opt.headers || {}), Authorization: 'Bearer ' + GTOK}});
  if (r.status === 401) { GTOK = null; throw new Error('auth'); }
  if (!r.ok) throw new Error('http ' + r.status);
  return r;
}
async function gProfile() { const j = await (await gFetch('https://www.googleapis.com/oauth2/v3/userinfo')).json(); S.google = Object.assign(S.google || {}, {email: j.email, name: j.given_name || j.name, picture: j.picture}); saveLocal(); }
function mergeState(a, b) {
  if (!b || !Array.isArray(b.logs)) return a;
  if (a.sample && !b.sample) a = Object.assign(emptyState(), {onboarded: true});
  if (b.sample && !a.sample) b = emptyState();
  const logs = {}; [...(b.logs || []), ...(a.logs || [])].forEach(l => logs[l.id] = l);
  const body = {}; [...(b.body || []), ...(a.body || [])].forEach(x => { const key = x.date + (x.waist ? 'm' : ''); body[key] = Object.assign(body[key] || {}, x); });
  const health = {...(b.health || {})}; Object.entries(a.health || {}).forEach(([d, v]) => health[d] = Object.assign({}, health[d], v));
  const newer = (a.updatedAt || 0) >= (b.updatedAt || 0) ? a : b;
  return {...newer, sample: !!(a.sample && b.sample), onboarded: !!(a.onboarded || b.onboarded), google: a.google || b.google,
    weights: (() => { const w = {...(b.weights || {})}; Object.entries(a.weights || {}).forEach(([k, v]) => { if (!w[k] || (v.at || 0) >= (w[k].at || 0)) w[k] = v; }); return w; })(),
    logs: Object.values(logs).sort((x, y) => x.start - y.start), body: Object.values(body).sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : 0),
    health, settings: {...(b.settings || {}), ...(a.settings || {})}};
}
async function driveSync(interactive) {
  if (!gValid() || SYNCING) return; SYNCING = true;
  try {
    const q = encodeURIComponent("name='forma.json'");
    const list = await (await gFetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)`)).json();
    const f = list.files && list.files[0];
    if (f) { const remote = await (await gFetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`)).json(); S = mergeState(S, remote); }
    S.google = Object.assign(S.google || {}, {lastSync: Date.now(), pending: false});
    const body = JSON.stringify(S);
    if (f) await gFetch(`https://www.googleapis.com/upload/drive/v3/files/${f.id}?uploadType=media`, {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body});
    else { const fd = new FormData(); fd.append('metadata', new Blob([JSON.stringify({name: 'forma.json', parents: ['appDataFolder']})], {type: 'application/json'})); fd.append('file', new Blob([body], {type: 'application/json'}));
      await gFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {method: 'POST', body: fd}); }
    let weekly = false;
    if (weeklyDue()) { await weeklySnapshot(body); weekly = true; }
    saveLocal(); if (interactive || weekly) { if (interactive && $('#sheet') && !SES) closeSheet(); render(); toast(weekly ? 'Сохранена еженедельная копия в Google Диске' : 'Сохранено в Google Диске'); }
  } catch (e) {
    if (S.google) S.google.pending = true; saveLocal();
    if (interactive) toast(e.message === 'auth' ? 'Нужно войти в Google ещё раз' : 'Не получилось связаться с Google Диском');
  }
  SYNCING = false;
}
function gSignOut() {
  try { if (GTOK) google.accounts.oauth2.revoke(GTOK, () => {}); } catch (e) {}
  GTOK = null; GEXP = 0; try { localStorage.removeItem('forma.gtok'); } catch (e) {}
  delete S.google; saveLocal(); closeSheet(); render(); toast('Ты вышла из Google. Данные остались на телефоне.');
}
function gRestore() { try { const [t, e] = JSON.parse(localStorage.getItem('forma.gtok')) || []; if (t && Date.now() < e) { GTOK = t; GEXP = e; } } catch (e) {} }
const weeklyDue = () => !!S.google && (S.logs.length || S.body.length) && (!S.google.weeklyAt || Date.now() - S.google.weeklyAt > 7 * 864e5);
const fileBackupDue = () => !S.google && !S.sample && S.logs.length > 0 && (!S.settings.fileBackupAt || Date.now() - S.settings.fileBackupAt > 7 * 864e5);
async function weeklySnapshot(body) {
  const name = 'forma-backup-' + TODAY_ISO + '.json';
  const fd = new FormData(); fd.append('metadata', new Blob([JSON.stringify({name, parents: ['appDataFolder']})], {type: 'application/json'})); fd.append('file', new Blob([body], {type: 'application/json'}));
  await gFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {method: 'POST', body: fd});
  S.google.weeklyAt = Date.now();
  try { const all = await listBackups(); for (const f of all.slice(8)) await gFetch('https://www.googleapis.com/drive/v3/files/' + f.id, {method: 'DELETE'}); } catch (e) {}
}
async function listBackups() {
  const q = encodeURIComponent("name contains 'forma-backup-'");
  const j = await (await gFetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&orderBy=createdTime desc&fields=files(id,name,createdTime,size)&pageSize=50`)).json();
  return j.files || [];
}
async function backupsSheet() {
  if (!gValid()) { gSignIn(); return; }
  openSheet(sheetTop('Еженедельные копии') + '<p class="small muted">Загружаю список…</p>');
  try {
    const all = await listBackups();
    openSheet(sheetTop('Еженедельные копии') + `<p class="small muted">forma. сама сохраняет копию раз в неделю и хранит 8 последних. Восстановление заменит данные на этом телефоне.</p>
      <div class="list">${all.map(f => { const d = iso(new Date(f.createdTime)); return `<div class="item" style="grid-template-columns:1fr auto"><div><div class="t">${fdate(d)}</div><div class="s">${Math.max(1, Math.round((+f.size || 0) / 1024))} КБ</div></div><button class="btn line sm" data-act="restorecopy" data-id="${f.id}">Восстановить</button></div>`; }).join('') || '<p class="item" style="display:block">Копий пока нет — первая появится после синхронизации.</p>'}</div>`);
  } catch (e) { openSheet(sheetTop('Еженедельные копии') + '<p class="small">Не получилось загрузить список. Потяни главный экран вниз и попробуй снова.</p>'); }
}
async function restoreCopy(id, btn) {
  if (btn.dataset.confirm !== '1') { btn.dataset.confirm = '1'; btn.textContent = 'Да, заменить'; btn.classList.add('day'); return; }
  try { const j = await (await gFetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`)).json(); if (!Array.isArray(j.logs)) throw 0;
    const g = S.google; S = j; S.google = g; S.onboarded = true; S.updatedAt = Date.now(); saveLocal(); closeSheet(); render(); toast('Копия восстановлена: ' + S.logs.length + ' тренировок');
    driveSync(false);
  } catch (e) { toast('Не получилось восстановить копию'); }
}
function backupReminder() {
  if (fileBackupDue()) return `<section class="card"><div class="row between"><h2>Резервная копия</h2><span class="tag warn">раз в неделю</span></div>
    <p class="small muted">Прошла неделя — сохрани копию тренировок. С входом через Google это будет происходить само.</p>
    <div class="row wrap"><button class="btn google sm" data-act="glogin">${GOOGLE_G} Войти через Google</button><button class="btn line sm" data-act="export">Сохранить файл</button></div></section>`;
  if (S.google && !gValid() && weeklyDue()) return `<section class="card"><div class="row between"><h2>Еженедельная копия</h2><span class="tag warn">пора</span></div>
    <p class="small muted">Нажми, чтобы сохранить копию недели в Google Диск. Google просит подтверждать доступ раз в час, поэтому нужно одно нажатие.</p>
    <button class="btn sm" data-act="gsync">Сохранить копию</button></section>`;
  return '';
}
function googleCard() {
  if (S.google) {
    const ls = S.google.lastSync ? new Date(S.google.lastSync) : null;
    return `<section class="card"><div class="acct">${S.google.picture ? `<img src="${esc(S.google.picture)}" alt="" referrerpolicy="no-referrer">` : ''}<div style="min-width:0"><h3>${esc(S.google.name || 'Google')}</h3><p class="small muted">${esc(S.google.email || '')}</p></div></div>
      <p class="small muted">Копия хранится в скрытой папке forma. на твоём Google Диске. ${ls ? 'Последнее сохранение: ' + fdate(iso(ls)) + ', ' + String(ls.getHours()).padStart(2, '0') + ':' + String(ls.getMinutes()).padStart(2, '0') + '.' : ''}</p>
      <p class="small muted">Еженедельная копия: ${S.google.weeklyAt ? fdate(iso(new Date(S.google.weeklyAt))) : 'ещё не было'} · хранятся 8 последних.</p>
      <div class="row wrap"><button class="btn sm" data-act="gsync">Синхронизировать сейчас</button><button class="btn line sm" data-act="backups">Копии по неделям</button><button class="btn ghost sm" data-act="glogout">Выйти</button></div></section>`;
  }
  return `<section class="card"><h3>Вход через Google</h3><p class="small muted">Тренировки, веса и замеры будут сохраняться в скрытую папку forma. на твоём Google Диске. Новый телефон — вошла, и всё на месте.</p>
    <button class="btn google block" data-act="glogin">${GOOGLE_G} Войти через Google</button></section>`;
}

// ================= events =================
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act],[data-tab]'); if (!b) return;
  if (b.dataset.tab) { if (TAB === b.dataset.tab) { window.scrollTo({top: 0, behavior: 'smooth'}); return; } TAB = b.dataset.tab; render(); window.scrollTo(0, 0); return; }
  if (b.dataset.act === 'top') { window.scrollTo({top: 0, behavior: 'smooth'}); return; }
  const a = b.dataset.act;
  if (a === 'ex') exSheet(b.dataset.id);
  else if (a === 'close') { const wasW = !!document.querySelector('#sheet .wlist'); closeSheet(); if (wasW) render(); }
  else if (a === 'ptab') { PLANTAB = b.dataset.k; render(); }
  else if (a === 'gotoplan') { PLANTAB = b.dataset.k; TAB = 'plan'; render(); window.scrollTo(0, 0); }
  else if (a === 'gotoprog') { TAB = 'journal'; JTAB = 'progress'; render(); window.scrollTo(0, 0); }
  else if (a === 'cat') { LIBCAT = b.dataset.c; render(); }
  else if (a === 'jtab') { JTAB = b.dataset.k; render(); }
  else if (a === 'log') logSheet(b.dataset.id);
  else if (a === 'start') startSession(b.dataset.k);
  else if (a === 'restflow') restSheet();
  else if (a === 'settings') settingsSheet();
  else if (a === 'done') { const s = SES.sets[b.dataset.id][+b.dataset.i]; s.done = !s.done; b.setAttribute('aria-pressed', s.done); saveSes();
    if (s.done) { if (!s.r) { const inp = $(`#s-${b.dataset.id}-${b.dataset.i}-r`); s.r = inp.placeholder; inp.value = s.r; } startTimer(['hip_thrust','leg_press','rdl','bulgarian'].includes(b.dataset.id) ? 120 : 90); } }
  else if (a === 'tstop') { clearInterval(TIMER); stopBeeps(); $('#timer').hidden = true; }
  else if (a === 'swap') { const id0 = b.dataset.id; const alt = PLAN[SES.k].main.find(m => m[0] === id0)[5].alt; SES.swap[id0] = SES.swap[id0] ? null : alt; saveSes(); renderSession(); }
  else if (a === 'finish') finishSession();
  else if (a === 'clear') { S = Object.assign(emptyState(), {profile: S.profile, onboarded: true}); save(); closeSheet(); render(); toast('Примеры удалены'); }
  else if (a === 'demo') { S = seed(); save(); closeSheet(); render(); toast('Загружен пример данных'); }
  else if (a === 'resume') { wake(true); renderSession(); }
  else if (a === 'sync') syncSheet();
  else if (a === 'runshortcut') runShortcut();
  else if (a === 'paste') pasteSync();
  else if (a === 'import') { const r = mergeSync($('#imp').value); toast(r); }
  else if (a === 'export') exportBackup();
  else if (a === 'photos') loadPhotos();
  else if (a === 'photosdel') { clearPhotos().then(() => { render(); settingsSheet(); toast('Фото удалены с устройства'); }); }
  else if (a === 'onbdone') finishOnboarding();
  else if (a === 'gotorec') { TAB = 'journal'; JTAB = 'records'; render(); window.scrollTo(0, 0); }
  else if (a === 'wu') { const key = b.dataset.id + b.dataset.i; SES.wu[key] = !SES.wu[key]; b.setAttribute('aria-pressed', !!SES.wu[key]); saveSes(); }
  else if (a === 'glogin') gSignIn(() => { S.onboarded = true; saveLocal(); closeSheet(); render(); });
  else if (a === 'skipwelcome') { S.onboarded = true; saveLocal(); closeSheet(); render(); }
  else if (a === 'gsync') { if (gValid()) driveSync(true); else gSignIn(); }
  else if (a === 'glogout') gSignOut();
  else if (a === 'backups') backupsSheet();
  else if (a === 'syncres') syncResultSheet();
  else if (a === 'weights') weightsSheet();
  else if (a === 'wbw') { const id = b.dataset.id; const c = curW(id); const cur = (S.weights || {})[id] || {w: c.w, bw: !!c.bw || (EX[id].kind === 'bw' && !c.w)}; setW(id, cur.w, !cur.bw); wSync(id); }
  else if (a === 'wstep') { const id = b.dataset.id, e = EX[id]; const inp = $('#w-' + id); const v = parseFloat(String(inp.value).replace(',', '.')) || 0; const nv = Math.max(0, r1(v + (+b.dataset.d) * (e.step || 2.5))); setW(id, nv, false); wSync(id); inp.value = String(nv); }
  else if (a === 'day') dayAction(b.dataset.date);
  else if (a === 'pastday') pastDaySheet(TODAY_ISO);
  else if (a === 'pdk') { document.querySelectorAll('[data-act=pdk]').forEach(x => x.setAttribute('aria-pressed', x === b)); }
  else if (a === 'pdfill' || a === 'pdquick') { const date = $('#pd-date').value || TODAY_ISO; if (date > TODAY_ISO) { toast('Выбери сегодняшний или прошедший день'); return; } const k = document.querySelector('[data-act=pdk][aria-pressed=true]').dataset.k; if (a === 'pdquick') quickLog(date, k); else startSession(k, {date}); }
  else if (a === 'calm') { const [y, m] = CALM.split('-').map(Number); const d = new Date(y, m - 1 + (+b.dataset.d), 1); CALM = iso(d).slice(0, 7); render(); }
  else if (a === 'editlog') { const l = S.logs.find(x => x.id === b.dataset.id); if (l) startSession(l.day, {editId: l.id}); }
  else if (a === 'dellog') { if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Точно удалить?'; return; } S.logs = S.logs.filter(x => x.id !== b.dataset.id); save(); closeSheet(); render(); toast('Тренировка удалена'); }
  else if (a === 'sbw') { const id = b.dataset.id; SES.bw[id] = b.dataset.v === '1'; if (!SES.bw[id]) { const sg = suggest(id, SES.k); SES.sets[id].forEach(x => { if (!x.w && !x.done) x.w = sg.w || ''; }); } saveSes(); const y = $('#sheet .sheet').scrollTop; renderSession(); $('#sheet .sheet').scrollTop = y; }

  else if (a === 'restorecopy') restoreCopy(b.dataset.id, b);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'libq') { LIBQ = t.value; const pos = t.selectionStart; render(); const n = $('#libq'); n.focus(); n.setSelectionRange(pos, pos); }
  else if (t.dataset.w) { const v = parseFloat(String(t.value).replace(',', '.')); setW(t.dataset.w, isNaN(v) ? null : v, false); }
  else if (t.dataset.set && SES) { const [id, i, f] = t.dataset.set.split('|'); const arr = SES.sets[id]; const old = arr[+i][f]; arr[+i][f] = t.value;
    if (f === 'w') arr.forEach((x, j) => { if (j > +i && !x.done && String(x.w) === String(old)) { x.w = t.value; const el = $(`#s-${id}-${j}-w`); if (el) el.value = t.value; } });
    saveSes(); }
  else if (t.dataset.chk && SES) { const [g, id] = t.dataset.chk.split('|'); SES[g][id] = t.checked; saveSes(); }
  else if (TAB === 'calc' && t.closest('.acc')) calcAll();
});
document.addEventListener('change', e => { if (TAB === 'calc' && e.target.closest('.acc')) calcAll(); if (e.target.dataset.chk && SES) { const [g, id] = e.target.dataset.chk.split('|'); SES[g][id] = e.target.checked; } });
document.addEventListener('submit', e => {
  e.preventDefault(); const f = e.target;
  if (f.id === 'fw') { const v = num('fw-w'); if (!v) return toast('Впиши вес в килограммах'); S.body = S.body.filter(b => b.date !== $('#fw-d').value || b.waist); S.body.push({date: $('#fw-d').value, weight: v}); S.body.sort((x, y) => x.date < y.date ? -1 : 1); save(); render(); toast('Вес сохранён'); }
  if (f.id === 'fm') { const w = num('fm-w'), h = num('fm-h'), t = num('fm-t'); if (!w && !h) return toast('Заполни хотя бы талию или ягодицы'); S.body.push({date: TODAY_ISO, weight: curWeight(), waist: w, hips: h, thigh: t}); S.body.sort((x, y) => x.date < y.date ? -1 : 1); save(); render(); toast('Замер сохранён'); }
  if (f.id === 'fp') { Object.assign(S.profile, {age: num('pf-a'), height: num('pf-h'), restHR: num('pf-r'), goal: $('#pf-g').value, set: true}); save(); closeSheet(); render(); toast('Профиль сохранён'); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ((SES && $('#sheet')) || $('#sheet .welcome')) return; closeSheet(); } });
document.addEventListener('change', e => { if (e.target.id === 'restore') restoreBackup(e.target.files[0]); });

document.addEventListener('submit', e => { if (e.target.id === 'fp2') { e.preventDefault(); finishOnboarding(); } });
load(); loadSes(); gRestore();
if (S.google && !S.onboarded) { S.onboarded = true; saveLocal(); }
$('#aside').innerHTML = `<div class="aside-stack"><div class="card">${aboutHtml()}</div></div>`;
if (location.hash.startsWith('#sync=')) {
  try { const b = location.hash.slice(6).replace(/-/g, '+').replace(/_/g, '/'); const txt = decodeURIComponent(escape(atob(b))); setTimeout(() => toast(mergeSync(txt)), 300); } catch (e) {}
  history.replaceState(null, '', location.pathname);
}
const RETURNING_FROM_GOOGLE = location.hash.includes('access_token=') || location.hash.includes('error=');
render();
initPhotos().then(() => { if (Object.keys(PHOTOS).length) render(); });
if (RETURNING_FROM_GOOGLE) gHandleRedirect(); else if (!S.onboarded) onboarding();
if (!RETURNING_FROM_GOOGLE && gValid()) setTimeout(() => driveSync(false), 1500);
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hadCtrl = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadCtrl && !reloaded && !SES) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
}

// ---------- потянуть вниз, чтобы обновить ----------
async function refreshAll() {
  try { const r = await navigator.serviceWorker?.getRegistration(); await r?.update(); } catch (e) {}
  if (gValid()) await driveSync(false);
  await initPhotos(); render();
  toast(S.google && !gValid() ? 'Обновлено. Для Google Диска нажми «Сохранить в Google»' : 'Обновлено');
}
(function pullToRefresh() {
  const ind = document.createElement('div'); ind.id = 'ptr'; ind.setAttribute('aria-hidden', 'true');
  ind.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5v12M6 11l6 6 6-6"/></svg>'; document.body.appendChild(ind);
  let y0 = null, busy = false;
  const reset = () => { ind.style.transform = ''; ind.style.opacity = '0'; ind.classList.remove('ready'); };
  addEventListener('touchstart', e => { y0 = (!busy && !$('#sheet') && scrollY <= 0) ? e.touches[0].clientY : null; }, {passive: true});
  addEventListener('touchmove', e => { if (y0 == null) return; const dy = e.touches[0].clientY - y0; if (dy <= 0 || scrollY > 0) { reset(); return; }
    const d = Math.min(120, dy * 0.5); ind.style.transform = `translate(-50%, ${d}px) rotate(${Math.min(180, d * 2.8)}deg)`; ind.style.opacity = String(Math.min(1, d / 50)); ind.classList.toggle('ready', d >= 64); }, {passive: true});
  addEventListener('touchend', () => { if (y0 == null) return; y0 = null;
    if (!ind.classList.contains('ready')) { reset(); return; }
    busy = true; ind.classList.add('spin'); ind.style.transform = 'translate(-50%, 64px)';
    refreshAll().finally(() => { busy = false; ind.classList.remove('spin'); reset(); }); });
})();

