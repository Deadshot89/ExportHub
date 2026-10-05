import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runbook=fs.readFileSync('docs/runbooks/avis-mail-graph-consent.md','utf8');
const readiness=fs.readFileSync('api/avis-upload-mail-readiness/index.js','utf8');

test('RC1440: Entra-Runbook verwendet denselben AVIS-Absender wie die Readiness',()=>{
  assert.match(readiness,/DEFAULT_RECIPIENT='DespatchNettetal@essentra\.com'/);
  assert.match(readiness,/EXPORTHUB_AVIS_MAIL_SENDER/);
  assert.match(runbook,/DespatchNettetal@essentra\.com/);
  assert.doesNotMatch(runbook,/DespatchNettetal@essentra\.onmicrosoft\.com/);
});

test('RC1440: Runbook hält den externen Mail.Send-Blocker und die zweistufige Verifikation fest',()=>{
  assert.match(runbook,/Application permissions/);
  assert.match(runbook,/Mail\.Send/);
  assert.match(runbook,/b633e1c5-b582-4048-a93e-9f11b44c7e96/);
  assert.match(runbook,/send_test = false/);
  assert.match(runbook,/send_test = true/);
  assert.match(runbook,/mailProbe\.ok=true/);
});
