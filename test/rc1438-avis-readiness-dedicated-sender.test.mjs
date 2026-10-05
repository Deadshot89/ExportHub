import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8')}

const readiness=read('api/avis-upload-mail-readiness/index.js');
const avisMail=read('api/avis-reminder-mail/index.js');

test('RC1438: AVIS readiness send probe uses the same dedicated Despatch sender contract as customer AVIS mail',()=>{
  assert.match(avisMail,/DEFAULT_AVIS_MAIL_SENDER='DespatchNettetal@essentra\.com'/);
  assert.match(avisMail,/EXPORTHUB_AVIS_MAIL_SENDER/);
  assert.match(readiness,/EXPORTHUB_AVIS_MAIL_SENDER/);
  assert.match(readiness,/const avisMailSender=text\(process\.env\.EXPORTHUB_AVIS_MAIL_SENDER\)\|\|DEFAULT_RECIPIENT/);
  assert.match(readiness,/graphMail\.sendTextMail\(\{[\s\S]*?sender:avisMailSender,[\s\S]*?to:DEFAULT_RECIPIENT/);
  assert.match(readiness,/sender:avisMailSender,recipient:DEFAULT_RECIPIENT/);
});
