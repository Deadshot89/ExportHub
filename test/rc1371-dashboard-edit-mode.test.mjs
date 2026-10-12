import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/rc1371-dashboard-personalization.js',import.meta.url),'utf8');

function makeStorage(){
  const data=new Map();let writes=0;
  return {
    getItem:k=>data.get(String(k))??null,
    setItem(k,v){writes++;data.set(String(k),String(v))},
    removeItem:k=>data.delete(String(k)),
    keys:()=>[...data.keys()],
    writes:()=>writes,
    data
  };
}
function root(){
  const attrs=new Map();
  return {
    id:'dashboardRoot',children:[],
    setAttribute(k,v){attrs.set(k,String(v))},getAttribute:k=>attrs.get(k)||null,hasAttribute:k=>attrs.has(k),removeAttribute:k=>attrs.delete(k),
    querySelectorAll(){return []},querySelector(){return null},appendChild(node){this.children.push(node);node.parentNode=this;return node},
    addEventListener(){},removeEventListener(){},
  };
}
function load(){
  const localStorage=makeStorage();
  const win={localStorage,currentUser:{id:'user-1'},dispatchEvent(){},CustomEvent:function(type,init){this.type=type;this.detail=init?.detail}};win.window=win;
  const context={window:win,localStorage,console,JSON,String,Array,Object,Map,Set,Date,Math,Number,Boolean,RegExp,encodeURIComponent,decodeURIComponent,CustomEvent:win.CustomEvent};
  vm.runInNewContext(source,context,{filename:'rc1371-dashboard-personalization.js'});
  const api=win.ExportHUBDashboard1371;
  api.registerWidget({id:'a',defaultSize:'M',allowedSizes:['S','M','L'],category:'kpis'});
  api.registerWidget({id:'b',defaultSize:'L',allowedSizes:['M','L','XL'],category:'analyses'});
  return {api,localStorage,win};
}

test('RC1371 Edit-Mode ist idempotent',()=>{
  const {api}=load();
  assert.equal(typeof api.enterEditMode,'function');
  assert.equal(api.enterEditMode(),true);
  assert.equal(api.enterEditMode(),true);
  assert.equal(api.isEditing(),true);
  assert.equal(api.exitEditMode(),true);
  assert.equal(api.isEditing(),false);
});

test('RC1371 add hide move resize ändern nur Layout-State und speichern pro Commit einmal',()=>{
  const {api,localStorage}=load();
  api.mount(root());
  const baseWrites=localStorage.writes();
  assert.equal(api.hideWidget('a'),true);
  assert.equal(localStorage.writes(),baseWrites+1);
  assert.equal(api.addWidget('a'),true);
  assert.equal(api.resizeWidget('a','L'),true);
  assert.equal(api.resizeWidget('a','XL'),false,'XL ist für a nicht erlaubt');
  assert.equal(api.moveWidget('b','a'),true);
  const state=api.currentLayout();
  assert.equal(state.widgets.find(w=>w.id==='a').visible,true);
  assert.equal(state.widgets.find(w=>w.id==='a').size,'L');
  assert.deepEqual(state.widgets.filter(w=>w.id==='a'||w.id==='b').map(w=>w.id),['b','a']);
});

test('RC1371 Vorlagenwechsel überschreibt nur persönlichen Layout-State',()=>{
  const {api,localStorage}=load();
  api.mount(root());
  localStorage.setItem('unrelated','keep');
  assert.equal(api.applyTemplate('kompakt'),true);
  assert.equal(api.currentLayout().template,'kompakt');
  assert.equal(localStorage.getItem('unrelated'),'keep');
});

test('RC1371 Standard wiederherstellen löscht nur Dashboard-Pref und hält Standard im Speicher',()=>{
  const {api,localStorage}=load();
  api.mount(root());
  api.hideWidget('a');
  localStorage.setItem('unrelated','keep');
  const key=api.layoutStorageKey('user-1');
  assert.notEqual(localStorage.getItem(key),null);
  assert.equal(api.restoreStandard(),true);
  assert.equal(localStorage.getItem(key),null);
  assert.equal(localStorage.getItem('unrelated'),'keep');
  assert.equal(api.currentLayout().template,'standard');
});

