// app.js — Chauhan Advisory Policy Desk (page behaviour)

const CONTACT   = '+91 90041 53750';
const PAY_URL   = 'https://ebiz.licindia.in/D2CPM/#DirectPay';
const LS_CALL   = 'chauhan_callstatus_v1';   // same key as the old page, so saved outcomes carry over
const LS_LOG    = 'chauhan_calllog_v1';
const LS_VERIFY = 'chauhan_verify_v1';

const OUTCOMES = ['', 'Paid', 'Promised to pay', 'Call back', 'No answer', 'Wrong number', 'Not interested', 'Closed'];
const HANDLED  = new Set(['Paid', 'Wrong number', 'Not interested', 'Closed']);
const OUT_CLS  = { 'Paid': 's-paid', 'Promised to pay': 's-promised', 'Call back': 's-promised', 'No answer': 's-noans', 'Wrong number': 's-closed', 'Not interested': 's-notint', 'Closed': 's-closed' };
const BUCKET = {
  overdue:   { label: 'Overdue',          rank: 1, c: 'var(--red)' },
  due:       { label: 'Due, unconfirmed', rank: 2, c: 'var(--amber)' },
  revival:   { label: 'Lapsed, revivable',rank: 3, c: '#7a2e9e' },
  upcoming:  { label: 'Upcoming',         rank: 4, c: 'var(--blue)' },
  completed: { label: 'Completed',        rank: 6, c: 'var(--green)' },
  verify:    { label: 'Verify',           rank: 7, c: 'var(--muted)' },
};

// ── storage (wrapped: private windows can block it) ───────────────────────────
function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
function persist(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Could not save in this browser'); } }
let calls  = load(LS_CALL, {});
let log    = load(LS_LOG, []);
let verify = load(LS_VERIFY, {});
// migrate old page values
for (const k in calls) { if (calls[k] && calls[k].status === 'Paid/Done') calls[k].status = 'Paid'; if (calls[k] && calls[k].status === '—') calls[k].status = ''; }

// ── data prep ─────────────────────────────────────────────────────────────────
const TODAY = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); })();
const ROWS = POLICIES.map(p => Object.assign({}, p, analyse(p, TODAY)));
const BYP = Object.fromEntries(ROWS.map(r => [r.p, r]));
const LISTS = META.source_lists;

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtPhone = ph => ph ? '+91 ' + ph.slice(0, 5) + ' ' + ph.slice(5) : '';
const first = n => (n || '').split(' ')[0];
const monthName = s => { const [m, y] = s.split('/'); return new Date(+y, +m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }); };
const outcome = p => (calls[p] && calls[p].status) || '';
const isActionable = r => ['overdue', 'due', 'revival'].includes(r.bucket) || (r.bucket === 'upcoming' && r.daysTo <= 30);
const owed = r => r.arrears + r.fee;

// same person spelt differently across LIC records (Maurya / Morya, with or without middle name)
function lev(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1)); return d[a.length][b.length]; }
function samePerson(a, b) { const x = a.toLowerCase().split(' '), y = b.toLowerCase().split(' ');
  return lev(x[0], y[0]) <= 1 && lev(x[x.length - 1], y[y.length - 1]) <= 2; }
function uniqueNames(list) { const out = []; for (const n of list.slice().sort((a, b) => b.length - a.length)) if (!out.some(o => samePerson(o, n))) out.push(n);
  return out.sort((a, b) => list.indexOf(a) - list.indexOf(b)); }

function households() {
  const map = new Map();
  for (const r of ROWS) {
    if (!isActionable(r)) continue;
    const key = r.ph || ('np:' + (r.cid || r.n));
    if (!map.has(key)) map.set(key, { key, ph: r.ph, pols: [] });
    map.get(key).pols.push(r);
  }
  const list = [...map.values()];
  for (const h of list) {
    h.pols.sort((a, b) => BUCKET[a.bucket].rank - BUCKET[b.bucket].rank || owed(b) - owed(a));
    h.top = h.pols[0];
    h.rank = BUCKET[h.top.bucket].rank;
    h.total = h.pols.reduce((s, r) => s + (r.bucket === 'upcoming' ? r.ip : owed(r)), 0);
    h.names = uniqueNames(h.pols.map(r => r.n));
    h.handled = h.pols.every(r => HANDLED.has(outcome(r.p)));
  }
  list.sort((a, b) => a.rank - b.rank || b.total - a.total);
  return list;
}

