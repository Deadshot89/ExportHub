import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const UI='assets/rc1546-pickup-control.js';
const API='api/manual-pickup-confirm/index.js';

function uiWithState(s){
  const root={__EXPORTHUB_GET_STATE__:()=>s};
  root.globalThis=root;
  vm.runInNewContext(fs.readFileSync(UI,'utf8'),root,{filename:UI});
  return root.ExportHUBRC1546PickupControl;
}
function apiMatch(){
  const source=fs.readFileSync(API,'utf8');
  const start=source.indexOf('function identityValues(shipment)');
  const end=source.indexOf('function shipmentCopies(',start);
  assert.ok(start>0&&end>start,'manual pickup matcher boundaries');
  const text=v=>String(v==null?'':v).trim();
  const ctx={text,upper:v=>text(v).toUpperCase(),obj:v=>!!v&&typeof v==='object'&&!Array.isArray(v)};
  return vm.runInNewContext(source.slice(start,end)+'\nsameShipment',ctx);
}
test('P0: opening Danfoss does not show stale Neff in manual pickup confirmation',()=>{
  const dan={id:'DAN-01',reference:'DANFOSS-REF',customerName:'Danfoss'};
  const neff={id:'NEFF-02',reference:'NEFF-REF',customerName:'Neff'};
  const s={shipmentViewId:'DANFOSS-REF',currentShipment:neff,shipment:neff,shipments:[neff,dan]};
  const ui=uiWithState(s);
  assert.equal(ui.currentShipment().customerName,'Danfoss');
  s.shipmentViewId='NEFF-02';
  assert.equal(ui.currentShipment().customerName,'Neff');
  s.shipmentViewId='MISSING';
  assert.equal(ui.currentShipment(),null,'never silently fall back to Neff');
});
test('P0: reused technical ID requires unique reference or refuses mutation',()=>{
  const dan={id:'REUSED',ref:'DANFOSS-REF'};
  const neff={id:'REUSED',ref:'NEFF-REF'};
  const s={shipmentViewId:'REUSED',shipments:[neff,dan],currentShipment:neff};
  const ui=uiWithState(s);
  assert.equal(ui.currentShipment(),null,'ambiguous ID must not select first row');
  s.shipmentViewRef='DANFOSS-REF';
  assert.equal(ui.currentShipment().ref,'DANFOSS-REF');
});
test('P0: manual pickup API rejects an ID match when the customer reference differs',()=>{
  const matches=apiMatch();
  const neff={id:'REUSED',reference:'NEFF-REF'};
  const dan={id:'REUSED',reference:'DANFOSS-REF'};
  assert.equal(matches(neff,'REUSED','DANFOSS-REF'),false);
  assert.equal(matches(dan,'REUSED','DANFOSS-REF'),true);
  assert.equal(matches(dan,'WRONG-ID','DANFOSS-REF'),false);
  assert.equal(matches(dan,'','DANFOSS-REF'),true);
  assert.equal(matches(dan,'REUSED',''),true);
});
test('P0: submit checks visible shipment again before persisting the pickup date',()=>{
  const ui=fs.readFileSync(UI,'utf8');
  const api=fs.readFileSync(API,'utf8');
  assert.match(ui,/if\(view\(\)==='shipmentview'\)\{var visible=currentShipment\(\)/);
  assert.match(ui,/ref\(visible\)!==ref\(sh\)\|\|sid\(visible\)!==sid\(sh\)/);
  assert.match(api,/SHIPMENT_AMBIGUOUS/);
  assert.match(api,/SHIPMENT_NOT_FOUND/);
});