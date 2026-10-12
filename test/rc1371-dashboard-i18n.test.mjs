import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync(new URL('../assets/rc1371-dashboard-personalization.js',import.meta.url),'utf8');
const packPath=new URL('../assets/i18n/rc1371-dashboard-personalization.js',import.meta.url);
const packSource=fs.existsSync(packPath)?fs.readFileSync(packPath,'utf8'):'';
const required=[
  'dashboard.personalize.edit','dashboard.personalize.done','dashboard.personalize.addWidget','dashboard.personalize.hideWidget',
  'dashboard.personalize.moveUp','dashboard.personalize.moveDown','dashboard.personalize.size','dashboard.personalize.sizeS','dashboard.personalize.sizeM','dashboard.personalize.sizeL','dashboard.personalize.sizeXL',
  'dashboard.personalize.restoreStandard','dashboard.personalize.searchWidgets','dashboard.personalize.template','dashboard.personalize.templateStandard','dashboard.personalize.templateManagement','dashboard.personalize.templateOperative','dashboard.personalize.templateCompact','dashboard.personalize.templateAnalysis',
  'dashboard.personalize.category.kpis','dashboard.personalize.category.productivity','dashboard.personalize.category.shipping','dashboard.personalize.category.orders','dashboard.personalize.category.warehouse','dashboard.personalize.category.stock','dashboard.personalize.category.employees','dashboard.personalize.category.quality','dashboard.personalize.category.dates','dashboard.personalize.category.warnings','dashboard.personalize.category.analyses','dashboard.personalize.category.charts','dashboard.personalize.category.quickAccess',
  'dashboard.personalize.status.critical','dashboard.personalize.status.attention','dashboard.personalize.status.watch','dashboard.personalize.status.onTarget','dashboard.personalize.status.info',
  'dashboard.personalize.quick.shipment','dashboard.personalize.quick.shipmentoverview','dashboard.personalize.quick.tasks','dashboard.personalize.quick.notifications','dashboard.personalize.quick.sop','dashboard.personalize.quick.abd'
];

function loadPack(){
  const root={};root.window=root;
  vm.runInNewContext(packSource,{window:root,globalThis:root,Object,String,Array,RegExp},{filename:'rc1371-dashboard-personalization-i18n.js'});
  return root.ExportHUBDashboard1371I18n;
}

test('RC1371 I18n-Pack enthält alle sechs Sprachen',()=>{
  const api=loadPack();
  assert.ok(api,'RC1371 I18n Pack fehlt');
  assert.deepEqual(Array.from(api.supported),['de','en','pl','es','fr','it']);
});

test('RC1371 alle kanonischen Dashboard-Keys existieren in allen Sprachen',()=>{
  const api=loadPack();
  assert.ok(api);
  for(const lang of api.supported){
    for(const key of required){
      const value=api.packs[lang][key];
      assert.equal(typeof value,'string',lang+' fehlt '+key);
      assert.ok(value.trim().length>0,lang+' leer '+key);
    }
  }
});

test('RC1371 Runtime verwendet Übersetzungsfunktion statt deutscher UI-Hardcodes',()=>{
  assert.match(runtime,/function tr\s*\(/);
  assert.match(runtime,/ExportHUBDashboard1371I18n/);
  for(const german of ['Dashboard bearbeiten','Kachel hinzufügen','Standard wiederherstellen'])assert.doesNotMatch(runtime,new RegExp(german));
});
