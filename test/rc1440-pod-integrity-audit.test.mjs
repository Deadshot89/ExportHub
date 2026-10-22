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

test('RC1440/RC1598: POD audit remains documented but its automatic destructive production job is disabled',()=>{
  assert.doesNotMatch(workflow,/TARGET_REFERENCE:[^\n]*XG4YNN/);
  assert.match(workflow,/POD-Status-Integritaet PRODUCTION/);
  assert.match(workflow,/auditPodStatus:true/);
  assert.match(workflow,/17 2 \* \* \*/);
  assert.match(workflow,/pod_integrity_audit:\s*\n\s*name: POD-Status-Integritaet PRODUCTION[\s\S]*?\n\s*if: \$\{\{ false \}\}/,'RC1598 must disable the dangerous job for every trigger');
});

test('RC1598 P0: production OIDC endpoint refuses every POD status bulk audit before invocation',()=>{
  const guard=api.indexOf("if (payload.auditPodStatus === true && environment === 'production')");
  const call=api.indexOf('podIntegrityAudit.auditPodStatusesWithRetry(environment');
  assert.ok(guard>=0&&call>guard,'production guard must be before any mutating audit call');
  assert.match(api,/POD_STATUS_AUDIT_SUSPENDED_RC1598/);
  assert.match(api,/\b423\)/,'bulk modification is explicitly locked');
  assert.doesNotMatch(api.slice(0,guard),/podIntegrityAudit\.auditPodStatusesWithRetry\(/);
});


test('RC1594: POD-State-Konflikt liest vor jedem neuen Versuch frisch und bleibt begrenzt',async()=>{
  const mod=loadAudit(),conflict=Object.assign(new Error('Concurrent Team-State update'),{code:'POD_AUDIT_STATE_CONFLICT',statusCode:409});
  const attempts=[],delays=[],options={cursor:12,limit:10};
  const operation=async(environment,received)=>{
    attempts.push({environment,received});
    if(attempts.length<3)throw conflict;
    return{ok:true,checked:2};
  };
  const result=await mod.auditPodStatusesWithRetry('production',options,operation,async ms=>{delays.push(ms)});
  assert.deepEqual(result,{ok:true,checked:2});
  assert.deepEqual(attempts,[{environment:'production',received:options},{environment:'production',received:options},{environment:'production',received:options}]);
  assert.deepEqual(delays,[150,300]);
});

test('RC1594: anhaltender POD-State-Konflikt bricht nach maximal drei Versuchen weiterhin fail-closed ab',async()=>{
  const mod=loadAudit(),conflict=Object.assign(new Error('ETag changed again'),{code:'POD_AUDIT_STATE_CONFLICT',statusCode:409});
  let attempts=0;
  const delays=[];
  await assert.rejects(
    mod.auditPodStatusesWithRetry('production',{cursor:0},async()=>{attempts++;throw conflict},async ms=>{delays.push(ms)}),
    e=>e===conflict
  );
  assert.equal(attempts,3);
  assert.deepEqual(delays,[150,300]);
});

test('RC1594: andere Fehler werden niemals als POD-State-Konflikt verschluckt',async()=>{
  const mod=loadAudit(),permanent=Object.assign(new Error('Backup verification failed'),{code:'POD_AUDIT_BACKUP_VERIFY_FAILED',statusCode:500});
  let attempts=0,delays=0;
  await assert.rejects(
    mod.auditPodStatusesWithRetry('production',{cursor:0},async()=>{attempts++;throw permanent},async()=>{delays++}),
    e=>e===permanent
  );
  assert.equal(attempts,1);
  assert.equal(delays,0);
});

test('RC1594: OIDC-Auditweg nutzt frisches Recompute statt erzwungenem State-Write',()=>{
  assert.match(api,/podIntegrityAudit\.auditPodStatusesWithRetry\(environment,/);
  assert.match(source,/await store\.writeJson\(teamBlob,doc,read\.etag\)/);
  assert.doesNotMatch(source,/force\s*:\s*true/);
});


test('RC1618 P0: mutation-capable POD audit core rejects production before touching Azure',async()=>{
  const mod=loadAudit();
  const suspended=e=>e&&e.code==='POD_STATUS_AUDIT_SUSPENDED_RC1598'&&e.status===423;
  await assert.rejects(mod.auditPodStatuses('production',{cursor:0,limit:1}),suspended);
  // Invalid/missing environment normalizes to production in pickup-store and must be locked too.
  await assert.rejects(mod.auditPodStatuses('wrong-environment',{cursor:0,limit:1}),suspended);
  await assert.rejects(mod.auditPodStatusesWithRetry('production',{cursor:0,limit:1}),suspended);
  const coreGuard=source.indexOf("if(environment==='production')throw store.err('POD_STATUS_AUDIT_SUSPENDED_RC1598'");
  const storageRead=source.indexOf('const clients=await store.clients(environment)',coreGuard);
  assert.ok(coreGuard>=0&&storageRead>coreGuard,'core lock must precede any Azure client, backup or team-state read');
});
