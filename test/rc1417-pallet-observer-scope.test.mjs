import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1207-pallet-account-fix.js','utf8');

function harness(initialView='home'){
  const events=new Map(),observers=[],timers=[];
  const state={view:initialView,palletAccount:[],palletSettlements:[],auditLog:[],_teamSyncMeta:{fields:{},tombstones:[]}};
  const content={id:'content',nodeType:1,querySelector(){return null},querySelectorAll(){return[]}};
  const documentElement={id:'documentElement',nodeType:1};
  const document={
    readyState:'complete',
    body:{id:'body',nodeType:1},
    documentElement,
    getElementById(id){
      if(id==='content')return content;
      if(id==='rc542PalIn'||id==='rc542PalOut')return null;
      return null;
    },
    querySelector(){return null},
    querySelectorAll(){return[]},
    createElement(){return {setAttribute(){},addEventListener(){},classList:{toggle(){}}}},
    addEventListener(){}
  };
  class MutationObserver{
    constructor(callback){this.callback=callback;this.target=null;this.options=null;this.disconnected=false;observers.push(this)}
    observe(target,options){this.target=target;this.options=options;this.disconnected=false}
    disconnect(){this.disconnected=true}
  }
  const root={
    document,
    MutationObserver,
    __EXPORTHUB_FORCED_ENVIRONMENT__:'testservice',
    __EXPORTHUB_GET_STATE__(){return state},
    __EXPORTHUB_GET_CURRENT_USER__(){return {name:'Test'}},
    addEventListener(name,fn){events.set(name,fn)},
    setTimeout(fn,ms){timers.push({fn,ms});return timers.length},
    clearTimeout(){},
    canAdmin(){return true},
    rc542AddPalletBooking(){},
    console:{error(){}},
    location:{hostname:'test.example',pathname:'/'}
  };
  vm.runInNewContext(source,{globalThis:root,setTimeout:root.setTimeout,clearTimeout:root.clearTimeout,console:root.console},{filename:'rc1207-pallet-account-fix.js'});
  return{root,state,events,observers,timers,content,documentElement};
}

test('RC1417: außerhalb Palettenansicht existiert kein DOM-Observer',()=>{
  const h=harness('shipments');
  assert.equal(h.observers.length,0);
});

test('RC1417: Palettenansicht beobachtet nur den lokalen Content-Bereich',()=>{
  const h=harness('pallet');
  assert.equal(h.observers.length,1);
  assert.equal(h.observers[0].target,h.content);
  assert.notEqual(h.observers[0].target,h.documentElement);
  assert.deepEqual(h.observers[0].options,{childList:true,subtree:true});
});

test('RC1417: View-Wechsel aktiviert und deaktiviert den Paletten-Observer',()=>{
  const h=harness('shipments');
  const viewchange=h.events.get('exporthub:viewchange');
  assert.equal(typeof viewchange,'function');
  h.state.view='pallet';
  viewchange();
  assert.equal(h.observers.length,1);
  assert.equal(h.observers[0].target,h.content);

  h.state.view='shipments';
  viewchange();
  assert.equal(h.observers[0].disconnected,true);
});

test('RC1417: Runtime enthält keinen documentweiten MutationObserver mehr',()=>{
  assert.doesNotMatch(source,/MutationObserver\([^]*?observe\((?:target|root\.document\.body|root\.document\.documentElement)[^]*?subtree:true/);
  assert.doesNotMatch(source,/observe\(root\.document\.(?:body|documentElement)/);
  assert.match(source,/observer\.observe\(host,\{childList:true,subtree:true\}\)/);
});
