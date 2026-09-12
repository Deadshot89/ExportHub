import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const BUILDER=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');
const INDEX=fs.readFileSync('index.html','utf8');

test('RC1070: wiederhergestellte Produktion-Sitzung startet direkt mit dem authentifizierten State-Read',()=>{
  assert.match(BUILDER,/const restoreOld="try\{if\(runtime\.sessionRestored&&!isTestServiceOrigin\(\)\)await verifySessionForLoad\(\);await loadStateAfterLogin\(\);/);
  assert.match(BUILDER,/const restoreNew="try\{await loadStateAfterLogin\(\);runtime\.sessionRefreshAttempted=false;await loadCanonicalModules\(\)\}"/);
  assert.match(BUILDER,/RC1070 redundanter Session-Check vor State-Read noch vorhanden/);
});

test('RC1070: State-Read validiert den vorhandenen Sitzungstoken selbst',()=>{
  const start=INDEX.indexOf('async function stateCall('),end=INDEX.indexOf('\nfunction shipmentRecoveryScalar',start);
  assert.ok(start>=0&&end>start,'stateCall fehlt');
  const block=INDEX.slice(start,end);
  assert.match(block,/X-ExportHUB-Token/);
  assert.match(block,/X-ExportHUB-Session/);
  assert.match(block,/Authorization/);
  assert.match(block,/SESSION_INVALID/);
  assert.match(block,/SESSION_REVOKED/);
  assert.match(block,/AUTH_REQUIRED/);
});

test('RC1070: normaler Login und TESTSERVICE-Schutz bleiben erhalten',()=>{
  assert.match(INDEX,/async function rejectTestserviceNonGlobal/);
  assert.match(INDEX,/async function login\(manual\)/);
  assert.match(INDEX,/async function loadStateAfterLogin\(\)/);
  assert.match(INDEX,/if\(isTestServiceOrigin\(\)\)/);
});
