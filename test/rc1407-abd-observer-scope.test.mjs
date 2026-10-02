import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');

function harness({hostPresent=true,panelPresent=true}={}){
  const events=new Map(),observers=[],timers=[];
  let hasHost=hostPresent,hasPanel=panelPresent;
  const host={id:'rc626Abd',nodeType:1};
  const content={id:'content',nodeType:1};
  const documentElement={id:'documentElement',nodeType:1};
  const body={id:'body',nodeType:1};
  const panel={id:'rc1294AbdAnalysis',remove(){hasPanel=false},querySelector(){return null}};
  const document={
    readyState:'complete',
    documentElement,
    body,
    head:{appendChild(){}},
    getElementById(id){
      if(id==='rc626Abd')return hasHost?host:null;
      if(id==='rc1294AbdAnalysis')return hasPanel?panel:null;
      if(id==='content')return content;
      return null;
    },
    querySelector(){return null},
    addEventListener(){},
    createElement(){throw new Error('DOM-Erzeugung ist in diesem Observer-Test nicht vorgesehen')}
  };
  class MutationObserver{
    constructor(callback){this.callback=callback;this.target=null;this.options=null;this.disconnected=false;observers.push(this)}
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
      const batch=timers.splice(0);
      for(const timer of batch)timer.fn();
    }
  }
  return{
    events,observers,timers,host,content,documentElement,
    setHost(value){hasHost=!!value},
    setPanel(value){hasPanel=!!value},
    flush
  };
}

test('RC1407: vorhandener ABD-Bereich wird ausschließlich lokal beobachtet',()=>{
  const h=harness({hostPresent:true,panelPresent:true});
  assert.equal(h.observers.length,1);
  assert.equal(h.observers[0].target,h.host);
  assert.notEqual(h.observers[0].target,h.documentElement);
  assert.equal(h.observers[0].options.childList,true);
  assert.equal(h.observers[0].options.subtree,true);
  h.flush();
});

test('RC1407: ohne ABD-Bereich bleibt nur ein temporärer Bootstrap-Observer im Content',()=>{
  const h=harness({hostPresent:false,panelPresent:false});
  assert.equal(h.observers.length,1);
  assert.equal(h.observers[0].target,h.content);
  assert.notEqual(h.observers[0].target,h.documentElement);
  assert.equal(h.observers[0].options.childList,true);
  assert.equal(h.observers[0].options.subtree,true);
  h.flush();
});

test('RC1407: sobald der ABD-Bereich erscheint, wird Bootstrap getrennt und lokal weiterbeobachtet',()=>{
  const h=harness({hostPresent:false,panelPresent:false});
  h.flush();
  const bootstrap=h.observers[0];
  h.setHost(true);
  h.setPanel(true);
  bootstrap.callback([]);
  assert.equal(bootstrap.disconnected,true);
  assert.equal(h.timers.length,1);
  h.flush();
  const active=h.observers.filter(observer=>!observer.disconnected);
  assert.equal(active.length,1);
  assert.equal(active[0].target,h.host);
});

test('RC1407: Render- und Sync-Bursts erzeugen nur einen Mount-Timer',()=>{
  const h=harness({hostPresent:true,panelPresent:true});
  h.flush();
  assert.equal(h.timers.length,0);
  for(const name of ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync']){
    const fn=h.events.get(name);
    assert.equal(typeof fn,'function',name+' Event fehlt');
    fn();
  }
  assert.equal(h.timers.length,1);
  h.flush();
});

test('RC1407: alter dokumentweiter Observer und alter Cache-Key sind entfernt',()=>{
  assert.doesNotMatch(source,/\.observe\(d\.documentElement\|\|d\.body,\{childList:true,subtree:true\}\)/);
  assert.match(source,/hostObserver\.observe\(host,\{childList:true,subtree:true\}\)/);
  assert.match(source,/if\(mountTimer\)return true/);
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  assert.match(build,/assets\/rc1294-abd-self-service\.js\?v=1407/);
  assert.doesNotMatch(build,/assets\/rc1294-abd-self-service\.js\?v=1294/);
});
