import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SOURCE_PATH=path.join(ROOT,'assets/rc1532-shipment-rework.js');
const BUILD_PATH=path.join(ROOT,'.github/rc1112/build-three-env.mjs');

function loadRuntime(){
  const source=fs.readFileSync(SOURCE_PATH,'utf8');
  const window={};
  window.window=window;
  window.addEventListener=()=>{};
  window.dispatchEvent=()=>true;
  window.setTimeout=setTimeout;
  window.clearTimeout=clearTimeout;
  const document={readyState:'complete',body:null,head:null,documentElement:null,querySelector(){return null},getElementById(){return null},createElement(){return {setAttribute(){},appendChild(){},remove(){},style:{}}}};
  const context={window,document,console,setTimeout,clearTimeout,CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},Date,Map,Set,Array,Object,String,Number,Boolean,RegExp,Math,JSON,Promise};
  vm.runInNewContext(source,context,{filename:'rc1532-shipment-rework.js'});
  assert.ok(window.ExportHUBShipmentRework1532,'RC1532 runtime export fehlt');
  return window.ExportHUBShipmentRework1532;
}

function adminUser(){return{id:'U1',name:'Admin User',role:'User',rights:{shipment:{level:'admin',visible:true,read:true,edit:true,admin:true,functionAdmin:true}}};}
function editorUser(){return{id:'U2',name:'Editor',role:'User',rights:{shipment:{level:'edit',visible:true,read:true,edit:true,admin:false,functionAdmin:false}}};}
function proofShipment(status='POD vorhanden'){
  return{
    id:'S1',reference:'ABC123',status,processStatus:status,shipmentStatus:status,
    pickedUpAt:'2026-10-14T12:30:00.000Z',pickupConfirmedAt:'2026-10-14T12:31:00.000Z',actualPickupAt:'2026-10-14T12:32:00.000Z',
    driverSignature:'data:image/png;base64,DRIVER',customsSignature:'data:image/png;base64,CUSTOMS',customsDocumentsConfirmedAt:'2026-10-14T12:33:00.000Z',
    sealNumber:'SEAL-4711',containerSealNumber:'SEAL-4711',containerPhotos:[{id:'P1',kind:'loaded'},{id:'P2',kind:'number'},{id:'P3',kind:'sealed'}],
    podDocuments:[{id:'POD-1',name:'pod.pdf'}],podUploadedAt:'2026-10-14T12:40:00.000Z',
    pickupHistory:[{id:'PU-1',confirmedAt:'2026-10-14T12:31:00.000Z',complete:true}],shipmentHistory:[]
  };
}
function proofSnapshot(sh){
  return JSON.parse(JSON.stringify({
    pickedUpAt:sh.pickedUpAt,pickupConfirmedAt:sh.pickupConfirmedAt,actualPickupAt:sh.actualPickupAt,
    driverSignature:sh.driverSignature,customsSignature:sh.customsSignature,customsDocumentsConfirmedAt:sh.customsDocumentsConfirmedAt,
    sealNumber:sh.sealNumber,containerSealNumber:sh.containerSealNumber,containerPhotos:sh.containerPhotos,
    podDocuments:sh.podDocuments,podUploadedAt:sh.podUploadedAt,pickupHistory:sh.pickupHistory
  }));
}

test('RC1532: nur Funktions-Admins oder globale Admins dürfen geschlossene Sendungen wieder öffnen',()=>{
  const api=loadRuntime();
  assert.equal(api.canReopen(adminUser()),true);
  assert.equal(api.canReopen({id:'A',role:'Global Admin',rights:{}}),true);
  assert.equal(api.canReopen(editorUser()),false);
  assert.equal(api.canReopen(null),false);
});

test('RC1532: nur Abgeholt, POD vorhanden und Abgeschlossen sind wiederöffnungsfähig',()=>{
  const api=loadRuntime();
  for(const value of ['Abgeholt','POD vorhanden','Abgeschlossen','Picked up','POD available','Completed'])assert.equal(api.reopenableStatus({status:value}),true,value);
  for(const value of ['Archiviert','Storniert','Nachbearbeitung','Bereit zur Abholung','Archived','Cancelled'])assert.equal(api.reopenableStatus({status:value}),false,value);
});

test('RC1532: Wiederöffnen setzt Nachbearbeitung, protokolliert den Admin und verändert keinen Abhol-/POD-Nachweis',()=>{
  const api=loadRuntime(),shipment=proofShipment('POD vorhanden'),before=proofSnapshot(shipment);
  const result=api.applyOpen(shipment,adminUser(),'2026-10-14T15:00:00.000Z');
  assert.equal(result,true);
  assert.equal(shipment.status,'Nachbearbeitung');
  assert.equal(shipment.processStatus,'Nachbearbeitung');
  assert.equal(shipment.shipmentStatus,'Nachbearbeitung');
  assert.equal(shipment.shipmentRework?.active,true);
  assert.equal(shipment.shipmentRework?.previous?.status,'POD vorhanden');
  assert.equal(shipment.shipmentRework?.openedBy?.id,'U1');
  assert.deepEqual(proofSnapshot(shipment),before);
  assert.ok(shipment.shipmentHistory.some(x=>x?.type==='rework-opened'&&x?.label==='Sendung zur Nachbearbeitung geöffnet'));
});

test('RC1532: erfolgreicher Abschluss stellt den vorherigen Status wieder her und lässt Abholung/POD unverändert',()=>{
  const api=loadRuntime(),shipment=proofShipment('Abgeschlossen'),before=proofSnapshot(shipment);
  assert.equal(api.applyOpen(shipment,adminUser(),'2026-10-14T15:00:00.000Z'),true);
  shipment.customerName='Korrigierter Empfänger';
  assert.equal(api.applyClose(shipment,adminUser(),'2026-10-14T15:10:00.000Z'),true);
  assert.equal(shipment.status,'Abgeschlossen');
  assert.equal(shipment.processStatus,'Abgeschlossen');
  assert.equal(shipment.shipmentStatus,'Abgeschlossen');
  assert.equal(shipment.shipmentRework?.active,false);
  assert.equal(shipment.customerName,'Korrigierter Empfänger');
  assert.deepEqual(proofSnapshot(shipment),before);
  assert.ok(shipment.shipmentHistory.some(x=>x?.type==='rework-closed'&&x?.label==='Nachbearbeitung gespeichert und geschlossen'));
});

test('RC1532: Build lädt die Nachbearbeitungs-Runtime mit eigenem Cache-Key',()=>{
  const build=fs.readFileSync(BUILD_PATH,'utf8');
  assert.match(build,/rc1532-shipment-rework\.js\?v=1532/);
  assert.match(build,/exporthub-rc1532-shipment-rework/);
});