// ── header, freshness, KPIs ───────────────────────────────────────────────────
function renderHeader() {
  document.getElementById('todayLbl').textContent = TODAY.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const [m, y] = META.latest_list.split('/').map(Number);
  const listDate = new Date(y, m - 1, 1);
  const age = Math.round((TODAY - listDate) / 86400000);
  const pill = document.getElementById('freshPill');
  pill.textContent = 'LIC data: ' + monthName(META.latest_list) + ' list';
  pill.className = 'fresh' + (age > 90 ? ' old' : age > 45 ? ' stale' : '');
  pill.title = 'Built from ' + LISTS.length + ' LIC Premium Due Lists, ' + monthName(LISTS[0]) + ' to ' + monthName(META.latest_list);
  pill.onclick = () => toast(pill.title);
  if (age > 45) {
    const missing = [];
    for (let i = y * 12 + m; i <= TODAY.getFullYear() * 12 + TODAY.getMonth(); i++) missing.push(new Date(Math.floor(i / 12), i % 12, 1).toLocaleDateString('en-IN', { month: 'short' }));
    document.getElementById('staleBanner').hidden = false;
    document.getElementById('staleTitle').textContent = 'Latest LIC due list is ' + monthName(META.latest_list) + '. Lists for ' + missing.join(', ') + ' are missing.';
    document.getElementById('staleText').textContent = 'Amounts LIC printed are exact. Anything that fell due after that is a projection and is marked "est." Payments made since ' + monthName(META.latest_list) + ' will not show until the newer lists are added. Download them from the LIC agent portal and send them over to refresh this page.';
  }
}

function renderKPIs() {
  const agg = b => ROWS.filter(r => r.bucket === b);
  const sum = (a, f) => a.reduce((s, r) => s + f(r), 0);
  const ov = agg('overdue'), du = agg('due'), rv = agg('revival');
  const up = ROWS.filter(r => r.bucket === 'upcoming' && r.daysTo <= 30);
  const cards = [
    { b: 'overdue', c: 'var(--red)', lbl: 'Overdue', tag: 'LIC confirmed', val: inr(sum(ov, r => r.licPrinted || 0)),
      sub: `<b>${ov.length}</b> policies · <b>${inr(sum(ov, owed))}</b> if nothing paid since ${monthName(META.latest_list)}` },
    { b: 'due', c: 'var(--amber)', lbl: 'Due, unconfirmed', tag: 'projected', val: inr(sum(du, owed)),
      sub: `<b>${du.length}</b> policies paid up in LIC's lists, now due again` },
    { b: 'revival', c: '#7a2e9e', lbl: 'Revival opportunities', tag: 'projected', val: inr(sum(rv, owed)),
      sub: `<b>${rv.length}</b> lapsed policies, still revivable` },
    { b: 'upcoming', c: 'var(--blue)', lbl: 'Due in next 30 days', tag: '', val: inr(sum(up, r => r.ip)),
      sub: `<b>${up.length}</b> ${up.length === 1 ? 'policy' : 'policies'} to remind ahead of time` },
  ];
  const k = document.getElementById('kpis');
  k.innerHTML = cards.map(c => `<button class="kpi" style="--c:${c.c}" data-b="${c.b}">
      <div class="kpi-lbl">${c.lbl}${c.tag ? `<span class="kpi-tag">${c.tag}</span>` : ''}</div>
      <div class="kpi-val">${c.val}</div><div class="kpi-sub">${c.sub}</div></button>`).join('');
  k.querySelectorAll('.kpi').forEach(el => el.onclick = () => { showView('queue'); setSeg('qSeg', 'b', el.dataset.b); qBucket = el.dataset.b; renderQueue(); });

  const lic = ROWS.filter(r => r.lic);
  const paidUp = ROWS.filter(r => r.bucket === 'upcoming').length;
  const noPh = ROWS.filter(r => isActionable(r) && !r.ph).length;
  document.getElementById('kpisMini').innerHTML = [
    ['var(--navy)', `<b>${lic.length}</b> policies on LIC lists`],
    ['var(--blue)', `<b>${paidUp}</b> paid up, next premium later`],
    ['var(--green)', `<b>${ROWS.filter(r => r.bucket === 'completed').length}</b> completed`],
    ['var(--muted)', `<b>${ROWS.filter(r => r.bucket === 'verify').length}</b> need branch check`],
    ['var(--red)', `<b>${noPh}</b> owing policies with no phone number`],
  ].map(([c, t]) => `<span><i class="dot" style="--c:${c}"></i>${t}</span>`).join('');
}

