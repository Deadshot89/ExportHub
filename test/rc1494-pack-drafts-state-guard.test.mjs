import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

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

const taskEditor={
  id:'RC1494-U1',
  user:'task-editor',
  role:'Benutzer',
  active:true,
  rights:{tasks:right('edit')}
};

function runMerge(server,incoming){
  return writeContext.run(()=>{
    writeContext.captureUser(taskEditor);
    return secureMerge.mergeState(server,incoming);
  });
}

function draft(updatedAt='2026-10-11T10:05:00.000Z',customer='Server Draft'){
  return {id:'draft-1',status:'open',customer,updatedAt};
}

test('RC1494: fehlender Pack-Draft im veralteten Client loescht den neueren Server-Draft nicht und blockiert den Save nicht',()=>{
  const server={
    tasks:[{id:'T1',title:'Alt',updatedAt:'2026-10-11T10:00:00.000Z'}],
    packDrafts:[draft()],
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
  const incoming={
    tasks:[{id:'T1',title:'Neu',updatedAt:'2026-10-11T10:10:00.000Z'}],
    packDrafts:[],
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
  const merged=runMerge(server,incoming);
  assert.equal(merged.tasks[0].title,'Neu');
  assert.equal(merged.packDrafts.length,1);
  assert.equal(merged.packDrafts[0].customer,'Server Draft');
});

test('RC1494: aelterer Pack-Draft aus einem Client darf den neueren Server-Draft nicht zuruecksetzen',()=>{
  const server={
    tasks:[{id:'T1',title:'Alt',updatedAt:'2026-10-11T10:00:00.000Z'}],
    packDrafts:[draft()],
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
  const incoming={
    tasks:[{id:'T1',title:'Neu',updatedAt:'2026-10-11T10:10:00.000Z'}],
    packDrafts:[draft('2026-10-11T10:01:00.000Z','Stale Draft')],
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
  const merged=runMerge(server,incoming);
  assert.equal(merged.tasks[0].title,'Neu');
  assert.equal(merged.packDrafts.length,1);
  assert.equal(merged.packDrafts[0].customer,'Server Draft');
  assert.equal(merged.packDrafts[0].updatedAt,'2026-10-11T10:05:00.000Z');
});
