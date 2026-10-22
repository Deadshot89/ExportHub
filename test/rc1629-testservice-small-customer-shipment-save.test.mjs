import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {mergeState}=require('../api/shared/merge.js');

const src=fs.readFileSync('e2e/specs/testservice-mutation.spec.mjs','utf8');
const start=src.indexOf("test('RC1139 P0:");
const end=src.indexOf('\ntest(',start+10);
const section=src.slice(start,end<0?undefined:end);

test('RC1629: RC1139 uses minimal revision metadata and sends no existing customer/shipment arrays',()=>{
 assert.ok(start>=0,'RC1139 live test missing');
 assert.match(section,/fetch\('\/api\/exporthub-state\?mode=meta'/);
 assert.match(section,/const customers=\[customer\]/);
 assert.match(section,/const shipments=\[shipment\]/);
 assert.match(section,/const savedShipments=\[\{\.\.\.shipment\}\]/);
 assert.doesNotMatch(section,/Array\.isArray\(state\.(?:customers|shipments|savedShipments)\)/);
 assert.match(section,/state:\{shipments,savedShipments,customers\}/);
});
test('RC1629: existing customers and shipments remain intact after additive E2E save',()=>{
 const original={
  customers:[
   {id:'CUSTOMER-KEEP',account:'3006',name:'Production-simulated customer',active:true},
   {id:'CUSTOMER-OTHER',account:'3019',name:'Second existing customer',active:true}
  ],
  shipments:[
   {id:'SHIP-KEEP',ref:'KEEP01',customerId:'CUSTOMER-KEEP',status:'Abgeholt'},
   {id:'SHIP-OTHER',ref:'KEEP02',customerId:'CUSTOMER-OTHER',status:'Erstellt'}
  ],
  savedShipments:[{id:'SHIP-KEEP',ref:'KEEP01',status:'Abgeholt'}],
  tasks:[{id:'TASK-KEEP',status:'Open'}]
 };
 const customer={id:'E2E-CUSTOMER-SAVE-E2E-RUN',account:'E2E-RUN',name:'E2E Test',_e2eRunId:'E2E-RUN'};
 const shipment={id:'E2E-SHIP-E2E-RUN',ref:'E2E162',status:'Erstellt',_e2eRunId:'E2E-RUN'};
 const incoming={customers:[customer],shipments:[shipment],savedShipments:[{...shipment}]};
 const updated=mergeState(original,incoming);
 assert.equal(updated.customers.length,3);
 assert.equal(updated.shipments.length,3);
 assert.equal(updated.savedShipments.length,2);
 assert.equal(updated.customers.find(c=>c.id==='CUSTOMER-KEEP').account,'3006');
 assert.equal(updated.shipments.find(s=>s.id==='SHIP-KEEP').status,'Abgeholt');
 assert.equal(updated.shipments.find(s=>s.id==='SHIP-OTHER').status,'Erstellt');
 assert.deepEqual(updated.tasks,original.tasks);
 assert.equal(updated.shipments.find(s=>s.id===shipment.id).ref,'E2E162');
 assert.equal(updated.customers.find(c=>c.id===customer.id).name,'E2E Test');
});
test('RC1629: representative POST body fits Azure Static Web Apps 30MB limit',()=>{
 const c={id:'E2E-CUSTOMER-SAVE-E2E-RUN',account:'E2E-RUN',name:'E2E Test'};
 const sh={id:'E2E-SHIP-E2E-RUN',ref:'E2E162',rows:[{type:'Europalette',count:1,weight:100}]};
 const post={environment:'testservice',clientVersion:'RC1145-E2E',baseRevision:100,
   deviceId:'e2e-playwright',operationId:'RC1145-E2E-RUN-E2E162',
   reason:'RC1145 browser mutation gate',
   state:{customers:[c],shipments:[sh],savedShipments:[{...sh}]}};
 assert.ok(Buffer.byteLength(JSON.stringify(post))<20*1024);
 assert.ok(Buffer.byteLength(JSON.stringify(post))<30*1024*1024);
});
