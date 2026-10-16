import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const immediate=fs.readFileSync('assets/rc1027-lieferavis-immediate.js','utf8');
const reminder=fs.readFileSync('assets/rc1166-avis-reminder-overview.js','utf8');
const customerAvisApi=fs.readFileSync('api/customer-avis/index.js','utf8');
const reminderMailApi=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');
const reminderContract=fs.readFileSync('test/rc1166-avis-reminder-overview.test.mjs','utf8');
const packageJson=fs.readFileSync('package.json','utf8');

const canonical='https://www.exporthub360.de';
const forbiddenCanonical=/PROD(?:UCTION)?_(?:AVIS_ORIGIN|PUBLIC_HOST)='(?:https:\/\/)?(?:www\.)?exporthub360\.com'/;

test('RC1552: neue Produktions-AVIS-Links bleiben verbindlich auf exporthub360.de',()=>{
  assert.match(immediate,new RegExp(`RC1333_PROD_AVIS_ORIGIN='${canonical.replaceAll('.','\\.')}'`));
  assert.match(reminder,new RegExp(`RC1333_PROD_AVIS_ORIGIN='${canonical.replaceAll('.','\\.')}'`));
  assert.match(customerAvisApi,/PRODUCTION_AVIS_ORIGIN='https:\/\/www\.exporthub360\.de'/);
  assert.match(reminderMailApi,/PRODUCTION_PUBLIC_HOST='www\.exporthub360\.de'/);
  assert.doesNotMatch(immediate,forbiddenCanonical);
  assert.doesNotMatch(reminder,forbiddenCanonical);
  assert.doesNotMatch(customerAvisApi,forbiddenCanonical);
});

test('RC1552: Tests dürfen den produktiven AVIS-Domainvertrag nicht mehr auf .com zurückpatchen',()=>{
  assert.doesNotMatch(packageJson,/rc1545-avis-canonical-com-domain\.mjs/);
});

test('RC1552: alte .com-Links bleiben als Legacy-Eingang akzeptiert und werden auf .de normalisiert',()=>{
  assert.match(immediate,/h==='exporthub360\.com'/);
  assert.match(reminderMailApi,/LEGACY_COM_PRODUCTION_PUBLIC_HOST='exporthub360\.com'/);
  assert.match(reminderContract,/customerAvisUrl:'https:\/\/exporthub360\.com\/avis\/legacy-token'/);
  assert.match(reminderContract,/https:\/\/www\.exporthub360\.de\/avis\/legacy-token/);
});
