import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1014-task-runtime.js','utf8');

function runtime(environment='production',flushResult=true){
  const state={
    tasks:[{id:'TASK-1',title:'Alt 1'},{id:'TASK-2',title:'Alt 2'}],
    taskStatusLedger:{'id:task-1':{status:'erledigt'}},
    _teamSyncMeta:{fields:{},tombstones:[{collection:'customers',id:'C-1',deletedAt:'2026-09-01T00:00:00.000Z'}]}
  };
  const calls=[];
  const window={
    __EXPORTHUB_FORCED_ENVIRONMENT__:environment,
    ExportHUBClean:{
      state,
      queueSave(reason){calls.push(['queue',reason]);return true;},
      async flushSave(reason){calls.push(['flush',reason]);return flushResult;}
    },
    addEventListener(){},
    dispatchEvent(){return true;},
    setTimeout(){return 1;},
    clearTimeout(){},
    document:null,
    location:{hostname:environment==='testservice'?'example-testservice.azurestaticapps.net':'example.azurestaticapps.net',pathname:'/'}
  };
  const sandbox={...window,window,globalThis:window,console,CustomEvent:function(type,init){this.type=type;this.detail=init&&init.detail;}};
  vm.runInNewContext(source,sandbox,{filename:'rc1014-task-runtime.js'});
  return {api:window.ExportHUBRC1014TaskRuntime,state,calls};
}

test('RC1107: Produktion leert Aufgaben und Statusledger genau einmal mit Tombstones',async()=>{
  const {api,state,calls}=runtime('production',true);
  assert.equal(await api.resetProductionTasksOnce(),true);
  assert.equal(state.tasks.length,0);
  assert.equal(Object.keys(state.taskStatusLedger).length,0);
  assert.ok(state.rc1107TaskResetAt);
  const taskTombstones=state._teamSyncMeta.tombstones.filter(t=>t.collection==='tasks');
  assert.equal(JSON.stringify(taskTombstones.map(t=>t.id).sort()),JSON.stringify(['TASK-1','TASK-2']));
  assert.equal(state._teamSyncMeta.tombstones.filter(t=>t.collection==='customers').length,1);
  assert.equal(JSON.stringify(calls.map(c=>c[0])),JSON.stringify(['queue','flush']));
  assert.equal(await api.resetProductionTasksOnce(),false);
  assert.equal(JSON.stringify(calls.map(c=>c[0])),JSON.stringify(['queue','flush']));
});

test('RC1107: TESTSERVICE wird niemals zurückgesetzt',async()=>{
  const {api,state,calls}=runtime('testservice',true);
  assert.equal(await api.resetProductionTasksOnce(),false);
  assert.equal(state.tasks.length,2);
  assert.equal(state.rc1107TaskResetAt,undefined);
  assert.equal(calls.length,0);
});

test('RC1107: fehlgeschlagene Azure-Bestätigung stellt lokalen Aufgabenbestand wieder her',async()=>{
  const {api,state}=runtime('production',false);
  await assert.rejects(()=>api.resetProductionTasksOnce(),/Azure/);
  assert.equal(state.tasks.length,2);
  assert.equal(JSON.stringify(state.taskStatusLedger),JSON.stringify({'id:task-1':{status:'erledigt'}}));
  assert.equal(state.rc1107TaskResetAt,undefined);
  assert.equal(state._teamSyncMeta.tombstones.filter(t=>t.collection==='tasks').length,0);
});

test('RC1107: Aufgabenreset-Runtime wird nicht aus altem Browsercache geladen',()=>{
  const config=JSON.parse(fs.readFileSync('staticwebapp.config.json','utf8'));
  const route=(config.routes||[]).find(item=>item.route==='/assets/rc1014-task-runtime.js');
  assert.ok(route,'Task-Runtime braucht für den einmaligen Produktionsreset einen expliziten Assetvertrag');
  assert.match(String(route.headers&&route.headers['Cache-Control']||''),/no-store/i);
});
