// app.js — Chauhan Advisory Reminder Dashboard

// ── CONFIG ────────────────────────────────────────────────────────────────────
// Fill these in after completing the backend steps. See HANDOFF.md Step 8–9.
const CONFIG = {

  // Google Sheets > File > Share > Publish to web
  // Choose "Today" tab, choose "CSV", click Publish, copy the URL.
  CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRUnTkqHO8PL8MeDQQR7nAuLzHEjLd0RQIbepmPk2fYMVzpiaBc0FmtSHPTsR3rWzOp5uB8O2EhpW21/pub?gid=397856180&single=true&output=csv',

  // Apps Script > Deploy > Manage deployments > Web App URL
  // Deploy as: Execute as Me, Who has access: Anyone.
  WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbzIoSfeXDGe5eStqajLclJGG8rDhdh3747fcm-lYIZQRCh0fTrCQCLQ1UxJ0xX4pmdO/exec',

  // Optional: Google Drive shareable link to the premium payment guide PDF.
  // Leave blank to hide the View PDF button.
  PDF_URL: '',

};
// ── END CONFIG ────────────────────────────────────────────────────────────────


// ── State ─────────────────────────────────────────────────────────────────────
let allRows     = [];
let activeFilter = 'all';


// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setHeaderDate();
  setupFilters();
  document.getElementById('btn-refresh').addEventListener('click', loadReminders);
  loadReminders();
});

function setHeaderDate() {
  const el  = document.getElementById('header-date');
  const now = new Date();
  const day = now.toLocaleDateString('en-IN', { weekday: 'short' });
  const dt  = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  el.innerHTML = `${day}<br>${dt}`;
}


// ── Data Loading ──────────────────────────────────────────────────────────────
async function loadReminders() {
  const statusEl = document.getElementById('status-msg');

  if (CONFIG.CSV_URL === 'YOUR_CSV_URL_HERE') {
    statusEl.textContent = 'Set CSV_URL in app.js to load reminders (see HANDOFF.md Step 8).';
    return;
  }

  statusEl.textContent = 'Loading…';

  try {
    // Cache-bust so a page refresh always fetches the latest sheet data.
    const sep = CONFIG.CSV_URL.includes('?') ? '&' : '?';
    const resp = await fetch(CONFIG.CSV_URL + sep + '_t=' + Date.now());
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const text = await resp.text();
    allRows = parseCSV(text);
    statusEl.textContent = '';
    updateStats();
    renderCards();
  } catch (err) {
    statusEl.textContent = 'Could not load data. Check CSV_URL and try refreshing. (' + err.message + ')';
  }
}


// ── CSV Parser ─────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVRow(lines[0]).map(h => h.trim().toLowerCase());

  return lines.slice(1)
    .map(line => {
      const vals = parseCSVRow(line);
      const row  = {};
      headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
      return row;
    })
    .filter(row => row['client_name']);
}

function parseCSVRow(row) {
  const result = [];
  let current  = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      // Handle escaped double-quote ("") inside a quoted field
      if (inQuotes && row[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}


// ── Stats ─────────────────────────────────────────────────────────────────────
function updateStats() {
  const overdue   = allRows.filter(r => r.priority === 'Urgent').length;
  const birthdays = allRows.filter(r => r.reminder_type === 'Birthday' || r.reminder_type === 'Anniversary').length;
  const festivals = allRows.filter(r => r.reminder_type === 'Festival').length;

  document.getElementById('stat-total').textContent     = allRows.length;
  document.getElementById('stat-overdue').textContent   = overdue;
  document.getElementById('stat-birthdays').textContent = birthdays;
  document.getElementById('stat-festivals').textContent = festivals;
}


// ── Filters ───────────────────────────────────────────────────────────────────
function setupFilters() {
  document.getElementById('filter-row').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
    chip.classList.add('active');
    activeFilter = chip.dataset.filter;
    renderCards();
  });
}

function applyFilter(rows) {
  switch (activeFilter) {
    case 'lic':      return rows.filter(r => r.company === 'LIC');
    case 'star':     return rows.filter(r => r.company === 'Star Health');
    case 'premium':  return rows.filter(r => r.reminder_type === 'Premium');
    case 'birthday': return rows.filter(r => r.reminder_type === 'Birthday' || r.reminder_type === 'Anniversary');
    case 'festival': return rows.filter(r => r.reminder_type === 'Festival');
    case 'overdue':  return rows.filter(r => r.priority === 'Urgent');
    default:         return rows;
  }
}


// ── Card Rendering ────────────────────────────────────────────────────────────
function renderCards() {
  const container = document.getElementById('cards-container');
  container.innerHTML = '';

  const rows = applyFilter(allRows);
  if (rows.length === 0) {
    container.innerHTML = '<div class="empty-state">No reminders for this filter.</div>';
    return;
  }

  const frag = document.createDocumentFragment();
  rows.forEach(row => frag.appendChild(buildCard(row)));
  container.appendChild(frag);
}

