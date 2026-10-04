import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const graph=fs.readFileSync('api/shared/graph-mail.js','utf8');
const reminder=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');
const readiness=fs.readFileSync('api/avis-upload-mail-readiness/index.js','utf8');

test('RC1432: dedicated AVIS sender has one shared source of truth',()=>{
  assert.match(graph,/DEFAULT_AVIS_MAIL_SENDER='DespatchNettetal@essentra\.onmicrosoft\.com'/);
  assert.match(graph,/function getAvisMailSender\(\)/);
  assert.match(graph,/EXPORTHUB_AVIS_MAIL_SENDER/);
  assert.match(graph,/module\.exports=\{[^}]*getAvisMailSender/);
  assert.doesNotMatch(reminder,/const DEFAULT_AVIS_MAIL_SENDER=/,'AVIS endpoint must not keep a second sender default');
  assert.match(reminder,/graphMail\.getAvisMailSender\(\)/);
});

test('RC1432: AVIS readiness send-test uses the same sender as customer AVIS runtime',()=>{
  assert.match(readiness,/const avisMailSender=graphMail\.getAvisMailSender\(\)/);
  const action=readiness.indexOf("if(action==='send-test')");
  const send=readiness.indexOf('graphMail.sendTextMail({',action);
  const end=readiness.indexOf('});',send);
  assert.ok(action>=0&&send>action&&end>send,'send-test branch missing');
  const block=readiness.slice(send,end);
  assert.match(block,/sender:avisMailSender/,'readiness must exercise the real AVIS sender');
});
