import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const loader=fs.readFileSync('test-loader.html','utf8');
const auth=fs.readFileSync('api/exporthub-auth/index.js','utf8');

test('RC1065 Loginvertrag: TESTSERVICE übernimmt die vorhandene Tab-Session statt eine zweite Anmeldung zu erzwingen',()=>{
  assert.match(loader,/sessionStorage\.getItem\('exporthub_rc301_tab_session'\)/);
  assert.match(loader,/if\(x&&x\.token\)return x/);
  assert.match(loader,/X-ExportHUB-Token/);
  assert.match(loader,/X-ExportHUB-Session/);
  assert.match(loader,/Authorization='Bearer '\+s\.token/);
  assert.match(loader,/credentials:'same-origin'/);
});

test('RC1065 Loginvertrag: F5 und Navigation löschen die Session nicht',()=>{
  assert.doesNotMatch(loader,/beforeunload[^\n]{0,500}(?:logout|removeItem)/i);
  assert.doesNotMatch(loader,/unload[^\n]{0,500}(?:logout|removeItem)/i);
  assert.doesNotMatch(loader,/sessionStorage\.removeItem\(['"]exporthub_rc301_tab_session['"]\)/);
  const normalize=loader.match(/function normalizeTabView\(\)\{([\s\S]*?)\}\s*function sanitizeDocument/);
  assert.ok(normalize,'TESTSERVICE Session-Normalisierung fehlt');
  assert.match(normalize[1],/x\.view='dashboard'/);
  assert.match(normalize[1],/sessionStorage\.setItem\(k,JSON\.stringify\(x\)\)/);
  assert.doesNotMatch(normalize[1],/delete\s+x\.token|x\.token\s*=\s*['"]{0,2}|removeItem/);
});

test('RC1065 Loginvertrag: Logout ist eine explizite Auth-Aktion und nicht an Seitenreload gekoppelt',()=>{
  assert.match(auth,/async function logout\(req\)/);
  assert.match(auth,/else if \(action === 'logout'\) result = await logout\(req\)/);
  assert.match(auth,/else if \(action === 'session'\)/);
  assert.doesNotMatch(auth,/beforeunload|pagehide|visibilitychange/i);
});

test('RC1065 Loginvertrag: TESTSERVICE-Loader sendet dieselbe Session an Release-API und verhindert Doppel-Login durch fehlende Header nicht',()=>{
  const headers=loader.match(/function headers\(\)\{([\s\S]*?)\}\s*async function api/);
  assert.ok(headers,'Header-Bridge fehlt');
  assert.match(headers[1],/tabSession\(\)/);
  assert.match(headers[1],/if\(s&&s\.token\)/);
  assert.match(headers[1],/Bearer/);
});
