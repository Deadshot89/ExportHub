import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const navigation=fs.readFileSync('e2e/specs/navigation.spec.mjs','utf8');

test('RC1173: Nicht-Admin-E2E wird nicht durch globale Admin-Init-Session überschrieben',()=>{
  const beforeEach=navigation.slice(
    navigation.indexOf('test.beforeEach'),
    navigation.indexOf('async function assertView')
  );
  assert.match(beforeEach,/dedicatedNonAdmin/);
  assert.match(beforeEach,/RC1169 P0: Nicht-Admin/);
  assert.match(beforeEach,/!dedicatedNonAdmin/);

  const start=navigation.indexOf("test('RC1169 P0: Nicht-Admin");
  const end=navigation.indexOf("\n\ntest('RC1126 P0:",start);
  assert.ok(start>=0&&end>start,'RC1169 Browser-Test fehlt');
  const block=navigation.slice(start,end);

  const init=block.indexOf('page.addInitScript');
  const firstGoto=block.indexOf('page.goto(appEntry()');
  assert.ok(init>=0,'Nicht-Admin-Session wird nicht als Init-Script installiert');
  assert.ok(firstGoto>init,'Nicht-Admin-Session muss vor dem ersten Seitenaufruf installiert werden');
  assert.match(block,/name:'eh_session',value:token/);
  assert.match(block,/deviceId:'e2e-playwright-nonadmin'/);
  assert.doesNotMatch(block,/await page\.reload\(/,'Nicht-Admin-Test darf keinen zweiten Dokumentstart benötigen, der eine Admin-Init-Session reaktivieren könnte');
});
