import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');

function harness(initialHost=true){
  const observers=[],events=new Map(),timers=[];
  const host={id:'rc626Abd',nodeType:1,querySelector(){return null},insertBefore(){},firstChild:null};
  const body={id:'body',nodeType:1,appendChild(){}};
  const documentElement={id:'documentElement',nodeType:1};
  let currentHost=initialHost?host:null;
  const document={
    readyState:'complete',
    body,
    documentElement,
    getElementById(id){
      if(id==='rc626Abd')return currentHost;
      return null;
    },
    createElement(){return {style:{},setAttribute(){},appendChild(){},addEventListener(){},remove(){},querySelector(){return null}}},
    addEventListener(){},
    querySelector(){return null}
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
    navigator:{},
    location:{hostname:'www.exporthub360.de'}
  };
  vm.runInNewContext(source,{window,document,console,String,Array,Object,JSON,Date,Promise,Intl,Uint8Array,MutationObserver,setTimeout:window.setTimeout,btoa(){return''}},{filename:'rc1294-abd-self-service.js'});
  return{observers,events,timers,host,body,documentElement,setHost(value){currentHost=value?host:null}};
}

test('RC1406: sichtbarer ABD-Bereich wird nur lokal beobachtet',()=>{
  const h=harness(true);
  assert.equal(h.observers.length,1);
  assert.equal(h.observers[0].target,h.host);
  assert.notEqual(h.observers[0].target,h.body);
  assert.notEqual(h.observers[0].target,h.documentElement);
  assert.deepEqual(h.observers[0].options,{childList:true,subtree:true});
});

test('RC1406: ohne ABD-Bereich existiert nur ein leichter Bootstrap-Observer',()=>{
  const h=harness(false);
  assert.equal(h.observers.length,1);
  assert.equal(h.observers[0].target,h.body);
  assert.equal(h.observers[0].options.childList,true);
  assert.equal(h.observers[0].options.subtree,true);
  assert.equal(h.observers[0].options.attributes,undefined);
  assert.equal(h.observers[0].options.characterData,undefined);
});

test('RC1406: später eingefügter ABD-Bereich schaltet vom Bootstrap auf lokalen Observer',()=>{
  const h=harness(false);
  const bootstrap=h.observers[0];
  h.setHost(true);
  bootstrap.callback([{addedNodes:[h.host]}]);
  assert.equal(bootstrap.disconnected,true);
  assert.equal(h.observers.length,2);
  assert.equal(h.observers[1].target,h.host);
});

test('RC1406: kein permanenter documentElement-Observer bleibt in der Runtime',()=>{
  assert.doesNotMatch(source,/\.observe\(d\.documentElement\|\|d\.body/);
  assert.match(source,/observer\.observe\(host,\{childList:true,subtree:true\}\)/);
  assert.match(source,/bootstrapObserver\.observe\(root,\{childList:true,subtree:true\}\)/);
  assert.match(source,/version:'RC1406'/);
});
