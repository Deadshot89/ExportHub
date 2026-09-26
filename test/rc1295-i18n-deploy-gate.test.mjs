import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1295: Drei-Umgebungen-Deploy prüft i18n-Verträge statt entfernte deutsche Runtime-Literale',()=>{
  for(const key of [
    'customerDelete.finalDelete',
    'diagnostics.fixWithChatgpt',
    'stowplan.instructionTitle',
    'api.avis.mailPassed',
    'avisUploads.noticeTitle',
    'avisUploads.openPrint'
  ]) assert.ok(workflow.includes(key),key+' fehlt im Deploy-Gate');

  for(const stale of [
    "grep -q 'Endgültig löschen' dist-rc1112/assets/rc1126-customer-delete.js",
    "grep -q 'Mit ChatGPT beheben' dist-rc1112/assets/rc1013-diagnostics.js",
    "grep -q 'Ladeanweisung' dist-rc1112/assets/rc1113-stowplan-persist.js",
    "grep -q 'Sendungszuordnung fachlich geprüft' api/customer-avis/index.js",
    "grep -q 'Neues AVIS-Dokument' dist-rc1112/assets/rc1133-avis-upload-notifications.js",
    "grep -q 'PDF öffnen / drucken' dist-rc1112/assets/rc1133-avis-upload-notifications.js"
  ]) assert.equal(workflow.includes(stale),false,'veralteter Literalcheck weiterhin aktiv: '+stale);
});
