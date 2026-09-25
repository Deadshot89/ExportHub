import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createTestI18n} from './helpers/i18n.mjs';

const ROOT=process.cwd();
const RUNTIME=path.join(ROOT,'assets/rc1113-stowplan-persist.js');
const BUILDER=path.join(ROOT,'.github/rc1112/build-three-env.mjs');

function api(){
  const source=fs.readFileSync(RUNTIME,'utf8');
  const window={ExportHUBI18n:createTestI18n('de'),addEventListener(){}};
  const document={readyState:'loading',addEventListener(){},getElementById(){return null}};
  const context={window,document,console,setTimeout:()=>0,clearTimeout(){},CustomEvent:function(){},requestAnimationFrame:()=>0,Date};
  vm.runInNewContext(source,context,{filename:'rc1113-stowplan-persist.js'});
  assert.ok(window.ExportHUBRC1113StowPlan,'RC1113 Stauplan-Test-API fehlt.');
  return window.ExportHUBRC1113StowPlan;
}

const sample={
  vehicleId:'container-40',
  vehicleLabel:'40-Fuß Container',
  vehicleKind:'container',
  vehicleLength:1203,
  vehicleWidth:235,
  totalUnits:3,
  totalFloorUnits:2,
  totalWeight:850,
  usedCm:240,
  freeCm:963,
  overflowCm:0,
  placements:[
    {step:1,rowNo:1,position:'Links',type:'Europalette',sourceRow:1,physicalCount:2,stackFactor:2,rotated:false,lengthAlong:120,crossWidth:80,height:150},
    {step:2,rowNo:2,position:'Mitte',type:'Karton',sourceRow:2,physicalCount:1,stackFactor:1,rotated:true,lengthAlong:80,crossWidth:120,height:60}
  ],
  rows:[
    {no:1,startCm:0,endCm:120,depth:120,fillPct:68,gapWidth:75,placements:[{step:1,rowNo:1,position:'Links',type:'Europalette',sourceRow:1,physicalCount:2,stackFactor:2,rotated:false,lengthAlong:120,crossWidth:80,height:150}]},
    {no:2,startCm:120,endCm:200,depth:80,fillPct:51,gapWidth:115,placements:[{step:2,rowNo:2,position:'Mitte',type:'Karton',sourceRow:2,physicalCount:1,stackFactor:1,rotated:true,lengthAlong:80,crossWidth:120,height:60}]}
  ]
};

test('RC1113: Stauplan-Snapshot speichert Fahrzeug, Kapazität, Reihen und Orientierung',()=>{
  const a=api(),snapshot=a.snapshotFromPlan(sample);
  assert.equal(snapshot.version,'RC1113');
  assert.equal(snapshot.vehicle.id,'container-40');
  assert.equal(snapshot.vehicle.label,'40-Fuß Container');
  assert.equal(snapshot.capacity.totalUnits,3);
  assert.equal(snapshot.capacity.overflowCm,0);
  assert.equal(snapshot.rows.length,2);
  assert.equal(snapshot.rows[0].placements[0].orientation,'längs');
  assert.equal(snapshot.rows[1].placements[0].orientation,'quer');
  assert.ok(snapshot.signature.length>20);
});

test('RC1113: Ladeanweisung folgt der tatsächlichen Beladereihenfolge und zeigt Quer/Längs',()=>{
  const a=api(),lines=a.instructionLines(sample);
  assert.equal(lines.length,2);
  assert.equal(lines[0].step,1);
  assert.match(lines[0].text,/R1.*Links.*Europalette.*längs.*120×80 cm.*2 gestapelt/);
  assert.equal(lines[1].step,2);
  assert.match(lines[1].text,/R2.*Mitte.*Karton.*quer.*80×120 cm/);
});

test('RC1113: Runtime respektiert Sperrstatus und nutzt den bestehenden Sendungs-Save',()=>{
  const source=fs.readFileSync(RUNTIME,'utf8');
  assert.match(source,/abgeholt\|picked\|pod\|abgeschlossen\|completed\|archiviert\|archived/);
  assert.match(source,/stowPlanSnapshot/);
  assert.match(source,/scheduleEditSave\('Stauplan automatisch erstellt und gespeichert'/);
  assert.match(source,/stowplan\.instructionTitle/);
  assert.match(source,/stowplan\.savedBadge/);
});

test('RC1113: RC1112-Builder lädt die Stauplan-Erweiterung in Produktion, TESTSERVICE und Demo',()=>{
  const source=fs.readFileSync(BUILDER,'utf8');
  assert.match(source,/rc1113-stowplan-persist\.js\?v=1113/);
  assert.match(source,/RC1113 Stauplan-Erweiterung fehlt/);
  assert.match(source,/stowPlanInstructionsAndPersistence:'RC1113'/);
  assert.match(source,/fs\.copyFileSync\(rc1113StowSrc,rc1113StowOut\)/,'RC1113 Runtime muss in dist-rc1112/assets kopiert werden.');
});