// ── call queue ────────────────────────────────────────────────────────────────
let qBucket = 'all';
function renderQueue() {
  const q = document.getElementById('qSearch').value.trim().toLowerCase();
  const hide = document.getElementById('qHideDone').checked;
  const all = households();
  const withPh = all.filter(h => h.ph);
  let list = withPh.filter(h => {
    if (qBucket !== 'all' && !h.pols.some(r => r.bucket === qBucket)) return false;
    if (hide && h.handled) return false;
    if (q && !(h.names.join(' ') + ' ' + h.ph + ' ' + h.pols.map(r => r.p).join(' ')).toLowerCase().includes(q)) return false;
    return true;
  });
  document.getElementById('nQueue').textContent = withPh.filter(h => !h.handled).length;
  document.getElementById('qCount').textContent = `${list.length} households to contact · ${inr(list.reduce((s, h) => s + h.total, 0))} at stake. One call or message covers every policy on that number.`;
  const box = document.getElementById('queueList');
  box.innerHTML = list.length ? list.map(hhCard).join('') : '<div class="empty">Nothing here. Every household in this view has been handled.</div>';
  box.querySelectorAll('[data-open]').forEach(el => el.onclick = () => openDrawer(el.dataset.open));
  box.querySelectorAll('select.cs').forEach(el => el.onchange = () => setOutcomeHH(el.dataset.k, el.value));
  box.querySelectorAll('[data-wa]').forEach(el => el.onclick = () => { const h = all.find(x => x.key === el.dataset.wa); window.open(waLink(h.ph, hhMessage(h)), '_blank', 'noopener'); });

  const np = all.filter(h => !h.ph);
  const npPols = np.flatMap(h => h.pols);
  document.getElementById('noPhoneSum').textContent = `${npPols.length} owing policies have no phone number (${inr(npPols.reduce((s, r) => s + owed(r), 0))})`;
  document.getElementById('noPhoneList').innerHTML = npPols.sort((a, b) => owed(b) - owed(a)).map(r =>
    `<div data-open="${r.p}"><span>${esc(r.n)} <span class="st ${r.bucket}">${BUCKET[r.bucket].label}</span></span><b>${inr(r.bucket === 'upcoming' ? r.ip : owed(r))}</b></div>`).join('');
  document.querySelectorAll('#noPhoneList [data-open]').forEach(el => el.onclick = () => openDrawer(el.dataset.open));
}

