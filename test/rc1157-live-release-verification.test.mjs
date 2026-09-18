import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=file=>fs.readFileSync(file,'utf8');

test('RC1157: neue Browser-Gates sind syntaktisch gültig',()=>{
  for(const file of [
    'e2e/specs/navigation.spec.mjs',
    'e2e/specs/testservice-mutation.spec.mjs',
    'api/e2e-test-fixture/index.js'
  ])execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
});

test('RC1157: Sendung erstellen prüft alle sieben kanonischen Kernbereiche',()=>{
  const source=read('e2e/specs/navigation.spec.mjs');
  for(const id of [
    'rc363BlockCustomer',
    'rc363BlockShipment',
    'rc363BlockColli',
    'rc363BlockDocuments',
    'rc363BlockStow',
    'rc363BlockMail',
    'rc363BlockActions'
  ])assert.match(source,new RegExp('#'+id),id+' fehlt im Live-Browser-Gate');
  for(const label of ['Sendungsdaten','Stauplan','Speichern|Ausgabe'])assert.match(source,new RegExp(label,'i'));
});

test('RC1157: Deckblatt wird als echtes Print-Rendering statt nur als Quelltext geprüft',()=>{
  const source=read('e2e/specs/navigation.spec.mjs');
  assert.match(source,/emulateMedia\(\{media:'print'\}\)/);
  assert.match(source,/getComputedStyle\(cover\)/);
  assert.match(source,/rgb\(29, 78, 216\)/);
  assert.match(source,/rgb\(250, 204, 21\)/);
  assert.match(source,/printColorAdjust/);
});

test('RC1157: TESTSERVICE-Historie prüft Dokumentaktionen Mail Benutzer Persistenz und sichtbare Historie',()=>{
  const source=read('e2e/specs/testservice-mutation.spec.mjs');
  const fixture=read('api/e2e-test-fixture/index.js');
  assert.match(fixture,/'history'/,'E2E-Benutzer braucht Leserecht auf Historie');
  assert.match(source,/recordDocumentAction\(sh,'open','ABD'/);
  assert.match(source,/recordDocumentAction\(sh,'print','CMR'/);
  assert.match(source,/type:'mail-sent'/);
  assert.match(source,/historyPersisted/);
  assert.match(source,/E2E TEST Browser/);
  assert.match(source,/openExportHubView\(page,'history'/);
  assert.match(source,/ABD – geöffnet/);
  assert.match(source,/CMR – gedruckt/);
  assert.match(source,/Versandanmeldung versendet/);
});

test('RC1157: Releaseworkflow führt die verschärften TESTSERVICE-Browserprüfungen tatsächlich aus',()=>{
  const workflow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  const gate=workflow.slice(
    workflow.indexOf('- name: RC1124 TESTSERVICE Browser Gate'),
    workflow.indexOf('- name: Deploy ExportHUB production')
  );
  assert.match(gate,/e2e\/specs\/navigation\.spec\.mjs/);
  assert.match(gate,/e2e\/specs\/testservice-mutation\.spec\.mjs/);
});
