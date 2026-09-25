import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');

test('RC1105: Mail-Historie bleibt automatisch an Mailöffnung gekoppelt',()=>{
  assert.match(source,/mail-sent-open\|/);
  assert.match(source,/recordMailSent\(sh,contextText\)/);
  assert.match(source,/shipmentHistory\.action\.abdMailSent/);
  assert.match(source,/shipmentHistory\.action\.registrationSent/);
  assert.doesNotMatch(source,/function ensureMailConfirm/);
  assert.doesNotMatch(source,/data-rc1071-mail-sent/);
  assert.doesNotMatch(source,/w\.confirm/);
});
