import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1193-visible-release.js','utf8');

function element(name){
  return {
    name,
    nodeType:1,
    childElementCount:0,
    textContent:'',
    parentElement:null,
    parentNode:null,
    queryCount:0,
    hasAttribute(){return false},
    querySelectorAll(){this.queryCount++;return[]},
    setAttribute(){},
    contains(node){return node===this}
  };
}

function harness(){
  const timers=[];
  const observers=[];
  const documentElement=element('documentElement');
  const document={
    nodeType:9,
    readyState:'complete',
    title:'ExportHUB360',
    documentElement,
    body:element('body'),
    queryCount:0,
    querySelectorAll(){this.queryCount++;return[]},
    addEventListener(){}
  };
  class MutationObserver{
    constructor(callback){this.callback=callback;observers.push(this)}
    observe(target,options){this.target=target;this.options=options}
    disconnect(){}
  }
  const window={
    MutationObserver,
    addEventListener(){},
    setTimeout(fn,ms){timers.push({fn,ms});return timers.length}
  };
  vm.runInNewContext(source,{window,document,MutationObserver,setTimeout:window.setTimeout,String,Array,Object,JSON,Date,console},{filename:'rc1193-visible-release.js'});
  assert.equal(observers.length,1,'sichtbare Version behält genau einen Observer');
  assert.equal(timers.length,1,'initialer vollständiger Patch bleibt geplant');
  timers.shift().fn();
  document.queryCount=0;
  documentElement.queryCount=0;
  return{window,document,documentElement,timers,observer:observers[0]};
}

test('RC1442: removal-only DOM mutation plant keinen Versionsscan',()=>{
  const h=harness();
  const removed=element('removed');
  h.observer.callback([{type:'childList',target:h.documentElement,addedNodes:[],removedNodes:[removed]}]);
  assert.equal(h.timers.length,0,'reine Entfernung darf keinen Timer und damit keinen Vollscan auslösen');
  assert.equal(h.document.queryCount,0);
});

test('RC1442: hinzugefügter Knoten wird weiterhin gezielt geprüft',()=>{
  const h=harness();
  const added=element('added');
  h.observer.callback([{type:'childList',target:h.documentElement,addedNodes:[added],removedNodes:[]}]);
  assert.equal(h.timers.length,1);
  h.timers.shift().fn();
  assert.equal(added.queryCount,1,'neuer Teilbaum muss weiterhin gepatcht werden');
  assert.equal(h.document.queryCount,0,'Addition darf keinen unnötigen Vollscan auslösen');
});

test('RC1442: characterData und expliziter Vollpatch bleiben erhalten',()=>{
  const h=harness();
  const parent=element('parent');
  const text={nodeType:3,parentElement:parent,parentNode:parent};
  h.observer.callback([{type:'characterData',target:text,addedNodes:[],removedNodes:[]}]);
  assert.equal(h.timers.length,1);
  h.timers.shift().fn();
  assert.equal(parent.queryCount,1,'Textänderung muss weiterhin den betroffenen Teilbaum prüfen');
  assert.equal(h.document.queryCount,0);

  h.window.ExportHUBVisibleRelease1193.schedule();
  assert.equal(h.timers.length,1);
  h.timers.shift().fn();
  assert.equal(h.document.queryCount,1,'explizite Lifecycle-Patches bleiben vollständige Patches');
});
