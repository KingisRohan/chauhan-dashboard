// revenue.js — 12-month premium and commission projection (the "Revenue" tab).
// Runs after app.js and reuses its ROWS, TODAY, BUCKET, openDrawer, esc, inr, monthName.

(function () {
  const SRC = {
    book:    { label: 'LIC paying book',   c: '#1d5fa8', buckets: ['upcoming', 'due'] },
    star:    { label: 'Star Health renewals', c: '#0e9384', buckets: [] },
    overdue: { label: 'Overdue recovered', c: '#c08a2a', buckets: ['overdue'] },
    revival: { label: 'Lapsed, revived',   c: '#8a3fb0', buckets: ['revival'] },
  };
  const SCEN = { book: ['book', 'star'], overdue: ['book', 'star', 'overdue'], revival: ['book', 'star', 'overdue', 'revival'] };
  let scen = 'overdue';

  const srcOf = r => Object.keys(SRC).find(k => SRC[k].buckets.includes(r.bucket));
  const curIdx = TODAY.getFullYear() * 12 + TODAY.getMonth();
  const monthEnd = i => new Date(Math.floor(i / 12), i % 12 + 1, 0);
  const winStart = monthEnd(curIdx);            // window: first of next month …
  const winEnd = monthEnd(curIdx + 12);         // … to end of the 12th month
  const MONTHS = Array.from({ length: 12 }, (_, k) => curIdx + 1 + k);
  const mLabel = i => new Date(Math.floor(i / 12), i % 12, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  const lakh = n => n >= 100000 ? '₹' + (n / 100000).toFixed(2) + ' L' : inr(n);

  // per-policy projection, built once
  const P = ROWS.filter(r => srcOf(r) && r.cr).map(r => {
    const src = srcOf(r);
    const soon = futureDues(r, TODAY, winStart);          // falls due before month-end: collect now
    const fut = futureDues(r, winStart, winEnd);
    const nowAmt = r.arrears + soon.reduce((s, x) => s + x.amt, 0);
    const nowCom = r.arrears * r.cr + soon.reduce((s, x) => s + x.com, 0);
    return { r, src, fut, nowAmt, nowCom,
      futAmt: fut.reduce((s, x) => s + x.amt, 0), futCom: fut.reduce((s, x) => s + x.com, 0) };
  });
  // Star Health: one renewal a year per policy; lapsed ones only earn if re-issued
  for (const s of (typeof STAR_ROWS !== 'undefined' ? STAR_ROWS : [])) {
    const lapsed = s.b === 'lapsed', inWin = !lapsed && s.renewOn > winStart && s.renewOn <= winEnd, now = lapsed || s.renewOn <= winStart;
    const fut = inWin ? [{ d: s.renewOn, amt: s.prem, com: s.com }] : [];
    P.push({ star: s, r: { n: s.name, p: s.p, ph: s.ph }, src: lapsed ? 'revival' : 'star', fut,
      nowAmt: now ? s.prem : 0, nowCom: now ? s.com : 0, futAmt: inWin ? s.prem : 0, futCom: inWin ? s.com : 0 });
  }

  function totals(keys) {
    const sel = P.filter(x => keys.includes(x.src));
    const sum = f => sel.reduce((s, x) => s + f(x), 0);
    return { n: sel.length, futAmt: sum(x => x.futAmt), futCom: sum(x => x.futCom), nowAmt: sum(x => x.nowAmt), nowCom: sum(x => x.nowCom),
      inst: sum(x => x.fut.length) };
  }
  function byMonth(keys) {
    return MONTHS.map(i => {
      const row = { i, inst: 0, amt: 0, com: 0, src: {} };
      for (const k of keys) row.src[k] = { amt: 0, com: 0 };
      for (const x of P) {
        if (!keys.includes(x.src)) continue;
        for (const d of x.fut) {
          if (d.d.getFullYear() * 12 + d.d.getMonth() !== i) continue;
          row.inst++; row.amt += d.amt; row.com += d.com; row.src[x.src].amt += d.amt; row.src[x.src].com += d.com;
        }
      }
      return row;
    });
  }

  function render() {
    const keys = SCEN[scen], t = totals(keys), base = totals(SCEN.book), risk = totals(['overdue', 'revival']);
    document.getElementById('nRev').textContent = '₹' + Math.round(t.futCom / 1000) + 'k';
    const rate = t.futAmt ? (t.futCom / t.futAmt * 100) : 0;
    const range = `${mLabel(MONTHS[0])} – ${mLabel(MONTHS[11])}`;

    document.getElementById('revKpis').innerHTML = [
      { c: '#1d5fa8', lbl: 'Premium to collect', tag: range, val: lakh(t.futAmt),
        sub: `<b>${t.inst}</b> instalments and renewals · insurers keep <b>${lakh(t.futAmt - t.futCom)}</b>` },
      { c: 'var(--green)', lbl: 'Your commission', tag: range, val: inr(t.futCom),
        sub: `avg <b>${rate.toFixed(2)}%</b> of premium · about <b>${inr(t.futCom / 12)}</b> a month` },
      { c: 'var(--amber)', lbl: 'Collect now', tag: 'pending today', val: inr(t.nowCom),
        sub: `on <b>${lakh(t.nowAmt)}</b> premium due by month-end (some may already be paid)` },
      { c: '#8a3fb0', lbl: 'Commission at risk', tag: 'overdue + lapsed', val: inr(risk.futCom + risk.nowCom),
        sub: `<b>${risk.n}</b> policies (LIC overdue, LIC and Star lapsed)` },
    ].map(c => `<div class="kpi static" style="--c:${c.c}"><div class="kpi-lbl">${c.lbl}<span class="kpi-tag">${c.tag}</span></div>
      <div class="kpi-val">${c.val}</div><div class="kpi-sub">${c.sub}</div></div>`).join('');

    // split bar: premium → LIC share vs commission
    const licPct = t.futAmt ? (1 - t.futCom / t.futAmt) * 100 : 100;
    document.getElementById('revSplit').innerHTML = `
      <div class="split-row"><span>Where each rupee of premium goes</span><span class="muted">${range}</span></div>
      <div class="split-bar"><i style="width:${licPct}%;background:var(--navy)"></i><i style="width:${100 - licPct}%;background:var(--green)"></i></div>
      <div class="split-row"><span><i class="dot" style="--c:var(--navy)"></i> Insurers' share (LIC + Star) <b>${lakh(t.futAmt - t.futCom)}</b> (${licPct.toFixed(1)}%)</span>
      <span><i class="dot" style="--c:var(--green)"></i> Your commission <b>${inr(t.futCom)}</b> (${(100 - licPct).toFixed(1)}%)</span></div>`;

    renderChart(byMonth(keys), keys);
    renderTable(byMonth(keys), t);
    renderRisk();

    const upside = totals(SCEN.revival).futCom - base.futCom;
    document.getElementById('revNote').innerHTML =
      `LIC paying book plus Star renewals earn <b>${inr(base.futCom)}</b> over the next 12 months. Bringing every overdue and lapsed client back adds <b>${inr(upside)}</b> a year, ` +
      `plus <b>${inr(risk.nowCom)}</b> on the arrears they settle.`;
  }

  function renderChart(rows, keys) {
    const W = 760, H = 260, L = 56, R = 8, T = 12, B = 30;
    const max = Math.max(1, ...rows.map(r => r.com));
    const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p; })();
    const y = v => T + (H - T - B) * (1 - v / nice);
    const bw = (W - L - R) / rows.length, barW = Math.min(36, bw * 0.62);
    let g = '';
    for (let k = 0; k <= 4; k++) {
      const v = nice * k / 4;
      g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line-2)"/>` +
           `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" class="ax">${v >= 1000 ? '₹' + (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k' : '₹' + v}</text>`;
    }
    rows.forEach((r, j) => {
      const x = L + j * bw + (bw - barW) / 2;
      let acc = 0; const segs = keys.filter(k => r.src[k].com > 0);
      segs.forEach((k, si) => {
        const v = r.src[k].com, y0 = y(acc), y1 = y(acc + v), top = si === segs.length - 1;
        const h = Math.max(0, y0 - y1 - (si ? 2 : 0));
        g += top
          ? `<path d="M${x},${y0 - (si ? 2 : 0)} V${y1 + 4} q0,-4 4,-4 H${x + barW - 4} q4,0 4,4 V${y0 - (si ? 2 : 0)} Z" fill="${SRC[k].c}"/>`
          : `<rect x="${x}" y="${y1}" width="${barW}" height="${h}" fill="${SRC[k].c}"/>`;
        acc += v;
      });
      g += `<text x="${x + barW / 2}" y="${H - 10}" text-anchor="middle" class="ax">${mLabel(r.i)}</text>`;
      g += `<rect x="${L + j * bw}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent" data-j="${j}" class="hit"/>`;
    });
    const host = document.getElementById('revChart');
    host.innerHTML = `<div class="legend">${keys.map(k => `<span><i class="sw" style="background:${SRC[k].c}"></i>${SRC[k].label}</span>`).join('')}</div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly commission projection">${g}</svg><div class="tip" id="revTip" hidden></div>`;
    const tip = document.getElementById('revTip');
    host.querySelectorAll('.hit').forEach(el => {
      el.onmouseenter = el.onclick = e => {
        const r = rows[+el.dataset.j];
        tip.innerHTML = `<b>${new Date(Math.floor(r.i / 12), r.i % 12, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</b>` +
          keys.filter(k => r.src[k].amt).map(k => `<div><i class="sw" style="background:${SRC[k].c}"></i>${SRC[k].label}<span>${inr(r.src[k].com)}</span></div>`).join('') +
          `<div class="tip-tot">Commission<span>${inr(r.com)}</span></div><div class="tip-sub">Premium ${inr(r.amt)} · insurers' share ${inr(r.amt - r.com)} · ${r.inst} due</div>`;
        tip.hidden = false;
        const box = host.getBoundingClientRect(), hb = el.getBoundingClientRect();
        let left = hb.left - box.left + hb.width / 2 - 120; left = Math.max(0, Math.min(left, box.width - 240));
        tip.style.left = left + 'px'; tip.style.top = '34px';
        host.querySelectorAll('.hit').forEach(h => h.classList.toggle('on', h === el));
      };
      el.onmouseleave = () => { tip.hidden = true; el.classList.remove('on'); };
    });
  }

  function renderTable(rows, t) {
    document.getElementById('revBody').innerHTML = rows.map(r => `<tr>
      <td data-l="Month">${new Date(Math.floor(r.i / 12), r.i % 12, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</td>
      <td data-l="Instalments" class="r">${r.inst}</td><td data-l="Premium" class="r">${inr(r.amt)}</td>
      <td data-l="Insurers' share" class="r">${inr(r.amt - r.com)}</td><td data-l="Your commission" class="r"><b>${inr(r.com)}</b></td></tr>`).join('') +
      `<tr class="tot"><td>12 months</td><td class="r">${t.inst}</td><td class="r">${inr(t.futAmt)}</td><td class="r">${inr(t.futAmt - t.futCom)}</td><td class="r"><b>${inr(t.futCom)}</b></td></tr>`;
  }

  function renderRisk() {
    const list = P.filter(x => ['overdue', 'revival'].includes(x.src)).map(x => Object.assign(x, { stake: x.futCom + x.nowCom }))
      .sort((a, b) => b.stake - a.stake).slice(0, 12);
    document.getElementById('revRisk').innerHTML = list.map(x => `<tr data-open="${x.r.p}"${x.star ? ' data-star="1"' : ''}>
      <td data-l="Policyholder"><div class="nm">${esc(x.r.n)}</div><div class="sub">${x.r.p} · ${x.r.ph ? fmtPhone(x.r.ph) : 'no phone'}</div></td>
      <td data-l="Status">${x.star ? `<span class="st s-lapsed">Star · lapsed</span>` : `<span class="st ${x.r.bucket}">${BUCKET[x.r.bucket].label}</span>`}</td>
      <td data-l="Premium due now" class="r">${inr(x.nowAmt)}</td>
      <td data-l="Commission at stake" class="r"><b>${inr(x.stake)}</b><div class="sub">${inr(x.nowCom)} now · ${inr(x.futCom)} next 12 mo</div></td></tr>`).join('');
    document.querySelectorAll('#revRisk tr[data-open]:not([data-star])').forEach(el => el.onclick = () => openDrawer(el.dataset.open));
  }

  document.querySelectorAll('#revSeg button').forEach(b => b.onclick = () => { setSeg('revSeg', 's', b.dataset.s); scen = b.dataset.s; render(); });
  document.getElementById('revExport').onclick = () => download(`chauhan_revenue_projection_${stamp()}.csv`, csv(
    P.flatMap(x => x.fut.map(d => ({ x, d }))).sort((a, b) => a.d.d - b.d.d), [
      ['Due date', o => fmtDate(o.d.d)], ['Policyholder', o => o.x.r.n], ['Policy', o => o.x.r.p], ['Insurer', o => o.x.star ? 'Star Health' : 'LIC'], ['Source', o => SRC[o.x.src].label],
      ['Premium', o => o.d.amt], ['Commission rate %', o => (o.d.com / o.d.amt * 100).toFixed(2)], ['Your commission', o => o.d.com.toFixed(2)],
      ['Insurer share', o => (o.d.amt - o.d.com).toFixed(2)]]));
  render();
})();
