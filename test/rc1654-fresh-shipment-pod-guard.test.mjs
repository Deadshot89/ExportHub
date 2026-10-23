import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {mergeState}=require('../api/shared/merge.js');

const newShipment=(ref, extra={})=>({
 id:'NEW-'+ref,ref,reference:ref,status:'POD vorhanden',processStatus:'POD vorhanden',
 customerName:'Internal test customer',rows:[{count:2}],createdAt:'2026-10-23T13:00:00Z',
 ...extra
});
function find(state,collection,ref){return state[collection].find(sh=>sh.ref===ref)}

test('P0: unknown new shipment without pickup stays Erstellt, never POD vorhanden',()=>{
 const incoming={shipments:[newShipment('ZZ0001',{podAvailable:true,podConfirmed:true})]};
 const original=JSON.stringify(incoming);
 const merged=mergeState({shipments:[],savedShipments:[]},incoming);
 const sh=find(merged,'shipments','ZZ0001');
 assert.equal(sh.status,'Erstellt');
 assert.equal(sh.processStatus,'Erstellt');
 assert.equal(sh.shipmentStatus,'Erstellt');
 assert.equal(sh.podAvailable,false);
 assert.equal(sh.podConfirmed,false);
 assert.equal(sh.podStatusCorrection,'FRESH_POD_WITHOUT_PICKUP_EVIDENCE');
 assert.equal(JSON.stringify(incoming),original,'do not mutate incoming browser copy');
});

test('P0: incoming savedShipments and shipments both enforce fresh status',()=>{
 const merged=mergeState({},{
  shipments:[newShipment('ZZ0002')],
  savedShipments:[newShipment('ZZ0002',{status:'Erstellt',processStatus:'POD vorhanden'})]
 });
 assert.equal(find(merged,'shipments','ZZ0002').status,'Erstellt');
 assert.equal(find(merged,'savedShipments','ZZ0002').processStatus,'Erstellt');
});

test('P0: unverified POD metadata stays quarantined for forensic review, not active',()=>{
 const pdf={id:'original-ref',blobName:'archive/immutable-original.pdf'};
 const sh=find(mergeState({}, {shipments:[newShipment('ZZ0003',{podFiles:[pdf]})]}),'shipments','ZZ0003');
 assert.equal(sh.status,'Erstellt');
 assert.equal(sh.podReviewRequired,true);
 assert.equal(sh.podReviewReason,'POD_WITHOUT_PICKUP_EVIDENCE');
 assert.deepEqual(sh.podFiles,[pdf],'never delete original file references');
});

test('P0: existing historical POD is not rewritten or downgraded',()=>{
 const stored=newShipment('ZZ0004',{podFiles:[{id:'old',blobName:'old.pdf'}]});
 const incoming=newShipment('ZZ0004',{updatedAt:'2026-10-23T13:01:00Z'});
 const merged=mergeState({shipments:[stored]}, {shipments:[incoming]});
 assert.equal(find(merged,'shipments','ZZ0004').status,'POD vorhanden');
});

test('P0: a persisted reference in a different collection is not wrongly treated as new',()=>{
 const old=newShipment('ZZ0005');
 const merged=mergeState({shipments:[old]}, {savedShipments:[newShipment('ZZ0005')]});
 assert.equal(find(merged,'savedShipments','ZZ0005').status,'POD vorhanden');
});

test('P0: true pickup record with stored signature retains valid POD status',()=>{
 const record=newShipment('ZZ0006',{pickupHistory:[{confirmedAt:'2026-10-23T11:02:00Z',signatureBlobName:'proof.png'}],
  podFiles:[{id:'pod',blobName:'immutable.pdf'}]});
 const merged=mergeState({}, {shipments:[record]});
 assert.equal(find(merged,'shipments','ZZ0006').status,'POD vorhanden');
});

test('P0: a regular new order without POD status is unaffected',()=>{
 const record=newShipment('ZZ0007',{status:'Entwurf',processStatus:'Entwurf',podFiles:[]});
 assert.equal(find(mergeState({}, {shipments:[record]}),'shipments','ZZ0007').status,'Entwurf');
});

test('P0: fresh shipment helper clears processStatus, pickup and POD evidence from previous editor',()=>{
 const src=fs.readFileSync('scripts/rc1470-new-shipment-clean-slate-hotfix.mjs','utf8');
 const anchor=src.indexOf('var rc1470FreshDefaults={');
 assert.ok(anchor>=0,'fresh initialization must define explicit clean defaults');
 const end=src.indexOf('};Object.assign(sh,rc1470FreshDefaults)',anchor);
 assert.ok(end>anchor,'fresh defaults must be applied to the new record');
 const defaults=src.slice(anchor,end);
 const mustClear=[
  "status:'Entwurf'","processStatus:'Entwurf'","shipmentStatus:'Entwurf'",
  'podFiles:[]','podBackup:{}','podAvailable:false','podConfirmed:false','hasPod:false',
  'pickupHistory:[]','pickupToken:\'\'','pickupAccessKeyHash:\'\'',
  'pickupConfirmed:false','qrPickupConfirmed:false','pickupQrUsed:false',
  'actualPickupDate:\'\'','signatureAvailable:false','subShipments:[]','driverSignature:\'\'',
  'podReviewRequired:false'
 ];
 for(const v of mustClear)assert.ok(defaults.includes(v),'fresh default missing '+v);
});

