import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const api=fs.readFileSync('api/customer-avis/index.js','utf8');

test('RC1229: AVIS-Upload-Mailintegration ist syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','api/customer-avis/index.js'],{stdio:'pipe'});
});

test('RC1229: Despatch Nettetal ist zusätzlicher Standardempfänger',()=>{
  assert.match(api,/EXPORTHUB_AVIS_UPLOAD_NOTIFICATION_TO/);
  assert.match(api,/DespatchNettetal@essentra\.onmicrosoft\.com/);
  assert.match(api,/graphMail\.sendTextMail/);
});

test('RC1229: echte Upload-Mails werden ausschließlich in Produktion verschickt',()=>{
  assert.match(api,/if\(environment!=='production'\)return\{ok:true,skipped:true,reason:'non-production'\}/);
});

test('RC1229: Mail wird erst nach erfolgreichem Speichern und fachlicher Prüfung ausgelöst',()=>{
  const save=api.indexOf('const shipment=await updateCustomerUploadOutcome');
  const mail=api.indexOf('const mailNotification=await notifyDespatchCustomerUpload');
  assert.ok(save>=0&&mail>save,'Mail darf erst nach persistiertem Kundendokument ausgelöst werden');
  assert.match(api,/Virenprüfung und fachliche Sendungszuordnung erfolgreich/);
});

test('RC1229: Mail enthält Druckhinweis und Upload-Identifikation',()=>{
  assert.match(api,/Sendungsreferenz:/);
  assert.match(api,/Kunde:/);
  assert.match(api,/Dokument:/);
  assert.match(api,/PDF öffnen \/ drucken/);
  assert.match(api,/Neues AVIS-Dokument/);
});

test('RC1229: Mailfehler blockiert den bereits erfolgreichen Kundenupload nicht',()=>{
  assert.match(api,/catch\(e\)\{\s*return\{ok:false,to:recipient,code:/);
  assert.match(api,/shipment,mailNotification/);
});
