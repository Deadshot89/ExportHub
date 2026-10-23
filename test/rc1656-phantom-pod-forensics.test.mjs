import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectPhantomPodSnapshot} from '../scripts/rc1656-phantom-pod-forensics.mjs';

const snapshot=(shipments=[],savedShipments=[])=>({state:{shipments,savedShipments}});
const record=(ref,status,extra={})=>({id:'id-'+ref,ref,status,processStatus:status,...extra});

test('RC1656: unknown POD without signed pickup is reported without leaking references',()=>{
 const doc=snapshot([record('SENSITIVE-REF','POD vorhanden',{
   podFiles:[{blobName:'restricted/real-document.pdf'}],manualPickupConfirmedAt:'2026-10-23T13:00:00Z',
   manualPickupConfirmedBy:'Warehouse admin'
 })]);
 const before=JSON.stringify(doc),report=inspectPhantomPodSnapshot(doc);
 assert.equal(report.readOnly,true);
 assert.equal(report.summary.podStatusEntries,1);
 assert.equal(report.summary.podStatusWithoutSignedPickupClaim,1);
 assert.equal(report.summary.podStatusWithManualOnlyClaim,1);
 assert.equal(report.summary.podStatusWithDurablePointersButNoSignedPickupClaim,1);
 assert.equal(report.reviewRequired,true);
 assert.ok(!JSON.stringify(report).includes('SENSITIVE-REF'));
 assert.ok(!JSON.stringify(report).includes('real-document.pdf'));
 assert.equal(JSON.stringify(doc),before,'must never mutate evidence');
});

test('RC1656: signed pickup claims are not marked as unsigned POD cases',()=>{
 const doc=snapshot([record('SIGNED-1','POD vorhanden',{
   pickupHistory:[{confirmedAt:'2026-10-23T11:02:00Z',signatureBlobName:'signed.png'}],
   podFiles:[{blobName:'real-original.pdf'}]
 })]);
 const report=inspectPhantomPodSnapshot(doc);
 assert.equal(report.summary.podStatusWithSignedPickupClaim,1);
 assert.equal(report.summary.podStatusWithoutSignedPickupClaim,0);
 assert.equal(report.reviewRequired,false);
 assert.match(report.evidenceLimit,/do NOT authenticate/);
});

test('RC1656: collection conflict is flagged without automatically downgrading historical POD',()=>{
 const old=record('SAME-REF','POD vorhanden',{
   pickupHistory:[{confirmedAt:'2026-10-23T11:02:00Z',signatureBlobName:'signed.png'}]
 });
 const newCopy=record('SAME-REF','Erstellt');
 const doc=snapshot([old],[newCopy]);
 const out=inspectPhantomPodSnapshot(doc,{includeReferences:true});
 assert.equal(out.summary.crossCollectionPodVsPrePickup,1);
 assert.equal(out.summary.podStatusWithoutSignedPickupClaim,0);
 assert.ok(out.sensitiveFindings.some(f=>f.reference==='SAME-REF'&&f.finding==='POD_VS_PREPICKUP_CROSS_COLLECTION'));
 assert.equal(doc.state.shipments[0].status,'POD vorhanden');
 assert.equal(doc.state.savedShipments[0].status,'Erstellt');
});

test('RC1656: recycled editor ID across different references is flagged',()=>{
 const doc=snapshot([record('HISTORIC','POD vorhanden',{id:'REUSED',pickupHistory:[
   {confirmedAt:'2026-10-22T08:00:00Z',signatureBlobName:'original.png'}
 ]})],[record('NEWREF','POD vorhanden',{id:'REUSED'})]);
 const out=inspectPhantomPodSnapshot(doc,{includeReferences:true});
 assert.equal(out.summary.recycledIdAcrossDifferentReferences,1);
 assert.equal(out.summary.podStatusWithoutSignedPickupClaim,1);
 assert.ok(out.sensitiveFindings.some(f=>f.finding==='ID_REUSED_WITH_DIFFERENT_REFERENCES'&&
   f.references.includes('HISTORIC')&&f.references.includes('NEWREF')));
 const hidden=inspectPhantomPodSnapshot(doc);
 assert.ok(!JSON.stringify(hidden).includes('HISTORIC'));
 assert.ok(!JSON.stringify(hidden).includes('NEWREF'));
});