function buildCard(row) {
  const priority = (row.priority || 'Low').toLowerCase();
  const message  = buildMessage(row);
  const waHref   = buildWhatsAppLink(row.phone, message);

  const card = document.createElement('div');
  card.className = `card priority-${priority}`;

  // ── Tags row ──
  const tagRow = document.createElement('div');
  tagRow.className = 'card-top';

  tagRow.appendChild(makeTag(row.reminder_type, 'tag-type'));
  tagRow.appendChild(makeTag(row.priority, `tag-priority-${priority}`));
  if (row.company) tagRow.appendChild(makeTag(row.company, 'tag-company'));

  // ── Client info ──
  const info = document.createElement('div');
  info.className = 'card-info';

  const nameLine = document.createElement('div');
  nameLine.className = 'client-name';
  nameLine.textContent = row.client_name;

  const phoneLine = document.createElement('div');
  phoneLine.className = 'client-phone';
  phoneLine.textContent = row.phone || 'No phone';

  info.appendChild(nameLine);
  info.appendChild(phoneLine);

  const parts = [];
  if (row.policy_number)  parts.push('Policy: ' + row.policy_number);
  if (row.due_date)        parts.push('Due: ' + row.due_date);
  if (row.premium_amount)  parts.push('Rs. ' + fmtAmount(row.premium_amount));

  if (parts.length) {
    const policyLine = document.createElement('div');
    policyLine.className = 'policy-detail';
    policyLine.textContent = parts.join('  ·  ');
    info.appendChild(policyLine);
  }

  // ── Message preview ──
  const preview = document.createElement('div');
  preview.className = 'msg-preview';
  preview.textContent = message;

  // ── Action buttons ──
  const actions = document.createElement('div');
  actions.className = 'card-actions';

  // Send WhatsApp
  const waBtn = document.createElement('a');
  waBtn.className = 'btn btn-wa';
  waBtn.href      = waHref;
  waBtn.target    = '_blank';
  waBtn.rel       = 'noopener noreferrer';
  waBtn.textContent = 'Send WhatsApp';
  waBtn.addEventListener('click', () => onWaSend(card, tagRow));
  actions.appendChild(waBtn);

  // View PDF (Premium only, and only if PDF_URL is configured)
  if (row.reminder_type === 'Premium' && CONFIG.PDF_URL) {
    const pdfBtn = document.createElement('a');
    pdfBtn.className = 'btn btn-pdf';
    pdfBtn.href      = CONFIG.PDF_URL;
    pdfBtn.target    = '_blank';
    pdfBtn.rel       = 'noopener noreferrer';
    pdfBtn.textContent = 'View PDF';
    actions.appendChild(pdfBtn);
  }

  // Mark Sent
  const logBtn = document.createElement('button');
  logBtn.className   = 'btn btn-log';
  logBtn.textContent = 'Mark Sent';
  logBtn.addEventListener('click', () => onMarkSent(card, tagRow, row, message, logBtn));
  actions.appendChild(logBtn);

  card.appendChild(tagRow);
  card.appendChild(info);
  card.appendChild(preview);
  card.appendChild(actions);

  return card;
}

function makeTag(text, cls) {
  const el = document.createElement('span');
  el.className = 'tag ' + cls;
  el.textContent = text || '';
  return el;
}


// ── Message Building ──────────────────────────────────────────────────────────
function buildMessage(row) {
  try {
    return fillMessage(row.message_key, {
      first_name:    row.first_name || row.client_name.split(' ')[0],
      premium:       fmtAmount(row.premium_amount),
      due_date:      row.due_date,
      policy_name:   row.company,
      policy_number: row.policy_number,
      company:       row.company,
      // days_offset stores years for policy_anniversary reminder type
      years:         row.days_offset,
    });
  } catch (_) {
    const name = row.first_name || row.client_name.split(' ')[0];
    return `Namaste ${name} ji,\n\nYeh aapka ${row.reminder_type} reminder hai.` + SIGNATURE;
  }
}

function fmtAmount(val) {
  if (!val) return '';
  const n = parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(n)) return val;
  return n.toLocaleString('en-IN');
}


// ── Actions ───────────────────────────────────────────────────────────────────
function onWaSend(card, tagRow) {
  card.classList.add('actioned');
  if (!tagRow.querySelector('.tag-sent')) {
    tagRow.appendChild(makeTag('WA Opened', 'tag-sent'));
  }
}

async function onMarkSent(card, tagRow, row, message, btn) {
  btn.disabled       = true;
  btn.textContent    = 'Logging…';

  if (CONFIG.WEBAPP_URL && CONFIG.WEBAPP_URL !== 'YOUR_WEBAPP_URL_HERE') {
    try {
      // no-cors: we can't read the response, but Apps Script receives the POST body.
      // Content-Type must be text/plain to avoid a preflight OPTIONS request.
      await fetch(CONFIG.WEBAPP_URL, {
        method:  'POST',
        mode:    'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          client_id:    row.client_name,
          channel:      'WhatsApp',
          template_key: row.message_key,
          message_body: message,
        }),
      });
    } catch (_) {
      // Opaque response from no-cors is expected; the request still goes through.
    }
  }

  btn.textContent      = 'Sent ✓';
  btn.style.color      = '#4B7A65';
  btn.style.borderColor = '#4B7A65';
  card.classList.add('actioned');

  if (!tagRow.querySelector('.tag-sent')) {
    tagRow.appendChild(makeTag('Sent', 'tag-sent'));
  }
}
