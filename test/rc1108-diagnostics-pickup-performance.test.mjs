import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const perf=fs.readFileSync('assets/rc1069-performance.js','utf8');
const config=JSON.parse(fs.readFileSync('staticwebapp.config.json','utf8'));
const cc=fs.readFileSync('assets/rc1065-registration-cc.js','utf8');

function route(path){return (config.routes||[]).find(r=>r.route===path)}

test('RC1108: tote Pickup-Tokens werden nach 410 lokal pausiert statt erneut zum Server gesendet',()=>{
  assert.match(perf,/pickup-status/i);
  assert.match(perf,/status\s*===?\s*410|Number\([^)]*status[^)]*\)\s*===\s*410/);
  assert.match(perf,/deadPickup|pickupMiss|pickup410|blockedPickup/i);
  assert.match(perf,/10\s*\*\s*60\s*\*\s*1000|600000/);
});

test('RC1108: erwartetes Pickup-410 wird nicht als neuer Diagnose-Netzwerkfehler behalten',()=>{
  assert.match(perf,/__EXPORTHUB_DIAG863_STORE__/);
  assert.match(perf,/records/);
  assert.match(perf,/HTTP 410.*pickup-status|pickup-status.*HTTP 410/i);
});

test('RC1108: lokale Diagnoseereignisse werden erst nach bestätigter Azure-Synchronisierung geleert',()=>{
  assert.match(perf,/ExportHUBDiagnosticsCloud864/);
  assert.match(perf,/pending\s*===\s*0|Number\([^)]*pending[^)]*\)\s*===\s*0/);
  assert.match(perf,/Azure synchronisiert/i);
  assert.match(perf,/\.clear\s*\(/);
});

test('RC1108: Pflicht-CC Runtime kann nicht aus altem Browsercache geladen werden',()=>{
  const r=route('/assets/rc1065-registration-cc.js');
  assert.ok(r,'No-Cache-Route für Pflicht-CC fehlt');
  assert.match(String(r.headers&&r.headers['Cache-Control']||''),/no-store/i);
  assert.match(cc,/SevastianMarcu@essentra\.com/);
  assert.match(cc,/DanielOllmann@essentra\.com/);
});

test('RC1108: Fix bleibt kostenneutral und ändert keine QR-Sicherheitsregeln',()=>{
  assert.doesNotMatch(perf,/openai|chatgpt|api\.openai/i);
  const access=fs.readFileSync('api/shared/public-access-store.js','utf8');
  assert.match(access,/ACCESS_REVOKED/);
  assert.match(access,/ACCESS_EXPIRED/);
  assert.match(access,/legacyReissued/);
});
