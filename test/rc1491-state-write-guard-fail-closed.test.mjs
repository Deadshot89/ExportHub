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

function restrictedTaskEditor(){
  return {
    id:'RC1491-U1',
    user:'restricted-task-editor',
    role:'Benutzer',
    active:true,
    rights:{
      tasks:right('edit'),
      customers:right('none'),
      shipment:right('none'),
      documents:right('none'),
      settings:right('none')
    }
  };
}

function runAs(user,fn){
  return writeContext.run(()=>{
    writeContext.captureUser(user);
    return fn();
  });
}

test('RC1491: eingeschraenkter Editor darf keinen unbekannten serverpersistierten State-Bereich veraendern',()=>{
  const server={
    tasks:[{id:'T1',title:'Alt',updatedAt:'2026-10-11T10:00:00.000Z'}],
    futureSensitiveState:{enabled:false,secretPolicy:'server-owned'},
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
  const incoming=structuredClone(server);
  incoming.tasks[0]={...incoming.tasks[0],title:'Erlaubt',updatedAt:'2026-10-11T13:00:00.000Z'};
  incoming.futureSensitiveState={enabled:true,secretPolicy:'manipulated'};

  assert.throws(
    ()=>runAs(restrictedTaskEditor(),()=>secureMerge.mergeState(server,incoming)),
    error=>error&&error.code==='STATE_MODULE_WRITE_FORBIDDEN'&&error.status===403
  );
});
