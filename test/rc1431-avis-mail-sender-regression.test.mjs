import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const api=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');

test('RC1431 P0: AVIS-Mail verwendet wieder den dedizierten Despatch-Absender statt des allgemeinen Graph-Absenders',()=>{
  assert.match(api,/const DEFAULT_AVIS_MAIL_SENDER='DespatchNettetal@essentra\.onmicrosoft\.com'/);
  assert.match(api,/function configuredAvisMailSender\(\)\{return text\(process\.env\.EXPORTHUB_AVIS_MAIL_SENDER\|\|DEFAULT_AVIS_MAIL_SENDER\)\}/);
  assert.match(api,/const sender=configuredAvisMailSender\(\),cc=ccRecipients\(current\.team,shipment,to,sender\)/);
  assert.match(api,/graphMail\.sendTextMail\(\{to,subject:sub,body:content,sender,cc\}\)/);
  assert.doesNotMatch(api,/function configuredMailSender\(\)\{return text\(process\.env\.EXPORTHUB_MAIL_SENDER\|\|process\.env\.EXPORTHUB_POD_DRIVE_USER\)\}/);
});
