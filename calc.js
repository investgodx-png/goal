/* ═══════ Lakshya · pure money/goal calculations (browser + node testable) ═══════ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.Calc = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // Local date → "YYYY-MM-DD" (no UTC drift)
  function toISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function todayISO() { return toISO(new Date()); }
  function parseISO(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
  function diffDays(aISO, bISO) { // a - b in whole days
    return Math.round((parseISO(aISO) - parseISO(bISO)) / 86400000);
  }
  function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); }

  // Indian rupee formatting — clean, no decimals unless needed
  function inr(n) {
    n = Number(n) || 0;
    const neg = n < 0; n = Math.abs(n);
    const hasDec = Math.round(n * 100) % 100 !== 0;
    const s = n.toLocaleString('en-IN', { maximumFractionDigits: hasDec ? 2 : 0, minimumFractionDigits: 0 });
    return (neg ? '-₹' : '₹') + s;
  }
  // compact: ₹1.2L / ₹45k for tight tiles
  function inrShort(n) {
    n = Number(n) || 0;
    const a = Math.abs(n);
    if (a >= 10000000) return '₹' + (n / 10000000).toFixed(1).replace(/\.0$/, '') + 'Cr';
    if (a >= 100000) return '₹' + (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
    if (a >= 1000) return '₹' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return inr(n);
  }

  // Days left INCLUDING today. Past deadline → 0.
  function daysLeft(deadlineISO, today) {
    return Math.max(0, diffDays(deadlineISO, today || todayISO()) + 1);
  }

  // Core dashboard math
  function targets(goalAmount, saved, deadlineISO, today) {
    goalAmount = Number(goalAmount) || 0; saved = Number(saved) || 0;
    const remaining = Math.max(0, goalAmount - saved);
    const dl = daysLeft(deadlineISO, today);
    return {
      remaining,
      daysLeft: dl,
      todayTarget: dl > 0 ? Math.ceil(remaining / dl) : 0,
      tomorrowTarget: dl > 1 ? Math.ceil(remaining / (dl - 1)) : 0,
      progress: goalAmount > 0 ? Math.min(100, (saved / goalAmount) * 100) : 0,
      done: goalAmount > 0 && saved >= goalAmount
    };
  }

  // earned on a specific date from entries[]
  function earnedOn(entries, iso) {
    const e = (entries || []).find(x => x.date === iso);
    return e ? Number(e.earned) || 0 : 0;
  }

  // upsert a daily entry; returns new entries array (sorted desc by date)
  function upsertEntry(entries, iso, earned) {
    const list = (entries || []).filter(e => e.date !== iso);
    list.push({ date: iso, earned: Math.max(0, Number(earned) || 0) });
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }

  // consecutive-day streak ending today/yesterday
  function streak(entries, today) {
    const set = new Set((entries || []).filter(e => Number(e.earned) > 0).map(e => e.date));
    let cur = today || todayISO();
    if (!set.has(cur)) cur = addDays(cur, -1); // today not logged yet — count from yesterday
    let n = 0;
    while (set.has(cur)) { n++; cur = addDays(cur, -1); }
    return n;
  }

  // projection from average of last 7 active days
  function projection(entries, remaining, deadlineISO, today) {
    const t = today || todayISO();
    const recent = (entries || []).filter(e => e.date <= t && Number(e.earned) > 0).slice(0, 7);
    if (!recent.length || remaining <= 0) return null;
    const avg = recent.reduce((s, e) => s + Number(e.earned), 0) / recent.length;
    const daysNeeded = Math.ceil(remaining / avg);
    const finishISO = addDays(t, daysNeeded);
    return { avg, daysNeeded, finishISO, deltaDays: diffDays(deadlineISO, finishISO) }; // delta>0 → late
  }

  // loans
  function loanOutstanding(loan) {
    const paid = (loan.settlements || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    return Math.max(0, (Number(loan.amount) || 0) - paid);
  }
  function loanTotals(loans) {
    let borrowed = 0, lent = 0;
    (loans || []).forEach(l => {
      const o = loanOutstanding(l);
      if (l.type === 'borrowed') borrowed += o; else lent += o;
    });
    return { borrowed, lent, net: lent - borrowed };
  }

  return { toISO, todayISO, parseISO, diffDays, addDays, inr, inrShort, daysLeft, targets,
           earnedOn, upsertEntry, streak, projection, loanOutstanding, loanTotals };
});