function hhCard(h) {
  const st = h.pols.map(r => outcome(r.p)).find(Boolean) || '';
  const last = h.pols.map(r => calls[r.p] && calls[r.p].at).filter(Boolean).sort().pop();
  const pols = h.pols.map(r => `
    <div class="pol" data-open="${r.p}">
      <div class="pol-l"><span class="pn">${r.p}</span><span class="st ${r.bucket}">${BUCKET[r.bucket].label}</span>
        <span>${MODE_LABEL[r.md]} · ${inr(r.ip)}</span>${h.names.length > 1 ? `<span>· ${esc(first(h.names.find(x => samePerson(x, r.n)) || r.n))}</span>` : ''}</div>
      <div class="pol-r">${r.bucket === 'upcoming' ? 'in ' + r.daysTo + ' days' : inr(owed(r)) + (r.estimated ? '<span class="est">est.</span>' : '')}</div>
      <div class="pol-why">${polLine(r)}</div>
    </div>`).join('');
  return `<article class="hh ${h.handled ? 'done' : ''}">
    <div class="hh-top">
      <div><div class="hh-name">${esc(h.names[0])}</div>
        ${h.names.length > 1 ? `<div class="hh-also">also ${esc(h.names.slice(1).join(', '))}</div>` : ''}
        <div class="hh-phone">${fmtPhone(h.ph)}</div></div>
      <div class="hh-amt"><div class="v">${inr(h.total)}</div><div class="l">${h.pols.length} ${h.pols.length > 1 ? 'policies' : 'policy'}</div></div>
    </div>
    <div class="hh-pols">${pols}</div>
    <div class="hh-act">
      <a class="btn primary" href="tel:+91${h.ph}">${ICON.phone}Call</a>
      <button class="btn wa" data-wa="${esc(h.key)}" type="button">${ICON.wa}WhatsApp</button>
      <span class="grow"></span>
      <select class="cs ${OUT_CLS[st] || ''}" data-k="${esc(h.key)}">${OUTCOMES.map(o => `<option value="${o}" ${o === st ? 'selected' : ''}>${o || 'Outcome…'}</option>`).join('')}</select>
      ${last ? `<div class="last">Last update ${new Date(last).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>` : ''}
    </div></article>`;
}

function polLine(r) {
  if (r.bucket === 'overdue') return `Pending since ${fmtDate(r.firstDue)} · ${r.nDue} instalment${r.nDue > 1 ? 's' : ''} · LIC printed ${inr(r.licPrinted)} (${monthName(r.ll)})`;
  if (r.bucket === 'due') return `Fell due ${fmtDate(r.firstDue)} · ${r.nDue} instalment${r.nDue > 1 ? 's' : ''} · confirm if already paid`;
  if (r.bucket === 'revival') return `Lapsed since ${fmtDate(r.firstDue)} · revive before ${fmtDate(r.revivalBy)}`;
  if (r.bucket === 'upcoming') return `Next premium ${fmtDate(r.nextDue)}`;
  return '';
}

function setOutcomeHH(key, val) {
  const h = households().find(x => x.key === key);
  if (!h) return;
  h.pols.forEach(r => setOutcome(r.p, val, null, true));
  persist(LS_CALL, calls); persist(LS_LOG, log);
  toast(val ? `Saved: ${val}` : 'Outcome cleared');
  refresh();
}
function setOutcome(p, val, note, batch) {
  const r = BYP[p];
  const at = new Date().toISOString();
  calls[p] = Object.assign({}, calls[p], { status: val, at });
  if (note != null) calls[p].note = note;
  log.unshift({ at, p, n: r.n, status: val, note: note != null ? note : (calls[p].note || '') });
  if (log.length > 2000) log.length = 2000;
  if (!batch) { persist(LS_CALL, calls); persist(LS_LOG, log); }
}

// ── messages ──────────────────────────────────────────────────────────────────
const SIGN = `\n\nChauhan Advisory\nLIC Agent LIC01891914\nCall / WhatsApp: ${CONTACT}`;
function polMsgLine(r) {
  const pl = `Policy ${r.p}`;
  if (r.bucket === 'overdue' || r.bucket === 'revival') return `${pl}: Rs. ${Math.round(r.arrears).toLocaleString('en-IN')} pending since ${monthName(r.fup)}`;
  if (r.bucket === 'due') return `${pl}: Rs. ${Math.round(r.arrears).toLocaleString('en-IN')} due from ${fmtDate(r.firstDue)}`;
  return `${pl}: Rs. ${r.ip.toLocaleString('en-IN')} due on ${fmtDate(r.nextDue)}`;
}
function hhMessage(h) {
  const nm = first(h.names[0]);
  const groups = { overdue: [], due: [], revival: [], upcoming: [] };
  h.pols.forEach(r => groups[r.bucket] && groups[r.bucket].push(r));
  let m = `Namaste ${nm} ji,\n`;
  if (groups.overdue.length) m += `\nAapki LIC policy ka premium abhi tak pending hai:\n${groups.overdue.map(polMsgLine).join('\n')}\n\nJitni jaldi pay karenge, utna kam late fee lagega aur family ka cover band nahi hoga.\n`;
  if (groups.due.length) m += `\n${groups.overdue.length ? 'Iske alawa, ' : ''}yeh premium due ho gaya hai:\n${groups.due.map(polMsgLine).join('\n')}\n\nAgar pay kar diya hai toh bas "paid" reply kar dijiye, hum record update kar denge.\n`;
  if (groups.revival.length) m += `\nYeh policy premium na bharne se lapse ho gayi hai:\n${groups.revival.map(polMsgLine).join('\n')}\n\nAchhi baat yeh hai ki ise abhi bhi revive kiya ja sakta hai. Revive karne se pura cover wapas mil jaata hai. Hum poora process karwa denge.\n`;
  if (groups.upcoming.length) m += `\nAane wala premium:\n${groups.upcoming.map(polMsgLine).join('\n')}\n`;
  m += `\nOnline pay: ${PAY_URL}\nKoi bhi dikkat ho toh reply kijiye, hum madad karenge.`;
  return m + SIGN;
}
function waLink(ph, msg) { return `https://wa.me/91${ph}?text=${encodeURIComponent(msg)}`; }

// ── all policies table ────────────────────────────────────────────────────────
let aSort = { k: 'bucket', dir: 1 };
function aRows() {
  const q = document.getElementById('aSearch').value.trim().toLowerCase();
  const b = document.getElementById('aBucket').value, m = document.getElementById('aMode').value;
  const ph = document.getElementById('aPhone').checked;
  const d = ROWS.filter(r => (b === 'all' || r.bucket === b) && (m === 'all' || r.md === m) && (!ph || r.ph) &&
    (!q || (r.n + ' ' + r.p + ' ' + r.pl + ' ' + r.sn).toLowerCase().includes(q)));
  const key = r => aSort.k === 'bucket' ? BUCKET[r.bucket].rank * 1e9 - owed(r)
                 : aSort.k === 'arrears' ? owed(r)
                 : aSort.k === 'call' ? outcome(r.p)
                 : aSort.k === 'firstDue' ? (r.firstDue || r.nextDue || new Date(9e15)).getTime()
                 : r[aSort.k];
  return d.sort((x, y) => { const a = key(x), c = key(y); return (a < c ? -1 : a > c ? 1 : 0) * aSort.dir; });
}
function renderAll() {
  const d = aRows();
  document.getElementById('nAll').textContent = ROWS.length;
  document.getElementById('aCount').textContent = `${d.length} policies · ${inr(d.reduce((s, r) => s + owed(r), 0))} arrears incl. estimated late fee`;
  document.getElementById('aBody').innerHTML = d.length ? d.map(r => `<tr data-open="${r.p}">
    <td><div class="nm">${esc(r.n)}</div><div class="sub">${r.ph ? fmtPhone(r.ph) : 'no phone'}</div></td>
    <td data-l="Policy">${r.p}<div class="sub">Plan ${esc(r.pl)}</div></td>
    <td data-l="Mode">${MODE_LABEL[r.md]}</td>
    <td class="r" data-l="Instalment">${inr(r.ip)}</td>
    <td data-l="Status"><span class="st ${r.bucket}">${BUCKET[r.bucket].label}</span></td>
    <td data-l="Since">${r.firstDue ? fmtDate(r.firstDue) : r.nextDue ? 'next ' + fmtDate(r.nextDue) : '—'}</td>
    <td class="r" data-l="Instalments due">${r.nDue || '—'}</td>
    <td class="r" data-l="Arrears"><b>${owed(r) ? inr(owed(r)) : '—'}</b>${r.estimated && owed(r) ? '<span class="est">est.</span>' : ''}</td>
    <td data-l="Call">${outcome(r.p) ? `<span class="cs ${OUT_CLS[outcome(r.p)] || ''}" style="display:inline-block">${esc(outcome(r.p))}</span>` : '<span class="sub">—</span>'}</td>
  </tr>`).join('') : '<tr><td colspan="9" class="empty">No policies match.</td></tr>';
  document.querySelectorAll('#aBody tr[data-open]').forEach(el => el.onclick = () => openDrawer(el.dataset.open));
  document.querySelectorAll('#aTable th').forEach(th => { th.classList.toggle('sorted', th.dataset.k === aSort.k); th.classList.toggle('asc', th.dataset.k === aSort.k && aSort.dir === 1); });
}

// ── verify ────────────────────────────────────────────────────────────────────
let vGroup = 'all';
const VERIFY_OPTS = ['', 'Matured', 'Paid-up', 'Surrendered', 'Lapsed, not revivable', 'Lapsed, revivable', 'Active, paying', 'Death claim'];
function renderVerify() {
  const q = document.getElementById('vSearch').value.trim().toLowerCase();
  const ph = document.getElementById('vPhone').checked;
  const yr = TODAY.getFullYear();
  const all = ROWS.filter(r => r.bucket === 'verify');
  const d = all.filter(r => {
    const matured = r.te && r.te <= yr;
    if (vGroup === 'matured' && !matured) return false;
    if (vGroup === 'check' && matured) return false;
    if (ph && !r.ph) return false;
    return !q || (r.n + ' ' + r.p).toLowerCase().includes(q);
  }).sort((a, b) => (a.te || 0) - (b.te || 0));
  document.getElementById('nVerify').textContent = all.filter(r => !verify[r.p]).length;
  document.getElementById('vCount').textContent = `${d.length} policies · ${Object.keys(verify).filter(k => verify[k]).length} already checked`;
  document.getElementById('vBody').innerHTML = d.map(r => `<tr>
    <td data-l="Holder" data-open="${r.p}"><div class="nm">${esc(r.n)}</div><div class="sub">${r.ph ? fmtPhone(r.ph) : 'no phone'}</div></td>
    <td data-l="Policy">${r.p}</td>
    <td data-l="Plan">${esc(r.pl)}</td>
    <td data-l="Mode">${MODE_LABEL[r.md]}</td>
    <td class="r" data-l="Instalment">${inr(r.ip)}</td>
    <td data-l="Started">${esc(r.doc)}</td>
    <td class="wrap" data-l="Reading">${esc(r.why)}</td>
    <td data-l="Branch says"><select class="cs vs" data-p="${r.p}">${VERIFY_OPTS.map(o => `<option ${verify[r.p] === o ? 'selected' : ''} value="${o}">${o || 'Not checked'}</option>`).join('')}</select></td>
  </tr>`).join('') || '<tr><td colspan="8" class="empty">Nothing to verify.</td></tr>';
  document.querySelectorAll('#vBody select.vs').forEach(el => { el.onclick = e => e.stopPropagation(); el.onchange = () => { verify[el.dataset.p] = el.value; persist(LS_VERIFY, verify); toast('Saved'); renderVerify(); }; });
  document.querySelectorAll('#vBody td[data-open]').forEach(el => el.onclick = () => openDrawer(el.dataset.open));
}

// ── log ───────────────────────────────────────────────────────────────────────
function renderLog() {
  document.getElementById('nLog').textContent = log.length;
  document.getElementById('logBody').innerHTML = log.length ? log.slice(0, 500).map(e => `<tr data-open="${e.p}">
    <td data-l="When">${new Date(e.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
    <td data-l="Holder">${esc(e.n)}</td><td data-l="Policy">${e.p}</td>
    <td data-l="Outcome">${esc(e.status || 'cleared')}</td><td class="wrap" data-l="Note">${esc(e.note)}</td></tr>`).join('')
    : '<tr><td colspan="5" class="empty">No calls logged yet. Set an outcome on any household in the call queue.</td></tr>';
  document.querySelectorAll('#logBody tr[data-open]').forEach(el => el.onclick = () => openDrawer(el.dataset.open));
}

// ── drawer ────────────────────────────────────────────────────────────────────
function openDrawer(p) {
  const r = BYP[p]; if (!r) return;
  document.getElementById('dEyebrow').innerHTML = `<span class="st ${r.bucket}">${BUCKET[r.bucket].label}</span>`;
  document.getElementById('dName').textContent = r.n;
  document.getElementById('dSub').textContent = `Policy ${r.p} · Plan ${r.pl} · ${MODE_LABEL[r.md]}`;
  const money = owed(r) ? `<div class="d-sec"><h4>Amount payable today</h4><div class="money">
      <div><span>Premium arrears <small>${r.nDue} × ${inr(r.ip)}</small></span><b>${inr(r.arrears)}</b></div>
      ${r.licPrinted != null ? `<div><span>LIC printed on ${monthName(r.ll)} list</span><span>${inr(r.licPrinted)}</span></div>` : ''}
      <div><span>Late fee <small>est. @ 9.5% p.a.</small></span><span>${inr(r.fee)}</span></div>
      <div class="tot"><span>Total${r.estimated ? ' (est.)' : ''}</span><span>${inr(owed(r))}</span></div></div></div>` : '';
  const facts = [
    ['Holder (LIC name)', esc(r.n)], ['Name in client sheet', esc(r.sn || '—')],
    ['Phone', r.ph ? `<a href="tel:+91${r.ph}">${fmtPhone(r.ph)}</a>` : 'Not on file'],
    ['Date of commencement', esc(r.doc)], ['Instalment', inr(r.ip)],
    ['First unpaid premium', r.lic && (r.bucket === 'overdue' || r.bucket === 'revival') ? monthName(r.fup) : r.bucket === 'due' ? fmtDate(r.firstDue) : '—'],
    ['Next premium', r.nextDue ? fmtDate(r.nextDue) : '—'],
    ['Revive before', r.revivalBy ? fmtDate(r.revivalBy) : '—'],
    ['Flag', r.fl === 'MT' ? 'Matures after this due' : r.fl === 'LP' ? 'Last premium' : r.fl === 'ST' ? '2nd/3rd year premium' : '—'],
    ['Seen on LIC lists', r.lic ? `${r.h.length} of ${LISTS.length}` : 'None'],
  ];
  const c = calls[p] || {};
  const canNotice = ['overdue', 'due', 'revival'].includes(r.bucket);
  document.getElementById('dBody').innerHTML = `
    <div class="d-sec"><div class="d-why">${esc(r.why)}</div></div>
    ${money}
    <div class="d-sec d-act">
      ${r.ph ? `<a class="btn primary" href="tel:+91${r.ph}">${ICON.phone}Call</a>
      <a class="btn wa" target="_blank" rel="noopener" href="${waLink(r.ph, hhMessage({ names: [r.n], pols: [r] }))}">${ICON.wa}WhatsApp</a>` : ''}
      ${canNotice ? `<button class="btn brass" id="dPdf" type="button">${ICON.doc}Notice PDF</button>` : ''}
    </div>
    ${r.lic ? `<div class="d-sec"><h4>LIC due-list history</h4>${histStrip(r)}</div>` : ''}
    <div class="d-sec"><h4>Policy facts</h4><div class="kv">${facts.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div></div>
    <div class="d-sec"><h4>Call outcome</h4>
      <select class="cs" id="dOut" style="max-width:none;width:100%;margin-bottom:8px">${OUTCOMES.map(o => `<option value="${o}" ${o === (c.status || '') ? 'selected' : ''}>${o || 'Outcome…'}</option>`).join('')}</select>
      <textarea class="note" id="dNote" placeholder="Note (e.g. will pay on salary day, 5th)">${esc(c.note || '')}</textarea>
      <button class="btn primary" id="dSave" type="button" style="margin-top:8px;width:100%">Save outcome</button>
    </div>`;
  document.getElementById('dSave').onclick = () => { setOutcome(p, document.getElementById('dOut').value, document.getElementById('dNote').value); toast('Saved'); refresh(); };
  if (canNotice) document.getElementById('dPdf').onclick = e => downloadNotice(r, e.currentTarget);
  document.getElementById('scrim').hidden = false;
  const dr = document.getElementById('drawer'); dr.classList.add('open'); dr.setAttribute('aria-hidden', 'false');
}
function closeDrawer() { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawer').setAttribute('aria-hidden', 'true'); document.getElementById('scrim').hidden = true; }

function histStrip(r) {
  const seen = Object.fromEntries(r.h.map(x => [x[0], x]));
  const paidAfter = (i, f) => {
    const later = LISTS.slice(i + 1).filter(x => seen[x]);
    if (later.some(x => monthIdx(seen[x][1]) > monthIdx(f))) return true;
    return !later.length && ['upcoming', 'due', 'completed', 'verify'].includes(r.bucket) && r.st !== 'dropped' && r.st !== 'unpaid';
  };
  const cells = LISTS.map((m, i) => {
    const s = seen[m];
    if (!s) return `<div class="n" title="${monthName(m)}: not on list (nothing due)"></div>`;
    return paidAfter(i, s[1])
      ? `<div class="p" title="${monthName(m)}: due (${s[2]}), paid afterwards"></div>`
      : `<div class="u" title="${monthName(m)}: on list, unpaid since ${monthName(s[1])}, ${s[2]} due"></div>`;
  }).join('');
  const labels = LISTS.map(m => `<span>${new Date(+m.slice(3), +m.slice(0, 2) - 1, 1).toLocaleDateString('en-IN', { month: 'narrow' })}</span>`).join('');
  return `<div class="hist">${cells}</div><div class="hist-l">${labels}</div>
    <div class="legend"><span><i style="background:#a9dbbf"></i>Due, then paid</span><span><i style="background:#f4b4ae"></i>Due, still unpaid</span><span><i style="background:var(--grey-soft)"></i>Nothing due</span><span>${monthName(LISTS[0])} → ${monthName(META.latest_list)}</span></div>`;
}

// ── premium notice PDF ────────────────────────────────────────────────────────
function noticeHTML(r) {
  const cell = (l, v) => `<div><span>${l}</span><b>${v}</b></div>`;
  return `<div class="notice">
    <div class="n-head"><div><div class="n-brand">Chauhan Advisory</div><div class="n-brand-sub">Life Insurance Corporation of India · Agent Code LIC01891914</div></div>
      <div class="n-logo"><img src="assets/lic-logo.png" alt="LIC"></div></div>
    <div class="n-body">
      <div class="n-title"><b>${r.bucket === 'revival' ? 'Policy Revival Notice' : 'Premium Due Notice'}</b><span>Date: <b style="color:#1a2230">${fmtDate(TODAY)}</b></span></div>
      <div class="n-grid">
        ${cell('Policyholder', esc(r.n))}${cell('Policy number', r.p)}
        ${cell('Plan / term', esc(r.pl))}${cell('Payment mode', MODE_LABEL[r.md])}
        ${cell('Premium pending since', fmtDate(r.firstDue))}${cell('Instalments due', r.nDue)}
      </div>
      <div class="n-sec">Amount payable</div>
      <div class="n-row"><span>Premium arrears <small>(${r.nDue} × ${inr(r.ip)})</small></span><b>${inr(r.arrears)}</b></div>
      <div class="n-row"><span>Late fee <small>(LIC interest, approx. 9.5% p.a.)</small></span><b>${inr(r.fee)}</b></div>
      <div class="n-tot"><span>Total payable (approx.)</span><b>${inr(owed(r))}</b></div>
      <div class="n-pay"><a href="${PAY_URL}">Pay online at LIC</a><div>${PAY_URL.replace('https://', '')}</div></div>
      <div class="n-note">The late fee is an estimate of LIC's delayed-payment interest; LIC confirms the exact amount at the time of payment. If you have already paid, please ignore this notice and accept our thanks.${r.revivalBy ? ` A lapsed policy can be revived until ${fmtDate(r.revivalBy)}, subject to LIC's revival conditions.` : ''}</div>
      <div class="n-foot"><span>Chauhan Advisory · LIC Agent LIC01891914</span><span>Call / WhatsApp: <b>${CONTACT}</b></span></div>
    </div></div>`;
}
function downloadNotice(r, btn) {
  const host = document.getElementById('noticeHost');
  host.innerHTML = noticeHTML(r);
  const name = 'Chauhan_Notice_' + r.n.replace(/[^A-Za-z0-9]+/g, '_') + '_' + r.p + '.pdf';
  if (!window.html2pdf) { toast('PDF library still loading, try again in a second'); return; }
  const orig = btn.innerHTML; btn.disabled = true; btn.textContent = 'Preparing…';
  const img = host.querySelector('img');
  const go = () => html2pdf().set({ margin: 0, filename: name, image: { type: 'jpeg', quality: 0.96 }, html2canvas: { scale: 2, backgroundColor: '#ffffff' }, jsPDF: { unit: 'pt', format: 'a4' } })
    .from(host.firstElementChild).save().then(() => { btn.disabled = false; btn.innerHTML = orig; host.innerHTML = ''; })
    .catch(() => { btn.disabled = false; btn.innerHTML = orig; toast('Could not create the PDF in this browser'); });
  img.complete ? go() : (img.onload = go, img.onerror = go);
}

// ── CSV export ────────────────────────────────────────────────────────────────
function csv(rows, cols) {
  const q = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return [cols.map(c => c[0]).join(','), ...rows.map(r => cols.map(c => q(c[1](r))).join(','))].join('\n');
}
function download(name, text) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv' })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
const stamp = () => TODAY.toISOString().slice(0, 10);

// ── UI wiring ─────────────────────────────────────────────────────────────────
const ICON = {
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.5.2-.7.2-1.3.2-1.5-.1-.1-.3-.2-.6-.3zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zM12 0a12 12 0 0 0-10.3 18L0 24l6.2-1.6A12 12 0 1 0 12 0z"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"/></svg>',
};
let toastT;
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }
function setSeg(id, attr, val) { document.querySelectorAll('#' + id + ' button').forEach(b => b.classList.toggle('on', b.dataset[attr] === val)); }
function showView(v) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.v === v));
  document.querySelectorAll('.view').forEach(s => s.hidden = s.id !== 'v-' + v);
}
function refresh() { renderQueue(); renderAll(); renderVerify(); renderLog(); }

document.querySelectorAll('.tab').forEach(t => t.onclick = () => showView(t.dataset.v));
document.querySelectorAll('#qSeg button').forEach(b => b.onclick = () => { setSeg('qSeg', 'b', b.dataset.b); qBucket = b.dataset.b; renderQueue(); });
document.querySelectorAll('#vSeg button').forEach(b => b.onclick = () => { setSeg('vSeg', 'g', b.dataset.g); vGroup = b.dataset.g; renderVerify(); });
['qSearch', 'qHideDone'].forEach(id => document.getElementById(id).addEventListener('input', renderQueue));
['aSearch', 'aBucket', 'aMode', 'aPhone'].forEach(id => document.getElementById(id).addEventListener('input', renderAll));
['vSearch', 'vPhone'].forEach(id => document.getElementById(id).addEventListener('input', renderVerify));
document.querySelectorAll('#aTable th').forEach(th => th.onclick = () => { aSort = { k: th.dataset.k, dir: aSort.k === th.dataset.k ? -aSort.dir : (['arrears', 'ip', 'nDue'].includes(th.dataset.k) ? -1 : 1) }; renderAll(); });
document.getElementById('dClose').onclick = closeDrawer;
document.getElementById('scrim').onclick = closeDrawer;
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
document.getElementById('aExport').onclick = () => download(`chauhan_policies_${stamp()}.csv`, csv(aRows(), [
  ['Policyholder', r => r.n], ['Phone', r => r.ph], ['Policy', r => r.p], ['Plan', r => r.pl], ['Mode', r => MODE_LABEL[r.md]],
  ['Instalment', r => r.ip], ['Status', r => BUCKET[r.bucket].label], ['Due since', r => r.firstDue ? fmtDate(r.firstDue) : ''],
  ['Next due', r => r.nextDue ? fmtDate(r.nextDue) : ''], ['Instalments due', r => r.nDue], ['Arrears', r => r.arrears],
  ['LIC printed', r => r.licPrinted], ['Late fee est', r => r.fee], ['Estimated', r => r.estimated ? 'yes' : 'no'],
  ['Call outcome', r => outcome(r.p)], ['Note', r => (calls[r.p] || {}).note || ''], ['Reading', r => r.why]]));
document.getElementById('logExport').onclick = () => download(`chauhan_call_log_${stamp()}.csv`, csv(log, [
  ['When', e => new Date(e.at).toLocaleString('en-IN')], ['Policyholder', e => e.n], ['Policy', e => e.p], ['Outcome', e => e.status], ['Note', e => e.note]]));

document.getElementById('foot').innerHTML =
  `<b>How to read this.</b> Every figure is rebuilt from LIC's own Premium Due Lists (${monthName(LISTS[0])} to ${monthName(META.latest_list)}), recalculated to today's date each time the page opens. ` +
  `<b>Overdue</b>: unpaid on the latest LIC list; the "LIC printed" amount is exact. <b>Due, unconfirmed</b>: was paid up, a newer premium has since fallen due; may already be paid. ` +
  `<b>Lapsed, revivable</b>: dropped off LIC's list while unpaid; can be revived within 5 years. Late fee is an estimate at 9.5% p.a. compounded half-yearly; LIC confirms the exact figure at payment. ` +
  `Policyholder names follow LIC's records; phone numbers come from the client sheet. Call outcomes are stored in this browser only.`;

renderHeader(); renderKPIs(); refresh();
