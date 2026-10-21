import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {profileTeamState,runCli} from '../scripts/rc1613-state-startup-size-audit.mjs';

test('RC1613: attributes startup state by known groups without customer details',()=>{
 const customer='PRIVATE_CUSTOMER_A',reference='SENSITIVE_REF_22';
 const doc={revision:7,state:{
   shipments:[{reference,customerName:customer,document:'data:application/pdf;base64,'+'A'.repeat(125_000)}],
   savedShipments:[{reference}],
   customers:[{name:customer}],
   tasks:[{description:'DO NOT PRINT'}],
   thirdPartySecret:{path:'PRIVATE_PATH',value:'private'}
 }};
 const before=JSON.stringify(doc),report=profileTeamState(doc),encoded=JSON.stringify(report);
 assert.equal(report.sections.shipments.entries,1);
 assert.equal(report.sections.shipments.inlineDataUrlCount,1);
 assert.ok(report.sections.shipments.inlineDataUrlBytes>125_000);
 assert.equal(report.sections.savedShipments.entries,1);
 assert.equal(report.sections.other.entries,1);
 assert.ok(report.stateSerializedBytes>125_000);
 for(const secret of [customer,reference,'PRIVATE_PATH','DO NOT PRINT','thirdPartySecret']){
   assert.equal(encoded.includes(secret),false);
 }
 assert.equal(JSON.stringify(doc),before);
});
test('RC1613: counts large and huge values in their owning collection',()=>{
 const report=profileTeamState({state:{shipments:[{blob:'Z'.repeat(1_000_001)}],savedShipments:[]}});
 assert.equal(report.sections.shipments.largeStringCount,1);
 assert.equal(report.sections.shipments.hugeStringCount,1);
 assert.equal(report.sections.shipments.inlineDataUrlCount,0);
});
test('RC1613: other categories are aggregated, never named',()=>{
 const report=profileTeamState({shipments:[],secrets:{p:'x'},supplierConfidential:[{id:1}]});
 assert.equal(report.sections.other.entries,2);
 assert.deepEqual(Object.keys(report.sections).sort(),['abdRequests','customers','other','savedShipments','shipments','tasks'].sort());
});
test('RC1613: malformed or absent shipment arrays fail closed',()=>{
 for(const doc of [null,[],{state:null},{state:{shipments:{}}},{state:{}},{state:[]}])
   assert.throws(()=>profileTeamState(doc),/INVALID_TEAM_STATE/);
});
test('RC1613: CLI only accepts protected local snapshots and redacts errors',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rc1613-'));
 try{
   const p=path.join(dir,'SECRET_CUSTOMER.json');
   fs.writeFileSync(p,JSON.stringify({state:{shipments:[{ref:'PRIVATE'}]}}));
   let out='',error='';
   const oldOut=process.stdout.write,oldErr=process.stderr.write;
   process.stdout.write=function(s){out+=String(s);return true};
   process.stderr.write=function(s){error+=String(s);return true};
   try{
     assert.equal(runCli(['--input',p]),0);
     fs.writeFileSync(p,'{"PRIVATE_SECRET":');
     assert.equal(runCli(['--input',p]),1);
   }finally{process.stdout.write=oldOut;process.stderr.write=oldErr}
   assert.ok(out.includes('"sourceSha256"'));
   assert.ok(!out.includes('PRIVATE'));
   assert.ok(!error.includes('SECRET_CUSTOMER'));
   assert.ok(!error.includes('PRIVATE_SECRET'));
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('RC1613: profile is read-only and does not access storage, network or user-supplied keys',()=>{
 const doc={state:{shipments:[{secret:'data:image/png;base64,AAAA'}]}};
 const original=JSON.stringify(doc);
 const report=profileTeamState(doc);
 assert.equal(report.readOnly,true);
 assert.equal(JSON.stringify(doc),original);
 const source=fs.readFileSync('scripts/rc1613-state-startup-size-audit.mjs','utf8');
 assert.doesNotMatch(source,/\bfetch\s*\(|https?:\/\/|azure-storage|\.upload\s*\(/i);
});
