import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['index.html','TESTVERSION.html']) {
  const s=fs.readFileSync(file,'utf8');
  test(`${file}: registrierte QR-Abholung wird gegen den Server geprüft und bei 410 neu registriert`,()=>{
    assert.match(s,/if\(sh\.pickupQrRegistered&&!force\)\{if\(!\/\^\[a-f0-9\]\{48\}\$\/i\.test\(token\)\)/);
    assert.match(s,/Number\(e&&e\.status\)===410/);
    assert.match(s,/Number\(e&&e\.statusCode\)===410/);
    assert.match(s,/ACCESS_/);
    assert.match(s,/return register\(sh,true\)/);
  });
  test(`${file}: Diagnose-Guard wird als externes Asset sicher im Dokumentkopf geladen`,()=>{
    assert.match(s,/<title>ExportHUB Online<\/title>\s*<script defer src="assets\/rc1000-diagnostics-guard\.js\?v=RC1000"><\/script>/);
  });
}

test('Diagnose-Guard koalesziert Pickup-Status, Meta und identische Saves',()=>{
  const s=fs.readFileSync('assets/rc1000-diagnostics-guard.js','utf8');
  assert.match(s,/pickupNegativeCacheMs:60000/);
  assert.match(s,/metaCacheMs:2000/);
  assert.match(s,/exactSaveDedupe:true/);
  assert.match(s,/inflight\.has\(k\)/);
  assert.match(s,/negative\.set\(token,Date\.now\(\)\+60000\)/);
});

test('pickup.html akzeptiert ausschließlich kryptografische 48-Hex-Tokens',()=>{
  const s=fs.readFileSync('pickup.html','utf8');
  assert.match(s,/\[a-f0-9\]\{48\}/i);
  assert.doesNotMatch(s,/\[A-Za-z0-9_-\]\{6,128\}/);
  assert.doesNotMatch(s,/ehcmd/);
});

test('Verlader-PIN ETag-Konflikte erhalten Backoff, echte PIN_EXISTS-Konflikte bleiben 409',()=>{
  const s=fs.readFileSync('api/shared/loader-pin-store.js','utf8');
  assert.match(s,/function retryDelay\(attempt\)/);
  assert.match(s,/await retryDelay\(attempt\)/);
  assert.match(s,/PIN_EXISTS/);
  assert.match(s,/PIN_CONFLICT/);
});

test('State-Speicherung wartet zwischen echten Azure-Konflikten',()=>{
  const s=fs.readFileSync('api/exporthub-state/index.js','utf8');
  assert.match(s,/Math\.min\(500,40\*Math\.pow\(2,attempt\)\)/);
  assert.match(s,/CONCURRENT_UPDATE/);
});
