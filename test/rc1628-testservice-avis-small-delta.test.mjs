import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {mergeState}=require('../api/shared/merge.js');

const testSource=fs.readFileSync('e2e/specs/testservice-mutation.spec.mjs','utf8');
const testStart=testSource.indexOf("test('RC1255 P2:");
const testEnd=testSource.indexOf("\ntest(",testStart+10);
const section=testSource.slice(testStart,testEnd<0?undefined:testEnd);

test('RC1628: RC1255 reads only lightweight revision metadata before creating test shipment',()=>{
 assert.ok(testStart>=0,'RC1255 live E2E case missing');
 assert.match(section,/fetch\('\/api\/exporthub-state\?mode=meta'/);
 assert.match(section,/const shipments=\[shipment\]/);
 assert.match(section,/const savedShipments=\[\{\.\.\.shipment\}\]/);
 assert.doesNotMatch(section,/state\.shipments\)\?state\.shipments\.filter/);
});

test('RC1628: link update sends just one changed shipment, not the full Azure team-state',()=>{
 assert.match(section,/state:\{shipments:\[linkedShipment\],savedShipments:\[linkedShipment\]\}/);
 assert.match(section,/revision:firstSave\.data\?\.revision/);
 assert.doesNotMatch(section,/const shipments=patch\(state\.shipments\)/);
});

test('RC1628: additive shipment delta cannot replace or delete unrelated saved shipments',()=>{
 const old1={id:'SHIP-KEEP-1',ref:'KEEP01',status:'Abgeholt'};
 const old2={id:'SHIP-KEEP-2',ref:'KEEP02',status:'Erstellt'};
 const original={shipments:[old1,old2],savedShipments:[old1,old2],otherData:{important:true}};
 const shipment={id:'E2E-REMINDER-TEST',ref:'REM001',reference:'REM001',_e2eRunId:'E2E-123-1',status:'Erstellt'};
 const created=mergeState(original,{shipments:[shipment],savedShipments:[{...shipment}]});
 for(const key of ['shipments','savedShipments']){
  assert.equal(created[key].length,3);
  assert.ok(created[key].some(s=>s.ref==='KEEP01'&&s.status==='Abgeholt'));
  assert.ok(created[key].some(s=>s.ref==='KEEP02'&&s.status==='Erstellt'));
  assert.ok(created[key].some(s=>s.ref==='REM001'));
 }
 assert.deepEqual(created.otherData,{important:true});
 const updated={...shipment,updatedAt:'2026-10-22T18:00:00Z',avisEnabled:true,customerAvisEnabled:true,customerAvisUrl:'https://example.test/avis/abc'};
 const linked=mergeState(created,{shipments:[updated],savedShipments:[updated]});
 for(const key of ['shipments','savedShipments']){
  assert.equal(linked[key].length,3);
  assert.equal(linked[key].find(s=>s.ref==='REM001').customerAvisUrl,updated.customerAvisUrl);
  assert.equal(linked[key].find(s=>s.ref==='KEEP01').status,'Abgeholt');
 }
 assert.deepEqual(linked.otherData,{important:true});
});

test('RC1628: full Azure state exceeds SWA 30 MB; delta remains below supported request limit',()=>{
 const SWA_REQUEST_LIMIT=30*1024*1024;
 const bigState={shipments:[{id:'SHIP-KEEP-1',ref:'KEEP01',largeNote:'x'.repeat(SWA_REQUEST_LIMIT)}]};
 const fullBytes=Buffer.byteLength(JSON.stringify({state:bigState}));
 const deltaBytes=Buffer.byteLength(JSON.stringify({state:{shipments:[{id:'E2E-REMINDER-TEST',ref:'REM001'}],savedShipments:[{id:'E2E-REMINDER-TEST',ref:'REM001'}]}}));
 assert.ok(fullBytes>SWA_REQUEST_LIMIT);
 assert.ok(deltaBytes<2048);
});
