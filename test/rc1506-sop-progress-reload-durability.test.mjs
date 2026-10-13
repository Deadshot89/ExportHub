import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/sop/rc1503-sop-progress.js','utf8');

function memoryStorage(seed=new Map()){
  return {
    get length(){return seed.size;},
    key(index){return Array.from(seed.keys())[index]??null;},
    getItem(key){return seed.has(String(key))?seed.get(String(key)):null;},
    setItem(key,value){seed.set(String(key),String(value));},
    removeItem(key){seed.delete(String(key));},
    clear(){seed.clear();},
    _seed:seed
  };
}

function runtime({state,storage,tour}){
  const sandbox={
    console,
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
    Math,
    Promise,
    encodeURIComponent,
    setTimeout,
    clearTimeout,
    sessionStorage:storage,
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_CURRENT_USER__:()=>({id:'DEMO-USER-1'}),
    ExportHubSopTour:tour,
    ExportHUBClean:{
      queueSave:()=>true,
      // Save bleibt absichtlich offen: simuliert Reload bevor Azure/Demo-ACK zurück ist.
      flushSave:()=>new Promise(()=>{})
    }
  };
  sandbox.window=sandbox;
  sandbox.globalThis=sandbox;
  vm.runInNewContext(source,sandbox,{filename:'rc1503-sop-progress.js'});
  return sandbox;
}

const sop={number:'SOP-EH-060',version:'2.0'};

test('SOP-Tourabschluss überlebt einen sofortigen Reload auch vor dem Cloud-ACK',()=>{
  const storage=memoryStorage();
  const firstState={sopLearningProgress:[]};
  const first=runtime({
    state:firstState,
    storage,
    tour:{
      start:()=>({sopNumber:'SOP-EH-060',version:'2.0',status:'active'}),
      handleAction:()=>({session:{sopNumber:'SOP-EH-060',version:'2.0',status:'completed'}})
    }
  });

  first.ExportHubSopTour.start({sop});
  first.ExportHubSopTour.handleAction({type:'click'});
  const live=first.ExportHubSopProgress.get(firstState,'DEMO-USER-1','SOP-EH-060','2.0');
  assert.ok(live?.tourCompletedAt,'Live-State muss Tourabschluss enthalten');

  // Reload lädt noch den älteren Cloud-/Demo-Stand ohne Tourabschluss.
  const staleState={sopLearningProgress:[{
    id:'sop-learning:demo-user-1:sop-eh-060:2.0',
    key:'sop-learning:demo-user-1:sop-eh-060:2.0',
    userId:'DEMO-USER-1',sopNumber:'SOP-EH-060',version:'2.0',
    viewedAt:live.viewedAt,startedAt:live.startedAt,completedAt:'',tourCompletedAt:'',
    helpCount:0,helpEvents:[],examAttempts:[],updatedAt:live.startedAt,_syncUpdatedAt:live.startedAt
  }]};
  const second=runtime({state:staleState,storage,tour:{}});
  const restored=second.ExportHubSopProgress.get(staleState,'DEMO-USER-1','SOP-EH-060','2.0');

  assert.equal(restored?.viewedAt,live.viewedAt);
  assert.equal(restored?.startedAt,live.startedAt);
  assert.equal(restored?.tourCompletedAt,live.tourCompletedAt,'tab-lokaler Reload-Schutz muss den noch nicht bestätigten Tourabschluss wiederherstellen');
});
