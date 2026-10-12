import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

let built=false;
function build(){
  if(built)return;
  execFileSync(process.execPath,['scripts/rc1462-pretest.mjs'],{stdio:'pipe'});
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  built=true;
}

function qrSuccessBlock(html){
  const marker="one.status='Bereit zur Abholung';one.processStatus='Bereit zur Abholung'";
  const at=html.indexOf(marker);
  assert.ok(at>=0,'QR-Erfolgsstatus fehlt im Release-Build');
  const start=Math.max(0,html.lastIndexOf('function ',at));
  const next=html.indexOf('function ',at+marker.length);
  const end=next>at?next:Math.min(html.length,at+3500);
  return html.slice(start,end);
}

function doneSource(html){
  const start=html.indexOf('function done(data,compat){');
  assert.ok(start>=0,'QR done()-Funktion fehlt');
  const marker='return true}';
  const end=html.indexOf(marker,start);
  assert.ok(end>start,'QR done()-Funktionsende fehlt');
  return html.slice(start,end+marker.length);
}

function shipment(extra={}){
  return {id:'DRAFT-LEGACY-PPR6UC',ref:'PPR6UC',reference:'PPR6UC',customerName:'ESSENTRA COMPONENTS SAS',status:'Erstellt',processStatus:'Erstellt',rows:[{count:18}],...extra};
}

test('RC1498: QR-Erfolg synchronisiert auch serverseitig persistierte Shared-Sendungen',()=>{
  build();
  for(const file of ['index.html','TESTVERSION.html']){
    const html=fs.readFileSync('dist-rc1112/'+file,'utf8');
    const block=qrSuccessBlock(html);
    assert.match(block,/salesSharedShipments/,file+': QR-Erfolg lässt salesSharedShipments sonst im Status Erstellt stehen');
    assert.match(block,/sharedShipments/,file+': QR-Erfolg lässt sharedShipments sonst im Status Erstellt stehen');
  }
});

test('RC1498: QR-Erfolg erreicht die State-Wurzeln der Sendungsübersicht',()=>{
  build();
  for(const file of ['index.html','TESTVERSION.html']){
    const html=fs.readFileSync('dist-rc1112/'+file,'utf8');
    const block=qrSuccessBlock(html);
    assert.match(block,/ExportHUBClean\.state|rc1498/i,file+': QR-Erfolg erreicht ExportHUBClean.state der Sendungsübersicht nicht');
    assert.match(block,/appState|rc1498/i,file+': QR-Erfolg erreicht appState der Sendungsübersicht nicht');
  }
});

test('RC1498: erfolgreicher Pickup-Init setzt PPR6UC-artige persistierte Kopien wirklich auf Bereit zur Abholung',()=>{
  build();
  const html=fs.readFileSync('dist-rc1112/index.html','utf8');
  const active=shipment();
  const canonical=shipment({id:'DRAFT-CANONICAL-PPR6UC'});
  const salesShared=shipment({id:'DRAFT-SALES-SHARED-PPR6UC'});
  const shared=shipment({id:'DRAFT-SHARED-PPR6UC'});
  const unrelated=shipment({ref:'ABC123',reference:'ABC123',id:'DRAFT-OTHER'});
  const state={shipments:[canonical],savedShipments:[],salesSharedShipments:[salesShared],sharedShipments:[shared,unrelated]};
  let saves=0;
  const context={
    window:{ExportHUBClean:{state},appState:state,ExportHUBRC543:{recalculateShipmentStatus(){}}},
    sh:active,
    result:false,
    q:v=>String(v==null?'':v).trim(),
    validToken:v=>/^[a-f0-9]{48}$/i.test(String(v||'')),
    syncSnapshot:()=>JSON.stringify([active,canonical,salesShared,shared].map(x=>[x.pickupQrRegistered,x.status,x.processStatus,x.pickupQrRegisteredAt])),
    copies:()=>[active],
    low:v=>String(v==null?'':v).toLowerCase(),
    clone:v=>JSON.parse(JSON.stringify(v)),
    save:()=>{saves++},
    sid:v=>String(v&&(v.id||v.shipmentId||v.uuid)||'').trim().toUpperCase(),
    sref:v=>String(v&&(v.ref||v.reference||v.shipmentRef||v.referenceNumber)||'').trim().toUpperCase(),
    states:()=>[],
    arr:v=>Array.isArray(v)?v:[]
  };
  vm.runInNewContext(`${doneSource(html)}\nresult=done({token:'${'a'.repeat(48)}',status:'open'},false);`,context);
  assert.equal(context.result,true);
  for(const copy of [active,canonical,salesShared,shared]){
    assert.equal(copy.pickupQrRegistered,true,'persistierte PPR6UC-Kopie muss serverseitig registriert markiert sein');
    assert.equal(copy.status,'Bereit zur Abholung');
    assert.equal(copy.processStatus,'Bereit zur Abholung');
    assert.equal(copy.readyForPickup,true);
  }
  assert.equal(unrelated.status,'Erstellt','fremde Referenzen dürfen nicht verändert werden');
  assert.ok(saves>=1,'QR-Erfolg muss den geänderten Teamstand speichern');
});
