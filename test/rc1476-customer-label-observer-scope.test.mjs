import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function el({text='',matchesHeading=false,children=[]}={}){
  const node={
    nodeType:1,
    textContent:text,
    className:'',
    tagName:'DIV',
    parentElement:null,
    children,
    closest(){return null},
    matches(selector){return matchesHeading&&selector.includes('h1')},
    querySelectorAll(){return children},
    setAttribute(){},
    getAttribute(){return null}
  };
  for(const child of children){if(child&&typeof child==='object')child.parentElement=node}
  return node;
}

function harness(){
  const source=fs.readFileSync('assets/rc1077-customer-labels.js','utf8');
  let observer=null;
  let frameCalls=0;
  const content=el();
  const body=el();
  body.setAttribute=()=>{};
  const doc={
    readyState:'complete',
    body,
    head:{appendChild(){}},
    documentElement:{appendChild(){}},
    getElementById(id){if(id==='content')return content;if(id==='rc1077CustomerLabelsStyle')return {};return null},
    querySelector(selector){if(selector==='main')return null;return null},
    createElement(){return {id:'',textContent:'',setAttribute(){}}},
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
    __EXPORTHUB_GET_STATE__(){return {view:'customers'}},
    addEventListener(){},
    requestAnimationFrame(callback){frameCalls+=1;callback();return frameCalls},
    setTimeout(callback){frameCalls+=1;callback();return frameCalls}
  };
  const context=vm.createContext({window:root,document:doc,MutationObserver,console,String,Array});
  vm.runInContext(source,context,{filename:'rc1077-customer-labels.js'});
  return {observer:()=>observer,frameCalls:()=>frameCalls,content};
}

test('RC1476: unrelated customer DOM mutations do not schedule a full label rescan',()=>{
  const h=harness();
  const before=h.frameCalls();
  const unrelated=el({text:'Auftrag 123'});
  h.observer().callback([{type:'childList',target:h.content,addedNodes:[unrelated],removedNodes:[]}]);
  assert.equal(h.frameCalls(),before,'unrelated customer DOM churn must not queue another full customer-label scan');
});

test('RC1476: newly added Firma heading still schedules label normalization',()=>{
  const h=harness();
  const before=h.frameCalls();
  const heading=el({text:'Firma',matchesHeading:true});
  h.observer().callback([{type:'childList',target:h.content,addedNodes:[heading],removedNodes:[]}]);
  assert.equal(h.frameCalls(),before+1,'new Firma headings must still schedule normalization');
});

test('RC1476: text-node style updates that make an existing heading Firma still schedule normalization',()=>{
  const h=harness();
  const before=h.frameCalls();
  const heading=el({text:'Firma',matchesHeading:true});
  const textNode={nodeType:3,nodeValue:'Firma',parentElement:heading};
  h.observer().callback([{type:'childList',target:heading,addedNodes:[textNode],removedNodes:[]}]);
  assert.equal(h.frameCalls(),before+1,'existing headings that become Firma must still schedule normalization');
});

test('RC1476: nested removals that expose Firma in an ancestor heading still schedule normalization',()=>{
  const h=harness();
  const before=h.frameCalls();
  const heading=el({text:'Firma',matchesHeading:true});
  const inner=el({text:''});
  inner.parentElement=heading;
  const removed={nodeType:3,nodeValue:'X',parentElement:null};
  h.observer().callback([{type:'childList',target:inner,addedNodes:[],removedNodes:[removed]}]);
  assert.equal(h.frameCalls(),before+1,'ancestor headings exposed as Firma by removals must still schedule normalization');
});
