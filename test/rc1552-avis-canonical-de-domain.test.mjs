import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const immediate=fs.readFileSync('assets/rc1027-lieferavis-immediate.js','utf8');
const reminder=fs.readFileSync('assets/rc1166-avis-reminder-overview.js','utf8');
const customerAvisApi=fs.readFileSync('api/customer-avis/index.js','utf8');
const reminderMailApi=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');

const canonicalOrigin="https://exporthub360.de";

for(const [name,source] of [
  ['Lieferavis',immediate],
  ['Avis-Erinnerung',reminder]
]){
  test(`RC1552: ${name} erzeugt neue Produktionslinks ausschließlich unter exporthub360.de`,()=>{
    assert.match(source,new RegExp(`RC1333_PROD_AVIS_ORIGIN='${canonicalOrigin.replaceAll('.','\\.')}'`));
    assert.doesNotMatch(source,/RC1333_PROD_AVIS_ORIGIN='https:\/\/(?:www\.)?exporthub360\.com'/);
  });
}

test('RC1552: Customer-AVIS-API verwendet exporthub360.de als kanonischen Produktions-Origin',()=>{
  assert.match(customerAvisApi,/PRODUCTION_AVIS_ORIGIN='https:\/\/exporthub360\.de'/);
  assert.doesNotMatch(customerAvisApi,/PRODUCTION_AVIS_ORIGIN='https:\/\/(?:www\.)?exporthub360\.com'/);
});

test('RC1552: Reminder-Mail normalisiert neue Kundenlinks auf exporthub360.de',()=>{
  assert.match(reminderMailApi,/PRODUCTION_PUBLIC_HOST='exporthub360\.de'/);
  assert.doesNotMatch(reminderMailApi,/PRODUCTION_PUBLIC_HOST='exporthub360\.com'/);
});

test('RC1552: bestehende .com AVIS-Links bleiben als Legacy-Eingang akzeptiert',()=>{
  assert.match(immediate,/h==='exporthub360\.com'/);
  assert.match(immediate,/h==='www\.exporthub360\.com'/);
  assert.match(reminderMailApi,/exporthub360\.com/);
});
