import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const secureMerge=require('../api/shared/secure-merge.js');
const writeContext=require('../api/shared/state-write-context.js');

function right(level){
  return {
    level,
    visible:level!=='none',
    read:level!=='none',
    edit:level==='edit'||level==='admin',
    admin:level==='admin',
    functionAdmin:level==='admin'
  };
}

function normalUser(){
  return {
    id:'USER-Sevastian',
    user:'Sevastian',
    login:'Sevastian',
    username:'Sevastian',
    name:'Sevastian Marcu',
    role:'Benutzer',
    active:true,
    rights:{
      sop:right('view'),
      shipment:right('edit'),
      tasks:right('edit'),
      documents:right('edit'),
      customers:right('view'),
      history:right('none')
    }
  };
}

function runAs(user,fn){
  return writeContext.run(()=>{
    writeContext.captureUser(user);
    return fn();
  });
}

function progress(userId,updatedAt='2026-10-14T09:00:00.000Z'){
  const owner=String(userId).trim();
  const id=`sop-learning:${encodeURIComponent(owner.toLowerCase())}:sop-001:v1`;
  return {
    id,
    key:id,
    userId:owner,
    sopNumber:'SOP-001',
    version:'v1',
    viewedAt:updatedAt,
    startedAt:updatedAt,
    completedAt:'',
    tourCompletedAt:'',
    helpCount:0,
    helpEvents:[],
    examAttempts:[],
    updatedAt,
    _syncUpdatedAt:updatedAt
  };
}

test('RC1532 P0: normaler Benutzer darf eigenen SOP-Lernfortschritt dauerhaft speichern',()=>{
  const server={
    shipments:[{id:'S1',ref:'ABC123',status:'Erstellt',updatedAt:'2026-10-14T08:00:00.000Z'}],
    sopLearningProgress:[],
    _teamSyncMeta:{fields:{sopLearningProgress:'2026-10-14T08:00:00.000Z'},tombstones:[]}
  };
  const incoming=structuredClone(server);
  incoming.sopLearningProgress=[progress('USER-Sevastian')];
  incoming._teamSyncMeta.fields.sopLearningProgress='2026-10-14T09:00:00.000Z';

  const merged=runAs(normalUser(),()=>secureMerge.mergeState(server,incoming));
  assert.equal(merged.sopLearningProgress.length,1);
  assert.equal(merged.sopLearningProgress[0].userId,'USER-Sevastian');
});

test('RC1532 Security: normaler Benutzer darf Lernfortschritt eines anderen Benutzers nicht veraendern',()=>{
  const server={
    sopLearningProgress:[progress('USER-Daniel','2026-10-14T08:00:00.000Z')],
    _teamSyncMeta:{fields:{sopLearningProgress:'2026-10-14T08:00:00.000Z'},tombstones:[]}
  };
  const incoming=structuredClone(server);
  incoming.sopLearningProgress[0]={
    ...incoming.sopLearningProgress[0],
    completedAt:'2026-10-14T09:00:00.000Z',
    updatedAt:'2026-10-14T09:00:00.000Z',
    _syncUpdatedAt:'2026-10-14T09:00:00.000Z'
  };
  incoming._teamSyncMeta.fields.sopLearningProgress='2026-10-14T09:00:00.000Z';

  assert.throws(
    ()=>runAs(normalUser(),()=>secureMerge.mergeState(server,incoming)),
    error=>error&&error.code==='STATE_MODULE_WRITE_FORBIDDEN'&&error.status===403
  );
});

test('RC1532 Security: Benutzer ohne SOP-Leserecht darf auch eigenen Lernfortschritt nicht schreiben',()=>{
  const user=normalUser();
  user.rights.sop=right('none');
  const server={
    sopLearningProgress:[],
    _teamSyncMeta:{fields:{sopLearningProgress:'2026-10-14T08:00:00.000Z'},tombstones:[]}
  };
  const incoming=structuredClone(server);
  incoming.sopLearningProgress=[progress('USER-Sevastian')];
  incoming._teamSyncMeta.fields.sopLearningProgress='2026-10-14T09:00:00.000Z';

  assert.throws(
    ()=>runAs(user,()=>secureMerge.mergeState(server,incoming)),
    error=>error&&error.code==='STATE_MODULE_WRITE_FORBIDDEN'&&error.status===403
  );
});

test('RC1532 Security: eigener Fortschritt darf fremde unveraenderte Fortschritte nicht veraendern',()=>{
  const server={
    sopLearningProgress:[progress('USER-Daniel','2026-10-14T08:00:00.000Z')],
    _teamSyncMeta:{fields:{sopLearningProgress:'2026-10-14T08:00:00.000Z'},tombstones:[]}
  };
  const incoming=structuredClone(server);
  incoming.sopLearningProgress.push(progress('USER-Sevastian','2026-10-14T09:00:00.000Z'));
  incoming._teamSyncMeta.fields.sopLearningProgress='2026-10-14T09:00:00.000Z';

  const merged=runAs(normalUser(),()=>secureMerge.mergeState(server,incoming));
  assert.equal(merged.sopLearningProgress.length,2);
  assert.equal(merged.sopLearningProgress.find(item=>item.userId==='USER-Daniel').updatedAt,'2026-10-14T08:00:00.000Z');
  assert.equal(merged.sopLearningProgress.find(item=>item.userId==='USER-Sevastian').updatedAt,'2026-10-14T09:00:00.000Z');
});

test('RC1532 Security: unbekannte persistierte State-Bereiche bleiben fuer normale Benutzer fail-closed',()=>{
  const server={
    sopLearningProgress:[],
    futureSensitiveState:{enabled:false},
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
  const incoming=structuredClone(server);
  incoming.futureSensitiveState={enabled:true};

  assert.throws(
    ()=>runAs(normalUser(),()=>secureMerge.mergeState(server,incoming)),
    error=>error&&error.code==='STATE_MODULE_WRITE_FORBIDDEN'&&error.status===403
  );
});
