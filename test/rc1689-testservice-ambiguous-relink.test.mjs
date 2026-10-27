import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const storeModule=require.resolve('../api/shared/pickup-store.js');
const key='a'.repeat(64);
const record={
  reference:'DUPLICATE-LEGACY',
  status:'confirmed',
  confirmedAt:'2026-10-27T08:00:00.000Z',
  signatureBlobName:'signed-driver-signature',
  podBackup:{archiveSaved:true,archiveVerifiedAt:new Date().toISOString(),hash:'b'.repeat(64)}
};
let mutations=[];
const store={
  normalizeEnvironment:e=>e,
  pickupComplete:()=>true,
  now:()=>new Date().toISOString(),
  clients:async environment=>({
    records:{
      listBlobsFlat:()=>({
        byPage:()=>({
          async *[Symbol.asyncIterator](){
            yield {continuationToken:'',segment:{blobItems:[{name:'rc995/'+environment+'/records/'+key+'.json'}]}};
          }
        })
      }),
      getBlobClient:name=>({name})
    }
  }),
  readJson:async()=>({value:JSON.parse(JSON.stringify(record))}),
  updateTeam:async()=>{throw Object.assign(new Error('Multiple legacy team shipment candidates'),{code:'TEAM_SHIPMENT_AMBIGUOUS'});},
  mutateRecord:async(...args)=>{mutations.push(args);throw Error('Ambiguous relink must never mutate a stored POD or shipment');}
};
require.cache[storeModule]={id:storeModule,filename:storeModule,loaded:true,exports:store};
const graph=require('../api/shared/graph-drive.js');
const originalReadiness=graph.readiness;
graph.readiness=()=>({configured:false});
const archive=require('../api/shared/pod-archive.js');

test('RC1689: TESTSERVICE duplicate team candidates remain unresolved without any POD or team mutation',async()=>{
  mutations=[];
  const result=await archive.reconcilePendingBackups('testservice',{limit:25,minAgeMs:0,scanPageSize:10});
  assert.equal(result.ok,true,'other verified Azure work should not be blocked by an unresolvable team link');
  assert.equal(result.errorCount,0);
  assert.equal(result.teamRelinkBlockedCount,1);
  assert.deepEqual(result.teamRelinkBlockedCodes,['TEAM_SHIPMENT_AMBIGUOUS']);
  assert.equal(result.teamRelinkedCount,0,'ambiguous reference must not be marked linked');
  assert.equal(result.teamRelinkSkippedCount,0,'ambiguous reference must not be marked terminally skipped');
  assert.equal(result.teamRelinkPendingCount,1,'manual repair remains outstanding');
  assert.equal(result.needsManualReview,true);
  assert.equal(result.eligible,0,'non-actionable ambiguous relink cannot cause a 200-page drain loop');
  assert.equal(result.selected,0);
  assert.equal(result.nextContinuationToken,null);
  assert.equal(result.scanComplete,true);
  assert.deepEqual(mutations,[],'no team/POD state may be written for ambiguous candidates');
});

test('RC1689: production duplicate team candidates still fail closed and are not counted as repaired',async()=>{
  mutations=[];
  const result=await archive.reconcilePendingBackups('production',{limit:25,minAgeMs:0,scanPageSize:10});
  assert.equal(result.ok,false);
  assert.equal(result.errorCount,1);
  assert.equal(result.errors[0].code,'TEAM_SHIPMENT_AMBIGUOUS');
  assert.equal(result.teamRelinkBlockedCount,0);
  assert.equal(result.teamRelinkedCount,0);
  assert.equal(result.needsManualReview,false);
  assert.deepEqual(mutations,[],'no writes to ambiguous production shipment');
});

test('RC1689: TESTSERVICE reconcile publishes a warning rather than declaring an ambiguous relink successful',()=>{
  const workflow=fs.readFileSync(new URL('../.github/workflows/rc1144-pod-backup-reconcile.yml',import.meta.url),'utf8');
  const testPart=workflow.split('\n  production:\n')[0];
  assert.match(testPart,/blocked_ambiguous_relink_batches=0/);
  assert.match(testPart,/teamRelinkBlockedCount:v\.teamRelinkBlockedCount/);
  assert.match(testPart,/blocked_relink_count=.*teamRelinkBlockedCount/);
  assert.match(testPart,/TEAM_SHIPMENT_AMBIGUOUS/);
  assert.match(testPart,/No ambiguous shipment was selected, linked or marked as repaired/);
  assert.doesNotMatch(workflow,/environment === 'production' && code === 'TEAM_SHIPMENT_AMBIGUOUS'/);
});
