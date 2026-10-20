import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const UI='assets/rc1546-pickup-control.js';

function loadUi(){
  const source=fs.readFileSync(UI,'utf8');
  const context={console,setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){}};
  context.globalThis=context;
  vm.runInNewContext(source,context,{filename:UI});
  return context.ExportHUBRC1546PickupControl;
}

test('RC1547: ABD-gesperrte Sendungen zählen nicht in die Alters-KPIs',()=>{
  const api=loadUi();
  assert.ok(api&&typeof api.stats==='function','stats muss für die fachliche KPI-Regression testbar sein');
  const blocked={reference:'ABD001',status:'Wartet auf ABD',totalColli:1,__rc1546AgeDays:5};
  const overdue={reference:'OPEN01',status:'Bereit zur Abholung',totalColli:1,__rc1546AgeDays:5};
  const result=api.stats([blocked,overdue]);
  assert.equal(result.count,2,'ABD-Sendung bleibt in der offenen Kontrollliste sichtbar');
  assert.equal(result.colli,2,'Colli-Gesamtsumme bleibt vollständig');
  assert.equal(result.old,1,'ABD-Sendung darf nicht als alte/verpasste Abholung zählen');
  assert.equal(result.critical,1,'ABD-Sendung darf nicht als kritische/verpasste Abholung zählen');
});
