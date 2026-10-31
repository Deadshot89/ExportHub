import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const historySource=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');
const overviewCss=fs.readFileSync('assets/rc1558-dashboard-overview.css','utf8');

function historyRuntime(view){
  const appended=[];
  const node=()=>({id:'',className:'',innerHTML:'',firstChild:null,style:{},setAttribute(){},appendChild(c){return c},remove(){}});
  const content=node();content.appendChild=c=>{appended.push(c);return c};
  const shipment={id:'S1',ref:'DOXLB9',shipmentHistory:[{action:'work-started',at:'2026-10-31T10:00:00Z'}]};
  const state={view,currentShipment:shipment,shipments:[shipment],savedShipments:[shipment],currentUser:{name:'Demo'}};
  const document={body:node(),head:node(),documentElement:node(),readyState:'loading',addEventListener(){},
    getElementById(id){return id==='content'?content:null},querySelector(){return null},querySelectorAll(){return[]},createElement:node};
  const window={ExportHUBI18n:{language(){return'de'},t(k){return k}},__EXPORTHUB_GET_STATE__:()=>state,addEventListener(){},document,console};
  vm.runInNewContext(historySource,{window,document,console,Date,Intl,Math,Map,Set,Array,Object,String,Number,Promise,
    setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},MutationObserver:undefined},{filename:'rc1071-shipment-history.js'});
  return{api:window.ExportHUBShipmentHistory1071,appended};
}

test('RC1742: Sendungshistorie erscheint nur beim Erstellen/Ansehen einer Sendung, nicht in Übersicht oder Suche',()=>{
  for(const view of ['shipmentoverview','shipmentsearch','dashboard']){
    const {api,appended}=historyRuntime(view);
    assert.equal(api.render(),false,view+' must not get the history card');
    assert.equal(appended.length,0,view+' must not append to #content');
  }
  for(const view of ['shipment','shipmentview']){
    const {api,appended}=historyRuntime(view);
    assert.equal(api.render(),true,view+' keeps the history card');
    assert.equal(appended.length,1);
  }
});

test('RC1742: das Ein-Seiten-Dashboard bekommt keine nachträglich eingeschobene dritte Zeile',()=>{
  const block=overviewCss.slice(overviewCss.indexOf('/* RC1742'));
  assert.ok(block.length>0,'RC1742 block missing');
  const sel='html body[data-rc1558-overview="1"][data-rc1569-fit="1"] #content#content#content:not([data-rc1371-editing="1"]) > ';
  assert.ok(block.includes(sel+'#taskplannerV2DashboardProjection,'),'task overview card must be hidden in fit mode');
  assert.ok(block.includes(sel+'#rc46SopEditorHolder{display:none!important}'),'empty SOP holder must not add a gap row');
});
