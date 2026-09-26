/* ═══════════════ LAKSHYA · app logic ═══════════════ */
(function () {
'use strict';
const C = window.Calc;
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const KEY = 'lakshya.v1';

/* ───────── state ───────── */
let state = load();
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') return Object.assign(defaults(), s);
  } catch (e) {}
  return defaults();
}
function defaults() { return { goal: null, entries: [], loans: [], reminders: [], milestonesHit: [] }; }
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate = iso => { const d = C.parseISO(iso); return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); };
const niceDate = iso => { const d = C.parseISO(iso); return d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' }); };

/* ───────── toast ───────── */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 2600);
}

/* ───────── confetti ───────── */
function confetti() {
  try {
    const cv = $('#confettiCanvas'), ctx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    const cols = ['#f5c451','#7c5cff','#2dd4bf','#e2647f','#ffffff'];
    const ps = Array.from({length: 90}, () => ({
      x: innerWidth/2 + (Math.random()-.5)*140, y: innerHeight*0.35,
      vx: (Math.random()-.5)*11, vy: -Math.random()*11-4,
      s: Math.random()*7+3, c: cols[Math.random()*cols.length|0], r: Math.random()*Math.PI
    }));
    let f = 0;
    (function tick(){
      ctx.clearRect(0,0,cv.width,cv.height);
      ps.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.vy+=0.32; p.r+=0.12;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r); ctx.fillStyle=p.c; ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*0.6); ctx.restore(); });
      if (++f < 110) requestAnimationFrame(tick); else ctx.clearRect(0,0,cv.width,cv.height);
    })();
  } catch (e) { /* canvas unavailable (test env) */ }
}

/* ───────── sheet system ───────── */
function openSheet(html) {
  $('#sheetBody').innerHTML = html + '<button class="sheet-close" id="sheetX">✕</button>';
  $('#sheetBackdrop').classList.remove('hidden');
  $('#sheet').classList.remove('hidden');
  $('#sheetX').onclick = closeSheet;
}
function closeSheet() {
  $('#sheetBackdrop').classList.add('hidden');
  $('#sheet').classList.add('hidden');
}
$('#sheetBackdrop').addEventListener('click', closeSheet);

/* ───────── navigation ───────── */
$$('.nav-btn').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
function go(tab) {
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + tab));
  $('#mainScroll').scrollTop = 0;
  renderAll();
}

/* ───────── header ───────── */
function renderHeader() {
  const h = new Date().getHours();
  $('#hdrGreet').textContent = h < 12 ? 'Good morning ☀️' : h < 17 ? 'Good afternoon 🌤' : 'Good evening 🌙';
  $('#hdrDate').textContent = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });
  $('#bellDot').classList.toggle('hidden', !state.reminders.some(r => r.on));
}
$('#bellBtn').addEventListener('click', () => go('more'));

