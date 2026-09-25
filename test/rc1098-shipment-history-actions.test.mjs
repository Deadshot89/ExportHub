import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');
const historyDe=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));
function historyI18n(){
  return {
    language(){return 'de'},
    t(key,vars){let value=historyDe[key]||key;if(vars)for(const [name,v] of Object.entries(vars))value=value.replaceAll('{{'+name+'}}',String(v));return value},
    formatDate(value,options){return new Intl.DateTimeFormat('de-DE',options||{}).format(value)}
  };
}


function runtime(shipment){
  const state={view:'shipment',currentShipment:shipment,shipments:[shipment],savedShipments:[shipment],currentUser:{id:'U1',name:'Tobias',role:'Globaler Administrator'}};
  const document={body:null,readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null}};
  const window={
    ExportHUBI18n:historyI18n(),
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_CURRENT_USER__:()=>state.currentUser,
    ExportHUBClean:{state,queueSave(){return true},flushSave(){return Promise.resolve(true)}},
    addEventListener(){},document,console
  };
  const context={window,document,console,Date,Intl,Math,Map,Set,Array,Object,String,Number,Promise,
    setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},MutationObserver:undefined};
  vm.runInNewContext(source,context,{filename:'rc1071-shipment-history.js'});
  return{api:window.ExportHUBShipmentHistory1071,state};
}

function labels(sh){return (sh.shipmentHistory||[]).map(x=>x.label)}

test('RC1098: Entfernen von ABD, POD und Versanddokumenten wird protokolliert',()=>{
  const sh={id:'S1',ref:'ABC123',abdFiles:[{name:'ABD-old.pdf'}],podFiles:[{name:'POD-old.pdf'}],deliveryFiles:[{name:'LS-old.pdf'}]};
  const {api}=runtime(sh);
  api.monitor();
  sh.abdFiles=[];sh.podFiles=[];sh.deliveryFiles=[];
  api.monitor();
  assert.ok(labels(sh).includes('ABD-Dokument entfernt'));
  assert.ok(labels(sh).includes('POD entfernt'));
  assert.ok(labels(sh).includes('Versanddokument entfernt'));
});

test('RC1098: Austausch eines Dokuments bei gleicher Anzahl wird erkannt',()=>{
  const sh={id:'S1',ref:'ABC123',abdFiles:[{name:'ABD-alt.pdf'}]};
  const {api}=runtime(sh);
  api.monitor();
  sh.abdFiles=[{name:'ABD-neu.pdf'}];
  api.monitor();
  const row=(sh.shipmentHistory||[]).find(x=>x.label==='ABD-Dokument ersetzt');
  assert.ok(row);
  assert.equal(row.details.oldFile,'ABD-alt.pdf');
  assert.equal(row.details.newFile,'ABD-neu.pdf');
});

test('RC1098: Lieferavis-Deaktivierung wird mit Benutzer protokolliert',()=>{
  const sh={id:'S1',ref:'ABC123',customerAvisEnabled:true};
  const {api}=runtime(sh);
  api.monitor();
  sh.customerAvisEnabled=false;
  api.monitor();
  const row=(sh.shipmentHistory||[]).find(x=>x.label==='Lieferavis deaktiviert');
  assert.ok(row);
  assert.equal(row.actor.name,'Tobias');
});

test('RC1098: wichtige Statuswechsel erhalten eindeutige Aktionsnamen',()=>{
  const sh={id:'S1',ref:'ABC123',status:'Bereit zur Abholung'};
  const {api}=runtime(sh);
  api.monitor();
  sh.status='Storniert';api.monitor();
  sh.status='Nachbearbeitung';api.monitor();
  sh.status='Abgeschlossen';api.monitor();
  sh.status='Archiviert';api.monitor();
  const rows=labels(sh);
  for(const expected of ['Sendung storniert','Sendung in Nachbearbeitung','Sendung abgeschlossen','Sendung archiviert'])assert.ok(rows.includes(expected),expected+' fehlt');
});
