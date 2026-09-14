import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');

function runtime(current,saved,archived=[]){
  const state={
    view:'shipment',
    currentShipment:current,
    shipments:[current],
    savedShipments:[saved],
    shipmentArchive:archived,
    archivedShipments:[],
    currentUser:{id:'U1',name:'Tobias',role:'Globaler Administrator'}
  };
  const document={body:null,readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null}};
  const window={
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

function event(id,at,type,label,actor='Tobias'){
  return{id,at,type,label,actor:{name:actor}};
}

test('RC1097: Sendungsansicht vereinigt History aller Kopien derselben Sendung',()=>{
  const current={id:'S1',ref:'JXR4XY',shipmentHistory:[
    event('H-WORK','2026-09-14T11:03:45Z','work-start','Arbeit an Sendung gestartet')
  ]};
  const saved={id:'S1',ref:'JXR4XY',shipmentHistory:[
    event('H-CREATED','2026-09-11T08:05:00Z','created','Sendung erstellt'),
    event('H-PRINT','2026-09-11T08:20:00Z','print','CMR gedruckt','Daniel'),
    event('H-MAIL','2026-09-11T08:30:00Z','mail-sent','Versandanmeldung versendet','Tobias')
  ]};
  const {api}=runtime(current,saved);

  const ids=api.events(current).map(x=>x.id).sort();
  assert.deepEqual(ids,['H-CREATED','H-MAIL','H-PRINT','H-WORK']);
});

test('RC1097: neuer History-Eintrag darf ältere Ereignisse anderer Sendungskopien nicht überschreiben',()=>{
  const current={id:'S1',ref:'JXR4XY',shipmentHistory:[
    event('H-WORK','2026-09-14T11:03:45Z','work-start','Arbeit an Sendung gestartet')
  ]};
  const saved={id:'S1',ref:'JXR4XY',shipmentHistory:[
    event('H-CREATED','2026-09-11T08:05:00Z','created','Sendung erstellt'),
    event('H-ABD','2026-09-11T09:00:00Z','abd','ABD-Dokument hinzugefügt')
  ]};
  const {api}=runtime(current,saved);

  api.append(current,event('H-POD','2026-09-14T11:10:00Z','pod','POD hinzugefügt'),{persist:false});

  const expected=['H-ABD','H-CREATED','H-POD','H-WORK'];
  assert.deepEqual(current.shipmentHistory.map(x=>x.id).sort(),expected);
  assert.deepEqual(saved.shipmentHistory.map(x=>x.id).sort(),expected);
});

test('RC1097: archivierte Kopie kann fehlende History zur aktiven Sendung ergänzen',()=>{
  const current={id:'S1',ref:'JXR4XY',shipmentHistory:[event('H-WORK','2026-09-14T11:03:45Z','work-start','Arbeit an Sendung gestartet')]};
  const saved={id:'S1',ref:'JXR4XY',shipmentHistory:[]};
  const archived={id:'S1',ref:'JXR4XY',shipmentHistory:[event('H-PICKUP','2026-09-12T12:00:00Z','pickup','Abholung bestätigt','Lager')]};
  const {api}=runtime(current,saved,[archived]);

  const ids=api.events(current).map(x=>x.id).sort();
  assert.deepEqual(ids,['H-PICKUP','H-WORK']);
});
