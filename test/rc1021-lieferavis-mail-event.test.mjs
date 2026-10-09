import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/rc1015-lieferavis-mail-flow.js','utf8');

test('RC1021: jeder erfolgreiche Lieferavis-Statuswechsel meldet die Mailruntime',()=>{
  assert.match(source,/function rc1021NotifyAvisUpdated\(/,'Explizite Avis-Statusmeldung fehlt.');
  assert.match(source,/exporthub:customer-avis-updated/,'Der gemeinsame Avis-Update-Event fehlt.');
  const manual=source.slice(source.indexOf('async function rc1015Toggle(on)'),source.indexOf('async function rc1021AutoEnable'));
  assert.match(manual,/await base\.toggle\(on\)[\s\S]*rc1021NotifyAvisUpdated\(on/,'Manuelle Aktivierung/Deaktivierung aktualisiert die Mailruntime nicht.');
  const automatic=source.slice(source.indexOf('async function rc1021AutoEnable'),source.indexOf('function stripAvisBlocks'));
  assert.match(automatic,/await base\.toggle\(true\)[\s\S]*rc1021NotifyAvisUpdated\(true/,'Automatische Aktivierung aktualisiert die Mailruntime nicht.');
});


test('RC1383/RC1467 P1: automatischer Lifecycle kann auch über einen gewrappten Toggle keinen zweiten Save auslösen',()=>{
  const manual=source.slice(source.indexOf('async function rc1015Toggle(on)'),source.indexOf('async function rc1021AutoEnable'));
  const automatic=source.slice(source.indexOf('async function rc1021AutoEnable'),source.indexOf('function stripAvisBlocks'));
  assert.match(source,/autoEnableSaveConfirmed=Object\.create\(null\)/);
  assert.match(automatic,/RC1467: background\/startup auto-enable operates only on an already persisted shipment/,'Der RC1467 Lifecycle-Vertrag fehlt.');
  assert.match(automatic,/var saveAlreadyConfirmed=true;/,'Automatische Lifecycle-Events müssen als bereits persistiert behandelt werden.');
  assert.doesNotMatch(automatic,/rc1015PersistBeforeAvis\s*\(/,'Automatischer Lifecycle darf den User-Save-Bridge niemals erneut aufrufen.');
  assert.match(automatic,/if\(saveAlreadyConfirmed\)autoEnableSaveConfirmed\[ref\]=true/);
  assert.match(manual,/if\(!autoEnableSaveConfirmed\[refBeforeToggle\]\)await rc1015PersistBeforeAvis\(\)/);
  assert.match(automatic,/delete autoEnableSaveConfirmed\[ref\]/);
  assert.match(automatic,/await base\.toggle\(true\)/,'Avis-Aktivierung muss nach bestätigtem Save weiterhin erfolgen.');
});

test('RC1236: normale Navigation startet außerhalb der Sendungsansicht keinen Avis-Autosave',()=>{
  assert.match(source,/function rc1021ShipmentViewActive\(\)/,'Ansichts-Guard für die Avis-Automatik fehlt.');
  const automatic=source.slice(source.indexOf('async function rc1021AutoEnable'),source.indexOf('function stripAvisBlocks'));
  assert.match(automatic,/reason==='exporthub:viewchange'\|\|reason==='exporthub:rendered'\|\|reason==='exporthub:sync'/,'Navigation/Render/Sync müssen vom Ansichts-Guard erfasst werden.');
  assert.match(automatic,/!rc1021ShipmentViewActive\(\)\)return false;/,'Außerhalb der Sendungsansicht muss die automatische Persistierung vor currentShipmentForAvis beendet werden.');
  assert.ok(automatic.indexOf('!rc1021ShipmentViewActive()')<automatic.indexOf('currentShipmentForAvis()'),'Ansichts-Guard muss vor Sendungssuche und Persistierung greifen.');
  assert.match(source,/\{'exporthub:ready':1,'exporthub:rendered':1,'exporthub:viewchange':1,'exporthub:sync':1,'exporthub:shipment-saved':1\}/,'Bestehende fachliche Auto-Events bleiben registriert; nur teure Arbeit wird außerhalb der Sendungsansicht übersprungen.');
});
