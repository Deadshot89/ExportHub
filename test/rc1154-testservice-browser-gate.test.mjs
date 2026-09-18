import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const helper=fs.readFileSync('e2e/helpers/exporthub-browser.mjs','utf8');
const nav=fs.readFileSync('e2e/specs/navigation.spec.mjs','utf8');
const mutation=fs.readFileSync('e2e/specs/testservice-mutation.spec.mjs','utf8');
const deployContract=fs.readFileSync('test/rc1016-production-deploy.test.mjs','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1154: responsive Hauptnavigation öffnet das echte Seitenmenü vor der Modulsuche',()=>{
  assert.match(helper,/function\s+responsiveViewport\s*\(/,'Responsive-Erkennung fehlt');
  assert.match(helper,/width\s*<=\s*900/,'kanonischer 900px-Shell-Breakpoint fehlt');
  assert.match(helper,/await\s+openMenu\(page\)/,'echtes Mobile-Menü wird nicht vor der Suche geöffnet');
  assert.match(helper,/eh-sidebar-open|ExportHUBMobileMenu/,'Menü-Offen-Zustand wird nicht bestätigt');
});

test('RC1154: Browser-Gate wartet auf echte Azure-Saves statt ERR_ABORTED zu ignorieren',()=>{
  assert.match(helper,/export\s+async\s+function\s+settleStateSave\b/,'Save-Drain-Helper fehlt');
  assert.match(helper,/ExportHUBClean/,'Save-Drain nutzt die echte ExportHUB-Speicherruntime nicht');
  assert.match(helper,/flushSave/,'ausstehende Saves werden nicht kontrolliert bestätigt');
  assert.doesNotMatch(helper,/ERR_ABORTED[^\n]{0,160}(?:return|ignore|allow)/i,'ERR_ABORTED darf nicht ausgefiltert werden');
  assert.match(nav,/settleStateSave\(page/,'Navigation wartet nicht auf laufende Saves');
  assert.match(mutation,/settleStateSave\(page/,'Mutationstest wartet nicht auf laufende Saves');
});

test('RC1154: Abholdatum-Test prüft genau die von ihm gesetzte Sendung',()=>{
  assert.doesNotMatch(nav,/const pickup=page\.locator\('\[data-rc1127-customer-pickup\]'\)\.first\(\)/,'globale first()-Auswahl ist nicht deterministisch');
  assert.match(nav,/seeded\.ref|seeded\.id/,'Seed muss die Zielsendung identifizieren');
  assert.match(nav,/filter\(\{hasText:/,'Sendungskachel muss über die Zielsendung eingegrenzt werden');
});

test('RC1154: historischer RC1016-Vertrag akzeptiert den aktuellen Aufgaben-Runtime-Cache-Key',()=>{
  assert.match(deployContract,/rc1014-task-runtime\\\.js\\\?v=1152/,'alter ?v=1016-Vertrag blockiert den aktuellen RC1152 Aufgabenstand');
});


test('RC1154: pagehide startet ohne echte Sendungsänderung keinen neuen Azure-Save',()=>{
  assert.match(build,/patchShipmentSuspendSave/,'finaler Build patcht den veralteten Shipment-Suspend-Pfad nicht');
  assert.match(build,/!editSaveReason&&!editSaveTimer/,'No-op-Guard für flushEditSave fehlt');
  assert.match(build,/Sendungseingabe vor Verlassen gespeichert/,'bestehender Suspend-Pfad muss gezielt adressiert werden');
});
