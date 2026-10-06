import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const Module=require('node:module');
const auditPath='api/shared/pod-integrity-audit.js';
const apiPath='api/pod-backup-reconcile/index.js';
const workflowPath='.github/workflows/rc1144-pod-backup-reconcile.yml';

function read(path){return fs.existsSync(path)?fs.readFileSync(path,'utf8'):''}
function loadAudit(){
  const original=Module._load;
  Module._load=function(request,parent,isMain){
    if(request==='@azure/storage-blob')return{BlobServiceClient:{fromConnectionString(){throw new Error('Storage darf für RC1440 Pure-Helper nicht benötigt werden')}}};
    return original.call(this,request,parent,isMain);
  };
  delete require.cache[require.resolve('../api/shared/pod-integrity-audit.js')];
  try{return require('../api/shared/pod-integrity-audit.js')}finally{Module._load=original}
}

const source=read(auditPath);
const api=read(apiPath);
const workflow=read(workflowPath);

test('RC1440: POD vorhanden requires a real readable stored file, not metadata alone',()=>{
  assert.ok(source,'POD integrity audit module is missing');
  assert.match(source,/async function verifyShipmentPod\(/);
  assert.match(source,/await store\.readBuffer\(/);
  assert.match(source,/looksLikePodBuffer\(/);
});

test('RC1440: Essentra detection follows customer name and preserves POD metadata on downgrade',()=>{
  assert.ok(source,'POD integrity audit module is missing');
  const mod=loadAudit();
  assert.equal(mod.isEssentraShipment({customerName:'Essentra Components AB - SE'},{}),true);
  assert.equal(mod.isEssentraShipment({customerName:'Omni Ray AG'},{}),false);
  const sh={status:'POD vorhanden',processStatus:'POD vorhanden',podFiles:[{id:'x'}],podAvailable:true,podConfirmed:true};
  const out=mod.applyBrokenPodPolicy(sh,true);
  assert.equal(out.status,'Abgeholt');
  assert.equal(out.processStatus,'Abgeholt');
  assert.deepEqual(out.podFiles,[{id:'x'}]);
  assert.equal(out.podAvailable,true);
  assert.equal(out.podConfirmed,true);
});

test('RC1440: non-Essentra broken POD is removed and shipment returns to Abgeholt',()=>{
  assert.ok(source,'POD integrity audit module is missing');
  const mod=loadAudit();
  const sh={status:'POD vorhanden',processStatus:'POD vorhanden',podFiles:[{id:'x'}],podAvailable:true,podConfirmed:true,hasPod:true,podStatus:'POD vorhanden'};
  const out=mod.applyBrokenPodPolicy(sh,false);
  assert.equal(out.status,'Abgeholt');
  assert.equal(out.processStatus,'Abgeholt');
  assert.deepEqual(out.podFiles,[]);
  assert.equal(out.podAvailable,false);
  assert.equal(out.podConfirmed,false);
  assert.equal(out.hasPod,false);
  assert.equal(out.podStatus,'POD fehlt');
});

test('RC1440: every mutating audit batch writes and reads back a verified state backup first',()=>{
  assert.match(source,/async function createVerifiedStateBackup\(/);
  assert.match(source,/sha256/);
  assert.match(source,/await store\.readBuffer\(/);
  const backupPos=source.indexOf('await createVerifiedStateBackup(');
  const writePos=source.indexOf('await store.writeJson(');
  assert.ok(backupPos>=0&&writePos>backupPos,'verified state backup must precede team-state write');
});

test('RC1440: reconcile API exposes OIDC-protected audit-only mode',()=>{
  assert.match(api,/auditPodStatus/);
  assert.match(api,/auditOnly/);
  assert.match(api,/podIntegrityAudit\.auditPodStatuses/);
});

test('RC1440: production reconcile is no longer hardcoded to XG4YNN and runs full integrity audit after deploy plus daily',()=>{
  assert.doesNotMatch(workflow,/TARGET_REFERENCE:[^\n]*XG4YNN/);
  assert.match(workflow,/POD-Status-Integritaet PRODUCTION/);
  assert.match(workflow,/auditPodStatus:true/);
  assert.match(workflow,/17 2 \* \* \*/);
});
