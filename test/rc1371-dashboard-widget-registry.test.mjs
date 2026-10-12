import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const path=new URL('../assets/rc1371-dashboard-personalization.js',import.meta.url);
const source=fs.readFileSync(path,'utf8');

function node(id='',attrs={}){
  const attributes=new Map(Object.entries(attrs));
  return {
    id,
    children:[],
    parentNode:null,
    getAttribute(name){return attributes.has(name)?attributes.get(name):null},
    setAttribute(name,value){attributes.set(name,String(value))},
    hasAttribute(name){return attributes.has(name)},
    querySelectorAll(){return this.children.slice()},
    querySelector(){return null}
  };
}

function load(extra={}){
  const localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  const window={localStorage,...extra};window.window=window;
  const context={window,localStorage,console,JSON,String,Array,Object,Map,Set,Date,Math,Number,Boolean,RegExp,encodeURIComponent,decodeURIComponent};
  vm.runInNewContext(source,context,{filename:'rc1371-dashboard-personalization.js'});
  return window.ExportHUBDashboard1371;
}

test('RC1371 registriert Widgets mit stabilen eindeutigen IDs',()=>{
  const api=load();
  assert.equal(typeof api.registerWidget,'function');
  api.registerWidget({id:'open-shipments',titleKey:'dashboard.openShipments',category:'shipping',defaultSize:'M',allowedSizes:['S','M','L'],selector:'#openShipments'});
  api.registerWidget({id:'open-shipments',titleKey:'dashboard.openShipments',category:'shipping',defaultSize:'M',allowedSizes:['M'],selector:'#openShipments'});
  const rows=api.registry().filter(row=>row.id==='open-shipments');
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,'open-shipments');
});

test('RC1371 verweist auf bestehende Dashboard-Knoten und klont sie nie',()=>{
  const api=load();
  const card=node('metricOpenShipments');
  const root=node('dashboardRoot');root.children=[card];card.parentNode=root;
  const found=api.discoverWidgets(root);
  assert.equal(found.length,1);
  assert.equal(found[0].node,card);
  assert.equal(found[0].definition.id,'metricopenshipments');
  assert.doesNotMatch(source,/cloneNode\s*\(/);
});

test('RC1371 markiert Dashboard-Blöcke ohne stabilen Anker als feste Systemblöcke',()=>{
  const api=load();
  const card=node('');
  const root=node('dashboardRoot');root.children=[card];card.parentNode=root;
  const found=api.discoverWidgets(root);
  assert.equal(found.length,1);
  assert.equal(found[0].fixed,true);
  assert.equal(card.getAttribute('data-rc1371-fixed-system'),'1');
});

test('RC1371 delegiert Widget-Rechte an bestehendes canView',()=>{
  const seen=[];
  const api=load({canView:module=>{seen.push(module);return module!=='admin'}});
  assert.equal(api.canUseWidget({id:'a',requiredModule:'dashboard'}),true);
  assert.equal(api.canUseWidget({id:'b',requiredModule:'admin'}),false);
  assert.deepEqual(seen,['dashboard','admin']);
});

test('RC1371 blendet gespeichertes Widget nach Rechteentzug aus',()=>{
  const api=load({canView:module=>module!=='customs'});
  api.registerWidget({id:'allowed',defaultSize:'M',allowedSizes:['M'],requiredModule:'dashboard'});
  api.registerWidget({id:'denied',defaultSize:'M',allowedSizes:['M'],requiredModule:'customs'});
  const state={schema:'v1',template:'standard',widgets:[
    {id:'allowed',visible:true,size:'M',order:0},
    {id:'denied',visible:true,size:'M',order:1}
  ]};
  assert.deepEqual(api.visibleLayout(state).widgets.map(row=>row.id),['allowed']);
  assert.deepEqual(api.libraryWidgets().map(row=>row.id),['allowed']);
});

test('RC1371 enthält keine Ersatzimplementierung bestehender Dashboard-Fachlogik',()=>{
  for(const name of ['shipmentDashboardOpenList','workspaceTaskVisible','workspaceTaskForUser','dashboardShipmentPickedUp']){
    assert.doesNotMatch(source,new RegExp('function\\s+'+name+'\\s*\\('));
  }
});
