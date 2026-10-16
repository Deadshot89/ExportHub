import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');

function harness({hostPresent=false,panelPresent=false}={}){
  const events=new Map(),timers=[],observers=[];
  let hasHost=hostPresent,hasPanel=panelPresent;
  const host={id:'rc626Abd',nodeType:1};
  const content={id:'content',nodeType:1};
  const panel={id:'rc1294AbdAnalysis',querySelector(){return null},remove(){hasPanel=false}};
  const document={
    readyState:'complete',
    body:{id:'body',nodeType:1},
    documentElement:{id:'documentElement',nodeType:1},
    head:{appendChild(){}},
    getElementById(id){
      if(id==='rc626Abd')return hasHost?host:null;
      if(id==='rc1294AbdAnalysis')return hasPanel?panel:null;
      if(id==='content')return content;
      return null;
    },
    querySelector(){return null},
    addEventListener(){},
    createElement(){throw new Error('DOM-Erzeugung ist in diesem Sync-Gate-Test nicht vorgesehen')}
  };
  class MutationObserver{
    constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this)}
    observe(target,options){this.target=target;this.options=options;this.disconnected=false}
    disconnect(){this.disconnected=true}
  }
  const window={
    document,
    MutationObserver,
    addEventListener(name,fn){events.set(name,fn)},
    setTimeout(fn,ms){timers.push({fn,ms});return timers.length},
    sessionStorage:{length:0,getItem(){return null},key(){return null}},
    navigator:{},
    location:{hostname:'test.local'}
  };
  vm.runInNewContext(source,{
    window,document,MutationObserver,console,String,Array,Object,JSON,Date,Promise,Intl,URL,Uint8Array,
    btoa(){return''},
    setTimeout:window.setTimeout
  },{filename:'rc1294-abd-self-service.js'});
  function flush(){
    let guard=0;
    while(timers.length){
      if(++guard>20)throw new Error('Timer-Schleife im Test');
      for(const timer of timers.splice(0))timer.fn();
    }
  }
  return{events,timers,observers,flush,setHost(v){hasHost=!!v},setPanel(v){hasPanel=!!v}};
}

test('RC1513: globaler Sync ohne ABD-Bereich plant keinen Mount-Timer',()=>{
  const h=harness({hostPresent:false,panelPresent:false});
  h.flush();
  assert.equal(h.timers.length,0);
  const sync=h.events.get('exporthub:sync');
  assert.equal(typeof sync,'function');
  sync();
  assert.equal(h.timers.length,0,'off-view Sync darf keinen RC1294-Mount-Timer planen');
});

test('RC1513: Sync im vorhandenen ABD-Bereich behält den Mount-Refresh',()=>{
  const h=harness({hostPresent:true,panelPresent:true});
  h.flush();
  assert.equal(h.timers.length,0);
  const sync=h.events.get('exporthub:sync');
  assert.equal(typeof sync,'function');
  sync();
  assert.equal(h.timers.length,1,'ABD-Sync muss den bestehenden Mount-Refresh behalten');
});
