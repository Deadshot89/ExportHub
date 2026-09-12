import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const merge=require('../api/shared/merge.js');
const source=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');
const builder=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');

function runtime(shipment){
  const state={view:'shipment',currentShipment:shipment,shipments:[shipment],savedShipments:[shipment],currentUser:{id:'U1',name:'Tobias',role:'Globaler Administrator'}};
  const calls=[];
  const document={
    body:null,readyState:'loading',
    addEventListener(){},getElementById(){return null},querySelector(){return null}
  };
  const window={
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_CURRENT_USER__:()=>state.currentUser,
    ExportHUBClean:{state,queueSave(reason){calls.push(['queue',reason]);return true},flushSave(reason,opt){calls.push(['flush',reason,opt]);return Promise.resolve(true)}},
    addEventListener(){},document,console
  };
  const context={window,document,console,Date,Intl,Math,Map,Set,Array,Object,String,Number,Promise,
    setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},MutationObserver:undefined};
  vm.runInNewContext(source,context,{filename:'rc1071-shipment-history.js'});
  return{api:window.ExportHUBShipmentHistory1071,state,calls};
}

test('RC1071: parallele Browser-History wird additiv nach Ereignis-ID gemerged',()=>{
  const server={id:'S1',ref:'ABC123',updatedAt:'2026-09-12T10:00:00Z',shipmentHistory:[
    {id:'H1',at:'2026-09-12T09:00:00Z',type:'created',label:'Sendung erstellt',actor:{name:'Tobias'}}
  ]};
  const client={id:'S1',ref:'ABC123',updatedAt:'2026-09-12T10:01:00Z',shipmentHistory:[
    {id:'H2',at:'2026-09-12T09:30:00Z',type:'print',label:'CMR zum Drucken/Erzeugen geöffnet',actor:{name:'Daniel'}}
  ]};
  const out=merge.mergeShipmentProtected(server,client);
  assert.deepEqual(out.shipmentHistory.map(x=>x.id),['H1','H2']);
});

test('RC1071: History speichert kleine Metadaten aber keine Tokens oder Mailtexte',()=>{
  const sh={id:'S1',ref:'ABC123'};
  const {api}=runtime(sh);
  api.append(sh,{type:'mail',label:'E-Mail vorbereitet/geöffnet',actor:{name:'Tobias'},details:{
    to:'carrier@example.com',subject:'Abholung ABC123',token:'SECRET',authorization:'Bearer x',body:'sehr langer Mailtext'
  }},{persist:false});
  assert.equal(sh.shipmentHistory.length,1);
  assert.equal(sh.shipmentHistory[0].details.to,'carrier@example.com');
  assert.equal(sh.shipmentHistory[0].details.subject,'Abholung ABC123');
  assert.equal('token' in sh.shipmentHistory[0].details,false);
  assert.equal('authorization' in sh.shipmentHistory[0].details,false);
  assert.equal('body' in sh.shipmentHistory[0].details,false);
});

test('RC1071: vorhandene QR-Abholung erscheint mit Verlader/Fahrer in der Sendungshistorie',()=>{
  const sh={id:'S1',ref:'ABC123',pickupHistory:[{
    id:'P1',confirmedAt:'2026-09-12T11:00:00Z',complete:true,loaderName:'Mitarbeiter Lager',
    driverName:'Fahrer A',licensePlate:'KK-AA 1',colliCount:5,remainingAfter:0
  }]};
  const {api}=runtime(sh);
  const events=api.events(sh);
  const pickup=events.find(x=>x.type==='pickup');
  assert.ok(pickup);
  assert.equal(pickup.actor.name,'Mitarbeiter Lager');
  assert.equal(pickup.details.driver,'Fahrer A');
  assert.equal(pickup.details.licensePlate,'KK-AA 1');
});

test('RC1071: Mail geöffnet und tatsächlich versendet bleiben zwei verschiedene Ereignisse',()=>{
  assert.match(source,/E-Mail vorbereitet\/geöffnet/);
  assert.match(source,/Mail als versendet bestätigen/);
  assert.match(source,/Bestätigen, dass die E-Mail tatsächlich versendet wurde/);
  assert.match(source,/type:'mail-sent',label:'E-Mail-Versand bestätigt'/);
});

test('RC1071: Ersteller, Druck, Status, ABD, POD und Avis sind als History-Ereignisse vorgesehen',()=>{
  for(const marker of [
    "type:'created',label:'Sendung erstellt'",
    "type:'print'",
    "type:'status'",
    "type:'abd'",
    "type:'pod'",
    "type:'avis'",
    "type:'pickup'"
  ]) assert.ok(source.includes(marker),marker+' fehlt');
  assert.match(source,/sh\.createdBy=a\.name/);
  assert.match(source,/documentLabel\(text\)/);
});

test('RC1071: Timeline wird direkt in der Sendungsansicht dargestellt und mobil lesbar',()=>{
  assert.match(source,/id='rc1071ShipmentHistory'|rc1071ShipmentHistory/);
  assert.match(source,/Sendungshistorie/);
  assert.match(source,/rc1071-history-row/);
  assert.match(source,/@media\(max-width:720px\)/);
});

test('RC1071: finaler RC1048-Build lädt History in Produktion TESTSERVICE und Demo',()=>{
  assert.match(builder,/RC1071_HISTORY_TAG/);
  assert.match(builder,/rc1071-shipment-history\.js\?v=1071/);
  assert.match(builder,/assets\/rc1071-shipment-history\.js/);
  assert.match(builder,/shipmentHistory:\{version:'RC1071'/);
});
