import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {patchRc1662SavedShipmentDeltaHtml} from '../scripts/rc1662-abd-saved-shipment-delta.mjs';
import {patchRc1982MetaDeltaHtml} from '../scripts/rc1982-save-meta-delta.mjs';

const require=createRequire(import.meta.url);
const {mergeState}=require('../api/shared/merge.js');
const main=fs.readFileSync('index.html','utf8');
const rc1662=patchRc1662SavedShipmentDeltaHtml(main);
const patched=patchRc1982MetaDeltaHtml(rc1662);

function writer(html){
  const first=html.indexOf('const SYNC_COLLECTION_KEYS=');
  const end=html.indexOf('const LOCAL_UI_KEYS=',first);
  const start=html.indexOf('function recordKey(',end);
  const stop=html.indexOf('function persistentStateShapeComplete(',start);
  assert.ok(first>=0&&end>first&&start>end&&stop>start,'expected production delta functions');
  const ctx={
    isObject:v=>v!==null&&typeof v==='object'&&!Array.isArray(v),
    lower:v=>String(v??'').trim().toLowerCase(),
    text:v=>String(v??'').trim(),
    sameValue:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
    clone:v=>v===undefined?undefined:structuredClone(v),
    compactInlineBinaryAliases:v=>v,
    isLocalOnlyStateKey:k=>k==='view',
    runtime:{deviceId:'RC1982-TEST',explicitCustomerSaveIds:[]},
    Date,Set,Map,Object,Array,String,JSON
  };
  vm.runInNewContext(html.slice(first,end)+'\n'+html.slice(start,stop)+'\nthis.writer={stampChanges,buildAzureStateDelta}',ctx);
  return ctx.writer;
}
function baseState(){
  return {
    shipments:[{id:'A',ref:'ABC123',status:'Erstellt',shipmentHistory:[]}],
    savedShipments:[{id:'A',ref:'ABC123',status:'Erstellt',shipmentHistory:[]}],
    _teamSyncMeta:{
      fields:{someSetting:{updatedAt:'2026-11-01T08:00:00.000Z',deviceId:'old'}},
      tombstones:Array.from({length:1200},(_,i)=>({collection:'tasks',id:'DONE-'+i,deletedAt:'2026-10-01T00:00:00Z'}))
    }
  };
}
function changedHistory(before){
  const after=structuredClone(before);
  const event={id:'EVENT-1',type:'mail-open',label:'Avis-Erinnerung in Outlook geöffnet',at:'2026-11-11T09:45:00Z'};
  after.shipments[0].shipmentHistory=[event];
  after.savedShipments[0].shipmentHistory=[event];
  return after;
}

test('RC1982: unchanged sync metadata is omitted from AVIS shipment-history delta',()=>{
  const before=baseState(), after=changedHistory(before);
  const old=writer(rc1662), stampBefore=old.stampChanges(before,structuredClone(after),[],[],'History: AVIS opened');
  const legacy=old.buildAzureStateDelta(before,after,stampBefore,'History: AVIS opened');
  assert.ok(legacy._teamSyncMeta,'baseline unnecessarily repeats all historical tombstones');

  const updated=writer(patched),at=updated.stampChanges(before,after,[],[],'History: AVIS opened');
  const delta=updated.buildAzureStateDelta(before,after,at,'History: AVIS opened');
  assert.equal(Object.hasOwn(delta,'_teamSyncMeta'),false);
  assert.equal(delta.shipments.length,1);
  assert.equal(delta.savedShipments.length,1);
  assert.equal(delta.shipments[0].shipmentHistory[0].id,'EVENT-1');
  assert.ok(JSON.stringify(delta).length<JSON.stringify(legacy).length/5,'request should be much smaller');
  const merged=mergeState(before,delta);
  assert.equal(merged._teamSyncMeta.tombstones.length,1200,'server retains all deletion markers');
  assert.equal(merged.shipments[0].shipmentHistory[0].id,'EVENT-1');
  assert.equal(merged.savedShipments[0].shipmentHistory[0].id,'EVENT-1');
});

test('RC1982: updated tombstones and field clocks are not dropped',()=>{
  const before=baseState(),after=changedHistory(before);
  after._teamSyncMeta.tombstones.push({collection:'tasks',id:'NEW-DELETE',deletedAt:'2026-11-11T09:46:00Z'});
  after._teamSyncMeta.fields.someSetting={updatedAt:'2026-11-11T09:46:00Z',deviceId:'next'};
  const api=writer(patched),stamp=api.stampChanges(before,after,[],[],'History: AVIS opened');
  const delta=api.buildAzureStateDelta(before,after,stamp,'History: AVIS opened');
  assert.equal(delta._teamSyncMeta.tombstones.length,1201);
  assert.equal(delta._teamSyncMeta.fields.someSetting.deviceId,'next');
  const merged=mergeState(before,delta);
  assert.ok(merged._teamSyncMeta.tombstones.some(x=>x.id==='NEW-DELETE'));
  assert.equal(merged._teamSyncMeta.fields.someSetting.deviceId,'next');
});

test('RC1982: patch is idempotent and fails closed on missing or partial anchors',()=>{
  assert.equal(patchRc1982MetaDeltaHtml(patched),patched);
  assert.throws(()=>patchRc1982MetaDeltaHtml(rc1662.replace(
    "if(!out._teamSyncMeta&&isObject(current._teamSyncMeta))out._teamSyncMeta",
    "if(!out._teamSyncMeta&&false)out._teamSyncMeta"
  )),/anchor|partially/);
  assert.throws(()=>patchRc1982MetaDeltaHtml(patched.replace(
    "if(key==='_teamSyncMeta'){if(!sameValue(base[key],current[key]))",
    "if(key==='_teamSyncMeta'){"
  )),/partially/);
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  assert.match(build,/import \{patchRc1982MetaDeltaHtml\} from '\.\.\/\.\.\/scripts\/rc1982-save-meta-delta\.mjs'/);
  assert.match(build,/patchRc1982MetaDeltaHtml\(rc1718Printed\.replace\(/);
});
