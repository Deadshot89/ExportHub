import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtimePath=new URL('../assets/rc1371-dashboard-personalization.js',import.meta.url);

function storage(){
  const data=new Map();
  return {
    getItem:key=>data.has(String(key))?data.get(String(key)):null,
    setItem:(key,value)=>data.set(String(key),String(value)),
    removeItem:key=>data.delete(String(key)),
    clear:()=>data.clear(),
    keys:()=>Array.from(data.keys()),
    raw:data
  };
}

function load(options={}){
  const code=fs.existsSync(runtimePath)?fs.readFileSync(runtimePath,'utf8'):'';
  const localStorage=options.localStorage||storage();
  const window={localStorage,...(options.window||{})};
  window.window=window;
  const context={window,localStorage,console,JSON,String,Array,Object,Map,Set,Date,Math,Number,Boolean,RegExp,encodeURIComponent,decodeURIComponent};
  vm.runInNewContext(code,context,{filename:'rc1371-dashboard-personalization.js'});
  return {api:window.ExportHUBDashboard1371,window,localStorage};
}

const registry=[
  {id:'open-shipments',defaultSize:'M',allowedSizes:['S','M','L']},
  {id:'due-tasks',defaultSize:'L',allowedSizes:['M','L','XL']},
  {id:'warnings',defaultSize:'M',allowedSizes:['M','L']}
];

test('RC1371 trennt Layout-State strikt nach Benutzer',()=>{
  const {api,localStorage}=load();
  assert.ok(api,'ExportHUBDashboard1371 fehlt');
  const a=api.layoutStorageKey('user-a');
  const b=api.layoutStorageKey('user-b');
  assert.match(a,/^exporthub\.dashboard\.layout\.v1\./);
  assert.match(b,/^exporthub\.dashboard\.layout\.v1\./);
  assert.notEqual(a,b);
  assert.equal(api.writeLayout('user-a',{schema:'v1',template:'standard',widgets:[{id:'open-shipments',visible:false,size:'M',order:0}]}),true);
  assert.equal(api.writeLayout('user-b',{schema:'v1',template:'standard',widgets:[{id:'open-shipments',visible:true,size:'M',order:0}]}),true);
  assert.notEqual(localStorage.getItem(a),localStorage.getItem(b));
  assert.equal(api.readLayout('user-a',registry).widgets.find(w=>w.id==='open-shipments').visible,false);
  assert.equal(api.readLayout('user-b',registry).widgets.find(w=>w.id==='open-shipments').visible,true);
});

test('RC1371 schreibt ohne stabile Benutzeridentität keinen persistenten State',()=>{
  const {api,localStorage}=load();
  assert.ok(api);
  assert.equal(api.layoutStorageKey(''),'');
  assert.equal(api.writeLayout('',{schema:'v1',template:'standard',widgets:[]}),false);
  assert.deepEqual(localStorage.keys(),[]);
});

test('RC1371 repariert ungültige Größen auf defaultSize',()=>{
  const {api}=load();
  assert.ok(api);
  const state=api.normalizeLayout({schema:'v1',template:'standard',widgets:[{id:'open-shipments',visible:true,size:'XXL',order:7}]},registry);
  const row=state.widgets.find(w=>w.id==='open-shipments');
  assert.equal(row.size,'M');
  assert.equal(row.visible,true);
});

test('RC1371 ignoriert unbekannte Widget-IDs',()=>{
  const {api}=load();
  assert.ok(api);
  const state=api.normalizeLayout({schema:'v1',template:'standard',widgets:[{id:'ghost-widget',visible:true,size:'XL',order:0},{id:'due-tasks',visible:false,size:'L',order:1}]},registry);
  assert.equal(state.widgets.some(w=>w.id==='ghost-widget'),false);
  assert.equal(state.widgets.some(w=>w.id==='due-tasks'),true);
});

test('RC1371 fällt bei defektem JSON auf Standard zurück',()=>{
  const localStorage=storage();
  const {api}=load({localStorage});
  assert.ok(api);
  localStorage.setItem(api.layoutStorageKey('user-a'),'{not-json');
  const state=api.readLayout('user-a',registry);
  assert.equal(state.schema,'v1');
  assert.equal(state.template,'standard');
  assert.deepEqual(state.widgets.map(w=>w.id),registry.map(w=>w.id));
});

test('RC1371 reset löscht nur den aktuellen Benutzer-Key',()=>{
  const localStorage=storage();
  const {api}=load({localStorage});
  assert.ok(api);
  api.writeLayout('user-a',{schema:'v1',template:'standard',widgets:[]});
  api.writeLayout('user-b',{schema:'v1',template:'standard',widgets:[]});
  assert.equal(api.resetLayout('user-a'),true);
  assert.equal(localStorage.getItem(api.layoutStorageKey('user-a')),null);
  assert.notEqual(localStorage.getItem(api.layoutStorageKey('user-b')),null);
});

test('RC1371 liefert alle fünf Vorlagen',()=>{
  const {api}=load();
  assert.ok(api);
  for(const name of ['standard','management','operativ','kompakt','analyse']){
    const state=api.templateLayout(name,registry);
    assert.equal(state.schema,'v1');
    assert.equal(state.template,name);
    assert.deepEqual(state.widgets.map(w=>w.id),registry.map(w=>w.id));
  }
});

test('RC1371 resolveUserIdentity bevorzugt stabile IDs vor Anzeigenamen',()=>{
  const {api}=load({window:{__EXPORTHUB_GET_CURRENT_USER__:()=>({id:'USER-42',name:'Max Mustermann',username:'max'})}});
  assert.ok(api);
  assert.equal(api.resolveUserIdentity(),'user-42');
});