/* ═════════ DASHBOARD ═════════ */
function renderDashboard() {
  const g = state.goal; if (!g) return;
  const today = C.todayISO();
  const t = C.targets(g.amount, g.saved, g.deadline, today);
  const earnedToday = C.earnedOn(state.entries, today);

  $('#goalName').textContent = g.name;
  $('#earnedBig').textContent = C.inr(g.saved);
  $('#goalAmtInline').textContent = C.inr(g.amount);
  $('#progressPct').textContent = Math.floor(t.progress) + '%';
  $('#ringFg').style.strokeDashoffset = (402.1 * (1 - t.progress / 100)).toFixed(1);
  $('#progressBar').style.width = t.progress + '%';

  $('#stGoal').textContent = C.inrShort(g.amount);
  $('#stEarned').textContent = C.inrShort(g.saved);
  $('#stRemaining').textContent = C.inrShort(t.remaining);
  $('#stDaysLeft').textContent = t.daysLeft;

  $('#todayTarget').textContent = t.done ? '🎉 Done!' : C.inr(t.todayTarget);
  $('#todayEarnedSub').textContent = 'Earned today: ' + C.inr(earnedToday) +
    (earnedToday >= t.todayTarget && t.todayTarget > 0 ? ' ✓ target hit' : '');
  const remAfterToday = Math.max(0, t.remaining - Math.max(0, earnedToday - 0));
  const tomo = t.daysLeft > 1 ? Math.ceil(Math.max(0, t.remaining - (earnedToday >= t.todayTarget ? 0 : 0)) / (t.daysLeft - 1)) : 0;
  $('#tomorrowTarget').textContent = t.done ? '₹0' : C.inr(t.daysLeft > 1 ? Math.ceil(remAfterToday / (t.daysLeft - 1)) : 0);
  $('#tomoSub').textContent = t.daysLeft > 1 ? 'to stay perfectly on pace' : 'final day tomorrow!';

  // pace pill
  const pill = $('#pacePill');
  if (t.done) { pill.textContent = '🏆 Goal achieved!'; pill.classList.remove('behind'); }
  else {
    const expected = g.amount * (1 - t.daysLeft / (C.diffDays(g.deadline, g.startDate || today) + 1 || 1));
    const behind = g.saved < expected && t.daysLeft > 0;
    pill.textContent = behind ? '🐢 Behind pace — you got this' : '🚀 On track';
    pill.classList.toggle('behind', behind);
  }

  // milestones
  const marks = [25, 50, 75, 100];
  $('#milestoneRow').innerHTML = marks.map(m => {
    const done = t.progress >= m;
    return `<div class="ms ${done ? 'done' : ''}"><div class="ms-ico">${m===100?'🏆':done?'⭐':'☆'}</div><div class="ms-pct">${m}%</div><div class="ms-lbl">${C.inrShort(g.amount*m/100)}</div></div>`;
  }).join('');
  // celebrate newly crossed milestone
  marks.forEach(m => {
    if (t.progress >= m && !state.milestonesHit.includes(m)) {
      state.milestonesHit.push(m); save();
      toast(m === 100 ? '🏆 GOAL ACHIEVED! Incredible!' : `🎉 ${m}% milestone reached!`);
      confetti();
    }
  });

  // recent entries
  const rec = state.entries.slice(0, 5);
  $('#recentEntries').innerHTML = rec.length ? rec.map(e =>
    `<div class="entry-row"><div class="entry-dot">💵</div>
      <div class="entry-info"><div class="entry-title">${e.date === today ? 'Today' : niceDate(e.date)}</div>
      <div class="entry-sub">Total after update: ${C.inr(e.totalAfter != null ? e.totalAfter : '—')}</div></div>
      <div class="entry-amt">+${C.inr(e.earned)}</div></div>`).join('')
    : '<div class="empty">No daily updates yet — tap ＋ below to log today\'s earnings ✨</div>';
}

/* ═════════ DAILY UPDATE FLOW ═════════ */
$('#fabUpdate').addEventListener('click', openUpdateSheet);
function openUpdateSheet() {
  const g = state.goal; if (!g) return;
  const today = C.todayISO();
  const t = C.targets(g.amount, g.saved, g.deadline, today);
  const already = C.earnedOn(state.entries, today);
  openSheet(`
    <h2 class="sheet-title">✏️ Daily update</h2>
    <p class="sheet-sub">${niceDate(today)} · Remaining <b style="color:var(--gold2)">${C.inr(t.remaining)}</b> · ${t.daysLeft} day${t.daysLeft===1?'':'s'} left${already ? `<br>Already logged today: <b>${C.inr(already)}</b> — saving will replace it.` : ''}</p>
    <label class="fld"><span>💵 Earned today (₹)</span>
      <input id="duEarned" type="number" inputmode="decimal" min="0" step="any" placeholder="${t.todayTarget}" value="${already || ''}"></label>
    <label class="fld"><span>🏦 Current total money towards goal (₹)</span>
      <input id="duTotal" type="number" inputmode="decimal" min="0" step="any" placeholder="${g.saved}"></label>
    <div class="live-preview"><span class="lp-lbl">🌙 Tomorrow's target</span><span class="lp-val" id="duTomo">—</span></div>
    <button class="btn btn-gold btn-block" id="duSave">Save today's progress</button>`);

  const earnedEl = $('#duEarned'), totalEl = $('#duTotal'), tomoEl = $('#duTomo');
  earnedEl.addEventListener('input', () => { totalEl.value = (g.saved + (Number(earnedEl.value) || 0)) || ''; preview(); });
  totalEl.addEventListener('input', preview);
  function preview() {
    const newTotal = Number(totalEl.value) || g.saved;
    const rem = Math.max(0, g.amount - newTotal);
    tomoEl.textContent = t.daysLeft > 1 ? C.inr(Math.ceil(rem / (t.daysLeft - 1))) : (rem > 0 ? 'Final day!' : '🏆 Done');
  }
  preview();

  $('#duSave').onclick = () => {
    const earned = Math.max(0, Number(earnedEl.value) || 0);
    let newSaved = totalEl.value === '' ? g.saved + earned : Math.max(0, Number(totalEl.value));
    if (earned === 0 && totalEl.value === '') { toast('Enter today\'s earning first 🙂'); return; }
    state.entries = C.upsertEntry(state.entries, today, earned);
    const e = state.entries.find(x => x.date === today);
    e.totalAfter = newSaved;
    state.goal.saved = newSaved;
    save(); closeSheet();
    toast(earned ? `+${C.inr(earned)} logged — keep going! 🔥` : 'Progress saved ✓');
    if (state.goal.saved >= state.goal.amount) confetti();
    renderAll();
  };
}

