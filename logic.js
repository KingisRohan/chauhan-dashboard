// logic.js — turns raw LIC facts (data.js) into today's status for every policy.
// Pure functions only: no page code here, so the numbers can be tested outside the browser.

const STEP  = { Mly: 1, Qly: 3, Hly: 6, Yly: 12 };
const GRACE = { Mly: 15, Qly: 30, Hly: 30, Yly: 30 };        // LIC grace days
const MODE_LABEL = { Mly: 'Monthly', Qly: 'Quarterly', Hly: 'Half-yearly', Yly: 'Yearly' };
const LATE_RATE = 0.095;          // LIC delayed-premium interest p.a., compounded half-yearly (estimate)
const REVIVAL_YEARS = 5;          // lapsed policy can be revived within 5 years of first unpaid premium
const DAY = 86400000;

const monthIdx = s => { const [m, y] = s.split('/').map(Number); return y * 12 + (m - 1); };
const docDay   = doc => Number((doc || '01').split('/')[0]) || 1;

// Actual due date: the DoC day inside the due month (clamped for short months)
function dueDate(mIdx, day) {
  const y = Math.floor(mIdx / 12), m = mIdx % 12;
  const dim = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, dim));
}

function lateFee(p, dues, today) {
  let fee = 0;
  for (const d of dues) {
    const days = (today - d) / DAY;
    if (days <= GRACE[p.md]) continue;
    fee += p.ip * (Math.pow(1 + LATE_RATE / 2, days / 182.5) - 1);
  }
  return Math.round(fee);
}

// Every unpaid due date from a starting FUP up to today
function duesUpTo(p, fupStr, today) {
  const step = STEP[p.md], day = docDay(p.doc), out = [];
  let i = monthIdx(fupStr);
  const cap = (p.fl === 'MT' || p.fl === 'LP') ? 1 : 999;   // matures/last premium: only one installment left
  while (out.length < cap) {
    const d = dueDate(i, day);
    if (d > today) break;
    out.push(d);
    i += step;
  }
  return out;
}

/*
 Buckets (what the advisor should do):
  overdue    – unpaid on the latest LIC due list (confirmed by LIC)
  due        – was paid up on the latest LIC list, a new premium has since fallen due; payment not yet confirmed
  revival    – fell off the LIC list while unpaid (lapsed > ~6 months); revivable within 5 years
  upcoming   – paid up; next premium is in the future
  completed  – final premium (matures / last premium) paid
  verify     – needs a check with the branch (not on any LIC list, or behaved unexpectedly)
*/
function analyse(p, today) {
  const r = { bucket: 'verify', arrears: 0, licPrinted: null, nDue: 0, fee: 0, estimated: false,
              firstDue: null, nextDue: null, daysOver: null, daysTo: null, revivalBy: null, revivable: null, why: '' };
  const day = docDay(p.doc);

  if (p.st === 'unpaid' || p.st === 'dropped') {
    const dues = duesUpTo(p, p.fup, today);
    r.firstDue = dueDate(monthIdx(p.fup), day);
    r.nDue = Math.max(dues.length, p.st === 'unpaid' ? p.ld : 1);
    r.arrears = r.nDue * p.ip;
    r.licPrinted = p.st === 'unpaid' ? p.lt : null;
    r.estimated = r.arrears !== r.licPrinted;
    r.fee = lateFee(p, dues, today);
    r.daysOver = Math.max(0, Math.round((today - r.firstDue) / DAY));
    r.revivalBy = new Date(r.firstDue.getFullYear() + REVIVAL_YEARS, r.firstDue.getMonth(), r.firstDue.getDate());
    r.revivable = today <= r.revivalBy;
    r.bucket = p.st === 'unpaid' ? 'overdue' : (r.revivable ? 'revival' : 'verify');
    r.inGrace = r.daysOver <= GRACE[p.md];
    r.why = p.st === 'unpaid'
      ? `Unpaid on LIC's ${p.ll} due list (FUP ${p.fup}).`
      : `Dropped off LIC's lists after ${p.ll} while still unpaid (FUP ${p.fup}). Usually means lapsed; confirm with branch.`;
    return r;
  }
  if (p.st === 'paid') {
    r.nextDue = dueDate(monthIdx(p.fup), day);
    if (r.nextDue > today) {
      r.bucket = 'upcoming';
      r.daysTo = Math.round((r.nextDue - today) / DAY);
      r.why = `Paid up (cleared after LIC's ${p.ll} list). Next premium ${fmtDate(r.nextDue)}.`;
    } else {
      const dues = duesUpTo(p, p.fup, today);
      r.bucket = 'due';
      r.firstDue = r.nextDue;
      r.nDue = dues.length;
      r.arrears = r.nDue * p.ip;
      r.estimated = true;
      r.fee = lateFee(p, dues, today);
      r.daysOver = Math.round((today - r.firstDue) / DAY);
      r.inGrace = r.daysOver <= GRACE[p.md];
      r.why = `Last premium cleared after LIC's ${p.ll} list. Next premium fell due ${fmtDate(r.firstDue)}; no newer LIC list yet to confirm payment.`;
    }
    return r;
  }
  if (p.st === 'completed') { r.bucket = 'completed'; r.why = 'Final premium paid (policy matures / last premium).'; return r; }
  if (p.st === 'verify')    { r.why = `Paid through ${p.ll} but missed its next expected LIC listing (${p.fup}). May be paid in advance, matured or surrendered.`; return r; }
  // offlist
  r.why = p.te && p.te <= today.getFullYear()
    ? `Not on any LIC due list Apr 2025 – ${META.latest_list}. Term likely ended ${p.te}; probably matured.`
    : `Not on any LIC due list Apr 2025 – ${META.latest_list}. Lapsed before Apr 2025, paid-up or surrendered. Confirm with branch.`;
  r.offlist = true;
  return r;
}

function fmtDate(d) {
  return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}
function inr(n) { return n == null ? '—' : '₹' + Math.round(n).toLocaleString('en-IN'); }

if (typeof module !== 'undefined') module.exports = { analyse, duesUpTo, dueDate, monthIdx, lateFee, STEP, GRACE, MODE_LABEL, fmtDate, inr };
