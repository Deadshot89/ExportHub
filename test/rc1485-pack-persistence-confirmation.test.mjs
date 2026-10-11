import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const INTERNAL=fs.readFileSync('assets/pack-notification-internal.js','utf8');
const SHIPMENT=fs.readFileSync('assets/pack-notification-shipment.js','utf8');

const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

function makeState(){
  return{
    environment:'production',
    packNotifications:[{
      id:'pn-1',reference:'PK-1',customer:'BSH',deliveryNoteReference:'LS1',packageType:'Europalette',packageCount:1,totalWeight:100,
      packages:[{packageNo:1,length:120,width:80,height:100,unit:'cm'}],
      documents:[{id:'d1',name:'LS1.pdf',blobName:'pack/ls1.pdf',mimeType:'application/pdf',size:12}],
      status:'new',createdAt:'2026-10-11T08:00:00.000Z'
    }],
    tasks:[{id:'task:pack:pn-1',sourceType:'pack_notification',sourceId:'pn-1',sourceRef:'PK-1',status:'open',unread:true}],
    shipments:[]
  };
}

function internalHarness(){
  const state=makeState(),calls=[];
  let flushResult=false;
  const root={
    __EXPORTHUB_GET_STATE__:()=>state,
    ExportHUBClean:{
      queueSave:reason=>{calls.push(['queue',reason]);return true;},
      flushSave:reason=>{calls.push(['flush',reason]);return flushResult;}
    }
  };
  vm.runInContext(INTERNAL,vm.createContext({window:root,globalThis:root,console,Date,Intl,setTimeout,clearTimeout}),{filename:'pack-notification-internal.js'});
  const host={innerHTML:'',appendChild(){}};
  root.document={
    body:{setAttribute(){}},
    getElementById:id=>id==='content'?host:null,
    querySelector(){return null;},
    createElement(){return{innerHTML:'',id:'',className:'',addEventListener(){},appendChild(){},setAttribute(){},querySelector(){return null;}};}
  };
  return{state,calls,api:root.ExportHUBPackNotifications,setFlush:value=>{flushResult=value;}};
}

test('RC1485: Packmeldung bleibt ungelesen/neuwertig wenn persist explizit fehlschlägt',async()=>{
  const x=internalHarness();
  assert.equal(x.api.openNotificationDetail(x.state.packNotifications[0]),true);
  await tick();await tick();
  assert.equal(x.calls.filter(call=>call[0]==='flush').length,1);
  assert.equal(x.state.packNotifications[0].status,'new','fehlgeschlagenes Speichern darf Status nicht nur lokal auf in_review setzen');
  assert.equal(x.state.tasks[0].unread,true,'fehlgeschlagenes Speichern darf Badge/ungelesen nicht nur lokal entfernen');
  assert.equal(x.state.tasks[0].readAt,undefined);
});

function shipmentHarness(){
  const state=makeState(),calls=[],listeners={};
  state.packNotifications[0].status='in_review';
  let flushResult=false;
  const root={
    __EXPORTHUB_GET_STATE__:()=>state,
    ExportHUBClean:{
      queueSave:reason=>{calls.push(['queue',reason]);return true;},
      flushSave:reason=>{calls.push(['flush',reason]);return flushResult;}
    },
    addEventListener:(name,handler)=>{listeners[name]=handler;},
    setView(){},
  };
  vm.runInContext(SHIPMENT,vm.createContext({window:root,globalThis:root,console,Date,Intl,setTimeout,clearTimeout,Event:function(){},KeyboardEvent:function(){}}),{filename:'pack-notification-shipment.js'});
  return{state,calls,listeners,root,api:root.ExportHUBPackShipment,setFlush:value=>{flushResult=value;}};
}

test('RC1485: fehlgeschlagene Pack-Sendungsverknüpfung rollt Link zurück und bleibt retryfähig',async()=>{
  const x=shipmentHarness();
  assert.equal(x.api.begin('pn-1'),true);
  const saved={id:'sh-1',ref:'ABC123',deliveryFiles:[]};
  x.state.shipments.push(saved);
  await x.listeners['exporthub:shipment-saved']({detail:{shipment:saved}});

  assert.equal(x.calls.filter(call=>call[0]==='flush').length,1);
  assert.equal(x.state.packNotifications[0].status,'in_review');
  assert.equal(x.state.packNotifications[0].shipmentId,undefined);
  assert.equal(saved.packNotificationId,undefined);
  assert.equal(saved.deliveryFiles.length,0);
  assert.equal(x.state.tasks[0].status,'open');
  assert.ok(x.root.__EXPORTHUB_PACK_SHIPMENT_PREFILL__,'fehlgeschlagene Verknüpfung muss für Retry vorgemerkt bleiben');

  x.setFlush(true);
  await x.listeners['exporthub:shipment-saved']({detail:{shipment:saved}});
  assert.equal(x.calls.filter(call=>call[0]==='flush').length,2,'Retry sendet genau einen weiteren Save');
  assert.equal(x.state.packNotifications[0].status,'shipment_created');
  assert.equal(x.state.packNotifications[0].shipmentId,'sh-1');
  assert.equal(saved.packNotificationId,'pn-1');
  assert.equal(x.state.tasks[0].status,'in_progress');
  assert.equal(x.root.__EXPORTHUB_PACK_SHIPMENT_PREFILL__,null);
});