test('RC1371 schreibt nicht während Pointerbewegung sondern nur bei Commit',()=>{
  assert.doesNotMatch(source,/pointermove[\s\S]{0,180}writeLayout\s*\(/i);
  assert.match(source,/exporthub:dashboard-layoutchange/);
});

test('RC1371 bietet Tastatur-/Button-Verschiebung und Widget-Bibliothek',()=>{
  const {api}=load();
  assert.equal(typeof api.moveWidgetBy,'function');
  assert.equal(typeof api.openLibrary,'function');
  assert.equal(typeof api.closeLibrary,'function');
  assert.match(source,/moveUp|moveDown/);
});

test('RC1371 mount ist bei wiederholtem Render idempotent',()=>{
  const {api}=load();
  const r=root();
  assert.equal(api.mount(r),true);
  const first=api.mountedRoot();
  assert.equal(api.mount(r),true);
  assert.equal(api.mountedRoot(),first);
});

test('RC1371 sichtbarer Editor verdrahtet Bibliothek hinzufügen und schließen',()=>{
  assert.match(source,/action==='libraryAdd'[\s\S]{0,180}addWidget\s*\(/);
  assert.match(source,/action==='libraryClose'[\s\S]{0,120}closeLibrary\s*\(/);
});

test('RC1371 Widget-Steuerung bietet nur erlaubte S M L XL Größen an',()=>{
  assert.match(source,/data-rc1371-size-choice/);
  assert.match(source,/allowedSizes\(def\)/);
  assert.match(source,/action==='resizeWidget'[\s\S]{0,180}resizeWidget\s*\(/);
});

test('RC1371 Toolbar bietet alle fünf Vorlagen und reagiert auf Auswahl',()=>{
  assert.match(source,/data-rc1371-template-select/);
  for(const name of ['standard','management','operativ','kompakt','analyse'])assert.ok(source.includes(name));
  assert.match(source,/applyTemplate\s*\(/);
});

test('RC1371 Widget-Bibliothek filtert Suchtext ohne neue Datenabfrage',()=>{
  assert.match(source,/function filterLibrary\s*\(/);
  assert.match(source,/data-rc1371-library-search/);
  assert.match(source,/addEventListener\(['"]input['"]/);
  assert.doesNotMatch(source,/filterLibrary[\s\S]{0,600}\bfetch\s*\(/);
});

test('RC1371 Reihenfolge wird im CSS-Grid sichtbar angewendet',()=>{
  assert.match(source,/node\.style\.order\s*=\s*String\(/);
});

test('RC1371 Layout-State darf bestehende Rechte niemals sichtbar überschreiben',()=>{
  assert.match(source,/canUseWidget\(def\)/);
  assert.match(source,/node\.hidden\s*=\s*!permitted\s*\|\|\s*row\.visible===false/);
});

test('RC1371 Vorlagen unterscheiden sich funktional statt nur im Namen',()=>{
  const {api}=load();
  const standard=api.templateLayout('standard',api.registry());
  const compact=api.templateLayout('kompakt',api.registry());
  const analysis=api.templateLayout('analyse',api.registry());
  const signature=s=>JSON.stringify(s.widgets.map(w=>[w.id,w.visible,w.size,w.order]));
  assert.notEqual(signature(standard),signature(compact));
  assert.notEqual(signature(standard),signature(analysis));
});

test('RC1371 inferiert ohne View-State nicht jedes #content als Dashboard',()=>{
  assert.doesNotMatch(source,/return view==='dashboard'\|\|\(!view&&!!discoverDashboardRoot\(\)\)/);
  assert.match(source,/function explicitDashboardRoot\s*\(/);
});