/* ═════════ LOANS ═════════ */
let loanFilter = 'all';
$('#loanSeg').addEventListener('click', e => {
  const b = e.target.closest('.seg-btn'); if (!b) return;
  loanFilter = b.dataset.f;
  $$('#loanSeg .seg-btn').forEach(x => x.classList.toggle('active', x === b));
  renderLoans();
});

function renderLoans() {
  if (!state.goal) return;
  const tot = C.loanTotals(state.loans);
  $('#sumBorrowed').textContent = C.inr(tot.borrowed);
  $('#sumLent').textContent = C.inr(tot.lent);

  const list = state.loans.filter(l => loanFilter === 'all' || l.type === loanFilter);
  $('#loanList').innerHTML = list.length ? list.map(l => {
    const out = C.loanOutstanding(l);
    const paid = l.amount - out;
    const pct = l.amount > 0 ? Math.min(100, paid / l.amount * 100) : 0;
    const settled = out <= 0;
    const initial = esc((l.person || '?').trim().charAt(0).toUpperCase());
    return `<div class="loan-card ${settled ? 'settled' : ''}" data-id="${l.id}">
      <div class="loan-top">
        <div class="loan-ava ${l.type}">${initial}</div>
        <div class="loan-name"><b>${esc(l.person)}</b>
          <span>${l.type === 'borrowed' ? '↙ You borrowed' : '↗ You lent'} · ${fmtDate(l.date)}${l.note ? ' · ' + esc(l.note) : ''}</span></div>
        <div class="loan-amt"><b style="color:${settled ? 'var(--green)' : l.type === 'borrowed' ? 'var(--red)' : 'var(--green)'}">${settled ? '✓ ' : ''}${C.inr(out)}</b>
          <span>of ${C.inr(l.amount)}</span></div>
      </div>
      <div class="loan-bar"><i style="width:${pct}%"></i></div>
      <div class="loan-actions">
        ${settled ? '<button class="mini-btn" data-act="hist">📜 Settlement history</button>'
                  : '<button class="mini-btn gold" data-act="settle">💸 Settle</button><button class="mini-btn" data-act="hist">📜 History</button>'}
        <button class="mini-btn" data-act="del">🗑</button>
      </div>
      <div class="settle-hist"><h4>Settlement history</h4>
        ${(l.settlements || []).length ? l.settlements.map(s =>
          `<div class="sh-row"><span>${niceDate(s.date)}</span><b>+${C.inr(s.amount)}</b></div>`).join('')
          : '<div class="sh-row"><span>No settlements yet</span></div>'}
      </div>
    </div>`;
  }).join('') : '<div class="empty">No ${x} records yet'.replace('${x}', loanFilter === 'all' ? 'loan' : loanFilter) + ' — tap below to add one 🤝</div>';

  $$('#loanList .loan-card').forEach(card => {
    const id = card.dataset.id;
    card.querySelectorAll('.mini-btn').forEach(btn => btn.addEventListener('click', () => {
      const act = btn.dataset.act;
      if (act === 'settle') openSettleSheet(id);
      else if (act === 'del') {
        state.loans = state.loans.filter(l => l.id !== id); save(); renderAll(); toast('Record deleted');
      } else card.querySelector('.settle-hist').classList.toggle('open');
    }));
  });
}

