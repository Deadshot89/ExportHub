import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1007-sop-catalog.js');
await import('../assets/sop/rc1016-sop-consolidation.js');
await import('../assets/sop/rc1501-sop-tour-catalog.js');

const catalog=globalThis.ExportHubIsoSopCatalog;

function read(path){return fs.readFileSync(path,'utf8');}

test('SOP-EH-060 enthält einen echten aktivierten ABD-Pilot-Tourschritt',()=>{
  const sop=catalog.get('SOP-EH-060');
  assert.ok(sop,'SOP-EH-060 fehlt');
  const steps=Array.isArray(sop.sections?.steps)?sop.sections.steps:[];
  const enabled=steps.filter(step=>step?.tour?.enabled===true);
  assert.ok(enabled.length>=1,'SOP-EH-060 besitzt noch keinen aktivierten Tour-Schritt');
  const abd=enabled.find(step=>step?.target?.stableKey==='shipment-abd-decision');
  assert.ok(abd,'ABD-Tourschritt besitzt kein stabiles shipment-abd-decision-Ziel');
  assert.equal(abd.expectedAction,'click');
  assert.ok(Array.isArray(abd.checks)&&abd.checks.length>0,'Tourschritt benötigt mindestens eine Ergebnisprüfung');
});

test('RC1501 Wrapper baut auf dem aktuellen Drei-Umgebungs-Build auf und kopiert alle Tour-Abhängigkeiten',()=>{
  const builder=read('.github/rc1501/build-three-env.mjs');
  assert.match(builder,/\.github\/rc1112\/build-three-env\.mjs/);
  for(const asset of [
    'assets/sop/rc1500-sop-step-contract.js',
    'assets/sop/rc1500-sop-overlay.js',
    'assets/sop/rc1500-sop-context.js',
    'assets/sop/rc1501-sop-tour-catalog.js',
    'assets/sop/rc1501-sop-tour-validator.js',
    'assets/sop/rc1501-sop-tour-targets.js',
    'assets/sop/rc1501-sop-tour-engine.js',
    'assets/sop/rc1501-sop-tour-ui.js',
    'assets/sop/rc1501-sop-tour-runtime.js',
    'assets/sop/rc1501-sop-tour.css'
  ])assert.match(builder,new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),asset+' fehlt im Drei-Umgebungs-Build');
  assert.match(builder,/exporthub-rc1501-sop-tour-runtime/);
  assert.match(builder,/index\.html','TESTVERSION\.html','demo\.html'/);
});

test('RC1501 Runtime startet Touren nur über expliziten Benutzer-Start und mountet Beobachter',()=>{
  const source=read('assets/sop/rc1501-sop-tour-runtime.js');
  assert.match(source,/data-sop-tour-start/);
  assert.match(source,/ExportHubSopTourUi/);
  assert.match(source,/\.mount\(/);
  assert.match(source,/tour\.start/);
  assert.doesNotMatch(source,/\.click\(\)/,'Runtime darf Arbeitsaktionen nicht automatisch anklicken');
});
