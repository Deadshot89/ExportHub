import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SOURCE=path.join(ROOT,'assets/rc1534-shipment-repair-access.js');
const BUILD=path.join(ROOT,'.github/rc1506/build-three-env.mjs');

function loadRuntime(){
  const source=fs.readFileSync(SOURCE,'utf8');
  const calls=[];
  const window={
    addEventListener(){},dispatchEvent(){return true;},setTimeout,clearTimeout,
    __EXPORTHUB_OPEN_SHIPMENT_REPAIR__(value,reason){calls.push({value,reason});return true;},
    ExportHUBI18n:{t(key){return key;}}
  };
  window.window=window;
  const document={readyState:'complete',body:null,querySelectorAll(){return[]},getElementById(){return null},addEventListener(){},createElement(){return{dataset:{},classList:{add(){}},setAttribute(){},remove(){}}}};
  const context={window,document,console,setTimeout,clearTimeout,Date,Array,Object,String,Number,Boolean,RegExp,Math,JSON,Promise};
  vm.runInNewContext(source,context,{filename:'rc1534-shipment-repair-access.js'});
  assert.ok(window.ExportHUBShipmentRepairAccess1534,'RC1534 runtime export fehlt');
  return {api:window.ExportHUBShipmentRepairAccess1534,calls};
}

function functionAdmin(){return{id:'F1',role:'User',rights:{shipment:{level:'admin',edit:true,admin:true,functionAdmin:true}}};}
function editor(){return{id:'E1',role:'User',rights:{shipment:{level:'edit',edit:true,admin:false,functionAdmin:false}}};}

test('RC1534: Funktions-Admin und globaler Admin dürfen Datenreparatur starten',()=>{
  const {api}=loadRuntime();
  assert.equal(api.canRepair(functionAdmin()),true);
  assert.equal(api.canRepair({id:'G1',role:'Global Admin',rights:{}}),true);
  assert.equal(api.canRepair(editor()),false);
  assert.equal(api.canRepair(null),false);
});

test('RC1534: nur Abgeholt, POD vorhanden und Abgeschlossen sind reparierbar; Archiviert und Storniert bleiben gesperrt',()=>{
  const {api}=loadRuntime();
  for(const status of ['Abgeholt','POD vorhanden','Abgeschlossen','Picked up','POD available','Completed'])assert.equal(api.repairable({status}),true,status);
  for(const status of ['Archiviert','Storniert','Archived','Cancelled','Bereit zur Abholung','Nachbearbeitung'])assert.equal(api.repairable({status}),false,status);
});

test('RC1534: Öffnen verwendet ausschließlich den vorhandenen RC1533-Reparaturpfad und verlangt keinen Pflichtgrund',()=>{
  const {api,calls}=loadRuntime();
  const sh={id:'S1',reference:'ABC123',status:'POD vorhanden'};
  assert.equal(api.openRepair(sh,functionAdmin()),true);
  assert.deepEqual(calls,[{value:'S1',reason:''}]);
  const source=fs.readFileSync(SOURCE,'utf8');
  assert.doesNotMatch(source,/\bprompt\s*\(/);
  assert.doesNotMatch(source,/clearPickupFields\s*\(/);
  assert.doesNotMatch(source,/reactivateQr\s*\(/);
});

test('RC1534: RC1533 bleibt der einzige Evidenz-/Azure-Save-Pfad',()=>{
  const source=fs.readFileSync(SOURCE,'utf8');
  assert.match(source,/__EXPORTHUB_OPEN_SHIPMENT_REPAIR__/);
  assert.doesNotMatch(source,/queueSave|flushSave|persistenceSave|driverSignature|customsSignature|podDocuments|containerPhotos/);
});

test('RC1534: aktuelle Drei-Umgebungen-Buildkette lädt den Access-Patch additiv',()=>{
  const build=fs.readFileSync(BUILD,'utf8');
  assert.match(build,/integrateShipmentRepairAccess/);
  assert.match(build,/rc1534\/build-three-env\.mjs/);
});