$('#addLoanBtn').addEventListener('click', () => {
  openSheet(`
    <h2 class="sheet-title">🤝 New borrowed / lent</h2>
    <p class="sheet-sub">Track money that moved between you and others.</p>
    <div class="seg sheet-seg" id="lnSeg">
      <button class="seg-btn active" data-t="borrowed">I borrowed</button>
      <button class="seg-btn" data-t="lent">I lent</button>
    </div>
    <label class="fld"><span>👤 Person's name</span><input id="lnPerson" type="text" maxlength="30" placeholder="e.g. Rahul"></label>
    <div class="row-2">
      <label class="fld"><span>💰 Amount (₹)</span><input id="lnAmount" type="number" inputmode="decimal" min="1" step="any" placeholder="1000"></label>
      <label class="fld"><span>📅 Date</span><input id="lnDate" type="date" value="${C.todayISO()}"></label>
    </div>
    <label class="fld"><span>📝 Note <i class="opt">optional</i></span><input id="lnNote" type="text" maxlength="60" placeholder="e.g. for rent"></label>
    <button class="btn btn-violet btn-block" id="lnSave">Add record</button>`);
  let type = 'borrowed';
  $('#lnSeg').addEventListener('click', e => {
    const b = e.target.closest('.seg-btn'); if (!b) return;
    type = b.dataset.t;
    $$('#lnSeg .seg-btn').forEach(x => x.classList.toggle('active', x === b));
  });
  $('#lnSave').onclick = () => {
    const person = $('#lnPerson').value.trim(), amount = Number($('#lnAmount').value);
    if (!person || !(amount > 0)) { toast('Name & valid amount needed 🙂'); return; }
    state.loans.unshift({ id: uid(), type, person, amount, note: $('#lnNote').value.trim(),
      date: $('#lnDate').value || C.todayISO(), settlements: [] });
    save(); closeSheet(); renderAll();
    toast(type === 'borrowed' ? `Borrowed ${C.inr(amount)} from ${person}` : `Lent ${C.inr(amount)} to ${person}`);
  };
});

function openSettleSheet(id) {
  const l = state.loans.find(x => x.id === id); if (!l) return;
  const out = C.loanOutstanding(l);
  openSheet(`
    <h2 class="sheet-title">💸 Settle with ${esc(l.person)}</h2>
    <p class="sheet-sub">Outstanding: <b style="color:var(--gold2)">${C.inr(out)}</b> of ${C.inr(l.amount)} · enter a partial or full amount.</p>
    <label class="fld"><span>Amount settled (₹)</span><input id="stAmount" type="number" inputmode="decimal" min="1" max="${out}" step="any" placeholder="${out}"></label>
    <button class="btn btn-gold btn-block" id="stSave">Record settlement</button>
    <button class="btn btn-ghost btn-block" id="stFull" style="margin-top:10px">Settle full ${C.inr(out)} ✓</button>`);
  const doSettle = amt => {
    if (!(amt > 0)) { toast('Enter a valid amount'); return; }
    amt = Math.min(amt, out);
    l.settlements.push({ date: C.todayISO(), amount: amt });
    save(); closeSheet(); renderAll();
    toast(C.loanOutstanding(l) <= 0 ? `Fully settled with ${l.person} 🎉` : `${C.inr(amt)} settled with ${l.person}`);
  };
  $('#stSave').onclick = () => doSettle(Number($('#stAmount').value));
  $('#stFull').onclick = () => doSettle(out);
}

