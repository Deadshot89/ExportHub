import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const helper=fs.readFileSync('e2e/helpers/exporthub-browser.mjs','utf8');

test('RC1540: Live-waitReady wartet bis der bekannte Startup-Ladezustand beendet ist',()=>{
  const start=helper.indexOf('export async function waitReady(page)');
  const end=helper.indexOf('function responsiveViewport',start);
  assert.ok(start>=0&&end>start,'waitReady-Block fehlt');
  const block=helper.slice(start,end);
  assert.match(block,/process\.env\.EXPORTHUB_E2E_LIVE==='1'/);
  assert.match(block,/ExportHUBRC1067StartupRecovery/,'kanonische Startup-Ladeerkennung wird nicht verwendet');
  assert.match(block,/\.loading\(\)/,'Startup-Ladezustand wird nicht abgefragt');
  assert.match(block,/ExportHUB\\s\+wird\\s\+geladen|Teamdaten\\s\+werden\\s\+wiederhergestellt|Gespeicherte\\s\+Sitzung\\s\+und\\s\+Teamdaten/,'Fallback erkennt den sichtbaren Ladezustand nicht');
});
