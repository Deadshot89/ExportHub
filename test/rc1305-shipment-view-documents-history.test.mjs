import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

const historySource=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');
const buildSource=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const de=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));

function runtime(){
  const shipment={id:'S1',ref:'ABC123',status:'Abgeholt',shipmentHistory:[]};
  const state={view:'shipmentview',shipmentViewId:'S1',shipments:[shipment],savedShipments:[shipment],currentUser:{id:'U1',name:'Tobias',role:'Globaler Administrator'}};
  const listeners={};
  const document={
    body:null,readyState:'loading',
    addEventListener(name,fn){(listeners[name]||(listeners[name]=[])).push(fn)},
    getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]}
  };
  const window={
    ExportHUBI18n:{
      language(){return'de'},
      t(key,vars){let value=de[key]||key;if(vars)for(const [name,v] of Object.entries(vars))value=value.replaceAll('{{'+name+'}}',String(v));return value},
      formatDate(value,options){return new Intl.DateTimeFormat('de-DE',options||{}).format(value)}
    },
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_CURRENT_USER__:()=>state.currentUser,
    ExportHUBClean:{state,queueSave(){return true},flushSave(){return Promise.resolve(true)}},
    addEventListener(){},document,console
  };
  const context={window,document,console,Date,Intl,Math,Map,Set,Array,Object,String,Number,Promise,CustomEvent:function(){},
    setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},MutationObserver:undefined};
  vm.runInNewContext(historySource,context,{filename:'rc1071-shipment-history.js'});
  return{shipment,listeners,api:window.ExportHUBShipmentHistory1071};
}

function clickTarget(label,sectionText){
  const section={
    textContent:sectionText||label,
    getAttribute(){return''}
  };
  const button={
    textContent:label,
    getAttribute(name){
      if(name==='data-rc776-documents')return label==='Ladeliste & CMR'?'1':'';
      return'';
    },
    closest(selector){
      if(selector==='button,a,[role="button"]')return this;
      if(selector.includes('section')||selector.includes('.card')||selector.includes('.panel')||selector.includes('.field'))return section;
      return null;
    }
  };
  return{closest(selector){return selector==='button,a,[role="button"]'?button:null}};
}

test('RC1305: Navigation zu Ladeliste & CMR erzeugt keinen falschen CMR-geöffnet-Eintrag',()=>{
  const {shipment,listeners}=runtime();
  const click=(listeners.click||[])[0];
  assert.equal(typeof click,'function');
  click({target:clickTarget('Ladeliste & CMR','Dateien & Dokumente Ladeliste & CMR')});
  assert.equal((shipment.shipmentHistory||[]).filter(x=>x.type==='document-open').length,0);
});

test('RC1305: eine ausdrückliche Dokumentöffnung wird weiterhin protokolliert',()=>{
  const {shipment,api}=runtime();
  api.recordDocumentAction(shipment,'open','CMR','CMR_ABC123.pdf');
  const opens=(shipment.shipmentHistory||[]).filter(x=>x.type==='document-open');
  assert.equal(opens.length,1);
  assert.equal(opens[0].details.document,'CMR');
  assert.equal(opens[0].details.fileName,'CMR_ABC123.pdf');
});

test('RC1305: Sendungsansicht verbindet Ref-Ordner, gespeicherte Anhänge und Blob-Dokumente',()=>{
  assert.match(buildSource,/function mergeReferenceDocs\(live,fallback\)/);
  assert.match(buildSource,/fallback=arr\(fallback\)\.filter\(fallbackDocUsable\)/);
  assert.match(buildSource,/ExportHUBDocumentBlob1059/);
  assert.match(buildSource,/source==='combined'/);
  assert.match(buildSource,/Ref-Ordner \+ gespeicherte Anhänge/);
});

test('RC1305: Statusverlauf enthält fachliche Sendungsbewegung einschließlich Abholung',()=>{
  assert.match(buildSource,/pickupRows\(sh&&sh\.pickupHistory,'main'\)/);
  assert.match(buildSource,/actualPickupDate\|\|sh\.pickedUpAtDate\|\|sh\.pickedUpAt\|\|sh\.pickupConfirmedAt/);
  assert.match(buildSource,/'Abgeholt'/);
  assert.match(buildSource,/'POD vorhanden'/);
  assert.match(buildSource,/'Abgeschlossen'/);
  assert.match(buildSource,/Fachliche Bewegung der Sendung: Status, Abholung, POD und Abschluss/);
});

test('RC1305: Build-Skript bleibt syntaktisch gültig und lädt die History mit neuem Cache-Key',()=>{
  const check=spawnSync(process.execPath,['--check','.github/rc1112/build-three-env.mjs'],{encoding:'utf8'});
  assert.equal(check.status,0,check.stderr||check.stdout);
  assert.match(buildSource,/rc1071-shipment-history\.js\?v=1305/);
  assert.match(historySource,/version:'RC1305'/);
});
