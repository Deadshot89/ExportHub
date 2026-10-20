import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1499-exportexperte-handoff.js','utf8');

function harness({hostPresent=false}={}){
  const events=new Map(),timers=[],observers=[],appended=[];
  const nodesById=new Map();
  let hasHost=hostPresent;
  const host={id:'rc626Abd',nodeType:1,querySelector(){return null},insertBefore(){}};
  const documentElement={id:'documentElement',nodeType:1};
  const body={id:'body',nodeType:1,appendChild(node){appended.push(node)}};
  const head={appendChild(node){appended.push(node);if(node&&node.id)nodesById.set(node.id,node)}};
  function element(tag){
    return{
      tagName:String(tag).toUpperCase(),style:{},children:[],
      setAttribute(name,value){this[name]=String(value)},
      addEventListener(){},
      appendChild(node){this.children.push(node)},
      remove(){if(this.id)nodesById.delete(this.id)},
      click(){}
    };
  }
  const document={
    documentElement,body,head,
    getElementById(id){
      if(id==='rc626Abd')return hasHost?host:null;
      return nodesById.get(id)||null;
    },
    querySelector(selector){
      if(selector==='[data-rc1294-results]')return null;
      if(selector==='[data-rc1499-abd-prepared]')return null;
      return null;
    },
    createElement(tag){const node=element(tag);return node},
    dispatchEvent(){}
  };
  class MutationObserver{
    constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this)}
    observe(target,options){this.target=target;this.options=options;this.disconnected=false}
    disconnect(){this.disconnected=true}
  }
  const window={
    document,MutationObserver,
    addEventListener(name,fn){events.set(name,fn)},
    setTimeout(fn,ms){timers.push({fn,ms});return timers.length},
    sessionStorage:{length:0,getItem(){return null},key(){return null}},
    location:{hostname:'test.local'}
  };
  vm.runInNewContext(source,{window,globalThis:window,console,String,Array,Object,JSON,Date,Promise,Number,Math},{filename:'rc1499-exportexperte-handoff.js'});
  function flush(){
    let guard=0;
    while(timers.length){
      if(++guard>20)throw new Error('Timer-Schleife im Test');
      const batch=timers.splice(0);
      for(const timer of batch)timer.fn();
    }
  }
  return{
    events,timers,observers,appended,flush,
    setHost(value){hasHost=!!value},
    scriptCount(){return appended.filter(node=>node&&node.tagName==='SCRIPT').length}
  };
}

test('RC1514: Handoff bleibt beim Start außerhalb des ABD-/Analyse-Kontexts inaktiv',()=>{
  const h=harness({hostPresent:false});
  assert.equal(h.timers.length,0,'off-view Start darf keinen Handoff-Timer planen');
  assert.equal(h.scriptCount(),0,'off-view Start darf das ABD-Exportmodul nicht nachladen');
});

test('RC1514: globaler Sync außerhalb des ABD-/Analyse-Kontexts plant keinen Remount',()=>{
  const h=harness({hostPresent:false});
  h.flush();
  h.timers.length=0;
  const sync=h.events.get('exporthub:sync');
  assert.equal(typeof sync,'function');
  sync();
  assert.equal(h.timers.length,0,'off-view Sync darf keinen RC1499-Handoff-Remount planen');
});

test('RC1514: vorhandener ABD-Kontext behält Loader, Observer und Sync-Remount',()=>{
  const h=harness({hostPresent:true});
  assert.equal(h.scriptCount(),1,'sichtbarer ABD-Kontext muss das Exportmodul weiterhin laden');
  assert.equal(h.observers.length,1,'sichtbarer ABD-Kontext muss lokal beobachtet werden');
  h.flush();
  assert.equal(h.timers.length,0);
  const sync=h.events.get('exporthub:sync');
  assert.equal(typeof sync,'function');
  sync();
  assert.equal(h.timers.length,1,'sichtbarer ABD-Kontext muss den bestehenden Sync-Remount behalten');
});
