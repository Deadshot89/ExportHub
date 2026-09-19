import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync('assets/rc1176-shipment-location.js','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const e2e=fs.readFileSync('e2e/specs/shipment-create.spec.mjs','utf8');

test('RC1176: Standortwechsel wird im Capture-Pfad vor dem bestehenden Render in den aktiven Entwurf geschrieben',()=>{
  const listeners={};let later=null;
  const shipment={customerId:'C1'};
  const state={shipment,customers:[{id:'C1',name:'Testkunde',locations:[{
    id:'L1',name:'Werk 1',address:'Teststraße 1, 00000 Teststadt',country:'DE'
  }]}]};
  const select={id:'index289LocationSelect',value:'L1'};
  const document={
    addEventListener(name,fn,capture){listeners[name]={fn,capture}},
    getElementById(id){return id==='index289LocationSelect'?select:null}
  };
  const window={
    document,
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_ACTIVE_SHIPMENT__:()=>shipment,
    setTimeout(fn){later=fn;return 1}
  };
  vm.runInNewContext(source,{window,document,setTimeout:window.setTimeout,String,Array,Object,JSON,console});
  assert.equal(listeners.change.capture,true);
  listeners.change.fn({target:select});
  assert.equal(shipment.locationId,'L1');
  assert.equal(shipment.selectedLocationId,'L1');
  assert.equal(shipment.siteId,'L1');
  assert.equal(shipment.destinationId,'L1');
  assert.equal(shipment.recipientAddress,'Teststraße 1, 00000 Teststadt');
  assert.equal(shipment.deliveryAddress,'Teststraße 1, 00000 Teststadt');
  assert.equal(shipment.locationName,'Werk 1');
  assert.equal(typeof later,'function');
  later();
  assert.equal(select.value,'L1');
});

test('RC1176: unbekannte oder leere Standortwerte werden nicht künstlich in den Entwurf geschrieben',()=>{
  const shipment={customerId:'C1'};
  const state={shipment,customers:[{id:'C1',locations:[{id:'L1',address:'A'}]}]};
  const document={addEventListener(){},getElementById(){return null}};
  const window={document,__EXPORTHUB_GET_STATE__:()=>state,__EXPORTHUB_GET_ACTIVE_SHIPMENT__:()=>shipment,setTimeout(){return 1}};
  vm.runInNewContext(source,{window,document,setTimeout:window.setTimeout,String,Array,Object,JSON,console});
  assert.equal(window.ExportHUBShipmentLocation1176.applyLocation(''),false);
  assert.equal(window.ExportHUBShipmentLocation1176.applyLocation('UNKNOWN'),false);
  assert.equal(shipment.locationId,undefined);
});

test('RC1176: Runtime wird in Produktion TESTSERVICE und Demo mitgebaut',()=>{
  assert.match(builder,/exporthub-rc1176-shipment-location/);
  assert.match(builder,/assets\/rc1176-shipment-location\.js\?v=1176/);
  assert.match(builder,/'assets\/rc1176-shipment-location\.js'/);
  assert.match(builder,/shipmentLocationPersistence:'RC1176/);
});

test('RC1176: Live-E2E verlangt stabile Dropdown-Auswahl, aktiven State und entfernte Standortwarnung',()=>{
  assert.match(e2e,/toHaveValue\(customer\.locationId/);
  assert.match(e2e,/__EXPORTHUB_GET_ACTIVE_SHIPMENT__/);
  assert.match(e2e,/sh\.locationId\|\|sh\.selectedLocationId\|\|sh\.siteId\|\|sh\.destinationId/);
  assert.match(e2e,/Standort fehlt\|Adresse fehlt/);
});

test('RC1176: Runtime, Build und E2E bleiben syntaktisch gültig',()=>{
  for(const file of ['assets/rc1176-shipment-location.js','.github/rc1112/build-three-env.mjs','e2e/specs/shipment-create.spec.mjs']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});
