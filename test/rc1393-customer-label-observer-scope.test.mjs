import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1077-customer-labels.js','utf8');

function harness(initialView='shipments'){
  const events=new Map(),observers=[],frames=[];
  const state={view:initialView};
  const attrs=new Map();
  const content={
    id:'content',
    nodeType:1,
    querySelectorAll(){return[]}
  };
  const body={
    nodeType:1,
    getAttribute(name){return attrs.get(name)||''},
    setAttribute(name,value){attrs.set(name,String(value))}
  };
  const documentElement={nodeType:1};
  const head={appendChild(){}};
  const document={
    readyState:'complete',
    body,
    head,
    documentElement,
    getElementById(id){return id==='content'?content:null},
    querySelector(){return null},
    createElement(){return {id:'',textContent:'',setAttribute(){}}},
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
    setTimeout(fn){frames.push(fn);return frames.length}
  };
  vm.runInNewContext(source,{window,document,console,String,Array,Object,Math,Set},{filename:'rc1077-customer-labels.js'});
  return{
    events,observers,frames,state,content,documentElement,
    flush(){
      while(frames.length){const fn=frames.shift();fn()}
    }
  };
}

test('RC1393: außerhalb der Kundenansicht existiert kein Kundenlabel-Observer',()=>{
  const h=harness('shipments');
  assert.equal(h.observers.length,0);
});

test('RC1393: Kundenansicht beobachtet nur den lokalen Content-Bereich',()=>{
  const h=harness('customers');
  assert.equal(h.observers.length,1);
  assert.equal(h.observers[0].target,h.content);
  assert.notEqual(h.observers[0].target,h.documentElement);
  assert.equal(h.observers[0].options.subtree,true);
  assert.equal(h.observers[0].options.childList,true);
});

test('RC1393: View-Wechsel aktiviert und deaktiviert den lokalen Observer',()=>{
  const h=harness('shipments');
  h.flush();
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

test('RC1393: 100 Mutationssignale werden auf einen Render-Frame zusammengefasst',()=>{
  const h=harness('customers');
  h.flush();
  const observer=h.observers[0];
  const before=h.frames.length;
  for(let i=0;i<100;i++)observer.callback([]);
  assert.equal(h.frames.length-before,1);
});

test('RC1393: kein documentElement-MutationObserver bleibt in der Runtime',()=>{
  assert.doesNotMatch(source,/observe\(d\.documentElement/);
  assert.match(source,/observer\.observe\(root,\{subtree:true,childList:true\}\)/);
});
