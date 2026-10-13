import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtimePath='assets/rc1521-shipment-reopen.js';
const buildPath='.github/rc1112/build-three-env.mjs';

function source(){
  assert.equal(fs.existsSync(runtimePath),true,'RC1521 Runtime fehlt');
  return fs.readFileSync(runtimePath,'utf8');
}

function createRuntime(){
  const shipment={
    id:'S1',ref:'ABC123',status:'Abgeholt',processStatus:'Abgeholt',
    pickedUpAt:'2026-10-13T12:00:00.000Z',pickupConfirmedAt:'2026-10-13T12:00:00.000Z',
    podFiles:[{id:'P1',name:'POD_ABC123.pdf'}],
    driverSignature:'signed-driver',customsSignature:'signed-customs',
    shipmentHistory:[]
  };
  const saved={...shipment,podFiles:[...shipment.podFiles],shipmentHistory:[]};
  const state={
    view:'shipmentview',shipmentViewId:'S1',
    shipments:[shipment],savedShipments:[saved],
    currentUser:{id:'U1',name:'Tobias',role:'Globaler Administrator'}
  };
  let queued=0,flushed=0;
  const document={
    readyState:'loading',body:null,
    addEventListener(){},querySelector(){return null},getElementById(){return null}
  };
  const window={
    document,
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_CURRENT_USER__:()=>state.currentUser,
    ExportHUBI18n:{t(key){return key==='common.open'?'Öffnen':key==='status.rework'?'Nachbearbeitung':key}},
    ExportHUBClean:{state,queueSave(){queued++;return true},flushSave(){flushed++;return Promise.resolve(true)}},
    addEventListener(){},dispatchEvent(){},confirm(){return true},console
  };
  const context={window,document,console,Date,Promise,Array,Object,String,Number,Set,Map,CustomEvent:function(){},setTimeout(){return 1},clearTimeout(){}};
  vm.runInNewContext(source(),context,{filename:runtimePath});
  return{api:window.ExportHUBShipmentReopen1521,state,shipment,saved,stats:()=>({queued,flushed})};
}

function pickupEvidence(sh){
  return JSON.stringify({
    pickedUpAt:sh.pickedUpAt,
    pickupConfirmedAt:sh.pickupConfirmedAt,
    podFiles:sh.podFiles,
    driverSignature:sh.driverSignature,
    customsSignature:sh.customsSignature
  });
}

test('RC1521: abgeholte Sendung wird als Nachbearbeitung wieder geöffnet, ohne Abhol- oder POD-Nachweise zu verändern',async()=>{
  const {api,shipment,saved,stats}=createRuntime();
  const before=pickupEvidence(shipment);
  const result=await api.reopen(shipment);
  assert.equal(result,true);
  for(const sh of [shipment,saved]){
    assert.equal(sh.status,'Nachbearbeitung');
    assert.equal(sh.processStatus,'Nachbearbeitung');
    assert.ok(sh.reworkOpenedAt,'Zeitstempel der Wiederöffnung fehlt');
    assert.equal(pickupEvidence(sh),before,'Abhol-/POD-Nachweis wurde verändert');
  }
  assert.deepEqual(stats(),{queued:1,flushed:1});
});

test('RC1521: Wiederöffnung bleibt auf fachlich abgeholte Sendungen begrenzt',()=>{
  const {api}=createRuntime();
  assert.equal(api.eligible({status:'Erstellt'}),false);
  assert.equal(api.eligible({status:'Storniert',pickedUpAt:'2026-10-13T12:00:00Z'}),false);
  assert.equal(api.eligible({status:'Archiviert',pickedUpAt:'2026-10-13T12:00:00Z'}),false);
  assert.equal(api.eligible({status:'Abgeholt',pickedUpAt:'2026-10-13T12:00:00Z'}),true);
  assert.equal(api.eligible({status:'POD vorhanden',pickupConfirmedAt:'2026-10-13T12:00:00Z'}),true);
  assert.equal(api.eligible({status:'Abgeschlossen',pickedUpAt:'2026-10-13T12:00:00Z'}),true);
});

test('RC1521: finale Builds laden die Wiederöffnungs-Runtime in Produktion, TESTSERVICE und Demo',()=>{
  const build=fs.readFileSync(buildPath,'utf8');
  assert.match(build,/RC1521_SHIPMENT_REOPEN_TAG/);
  assert.match(build,/assets\/rc1521-shipment-reopen\.js\?v=1521/);
  assert.match(build,/html=patchRc1521ShipmentReopen\(html,file\)/);
});