test('P0: a second stale POD browser write cannot re-promote a freshly corrected shipment',()=>{
 const first=mergeState({}, {shipments:[newShipment('ZZ0008',{podFiles:[{id:'stale',blobName:'original.pdf'}]})]});
 const second=mergeState(first, {shipments:[newShipment('ZZ0008',{updatedAt:'2026-10-23T14:05:00Z',
  podAvailable:true,podReviewRequired:false})]});
 const sh=find(second,'shipments','ZZ0008');
 assert.equal(sh.status,'Erstellt');
 assert.equal(sh.processStatus,'Erstellt');
 assert.equal(sh.podAvailable,false);
 assert.equal(sh.podReviewRequired,true);
 assert.equal(sh.podStatusCorrection,'FRESH_POD_WITHOUT_PICKUP_EVIDENCE');
});

test('P0: quarantined fresh shipment may normally progress to Bereit zur Abholung',()=>{
 const first=mergeState({}, {shipments:[newShipment('ZZ0009')]});
 const next=mergeState(first, {shipments:[newShipment('ZZ0009',{status:'Bereit zur Abholung',
  processStatus:'Bereit zur Abholung',updatedAt:'2026-10-23T14:10:00Z',readyForPickup:true})]});
 const sh=find(next,'shipments','ZZ0009');
 assert.equal(sh.status,'Bereit zur Abholung');
 assert.equal(sh.processStatus,'Bereit zur Abholung');
});

test('P0: an Erstellt shipment cannot be promoted to POD by a later browser save',()=>{
 const first={shipments:[{id:'NEW-LATE1',ref:'LATE01',status:'Erstellt',processStatus:'Erstellt',
   updatedAt:'2026-10-23T13:00:00Z',podFiles:[]}]};
 const incoming={shipments:[{id:'NEW-LATE1',ref:'LATE01',status:'POD vorhanden',
   processStatus:'POD vorhanden',updatedAt:'2026-10-23T13:01:00Z',
   podAvailable:true,podConfirmed:true,podFiles:[{id:'unverified',blobName:'retain.pdf'}]}]};
 const merged=mergeState(first,incoming),sh=find(merged,'shipments','LATE01');
 assert.equal(sh.status,'Erstellt');
 assert.equal(sh.processStatus,'Erstellt');
 assert.equal(sh.podAvailable,false);
 assert.equal(sh.podConfirmed,false);
 assert.equal(sh.podReviewRequired,true);
 assert.equal(sh.podStatusCorrection,'FRESH_POD_WITHOUT_PICKUP_EVIDENCE');
 assert.equal(sh.podFiles[0].blobName,'retain.pdf','unverified file references remain for evidence');
});

test('P0: Bereit zur Abholung is protected against an unsigned follow-up POD status',()=>{
 const first={savedShipments:[{id:'NEW-LATE2',ref:'LATE02',
   status:'Bereit zur Abholung',processStatus:'Bereit zur Abholung',
   updatedAt:'2026-10-23T13:00:00Z'}]};
 const incoming={savedShipments:[{id:'NEW-LATE2',ref:'LATE02',status:'POD vorhanden',
  processStatus:'POD vorhanden',updatedAt:'2026-10-23T13:01:00Z'}]};
 const sh=find(mergeState(first,incoming),'savedShipments','LATE02');
 assert.equal(sh.status,'Bereit zur Abholung');
 assert.equal(sh.processStatus,'Bereit zur Abholung');
});

test('P0: confirmed signed pickup may legitimately promote a new saved shipment to POD',()=>{
 const first={shipments:[{id:'NEW-LATE3',ref:'LATE03',status:'Erstellt',
  processStatus:'Erstellt',updatedAt:'2026-10-23T13:00:00Z'}]};
 const incoming={shipments:[{id:'NEW-LATE3',ref:'LATE03',status:'POD vorhanden',
  processStatus:'POD vorhanden',updatedAt:'2026-10-23T13:01:00Z',
  pickupHistory:[{confirmedAt:'2026-10-23T13:00:30Z',signatureBlobName:'original-signature.png'}],
  podFiles:[{id:'original-pod',blobName:'original-pod.pdf'}]}]};
 const sh=find(mergeState(first,incoming),'shipments','LATE03');
 assert.equal(sh.status,'POD vorhanden');
 assert.equal(sh.podFiles[0].blobName,'original-pod.pdf');
});

test('P0: existing historic POD without confirmation is not mass-downgraded on unrelated save',()=>{
 const first={shipments:[{id:'HIST-1',ref:'HIST01',status:'POD vorhanden',
  processStatus:'POD vorhanden',podFiles:[{id:'old-file',blobName:'immutable-historic.pdf'}]}]};
 const incoming={shipments:[{id:'HIST-1',ref:'HIST01',status:'POD vorhanden',
  processStatus:'POD vorhanden',updatedAt:'2026-10-23T13:02:00Z'}]};
 const sh=find(mergeState(first,incoming),'shipments','HIST01');
 assert.equal(sh.status,'POD vorhanden');
 assert.equal(sh.podFiles[0].blobName,'immutable-historic.pdf');
});
