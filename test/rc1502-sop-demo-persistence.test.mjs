import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE=fs.readFileSync(new URL('../assets/exporthub-demo-bootstrap.js',import.meta.url),'utf8');

function storageClass(){
  return class DemoStorage {
    constructor(map){this.map=map;}
    get length(){return this.map.size;}
    getItem(key){return this.map.has(String(key))?this.map.get(String(key)):null;}
    setItem(key,value){this.map.set(String(key),String(value));}
    removeItem(key){this.map.delete(String(key));}
    clear(){this.map.clear();}
    key(index){return Array.from(this.map.keys())[index]??null;}
  };
}

function boot(persistedMap){
  const DemoStorage=storageClass();
  const sessionMap=new Map();
  const localStorage=new DemoStorage(persistedMap);
  const sessionStorage=new DemoStorage(sessionMap);
  const document={
    documentElement:{setAttribute(){}},
    body:null,
    readyState:'loading',
    addEventListener(){},
    getElementById(){return null;},
    createElement(){return{style:{},appendChild(){}};}
  };
  const location={href:'http://127.0.0.1:4173/demo.html',hostname:'127.0.0.1'};
  const window={
    localStorage,sessionStorage,document,location,
    fetch:async()=>new Response('{}',{status:404}),
    addEventListener(){},removeEventListener(){},setTimeout,clearTimeout
  };
  window.window=window;
  const context={window,document,location,Storage:DemoStorage,Response,URL,Date,JSON,Map,Set,String,Number,Boolean,Array,Object,RegExp,Promise,console,setTimeout,clearTimeout};
  vm.runInNewContext(SOURCE,context,{filename:'exporthub-demo-bootstrap.js'});
  return window;
}

async function readState(win){
  const response=await win.fetch('/api/exporthub-state?mode=read&full=1',{method:'GET'});
  assert.equal(response.status,200);
  return response.json();
}

async function writeState(win,state){
  const response=await win.fetch('/api/exporthub-state?mode=save&ack=1',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({environment:'demo',baseRevision:996,reason:'RC1502 persistence regression',state})
  });
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.ok,true);
  return data;
}

test('Demo-State-API übernimmt SOP-Drafts und liefert sie sofort wieder aus',async()=>{
  const storage=new Map();
  const win=boot(storage);
  const draft={id:'SOP-EH-060',number:'SOP-EH-060',currentVersion:'2.0',draftVersion:'2.1',updatedAt:'2026-10-12T17:30:00.000Z',versions:[{version:'2.0',status:'Freigegeben'},{version:'2.1',status:'Entwurf'}]};
  await writeState(win,{isoSops:[draft]});
  const read=await readState(win);
  const stored=read.state?.isoSops?.find(item=>item.number==='SOP-EH-060');
  assert.equal(stored?.draftVersion,'2.1');
  assert.ok(stored?.versions?.some(item=>item.version==='2.1'));
});

test('Demo-State bleibt über einen echten Bootstrap-Neustart erhalten',async()=>{
  const storage=new Map();
  let win=boot(storage);
  const draft={id:'SOP-EH-060',number:'SOP-EH-060',currentVersion:'2.0',draftVersion:'2.1',updatedAt:'2026-10-12T17:31:00.000Z',versions:[{version:'2.0',status:'Freigegeben'},{version:'2.1',status:'Entwurf'}]};
  await writeState(win,{isoSops:[draft]});

  win=boot(storage);
  const read=await readState(win);
  const stored=read.state?.isoSops?.find(item=>item.number==='SOP-EH-060');
  assert.equal(stored?.draftVersion,'2.1');
  assert.ok(stored?.versions?.some(item=>item.version==='2.1'));
  assert.equal(read.environment,'demo');
});
