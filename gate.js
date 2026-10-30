// gate.js — unlocks the encrypted client data, then starts the dashboard.
(function () {
  const KEY_LS = 'chauhan_desk_key_v1';
  const b64 = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
  const $ = id => document.getElementById(id);

  async function deriveKey(pw) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(ENC.salt), iterations: ENC.iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
  }
  async function open(key) {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(ENC.iv) }, key, b64(ENC.ct));
    const d = JSON.parse(new TextDecoder().decode(plain));
    window.META = d.META; window.POLICIES = d.POLICIES; window.STAR = d.STAR || [];
  }
  function load(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.body.appendChild(s); }); }
  async function start() {
    document.body.classList.remove('locked');
    await load('logic.js'); await load('app.js'); await load('star.js'); await load('revenue.js');
  }

  $('lockBtn').addEventListener('click', () => { try { localStorage.removeItem(KEY_LS); } catch (_) {} location.reload(); });

  // remembered device: stored key only works for this exact data build
  (async () => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY_LS) || 'null');
      if (saved && saved.salt === ENC.salt) {
        const key = await crypto.subtle.importKey('jwk', saved.jwk, { name: 'AES-GCM' }, false, ['decrypt']);
        await open(key); return start();
      }
    } catch (e) { try { localStorage.removeItem(KEY_LS); } catch (_) {} }
    $('gatePw').focus();
  })();

  $('gateForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('gateBtn'), err = $('gateErr');
    btn.disabled = true; btn.textContent = 'Unlocking…'; err.textContent = '';
    try {
      const key = await deriveKey($('gatePw').value);
      await open(key);
      if ($('gateRem').checked) {
        try { localStorage.setItem(KEY_LS, JSON.stringify({ salt: ENC.salt, jwk: await crypto.subtle.exportKey('jwk', key) })); } catch (_) {}
      }
      await start();
    } catch (x) {
      err.textContent = 'Wrong password';
      const card = $('gateForm'); card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
      $('gatePw').select();
      btn.disabled = false; btn.textContent = 'Unlock';
    }
  });
})();
