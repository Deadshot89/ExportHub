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
    id:'RC1492-U1',
    user:'restricted-task-editor',
    role:'Benutzer',
    active:true,
    rights:{
      tasks:right('edit'),
      customers:right('none'),
      shipment:right('none'),
      documents:right('none'),
      pallet:right('none'),
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

function expectForbidden(server,incoming){
  assert.throws(
    ()=>runAs(restrictedTaskEditor(),()=>secureMerge.mergeState(server,incoming)),
    error=>error&&error.code==='STATE_MODULE_WRITE_FORBIDDEN'&&error.status===403
  );
}

test('RC1492: eingeschraenkter Editor darf keinen unbekannten serverpersistierten State-Bereich veraendern',()=>{
  const server={
    tasks:[{id:'T1',title:'Alt',updatedAt:'2026-10-11T10:00:00.000Z'}],
    futureSensitiveState:{enabled:false,secretPolicy:'server-owned'},
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
  const incoming=structuredClone(server);
  incoming.tasks[0]={...incoming.tasks[0],title:'Erlaubt',updatedAt:'2026-10-11T13:00:00.000Z'};
  incoming.futureSensitiveState={enabled:true,secretPolicy:'manipulated'};
  expectForbidden(server,incoming);
});

test('RC1492: unbekannte persistierte Field-Metadaten duerfen nicht vergiftet werden',()=>{
  const server={
    tasks:[{id:'T1',title:'Alt',updatedAt:'2026-10-11T10:00:00.000Z'}],
    futureSensitiveState:{enabled:false},
    _teamSyncMeta:{fields:{futureSensitiveState:'2026-10-11T10:00:00.000Z'},tombstones:[]}
  };
  const incoming=structuredClone(server);
  incoming._teamSyncMeta.fields.futureSensitiveState='2099-01-01T00:00:00.000Z';
  expectForbidden(server,incoming);
});

test('RC1492: unbekannte Tombstone-Collection darf keine serverseitigen Daten loeschen',()=>{
  const server={
    tasks:[{id:'T1',title:'Alt',updatedAt:'2026-10-11T10:00:00.000Z'}],
    futureSensitiveItems:[{id:'F1',value:'server-owned',updatedAt:'2026-10-11T10:00:00.000Z'}],
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
  const incoming=structuredClone(server);
  incoming._teamSyncMeta.tombstones.push({
    collection:'futureSensitiveItems',
    id:'F1',
    deletedAt:'2099-01-01T00:00:00.000Z'
  });
  expectForbidden(server,incoming);
});

test('RC1492: camelCase Tombstone-Collection behaelt ihr Modulrecht',()=>{
  const server={
    tasks:[{id:'T1',title:'Alt',updatedAt:'2026-10-11T10:00:00.000Z'}],
    palletAccount:[{id:'P1',count:1,updatedAt:'2026-10-11T10:00:00.000Z'}],
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
  const incoming=structuredClone(server);
  incoming._teamSyncMeta.tombstones.push({
    collection:'palletAccount',
    id:'P1',
    deletedAt:'2099-01-01T00:00:00.000Z'
  });
  expectForbidden(server,incoming);
});

test('RC1492: lokale UI-Felder bleiben fuer den State-Guard neutral',()=>{
  const server={
    tasks:[{id:'T1',title:'Alt',updatedAt:'2026-10-11T10:00:00.000Z'}],
    taskSearch:'alt',
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
  const incoming=structuredClone(server);
  incoming.taskSearch='neu';
  const merged=runAs(restrictedTaskEditor(),()=>secureMerge.mergeState(server,incoming));
  assert.equal(merged.taskSearch,undefined);
});
