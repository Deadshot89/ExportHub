import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1092-customer-mail-contacts.js','utf8');

function harness(initialView='shipments'){
  const events=new Map(),observers=[],frames=[],timers=[];
  const state={view:initialView,customers:[]};
  const content={id:'content',nodeType:1};
  const documentElement={id:'documentElement',nodeType:1};
  const body={id:'body',nodeType:1};
  const document={
    readyState:'complete',
    documentElement,
    body,
    head:{appendChild(){}},
    getElementById(id){return id==='content'?content:null},
    querySelector(){return null},
    createElement(){return {id:'',className:'',style:{},setAttribute(){},appendChild(){},addEventListener(){}}},
    addEventListener(){}
  };
  class MutationObserver{
    constructor(callback){this.callback=callback;this.target=null;this.options=null;this.disconnected=false;observers.push(this)}
    observe(target,options){this.target=target;this.options=options;this.disconnected=false}
    disconnect(){this.disconnected=true}
  }
  const window={
    document,
    MutationObserver,
    __EXPORTHUB_GET_STATE__(){return state},
    addEventListener(name,fn){events.set(name,fn)},
    requestAnimationFrame(fn){frames.push(fn);return frames.length},
    setTimeout(fn,ms){timers.push({fn,ms});return timers.length}
  };
  vm.runInNewContext(source,{window,document,console,String,Array,Object,JSON,Date,Promise,CustomEvent:function(){},Math,Set},{filename:'rc1092-customer-mail-contacts.js'});
  return{
    events,observers,frames,timers,state,content,documentElement,
    flushFrames(){while(frames.length){frames.shift()()}},
    flushTimers(){while(timers.length){timers.shift().fn()}}
  };
}

test('RC1397: außerhalb des Kundenordners existiert kein Kundenkontakt-Observer',()=>{
  const h=harness('shipments');
  assert.equal(h.observers.length,0);
});

test('RC1397: Kundenordner beobachtet nur den lokalen Content-Bereich',()=>{
  const h=harness('customers');
  assert.equal(h.observers.length,1);
  assert.equal(h.observers[0].target,h.content);
  assert.notEqual(h.observers[0].target,h.documentElement);
  assert.equal(h.observers[0].options.childList,true);
  assert.equal(h.observers[0].options.subtree,true);
});

test('RC1397: View-Wechsel aktiviert und deaktiviert den lokalen Observer',()=>{
  const h=harness('shipments');
  const viewchange=h.events.get('exporthub:viewchange');
  assert.equal(typeof viewchange,'function');
  h.state.view='customers';
  viewchange();
  assert.equal(h.observers.length,1);
  assert.equal(h.observers[0].target,h.content);
  h.state.view='shipments';
  viewchange();
  assert.equal(h.observers[0].disconnected,true);
});

test('RC1397: 100 Mutationssignale werden auf einen Render-Frame zusammengefasst',()=>{
  const h=harness('customers');
  const observer=h.observers[0];
  h.flushFrames();
  const before=h.frames.length;
  for(let i=0;i<100;i++)observer.callback([]);
  assert.equal(h.frames.length-before,1);
});

test('RC1397: kein documentElement-MutationObserver bleibt in der Runtime',()=>{
  assert.doesNotMatch(source,/observe\(d\.documentElement/);
  assert.match(source,/observer\.observe\(root,\{childList:true,subtree:true\}\)/);
});
