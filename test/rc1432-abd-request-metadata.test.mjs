import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1074-login-clean.js','utf8');

function load(){
  const document={readyState:'loading',addEventListener(){},createComment(){return{nodeType:8,parentNode:null}}};
  const window={document,addEventListener(){},setTimeout(){return 1},clearTimeout(){},console};
  vm.runInContext(runtime,vm.createContext({window,document,console,MutationObserver:function(){}}));
  return window.ExportHUBRC1109AbdDashboardCustomer;
}

test('RC1432: alte ABD-Anfrage übernimmt Sendungslink, Kundenname, Colli und Gewicht aus der verknüpften ABD-Aufgabe',()=>{
  const api=load();
  const state={
    abdRequests:[{id:'A1',ref:'ZLTYQB',status:'Erledigt'}],
    tasks:[{id:'T1',sourceType:'abd',sourceId:'A1',sourceRef:'ZLTYQB',linkedShipmentId:'S1',linkedShipmentRef:'SHIP01'}],
    shipments:[{id:'S1',ref:'SHIP01',customerName:'Musterkunde GmbH',customerNumber:'4711',totalColli:4,totalWeight:812.5}],
    customers:[]
  };
  const result=api.enrichRequests(state);
  const request=state.abdRequests[0];
  assert.equal(result.changed,true);
  assert.equal(request.linkedShipmentId,'S1');
  assert.equal(request.linkedShipmentRef,'SHIP01');
  assert.equal(request.customerName,'Musterkunde GmbH');
  assert.equal(request.customerNumber,'4711');
  assert.equal(request.totalColli,4);
  assert.equal(request.totalWeight,812.5);
  assert.equal(api.resolveColli(state,request),4);
  assert.equal(api.resolveWeight(state,request),812.5);
});

test('RC1432: vorhandene ABD-Metadaten werden nicht durch Backfill überschrieben',()=>{
  const api=load();
  const state={
    abdRequests:[{id:'A1',ref:'ZLTYQB',linkedShipmentId:'S1',linkedShipmentRef:'SHIP01',customerName:'Bestehender Kunde',customerNumber:'9999',totalColli:7,totalWeight:900}],
    tasks:[{id:'T1',sourceType:'abd',sourceId:'A1',sourceRef:'ZLTYQB',linkedShipmentId:'S2',linkedShipmentRef:'SHIP02'}],
    shipments:[{id:'S1',ref:'SHIP01',customerName:'Anderer Name',customerNumber:'4711',totalColli:4,totalWeight:812.5},{id:'S2',ref:'SHIP02',customerName:'Falsche Sendung',customerNumber:'2222',totalColli:2,totalWeight:100}],
    customers:[]
  };
  api.enrichRequests(state);
  const request=state.abdRequests[0];
  assert.equal(request.linkedShipmentId,'S1');
  assert.equal(request.linkedShipmentRef,'SHIP01');
  assert.equal(request.customerName,'Bestehender Kunde');
  assert.equal(request.customerNumber,'9999');
  assert.equal(request.totalColli,7);
  assert.equal(request.totalWeight,900);
});
