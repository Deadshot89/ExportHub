import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1207-pallet-account-fix.js','utf8');

function makeRoot(){
  const state={
    palletAccount:[{id:'PAL-OLD',date:'2026-09-20',direction:'Eingang',count:1}],
    palletSettlements:[],auditLog:[],_teamSyncMeta:{fields:{},tombstones:[]}
  };
  const calls=[];
  const cleanRuntime={changeGeneration:4,lastSavedGeneration:3,saving:false};
  const root={
    __EXPORTHUB_FORCED_ENVIRONMENT__:'production',
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_CURRENT_USER__:()=>({name:'Test'}),
    ExportHUBClean:{
      runtime:cleanRuntime,
      queueSave:r=>{calls.push(['queue',r]);cleanRuntime.changeGeneration++;return true},
      flushSave:(r,opt)=>{calls.push(['flush',r,opt]);cleanRuntime.lastSavedGeneration=cleanRuntime.changeGeneration;return true}
    },
    canAdmin:()=>true,
    document:{readyState:'loading',body:null,documentElement:null,addEventListener(){},getElementById(){return null},querySelectorAll(){return[]}},
    location:{hostname:'prod.test',pathname:'/'},
    addEventListener(){},setTimeout(){return 1},clearTimeout(){},console:{error(){}},
    rc542RenderPallet(){return false}
  };
  vm.runInNewContext(runtime,{globalThis:root,setTimeout:root.setTimeout,clearTimeout:root.clearTimeout,console:root.console});
  return {root,state,calls,api:root.ExportHUBRC1207PalletFix};
}

test('RC1477: bereits serverseitig bereinigter 21.09. löst beim Browserstart keinen State-Save aus',async()=>{
  const x=makeRoot();
  assert.equal(await x.api.cleanupProductionDayOnce(),false,'ohne Treffer gibt es clientseitig nichts zu mutieren');
  assert.deepEqual(x.calls,[],'kein queueSave/flushSave für einen No-op-Cleanup');
  assert.equal(x.state.rc1207PalletCleanup20260921At,undefined,'No-op erzeugt keinen neuen State-Marker');
  assert.equal(x.state.palletAccount.length,1);
});
