import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function nodeWithClass(name=''){
  return {
    nodeType:1,
    classList:{contains(value){return value===name}},
    querySelector(){return null},
    querySelectorAll(){return []}
  };
}

function loadHarness({fallback=false,anchorVisible=true}={}){
  const source=fs.readFileSync('assets/pack-notification-nav.js','utf8');
  let entry=nodeWithClass(fallback?'pack-notification-nav-fallback':'');
  let anchor=anchorVisible?nodeWithClass(''):null;
  let observer=null;
  let timerCalls=0;

  const documentElement=nodeWithClass('');
  const body=nodeWithClass('');
  body.appendChild=()=>{};
  const head={appendChild(){}};

  const doc={
    documentElement,
    body,
    head,
    querySelector(selector){
      if(selector==='[data-pack-notifications-nav]')return entry;
      if(selector==='[data-view="tasks"],[data-page="tasks"],[data-nav="tasks"]')return anchor;
      if(selector==='nav,[role="navigation"],.sidebar,.side-nav,.navigation')return body;
      return null;
    },
    querySelectorAll(){return []},
    addEventListener(){},
    getElementById(){return null},
    createElement(){
      const node=nodeWithClass('');
      node.setAttribute=()=>{};
      node.appendChild=()=>{};
      return node;
    }
  };

  class MutationObserver{
    constructor(callback){this.callback=callback;observer=this}
    observe(){}
    disconnect(){}
  }

  function setTimeoutStub(){timerCalls+=1;return timerCalls}
  function clearTimeoutStub(){}

  const root={document:doc,MutationObserver,ExportHUBPackNotifications:null};
  const context=vm.createContext({window:root,globalThis:root,console,setTimeout:setTimeoutStub,clearTimeout:clearTimeoutStub});
  vm.runInContext(source,context,{filename:'pack-notification-nav.js'});

  return {
    observer:()=>observer,
    timerCalls:()=>timerCalls,
    setEntry(value){entry=value},
    setAnchor(value){anchor=value}
  };
}

test('RC1474: unrelated DOM mutations do not schedule Packmeldungen navigation work',()=>{
  const h=loadHarness();
  const before=h.timerCalls();
  h.observer().callback([{type:'childList',target:nodeWithClass(''),addedNodes:[nodeWithClass('')],removedNodes:[]}]);
  assert.equal(h.timerCalls(),before,'unrelated document churn must not schedule another pack navigation route');
});

test('RC1474: missing Packmeldungen navigation is still repaired',()=>{
  const h=loadHarness();
  const before=h.timerCalls();
  h.setEntry(null);
  h.observer().callback([{type:'childList',target:nodeWithClass(''),addedNodes:[],removedNodes:[nodeWithClass('')]}]);
  assert.equal(h.timerCalls(),before+1,'removing the pack navigation entry must schedule repair');
});

test('RC1474: fallback navigation upgrades when the Aufgaben anchor appears',()=>{
  const h=loadHarness({fallback:true,anchorVisible:false});
  const before=h.timerCalls();
  const anchor=nodeWithClass('');
  h.setAnchor(anchor);
  h.observer().callback([{type:'childList',target:nodeWithClass(''),addedNodes:[anchor],removedNodes:[]}]);
  assert.equal(h.timerCalls(),before+1,'a newly available Aufgaben anchor must schedule fallback replacement');
});
