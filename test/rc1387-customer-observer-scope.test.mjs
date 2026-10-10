import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1126-customer-delete.js','utf8');

function harness(initialView='home'){
  const events=new Map(),observers=[],timers=[],nodes={};
  const state={view:initialView,customers:[]};
  const content={id:'content',nodeType:1};
  const documentElement={id:'documentElement',nodeType:1};
  const document={
    readyState:'complete',
    documentElement,
    body:{id:'body',nodeType:1},
    head:{appendChild(){}},
    getElementById(id){return id==='content'?content:(nodes[id]||null)},
    querySelector(){return null},
    createElement(){return {style:{},setAttribute(){},appendChild(){},addEventListener(){}}},
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
    setTimeout(fn,ms){timers.push({fn,ms});return timers.length}
  };
  vm.runInNewContext(source,{window,document,console,String,Array,Object,JSON,Date,Promise,CustomEvent:function(){}},{filename:'rc1126-customer-delete.js'});
  return{events,observers,timers,state,content,documentElement,nodes,window};
}

test('RC1387: außerhalb der Kundenansicht existiert kein DOM-Observer',()=>{
  const h=harness('shipments');
  assert.equal(h.observers.length,0);
});

test('RC1387: Kundenansicht beobachtet nur den lokalen Content-Bereich',()=>{
  const h=harness('customers');
  assert.equal(h.observers.length,1);
  assert.equal(h.observers[0].target,h.content);
  assert.notEqual(h.observers[0].target,h.documentElement);
  assert.equal(h.observers[0].options.childList,true);
  assert.equal(h.observers[0].options.subtree,true);
});

test('RC1387: View-Wechsel aktiviert und deaktiviert den lokalen Observer',()=>{
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

test('RC1479: fachfremde Kunden-DOM-Mutationen rendern vorhandene Löschbox nicht erneut',()=>{
  const h=harness('customers');
  const customer={id:'C1',name:'Kunde 1'};
  h.state.customers=[customer];
  h.state.currentCustomer=customer;
  h.window.currentUser={role:'admin'};
  h.nodes.rc1126CustomerDelete={
    id:'rc1126CustomerDelete',
    nodeType:1,
    getAttribute(name){return name==='data-customer-key'?'C1':null},
    remove(){delete h.nodes.rc1126CustomerDelete}
  };
  h.timers.shift().fn();
  const before=h.timers.length;
  h.observers[0].callback([{type:'childList',target:h.content,addedNodes:[{id:'shipment-summary',nodeType:1}],removedNodes:[]}]);
  assert.equal(h.timers.length-before,0,'unrelated customer DOM churn must not queue RC1126 render when the correct delete box already exists');
});

test('RC1479: fehlende Löschbox wird bei ausgewähltem Admin-Kunden weiterhin nachgerendert',()=>{
  const h=harness('customers');
  h.timers.shift().fn();
  const customer={id:'C1',name:'Kunde 1'};
  h.state.customers=[customer];
  h.state.currentCustomer=customer;
  h.window.currentUser={role:'admin'};
  const before=h.timers.length;
  h.observers[0].callback([{type:'childList',target:h.content,addedNodes:[{id:'customer-details',nodeType:1}],removedNodes:[]}]);
  assert.equal(h.timers.length-before,1,'missing RC1126 delete box must still queue a render for an admin customer');
});

test('RC1387: kein documentElement-MutationObserver bleibt in der Runtime',()=>{
  assert.doesNotMatch(source,/observe\(d\.documentElement/);
  assert.match(source,/observer\.observe\(root,\{childList:true,subtree:true\}\)/);
});