/* ═════════ ANALYTICS ═════════ */
function renderStats() {
  if (!state.goal) return;
  const today = C.todayISO();
  const days = [], vals = [];
  for (let i = 6; i >= 0; i--) { const d = C.addDays(today, -i); days.push(d); vals.push(C.earnedOn(state.entries, d)); }
  const max = Math.max(...vals, 1);
  $('#weekChart').innerHTML = days.map((d, i) => {
    const hot = vals[i] === max && vals[i] > 0;
    return `<div class="wc-col"><div class="wc-val">${vals[i] ? C.inrShort(vals[i]) : ''}</div>
      <div class="wc-bar ${hot ? 'hot' : ''}" style="height:${Math.max(3, vals[i] / max * 82)}%"></div>
      <div class="wc-day">${C.parseISO(d).toLocaleDateString('en-IN', { weekday: 'narrow' })}</div></div>`;
  }).join('');
  const wTotal = vals.reduce((a, b) => a + b, 0);
  $('#weekTotal').textContent = 'Total: ' + C.inr(wTotal);
  $('#weekAvg').textContent = 'Avg/day: ' + C.inr(Math.round(wTotal / 7));

  const all = state.entries.filter(e => e.earned > 0);
  $('#bestDay').textContent = all.length ? C.inrShort(Math.max(...all.map(e => e.earned))) : '₹0';
  $('#streak').textContent = C.streak(state.entries, today);
  $('#avgDaily').textContent = all.length ? C.inrShort(Math.round(all.reduce((s, e) => s + e.earned, 0) / all.length)) : '₹0';
  const net = C.loanTotals(state.loans).net;
  $('#loanNet').textContent = (net < 0 ? '-' : '') + C.inrShort(Math.abs(net));

  const g = state.goal;
  const t = C.targets(g.amount, g.saved, g.deadline, today);
  const p = C.projection(state.entries, t.remaining, g.deadline, today);
  if (t.done) $('#projectionText').innerHTML = `🏆 <b>Goal complete!</b> You saved <b>${C.inr(g.amount)}</b>. Set a new goal from More → Edit goal.`;
  else if (!p) $('#projectionText').textContent = 'Log a few daily earnings (tap ＋) and I\'ll forecast your finish date here.';
  else if (p.deltaDays > 0) $('#projectionText').innerHTML =
    `At your current pace of <b>${C.inr(Math.round(p.avg))}/day</b>, you'll finish around <b>${niceDate(p.finishISO)}</b> — about <b style="color:var(--red)">${p.deltaDays} day${p.deltaDays===1?'':'s'} late</b>.<br>Raise daily earning to <span class="gold-t"><b>${C.inr(t.todayTarget)}</b></span> to finish on time.`;
  else $('#projectionText').innerHTML =
    `At your current pace of <b>${C.inr(Math.round(p.avg))}/day</b>, you'll hit <span class="gold-t"><b>${C.inr(g.amount)}</b></span> around <b>${niceDate(p.finishISO)}</b> — <b>${Math.abs(p.deltaDays)} day${Math.abs(p.deltaDays)===1?'':'s'} early</b>! 🚀`;
}

/* ═════════ REMINDERS + MORE ═════════ */
function renderMore() {
  const rl = $('#reminderList');
  rl.innerHTML = state.reminders.length ? state.reminders.map(r =>
    `<div class="entry-row ${r.on ? '' : 'rem-off'}"><div class="entry-dot rem-dot">⏰</div>
      <div class="entry-info"><div class="entry-title">${esc(r.title)}</div><div class="entry-sub">Daily · ${r.time}</div></div>
      <div class="switch ${r.on ? 'on' : ''}" data-id="${r.id}"></div></div>`).join('')
    : '<div class="empty">No reminders yet — add a daily nudge 🔔</div>';
  rl.querySelectorAll('.switch').forEach(sw => sw.addEventListener('click', () => {
    const r = state.reminders.find(x => x.id === sw.dataset.id);
    r.on = !r.on; save(); renderMore(); renderHeader();
  }));
  rl.querySelectorAll('.entry-row').forEach((row, i) => {
    row.querySelector('.entry-dot').addEventListener('click', () => {
      state.reminders.splice(i, 1); save(); renderMore(); renderHeader(); toast('Reminder deleted');
    });
  });
}

