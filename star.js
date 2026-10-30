// star.js — Star Health renewals (the "Star Health" tab). Data: STAR, from the Star agent portal's
// "Renewed & Non-Renewed" report. Health policies renew yearly; 30-day grace after expiry, then the cover breaks.

const STAR_RATE = 0.14;   // Star Health renewal commission rate (confirmed by Rohan, Oct 2026)
const STAR_GRACE = 30;
const dmy = s => { if (!s) return null; const [d, m, y] = s.split('/').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const STAR_LABEL = { grace: 'In grace', lapsed: 'Lapsed', due: 'Renewal due', soon: 'Renews soon', renewed: 'Renewed', later: 'Upcoming' };

const STAR_ROWS = (window.STAR || []).map(s => {
  const renewed = s.st === 'R';
  const coverEnd = dmy(renewed ? s.nto : s.to);
  const renewOn = addDays(coverEnd, 1);
  const prem = renewed ? s.nt : (s.nt > 0 ? s.nt : s.pt);
  const quoted = !renewed && s.nt > 0;            // Star has already issued the renewal quote
  const days = Math.round((renewOn - TODAY) / DAY);
  let b;
  if (days < 0) b = -days <= STAR_GRACE ? 'grace' : 'lapsed';
  else if (days <= 30) b = 'due';
  else if (days <= 60) b = 'soon';
  else b = renewed ? 'renewed' : 'later';
  return Object.assign({}, s, { renewed, coverEnd, renewOn, prem, quoted, days, b, com: prem * STAR_RATE,
    graceEnd: addDays(renewOn, STAR_GRACE) });
});
const STAR_RANK = { grace: 1, due: 2, lapsed: 3, soon: 4, later: 5, renewed: 6 };

(function () {
  const $ = id => document.getElementById(id);
  let seg = 'open';

  function msg(r) {
    const when = r.b === 'grace' ? `expired on ${fmtDate(r.coverEnd)}; the grace period ends ${fmtDate(r.graceEnd)}`
      : r.b === 'lapsed' ? `expired on ${fmtDate(r.coverEnd)}`
      : `is due for renewal on ${fmtDate(r.renewOn)}`;
    return `Namaste ${first(r.name)} ji,\n\nYour Star Health ${r.prod.replace(/\s*-?\s*20\d\d$/, '')} policy (${r.p}, cover Rs. ${(r.si / 100000).toFixed(r.si % 100000 ? 1 : 0)} lakh) ${when}.` +
      `\nRenewal premium: Rs. ${Math.round(r.prem).toLocaleString('en-IN')}.` +
      `\n\nRenewing on time keeps your waiting periods and no-claim bonus intact. Pay at starhealth.in (Renew) or reply here and I will send the link.` + SIGN;
  }

  function render() {
    const q = $('sSearch').value.trim().toLowerCase();
    const open = r => ['grace', 'due', 'soon', 'lapsed'].includes(r.b);
    const list = STAR_ROWS.filter(r => (seg === 'all' || (seg === 'open' ? open(r) : r.b === seg)) &&
      (!q || (r.name + ' ' + r.p + ' ' + r.prod + ' ' + (r.ph || '')).toLowerCase().includes(q)))
      .sort((a, b) => STAR_RANK[a.b] - STAR_RANK[b.b] || a.renewOn - b.renewOn);
    const sum = (a, f) => a.reduce((s, r) => s + f(r), 0);
    const in60 = STAR_ROWS.filter(r => r.days >= 0 && r.days <= 60), gr = STAR_ROWS.filter(r => r.b === 'grace'),
          lp = STAR_ROWS.filter(r => r.b === 'lapsed'), rn = STAR_ROWS.filter(r => r.renewed);
    $('nStar').textContent = STAR_ROWS.filter(open).length;
    $('starKpis').innerHTML = [
      { c: 'var(--amber)', lbl: 'Renewals in next 60 days', val: inr(sum(in60, r => r.prem)), sub: `<b>${in60.length}</b> policies · <b>${in60.filter(r => r.quoted).length}</b> already quoted by Star` },
      { c: 'var(--red)', lbl: 'In grace or lapsed', val: inr(sum(gr.concat(lp), r => r.prem)), sub: `<b>${gr.length}</b> in grace · <b>${lp.length}</b> lapsed (cover broken)` },
      { c: 'var(--green)', lbl: 'Renewed this cycle', val: inr(sum(rn, r => r.prem)), sub: `<b>${rn.length}</b> of ${STAR_ROWS.length} policies` },
      { c: '#0e9384', lbl: 'Your commission, 12 months', tag: Math.round(STAR_RATE * 100) + '%', val: inr(sum(STAR_ROWS.filter(r => r.b !== 'lapsed'), r => r.com)), sub: `if every live policy renews once` },
    ].map(c => `<div class="kpi static" style="--c:${c.c}"><div class="kpi-lbl">${c.lbl}${c.tag ? `<span class="kpi-tag">${c.tag}</span>` : ''}</div>
      <div class="kpi-val">${c.val}</div><div class="kpi-sub">${c.sub}</div></div>`).join('');
    $('sCount').textContent = `${list.length} policies · ${inr(sum(list, r => r.prem))} premium`;
    $('sBody').innerHTML = list.length ? list.map(r => `<tr>
      <td data-l="Policyholder"><div class="nm">${esc(r.name)}</div><div class="sub">${r.ph ? `<a href="tel:+91${r.ph}">${fmtPhone(r.ph)}</a>` : 'No phone on file'}</div></td>
      <td data-l="Policy">${r.p}<div class="sub">${esc(r.prod)}</div></td>
      <td data-l="Cover" class="r">₹${(r.si / 100000).toLocaleString('en-IN')} L</td>
      <td data-l="Renewal date">${fmtDate(r.renewOn)}<div class="sub">${r.days >= 0 ? 'in ' + r.days + ' days' : -r.days + ' days ago'}</div></td>
      <td data-l="Premium" class="r">${inr(r.prem)}${r.renewed || r.quoted ? '' : '<span class="est">est.</span>'}<div class="sub">${r.quoted ? 'Star quote' : r.renewed ? 'paid this year' : 'last year\'s premium'}</div></td>
      <td data-l="Status"><span class="st s-${r.b}">${STAR_LABEL[r.b]}</span>${r.b === 'grace' ? `<div class="sub">grace ends ${fmtDate(r.graceEnd)}</div>` : ''}</td>
      <td data-l="Contact">${r.ph && r.b !== 'renewed' ? `<a class="btn wa sm" target="_blank" rel="noopener" href="${waLink(r.ph, msg(r))}">${ICON.wa}WhatsApp</a>` : ''}</td></tr>`).join('')
      : `<tr><td colspan="7" class="empty">Nothing here.</td></tr>`;
  }

  document.querySelectorAll('#sSeg button').forEach(b => b.onclick = () => { setSeg('sSeg', 's', b.dataset.s); seg = b.dataset.s; render(); });
  $('sSearch').addEventListener('input', render);
  $('sExport').onclick = () => download(`chauhan_star_renewals_${stamp()}.csv`, csv(STAR_ROWS.slice().sort((a, b) => a.renewOn - b.renewOn), [
    ['Policyholder', r => r.name], ['Phone', r => r.ph], ['Policy', r => r.p], ['Product', r => r.prod], ['Sum insured', r => r.si],
    ['Renewal date', r => fmtDate(r.renewOn)], ['Premium', r => r.prem], ['Premium basis', r => r.quoted ? 'Star quote' : r.renewed ? 'paid this year' : 'estimate'],
    ['Status', r => STAR_LABEL[r.b]], ['Renewal quote no.', r => r.renewed ? '' : r.np], ['Customer since', r => r.inc]]));
  render();
})();
