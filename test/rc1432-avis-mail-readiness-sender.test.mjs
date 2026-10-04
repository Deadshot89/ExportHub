import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const graph=fs.readFileSync('api/shared/graph-mail.js','utf8');
const reminder=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');
const readiness=fs.readFileSync('api/avis-upload-mail-readiness/index.js','utf8');

test('RC1432: shared graph mail exposes the dedicated AVIS sender contract',()=>{
  assert.match(graph,/DEFAULT_AVIS_MAIL_SENDER='DespatchNettetal@essentra\.onmicrosoft\.com'/);
  assert.match(graph,/function getAvisMailSender\(\)/);
  assert.match(graph,/EXPORTHUB_AVIS_MAIL_SENDER/);
  assert.match(graph,/module\.exports=\{[^}]*getAvisMailSender/);
  assert.match(reminder,/EXPORTHUB_AVIS_MAIL_SENDER/,'customer AVIS runtime must use the dedicated AVIS sender setting');
  assert.match(reminder,/DespatchNettetal@essentra\.onmicrosoft\.com/,'customer AVIS runtime must preserve the established default sender');
});

test('RC1432: AVIS readiness send-test uses the dedicated customer AVIS sender',()=>{
  assert.match(readiness,/avisMailSender=graphMail\.getAvisMailSender\(\)/);
  const action=readiness.indexOf("if(action==='send-test')");
  const send=readiness.indexOf('graphMail.sendTextMail({',action);
  const end=readiness.indexOf('});',send);
  assert.ok(action>=0&&send>action&&end>send,'send-test branch missing');
  const block=readiness.slice(send,end);
  assert.match(block,/sender:avisMailSender/,'readiness must exercise the real AVIS sender');
});

test('RC1432: readiness surfaces the tested sender for release diagnostics',()=>{
  assert.match(readiness,/sender:avisMailSender/);
  assert.match(readiness,/upstreamStatus:Number\(e&&e\.upstreamStatus\|\|0\)\|\|undefined/);
  assert.match(readiness,/upstreamCode:text\(e&&e\.upstreamCode\)\|\|undefined/);
});