$('#addReminderBtn').addEventListener('click', () => {
  openSheet(`
    <h2 class="sheet-title">⏰ New reminder</h2>
    <p class="sheet-sub">While the app is open, we'll nudge you at this time every day.</p>
    <label class="fld"><span>Title</span><input id="rmTitle" type="text" maxlength="40" placeholder="Log today's earnings 💵"></label>
    <label class="fld"><span>Time</span><input id="rmTime" type="time" value="21:00"></label>
    <button class="btn btn-gold btn-block" id="rmSave">Save reminder</button>`);
  $('#rmSave').onclick = () => {
    const title = $('#rmTitle').value.trim() || 'Log today\'s earnings 💵';
    state.reminders.push({ id: uid(), title, time: $('#rmTime').value || '21:00', on: true, lastFired: '' });
    state.reminders.sort((a, b) => a.time.localeCompare(b.time));
    save(); closeSheet(); renderMore(); renderHeader(); toast('Reminder set for ' + ($('#rmTime') ? '' : '') + '✓');
  };
});

// reminder checker — fires toast when time matches while app is open
setInterval(() => {
  const now = new Date();
  const hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const today = C.todayISO();
  state.reminders.forEach(r => {
    if (r.on && r.time === hm && r.lastFired !== today) {
      r.lastFired = today; save();
      toast('⏰ ' + r.title);
      try { if ('Notification' in window && Notification.permission === 'granted') new Notification('Lakshya', { body: r.title }); } catch (e) {}
    }
  });
}, 20000);
try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}

/* ───────── more menu ───────── */
$('#menuEditGoal').addEventListener('click', () => openSetup(true));
$('#editGoalBtn').addEventListener('click', () => openSetup(true));
$('#menuExport').addEventListener('click', () => {
  try {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'lakshya-backup.json'; a.click();
    toast('Backup downloaded 📤');
  } catch (e) { toast('Export not supported here'); }
});
$('#menuReset').addEventListener('click', () => {
  openSheet(`
    <h2 class="sheet-title">🗑 Reset everything?</h2>
    <p class="sheet-sub">This deletes your goal, all daily entries, loans and reminders. This cannot be undone.</p>
    <button class="btn btn-danger btn-block" id="resetYes">Yes, wipe it all</button>
    <button class="btn btn-ghost btn-block" id="resetNo" style="margin-top:10px">Cancel</button>`);
  $('#resetNo').onclick = closeSheet;
  $('#resetYes').onclick = () => { state = defaults(); save(); closeSheet(); boot(); toast('Fresh start ✨'); };
});

/* ═════════ SETUP ═════════ */
function openSetup(isEdit) {
  const ov = $('#setupOverlay');
  ov.classList.remove('hidden');
  const g = state.goal;
  if (isEdit && g) {
    $('#setupName').value = g.name; $('#setupAmount').value = g.amount;
    $('#setupSaved').value = g.saved; $('#setupDeadline').value = g.deadline;
    ov.querySelector('.setup-title').textContent = 'Edit Goal';
    ov.querySelector('.btn-gold').textContent = 'Save changes ✓';
  } else {
    $('#setupDeadline').min = C.todayISO();
    if (!$('#setupDeadline').value) $('#setupDeadline').value = C.addDays(C.todayISO(), 30);
  }
}
$('#setupForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#setupName').value.trim(), amount = Number($('#setupAmount').value);
  const saved = Math.max(0, Number($('#setupSaved').value) || 0), deadline = $('#setupDeadline').value;
  if (!name || !(amount > 0) || !deadline) { toast('Fill goal name, amount & date 🙂'); return; }
  const isNew = !state.goal;
  state.goal = { name, amount, saved, deadline, startDate: state.goal ? state.goal.startDate : C.todayISO() };
  save();
  $('#setupOverlay').classList.add('hidden');
  renderAll();
  toast(isNew ? `Lakshya set: ${C.inr(amount)} 🎯` : 'Goal updated ✓');
  if (isNew) confetti();
});

/* ═════════ BOOT ═════════ */
function renderAll() { if (!state.goal) { renderHeader(); return; } renderHeader(); renderDashboard(); renderLoans(); renderStats(); renderMore(); }
function boot() {
  renderHeader();
  if (!state.goal) openSetup(false);
  else renderAll();
  go('home');
}
boot();
window.__Lakshya = { get state() { return state; }, save, renderAll }; // for testing
})();