test('RC1656: duplicates within the same collection require manual review',()=>{
 const doc=snapshot([record('DUP1','Erstellt'),record('DUP1','POD vorhanden')]);
 const out=inspectPhantomPodSnapshot(doc);
 assert.equal(out.summary.duplicateReferencesWithinCollection,1);
 assert.equal(out.reviewRequired,true);
});

test('RC1656: sub-shipment signed pickup is considered a claim, not a verified PDF',()=>{
 const doc=snapshot([], [record('MULTI','POD vorhanden',{subShipments:[{
   pickupHistory:[{confirmedAt:'2026-10-23T12:00:00Z',signatureBlobName:'sub.png'}],
   podFiles:[{blobName:'archive/sub.pdf'}]
 }]})]);
 const out=inspectPhantomPodSnapshot(doc);
 assert.equal(out.summary.podStatusWithSignedPickupClaim,1);
 assert.equal(out.summary.podStatusWithoutSignedPickupClaim,0);
 assert.match(out.evidenceLimit,/server pickup records/);
});

test('RC1656: standalone scan confirmation is never considered a durable original POD',()=>{
 const doc=snapshot([record('SCAN','POD vorhanden',{podFiles:[{kind:'scan-confirmation',blobName:'scan.png'}]})]);
 const out=inspectPhantomPodSnapshot(doc);
 assert.equal(out.summary.podStatusWithDurablePointersButNoSignedPickupClaim,0);
 assert.equal(out.summary.podStatusWithoutSignedPickupClaim,1);
});

test('RC1656: invalid and partial Team-State formats fail closed',()=>{
 assert.throws(()=>inspectPhantomPodSnapshot(null),/Team-State/);
 assert.throws(()=>inspectPhantomPodSnapshot({state:null}),/Team-State/);
 assert.throws(()=>inspectPhantomPodSnapshot({state:{}}),/shipment collection/);
 assert.throws(()=>inspectPhantomPodSnapshot({state:{shipments:[],savedShipments:{}}}),/collection must be an array/);
 assert.throws(()=>inspectPhantomPodSnapshot({state:{shipments:[null]}}),/Invalid shipment record/);
});

test('RC1656 CLI: default report redacts customer data and has input SHA256',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rc1656-'));
 const source=path.join(dir,'private.json');
 const script=fileURLToPath(new URL('../scripts/rc1656-phantom-pod-forensics.mjs',import.meta.url));
 try{
   fs.writeFileSync(source,JSON.stringify(snapshot([record('PRIVATE-ORDER','POD vorhanden')])));
   const result=spawnSync(process.execPath,[script,'--input',source],{encoding:'utf8'});
   assert.equal(result.status,0,result.stderr);
   const report=JSON.parse(result.stdout);
   assert.equal(report.summary.podStatusWithoutSignedPickupClaim,1);
   assert.match(report.sourceSha256,/^[a-f0-9]{64}$/);
   assert.ok(!result.stdout.includes('PRIVATE-ORDER'));
   assert.ok(!result.stdout.includes(source));
   const privateResult=spawnSync(process.execPath,[script,'--input',source,'--show-refs'],{encoding:'utf8'});
   assert.equal(privateResult.status,0,privateResult.stderr);
   assert.ok(privateResult.stdout.includes('PRIVATE-ORDER'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('RC1656 CLI: error handling cannot echo sensitive file path or JSON value',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rc1656-'));
 const source=path.join(dir,'PRIVATE-REF-token.json');
 const script=fileURLToPath(new URL('../scripts/rc1656-phantom-pod-forensics.mjs',import.meta.url));
 try{
   fs.writeFileSync(source,'{"personal":"PRIVATE-REF"');
   const result=spawnSync(process.execPath,[script,'--input',source],{encoding:'utf8'});
   assert.equal(result.status,1);
   assert.ok(!result.stderr.includes('PRIVATE-REF'));
   assert.equal(result.stdout,'');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
