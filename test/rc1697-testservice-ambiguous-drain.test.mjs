import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const keyA='a'.repeat(64),keyB='b'.repeat(64);
const makeRecord=(reference,confirmedAt)=>({
 reference,status:'confirmed',confirmedAt,signatureBlobName:'signed-driver',
 podBackup:{archiveSaved:true,archiveVerifiedAt:new Date().toISOString(),hash:'c'.repeat(64)}
});
const records=new Map([
 [keyA,makeRecord('AMBIGUOUS-OLD','2026-10-27T07:00:00Z')],
 [keyB,makeRecord('UNIQUE-NEXT','2026-10-27T08:00:00Z')]
]);
const calls={ambiguous:0,linked:0,mutations:[]};
const store={
 normalizeEnvironment:x=>x,pickupComplete:()=>true,now:()=>new Date().toISOString(),
 clients:async environment=>({records:{
  listBlobsFlat:()=>({byPage:()=>({async *[Symbol.asyncIterator](){
   yield {continuationToken:'cursor-next',segment:{blobItems:[
    {name:'rc995/'+environment+'/records/'+keyA+'.json'},
    {name:'rc995/'+environment+'/records/'+keyB+'.json'}
   ]}};
  }})}),
  getBlobClient:name=>({name})
 }}),
 readJson:async blob=>{
  const key=blob.name.match(/([a-f0-9]{64})\.json$/i)[1];
  return {value:structuredClone(records.get(key))};
 },
 updateTeam:async record=>{
  if(record.reference==='AMBIGUOUS-OLD'){
   calls.ambiguous++;
   throw Object.assign(new Error('Duplicate team candidates'),{code:'TEAM_SHIPMENT_AMBIGUOUS',status:409});
  }
  calls.linked++;
 },
 mutateRecord:async (key,_environment,update)=>{
  calls.mutations.push(key);
  records.set(key,update(structuredClone(records.get(key))));
  return records.get(key);
 }
};
const storePath=require.resolve('../api/shared/pickup-store.js');
require.cache[storePath]={id:storePath,filename:storePath,loaded:true,exports:store};
const graph=require('../api/shared/graph-drive.js');
graph.readiness=()=>({configured:false});
const archive=require('../api/shared/pod-archive.js');

test('RC1697: TESTSERVICE can visit the next valid relink after an ambiguous old POD without mutating it',async()=>{
 const cursor='cursor-one';
 const first=await archive.reconcilePendingBackups('testservice',{limit:25,scanPageSize:10,minAgeMs:0,continuationToken:cursor});
 assert.equal(first.ok,true);
 assert.equal(first.teamRelinkBlockedCount,1);
 assert.equal(first.nextRelinkSkipCount,1);
 assert.equal(first.nextContinuationToken,cursor,'same page is retried to reach unprocessed relinks');
 assert.equal(first.requiredWorkDeferred,true);
 assert.equal(calls.ambiguous,1);
 assert.equal(calls.linked,0);
 assert.deepEqual(calls.mutations,[]);

 const next=await archive.reconcilePendingBackups('testservice',{
  limit:25,scanPageSize:10,minAgeMs:0,continuationToken:first.nextContinuationToken,
  relinkSkipCount:first.nextRelinkSkipCount
 });
 assert.equal(next.ok,true);
 assert.equal(next.teamRelinkedCount,1);
 assert.equal(next.teamRelinkBlockedCount,0);
 assert.equal(next.requiredWorkDeferred,false);
 assert.equal(next.nextContinuationToken,'cursor-next','once valid work is handled the normal Azure scan advances');
 assert.equal(calls.ambiguous,1,'ambiguous entry must not be retried on the same page');
 assert.equal(calls.linked,1);
 assert.deepEqual(calls.mutations,[keyB],'only unambiguous team link may be updated');
 assert.equal(records.get(keyA).teamPodLinkVersion,undefined,'ambiguous POD remains unresolved and unchanged');
 assert.ok(records.get(keyB).teamPodLinkVersion,'valid team link is handled');
});

test('RC1697: PROD cannot use TESTSERVICE cursor and workflow does not misreport a manual-review skip as a repair',()=>{
 const api=fs.readFileSync('api/pod-backup-reconcile/index.js','utf8');
 const workflow=fs.readFileSync('.github/workflows/rc1144-pod-backup-reconcile.yml','utf8');
 const archiveCode=fs.readFileSync('api/shared/pod-archive.js','utf8');
 const testservice=workflow.split('\n  production:\n')[0];
 assert.match(api,/relinkSkipCount: environment === 'testservice' && drainAll/);
 assert.match(archiveCode,/environment === 'testservice' && !reference/);
 assert.match(testservice,/previous_relink_skip_count/);
 assert.match(testservice,/nextRelinkSkipCount/);
 assert.match(testservice,/relink_skip_count.*previous_relink_skip_count/);
 assert.match(archiveCode,/if \(environment === 'testservice' && code === 'TEAM_SHIPMENT_AMBIGUOUS'\)/);
 assert.doesNotMatch(testservice,/teamPodLinkVersion.*TEAM_SHIPMENT_AMBIGUOUS/);
});
