import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function element({matches=false,nested=false}={}){
  return {
    nodeType:1,
    matches(selector){return matches&&selector==='a.doc[href*="action=download-all"]'},
    querySelector(selector){return nested&&selector==='a.doc[href*="action=download-all"]'?element({matches:true}):null},
    querySelectorAll(){return []},
    appendChild(){},
    getAttribute(){return null},
    setAttribute(){},
    removeAttribute(){},
    classList:{remove(){},add(){}},
    closest(){return null}
  };
}

function loadHarness(){
  const source=fs.readFileSync('assets/rc1454-avis-download-all-ui.js','utf8');
  let observer=null;
  let frameCalls=0;
  const content=element();
  const head={appendChild(){}};
  const documentElement={appendChild(){}};
  const doc={
    readyState:'complete',
    head,
    documentElement,
    body:content,
    getElementById(id){return id==='content'?content:null},
    createElement(){return element()},
    querySelectorAll(){return []},
    addEventListener(){}
  };
  class MutationObserver{
    constructor(callback){this.callback=callback;observer=this}
    observe(){}
    disconnect(){}
  }
  const root={
    document:doc,
    MutationObserver,
    requestAnimationFrame(){frameCalls+=1;return frameCalls},
    setTimeout(){frameCalls+=1;return frameCalls}
  };
  const context=vm.createContext({window:root,document:doc,MutationObserver,console,Array,String});
  vm.runInContext(source,context,{filename:'rc1454-avis-download-all-ui.js'});
  return {observer:()=>observer,frameCalls:()=>frameCalls};
}

test('RC1475: unrelated AVIS content mutations do not schedule a full download-link rescan',()=>{
  const h=loadHarness();
  const before=h.frameCalls();
  h.observer().callback([{type:'childList',addedNodes:[element()],removedNodes:[]}]);
  assert.equal(h.frameCalls(),before,'unrelated AVIS DOM churn must not queue a full download-link scan');
});

test('RC1475: a newly added bulk-download link still schedules enhancement',()=>{
  const h=loadHarness();
  const before=h.frameCalls();
  h.observer().callback([{type:'childList',addedNodes:[element({matches:true})],removedNodes:[]}]);
  assert.equal(h.frameCalls(),before+1,'new bulk-download links must still be enhanced');
});

test('RC1475: a bulk-download link nested in a newly added subtree still schedules enhancement',()=>{
  const h=loadHarness();
  const before=h.frameCalls();
  h.observer().callback([{type:'childList',addedNodes:[element({nested:true})],removedNodes:[]}]);
  assert.equal(h.frameCalls(),before+1,'nested bulk-download links must still be enhanced');
});
