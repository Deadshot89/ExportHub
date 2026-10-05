import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1176-shipment-location.js','utf8');

function harness(){
  const listeners={},timers=[],observers=[];
  const shipment={customerId:'C1'};
  const state={shipment,customers:[{id:'C1',locations:[{id:'L1',name:'Werk 1',address:'A'}]}]};
  const select={id:'index289LocationSelect',value:'L1',options:[{value:''},{value:'L1'}]};
  const documentElement={id:'documentElement'};
  const document={
    documentElement,
    body:{id:'body'},
    getElementById(id){return id==='index289LocationSelect'?select:null}
  };
  class MutationObserver{
    constructor(callback){this.callback=callback;this.target=null;this.options=null;this.disconnected=false;observers.push(this)}
    observe(target,options){this.target=target;this.options=options;this.disconnected=false}
    disconnect(){this.disconnected=true;this.target=null}
  }
  const window={
    document,
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_ACTIVE_SHIPMENT__:()=>shipment,
    addEventListener(name,fn,capture){listeners[name]=listeners[name]||[];listeners[name].push({fn,capture})},
    setTimeout(fn,delay){timers.push({fn,delay});return timers.length}
  };
  vm.runInNewContext(source,{window,document,MutationObserver,setTimeout:window.setTimeout,String,Array,Object,JSON,Date,console},{filename:'rc1176-shipment-location.js'});
  return{window,shipment,select,listeners,timers,observers,documentElement};
}

function locationChange(h){
  return (h.listeners.change||[]).find(x=>x.capture&&/onLocationChange/.test(String(x.fn)));
}

test('RC1439: im normalen Betrieb existiert kein Standort-MutationObserver',()=>{
  const h=harness();
  assert.equal(h.observers.length,0);
});

test('RC1439: Standortwahl aktiviert genau einen temporären Observer',()=>{
  const h=harness();
  const change=locationChange(h);
  assert.ok(change);
  change.fn({target:h.select,isTrusted:true});
  assert.equal(h.observers.length,1);
  assert.equal(h.observers[0].target,h.documentElement);
  assert.equal(h.observers[0].options.childList,true);
  assert.equal(h.observers[0].options.subtree,true);
  assert.equal(h.observers[0].disconnected,false);
});

test('RC1439: Mutation während pending repariert weiterhin die Standortauswahl',()=>{
  const h=harness();
  locationChange(h).fn({target:h.select,isTrusted:true});
  h.shipment.locationId='';
  h.shipment.selectedLocationId='';
  h.select.value='';
  h.observers[0].callback([]);
  assert.equal(h.select.value,'L1');
  assert.equal(h.shipment.locationId,'L1');
});

test('RC1439: clearPending trennt den temporären Observer sofort',()=>{
  const h=harness();
  locationChange(h).fn({target:h.select,isTrusted:true});
  const observer=h.observers[0];
  h.window.ExportHUBShipmentLocation1176.clearPending();
  assert.equal(observer.disconnected,true);
  assert.equal(observer.target,null);
  assert.equal(h.window.ExportHUBShipmentLocation1176.repairPending(),false);
});

test('RC1439: manuelles Leeren der Standortauswahl trennt den Observer ebenfalls sofort',()=>{
  const h=harness();
  const change=locationChange(h);
  change.fn({target:h.select,isTrusted:true});
  const observer=h.observers[0];
  h.select.value='';
  change.fn({target:h.select,isTrusted:true});
  assert.equal(observer.disconnected,true);
  assert.equal(observer.target,null);
});

test('RC1439: Runtime installiert beim Modulstart keinen permanenten Observer',()=>{
  assert.doesNotMatch(source,/if\(typeof MutationObserver!=='undefined'\)\{\s*try\{\s*observer=new MutationObserver/);
  assert.match(source,/function ensureObserver\(\)/);
  assert.match(source,/function clearPending\(\)\{pending=null;pendingSeq\+\+;disconnectObserver\(\)\}/);
});
