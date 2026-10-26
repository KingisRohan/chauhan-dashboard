// Encrypts data.js into data.enc.js so client data is unreadable without the password.
// Usage: node tools/encrypt_data.mjs <data.js> <password> [out=data.enc.js]
import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto as c } from 'node:crypto';

const [src, pw, out = 'data.enc.js'] = process.argv.slice(2);
if (!src || !pw) { console.error('usage: node tools/encrypt_data.mjs <data.js> <password> [out]'); process.exit(1); }

const g = {};
new Function('g', readFileSync(src, 'utf8').replace('const META', 'g.META').replace('const POLICIES', 'g.POLICIES'))(g);
const plain = new TextEncoder().encode(JSON.stringify({ META: g.META, POLICIES: g.POLICIES }));

const ITER = 600000;
const salt = c.getRandomValues(new Uint8Array(16)), iv = c.getRandomValues(new Uint8Array(12));
const base = await c.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
const key = await c.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const ct = new Uint8Array(await c.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
const b64 = u => Buffer.from(u).toString('base64');
writeFileSync(out, '// Encrypted client data (AES-256-GCM, PBKDF2-SHA256). Built by tools/encrypt_data.mjs\n' +
  'const ENC=' + JSON.stringify({ iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) }) + ';\n');
console.log('wrote', out, ct.length, 'bytes');
