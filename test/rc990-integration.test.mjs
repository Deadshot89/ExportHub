import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');
const buildMatch=html.match(/var\s+BUILD\s*=\s*Object\.freeze\(\{version:'RC(\d+)'/);
const build=Number((buildMatch||[])[1]||0);

function count(re){return (html.match(re)||[]).length}

test('RC990 Integration: integrierter Build ist RC990 oder höher',()=>{
  assert.ok(buildMatch,'BUILD marker fehlt');
  assert.ok(build>=990,`Build ist RC${build||0}`);
});

test('RC990 Integration: kanonische RC990 Layer existieren jeweils genau einmal',()=>{
  assert.equal(count(/id=["']rc990-design-system["']/g),1,'Design-System ist nicht eindeutig');
  assert.equal(count(/function\s+rc990CaptureReleasePosition\s*\(/g),1,'Release-Positionsschutz ist nicht eindeutig');
  assert.equal(count(/function\s+rc990CaptureUiState\s*\(/g),1,'UI-State-Snapshot ist nicht eindeutig');
  assert.equal(count(/function\s+rc990FailOperation\s*\(/g),1,'Fehlerabschluss ist nicht eindeutig');
});

test('RC990 Integration: Release Render Navigation und Fehlerabschluss sind gemeinsam vorhanden',()=>{
  for(const marker of [
    /function\s+rc990RestoreReleasePosition\s*\(/,
    /function\s+rc990ScheduleRender\s*\(/,
    /function\s+rc990RememberView\s*\(/,
    /function\s+rc990BackView\s*\(/,
    /function\s+rc990FailOperation\s*\(/
  ]) assert.match(html,marker);
});

test('RC990 Integration: geschützte Versand-Fachlogik wird nicht als neues RC990 Subsystem dupliziert',()=>{
  assert.doesNotMatch(html,/rc990[^\n]{0,180}(?:qrToken|pickupPin|gate41Rate|cmrGenerator|abdRule)/i);
});

test('RC990 Integration: Produktionsfreigabe wird nicht durch einen RC990 Direktdeploy im Frontend ersetzt',()=>{
  assert.doesNotMatch(html,/rc990[^\n]{0,220}(?:productionDeploy|deployProduction|promoteProduction)/i);
});
