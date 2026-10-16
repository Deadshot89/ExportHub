import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function read(path){return fs.readFileSync(path,'utf8');}
function loadStore(initialState){
  const source=read('assets/rc1555-packaging-store.js');
  const events=[];
  class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}}
  const root={
    __EXPORTHUB_GET_STATE__:()=>initialState,
    CustomEvent,
    dispatchEvent:event=>{events.push(event);return true;},
    addEventListener(){},removeEventListener(){},
    fetch:async()=>({ok:true,json:async()=>({ok:true,packaging:[]})})
  };
  vm.runInContext(source,vm.createContext({window:root,globalThis:root,CustomEvent,Map,Set,Object,Array,String,JSON,Promise,console}));
  return{store:root.ExportHUBPackagingStore,events};
}

test('RC1555 browser packaging store exposes canonical active records only and supports id name code lookup',()=>{
  const state={packagingTypes:[
    {id:'P1',name:'Euro Palette',code:'EUR',active:true,l:120,w:80,h:145},
    {id:'P2',name:'Alte Kiste',code:'OLD',active:false,l:40,w:30,h:20}
  ]};
  const {store}=loadStore(state);
  store.replace(state.packagingTypes,{silent:true});
  assert.equal(Array.from(store.activeItems(),x=>x.id).join(','),'P1');
  assert.equal(store.get('P1').name,'Euro Palette');
  assert.equal(store.get('euro palette').id,'P1');
  assert.equal(store.get('eur').id,'P1');
});

test('RC1555 browser packaging store updates locally and emits collection event without page reload',()=>{
  const source=read('assets/rc1555-packaging-store.js');
  assert.doesNotMatch(source,/location\.reload|location\.assign|location\.replace|window\.location\s*=/i);
  const {store,events}=loadStore({packagingTypes:[]});
  store.replace([{id:'P1',name:'Kiste',code:'K',active:true}],{reason:'test'});
  assert.equal(store.activeItems().length,1);
  assert.ok(events.some(e=>e.type==='exporthub:packaging-masterdata-changed'));
});

test('RC1555 shared packaging catalog is an adapter and no longer owns hard-coded production dimensions',()=>{
  const source=read('assets/packaging-catalog.js');
  assert.match(source,/ExportHUBPackagingStore/,'catalog must delegate to canonical browser store');
  assert.doesNotMatch(source,/const\s+entries\s*=\s*\[/,'catalog must not own a parallel entries array');
  assert.doesNotMatch(source,/length\s*:\s*(?:43|80|120|122)|width\s*:\s*(?:31|60|80|90|100|116)|height\s*:\s*31|ldm\s*:\s*0\.06/,'catalog may keep aliases but must not own production dimensions');
});

test('RC1555 pack pages load canonical store before catalog and pack client',()=>{
  for(const file of ['pack.html','assets/pack.html']){
    const html=read(file),store=html.indexOf('/assets/rc1555-packaging-store.js'),catalog=html.indexOf('/assets/packaging-catalog.js'),client=html.indexOf('src="/assets/pack-notification.js?v=2"');
    assert.ok(store>=0,`${file}: canonical packaging store missing`);
    assert.ok(catalog>store,`${file}: catalog must load after store`);
    assert.ok(client>catalog,`${file}: pack client must load after catalog`);
  }
});

test('RC1555 packaging management syncs canonical packagingTypes and emits packaging-specific event',()=>{
  assert.equal(fs.existsSync('assets/rc1555-packaging-management.js'),true,'primary packaging master-data management runtime missing');
  const source=read('assets/rc1555-packaging-management.js');
  assert.match(source,/packagingTypes\s*=/,'management client must keep canonical packagingTypes in local state');
  assert.match(source,/exporthub:packaging-masterdata-changed/,'management mutation must refresh packaging consumers at collection granularity');
});

test('RC1555 QR client preserves canonical packaging id and sends it with draft and submit payloads',()=>{
  const source=read('assets/pack-notification.js');
  assert.match(source,/id:String\(raw&&raw\.id\|\|''\)/,'master packaging entry must retain canonical id');
  assert.match(source,/code:String\(raw&&raw\.code\|\|''\)/,'master packaging entry must retain canonical code');
  assert.match(source,/packageTypeId:entry\?entry\.id:''/,'draft payload must send selected canonical packaging id');
  assert.match(source,/packageTypeId:packageEntry\?packageEntry\.id:''/,'submit payload must send selected canonical packaging id');
});

test('RC1555 shipment packaging chooser is searchable without replacing the existing RC682 selection behavior',()=>{
  assert.equal(fs.existsSync('assets/rc1555-packaging-shipment.js'),true,'shipment packaging search runtime missing');
  const source=read('assets/rc1555-packaging-shipment.js');
  assert.match(source,/\.rc682-packaging-menu/,'runtime must enhance the existing RC682 packaging menu');
  assert.match(source,/\.rc682-packaging-option/,'runtime must filter existing RC682 packaging options rather than replace selection logic');
  assert.match(source,/type\s*=\s*['"]search['"]/,'shipment packaging chooser must contain a search input');
  assert.match(source,/common\.search/,'search label must use the central six-language i18n key');
  assert.match(source,/option\.hidden\s*=\s*!visible/,'search must filter packaging options in place');
  assert.match(source,/rc1096-packaging-col/,'empty packaging groups must be hidden while filtering');
  assert.match(source,/MutationObserver/,'dynamically rendered shipment rows/menus must be enhanced');
  assert.match(source,/exporthub:packaging-masterdata-changed/,'masterdata changes must trigger selector re-enhancement without a page reload');
  assert.doesNotMatch(source,/location\.reload|location\.assign|location\.replace/i,'searchable shipment selector must not reload the application');
});