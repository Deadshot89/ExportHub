import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('e2e/specs/shipment-create.spec.mjs','utf8');
const testStart=source.indexOf("test('RC1171 P0: Sendung erstellen läuft vollständig");
const reload=source.indexOf("await page.reload({waitUntil:'domcontentloaded'});",testStart);
const remoteRead=source.indexOf('const persisted=await page.evaluate(async({token,runId,ref})=>{',reload);
const overview=source.indexOf("await openExportHubView(page,'shipmentoverview'",remoteRead);
assert.ok(testStart>=0&&reload>testStart&&remoteRead>reload&&overview>remoteRead,
  'RC1171 must retain the full shipment creation, reload, Azure readback and overview E2E flow');

test('RC1171: save confirmation before reload remains strict and cannot be bypassed',()=>{
  const before=source.slice(testStart,reload);
  assert.match(before,/await saveButton\.click\(\)/);
  assert.match(before,/await settleStateSave\(page,\{timeout:30_000\}\)/,
    'Real shipment saves must drain and receive confirmation BEFORE reload');
  assert.match(before,/pickupQrRegistered===true/);
  assert.match(before,/toBe\('Bereit zur Abholung'\)/);
});

test('RC1171: new runtime after reload must use independent Azure readback, not stale ACK counter',()=>{
  const afterReload=source.slice(reload,remoteRead);
  assert.match(afterReload,/await waitReady\(page\)/);
  assert.doesNotMatch(afterReload,/settleStateSave\(/,
    'Fresh runtime ACK generation cannot confirm the preceding page save');
  const verify=source.slice(remoteRead,overview);
  assert.match(verify,/fetch\('\/api\/exporthub-state\?mode=read&full=1'/);
  assert.match(verify,/credentials:'same-origin',cache:'no-store'/);
  assert.match(verify,/Authorization:'Bearer '\+token/);
  assert.match(verify,/'X-ExportHUB-Environment':'testservice'/);
  assert.match(verify,/sh\._e2eRunId===runId/);
  assert.match(verify,/expect\(persisted\.status\)\.toBe\(200\)/);
  assert.match(verify,/expect\(persisted\.environment\)\.toBe\('testservice'\)/);
  for(const field of ['ref','customerName','locationId','rows?.length','status','pickupQrRegistered','pickupQrRegisteredAt']){
    assert.ok(verify.includes('persisted.found?.'+field),
      'Persisted '+field+' must be checked against the independent server response');
  }
});

test('RC1171: missing server shipment still blocks completion and overview',()=>{
  const proof=source.slice(remoteRead,overview);
  const readIndex=proof.indexOf('const persisted=await');
  const checksIndex=proof.indexOf('expect(persisted.status).toBe(200)');
  assert.ok(readIndex>=0&&checksIndex>readIndex);
  assert.ok(proof.indexOf("expect(persisted.found?.ref).toBe(ref)")>checksIndex);
  assert.ok(proof.indexOf("expect(persisted.found?.pickupQrRegisteredAt).toBeTruthy()")>checksIndex);
  assert.ok(source.indexOf("await openExportHubView(page,'shipmentoverview'",remoteRead)>remoteRead,
    'Overview must open only after explicit server checks');
});
