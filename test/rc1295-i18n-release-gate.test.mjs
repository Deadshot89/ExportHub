import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const workflow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
const de=JSON.parse(read('assets/i18n/de.json'));
const apiDe=JSON.parse(read('api/shared/i18n/de.json'));

test('RC1295: Drei-Umgebungen-Deploy prüft i18n-Schlüssel statt entfernte deutsche Runtime-Literale',()=>{
  const required=[
    'customerDelete.finalDelete',
    'diagnostics.fixWithChatgpt',
    'stowplan.instructionTitle',
    'avisUploads.noticeTitle',
    'avisUploads.openPrint',
    'migration.runAll',
    'gate41.calculated',
    'shipmentHistory.action.abdMailSent',
    'shipmentHistory.action.workStarted',
    'shipmentHistory.action.registrationStarted',
    'history.customer.customer-created',
    'history.customer.customer-updated',
    'history.title',
    'customerContacts.savePerson',
    'customerContacts.addToMail',
    'packaging.packages',
    'packaging.pallets',
    'packaging.other',
    'diagnostics.title'
  ];
  for(const marker of required)assert.ok(workflow.includes(marker),marker+' fehlt im Release-Gate');

  const stale=[
    "grep -q 'Endgültig löschen' dist-rc1112/assets/rc1126-customer-delete.js",
    "grep -q 'Mit ChatGPT beheben' dist-rc1112/assets/rc1013-diagnostics.js",
    "grep -q 'Ladeanweisung' dist-rc1112/assets/rc1113-stowplan-persist.js",
    "grep -q 'Sendungszuordnung fachlich geprüft' api/customer-avis/index.js",
    "grep -q 'Neues AVIS-Dokument' dist-rc1112/assets/rc1133-avis-upload-notifications.js",
    "grep -q 'PDF öffnen / drucken' dist-rc1112/assets/rc1133-avis-upload-notifications.js"
  ];
  for(const marker of stale)assert.equal(workflow.includes(marker),false,'veralteter Literalcheck bleibt aktiv: '+marker);
});

test('RC1295: Runtime und deutsche Locale liefern die vom Gate geprüften Schlüssel',()=>{
  const runtimeChecks=[
    ['assets/rc1126-customer-delete.js','customerDelete.finalDelete'],
    ['assets/rc1013-diagnostics.js','diagnostics.fixWithChatgpt'],
    ['assets/rc1113-stowplan-persist.js','stowplan.instructionTitle'],
    ['assets/rc1133-avis-upload-notifications.js','avisUploads.noticeTitle'],
    ['assets/rc1133-avis-upload-notifications.js','avisUploads.openPrint'],
    ['assets/rc1061-document-migration-admin.js','migration.runAll'],
    ['assets/rc1013-gate41-ui.js','gate41.calculated'],
    ['assets/rc1080-customer-history.js','history.customer.customer-created'],
    ['assets/rc1080-customer-history.js','history.customer.customer-updated'],
    ['assets/rc1081-audit-history.js','history.title'],
    ['assets/rc1092-customer-mail-contacts.js','customerContacts.savePerson'],
    ['assets/rc1092-customer-mail-contacts.js','customerContacts.addToMail'],
    ['assets/rc1096-packaging-groups.js','packaging.packages'],
    ['assets/rc1096-packaging-groups.js','packaging.pallets'],
    ['assets/rc1096-packaging-groups.js','packaging.other']
  ];
  for(const [file,key] of runtimeChecks)assert.ok(read(file).includes(key),file+' enthält '+key+' nicht');

  assert.equal(de['customerDelete.finalDelete'],'Endgültig löschen');
  assert.equal(de['diagnostics.fixWithChatgpt'],'Mit ChatGPT beheben');
  assert.equal(de['stowplan.instructionTitle'],'Ladeanweisung');
  assert.equal(de['avisUploads.noticeTitle'],'Neues AVIS-Dokument');
  assert.equal(de['avisUploads.openPrint'],'PDF öffnen / drucken');
  assert.equal(de['migration.runAll'],'Alle verbleibenden migrieren');
  assert.match(de['gate41.calculated'],/^Gate41-Preis Deutschland berechnet/);
  assert.equal(de['customerContacts.savePerson'],'Person speichern');
  assert.equal(de['customerContacts.addToMail'],'Zur Mail hinzufügen');
  assert.equal(apiDe['api.avis.mailPassed'],'Die Datei hat die Virenprüfung und die fachliche Sendungszuordnung bestanden.');
});

test('RC1295: AVIS-Mail-Gate prüft den API-i18n-Vertrag',()=>{
  assert.match(workflow,/grep -q '\\"api\\.avis\\.mailPassed\\"' api\/shared\/i18n\/de\.json/);
});
