import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');
const de=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));

function runtime(state){
  const calls=[];
  const document={
    body:null,
    readyState:'loading',
    addEventListener(){},
    getElementById(){return null},
    querySelector(){return null},
    querySelectorAll(){return[]}
  };
  const window={
    ExportHUBI18n:{
      language(){return'de'},
      t(key,vars){let value=de[key]||key;if(vars)for(const [name,v] of Object.entries(vars))value=value.replaceAll('{{'+name+'}}',String(v));return value},
      formatDate(value,options){return new Intl.DateTimeFormat('de-DE',options||{}).format(value)}
    },
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_CURRENT_USER__:()=>state.currentUser,
    ExportHUBClean:{
      state,
      queueSave(reason){calls.push(['queue',reason]);return true},
      flushSave(reason,opt){calls.push(['flush',reason,opt]);return Promise.resolve(true)}
    },
    addEventListener(){},
    document,
    console
  };
  const context={window,document,console,Date,Intl,Math,Map,Set,Array,Object,String,Number,Promise,
    setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},MutationObserver:undefined};
  vm.runInNewContext(source,context,{filename:'rc1071-shipment-history.js'});
  return{api:window.ExportHUBShipmentHistory1071,calls};
}

test('RC1468: schreibgeschützte Sendungsansicht bindet History an shipmentViewId statt an stale currentShipment',()=>{
  const viewed={id:'VIEWED',ref:'ZVYH89',shipmentHistory:[]};
  const stale={id:'STALE',ref:'HYZLNQ',shipmentHistory:[]};
  const state={
    view:'shipmentview',
    shipmentViewId:'VIEWED',
    currentShipment:stale,
    shipments:[viewed,stale],
    savedShipments:[viewed,stale],
    currentUser:{id:'U1',name:'Tobias',role:'Globaler Administrator'}
  };
  const {api}=runtime(state);
  assert.equal(api.currentShipment(),viewed);
});

test('RC1468: bloßes Öffnen der Nur-Lesen-Sendungsansicht erzeugt keinen Arbeitsstart und keinen Save',()=>{
  const viewed={id:'VIEWED',ref:'ZVYH89',shipmentHistory:[]};
  const state={
    view:'shipmentview',
    shipmentViewId:'VIEWED',
    currentShipment:viewed,
    shipments:[viewed],
    savedShipments:[viewed],
    currentUser:{id:'U1',name:'Tobias',role:'Globaler Administrator'}
  };
  const {api,calls}=runtime(state);
  assert.equal(api.markWorkStarted(),false);
  assert.equal(viewed.shipmentHistory.length,0);
  assert.equal(calls.length,0);
});

test('RC1468: Build erzwingt einen neuen Cache-Key für die korrigierte History-Runtime',()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  assert.match(build,/rc1071-shipment-history\.js\?v=1468/);
  assert.match(build,/RC1468 Dokument-History Cache-Key fehlt/);
});
